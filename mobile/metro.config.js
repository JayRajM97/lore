const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Firebase 10+ ships ESM as default export (uses import.meta — breaks Metro/CJS).
// Enabling package exports + browser+require conditions routes Metro to the CJS
// builds (firebase/firestore/dist/index.cjs.js etc) instead.
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ["browser", "require", "default"];

// Zustand exports map has "import" condition → ESM (import.meta.env) before "default" → CJS.
// Metro adds "import" condition for ESM `import` statements, so the ESM build wins.
// Force CJS builds for zustand and its sub-paths.
const zustandRoot = path.resolve(__dirname, "node_modules/zustand");
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "zustand") {
    return { type: "sourceFile", filePath: path.join(zustandRoot, "index.js") };
  }
  if (moduleName.startsWith("zustand/")) {
    const sub = moduleName.slice("zustand/".length);
    return { type: "sourceFile", filePath: path.join(zustandRoot, `${sub}.js`) };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
