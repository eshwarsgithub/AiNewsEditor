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

/**
 * Print sharpening: a PDF cannot hold more detail than the clipping has, but a low-resolution image
 * prints blocky when the printer scales it. So each clipping is resampled up to ~300 dpi at the size
 * it is placed (smooth, in steps of 2x), then given an unsharp mask so text edges stay crisp.
 * Runs in the render browser; passed to page.evaluate() as a string.
 */
export const SHARPEN_JS = `(async () => {
  const imgs = Array.from(document.querySelectorAll('.clip img'));
  await Promise.all(imgs.map((i) => (i.decode ? i.decode().catch(() => {}) : Promise.resolve())));
  let n = 0;
  for (const img of imgs) {
    try {
      const w = img.naturalWidth, h = img.naturalHeight;
      const box = img.getBoundingClientRect();
      const shownW = Math.min(box.width, (box.height * w) / h);
      const factor = Math.min(((shownW / 96) * 300) / w, 4);
      if (factor < 1.3) continue;
      const tw = Math.round(w * factor);
      let cur = img, cw = w, canvas = null;
      while (cw < tw) {
        const nw = Math.min(tw, cw * 2), nh = Math.round((nw * h) / w);
        canvas = document.createElement('canvas'); canvas.width = nw; canvas.height = nh;
        const c = canvas.getContext('2d');
        c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
        c.drawImage(cur, 0, 0, nw, nh);
        cur = canvas; cw = nw;
      }
      const ch = canvas.height;
      const ctx = canvas.getContext('2d');
      const data = ctx.getImageData(0, 0, cw, ch);
      const blur = document.createElement('canvas'); blur.width = cw; blur.height = ch;
      const bctx = blur.getContext('2d');
      bctx.filter = 'blur(' + (factor * 0.55).toFixed(2) + 'px)';
      bctx.drawImage(canvas, 0, 0);
      const b = bctx.getImageData(0, 0, cw, ch).data, d = data.data;
      for (let i = 0; i < d.length; i += 4) {
        for (let k = 0; k < 3; k++) {
          const diff = d[i + k] - b[i + k];
          if (diff > 3 || diff < -3) { const v = d[i + k] + 0.9 * diff; d[i + k] = v < 0 ? 0 : v > 255 ? 255 : v; }
        }
      }
      ctx.putImageData(data, 0, 0);
      img.src = canvas.toDataURL('image/jpeg', 0.95);
      await img.decode();
      n++;
    } catch (e) { /* keep the original image */ }
  }
  return n;
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
