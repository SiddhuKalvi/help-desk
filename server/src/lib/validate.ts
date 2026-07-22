import type { Request, Response } from "express";
import type { z } from "zod";

export function validateBody<T>(schema: z.ZodType<T>, req: Request, res: Response): T | undefined {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return undefined;
  }
  return parsed.data;
}

export function validateQuery<T>(schema: z.ZodType<T>, req: Request, res: Response): T | undefined {
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return undefined;
  }
  return parsed.data;
}

export function validateParams<T>(schema: z.ZodType<T>, req: Request, res: Response): T | undefined {
  const parsed = schema.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return undefined;
  }
  return parsed.data;
}
