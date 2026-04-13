const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

// ─── Resolver ─────────────────────────────────────────────────────────────────
// Block server-side, scripts, and non-app files from being bundled by Metro.
// These files are Node.js only and must not be included in the mobile bundle.
// NOTE: Do NOT add node_modules or .pnpm-store to watchFolders — this causes
// Metro to traverse pnpm symlinks and crash in Docker (getOrComputeSha1 error).
config.resolver = {
  ...config.resolver,
  // Do not follow symlinks — avoids crashes in Docker where pnpm symlinks
  // may point to store paths that don't exist in the container filesystem.
  unstable_enableSymlinks: false,
  blockList: [
    // Block all files in scripts/ directory (Node.js utility scripts)
    new RegExp(path.resolve(__dirname, "scripts").replace(/\\/g, "\\\\") + "/.*"),
    // Block server directory (backend code, not for mobile bundle)
    new RegExp(path.resolve(__dirname, "server").replace(/\\/g, "\\\\") + "/.*"),
    // Block drizzle migrations and config
    new RegExp(path.resolve(__dirname, "drizzle").replace(/\\/g, "\\\\") + "/.*"),
    // Block dist output
    new RegExp(path.resolve(__dirname, "dist").replace(/\\/g, "\\\\") + "/.*"),
    // Block pnpm store if it exists locally
    new RegExp(path.resolve(__dirname, ".pnpm-store").replace(/\\/g, "\\\\") + "/.*"),
    // Block test/script files at root level
    /\/test[^/]*\.(mjs|js|ts)$/,
  ],
};

module.exports = withNativeWind(config, {
  input: "./global.css",
  // Force write CSS to file system instead of virtual modules
  // This fixes iOS styling issues in development mode
  forceWriteFileSystem: true,
});
