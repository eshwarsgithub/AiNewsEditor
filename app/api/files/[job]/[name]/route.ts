import fs from "node:fs";
import path from "node:path";

const types: Record<string, string> = { ".pdf": "application/pdf", ".png": "image/png" };

export async function GET(_req: Request, ctx: RouteContext<"/api/files/[job]/[name]">) {
  const { job, name } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(job) || !/^edition(-page\d+)?\.(pdf|png)$/.test(name)) {
    return new Response("Not found", { status: 404 });
  }
  const file = path.join(process.cwd(), "out", "jobs", job, name);
  if (!fs.existsSync(file)) return new Response("Not found", { status: 404 });
  return new Response(fs.readFileSync(file), {
    headers: {
      "content-type": types[path.extname(name)],
      "content-disposition": name.endsWith(".pdf") ? `inline; filename="newspaper.pdf"` : "inline",
    },
  });
}
