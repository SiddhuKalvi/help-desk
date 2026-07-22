const requiredEnvVars = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "CLIENT_URL",
  "INBOUND_EMAIL_WEBHOOK_SECRET",
  "OPENROUTER_API_KEY",
] as const;

const missingEnvVars = requiredEnvVars.filter((name) => !process.env[name]);

if (missingEnvVars.length > 0) {
  throw new Error(`Missing required environment variable(s): ${missingEnvVars.join(", ")}`);
}
