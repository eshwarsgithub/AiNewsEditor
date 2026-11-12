/**
 * Version 1 layout: tile article clippings (images) into full-width rows, like a mosaic.
 * Pure maths, no browser. A row of clippings with aspect ratios a_i (width / height) has the natural
 * height  rowWidth / sum(a_i)  with no distortion and no gaps; we pick the grouping that fills the page.
 */

export type Priority = "lead" | "general" | "inside";
export type LeadPosition = "top" | "middle" | "bottom";

export type ClipIn = { id: string; name: string; aspect: number; pxWidth: number; priority: Priority };

export type Placed = {
  id: string;
  x: number; // mm, relative to the mosaic area
  y: number;
  w: number;
  h: number;
  row: number; // 1-based
  dpi: number; // effective print resolution of the image as placed
};

export type PackedPage = {
  number: number;
  kind: "front" | "inside";
  /** Mosaic area in mm (what is left after the masthead / page strip). */
  areaW: number;
  areaH: number;
  placed: Placed[];
  /** Empty space left at the bottom of the area, mm. */
  blankMm: number;
};

export type PackWarning = { kind: "dpi" | "blank" | "moved" | "tall" | "lead"; id?: string; page?: number; text: string };

export type PackResult = { pages: PackedPage[]; warnings: PackWarning[]; why: Record<string, string> };

export const GUTTER = 3; // mm between blocks
export const FRONT_AREA = { w: 320, h: 438 };
export const INSIDE_AREA = { w: 320, h: 494 };
const MIN_ROW_H = 55; // mm: rows shorter than this are hard to read
const SCALE_MIN = 0.8; // rows may shrink to 80% of natural height (image gets side padding)
const SCALE_MAX = 1.3; // ...or grow to 130% (image gets top/bottom padding)
const DPI_WARN = 150;
const DPI_SOFT = 105; // below this the cost grows quickly (images look blurry)

/** A cell is one clipping, or two stacked on top of each other (same width). */
type Cell = { items: number[]; aspect: number };
type Layout = { cells: Cell[]; rows: number[][]; scale: number; cost: number }; // rows hold indexes into `cells`

const stackAspect = (a: number, b: number) => 1 / (1 / a + 1 / b);

/** Every way to merge neighbouring items of `seq` into stacked pairs (the lead is never stacked). */
function cellPatterns(seq: ClipIn[], leadIdx: number): Cell[][] {
  const out: Cell[][] = [];
  const walk = (i: number, acc: Cell[]) => {
    if (i >= seq.length) {
      out.push(acc);
      return;
    }
    walk(i + 1, [...acc, { items: [i], aspect: seq[i].aspect }]);
    if (i + 1 < seq.length && i !== leadIdx && i + 1 !== leadIdx) {
      walk(i + 2, [...acc, { items: [i, i + 1], aspect: stackAspect(seq[i].aspect, seq[i + 1].aspect) }]);
    }
  };
  walk(0, []);
  return out;
}

function evalSeq(seq: ClipIn[], area: { w: number; h: number }, leadIdx: number): Layout | null {
  let best: Layout | null = null;
  for (const cells of cellPatterns(seq, leadIdx)) {
    const n = cells.length;
    // every way to cut the cells into consecutive rows
    for (let mask = 0; mask < 1 << (n - 1); mask++) {
      const rows: number[][] = [[0]];
      for (let i = 1; i < n; i++) {
        if (mask & (1 << (i - 1))) rows.push([i]);
        else rows[rows.length - 1].push(i);
      }
      const heights = rows.map((r) => (area.w - (r.length - 1) * GUTTER) / r.reduce((sum, i) => sum + cells[i].aspect, 0));
      const avail = area.h - (rows.length - 1) * GUTTER;
      const scale = avail / heights.reduce((sum, h) => sum + h, 0);
      if (scale < SCALE_MIN) continue; // too much content for this grouping
      const sc = Math.min(scale, SCALE_MAX);
      // padding area: how much of the page is not covered by the images themselves
      let shown = 0;
      let cost = Math.abs(Math.log(scale)) * 6;
      if (scale > SCALE_MAX) cost += (scale - SCALE_MAX) * 40;
      let leadArea = 0;
      let maxOther = 0;
      rows.forEach((r, ri) => {
        const h = heights[ri] * sc;
        if (h < MIN_ROW_H) cost += (MIN_ROW_H - h) * 0.4;
        if (r.length > 4) cost += (r.length - 4) * 3;
        for (const ci of r) {
          const cell = cells[ci];
          const w = heights[ri] * cell.aspect;
          // the cell is w x h; its images fill min(w, h*aspect) x min(h, w/aspect)
          const fit = Math.min(w / (h * cell.aspect), 1) * Math.min((h * cell.aspect) / w, 1);
          shown += w * h * fit;
          for (const it of cell.items) {
            // do not stretch a small image far beyond its native size
            const hh = cell.items.length === 1 ? h : (h - GUTTER) * ((1 / seq[it].aspect) / cell.items.reduce((sum, k) => sum + 1 / seq[k].aspect, 0));
            const dpiHere = seq[it].pxWidth / (Math.min(w, hh * seq[it].aspect) / 25.4);
            if (dpiHere < DPI_SOFT) cost += (DPI_SOFT - dpiHere) * 0.35;
            const share = cell.items.length === 1 ? 1 : (1 / seq[it].aspect) / cell.items.reduce((sum, k) => sum + 1 / seq[k].aspect, 0);
            const a = w * h * fit * share;
            if (it === leadIdx) leadArea = a;
            else maxOther = Math.max(maxOther, a);
          }
        }
      });
      cost += (1 - shown / (area.w * area.h)) * 30; // wasted space
      if (leadIdx >= 0 && maxOther > leadArea) cost += 25; // the lead must be the biggest block
      if (!best || cost < best.cost) best = { cells, rows, scale, cost };
    }
  }
  return best;
}

