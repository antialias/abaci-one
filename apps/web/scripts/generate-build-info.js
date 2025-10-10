#!/usr/bin/env node

/**
 * Generate build information for deployment tracking
 * This script captures git commit, branch, timestamp, and other metadata
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function exec(command) {
  try {
    return execSync(command, { encoding: "utf-8" }).trim();
  } catch (_error) {
    return null;
  }
}

function getBuildInfo() {
  const gitCommit = exec("git rev-parse HEAD");
  const gitCommitShort = exec("git rev-parse --short HEAD");
  const gitBranch = exec("git rev-parse --abbrev-ref HEAD");
  const gitTag = exec("git describe --tags --exact-match 2>/dev/null");
  const gitDirty = exec('git diff --quiet || echo "dirty"') === "dirty";

  const packageJson = require("../package.json");

  return {
    version: packageJson.version,
    buildTime: new Date().toISOString(),
    buildTimestamp: Date.now(),
    git: {
      commit: gitCommit,
      commitShort: gitCommitShort,
      branch: gitBranch,
      tag: gitTag,
      isDirty: gitDirty,
    },
    environment: process.env.NODE_ENV || "development",
    buildNumber: process.env.BUILD_NUMBER || null,
    nodeVersion: process.version,
  };
}

const buildInfo = getBuildInfo();
const outputPath = path.join(
  __dirname,
  "..",
  "src",
  "generated",
  "build-info.json",
);

// Ensure directory exists
const dir = path.dirname(outputPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

fs.writeFileSync(outputPath, JSON.stringify(buildInfo, null, 2));

console.log("✅ Build info generated:", outputPath);
console.log(JSON.stringify(buildInfo, null, 2));
