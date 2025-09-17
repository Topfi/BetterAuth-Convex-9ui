#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const envExamplePath = path.join(projectRoot, ".env.example");
const envLocalPath = path.join(projectRoot, ".env.local");

const argSet = new Set(process.argv.slice(2));
const options = {
  dryRun: argSet.has("--dry-run"),
  skipConvex: argSet.has("--skip-convex"),
};

const prefix = "[setup-env]";
const log = (message) => {
  console.log(`${prefix} ${message}`);
};
const warn = (message) => {
  console.warn(`${prefix} ${message}`);
};
const error = (message) => {
  console.error(`${prefix} ${message}`);
};

const normalizeNewlines = (content) => {
  return content.replace(/\r\n/g, "\n");
};

const ensureTrailingNewline = (content) => {
  return content.endsWith("\n") ? content : `${content}\n`;
};

const normalizeContent = (content) => {
  return ensureTrailingNewline(normalizeNewlines(content));
};

const parseEnvStructure = (content) => {
  const normalized = normalizeNewlines(content);
  const lines = normalized.split("\n");
  return lines.map((line) => {
    if (line.trim().length === 0) {
      return { type: "blank" };
    }
    if (line.trim().startsWith("#")) {
      return { type: "comment", value: line };
    }
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      return { type: "comment", value: line };
    }
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1);
    return { type: "entry", key, value };
  });
};

const mapFromStructure = (structure) => {
  const map = new Map();
  for (const part of structure) {
    if (part.type === "entry" && part.key.length > 0) {
      map.set(part.key, part.value ?? "");
    }
  }
  return map;
};

const buildEnvFile = ({ baseStructure, overrides, extras }) => {
  const lines = [];
  for (const part of baseStructure) {
    if (part.type === "entry") {
      const override = overrides.get(part.key);
      const value = override ?? part.value ?? "";
      lines.push(`${part.key}=${value}`);
      continue;
    }
    if (part.type === "comment") {
      lines.push(part.value);
      continue;
    }
    lines.push("");
  }

  if (extras.length > 0) {
    if (lines.length > 0 && lines[lines.length - 1] !== "") {
      lines.push("");
    }
    for (const extra of extras) {
      lines.push(`${extra.key}=${extra.value ?? ""}`);
    }
  }

  return ensureTrailingNewline(lines.join("\n"));
};

const readFileIfExists = async (filePath) => {
  try {
    return await readFile(filePath, "utf8");
  } catch (readError) {
    if (readError && readError.code === "ENOENT") {
      return null;
    }
    throw readError;
  }
};

const isNonEmpty = (value) => {
  return typeof value === "string" && value.trim().length > 0;
};

const ensureLocalEnv = async () => {
  const exampleContent = await readFile(envExamplePath, "utf8");
  const exampleStructure = parseEnvStructure(exampleContent);
  const exampleMap = mapFromStructure(exampleStructure);

  const existingContent = await readFileIfExists(envLocalPath);
  const existingStructure = existingContent
    ? parseEnvStructure(existingContent)
    : [];
  const existingMap = mapFromStructure(existingStructure);

  const missingKeys = [];
  for (const part of exampleStructure) {
    if (part.type !== "entry") {
      continue;
    }
    if (!existingMap.has(part.key)) {
      missingKeys.push(part.key);
    }
  }

  const extras = existingStructure
    .filter((part) => part.type === "entry" && !exampleMap.has(part.key))
    .map((part) => ({ key: part.key, value: part.value ?? "" }));

  const normalizedExisting = existingContent
    ? normalizeContent(existingContent)
    : null;
  const nextContent = buildEnvFile({
    baseStructure: exampleStructure,
    overrides: existingMap,
    extras,
  });

  const needsWrite =
    normalizedExisting === null || normalizedExisting !== nextContent;
  if (needsWrite && !options.dryRun) {
    await writeFile(envLocalPath, nextContent, "utf8");
  }

  const activeMap = mapFromStructure(parseEnvStructure(nextContent));

  return {
    created: existingContent === null,
    updated: needsWrite && !options.dryRun,
    missingKeys,
    localEnvMap: activeMap,
    preservedExtras: extras.map((extra) => extra.key),
    needsWrite,
  };
};

const runCommand = (command, args) => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (spawnError) => {
      reject(spawnError);
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      const failure = new Error(`Command failed: ${command} ${args.join(" ")}`);
      failure.code = code;
      failure.stdout = stdout;
      failure.stderr = stderr;
      reject(failure);
    });
  });
};