/** Small deterministic PRNG so the same upload always gives the same page. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function permutations<T>(a: T[]): T[][] {
  if (a.length <= 1) return [a];
  const out: T[][] = [];
  a.forEach((x, i) => {
    for (const p of permutations([...a.slice(0, i), ...a.slice(i + 1)])) out.push([x, ...p]);
  });
  return out;
}

function orders<T extends { aspect: number }>(items: T[]): T[][] {
  if (items.length <= 5) return permutations(items);
  const out: T[][] = [items, [...items].sort((x, y) => y.aspect - x.aspect), [...items].sort((x, y) => x.aspect - y.aspect)];
  const rand = rng(items.length * 7919);
  for (let k = 0; k < 150; k++) {
    const c = [...items];
    for (let i = c.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [c[i], c[j]] = [c[j], c[i]];
    }
    out.push(c);
  }
  return out;
}

function arrange(lead: ClipIn | undefined, general: ClipIn[], pos: LeadPosition): ClipIn[][] {
  return orders(general).map((g) => {
    if (!lead) return g;
    if (pos === "top") return [lead, ...g];
    if (pos === "bottom") return [...g, lead];
    const mid = Math.floor(g.length / 2);
    return [...g.slice(0, mid), lead, ...g.slice(mid)];
  });
}

function bestLayout(lead: ClipIn | undefined, general: ClipIn[], pos: LeadPosition, area: { w: number; h: number }) {
  let best: { seq: ClipIn[]; layout: Layout } | null = null;
  for (const seq of arrange(lead, general, pos)) {
    const leadIdx = lead ? seq.findIndex((c) => c.id === lead.id) : -1;
    const layout = evalSeq(seq, area, leadIdx);
    if (layout && (!best || layout.cost < best.layout.cost)) best = { seq, layout };
  }
  return best;
}

function toPlaced(seq: ClipIn[], layout: Layout, area: { w: number; h: number }): { placed: Placed[]; blankMm: number } {
  const placed: Placed[] = [];
  const { cells, rows } = layout;
  const s = Math.min(layout.scale, SCALE_MAX);
  let y = 0;
  rows.forEach((r, ri) => {
    const natural = (area.w - (r.length - 1) * GUTTER) / r.reduce((sum, i) => sum + cells[i].aspect, 0);
    const h = natural * s;
    let x = 0;
    for (const ci of r) {
      const cell = cells[ci];
      const w = natural * cell.aspect;
      if (cell.items.length === 1) {
        const it = cell.items[0];
        const shown = Math.min(w, h * seq[it].aspect);
        placed.push({ id: seq[it].id, x, y, w, h, row: ri + 1, dpi: Math.round(seq[it].pxWidth / (shown / 25.4)) });
      } else {
        // two clippings stacked: split the height in proportion to their natural heights
        const [i1, i2] = cell.items;
        const h1n = 1 / seq[i1].aspect;
        const h2n = 1 / seq[i2].aspect;
        const avail = h - GUTTER;
        const h1 = (avail * h1n) / (h1n + h2n);
        const h2 = avail - h1;
        for (const [it, hh, yy] of [[i1, h1, y], [i2, h2, y + h1 + GUTTER]] as const) {
          const shown = Math.min(w, hh * seq[it].aspect);
          placed.push({ id: seq[it].id, x, y: yy, w, h: hh, row: ri + 1, dpi: Math.round(seq[it].pxWidth / (shown / 25.4)) });
        }
      }
      x += w + GUTTER;
    }
    y += h + GUTTER;
  });
  return { placed, blankMm: Math.max(0, area.h - (y - GUTTER)) };
}

/**
 * Place the clippings. Front page = lead + general (as many as fit at a readable size);
 * everything marked Inside, plus any general that does not fit, goes to inside pages.
 */
