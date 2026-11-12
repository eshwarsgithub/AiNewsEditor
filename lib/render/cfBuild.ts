import type { BrowserWorker, Browser } from "@cloudflare/playwright";
import type { Page } from "playwright";
import type { BuildStage, EditionConfig, PagePlan, ProofPage } from "../types";
import { documentHtml } from "./html";
import { PAGE_H, PAGE_W } from "./css";
import { layoutInPage } from "./layoutCore";
import { SAMPLE_BG_JS, SHARPEN_JS } from "../clippings/html";

export type CfBuildResult = {
  pdf: Uint8Array;
  previews: Uint8Array[];
  report: string[];
  layout: ProofPage[];
  jumpIds: string[];
  trimmed: { id: string; page: number }[];
};

/** Cloudflare build: same layout code, but in Browser Rendering, returning bytes instead of files. */
export async function buildEditionOnCloudflare(
  browserBinding: BrowserWorker,
  pages: PagePlan[],
  cfg: EditionConfig,
  onStage: (stage: BuildStage) => void = () => {},
): Promise<CfBuildResult> {
  // Injected by worker-entry.mjs (see there for why).
  const launch = (globalThis as unknown as { __launchBrowser?: (b: BrowserWorker) => Promise<Browser> }).__launchBrowser;
  if (!launch) throw new Error("Browser launcher is not available on this deployment.");
  const browser = await launch(browserBinding);
  try {
    const page = await browser.newPage({ viewport: { width: Math.round(PAGE_W * 3.78), height: Math.round(PAGE_H * 3.78) } });
    const { report, layout, jumpIds, trimmed } = await layoutInPage(page as unknown as Page, pages, documentHtml(pages, cfg), onStage);
    const pdf = await page.pdf({ width: `${PAGE_W}mm`, height: `${PAGE_H}mm`, printBackground: true, preferCSSPageSize: true });
    const previews: Uint8Array[] = [];
    for (const h of await page.$$(".page")) previews.push(await h.screenshot());
    onStage("pdf");
    return { pdf, previews, report, layout, jumpIds, trimmed };
  } finally {
    await browser.close();
  }
}

/** Cloudflare build of ready-made HTML pages (Version 1, clippings): bytes for the PDF and each page preview. */
export async function buildClippingsOnCloudflare(browserBinding: BrowserWorker, html: string, onStage: (s: BuildStage) => void = () => {}) {
  const launch = (globalThis as unknown as { __launchBrowser?: (b: BrowserWorker) => Promise<Browser> }).__launchBrowser;
  if (!launch) throw new Error("Browser launcher is not available on this deployment.");
  const browser = await launch(browserBinding);
  try {
    const page = await browser.newPage({ viewport: { width: Math.round(PAGE_W * 3.78), height: Math.round(PAGE_H * 3.78) } });
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate("document.fonts.ready");
    await page.evaluate(SHARPEN_JS);
    await page.evaluate(SAMPLE_BG_JS);
    onStage("check");
    const pdf = await page.pdf({ width: `${PAGE_W}mm`, height: `${PAGE_H}mm`, printBackground: true, preferCSSPageSize: true });
    const previews: Uint8Array[] = [];
    for (const h of await page.$$(".page")) previews.push(await h.screenshot());
    onStage("pdf");
    return { pdf, previews };
  } finally {
    await browser.close();
  }
}
