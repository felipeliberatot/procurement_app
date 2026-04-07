const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

const config = getDefaultConfig(__dirname);

// ─── pnpm hard-link store resolution ────────────────────────────────────────
// pnpm uses hard links from a content-addressable store (e.g. ~/.local/share/pnpm/store/v3/files/).
// When Metro resolves a file, it calls realpath() which follows hard links to the store path.
// Since the store is outside the project, Metro throws "file not watched" in Docker/CI.
// Fix: add the pnpm store directory to watchFolders so Metro accepts those paths.

function getPnpmStorePath() {
  try {
    const storePath = execSync("pnpm store path", { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
    // store path is like /root/.local/share/pnpm/store/v3
    // hard-linked files live in the "files" subdirectory
    const filesPath = path.join(storePath, "files");
    if (fs.existsSync(filesPath)) return filesPath;
    if (fs.existsSync(storePath)) return storePath;
  } catch (_) {}
  // Fallback: common paths in Docker (root user) and local (ubuntu user)
  const fallbacks = [
    "/root/.local/share/pnpm/store/v3/files",
    "/root/.local/share/pnpm/store/v3",
    path.join(process.env.HOME || "/root", ".local/share/pnpm/store/v3/files"),
    path.join(process.env.HOME || "/root", ".local/share/pnpm/store/v3"),
  ];
  for (const p of fallbacks) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const pnpmStorePath = getPnpmStorePath();

config.watchFolders = [
  path.resolve(__dirname),
  path.resolve(__dirname, "node_modules"),
  ...(pnpmStorePath ? [pnpmStorePath] : []),
];

// Enable symlink resolution for pnpm --shamefully-hoist
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
