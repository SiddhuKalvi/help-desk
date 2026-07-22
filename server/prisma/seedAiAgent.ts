import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role } from "../src/generated/prisma/client.ts";

const email = process.env.AI_AGENT_EMAIL ?? "ai@helpdesk.local";

const adapter = new PrismaPg(process.env.DATABASE_URL as string);
const prisma = new PrismaClient({ adapter });

await prisma.user.upsert({
  where: { email },
  update: { role: Role.agent },
  create: {
    id: crypto.randomUUID(),
    name: "AI Agent",
    email,
    emailVerified: true,
    role: Role.agent,
  },
});

console.log(`Seeded AI agent user: ${email}`);

await prisma.$disconnect();
