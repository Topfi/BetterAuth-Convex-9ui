import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { requireMutationCtx } from "@convex-dev/better-auth/utils";
import { components } from "../_generated/api";
import { query, QueryCtx, type MutationCtx } from "../_generated/server";
import type { FunctionReference } from "convex/server";
import { betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import {
  APIError,
  type MiddlewareInputContext,
  type MiddlewareOptions,
} from "better-call";
import {
  emailOTP,
  haveIBeenPwned,
  magicLink,
  username,
} from "better-auth/plugins";
import { DataModel } from "../_generated/dataModel";
import {
  sendEmailVerification,
  sendMagicLink,
  sendOTPVerification,
  sendResetPassphrase,
} from "./authDomain/email";
import { deleteAllUserData } from "./authDomain/userData";
import {
  passphrasePolicy,
  validatePassphrase,
} from "@shared/auth/passphrasePolicy";
import { passphraseCompromisedMessage } from "@shared/auth/haveIBeenPwned";
import {
  deriveUsernameSeed,
  normalizeUsername,
  sanitizeUsernameCandidate,
  withNumericSuffix,
} from "@shared/auth/username";
import {
  resolveBetterAuthRateLimitConfig,
  resolveSensitiveActionRateLimits,
} from "@shared/rateLimit";
import {
  logAndThrow,
  recordAccountDeletionLog,
  recordAuditLog,
  type AuditLogDescriptor,
} from "../logs";
import { previewChangedFields, syncFromAuthUser } from "./authDomain/appUsers";
import type { BetterAuthUserLike } from "@shared/user/appUser";
import { requireEnv } from "../util";

const siteUrl = process.env.SITE_URL!;

const asOptionalString = (value: unknown): string | null => {
  return typeof value === "string" ? value : null;
};

const PROFILE_MUTABLE_FIELDS = [
  "displayUsername",
  "username",
  "name",
  "image",
] as const;

const extractErrorDetails = (
  error: unknown,
): {
  errorCode?: string;
  message?: string;
} => {
  if (error instanceof APIError) {
    const messageCandidate =
      typeof (error as { body?: { message?: unknown } }).body?.message ===
      "string"
        ? (error as { body?: { message?: string } }).body?.message
        : error.message;
    const statusValue = (error as { status?: unknown }).status;
    return {
      errorCode:
        typeof statusValue === "string"
          ? statusValue
          : typeof statusValue === "number"
            ? String(statusValue)
            : undefined,
      message: messageCandidate,
    };
  }

  if (error instanceof Error) {
    return {
      errorCode: error.name,
      message: error.message,
    };
  }

  return {};
};

const extractUserIdFromResponse = (value: unknown): string | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  if ("user" in value) {
    const user = (value as { user?: { id?: unknown } }).user;
    if (user && typeof user === "object" && typeof user.id === "string") {
      return user.id;
    }
  }

  if ("session" in value) {
    const session = (value as { session?: { userId?: unknown } }).session;
    if (
      session &&
      typeof session === "object" &&
      typeof (session as { userId?: unknown }).userId === "string"
    ) {
      return (session as { userId: string }).userId;
    }
  }

  return null;
};

type HeaderLike = {
  get(name: string): string | null;
};

const extractIpAddress = (
  headers: HeaderLike | undefined,
  fallback?: string | null,
) => {
  if (typeof fallback === "string" && fallback.trim().length > 0) {
    return fallback;
  }

  const headerValue =
    headers?.get("x-forwarded-for") ?? headers?.get("cf-connecting-ip");
  if (!headerValue) {
    return undefined;
  }
  const [first] = headerValue.split(",");
  return first?.trim() ?? undefined;
};

const resolveSignInMethod = (path: string): string => {
  const [, , methodRaw] = path.split("/");
  if (!methodRaw || methodRaw.length === 0) {
    return "unknown";
  }
  return methodRaw.replace(/-/g, "_");
};

const extractChangedFieldsFromBody = (body: unknown): string[] => {
  if (!body || typeof body !== "object") {
    return [];
  }

  const keys = Object.keys(body as Record<string, unknown>);
  return keys.filter((key) =>
    (PROFILE_MUTABLE_FIELDS as readonly string[]).includes(key),
  );
};

