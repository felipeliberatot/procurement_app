const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

// ─── pnpm store resolution ────────────────────────────────────────────────────
// .npmrc sets store-dir=.pnpm-store so the pnpm content-addressable store is
// located inside the project directory (e.g. /usr/src/app/.pnpm-store in Docker).
// Metro's projectRoot already covers the project directory, so hard-linked files
// in .pnpm-store are always within a watched folder — no extra watchFolders needed.
//
// We still set watchFolders explicitly to be safe in case the store-dir changes.
config.watchFolders = [
  path.resolve(__dirname),
  path.resolve(__dirname, "node_modules"),
  path.resolve(__dirname, ".pnpm-store"),
];

// Enable symlink resolution for pnpm hoisted installs
config.resolver = {
  ...config.resolver,
  unstable_enableSymlinks: true,
};

module.exports = withNativeWind(config, {
  input: "./global.css",
  // Force write CSS to file system instead of virtual modules
  // This fixes iOS styling issues in development mode
  forceWriteFileSystem: true,
});
