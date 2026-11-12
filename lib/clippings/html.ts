import type { EditionConfig } from "../types";
import { esc, mastheadHtml, regbar, stripHtml } from "../render/html";
import { fontCss, pageCss } from "../render/css";
import type { PackedPage } from "./pack";

export type ClipImage = { id: string; dataUri: string };

const css = `
.mosaic{position:relative;flex:1;min-height:0}
.clip{position:absolute;overflow:hidden;background:#fff;display:flex;align-items:center;justify-content:center}
.clip img{display:block;width:100%;height:100%;object-fit:contain}
`;

/**
 * Samples each clipping's edge colour so any padding blends in (clippings have flat backgrounds).
 * Passed to page.evaluate() as a string, so it is immune to bundler helper injection.
 */
export const SAMPLE_BG_JS = `(async () => {
  const imgs = Array.from(document.querySelectorAll('.clip img'));
  await Promise.all(imgs.map((i) => (i.decode ? i.decode().catch(() => {}) : Promise.resolve())));
  for (const img of imgs) {
    try {
      const w = img.naturalWidth, h = img.naturalHeight;
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const counts = new Map();
      const add = (px, py) => {
        const d = x.getImageData(px, py, 1, 1).data;
        const k = (d[0] >> 4) + ',' + (d[1] >> 4) + ',' + (d[2] >> 4);
        const e = counts.get(k) || { n: 0, r: 0, g: 0, b: 0 };
        e.n++; e.r += d[0]; e.g += d[1]; e.b += d[2]; counts.set(k, e);
      };
      const stepX = Math.max(1, Math.floor(w / 60)), stepY = Math.max(1, Math.floor(h / 60));
      for (let px = 0; px < w; px += stepX) { add(px, 0); add(px, h - 1); }
      for (let py = 0; py < h; py += stepY) { add(0, py); add(w - 1, py); }
      let best = null;
      for (const e of counts.values()) if (!best || e.n > best.n) best = e;
      if (best) img.parentElement.style.background = 'rgb(' + Math.round(best.r / best.n) + ',' + Math.round(best.g / best.n) + ',' + Math.round(best.b / best.n) + ')';
    } catch (e) { /* keep white */ }
  }
  return imgs.length;
})()`;

function pageHtml(p: PackedPage, cfg: EditionConfig, images: Map<string, string>) {
  const head = p.kind === "front" ? mastheadHtml(cfg) : stripHtml(p.number, cfg, "");
  const cells = p.placed
    .map(
      (c) =>
        `<div class="clip" data-id="${esc(c.id)}" style="left:${c.x.toFixed(2)}mm;top:${c.y.toFixed(2)}mm;width:${c.w.toFixed(2)}mm;height:${c.h.toFixed(2)}mm"><img src="${images.get(c.id) ?? ""}"/></div>`,
    )
    .join("");
  return `<section class="page ${p.kind === "front" ? "front" : "inside-page"}" data-page="${p.number}">
    ${head}
    <div class="mosaic">${cells}</div>
    ${regbar}
  </section>`;
}

export function clippingsHtml(pages: PackedPage[], cfg: EditionConfig, images: ClipImage[]) {
  const map = new Map(images.map((i) => [i.id, i.dataUri]));
  return `<!doctype html><html lang="te"><head><meta charset="utf-8"/><style>${fontCss()}${pageCss}${css}</style></head><body>${pages.map((p) => pageHtml(p, cfg, map)).join("\n")}</body></html>`;
}