const extractNewEmailFromBody = (body: unknown): string | undefined => {
  if (
    body &&
    typeof body === "object" &&
    typeof (body as { newEmail?: unknown }).newEmail === "string"
  ) {
    return (body as { newEmail: string }).newEmail;
  }
  return undefined;
};

const passphraseEndpointSuffixes = [
  "/sign-up/email",
  "/change-password",
  "/reset-password",
  "/set-password",
] as const;

const matchesPassphraseEndpoint = (path: string): boolean => {
  return passphraseEndpointSuffixes.some((suffix) => path.endsWith(suffix));
};

const extractPassphraseCandidate = (body: unknown): string | undefined => {
  if (!body || typeof body !== "object") {
    return undefined;
  }

  const recordBody = body as Record<string, unknown>;
  const direct = recordBody.password;
  if (typeof direct === "string") {
    return direct;
  }

  const next = recordBody.newPassword;
  if (typeof next === "string") {
    return next;
  }

  return undefined;
};

const enforcePassphrasePolicy = async (
  ctx: MiddlewareInputContext<MiddlewareOptions>,
) => {
  const rawPath =
    (ctx as { path?: unknown }).path ??
    (ctx as { context?: { endpoint?: { path?: unknown } } }).context?.endpoint
      ?.path;
  const path = typeof rawPath === "string" ? rawPath : "";
  if (!matchesPassphraseEndpoint(path)) {
    return;
  }

  const candidate = extractPassphraseCandidate(
    (ctx as { body?: unknown }).body,
  );
  if (!candidate) {
    return;
  }

  const { failures } = validatePassphrase(candidate);
  if (failures.length > 0) {
    throw new APIError("BAD_REQUEST", {
      message:
        failures[0]?.message ??
        "Passphrase does not meet the required strength.",
    });
  }
};

const baseAuthComponent = createClient<DataModel>(components.betterAuth);

type TriggerAuthUser = BetterAuthUserLike;
type TriggerPayload = Record<string, unknown>;

const handleUserCreatedTrigger = async (
  ctx: MutationCtx,
  doc: TriggerAuthUser,
) => {
  await syncFromAuthUser(ctx, doc);
};

const resolveAuthUserId = (doc: TriggerAuthUser) => {
  if (typeof doc.id === "string" && doc.id.trim().length > 0) {
    return doc.id.trim();
  }
  if (typeof doc.userId === "string" && doc.userId.trim().length > 0) {
    return doc.userId.trim();
  }
  return "unknown-user";
};

const handleUserUpdatedTrigger = async (
  ctx: MutationCtx,
  oldDoc: TriggerAuthUser | null,
  newDoc: TriggerAuthUser,
) => {
  const anticipatedChanges = previewChangedFields(oldDoc ?? null, newDoc);

  await logAndThrow(ctx, () => syncFromAuthUser(ctx, newDoc), {
    onSuccess: ({ changedFields }) => {
      if (changedFields.length === 0) {
        return null;
      }
      return {
        event: "user.profile.updated",
        userId: resolveAuthUserId(newDoc),
        actorId: resolveAuthUserId(newDoc),
        details: { changedFields },
      } satisfies AuditLogDescriptor<"user.profile.updated">;
    },
    onError: (error) => {
      const { errorCode, message } = extractErrorDetails(error);
      return {
        event: "user.profile.update_failed",
        userId: resolveAuthUserId(newDoc),
        actorId: resolveAuthUserId(newDoc),
        details: {
          changedFields:
            anticipatedChanges.length > 0 ? anticipatedChanges : undefined,
          errorCode,
          message,
        },
      } satisfies AuditLogDescriptor<"user.profile.update_failed">;
    },
  });
};

export const authComponent = createClient<DataModel>(components.betterAuth, {
  authFunctions: baseAuthComponent.triggersApi() as unknown as {
    onCreate: FunctionReference<"mutation", "internal", TriggerPayload>;
    onUpdate: FunctionReference<"mutation", "internal", TriggerPayload>;
    onDelete: FunctionReference<"mutation", "internal", TriggerPayload>;
  },
  triggers: {
    user: {
      onCreate: handleUserCreatedTrigger,
      onUpdate: handleUserUpdatedTrigger,
    },
  },
});

