import fs from "node:fs";
import path from "node:path";

export async function GET() {
  const raw = fs.readFileSync(path.join(process.cwd(), "samples", "articles.json"), "utf8");
  return new Response(raw, { headers: { "content-type": "application/json" } });
}
