#!/usr/bin/env node
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const clientFeaturesDir = resolve(root, "src/features");
const serverFeaturesDir = resolve(root, "convex/features");

const readDirectory = async (directory) => {
  return readdir(directory, { withFileTypes: true }).catch((error) => {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  });
};

const readClientFeatures = async () => {
  const entries = await readDirectory(clientFeaturesDir);
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
};

const readServerFeatures = async () => {
  const entries = await readDirectory(serverFeaturesDir);
  return entries
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
    .map((entry) => entry.name.replace(/\.tsx?$/, ""))
    .sort();
};

const clientOnlyDomains = new Set(["app", "settings"]);
const serverOnlyDomains = new Set([]);

const [clientFeatures, serverFeatures] = await Promise.all([
  readClientFeatures(),
  readServerFeatures(),
]);

const serverFeatureSet = new Set(serverFeatures);
const clientFeatureSet = new Set(clientFeatures);

const missingOnServer = clientFeatures.filter(
  (feature) =>
    !clientOnlyDomains.has(feature) && !serverFeatureSet.has(feature),
);
const missingOnClient = serverFeatures.filter(
  (feature) =>
    !serverOnlyDomains.has(feature) && !clientFeatureSet.has(feature),
);

if (missingOnServer.length === 0 && missingOnClient.length === 0) {
  process.exit(0);
}

const lines = [];
if (missingOnServer.length > 0) {
  lines.push(
    `Client feature folders missing Convex counterparts: ${missingOnServer.join(
      ", ",
    )}`,
  );
}
if (missingOnClient.length > 0) {
  lines.push(
    `Convex feature folders missing client counterparts: ${missingOnClient.join(
      ", ",
    )}`,
  );
}

console.error(lines.join("\n"));
process.exit(1);
