import "dotenv/config";

import { prisma } from "../src/db/prisma";
import { hashPassword } from "../src/utils/password";

async function main() {
  const [email, password, firstName = "Admin", lastName = "User"] =
    process.argv.slice(2);

  if (!email || !password) {
    console.error(
      "Usage: tsx scripts/create-admin.ts <email> <password> [firstName] [lastName]",
    );
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);

  const admin = await prisma.user.upsert({
    where: { email },
    update: { role: "admin", emailVerified: true, passwordHash },
    create: {
      email,
      passwordHash,
      firstName,
      lastName,
      role: "admin",
      emailVerified: true,
    },
  });

  console.log(`Admin ready: ${admin.email} (${admin.id})`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
