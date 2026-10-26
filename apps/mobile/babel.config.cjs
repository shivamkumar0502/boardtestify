const path = require("node:path");
module.exports = function (api) {
  api.cache(true);
  const plugins = [];
  // npm can nest expo-router in this workspace while hoisting the preset.
  // In that layout the preset's auto-detection cannot resolve the router.
  const presetRoot = path.dirname(require.resolve("babel-preset-expo"));
  try {
    require.resolve("expo-router", { paths: [presetRoot] });
  } catch {
    plugins.push(
      require("babel-preset-expo/build/expo-router-plugin")
        .expoRouterBabelPlugin,
    );
  }
  return { presets: ["babel-preset-expo"], plugins };
};