export function packClippings(clips: ClipIn[], leadPosition: LeadPosition = "top"): PackResult {
  const warnings: PackWarning[] = [];
  const why: Record<string, string> = {};
  const byId = new Map(clips.map((c) => [c.id, c]));
  const leads = clips.filter((c) => c.priority === "lead");
  const lead = leads[0];
  if (leads.length > 1) {
    warnings.push({ kind: "lead", text: `${leads.length} clippings are marked Lead. Only "${lead.name}" is used as the lead; the others are treated as General.` });
  }
  let general = clips.filter((c) => c.priority === "general" || (c.priority === "lead" && c !== lead));
  const inside = clips.filter((c) => c.priority === "inside");
  const pages: PackedPage[] = [];

  // ---- front page ----
  const front: { lead?: ClipIn; general: ClipIn[] } = { lead, general: [...general] };
  let frontBest = front.lead || front.general.length ? bestLayout(front.lead, front.general, leadPosition, FRONT_AREA) : null;
  while (!frontBest && (front.general.length || front.lead)) {
    // too much for one page: move the last general clipping inside
    const moved = front.general.pop();
    if (!moved) break;
    inside.unshift(moved);
    warnings.push({ kind: "moved", id: moved.id, text: `"${moved.name}" did not fit on page 1 at a readable size and was moved inside.` });
    why[moved.id] = "Moved to an inside page because page 1 was full.";
    frontBest = bestLayout(front.lead, front.general, leadPosition, FRONT_AREA);
  }
  if (frontBest) {
    const { placed, blankMm } = toPlaced(frontBest.seq, frontBest.layout, FRONT_AREA);
    pages.push({ number: 1, kind: "front", areaW: FRONT_AREA.w, areaH: FRONT_AREA.h, placed, blankMm });
    for (const p of placed) {
      const c = byId.get(p.id)!;
      if (c === lead) {
        const where = leadPosition === "top" ? "at the top" : leadPosition === "bottom" ? "at the bottom" : "in the middle";
        why[c.id] = `Lead: placed ${where} of page 1 (row ${p.row}) as the largest block.`;
      } else if (!why[c.id]) why[c.id] = `General: placed on page 1, row ${p.row}.`;
    }
  }
  general = front.general;

  // ---- inside pages: fill each page with as many as fit ----
  let rest = [...inside];
  let num = pages.length + 1;
  while (rest.length) {
    let take = rest.length;
    let best = bestLayout(undefined, rest.slice(0, take), "top", INSIDE_AREA);
    while (!best && take > 1) {
      take--;
      best = bestLayout(undefined, rest.slice(0, take), "top", INSIDE_AREA);
    }
    if (!best) {
      // a single clipping always has a layout, but guard against an endless loop
      best = bestLayout(undefined, [rest[0]], "top", INSIDE_AREA);
      take = 1;
    }
    const { placed, blankMm } = toPlaced(best!.seq, best!.layout, INSIDE_AREA);
    pages.push({ number: num, kind: "inside", areaW: INSIDE_AREA.w, areaH: INSIDE_AREA.h, placed, blankMm });
    for (const p of placed) {
      if (!why[p.id]) why[p.id] = `Inside: placed on page ${num}, row ${p.row}.`;
    }
    rest = rest.slice(take);
    num++;
  }

  // ---- honest checks ----
  const soft: { name: string; dpi: number }[] = [];
  for (const pg of pages) {
    if (pg.blankMm >= 40) {
      warnings.push({ kind: "blank", page: pg.number, text: `Page ${pg.number} has about ${Math.round(pg.blankMm)} mm of empty space at the bottom. Add more clippings to fill it.` });
    }
    for (const p of pg.placed) {
      const c = byId.get(p.id)!;
      if (p.dpi < DPI_WARN) soft.push({ name: c.name, dpi: p.dpi });
      if (c.aspect < 0.5) {
        warnings.push({ kind: "tall", id: c.id, page: pg.number, text: `"${c.name}" is a very tall, narrow clipping, so the rest of its row is shorter than usual.` });
      }
    }
  }
  if (soft.length) {
    const worst = soft.reduce((m, x) => (x.dpi < m.dpi ? x : m));
    warnings.unshift({
      kind: "dpi",
      text: `${soft.length} of ${clips.length} clippings are below 150 dpi at this size, so they may print slightly soft (lowest: "${worst.name}", about ${worst.dpi} dpi). Larger source images print sharper.`,
    });
  }
  if (!pages.length) warnings.push({ kind: "blank", text: "There is nothing to place yet." });
  return { pages, warnings, why };
}
