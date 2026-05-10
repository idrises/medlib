const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Exclude server-only packages (mssql/tedious/azure) from Metro watcher
// These are installed in workspace but not needed by the mobile app
const BLOCK_LIST_PATTERNS = [
  /node_modules[/\\]mssql[/\\]/,
  /node_modules[/\\]tedious[/\\]/,
  /node_modules[/\\]@azure[/\\]/,
  /node_modules[/\\]\.pnpm[/\\]tedious[^/\\]*[/\\]/,
  /node_modules[/\\]\.pnpm[/\\]@azure[^/\\]*[/\\]/,
];

const originalBlockList = config.resolver?.blockList;
config.resolver = {
  ...config.resolver,
  blockList: originalBlockList
    ? [
        ...(Array.isArray(originalBlockList) ? originalBlockList : [originalBlockList]),
        ...BLOCK_LIST_PATTERNS,
      ]
    : BLOCK_LIST_PATTERNS,
};

module.exports = config;
