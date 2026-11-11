// Run from the project root:  npx tsx spikes/cf-pdf/make-payload.ts
import fs from "node:fs";
import { planEdition } from "../../lib/editor/plan";
import { documentHtml } from "../../lib/render/html";

const data = JSON.parse(fs.readFileSync("samples/articles.json", "utf8"));
const pages = planEdition(data.articles);
const html = documentHtml(pages, data.config);
fs.writeFileSync("spikes/cf-pdf/payload.json", JSON.stringify({ pages, html }));
console.log("payload bytes:", fs.statSync("spikes/cf-pdf/payload.json").size, "| pages:", pages.length);
