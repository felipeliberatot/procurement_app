const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// In CI/Docker environments, enable symlink resolution so Metro can find
// hoisted pnpm packages (--shamefully-hoist creates symlinks in node_modules)
if (process.env.CI) {
  config.resolver = {
    ...config.resolver,
    unstable_enableSymlinks: true,
  };
}

module.exports = withNativeWind(config, {
  input: "./global.css",
  // Force write CSS to file system instead of virtual modules
  // This fixes iOS styling issues in development mode
  forceWriteFileSystem: true,
});
