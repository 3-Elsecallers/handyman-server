import "dotenv/config";
import { PrismaClient } from "../generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const providers = await prisma.providerProfile.findMany({
    include: { services: true },
  });

  let promoted = 0;
  let skipped = 0;

  for (const p of providers) {
    let next: "not_submitted" | "pending_review" | "approved" | "rejected";

    if (p.identityStatus === "rejected") {
      next = "rejected";
    } else if (
      p.identityStatus === "approved" &&
      p.services.length > 0 &&
      p.services.some((s) => s.status === "approved")
    ) {
      next = "approved";
    } else if (
      p.identityStatus === "pending_review" ||
      p.services.some((s) => s.status === "pending_review")
    ) {
      next = "pending_review";
    } else {
      next = "not_submitted";
    }

    const data: {
      verificationStatus: "not_submitted" | "pending_review" | "approved" | "rejected";
      status?: "active";
      verified?: boolean;
    } = { verificationStatus: next };
    if (next === "approved") {
      data.verified = true;
      if (p.status === "pending_review") {
        data.status = "active";
      }
    }

    if (data.verificationStatus === p.verificationStatus && data.status == null && data.verified == null) {
      skipped++;
      continue;
    }

    await prisma.providerProfile.update({
      where: { id: p.id },
      data,
    });
    promoted++;
    console.log(
      `[${p.id}] verificationStatus ${p.verificationStatus} -> ${next}, status ${p.status} -> ${data.status ?? p.status}, verified ${p.verified} -> ${data.verified ?? p.verified}`,
    );
  }

  console.log(`Backfill complete: ${promoted} updated, ${skipped} unchanged.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
