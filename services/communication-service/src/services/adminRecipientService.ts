import { config } from "../config/env";

export interface AdminRecipient {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  [key: string]: unknown;
}

const CACHE_TTL_MS = 5 * 60_000;

let cachedAdmins: AdminRecipient[] | null = null;
let cacheExpiresAt = 0;

/**
 * Resolve the active admin user IDs to notify. Prefers the identity-service
 * internal endpoint (cached for 5 minutes); falls back to env-configured
 * ADMIN_NOTIFICATION_IDS when identity is unreachable or returns no admins.
 */
const fetchAdminsFromIdentity = async (): Promise<AdminRecipient[] | null> => {
  try {
    const res = await fetch(
      `${config.identityServiceUrl}/internal/users/by-role/admin`,
      {
        headers: { "x-service-token": config.internalServiceToken },
      },
    );
    if (!res.ok) throw new Error(`identity returned ${res.status}`);
    const json = (await res.json()) as { data?: AdminRecipient[] };
    return Array.isArray(json.data) ? json.data : null;
  } catch (error) {
    console.error("[AdminRecipients] Failed to fetch admins from identity:", error);
    return null;
  }
};

export const getAdminRecipients = async (): Promise<AdminRecipient[]> => {
  if (cachedAdmins && Date.now() < cacheExpiresAt) return cachedAdmins;

  const fromIdentity = await fetchAdminsFromIdentity();
  const admins =
    fromIdentity && fromIdentity.length > 0
      ? fromIdentity.filter((u) => Boolean(u.id))
      : config.notification.adminRecipientIds.map((id): AdminRecipient => ({ id }));

  if (admins.length === 0) {
    console.warn("[AdminRecipients] No admin recipients configured (identity returned none and ADMIN_NOTIFICATION_IDS is empty)");
  }

  cachedAdmins = admins;
  cacheExpiresAt = Date.now() + CACHE_TTL_MS;
  return admins;
};