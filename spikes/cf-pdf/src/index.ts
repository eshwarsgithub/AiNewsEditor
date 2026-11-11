import { launch } from "@cloudflare/playwright";
import type { Page } from "playwright";
import { layoutInPage } from "../../../lib/render/layoutCore";
import type { PagePlan } from "../../../lib/types";

interface Env {
  BROWSER: Fetcher;
}

const PAGE_W = 340; // mm
const PAGE_H = 540; // mm
const PX = 3.78;

/**
 * Spike: POST { pages, html } (produced by the real engine) to /run?out=pdf|png|json
 * and get back the PDF, a page-1 PNG, or the layout JSON, rendered on Browser Rendering.
 */
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method !== "POST" || url.pathname !== "/run") return new Response("POST /run?out=pdf|png|json", { status: 404 });

    const { pages, html } = (await req.json()) as { pages: PagePlan[]; html: string };
    const out = url.searchParams.get("out") ?? "json";
    const t0 = Date.now();
    const timings: Record<string, number> = {};

    const browser = await launch(env.BROWSER);
    timings.launch = Date.now() - t0;
    try {
      const page = await browser.newPage({ viewport: { width: Math.round(PAGE_W * PX), height: Math.round(PAGE_H * PX) } });
      const t1 = Date.now();
      const result = await layoutInPage(page as unknown as Page, pages, html);
      timings.layout = Date.now() - t1;

      if (out === "pdf") {
        const t2 = Date.now();
        const pdf = await page.pdf({ width: `${PAGE_W}mm`, height: `${PAGE_H}mm`, printBackground: true, preferCSSPageSize: true });
        timings.pdf = Date.now() - t2;
        return new Response(pdf, {
          headers: { "content-type": "application/pdf", "x-timings": JSON.stringify(timings), "x-trimmed": String(result.trimmed.length) },
        });
      }
      if (out === "png") {
        const handles = await page.$$(".page");
        const n = Number(url.searchParams.get("page") ?? "1") - 1;
        const png = await handles[n].screenshot();
        return new Response(png, { headers: { "content-type": "image/png", "x-timings": JSON.stringify(timings) } });
      }
      return Response.json({ timings, report: result.report, trimmed: result.trimmed, jumpIds: result.jumpIds, pages: result.layout.map((p) => ({ number: p.number, stories: p.stories.length, links: p.links.length, gapMm: p.gapMm })) });
    } finally {
      await browser.close();
    }
  },
} satisfies ExportedHandler<Env>;
