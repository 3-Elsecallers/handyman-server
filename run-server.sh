#!/usr/bin/env bash
#
# run-server.sh — Run the entire Handyman backend (all microservices + infra).
#
#   Infrastructure (docker-compose in server/infrastructure):
#     - Kafka          : localhost:9092           (container handyman-kafka)
#     - LocalStack (S3): localhost:4566           (container handyman-localstack)
#   Local dependency (NOT in docker-compose):
#     - PostgreSQL     : localhost:5432           (Homebrew service, started if needed)
#   Microservices (npm, dev or build mode):
#     - gateway  :8080    - identity :8081    - provider :8082
#     - booking  :8083    - payment  :8084    - communication :8085
#
# Usage:
#   ./run-server.sh [command] [flags...]
#
# Commands:
#   start       (default) infra up + install/generate + launch services (blocks)
#   stop        stop all services launched by this script
#   restart     stop then start
#   status      show health of all services + infra
#   logs        print recent logs from all services
#   setup       npm install + prisma generate (+ --migrate, --seed)
#   migrate     run `prisma migrate deploy` on all DB services
#   seed        run provider-service seeds (taxonomy + vetting requirements)
#   infra-up    docker compose up -d (Kafka + LocalStack), waits for healthy
#   infra-down  docker compose down
#   infra-logs  tail docker compose logs (Kafka + LocalStack)
#
# Flags:
#   --no-infra      do not start docker-compose (Kafka/S3 assumed already up)
#   --mode dev      run with `tsx watch` hot reload           [default]
#   --mode build    build (tsc) then run `node dist/index.js`
#   --install       force re-run `npm install` on every service
#   --migrate       run prisma migrations before starting
#   --seed          run provider-service seeds before starting
#   --service <n>   start a single service only (e.g. --service payment)
#   logs -f         follow logs live
#
# Examples:
#   ./run-server.sh                      # full stack, dev mode
#   ./run-server.sh --mode build         # compiled run
#   ./run-server.sh --service gateway    # only the gateway
#   ./run-server.sh setup --seed         # deps + prisma + seed data
#   ./run-server.sh start --migrate --seed
#
# NOTE: Dev helper only. On Ctrl-C/stop it kills the process tree of every
# service it launched. Docker images are never built; PostgreSQL is expected
# to be a Homebrew service and is started automatically if pg_isready fails.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_ROOT="$(cd "$SCRIPT_DIR" && pwd)"                # server/
INFRA_DIR="$SERVER_ROOT/infrastructure"
COMPOSE_FILE="$INFRA_DIR/docker-compose.yml"
RUN_DIR="$SERVER_ROOT/.run"

# Start order: dependencies first, gateway last.
SERVICES=(identity provider booking payment communication gateway)
PORT_OF=(   gateway:8080 identity:8081 provider:8082 booking:8083 payment:8084 communication:8085 )
PRISMA_SERVICES=(identity provider booking payment communication)
SEED_SERVICES=(provider)

GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RED=$'\033[31m'; BOLD=$'\033[1m'; NC=$'\033[0m'
say()  { printf '%s\n' "$*"; }
ok()   { printf '%s[ OK ]%s %s\n' "$GREEN" "$NC" "$*"; }
info() { printf '%s[ .. ]%s %s\n' "$YELLOW" "$NC" "$*"; }
warn() { printf '%s[WARN]%s %s\n' "$YELLOW" "$NC" "$*"; }
die()  { printf '%s[FAIL]%s %s\n' "$RED" "$NC" "$*" >&2; exit 1; }

