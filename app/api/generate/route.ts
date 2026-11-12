import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { runEditorBrain, AI_MODEL, type AiEdit } from "@/lib/ai/editorBrain";
import { planEdition } from "@/lib/editor/plan";
import { GENERATION_UNAVAILABLE, cfEnv, onCloudflare } from "@/lib/runtime";
import { SAMPLE_IMAGES } from "@/lib/render/embedded.generated";
import type { ProofPage } from "@/lib/types";
import type { Article, EditionConfig } from "@/lib/types";

export const maxDuration = 120;

type Incoming = {
  id: string;
  headline: string;
  section?: string;
  importance?: number;
  bullets?: string[];
  body: string;
  dateline?: string;
  imageCaption?: string;
  imagePath?: string; // only allowed for bundled samples
};

const GAP_WARN_MM = 60;

const safeExt = (name: string) => {
  const e = path.extname(name).toLowerCase();
  return [".png", ".jpg", ".jpeg", ".webp", ".svg"].includes(e) ? e : ".png";
};

/** NDJSON stream: {"step":...} progress lines, then one {"result":...} or {"error":...}. */
export async function POST(req: Request) {
  const form = await req.formData();
  const payload = JSON.parse(String(form.get("payload") ?? "{}")) as { config: EditionConfig; articles: Incoming[]; ai?: boolean };

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      try {
        const cf = onCloudflare();
        const env = cf ? cfEnv() : undefined;
        if (cf && !(env?.BROWSER && env.OUT)) throw new Error(GENERATION_UNAVAILABLE);
        if (!payload.articles?.length) throw new Error("Add at least one story.");

        const job = randomUUID();
        const dir = path.join(process.cwd(), "out", "jobs", job);
        if (!cf) fs.mkdirSync(dir, { recursive: true });

        const articles: Article[] = [];
        let photos = 0;
        for (const [i, a] of payload.articles.entries()) {
          if (!/^[\w-]+$/.test(a.id)) continue;
          let body = a.body ?? "";
          const docx = form.get(`docx_${a.id}`);
          if (docx instanceof File && docx.size) {
            const mammoth = (await import("mammoth")).default;
            const { value } = await mammoth.extractRawText({ buffer: Buffer.from(await docx.arrayBuffer()) });
            body = value.trim();
          }
          // With the AI editor on, a story only needs text: the AI writes the headline.
          if (!body.trim() || (!a.headline?.trim() && !payload.ai)) continue;

          let image: Article["image"];
          const img = form.get(`image_${a.id}`);
          if (img instanceof File && img.size) {
            const buf = Buffer.from(await img.arrayBuffer());
            const ext = safeExt(img.name);
            if (cf) {
              // No disk on Workers: inline the photo as a data URI.
              const mime = ext === ".svg" ? "image/svg+xml" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : `image/${ext.slice(1)}`;
              image = { path: `data:${mime};base64,${buf.toString("base64")}`, caption: a.imageCaption };
            } else {
              const p = path.join(dir, `img${i + 1}${ext}`);
              fs.writeFileSync(p, buf);
              image = { path: p, caption: a.imageCaption };
            }
          } else if (a.imagePath && SAMPLE_IMAGES[a.imagePath]) {
            image = { path: a.imagePath, caption: a.imageCaption };
          }
          if (image) photos++;

          articles.push({
            id: a.id,
            headline: (a.headline ?? "").trim(),
            section: a.section?.trim() || "general",
            importance: Math.min(10, Math.max(1, Number(a.importance) || 5)),
            bullets: a.bullets?.filter((b) => b.trim()),
            body,
            dateline: a.dateline?.trim() || undefined,
            image,
          });
        }
        if (!articles.length) throw new Error(payload.ai ? "Each story needs text." : "Each story needs a headline and text.");
        send({ step: "read", detail: `${articles.length} ${articles.length === 1 ? "story" : "stories"} and ${photos} ${photos === 1 ? "photo" : "photos"} read.` });

        // Optional AI editor: the model sets section/importance and writes headlines and key points.
        let edited = articles;
        let aiEdits: AiEdit[] = [];
        let aiError: string | undefined;
        if (payload.ai) {
          try {
            const r = await runEditorBrain(articles);
            edited = r.articles;
            aiEdits = r.edits;
            send({ step: "ai", detail: `The AI edited ${aiEdits.length} ${aiEdits.length === 1 ? "story" : "stories"}.` });
          } catch (e) {
            aiError = e instanceof Error ? e.message : "The AI editor failed.";
            send({ step: "ai", detail: `Skipped: ${aiError}` });
          }
          if (edited.some((a) => !a.headline.trim())) {
            throw new Error(`The AI editor could not run (${aiError ?? "no answer"}), and some stories have no headline. Add headlines or try again.`);
          }
        }

        const plan = planEdition(edited);
        const lead = plan[0].stories.find((s) => s.slot === "lead")?.article;
        if (lead) {
          send({
            step: "lead",
            headline: lead.headline,
            detail: `Importance ${lead.importance ?? 5}${lead.image ? ", has a photo" : ""}${lead.dateline ? " and a dateline" : ""}.`,
          });
        }

        let res: { report: string[]; layout: ProofPage[]; jumpIds: string[]; trimmed: { id: string; page: number }[] };
        const pdfUrl = `/api/files/${job}/edition.pdf`;
        let previewUrls: string[];
        if (cf) {
          const { buildEditionOnCloudflare } = await import("@/lib/render/cfBuild");
          const built = await buildEditionOnCloudflare(env!.BROWSER as never, plan, payload.config, (stage) => send({ step: stage }));
          const bucket = env!.OUT!;
          await bucket.put(`jobs/${job}/edition.pdf`, built.pdf, { httpMetadata: { contentType: "application/pdf" } });
          await Promise.all(
            built.previews.map((png, i) => bucket.put(`jobs/${job}/edition-page${i + 1}.png`, png, { httpMetadata: { contentType: "image/png" } })),
          );
          previewUrls = built.previews.map((_, i) => `/api/files/${job}/edition-page${i + 1}.png`);
          res = built;
        } else {
          const { buildEdition } = await import("@/lib/render/pdf");
          const local = await buildEdition(plan, payload.config, dir, "edition", (stage) => send({ step: stage }));
          previewUrls = local.previews.map((p) => `/api/files/${job}/${path.basename(p)}`);
          res = local;
        }

        const byId = new Map(edited.map((a) => [a.id, a]));
        const warnings: { kind: "gap" | "trim"; page: number; text: string; mm?: number }[] = [];
        for (const pg of res.layout) {
          if (pg.gapMm >= GAP_WARN_MM) {
            warnings.push({ kind: "gap", page: pg.number, mm: pg.gapMm, text: `Page ${pg.number} has an empty gap of about ${pg.gapMm} mm.` });
          }
        }
        for (const t of res.trimmed) {
          warnings.push({ kind: "trim", page: t.page, text: `Part of a story did not fit on page ${t.page} and was cut.` });
        }

        const frontIds = new Set(plan[0].stories.map((s) => s.article.id));
        const insideCount = edited.length - frontIds.size;
        const why: string[] = [];
        const leadReason = aiEdits.find((e) => e.id === lead?.id)?.reason;
        if (leadReason) why.push(`AI editor on the lead: ${leadReason}`);
        else if (lead) {
          why.push(
            `The lead has the highest importance (${lead.importance ?? 5})${lead.image ? ", a photo" : ""}${lead.dateline ? " and a dateline" : ""}.`,
          );
        }
        const frontOthers = plan[0].stories.filter((s) => s.slot !== "lead").length;
        if (frontOthers) why.push(`The next ${frontOthers} stories by importance fill the front page teaser and mid slots.`);
        if (insideCount > 0) why.push(`${insideCount} ${insideCount === 1 ? "story" : "stories"} went inside, grouped by section.`);

        send({
          result: {
            job,
            pdf: pdfUrl,
            previews: previewUrls,
            pages: res.layout.map((l) => ({ ...l })),
            stories: edited.map((a) => ({ id: a.id, headline: a.headline, importance: a.importance, section: a.section })),
            leadId: lead?.id ?? null,
            jumpIds: res.jumpIds,
            warnings,
            why,
            overflowFree: res.trimmed.length === 0,
            storyCount: byId.size,
            ai: { ran: aiEdits.length > 0, model: AI_MODEL, error: aiError, edits: aiEdits },
          },
        });
      } catch (e) {
        send({ error: e instanceof Error ? e.message : "Render failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