const readConvexEnv = async () => {
  const { stdout, stderr } = await runCommand("npx", [
    "--yes",
    "convex",
    "env",
    "list",
  ]);

  if (stderr.trim().length > 0) {
    log(stderr.trim());
  }

  const map = new Map();
  const lines = normalizeNewlines(stdout).split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1);
    if (key.length === 0) {
      continue;
    }
    map.set(key, value);
  }

  return map;
};

const setConvexEnv = async (key, value) => {
  const args = ["--yes", "convex", "env", "set", key, value];
  const { stderr } = await runCommand("npx", args);
  if (stderr.trim().length > 0) {
    log(stderr.trim());
  }
};

const pickFirstNonEmpty = (map, keys) => {
  for (const key of keys) {
    const value = map.get(key);
    if (isNonEmpty(value)) {
      return value.trim();
    }
  }
  return undefined;
};

const sanitizeEnvValue = (value) => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === "string") {
    return value.trim();
  }
  return String(value).trim();
};

const generateBetterAuthSecret = () => {
  // 48 bytes yield a 64 character base64 secret.
  return randomBytes(48).toString("base64");
};

const CONVEX_ENV_TARGETS = [
  {
    key: "SITE_URL",
    description: "Server-facing site URL surfaced in emails and callbacks.",
    required: true,
    getDesiredValue: ({ localEnv }) => {
      return pickFirstNonEmpty(localEnv, ["SITE_URL", "VITE_SITE_URL"]);
    },
  },
  {
    key: "BETTER_AUTH_SECRET",
    description: "Better Auth session signing secret.",
    required: true,
    sensitive: true,
    getDesiredValue: ({ currentValue }) => {
      if (isNonEmpty(currentValue)) {
        return undefined;
      }
      return generateBetterAuthSecret();
    },
  },
  {
    key: "BETTERAUTH_EMAIL_CONSOLE_PREVIEW",
    description: "Preview emails in the console instead of sending.",
    getDesiredValue: ({ localEnv }) => {
      return pickFirstNonEmpty(localEnv, ["BETTERAUTH_EMAIL_CONSOLE_PREVIEW"]);
    },
  },
  {
    key: "BETTERAUTH_RATE_LIMIT_ENABLED",
    description: "Toggle Better Auth's rate limiter.",
    getDesiredValue: ({ localEnv }) => {
      return pickFirstNonEmpty(localEnv, ["BETTERAUTH_RATE_LIMIT_ENABLED"]);
    },
  },
  {
    key: "BETTERAUTH_RATE_LIMIT_WINDOW_SECONDS",
    description: "Rate limiter window length in seconds.",
    getDesiredValue: ({ localEnv }) => {
      return pickFirstNonEmpty(localEnv, [
        "BETTERAUTH_RATE_LIMIT_WINDOW_SECONDS",
      ]);
    },
  },
  {
    key: "BETTERAUTH_RATE_LIMIT_MAX_REQUESTS",
    description: "Rate limiter max requests per window.",
    getDesiredValue: ({ localEnv }) => {
      return pickFirstNonEmpty(localEnv, [
        "BETTERAUTH_RATE_LIMIT_MAX_REQUESTS",
      ]);
    },
  },
  {
    key: "GITHUB_CLIENT_ID",
    description: "GitHub OAuth client identifier.",
    getDesiredValue: ({ localEnv }) => {
      return pickFirstNonEmpty(localEnv, ["GITHUB_CLIENT_ID"]);
    },
  },
  {
    key: "GITHUB_CLIENT_SECRET",
    description: "GitHub OAuth client secret.",
    sensitive: true,
    getDesiredValue: ({ localEnv }) => {
      return pickFirstNonEmpty(localEnv, ["GITHUB_CLIENT_SECRET"]);
    },
  },
  {
    key: "GOOGLE_CLIENT_ID",
    description: "Google OAuth client identifier.",
    getDesiredValue: ({ localEnv }) => {
      return pickFirstNonEmpty(localEnv, ["GOOGLE_CLIENT_ID"]);
    },
  },
  {
    key: "GOOGLE_CLIENT_SECRET",
    description: "Google OAuth client secret.",
    sensitive: true,
    getDesiredValue: ({ localEnv }) => {
      return pickFirstNonEmpty(localEnv, ["GOOGLE_CLIENT_SECRET"]);
    },
  },
  {
    key: "RESEND_API_KEY",
    description: "Resend API key for transactional email delivery.",
    sensitive: true,
    getDesiredValue: ({ localEnv }) => {
      return pickFirstNonEmpty(localEnv, ["RESEND_API_KEY"]);
    },
  },
];