# --------------------------------------------------------------------------- #
# Argument parsing
# --------------------------------------------------------------------------- #
CMD="${1:-start}"; [[ "$CMD" == -* ]] && CMD=start
MODE=dev; NO_INFRA=0; DO_INSTALL=0; DO_MIGRATE=0; DO_SEED=0; DO_FOLLOW=0; ONLY_SERVICE=""
ARGS=("${@:2}")
i=0
while [[ $i -lt ${#ARGS[@]} ]]; do
  a="${ARGS[$i]}"
  case "$a" in
    --no-infra)  NO_INFRA=1 ;;
    --install)   DO_INSTALL=1 ;;
    --migrate)   DO_MIGRATE=1 ;;
    --seed)      DO_SEED=1 ;;
    -f)          DO_FOLLOW=1 ;;
    --mode)      MODE="${ARGS[$((i+1))]:-dev}"; i=$((i+1)) ;;
    --mode=*)    MODE="${a#*=}" ;;
    --service)   ONLY_SERVICE="${ARGS[$((i+1))]:-}"; i=$((i+1)) ;;
    --service=*) ONLY_SERVICE="${a#*=}" ;;
    *) die "Unknown flag '$a'" ;;
  esac
  i=$((i+1))
done
[[ "$MODE" != "dev" && "$MODE" != "build" ]] && die "Unknown --mode '$MODE' (use dev|build)"
[[ -n "$ONLY_SERVICE" ]] && SERVICES=("$ONLY_SERVICE")

# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
mkdir -p "$RUN_DIR/pids" "$RUN_DIR/logs"

port_of() {
  local s="$1" pair
  for pair in "${PORT_OF[@]}"; do
    [[ "${pair%%:*}" == "$s" ]] && { echo "${pair##*:}"; return 0; }
  done
  return 1
}

port_code() { local code; code="$(curl -s -o /dev/null --max-time 2 -w '%{http_code}' "$1" 2>/dev/null || true)"; [[ "$code" =~ ^[0-9]+$ ]] && echo "$code" || echo 000; }
port_up()   { [[ "$(port_code "$1")" != "000" ]]; }
service_up(){ local p; p="$(port_of "$1")" || return 1; port_up "http://localhost:$p"; }
pg_ready()  { pg_isready -h localhost -p 5432 -q 2>/dev/null; }
docker_up() { docker info >/dev/null 2>&1; }

service_dir() { echo "${1}-service"; }

wait_for() { # wait_for <name> <timeout_sec> <cmd...>
  local name="$1" timeout="$2"; shift 2
  local i=0
  while ! "$@" >/dev/null 2>&1; do
    i=$((i + 1)); [[ $i -gt $((timeout * 2)) ]] && return 1
    sleep 0.5
  done
}

container_healthy() { local st; st="$(docker inspect --format '{{.State.Health.Status}}' "$1" 2>/dev/null || true)"; [[ "$st" == "healthy" ]]; }

retry_container_healthy() { # wrapper so wait_for can call it
  container_healthy "${1:?}"
}

has_prisma()  { [[ -f "$1/prisma/schema.prisma" ]]; }
needs_install() { [[ ! -d "$1/node_modules" ]]; }

# --------------------------------------------------------------------------- #
# Infra
# --------------------------------------------------------------------------- #
infra_up() {
  docker_up || die "Docker is not running. Start Docker Desktop first."
  docker compose -f "$COMPOSE_FILE" up -d --wait >/dev/null 2>&1 \
    || docker compose -f "$COMPOSE_FILE" up -d \
    || die "docker compose up failed. See:\n  docker compose -f $COMPOSE_FILE up"
  info "Waiting for Kafka + LocalStack to become healthy..."
  wait_for "kafka" 120 retry_container_healthy handyman-kafka     || die "Kafka never became healthy"
  wait_for "s3"    120 retry_container_healthy handyman-localstack || die "LocalStack never became healthy"
  ok "Infrastructure up: Kafka :9092, S3 :4566"
}

infra_down() { docker compose -f "$COMPOSE_FILE" down; }

