#!/usr/bin/env node

import os from "node:os";

if (os.cpus().length === 0) {
  const fallbackCpu = {
    model: "virtual",
    speed: 0,
    times: { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 },
  };
  Object.defineProperty(os, "cpus", {
    configurable: true,
    value: () => [fallbackCpu],
  });
}

try {
  const cliUrl = new URL(
    "../node_modules/secretlint/bin/secretlint.js",
    import.meta.url,
  );
  await import(cliUrl.href);
} catch (error) {
  console.error(error);
  process.exit(2);
}
