import type { Article, PagePlan, PlacedStory, Slot } from "../types";

const INSIDE_CHAR_BUDGET = 9000; // rough body characters that fit a page's main area

/**
 * Heuristic chief-editor: rank by importance, fill the front page slots
 * (lead, side, 3 teasers, 2 mids), then pack the rest onto inside pages
 * grouped by section. Front-page teasers/mids/lead jump to page 2.
 */
export function planEdition(articles: Article[]): PagePlan[] {
  const ranked = [...articles].sort((a, b) => (b.importance ?? 5) - (a.importance ?? 5));

  const frontOrder: Slot[] = ["lead", "teaser", "teaser", "teaser", "mid", "mid", "side"];
  const front: PlacedStory[] = [];
  frontOrder.forEach((slot, i) => {
    const article = ranked[i];
    if (!article) return;
    front.push({ article, slot, jumpToPage: 2 });
  });
  const rest = ranked.slice(frontOrder.length);

  // group remaining by section, keep section order by first appearance
  const bySection = new Map<string, Article[]>();
  for (const a of rest) {
    const s = a.section ?? "general";
    bySection.set(s, [...(bySection.get(s) ?? []), a]);
  }

  const pages: PagePlan[] = [{ number: 1, kind: "front", section: "front", stories: front }];

  let pageNo = 2;
  for (const [section, list] of bySection) {
    let current: PlacedStory[] = [];
    let used = 0;
    const flush = () => {
      if (!current.length) return;
      pages.push({ number: pageNo++, kind: "inside", section, stories: current });
      current = [];
      used = 0;
    };
    for (const article of list) {
      const len = Math.min(article.body.length, 3200);
      if (used + len > INSIDE_CHAR_BUDGET && current.length) flush();
      current.push({ article, slot: "main" });
      used += len;
    }
    flush();
  }

  // Jump rail lives on page 2; make sure page 2 exists.
  if (!pages.find((p) => p.number === 2)) {
    pages.push({ number: 2, kind: "inside", section: "general", stories: [] });
  }
  pages.sort((a, b) => a.number - b.number);
  return pages;
}
