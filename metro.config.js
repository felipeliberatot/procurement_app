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
// pnpm --shamefully-hoist creates symlinks like node_modules/react -> .pnpm/react@x/node_modules/react
// Metro resolves symlinks to their real paths inside .pnpm/, so we must watch that too.
config.watchFolders = [
  path.resolve(__dirname),
  path.resolve(__dirname, "node_modules"),
  path.resolve(__dirname, "node_modules/.pnpm"),
];

module.exports = withNativeWind(config, {
  input: "./global.css",
  // Force write CSS to file system instead of virtual modules
  // This fixes iOS styling issues in development mode
  forceWriteFileSystem: true,
});