# --------------------------------------------------------------------------- #
# Postgres
# --------------------------------------------------------------------------- #
ensure_postgres() {
  if pg_ready; then
    ok "PostgreSQL is up on :5432"
    return
  fi
  warn "PostgreSQL is not running. Trying Homebrew service..."
  local pgpkg
  pgpkg="$(brew list --formula 2>/dev/null | grep -E '^postgresql(@[0-9]+)?$' | head -1 | tr -d '[:space:]')" || true
  [[ -z "$pgpkg" ]] && die "No Homebrew postgres found. Start PostgreSQL (brew services start postgresql@14) and re-run."
  brew services start "$pgpkg" >/dev/null 2>&1 || die "Could not start '$pgpkg'"
  wait_for "postgres" 30 pg_ready || die "PostgreSQL did not come up within 30s"
  ok "PostgreSQL started via $pgpkg"
}

# --------------------------------------------------------------------------- #
# Per-service setup
# --------------------------------------------------------------------------- #
setup_service() {
  local name="$1"
  local dir="$SERVER_ROOT/services/$(service_dir "$name")"
  [[ -d "$dir" ]] || die "Unknown service '$name' (no $dir)"
  info "Preparing [$name] (mode=$MODE)"
  if [[ "$DO_INSTALL" == 1 ]] || needs_install "$dir"; then
    info "  npm install [$name]"
    ( cd "$dir" && npm install --no-audit --no-fund ) || warn "  npm install failed for [$name]"
  fi
  if has_prisma "$dir"; then
    info "  prisma generate [$name]"
    ( cd "$dir" && npx --no-install prisma generate ) || warn "  prisma generate failed for [$name]"
  fi
  if [[ "$DO_MIGRATE" == 1 ]] && has_prisma "$dir"; then
    info "  prisma migrate deploy [$name]"
    ( cd "$dir" && npx --no-install prisma migrate deploy ) || warn "  migrate deploy failed for [$name]"
  fi
  if [[ "$DO_SEED" == 1 ]]; then
    [[ " ${SEED_SERVICES[*]} " == *" $name "* ]] || return 0
    info "  seeding [$name]"
    ( cd "$dir" && npx --no-install tsx prisma/seed-taxonomy.ts && npx --no-install tsx prisma/seed-vetting-requirements.ts ) \
      || warn "  seeding failed for [$name]"
  fi
}

