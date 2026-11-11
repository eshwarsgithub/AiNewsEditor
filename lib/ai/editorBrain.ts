import { z } from "zod";
import type { Article } from "../types";

/**
 * Cheapest model with good Indic-language output and structured-output support on OpenRouter
 * ($0.10 / $0.40 per million tokens). Override with OPENROUTER_MODEL.
 */
export const AI_MODEL = process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash-lite";
const BASE_URL = (process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/$/, "");

export const SECTION_IDS = ["general", "editorial", "sports", "business", "cinema"] as const;

export const openRouterKey = (): string | undefined => process.env.OPENROUTER_API_KEY || undefined;

export const isAiConfigured = () => Boolean(openRouterKey());

const StoryEdit = z.object({
  id: z.string(),
  section: z.enum(SECTION_IDS),
  importance: z.number().int(),
  headline: z.string(),
  keypoints: z.array(z.string()),
  reason: z.string(),
});
const EditorOutput = z.object({ stories: z.array(StoryEdit) });
type EditorOutputT = z.infer<typeof EditorOutput>;

export type AiEdit = {
  id: string;
  section: (typeof SECTION_IDS)[number];
  importance: number;
  headline: string;
  originalHeadline: string;
  keypoints: string[];
  reason: string;
};

const SYSTEM = `You are the chief editor of a daily newspaper, preparing the stories for page layout. The paper is printed in Telugu (some stories may be in English or mixed).

For every story you are given, decide:
- section: one of ${SECTION_IDS.join(", ")}. Use "editorial" only for opinion or editorial pieces.
- importance: an integer from 1 to 10 for page placement. 9-10 is the lead story of the front page (use it for at most one or two stories in the whole edition), 6-8 is front-page news, 1-5 is inside pages. Judge by public significance, who is involved, and how many readers it affects. Compare the stories against each other and use the full range.
- headline: a print headline written in the same language as the story. If the editor's draft headline is already accurate and short enough for print, keep it exactly as written. Otherwise write a tighter one: at most about 12 words, factual, no clickbait, no invented facts.
- keypoints: 3 to 5 short bullet points in the same language as the story, each under about 14 words, each stating one fact that is in the story. Never add facts that are not in the text.
- reason: one short sentence in English explaining the importance you chose, for the human editor to review.

Rules: only use facts from the story text. Do not translate a story into another language. Return one entry for every story id you were given, with the id copied exactly. Answer with JSON only.`;

type Input = { id: string; draft_headline: string; section_hint: string; importance_hint: number; dateline: string; text: string };

/** Pure: merge the model's decisions into the stories. Unknown ids are ignored; blank fields keep the editor's value. */
export function applyEdits(articles: Article[], parsed: EditorOutputT): { articles: Article[]; edits: AiEdit[] } {
  const byId = new Map(parsed.stories.map((s) => [s.id, s]));
  const edits: AiEdit[] = [];
  const out = articles.map((a) => {
    const e = byId.get(a.id);
    if (!e) return a;
    const headline = e.headline.trim() || a.headline;
    const keypoints = e.keypoints.map((k) => k.trim()).filter(Boolean).slice(0, 5);
    const importance = Math.min(10, Math.max(1, Math.round(e.importance)));
    edits.push({
      id: a.id,
      section: e.section,
      importance,
      headline,
      originalHeadline: a.headline,
      keypoints,
      reason: e.reason.trim(),
    });
    return { ...a, headline, section: e.section, importance, bullets: keypoints.length ? keypoints : a.bullets };
  });
  return { articles: out, edits };
}

/** Some models wrap JSON in a code fence even when asked for plain JSON. */
function extractJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(t);
}

/** One request with every story, so the model can rank them against each other. Throws on any failure. */
export async function runEditorBrain(articles: Article[]): Promise<{ articles: Article[]; edits: AiEdit[] }> {
  const key = openRouterKey();
  if (!key) throw new Error("No OpenRouter key is set on the server (OPENROUTER_API_KEY).");

  const stories: Input[] = articles.map((a) => ({
    id: a.id,
    draft_headline: a.headline,
    section_hint: a.section ?? "general",
    importance_hint: a.importance ?? 5,
    dateline: a.dateline ?? "",
    text: a.body,
  }));

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(90_000),
      body: JSON.stringify({
        model: AI_MODEL,
        temperature: 0.3,
        max_tokens: 8000,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `Stories for this edition (JSON):\n${JSON.stringify(stories)}` },
        ],
        // Strict schema, and only route to providers that actually honour it.
        response_format: {
          type: "json_schema",
          json_schema: { name: "editor_output", strict: true, schema: z.toJSONSchema(EditorOutput) },
        },
        provider: { require_parameters: true },
      }),
    });
  } catch (e) {
    if (e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError")) {
      throw new Error("The AI service took too long to answer.");
    }
    throw new Error("Could not reach the AI service.");
  }

  if (!res.ok) {
    if (res.status === 401) throw new Error("The OpenRouter key was rejected.");
    if (res.status === 402) throw new Error("The OpenRouter account is out of credit.");
    if (res.status === 429) throw new Error("The AI service is rate limited. Try again shortly.");
    throw new Error(`The AI service returned an error (${res.status}).`);
  }

  const data = (await res.json()) as {
    choices?: { finish_reason?: string; message?: { content?: string | null; refusal?: string | null } }[];
    error?: { message?: string };
  };
  const choice = data.choices?.[0];
  if (!choice) throw new Error(data.error?.message ? `The AI service said: ${data.error.message}` : "The AI service sent no answer.");
  if (choice.message?.refusal) throw new Error("The model declined to edit these stories.");
  if (choice.finish_reason === "length") throw new Error("The model's answer was cut off.");
  if (!choice.message?.content) throw new Error("The AI service sent an empty answer.");

  let parsed: EditorOutputT;
  try {
    parsed = EditorOutput.parse(extractJson(choice.message.content));
  } catch {
    throw new Error("The model's answer could not be read.");
  }
  return applyEdits(articles, parsed);
}
