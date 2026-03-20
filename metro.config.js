// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Expo Go solicita /node_modules/expo/AppEntry.bundle (formato antiguo).
// Este proyecto usa expo-router, así que redirigimos al entry correcto.
const originalRewriteRequestUrl = config.server.rewriteRequestUrl;
config.server.rewriteRequestUrl = (url) => {
  const rewritten = originalRewriteRequestUrl ? originalRewriteRequestUrl(url) : url;
  if (rewritten.includes('node_modules/expo/AppEntry')) {
    return rewritten.replace('node_modules/expo/AppEntry', 'node_modules/expo-router/entry');
  }
  return rewritten;
};

module.exports = config;
