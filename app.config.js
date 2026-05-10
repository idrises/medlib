const base = require("./app.json").expo;

const variant = process.env.APP_VARIANT;
const isDev = variant === "dev" || variant === "2";

module.exports = ({ config }) => ({
  ...base,
  name: isDev ? "MedLib Dev" : base.name,
  scheme: isDev ? "medlib-dev" : base.scheme,
  ios: {
    ...base.ios,
    bundleIdentifier: isDev ? "com.codex.MakaleSwiftUI.iOS-2" : base.ios.bundleIdentifier,
  },
  android: {
    ...base.android,
    package: isDev ? "com.codex.makaleswiftui.dev" : base.android.package,
  },
});
