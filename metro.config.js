const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

// ─── Base config ──────────────────────────────────────────────────────────────
const config = getDefaultConfig(__dirname);

// ─── Resolver ─────────────────────────────────────────────────────────────────
// Block server-side, scripts, and non-app files from being bundled by Metro.
// IMPORTANT: unstable_enableSymlinks must be false to prevent Metro from
// following pnpm symlinks that may not exist in Docker/CI environments,
// which causes the DependencyGraph.getOrComputeSha1 crash.
config.resolver = {
  ...config.resolver,
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

// ─── NativeWind ───────────────────────────────────────────────────────────────
// Apply NativeWind FIRST, then override watchFolders after.
// withNativeWind resets watchFolders to [], so we must set it after.
const finalConfig = withNativeWind(config, {
  input: "./global.css",
  // Force write CSS to file system instead of virtual modules
  // This fixes iOS styling issues in development mode
  forceWriteFileSystem: true,
});

// ─── watchFolders ─────────────────────────────────────────────────────────────
// Set AFTER withNativeWind to prevent it from being overridden.
// Only include the project root — do NOT add node_modules or .pnpm-store,
// as Metro resolves node_modules automatically and adding them causes crashes
// in Docker when pnpm symlinks point to non-existent store paths.
finalConfig.watchFolders = [path.resolve(__dirname)];

module.exports = finalConfig;
