import { connection } from "next/server";
import { AI_MODEL, isAiConfigured } from "@/lib/ai/editorBrain";

// Read at request time: credentials can be added to the server without a rebuild.
export async function GET() {
  await connection();
  return Response.json({ configured: isAiConfigured(), model: AI_MODEL });
}
