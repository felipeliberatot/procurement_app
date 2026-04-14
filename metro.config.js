const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");
const fs = require("fs");

// ─── Base config ──────────────────────────────────────────────────────────────
const config = getDefaultConfig(__dirname);

// ─── Pre-create NativeWind cache files ────────────────────────────────────────
// CRITICAL FIX for Docker/CI builds:
// react-native-css-interop creates cache files (ios.js, android.js, etc.) during
// withNativeWind initialization, but does NOT create web.css at that point.
// web.css is only written later during getTransformOptions.
// However, Metro's resolver resolves the import to this file path BEFORE
// getTransformOptions runs. When Metro then tries to compute SHA-1 for the
// resolved file, it fails because the file doesn't exist yet.
//
// Solution: Pre-create web.css as an empty file so Metro can find it during
// the initial crawl. NativeWind will overwrite it with real content later.
const cssInteropCacheDir = path.resolve(
  __dirname,
  "node_modules/react-native-css-interop/.cache"
);
fs.mkdirSync(cssInteropCacheDir, { recursive: true });
// Create ALL platform cache files that NativeWind expects
const cacheFiles = ["web.css", "ios.js", "android.js", "native.js", "macos.js", "windows.js"];
for (const file of cacheFiles) {
  const filePath = path.join(cssInteropCacheDir, file);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "");
  }
}

// ─── Resolver ─────────────────────────────────────────────────────────────────
config.resolver = {
  ...config.resolver,
  unstable_enableSymlinks: false,
  blockList: [
    new RegExp(path.resolve(__dirname, "scripts").replace(/[/\\]/g, "[/\\\\]") + "[/\\\\].*"),
    new RegExp(path.resolve(__dirname, "server").replace(/[/\\]/g, "[/\\\\]") + "[/\\\\].*"),
    new RegExp(path.resolve(__dirname, "drizzle").replace(/[/\\]/g, "[/\\\\]") + "[/\\\\].*"),
    new RegExp(path.resolve(__dirname, "dist").replace(/[/\\]/g, "[/\\\\]") + "[/\\\\].*"),
    new RegExp(path.resolve(__dirname, ".pnpm-store").replace(/[/\\]/g, "[/\\\\]") + "[/\\\\].*"),
  ],
};

// ─── NativeWind ───────────────────────────────────────────────────────────────
const finalConfig = withNativeWind(config, {
  input: "./global.css",
  forceWriteFileSystem: true,
});

// ─── watchFolders ─────────────────────────────────────────────────────────────
// Must be set AFTER withNativeWind (which may reset it).
// Include the project root AND the css-interop cache directory so Metro
// can watch and compute SHA-1 for the generated CSS/JS files.
finalConfig.watchFolders = [
  path.resolve(__dirname),
  cssInteropCacheDir,
];

module.exports = finalConfig;
