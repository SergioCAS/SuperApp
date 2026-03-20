// app.config.js replaces app.json so we can bake env vars into expo.extra at startup.
// We load .env ourselves with dotenv to guarantee values are present regardless of
// when Expo evaluates this file relative to @expo/env's load() call.
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env"), override: false });

const base = require("./app.json").expo;

/** @type {import('@expo/config').ExpoConfig} */
module.exports = {
  expo: {
    ...base,
    extra: {
      ...base.extra,
      firebase: {
        apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID
      }
    }
  }
};
