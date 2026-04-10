const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");
const fs = require("fs");

const config = getDefaultConfig(__dirname);

// ─── pnpm store resolution ────────────────────────────────────────────────────
// .npmrc sets store-dir=.pnpm-store so the pnpm content-addressable store is
// located inside the project directory (e.g. /usr/src/app/.pnpm-store in Docker).
// Only add .pnpm-store to watchFolders if it actually exists (avoids CI failures).
const watchFolders = [
  path.resolve(__dirname),
  path.resolve(__dirname, "node_modules"),
];

const pnpmStore = path.resolve(__dirname, ".pnpm-store");
if (fs.existsSync(pnpmStore)) {
  watchFolders.push(pnpmStore);
}

config.watchFolders = watchFolders;

// Enable symlink resolution for pnpm hoisted installs
// Block test scripts and non-app files from being bundled
config.resolver = {
  ...config.resolver,
  unstable_enableSymlinks: true,
  blockList: [
    /\/test[^/]*\.(mjs|js|ts)$/,
    /\/scripts\/[^/]+\.mjs$/,
  ],
};

module.exports = withNativeWind(config, {
  input: "./global.css",
  // Force write CSS to file system instead of virtual modules
  // This fixes iOS styling issues in development mode
  forceWriteFileSystem: true,
});