const syncConvexEnv = async ({ localEnvMap }) => {
  if (options.skipConvex) {
    log("Skipping Convex environment sync (--skip-convex).");
    return {
      skipped: true,
      actions: [],
      missingRequired: [],
    };
  }

  const deployment = pickFirstNonEmpty(localEnvMap, ["CONVEX_DEPLOYMENT"]);
  if (!isNonEmpty(deployment)) {
    warn("CONVEX_DEPLOYMENT is not set. Skipping Convex environment sync.");
    return {
      skipped: true,
      actions: [],
      missingRequired: ["CONVEX_DEPLOYMENT"],
    };
  }

  let convexEnvMap;
  try {
    convexEnvMap = await readConvexEnv();
  } catch (convexError) {
    warn(`Unable to read Convex environment variables: ${convexError.message}`);
    return {
      skipped: true,
      actions: [],
      missingRequired: ["convex env list"],
    };
  }

  const actions = [];
  const missingRequired = [];

  for (const target of CONVEX_ENV_TARGETS) {
    const currentValue = convexEnvMap.get(target.key);
    const desired = target.getDesiredValue({
      localEnv: localEnvMap,
      currentValue,
      convexEnv: convexEnvMap,
    });

    if (desired === undefined) {
      if (!isNonEmpty(currentValue) && target.required) {
        missingRequired.push(target.key);
        warn(
          `Convex env ${target.key} is missing and no value could be resolved.`,
        );
      }
      continue;
    }

    const sanitized = sanitizeEnvValue(desired);
    if (!isNonEmpty(sanitized)) {
      if (target.required) {
        missingRequired.push(target.key);
        warn(`Convex env ${target.key} resolved to an empty value.`);
      }
      continue;
    }

    if (isNonEmpty(currentValue) && currentValue.trim() === sanitized) {
      continue;
    }

    actions.push({
      key: target.key,
      value: sanitized,
      sensitive: Boolean(target.sensitive),
      description: target.description,
      type: isNonEmpty(currentValue) ? "update" : "create",
    });
  }

  for (const action of actions) {
    if (options.dryRun) {
      log(`Dry run: would ${action.type} Convex env ${action.key}.`);
      continue;
    }
    try {
      await setConvexEnv(action.key, action.value);
      log(
        `${
          action.type === "create" ? "Set" : "Updated"
        } Convex env ${action.key}.`,
      );
    } catch (setError) {
      missingRequired.push(action.key);
      warn(`Failed to set Convex env ${action.key}: ${setError.message}`);
    }
  }

  return {
    skipped: false,
    actions,
    missingRequired,
  };
};

const reportLocalResult = (result) => {
  if (result.created) {
    log(
      options.dryRun
        ? ".env.local would be created from .env.example."
        : ".env.local created from .env.example.",
    );
  } else if (result.updated) {
    log(".env.local updated to match .env.example.");
  } else if (options.dryRun && result.needsWrite) {
    log(".env.local would be updated to match .env.example.");
  } else {
    log(".env.local already matches .env.example.");
  }

  if (result.missingKeys.length > 0) {
    log(
      `${
        options.dryRun && result.needsWrite ? "Would apply" : "Applied"
      } keys from template: ${result.missingKeys.join(", ")}.`,
    );
  }
  if (result.preservedExtras.length > 0) {
    log(
      `${
        options.dryRun ? "Would preserve" : "Preserved"
      } custom keys: ${result.preservedExtras.join(", ")}.`,
    );
  }
};

const main = async () => {
  const localResult = await ensureLocalEnv();
  reportLocalResult(localResult);

  const convexResult = await syncConvexEnv({
    localEnvMap: localResult.localEnvMap,
  });

  if (!convexResult.skipped) {
    if (convexResult.actions.length === 0) {
      log("Convex environment already in sync.");
    }
  }

  const missingRequired = [...new Set(convexResult.missingRequired)];
  const blockingMissing = missingRequired.filter(
    (key) => key !== "CONVEX_DEPLOYMENT",
  );

  if (blockingMissing.length > 0) {
    error(`Missing required Convex values: ${blockingMissing.join(", ")}.`);
    process.exitCode = 1;
  }
};

main().catch((unhandledError) => {
  error(unhandledError.stack ?? unhandledError.message);
  process.exitCode = 1;
});