# --------------------------------------------------------------------------- #
# Service lifecycle
# --------------------------------------------------------------------------- #
kill_tree() { # TERM every descendant so tsx AND its node child both exit
  local pid="$1"
  local stack=("$pid")
  while ((${#stack[@]})); do
    local p="${stack[0]}"; stack=("${stack[@]:1}")
    local children
    children="$(pgrep -P "$p" 2>/dev/null || true)"
    local c
    for c in $children; do stack+=("$c"); done
    kill -TERM "$p" 2>/dev/null || true
  done
}

stop_all() {
  [[ -d "$RUN_DIR/pids" ]] || return 0
  local pid f
  for f in "$RUN_DIR"/pids/*.pid; do
    [[ -e "$f" ]] || continue
    pid="$(cat "$f" 2>/dev/null || true)"
    [[ -n "$pid" && "$pid" =~ ^[0-9]+$ ]] && kill_tree "$pid"
    rm -f "$f"
  done
}

run_service() {
  local name="$1"
  local dir="$SERVER_ROOT/services/$(service_dir "$name")"
  local log="$RUN_DIR/logs/$name.log"
  local cmd
  if [[ "$MODE" == "build" ]]; then
    info "  build [$name]"
    ( cd "$dir" && npm run build >/dev/null ) || die "Build failed for [$name]"
    cmd='npm start'
  else
    cmd='npm run dev'
  fi
  touch "$log"; rm -f "$RUN_DIR/pids/$name.pid"
  ( cd "$dir" && bash -c "$cmd" 2>&1 | sed --line-buffered "s/^/[$name] /" | tee "$log" ) &
  echo $! > "$RUN_DIR/pids/$name.pid"
}

wait_services() {
  local name p
  for name in "${SERVICES[@]}"; do
    p="$(port_of "$name")"
    info "Waiting for [$name] on :$p ..."
    if wait_for "$name" 90 service_up "$name"; then
      ok "  [$name] up on :$p"
    else
      warn "  [$name] did not respond on :$p yet — see $RUN_DIR/logs/$name.log"
    fi
  done
}

# --------------------------------------------------------------------------- #
# Commands
# --------------------------------------------------------------------------- #
cmd_start() {
  ensure_postgres
  [[ "$NO_INFRA" == 1 ]] || infra_up
  local name
  for name in "${SERVICES[@]}"; do setup_service "$name"; done

  info "Launching services (mode=$MODE)..."
  for name in "${SERVICES[@]}"; do run_service "$name"; done
  wait_services

  say ""
  say "$BOLD  Handyman backend running (mode=$MODE). Ports:$NC"
  for pair in "${PORT_OF[@]}"; do printf '    %-13s :%s\n' "${pair%%:*}" "${pair##*:}"; done
  say "  Ctrl-C stops services. Docker infra stays up ('infra-down' to stop it)."
  say ""

  trap 'stop_all; exit 0' INT TERM EXIT
  while :; do sleep 1; done
}

cmd_status() {
  say "--- Microservices ---"
  local pair p code
  for pair in "${PORT_OF[@]}"; do
    p="${pair##*:}"; code="$(port_code "http://localhost:$p")"
    printf '  %-13s :%-5s %s\n' "${pair%%:*}" "$p" "$([[ "$code" != "000" ]] && echo "UP ($code)" || echo "down")"
  done
  say "--- Infrastructure ---"
  if docker_up; then
    for c in "handyman-kafka" "handyman-localstack"; do
      local st; st="$(docker inspect --format '{{.State.Health.Status}}' "$c" 2>/dev/null || echo not-running)"
      printf '  %-20s %s\n' "$c" "$st"
    done
  else
    printf '  Docker not running\n'
  fi
  printf '  %-20s %s\n' "postgresql:5432" "$(pg_ready && echo "up" || echo "down")"
}

cmd_logs() { local f; for f in "$RUN_DIR"/logs/*.log; do [[ -e "$f" ]] || continue; say "=== $f ==="; tail -50 "$f"; done; }
cmd_logs_follow() { local f; for f in "$RUN_DIR"/logs/*.log; do [[ -e "$f" ]] && tail -0f "$f" & done; wait; }

cmd_migrate() {
  ensure_postgres
  local name
  for name in "${PRISMA_SERVICES[@]}"; do
    info "migrate [$name]"
    ( cd "$SERVER_ROOT/services/$(service_dir "$name")" && npx --no-install prisma migrate deploy ) || warn "  migrate failed for [$name]"
  done
  ok "Migrations applied."
}

cmd_seed() {
  local dir="$SERVER_ROOT/services/$(service_dir provider)"
  [[ -d "$dir" ]] || die "provider-service missing"
  ( cd "$dir" && npx --no-install tsx prisma/seed-taxonomy.ts && npx --no-install tsx prisma/seed-vetting-requirements.ts ) || die "seed failed"
  ok "Provider seeds applied."
}

cmd_setup() {
  ensure_postgres
  local name
  for name in "${SERVICES[@]}"; do setup_service "$name"; done
  ok "Setup complete."
}

# --------------------------------------------------------------------------- #
case "$CMD" in
  start)        cmd_start ;;
  stop)         stop_all; ok "Services stopped. Docker infra left running (use 'infra-down')." ;;
  restart)      stop_all; cmd_start ;;
  status)       cmd_status ;;
  logs)         [[ "$DO_FOLLOW" == 1 ]] && cmd_logs_follow || cmd_logs ;;
  setup)        cmd_setup ;;
  migrate)      cmd_migrate ;;
  seed)         cmd_seed ;;
  infra-up)     infra_up ;;
  infra-down)   infra_down ;;
  infra-logs)   docker compose -f "$COMPOSE_FILE" logs -f --tail=100 ;;
  *) die "Unknown command '$CMD'. See header for usage." ;;
esac