import { PgBoss } from "pg-boss";
import { Sentry } from "./sentry.ts";

export const boss = new PgBoss(process.env.DATABASE_URL as string);

boss.on("error", (error: Error) => {
  console.error("pg-boss error:", error);
  Sentry.captureException(error);
});
