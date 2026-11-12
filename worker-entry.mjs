// Worker entry: wraps the OpenNext worker and hands it Cloudflare's Playwright launcher.
// @cloudflare/playwright imports "cloudflare:workers", which only wrangler's bundler can resolve,
// so it is imported here (not inside the Next.js code) and passed in through a global.
import { launch } from "@cloudflare/playwright";
import handler from "./.open-next/worker.js";

globalThis.__launchBrowser = launch;

export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js";
export default handler;
