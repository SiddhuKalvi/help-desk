import "dotenv/config";
import { hashPassword } from "better-auth/crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role } from "../src/generated/prisma/client.ts";

const email = process.env.AGENT_EMAIL ?? "agent@example.com";
const password = process.env.AGENT_PASSWORD ?? "password123";

const adapter = new PrismaPg(process.env.DATABASE_URL as string);
const prisma = new PrismaClient({ adapter });

const user = await prisma.user.upsert({
  where: { email },
  update: { role: Role.agent },
  create: {
    id: crypto.randomUUID(),
    name: "Test Agent",
    email,
    emailVerified: true,
    role: Role.agent,
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

console.log(`Seeded agent user: ${email}`);

await prisma.$disconnect();
