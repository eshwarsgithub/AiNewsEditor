import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import type { BuildStage, EditionConfig, PagePlan, ProofPage } from "../types";
import { documentHtml } from "./html";
import { PAGE_H, PAGE_W } from "./css";
import { layoutInPage } from "./layoutCore";
import { SAMPLE_BG_JS, SHARPEN_JS } from "../clippings/html";

export type BuildResult = {
  pdfPath: string;
  previews: string[];
  report: string[];
  layout: ProofPage[];
  jumpIds: string[];
  trimmed: { id: string; page: number }[];
};

/** Local (Node) build: layout in Chromium, then write the PDF and per-page PNG previews to disk. */
export async function buildEdition(
  pages: PagePlan[],
  cfg: EditionConfig,
  outDir: string,
  name = "edition",
  onStage: (stage: BuildStage) => void = () => {},
): Promise<BuildResult> {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: Math.round(PAGE_W * 3.78), height: Math.round(PAGE_H * 3.78) } });
    const { report, layout, jumpIds, trimmed } = await layoutInPage(page, pages, documentHtml(pages, cfg), onStage);

    const pdfPath = path.join(outDir, `${name}.pdf`);
    await page.pdf({ path: pdfPath, width: `${PAGE_W}mm`, height: `${PAGE_H}mm`, printBackground: true, preferCSSPageSize: true });

    const previews: string[] = [];
    const handles = await page.$$(".page");
    for (let i = 0; i < handles.length; i++) {
      const p = path.join(outDir, `${name}-page${i + 1}.png`);
      await handles[i].screenshot({ path: p });
      previews.push(p);
    }
    onStage("pdf");
    return { pdfPath, previews, report, layout, jumpIds, trimmed };
  } finally {
    await browser.close();
  }
}

/** Local build of ready-made HTML pages (Version 1, clippings): PDF + per-page PNG previews on disk. */
export async function buildClippingsLocal(html: string, outDir: string, name = "edition", onStage: (s: BuildStage) => void = () => {}) {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: Math.round(PAGE_W * 3.78), height: Math.round(PAGE_H * 3.78) } });
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate("document.fonts.ready");
    await page.evaluate(SHARPEN_JS);
    await page.evaluate(SAMPLE_BG_JS);
    onStage("check");
    const pdfPath = path.join(outDir, `${name}.pdf`);
    await page.pdf({ path: pdfPath, width: `${PAGE_W}mm`, height: `${PAGE_H}mm`, printBackground: true, preferCSSPageSize: true });
    const previews: string[] = [];
    const handles = await page.$$(".page");
    for (let i = 0; i < handles.length; i++) {
      const p = path.join(outDir, `${name}-page${i + 1}.png`);
      await handles[i].screenshot({ path: p });
      previews.push(p);
    }
    onStage("pdf");
    return { pdfPath, previews };
  } finally {
    await browser.close();
  }
}
