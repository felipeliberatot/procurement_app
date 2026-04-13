const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");
const fs = require("fs");

// ─── Base config ──────────────────────────────────────────────────────────────
const config = getDefaultConfig(__dirname);

// ─── Resolver ─────────────────────────────────────────────────────────────────
// Block server-side, scripts, and non-app files from being bundled by Metro.
// unstable_enableSymlinks must be false to prevent Metro from following pnpm
// symlinks that may not exist in Docker/CI environments.
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
  ],
};

// ─── NativeWind ───────────────────────────────────────────────────────────────
// Apply NativeWind FIRST, then override watchFolders after.
// withNativeWind resets watchFolders to [], so we must set it after.
const finalConfig = withNativeWind(config, {
  input: "./global.css",
  forceWriteFileSystem: true,
});

// ─── watchFolders ─────────────────────────────────────────────────────────────
// CRITICAL: Must be set AFTER withNativeWind (which resets it to []).
//
// The root cause of DependencyGraph.getOrComputeSha1 crash in Docker:
// withNativeWind (via react-native-css-interop) generates a cache file at:
//   node_modules/react-native-css-interop/.cache/web.css
// during the build. Metro cannot compute SHA-1 for files outside watchFolders.
// Adding the .cache directory to watchFolders fixes this crash.
const cssInteropCacheDir = path.resolve(
  __dirname,
  "node_modules/react-native-css-interop/.cache"
);

// Ensure the cache directory exists before adding it to watchFolders
// (it may not exist before the first build)
if (!fs.existsSync(cssInteropCacheDir)) {
  fs.mkdirSync(cssInteropCacheDir, { recursive: true });
}

finalConfig.watchFolders = [
  path.resolve(__dirname),
  cssInteropCacheDir,
];

module.exports = finalConfig;
