import "dotenv/config";
import { hashPassword } from "better-auth/crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role } from "../src/generated/prisma/client.ts";

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

if (!email || !password) {
  throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set to seed the admin user.");
}

const adapter = new PrismaPg(process.env.DATABASE_URL as string);
const prisma = new PrismaClient({ adapter });

const user = await prisma.user.upsert({
  where: { email },
  update: { role: Role.admin },
  create: {
    id: crypto.randomUUID(),
    name: "Admin",
    email,
    emailVerified: true,
    role: Role.admin,
  },
});

const hashedPassword = await hashPassword(password);

const existingAccount = await prisma.account.findFirst({
  where: { userId: user.id, providerId: "credential" },
});

if (existingAccount) {
  await prisma.account.update({
    where: { id: existingAccount.id },
    data: { password: hashedPassword },
  });
} else {
  await prisma.account.create({
    data: {
      id: crypto.randomUUID(),
      userId: user.id,
      providerId: "credential",
      accountId: user.id,
      password: hashedPassword,
    },
  });
}

console.log(`Seeded admin user: ${email}`);

await prisma.$disconnect();
