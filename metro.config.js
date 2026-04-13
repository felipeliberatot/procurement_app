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
// Block server-side, scripts, and test files from being bundled by Metro
// These files are Node.js only and must not be included in the mobile bundle
config.resolver = {
  ...config.resolver,
  unstable_enableSymlinks: true,
  blockList: [
    // Block all files in scripts/ directory (Node.js utility scripts)
    new RegExp(path.resolve(__dirname, "scripts").replace(/\\/g, "\\\\") + "/.*"),
    // Block server directory (backend code, not for mobile bundle)
    new RegExp(path.resolve(__dirname, "server").replace(/\\/g, "\\\\") + "/.*"),
    // Block drizzle migrations and config
    new RegExp(path.resolve(__dirname, "drizzle").replace(/\\/g, "\\\\") + "/.*"),
    // Block test files at root level
    /\/test[^/]*\.(mjs|js|ts)$/,
    // Block dist output
    new RegExp(path.resolve(__dirname, "dist").replace(/\\/g, "\\\\") + "/.*"),
  ],
};

module.exports = withNativeWind(config, {
  input: "./global.css",
  // Force write CSS to file system instead of virtual modules
  // This fixes iOS styling issues in development mode
  forceWriteFileSystem: true,
});
