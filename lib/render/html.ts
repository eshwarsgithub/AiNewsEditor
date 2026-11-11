import fs from "node:fs";
import path from "node:path";
import type { EditionConfig, PagePlan, PlacedStory } from "../types";
import { fontCss, pageCss } from "./css";

export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const mime: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

function dataUri(p: string) {
  const abs = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
  const ext = path.extname(abs).toLowerCase();
  return `data:${mime[ext] ?? "image/png"};base64,${fs.readFileSync(abs).toString("base64")}`;
}

export function paragraphsHtml(text: string) {
  return text
    .split(/\n\s*\n/)
    .filter((p) => p.trim())
    .map((p) => `<p>${esc(p.trim())}</p>`)
    .join("");
}

export function storyHtml(s: PlacedStory, tone = 5, weight?: number) {
  const a = s.article;
  const img = a.image
    ? `<figure class="img"><img src="${dataUri(a.image.path)}"/>${a.image.caption ? `<figcaption class="cap">${esc(a.image.caption)}</figcaption>` : ""}</figure>`
    : "";
  const style = weight ? ` style="flex-grow:${weight}"` : "";
  return `<article class="story slot-${s.slot} tone-${tone}" data-id="${esc(a.id)}"${style}>
    <h2 class="hl">${esc(a.headline)}</h2>
    ${s.fromPage ? `<div class="from" data-from="${s.fromPage}">మొదటిపేజీ తరువాయి</div>` : ""}
    ${a.subhead ? `<p class="sub">${esc(a.subhead)}</p>` : ""}
    ${a.bullets?.length ? `<ul class="bullets">${a.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : ""}
    ${a.dateline ? `<div class="dl">${esc(a.dateline)}</div>` : ""}
    ${img}
    <div class="body" data-id="${esc(a.id)}">${paragraphsHtml(a.body)}</div>
    ${s.jumpToPage ? `<div class="jump" data-jump="${esc(a.id)}" data-to="${s.jumpToPage}">…మిగతా ${s.jumpToPage} లో…</div>` : ""}
  </article>`;
}

const regbar = `<div class="regbar">${["#00aeef", "#ec008c", "#fff200", "#000", "#8dd3f0", "#f8a1d1", "#fff7a1", "#777"]
  .map((c) => `<i style="background:${c};border:0.2mm solid #000"></i>`)
  .join("")}</div>`;

function frontHtml(p: PagePlan, cfg: EditionConfig) {
  const by = (slot: string) => p.stories.filter((s) => s.slot === slot);
  const row = (cls: string, stories: PlacedStory[], toneStart: number) =>
    stories.length
      ? `<div class="row ${cls}">${stories.map((s, i) => storyHtml(s, (toneStart + i) % 5)).join("")}</div>`
      : "";
  return `<section class="page front" data-page="1">
    <header class="masthead"><div class="name">${esc(cfg.paperName)}</div><div class="en">${esc(cfg.paperNameEn)}${cfg.tagline ? `<br/>${esc(cfg.tagline)}` : ""}</div></header>
    <div class="infobar">${[cfg.issue && `ISSUE - ${cfg.issue}`, cfg.volume && `VOLUME - ${cfg.volume}`, cfg.date, cfg.price].filter(Boolean).map((t) => `<span>${esc(String(t))}</span>`).join("")}</div>
    <div class="rows">
      ${row("r1", by("teaser"), 0)}
      ${row("r2", by("mid"), 2)}
      ${row("r3", [...by("lead"), ...by("side")], 3)}
    </div>
    ${regbar}
  </section>`;
}

function insideHtml(p: PagePlan, cfg: EditionConfig) {
  const main = p.stories.filter((s) => s.slot === "main");
  const w = (s: PlacedStory) => Math.max(400, Math.min(s.article.body.length, 3200)) + (s.article.image ? 700 : 0);
  return `<section class="page inside-page" data-page="${p.number}">
    <div class="strip">
      <div class="num">${p.number}</div>
      <div class="brand"><div class="name">${esc(cfg.paperName)}</div><div class="en">${esc(cfg.paperNameEn)}</div></div>
      <div class="sect"><span>${esc(cfg.date)}</span><b>${esc(p.section)}</b></div>
    </div>
    <div class="inside no-rail" data-inside="${p.number}">
      <div class="main">${main.map((s) => storyHtml(s, 5, w(s))).join("")}</div>
      <aside class="rail" data-rail="${p.number}"></aside>
    </div>
    ${regbar}
  </section>`;
}

export function documentHtml(pages: PagePlan[], cfg: EditionConfig) {
  const body = pages.map((p) => (p.kind === "front" ? frontHtml(p, cfg) : insideHtml(p, cfg))).join("\n");
  return `<!doctype html><html lang="te"><head><meta charset="utf-8"/><style>${fontCss()}${pageCss}</style></head><body>${body}</body></html>`;
}
