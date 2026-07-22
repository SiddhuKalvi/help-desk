import { APIError, betterAuth, type BetterAuthOptions } from "better-auth";
import { customSession } from "better-auth/plugins";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma.ts";
import { Role } from "../generated/prisma/client.ts";

const options = {
  trustedOrigins: [process.env.CLIENT_URL as string],
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        input: false,
        defaultValue: Role.agent,
      },
      deletedAt: {
        type: "date",
        required: false,
        input: false,
      },
    },
  },
  rateLimit: {
    window: 60,
    max: 60,
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
    },
  },
  // Soft-deleted users can't have a new session created for them (blocks
  // sign-in). Their existing sessions are separately revoked at delete time
  // (see DELETE /api/users/:id), so this only needs to guard new sign-ins.
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { deletedAt: true },
          });
          if (user?.deletedAt) {
            throw new APIError("FORBIDDEN", {
              message: "This account has been deleted.",
              code: "USER_DELETED",
            });
          }
        },
      },
    },
  },
} satisfies BetterAuthOptions;

export const auth = betterAuth({
  ...options,
  plugins: [
    // The default get-session response includes the raw session token in the
    // JSON body (in addition to the httpOnly cookie), which would let an XSS
    // payload or any client-side logging of session state exfiltrate a valid
    // session token. Return a trimmed session shape without it.
    customSession(
      async ({ user, session }) => ({
        user,
        session: {
          id: session.id,
          userId: session.userId,
          expiresAt: session.expiresAt,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
        },
      }),
      options,
    ),
  ],
});
