import "dotenv/config";
import { PrismaClient } from "../generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const attestations = await prisma.providerAttestation.findMany({
    where: { serviceId: null },
    include: {
      requirement: { select: { categoryId: true } },
      question: { select: { categoryId: true } },
    },
  });

  let updated = 0;
  let skipped = 0;
  let unmatched = 0;

  for (const att of attestations) {
    const categoryId = att.requirement?.categoryId ?? att.question?.categoryId;
    if (!categoryId) {
      skipped++;
      continue;
    }

    const providerService = await prisma.providerService.findFirst({
      where: { providerId: att.providerId, service: { categoryId } },
      select: { id: true },
    });

    if (!providerService) {
      unmatched++;
      continue;
    }

    await prisma.providerAttestation.update({
      where: { id: att.id },
      data: { serviceId: providerService.id },
    });
    updated++;
  }

  console.log(
    `Attestation backfill complete: ${updated} linked, ${unmatched} unmatched (no service in category), ${skipped} skipped (no category).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