export const createAuth = (
  ctx: GenericCtx<DataModel>,
  { optionsOnly } = { optionsOnly: false },
) => {
  const rateLimitConfig = resolveBetterAuthRateLimitConfig(process.env);
  const customRateLimits = resolveSensitiveActionRateLimits(rateLimitConfig);

  const mutationCtxForLogging = (() => {
    if (optionsOnly) {
      return null;
    }
    try {
      return requireMutationCtx(ctx);
    } catch {
      return null;
    }
  })();

  const auditMiddleware = mutationCtxForLogging
    ? createAuthMiddleware(async (middlewareCtx) => {
        const path =
          typeof (middlewareCtx as { path?: unknown }).path === "string"
            ? ((middlewareCtx as { path: string }).path ?? "")
            : "";
        if (path.length === 0) {
          return {};
        }

        const returned = (
          middlewareCtx as {
            context?: { returned?: unknown };
          }
        ).context?.returned;
        const headerCandidate = (middlewareCtx as { headers?: unknown })
          .headers;
        const headers =
          headerCandidate &&
          typeof headerCandidate === "object" &&
          headerCandidate !== null &&
          "get" in headerCandidate
            ? (headerCandidate as HeaderLike)
            : undefined;
        const sessionInfoRaw = (
          middlewareCtx as {
            context?: { session?: unknown };
          }
        ).context?.session;
        const sessionInfo = (sessionInfoRaw ?? {}) as {
          session?: { ipAddress?: string | null; userId?: string };
          user?: { id?: string };
        };
        const body = (middlewareCtx as { body?: unknown }).body;
        const ipAddress = extractIpAddress(
          headers,
          sessionInfo.session?.ipAddress ?? null,
        );
        const isError = returned instanceof APIError;
        const baseUserId =
          extractUserIdFromResponse(returned) ??
          sessionInfo.user?.id ??
          sessionInfo.session?.userId ??
          "unknown";

        if (path.startsWith("/sign-in")) {
          const method = resolveSignInMethod(path);
          if (isError) {
            const { errorCode, message } = extractErrorDetails(returned);
            await recordAuditLog(mutationCtxForLogging, {
              event: "auth.sign_in.failure",
              userId: baseUserId,
              actorId: baseUserId,
              ipAddress,
              details: {
                method,
                errorCode,
                message,
              },
            });
          } else {
            await recordAuditLog(mutationCtxForLogging, {
              event: "auth.sign_in.success",
              userId: baseUserId,
              actorId: baseUserId,
              ipAddress,
              details: {
                method,
              },
            });
          }
        } else if (path === "/change-password") {
          const method = "self-service";
          if (isError) {
            const { errorCode, message } = extractErrorDetails(returned);
            await recordAuditLog(mutationCtxForLogging, {
              event: "auth.passphrase.failed",
              userId: baseUserId,
              actorId: baseUserId,
              ipAddress,
              details: {
                method,
                errorCode,
                message,
              },
            });
          } else {
            await recordAuditLog(mutationCtxForLogging, {
              event: "auth.passphrase.changed",
              userId: baseUserId,
              actorId: baseUserId,
              ipAddress,
              details: {
                method,
              },
            });
          }
        } else if (path === "/change-email") {
          const newEmail = extractNewEmailFromBody(body);
          if (newEmail) {
            if (isError) {
              const { errorCode, message } = extractErrorDetails(returned);
              await recordAuditLog(mutationCtxForLogging, {
                event: "auth.email.change.failed",
                userId: baseUserId,
                actorId: baseUserId,
                ipAddress,
                details: {
                  newEmail: newEmail.toLowerCase(),
                  errorCode,
                  message,
                },
              });
            } else {
              await recordAuditLog(mutationCtxForLogging, {
                event: "auth.email.change.requested",
                userId: baseUserId,
                actorId: baseUserId,
                ipAddress,
                details: {
                  newEmail: newEmail.toLowerCase(),
                },
              });
            }
          }
        } else if (path === "/update-user" && isError) {
          const { errorCode, message } = extractErrorDetails(returned);
          const changedFields = extractChangedFieldsFromBody(body);
          await recordAuditLog(mutationCtxForLogging, {
            event: "user.profile.update_failed",
            userId: baseUserId,
            actorId: baseUserId,
            ipAddress,
            details: {
              changedFields:
                changedFields.length > 0 ? changedFields : undefined,
              errorCode,
              message,
            },
          });
        }

        return {};
      })
    : null;

  const auditPlugin = auditMiddleware
    ? {
        id: "convex-audit",
        hooks: {
          after: [
            {
              matcher: () => true,
              handler: auditMiddleware,
            },
          ],
        },
      }
    : null;

  const resolveRequiredEnv = (name: string) => {
    const existing = process.env[name];
    if (existing && existing.length > 0) {
      return existing;
    }
    if (optionsOnly) {
      return `placeholder-${name.toLowerCase().replace(/[^a-z0-9]/gi, "-")}`;
    }
    return requireEnv(name);
  };

  const ensureUsernameOnCreate: NonNullable<
    NonNullable<
      NonNullable<Parameters<typeof betterAuth>[0]["databaseHooks"]>["user"]
    >["create"]
  >["before"] = async (user, context) => {
    const adapter = context?.context.adapter;
    if (!adapter) {
      return { data: user };
    }

    const rawDisplayUsername = asOptionalString(user.displayUsername);
    const rawUsername = asOptionalString(user.username);
    const rawEmail = asOptionalString(user.email);
    const rawName = asOptionalString(user.name);

    const incomingDisplay = rawDisplayUsername
      ? sanitizeUsernameCandidate(rawDisplayUsername)
      : undefined;

    let displayUsername = incomingDisplay;
    let username = rawUsername ? normalizeUsername(rawUsername) : undefined;

    if (!displayUsername && username) {
      displayUsername = sanitizeUsernameCandidate(username);
    }

    if (!username) {
      const seed = deriveUsernameSeed({
        username: rawUsername,
        displayUsername: rawDisplayUsername,
        email: rawEmail,
        name: rawName,
      });

      let candidateDisplay = displayUsername ?? seed;
      let candidateUsername = normalizeUsername(candidateDisplay);
      const MAX_ATTEMPTS = 100;

      for (let attempt = 0; attempt <= MAX_ATTEMPTS; attempt += 1) {
        const existing = await adapter.findOne({
          model: "user",
          where: [
            {
              field: "username",
              value: candidateUsername,
            },
          ],
        });

        if (!existing) {
          username = candidateUsername;
          displayUsername = candidateDisplay;
          break;
        }

        const next = withNumericSuffix(seed, attempt + 1);
        candidateDisplay = next;
        candidateUsername = normalizeUsername(candidateDisplay);
      }

      if (!username || !displayUsername) {
        const fallback = `${normalizeUsername(seed).slice(0, 20)}${Date.now().toString(36).slice(-6)}`;
        username = normalizeUsername(fallback);
        displayUsername = sanitizeUsernameCandidate(fallback);
      }
    }

    const currentName = rawName ? rawName.trim() : "";
    const resolvedName =
      currentName.length > 0 ? currentName : (displayUsername ?? username);
    const finalUsername = username ?? sanitizeUsernameCandidate("user");
    const finalDisplayUsername = displayUsername ?? finalUsername;
    const finalName = (resolvedName ?? finalDisplayUsername).trim();

    return {
      data: {
        ...user,
        username: finalUsername,
        displayUsername: finalDisplayUsername,
        name: finalName,
      },
    };
  };

  const ensureUsernameOnUpdate: NonNullable<
    NonNullable<
      NonNullable<Parameters<typeof betterAuth>[0]["databaseHooks"]>["user"]
    >["update"]
  >["before"] = async (user) => {
    const updated = { ...user };
    const mutable = updated as {
      username?: string | null;
      displayUsername?: string | null;
      name?: string | null;
    };

    if (typeof mutable.displayUsername === "string") {
      const sanitizedDisplay = sanitizeUsernameCandidate(
        mutable.displayUsername,
      );
      mutable.displayUsername = sanitizedDisplay;
      if (!mutable.username) {
        mutable.username = normalizeUsername(sanitizedDisplay);
      }
      if (!mutable.name) {
        mutable.name = sanitizedDisplay;
      }
    }

    if (typeof mutable.username === "string") {
      mutable.username = normalizeUsername(mutable.username);
      if (!mutable.displayUsername) {
        mutable.displayUsername = sanitizeUsernameCandidate(mutable.username);
      }
    }

    if (typeof mutable.name === "string") {
      const display = mutable.displayUsername;
      if (!display || display.length === 0) {
        mutable.name = sanitizeUsernameCandidate(mutable.name);
      }
    }

    return {
      data: {
        ...updated,
        username: mutable.username ?? undefined,
        displayUsername: mutable.displayUsername ?? undefined,
        name: mutable.name ?? undefined,
      },
    };
  };

  return betterAuth({
    trustedOrigins: [siteUrl, "https://appleid.apple.com"],
    logger: {
      disabled: optionsOnly,
    },
    database: authComponent.adapter(ctx),
    databaseHooks: {
      user: {
        create: {
          before: ensureUsernameOnCreate,
        },
        update: {
          before: ensureUsernameOnUpdate,
        },
      },
    },
    emailVerification: {
      sendVerificationEmail: async ({ user, url }) => {
        await sendEmailVerification(requireMutationCtx(ctx), {
          to: user.email,
          url,
        });
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: passphrasePolicy.minLength,
      sendResetPassword: async ({ user, url }) => {
        await sendResetPassphrase(requireMutationCtx(ctx), {
          to: user.email,
          url,
        });
      },
    },
    socialProviders: {
      github: {
        clientId: resolveRequiredEnv("GITHUB_CLIENT_ID"),
        clientSecret: resolveRequiredEnv("GITHUB_CLIENT_SECRET"),
      },
      google: {
        clientId: resolveRequiredEnv("GOOGLE_CLIENT_ID"),
        clientSecret: resolveRequiredEnv("GOOGLE_CLIENT_SECRET"),
      },
      apple: {
        clientId: resolveRequiredEnv("APPLE_CLIENT_ID"),
        clientSecret: resolveRequiredEnv("APPLE_CLIENT_SECRET"),
        ...(process.env.APPLE_APP_BUNDLE_IDENTIFIER
          ? { appBundleIdentifier: process.env.APPLE_APP_BUNDLE_IDENTIFIER }
          : {}),
      },
    },
    user: {
      deleteUser: {
        enabled: true,
        afterDelete: async (user) => {
          const mutationCtx = requireMutationCtx(ctx);
          const deletionDetails = await deleteAllUserData(mutationCtx, user.id);

          await recordAccountDeletionLog(mutationCtx, {
            userId: user.id,
            actorId: user.id,
            deletionDetails,
          });
        },
      },
    },
    plugins: [
      haveIBeenPwned({
        customPasswordCompromisedMessage: passphraseCompromisedMessage,
      }),
      username({
        usernameNormalization: normalizeUsername,
      }),
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          await sendMagicLink(requireMutationCtx(ctx), {
            to: email,
            url,
          });
        },
      }),
      emailOTP({
        async sendVerificationOTP({ email, otp }) {
          await sendOTPVerification(requireMutationCtx(ctx), {
            to: email,
            code: otp,
          });
        },
      }),
      crossDomain({ siteUrl }),
      convex(),
      ...(auditPlugin ? [auditPlugin] : []),
    ],
    hooks: {
      before: enforcePassphrasePolicy,
    },
    account: {
      accountLinking: {
        enabled: true,
      },
    },
    rateLimit: {
      enabled: rateLimitConfig.enabled,
      window: rateLimitConfig.windowSeconds,
      max: rateLimitConfig.maxRequests,
      storage: "database",
      modelName: "rateLimit",
      customRules: customRateLimits,
    },
  });
};

// Below are example helpers and functions for getting the current user
// Feel free to edit, omit, etc.
export const safeGetUser = async (ctx: QueryCtx) => {
  return authComponent.safeGetAuthUser(ctx);
};

export const getUserId = async (ctx: QueryCtx) => {
  const identity = await ctx.auth.getUserIdentity();
  return identity?.subject;
};

export const getUser = async (ctx: QueryCtx) => {
  return authComponent.getAuthUser(ctx);
};

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    console.log("identity", await ctx.auth.getUserIdentity());
    return safeGetUser(ctx);
  },
});
