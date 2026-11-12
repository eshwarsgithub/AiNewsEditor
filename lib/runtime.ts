import { getCloudflareContext } from "@opennextjs/cloudflare";

/** True when running inside a Cloudflare Worker (no file system, no local Chromium). */
export const onCloudflare = () => typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";

type R2Bucket = {
  put(key: string, value: Uint8Array | ArrayBuffer, opts?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<{ body: unknown } | null>;
};
export type CfEnv = { BROWSER?: unknown; OUT?: R2Bucket };

/** Cloudflare bindings (Browser Rendering + R2). Only call when onCloudflare() is true. */
export const cfEnv = () => getCloudflareContext().env as unknown as CfEnv;

export const GENERATION_UNAVAILABLE =
  "PDF generation is not set up on this deployment (the BROWSER and OUT bindings are missing). Run the app locally to generate a newspaper.";
