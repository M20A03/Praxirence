const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

// Exclude native build and monorepo folders from Metro file watcher to prevent ENOSPC crashes
config.resolver.blockList = [
  /.*\/android\/app\/build\/.*/,
  /.*\/android\/\.gradle\/.*/,
  /.*\/android\/build\/.*/,
  /.*\/backend\/.*/,
  /.*\/web_app\/.*/,
  /.*\/\.git\/.*/,
];

module.exports = config;

