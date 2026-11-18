const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);

// expo-sqlite's browser implementation imports its bundled SQLite WASM module.
config.resolver.assetExts.push('wasm');

// SharedArrayBuffer is required by the SQLite WebAssembly worker.
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  middleware(req, res, next);
};

module.exports = config;
