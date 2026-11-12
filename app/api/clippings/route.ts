import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { GENERATION_UNAVAILABLE, cfEnv, onCloudflare } from "@/lib/runtime";
import { imageInfo } from "@/lib/clippings/imageSize";
import { packClippings, type ClipIn, type LeadPosition, type Priority } from "@/lib/clippings/pack";
import { clippingsHtml } from "@/lib/clippings/html";
import type { EditionConfig } from "@/lib/types";

export const maxDuration = 120;

type Incoming = { id: string; name: string; priority: Priority };

const MAX_FILES = 24;
const MAX_BYTES = 15 * 1024 * 1024;

/** NDJSON stream: {"step":...} progress lines, then one {"result":...} or {"error":...}. */
export async function POST(req: Request) {
  const form = await req.formData();
  const payload = JSON.parse(String(form.get("payload") ?? "{}")) as { config: EditionConfig; clips: Incoming[]; leadPosition?: LeadPosition };

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      try {
        const cf = onCloudflare();
        const env = cf ? cfEnv() : undefined;
        if (cf && !(env?.BROWSER && env.OUT)) throw new Error(GENERATION_UNAVAILABLE);
        if (!payload.clips?.length) throw new Error("Add at least one clipping.");
        if (payload.clips.length > MAX_FILES) throw new Error(`Please add at most ${MAX_FILES} clippings at a time.`);

        const clips: ClipIn[] = [];
        const images: { id: string; dataUri: string }[] = [];
        for (const c of payload.clips) {
          if (!/^[\w-]+$/.test(c.id)) continue;
          const f = form.get(`image_${c.id}`);
          if (!(f instanceof File) || !f.size) continue;
          if (f.size > MAX_BYTES) throw new Error(`"${c.name}" is larger than 15 MB.`);
          const buf = new Uint8Array(await f.arrayBuffer());
          const info = imageInfo(buf);
          if (!info || !info.width || !info.height) throw new Error(`"${c.name}" is not a PNG, JPEG or WebP image.`);
          const priority: Priority = c.priority === "lead" || c.priority === "inside" ? c.priority : "general";
          clips.push({ id: c.id, name: c.name, aspect: info.width / info.height, pxWidth: info.width, priority });
          images.push({ id: c.id, dataUri: `data:${info.mime};base64,${Buffer.from(buf).toString("base64")}` });
        }
        if (!clips.length) throw new Error("None of the clippings could be read.");
        send({ step: "read", detail: `${clips.length} ${clips.length === 1 ? "clipping" : "clippings"} read.` });

        const leadPosition: LeadPosition = ["top", "middle", "bottom"].includes(payload.leadPosition ?? "") ? payload.leadPosition! : "top";
        const lead = clips.find((c) => c.priority === "lead");
        send({ step: "lead", headline: lead?.name ?? "", detail: lead ? `Lead goes ${leadPosition === "top" ? "at the top" : leadPosition === "middle" ? "in the middle" : "at the bottom"}.` : "No lead chosen; all clippings are treated equally." });

        const packed = packClippings(clips, leadPosition);
        send({ step: "place", detail: `${packed.pages.length} ${packed.pages.length === 1 ? "page" : "pages"} laid out.` });
        const html = clippingsHtml(packed.pages, payload.config, images);

        const job = randomUUID();
        let previewUrls: string[];
        if (cf) {
          const { buildClippingsOnCloudflare } = await import("@/lib/render/cfBuild");
          const built = await buildClippingsOnCloudflare(env!.BROWSER as never, html, (s) => send({ step: s }));
          const bucket = env!.OUT!;
          await bucket.put(`jobs/${job}/edition.pdf`, built.pdf, { httpMetadata: { contentType: "application/pdf" } });
          await Promise.all(built.previews.map((png, i) => bucket.put(`jobs/${job}/edition-page${i + 1}.png`, png, { httpMetadata: { contentType: "image/png" } })));
          previewUrls = built.previews.map((_, i) => `/api/files/${job}/edition-page${i + 1}.png`);
        } else {
          const dir = path.join(process.cwd(), "out", "jobs", job);
          fs.mkdirSync(dir, { recursive: true });
          const { buildClippingsLocal } = await import("@/lib/render/pdf");
          const local = await buildClippingsLocal(html, dir, "edition", (s) => send({ step: s }));
          previewUrls = local.previews.map((p) => `/api/files/${job}/${path.basename(p)}`);
        }

        send({
          result: {
            job,
            pdf: `/api/files/${job}/edition.pdf`,
            previews: previewUrls,
            pages: packed.pages.map((p) => ({
              number: p.number,
              kind: p.kind,
              blankMm: Math.round(p.blankMm),
              placed: p.placed.map((c) => ({ id: c.id, row: c.row, dpi: c.dpi })),
            })),
            clips: clips.map((c) => ({ id: c.id, name: c.name, priority: c.priority })),
            warnings: packed.warnings,
            why: packed.why,
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
