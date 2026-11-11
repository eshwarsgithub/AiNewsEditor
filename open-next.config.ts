import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// `npm run build` runs the OpenNext build, which itself runs `next build`.
// Pointing buildCommand at next directly avoids an infinite build loop.
export default {
  ...defineCloudflareConfig({}),
  buildCommand: "npx next build",
};
