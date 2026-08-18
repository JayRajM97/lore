/** @type {import('@bacons/apple-targets').Config} */
module.exports = {
  type: "widget",
  name: "LoreWidget",
  deploymentTarget: "17.0",
  entitlements: {
    "com.apple.security.application-groups": ["group.com.jayraj.lore"],
  },
};
