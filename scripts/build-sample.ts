import fs from "node:fs";
import { planEdition } from "../lib/editor/plan";
import { buildEdition } from "../lib/render/pdf";

const data = JSON.parse(fs.readFileSync(process.argv[2] ?? "samples/articles.json", "utf8"));
const plan = planEdition(data.articles);
for (const p of plan) console.log(`page ${p.number} [${p.section}]`, p.stories.map((s) => `${s.slot}:${s.article.id}`).join(", "));
(async () => {
  const res = await buildEdition(plan, data.config, "out", "edition");
  console.log(res.report.join("\n"));
  console.log("PDF:", res.pdfPath);
})();
