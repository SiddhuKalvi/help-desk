import { Router } from "express";
import { createUserSchema, updateUserSchema } from "core";
import { hashPassword } from "better-auth/crypto";
import { requireAdmin } from "../middleware/requireAdmin.ts";
import { requireAuth } from "../middleware/requireAuth.ts";
import { AI_AGENT_EMAIL } from "../lib/aiAgent.ts";
import { prisma } from "../lib/prisma.ts";
import { validateBody } from "../lib/validate.ts";
import { Prisma, Role } from "../generated/prisma/client.ts";

export const usersRouter = Router();

usersRouter.get("/", requireAdmin, async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { deletedAt: null, email: { not: AI_AGENT_EMAIL } },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  res.json({ users });
});

usersRouter.get("/agents", requireAuth, async (_req, res) => {
  const agents = await prisma.user.findMany({
    where: { role: Role.agent, deletedAt: null, email: { not: AI_AGENT_EMAIL } },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
  res.json({ agents });
});

usersRouter.post("/", requireAdmin, async (req, res) => {
  const body = validateBody(createUserSchema, req, res);
  if (!body) return;

  const { name, email, password } = body;

  try {
    const userId = crypto.randomUUID();
    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        id: userId,
        name,
        email,
        emailVerified: true,
        role: Role.agent,
        accounts: {
          create: {
            id: crypto.randomUUID(),
            providerId: "credential",
            accountId: userId,
            password: hashedPassword,
          },
        },
      },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    res.status(201).json(user);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      res.status(409).json({ error: "A user with this email already exists." });
      return;
    }
    throw error;
  }
});

usersRouter.patch("/:id", requireAdmin, async (req, res) => {
  const body = validateBody(updateUserSchema, req, res);
  if (!body) return;

  const { name, email, password } = body;
  const userId = req.params.id as string;

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { deletedAt: true },
  });
  if (!existing || existing.deletedAt) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  try {
    const user = await prisma.$transaction(async (tx) => {
      if (password) {
        const hashedPassword = await hashPassword(password);
        await tx.account.updateMany({
          where: { userId, providerId: "credential" },
          data: { password: hashedPassword },
        });
      }
      return tx.user.update({
        where: { id: userId },
        data: { name, email },
        select: { id: true, name: true, email: true, role: true, createdAt: true },
      });
    });

    res.json(user);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        res.status(409).json({ error: "A user with this email already exists." });
        return;
      }
      if (error.code === "P2025") {
        res.status(404).json({ error: "User not found." });
        return;
      }
    }
    throw error;
  }
});

usersRouter.delete("/:id", requireAdmin, async (req, res) => {
  const userId = req.params.id as string;

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, deletedAt: true, email: true },
  });

  if (!target || target.deletedAt) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  if (target.role === Role.admin) {
    res.status(403).json({ error: "Admin users cannot be deleted." });
    return;
  }
  if (target.email === AI_AGENT_EMAIL) {
    res.status(403).json({ error: "The AI agent account cannot be deleted." });
    return;
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { deletedAt: new Date() } }),
    prisma.session.deleteMany({ where: { userId } }),
    prisma.ticket.updateMany({ where: { assigneeId: userId }, data: { assigneeId: null } }),
  ]);

  res.status(204).send();
});
