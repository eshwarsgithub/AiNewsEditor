import type { ProofPage } from "@/lib/types";

export type Draft = {
  key: string;
  open: boolean;
  headline: string;
  section: string;
  importance: number;
  keypoints: string;
  body: string;
  dateline: string;
  caption: string;
  imagePath?: string; // bundled sample photo
  imageFile?: File;
  docxFile?: File;
};

export type Config = {
  paperName: string;
  paperNameEn: string;
  tagline: string;
  date: string;
  issue: string;
  volume: string;
  price: string;
};

export type StepKey = "read" | "ai" | "lead" | "place" | "check" | "pdf";

export type ProofResult = {
  job: string;
  pdf: string;
  previews: string[];
  pages: ProofPage[];
  stories: { id: string; headline: string; importance: number; section: string }[];
  leadId: string | null;
  jumpIds: string[];
  warnings: { kind: "gap" | "trim"; page: number; text: string; mm?: number }[];
  why: string[];
  overflowFree: boolean;
  storyCount: number;
  ai?: {
    ran: boolean;
    model?: string;
    error?: string;
    edits: {
      id: string;
      section: string;
      importance: number;
      headline: string;
      originalHeadline: string;
      keypoints: string[];
      reason: string;
    }[];
  };
};

export const SECTIONS: { value: string; label: string; te: string }[] = [
  { value: "general", label: "General", te: "సాధారణం" },
  { value: "editorial", label: "Editorial", te: "సంపాదకీయం" },
  { value: "sports", label: "Sports", te: "క్రీడలు" },
  { value: "business", label: "Business", te: "వ్యాపారం" },
  { value: "cinema", label: "Cinema", te: "సినిమా" },
];

export type Zone = "Lead" | "Front page" | "Inside";
export const zoneOf = (n: number): Zone => (n >= 9 ? "Lead" : n >= 6 ? "Front page" : "Inside");

export const ZONE_HINT: Record<Zone, string> = {
  Lead: "The lead takes the top of page 1 with the largest headline and photo.",
  "Front page": "Competes for a place on page 1. Stronger stories sit higher.",
  Inside: "Placed on inside pages. Continues from page 1 only if needed.",
};

export const newDraft = (over: Partial<Draft> = {}): Draft => ({
  key: crypto.randomUUID(),
  open: true,
  headline: "",
  section: "general",
  importance: 5,
  keypoints: "",
  body: "",
  dateline: "",
  caption: "",
  ...over,
});

export const emptyConfig: Config = {
  paperName: "వసుధైక తెలంగాణ",
  paperNameEn: "Vasudhaika Telangana",
  tagline: "",
  date: "",
  issue: "",
  volume: "",
  price: "",
};
