import sample from "@/samples/articles.json";

// Imported at build time so it also works where there is no file system (Cloudflare Workers).
export async function GET() {
  return Response.json(sample);
}
