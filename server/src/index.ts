import "./env.ts";
import "./lib/sentry.ts";
import path from "node:path";
import cors from "cors";
import express from "express";
import multer from "multer";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.ts";
import { Sentry } from "./lib/sentry.ts";
import { registerTicketClassificationWorker } from "./lib/classifyTicket.ts";
import { registerTicketResolutionWorker } from "./lib/resolveTicket.ts";
import { boss } from "./lib/queue.ts";
import { usersRouter } from "./routes/users.ts";
import { ticketsRouter } from "./routes/tickets.ts";

const app = express();
const port = process.env.PORT || 3001;

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.all("/api/auth/*splat", toNodeHandler(auth));
app.use(express.json());

app.use("/api/users", usersRouter);
app.use("/api/tickets", ticketsRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

const clientDistPath = path.join(import.meta.dir, "../../client/dist");
app.use(express.static(clientDistPath));
app.get("/*splat", (req, res, next) => {
  if (req.path.startsWith("/api")) {
    next();
    return;
  }
  res.sendFile(path.join(clientDistPath, "index.html"));
});

// Centralized error handler: logs the real error server-side, but never leaks
// stack traces/internals to the client. Must be registered last, after every
// route (Express only treats a 4-arg function as an error handler).
app.use((error: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(`Unhandled error on ${req.method} ${req.path}:`, error);
  Sentry.captureException(error);

  if (res.headersSent) {
    return;
  }

  if (error instanceof multer.MulterError) {
    res.status(400).json({ error: "Malformed upload" });
    return;
  }

  res.status(500).json({ error: "Internal server error" });
});

await boss.start();
await registerTicketClassificationWorker();
await registerTicketResolutionWorker();

app.listen(port, () => {
  console.log(`Server listening on port ${port}...`);
});
