const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");
const fs = require("fs");

const config = getDefaultConfig(__dirname);

// ─── CI / Docker detection ────────────────────────────────────────────────────
// In Docker (deploy), pnpm installs with --shamefully-hoist, so node_modules
// is flat and symlinks may point to a store path that doesn't exist in the image.
// Disable symlink traversal in CI/production to prevent Metro from following
// broken symlinks and crashing with DependencyGraph.getOrComputeSha1.
const isCI = process.env.CI === "true" || process.env.NODE_ENV === "production";

// ─── watchFolders ─────────────────────────────────────────────────────────────
// Do NOT add node_modules to watchFolders — Metro resolves it automatically.
// Adding it explicitly causes Metro to traverse the entire node_modules tree
// (including pnpm symlinks) and crash in Docker when symlinks are broken.
const watchFolders = [path.resolve(__dirname)];

// Only add .pnpm-store locally (not in Docker where it may not exist)
if (!isCI) {
  const pnpmStore = path.resolve(__dirname, ".pnpm-store");
  if (fs.existsSync(pnpmStore)) {
    watchFolders.push(pnpmStore);
  }
}

config.watchFolders = watchFolders;

// ─── Resolver ─────────────────────────────────────────────────────────────────
// Block server-side, scripts, and non-app files from being bundled by Metro.
// These files are Node.js only and must not be included in the mobile bundle.
config.resolver = {
  ...config.resolver,
  // Disable symlink traversal in CI/Docker to avoid broken symlink crashes
  unstable_enableSymlinks: !isCI,
  blockList: [
    // Block all files in scripts/ directory (Node.js utility scripts)
    new RegExp(path.resolve(__dirname, "scripts").replace(/\\/g, "\\\\") + "/.*"),
    // Block server directory (backend code, not for mobile bundle)
    new RegExp(path.resolve(__dirname, "server").replace(/\\/g, "\\\\") + "/.*"),
    // Block drizzle migrations and config
    new RegExp(path.resolve(__dirname, "drizzle").replace(/\\/g, "\\\\") + "/.*"),
    // Block dist output
    new RegExp(path.resolve(__dirname, "dist").replace(/\\/g, "\\\\") + "/.*"),
    // Block pnpm store (content-addressable store, not app code)
    new RegExp(path.resolve(__dirname, ".pnpm-store").replace(/\\/g, "\\\\") + "/.*"),
    // Block test files at root level
    /\/test[^/]*\.(mjs|js|ts)$/,
  ],
};

module.exports = withNativeWind(config, {
  input: "./global.css",
  // Force write CSS to file system instead of virtual modules
  // This fixes iOS styling issues in development mode
  forceWriteFileSystem: true,
});
