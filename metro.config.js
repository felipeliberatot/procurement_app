const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Always enable symlink resolution so Metro can find hoisted pnpm packages
// (--shamefully-hoist creates symlinks in node_modules on both local and Docker)
config.resolver = {
  ...config.resolver,
  unstable_enableSymlinks: true,
};

// Always set watchFolders to avoid "file not watched" errors in Docker/CI.
// Explicitly include project root and node_modules to prevent Metro from
// resolving symlinked files outside the watched paths.
config.watchFolders = [
  path.resolve(__dirname),
  path.resolve(__dirname, "node_modules"),
];

module.exports = withNativeWind(config, {
  input: "./global.css",
  // Force write CSS to file system instead of virtual modules
  // This fixes iOS styling issues in development mode
  forceWriteFileSystem: true,
});
