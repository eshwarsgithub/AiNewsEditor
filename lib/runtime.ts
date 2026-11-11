/** True when running inside a Cloudflare Worker (no file system, no local Chromium). */
export const onCloudflare = () => typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";

export const GENERATION_UNAVAILABLE =
  "PDF generation is not enabled on this deployment yet. Run the app locally to generate a newspaper.";
