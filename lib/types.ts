export type Article = {
  id: string;
  headline: string;
  subhead?: string;
  bullets?: string[];
  body: string; // paragraphs separated by blank line
  section?: string; // e.g. "general", "editorial"
  importance?: number; // 1-10, higher = bigger story
  dateline?: string;
  image?: { path: string; caption?: string };
};

export type EditionConfig = {
  paperName: string;
  paperNameEn: string;
  tagline: string;
  date: string; // display string
  issue: string;
  volume: string;
  price: string;
};

export type Slot = "lead" | "side" | "teaser" | "mid";

export type PlacedStory = {
  article: Article;
  slot: Slot | "main" | "rail";
  jumpToPage?: number; // front stories: continues on this page
  fromPage?: number; // rail stories: continued from this page
};

export type PagePlan = {
  number: number;
  kind: "front" | "inside";
  section: string;
  stories: PlacedStory[];
};

/** Geometry/metrics the Proof screen needs, all in % of the page box. */
export type ProofBox = { x: number; y: number; w: number; h: number };
export type ProofPage = {
  number: number;
  section: string;
  stories: (ProofBox & { id: string })[];
  links: (ProofBox & { to: number; kind: "jump" | "from" })[];
  gapMm: number;
  gap?: ProofBox;
};
export type BuildStage = "place" | "check" | "pdf";
