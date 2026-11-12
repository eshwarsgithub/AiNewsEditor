import type { Page } from "playwright";
import type { Article, BuildStage, PagePlan, ProofPage } from "../types";
import { storyHtml } from "./html";

/**
 * Browser-side layout steps. Everything here only talks to a Playwright-style `page`,
 * so the same code runs on local Chromium (Node) and on Cloudflare Browser Rendering.
 */

export type FitResult = { id: string; total: number; fitted: number; remainder: string };

/** Runs in the browser: trims each story body to the longest text that fits its box. */
export async function fitBodies(page: Page, scope: string): Promise<FitResult[]> {
  return page.evaluate((scopeSel) => {
    const out: { id: string; total: number; fitted: number; remainder: string }[] = [];
    const bodies = Array.from(document.querySelectorAll<HTMLElement>(`${scopeSel} .body[data-id]`));
    for (const el of bodies) {
      const paras = Array.from(el.querySelectorAll("p")).map((p) => (p.textContent ?? "").trim());
      const words: { w: string; p: number }[] = [];
      paras.forEach((t, pi) => t.split(/\s+/).filter(Boolean).forEach((w) => words.push({ w, p: pi })));
      const render = (n: number) => {
        const groups: string[][] = [];
        for (let i = 0; i < n; i++) (groups[words[i].p] ??= []).push(words[i].w);
        el.innerHTML = groups
          .filter(Boolean)
          .map((g) => `<p>${g.join(" ").replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>`)
          .join("");
      };
      const overflows = () => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
      render(words.length);
      let n = words.length;
      if (overflows()) {
        let lo = 0;
        let hi = words.length;
        while (lo < hi) {
          const mid = Math.ceil((lo + hi) / 2);
          render(mid);
          if (overflows()) hi = mid - 1;
          else lo = mid;
        }
        n = lo;
        render(n);
      }
      const rest = words.slice(n);
      const remainder = paras
        .map((_, pi) => rest.filter((x) => x.p === pi).map((x) => x.w).join(" "))
        .filter(Boolean)
        .join("\n\n");
      const id = el.dataset.id!;
      if (!remainder) el.closest(".page")?.querySelector(`[data-jump="${id}"]`)?.remove();
      if (!remainder && !el.closest(".front")) el.style.columnFill = "balance";
      out.push({ id, total: words.length, fitted: n, remainder });
    }
    return out;
  }, scope);
}

/** Runs in the browser: per page, story boxes, jump links and the largest unused vertical gap. */
export async function measurePages(page: Page): Promise<Omit<ProofPage, "section">[]> {
  return page.evaluate(() => {
    const boxOf = (r: DOMRect, pr: DOMRect) => ({
      x: ((r.left - pr.left) / pr.width) * 100,
      y: ((r.top - pr.top) / pr.height) * 100,
      w: (r.width / pr.width) * 100,
      h: (r.height / pr.height) * 100,
    });
    return Array.from(document.querySelectorAll<HTMLElement>(".page")).map((el) => {
      const pr = el.getBoundingClientRect();
      const stories = Array.from(el.querySelectorAll<HTMLElement>(".story[data-id]")).map((s) => ({
        id: s.dataset.id!,
        ...boxOf(s.getBoundingClientRect(), pr),
      }));
      const links: { x: number; y: number; w: number; h: number; to: number; kind: "jump" | "from" }[] = [];
      el.querySelectorAll<HTMLElement>(".jump[data-to]").forEach((j) =>
        links.push({ ...boxOf(j.getBoundingClientRect(), pr), to: Number(j.dataset.to), kind: "jump" }),
      );
      el.querySelectorAll<HTMLElement>(".from[data-from]").forEach((j) =>
        links.push({ ...boxOf(j.getBoundingClientRect(), pr), to: Number(j.dataset.from), kind: "from" }),
      );
      let gapPx = 0;
      let gap: { x: number; y: number; w: number; h: number } | undefined;
      if (!el.classList.contains("front")) {
        el.querySelectorAll<HTMLElement>(".body[data-id]").forEach((b) => {
          const br = b.getBoundingClientRect();
          let bottom = br.top;
          b.querySelectorAll("p").forEach((p) => {
            const range = document.createRange();
            range.selectNodeContents(p);
            Array.from(range.getClientRects()).forEach((r) => (bottom = Math.max(bottom, r.bottom)));
          });
          const g = br.bottom - bottom;
          if (g > gapPx) {
            gapPx = g;
            gap = boxOf(new DOMRect(br.left, bottom, br.width, g), pr);
          }
        });
      }
      return {
        number: Number(el.dataset.page),
        stories,
        links,
        gapMm: Math.round((gapPx / pr.width) * 340),
        gap,
      };
    });
  });
}

export type LayoutResult = {
  report: string[];
  layout: ProofPage[];
  jumpIds: string[];
  trimmed: { id: string; page: number }[];
};

/** Loads the edition HTML into `page`, fits every story, builds the page-2 jump rail and measures geometry. */
export async function layoutInPage(
  page: Page,
  pages: PagePlan[],
  html: string,
  onStage: (stage: BuildStage) => void = () => {},
): Promise<LayoutResult> {
  const report: string[] = [];
  const trimmed: { id: string; page: number }[] = [];

  await page.setContent(html, { waitUntil: "load" });
  // esbuild/tsx may wrap functions with __name(); shim it for in-browser evaluate()
  await page.evaluate("window.__name = window.__name2 = window.__name3 = (f) => f; document.fonts.ready");

  // Phase 1: fit the front page, collect what spills over (jumps).
  const front = await fitBodies(page, `.page[data-page="1"]`);
  const jumps: { article: Article; remainder: string }[] = [];
  for (const f of front) {
    const src = pages[0].stories.find((s) => s.article.id === f.id)!;
    if (f.remainder) jumps.push({ article: { ...src.article, body: f.remainder }, remainder: f.remainder });
    report.push(`p1 ${f.id}: ${f.fitted}/${f.total} words${f.remainder ? " (jumps to p2)" : ""}`);
  }

  onStage("place");

  // Phase 2: continuation rail on page 2.
  if (jumps.length) {
    const railHtml = jumps
      .map((j) =>
        storyHtml({ article: { ...j.article, image: undefined, bullets: undefined, subhead: undefined }, slot: "rail", fromPage: 1 }, 5, Math.max(300, j.remainder.length)),
      )
      .join("");
    await page.evaluate((h) => {
      const rail = document.querySelector<HTMLElement>('[data-rail="2"]');
      const inside = document.querySelector<HTMLElement>('[data-inside="2"]');
      if (rail && inside) {
        rail.innerHTML = h;
        inside.classList.remove("no-rail");
        inside.classList.add("has-rail");
      }
    }, railHtml);
  }

  // Phase 3: fit all inside pages.
  for (const p of pages.filter((p) => p.kind === "inside")) {
    const res = await fitBodies(page, `.page[data-page="${p.number}"]`);
    for (const f of res) {
      if (f.remainder) trimmed.push({ id: f.id, page: p.number });
      report.push(`p${p.number} ${f.id}: ${f.fitted}/${f.total} words${f.remainder ? " (TRIMMED, no room)" : ""}`);
    }
  }

  onStage("check");
  const measured = await measurePages(page);
  const layout: ProofPage[] = measured.map((m) => ({
    ...m,
    section: pages.find((p) => p.number === m.number)?.section ?? "",
  }));
  return { report, layout, jumpIds: jumps.map((j) => j.article.id), trimmed };
}
