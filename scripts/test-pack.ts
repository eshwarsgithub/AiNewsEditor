import { packClippings, type ClipIn, type LeadPosition } from "../lib/clippings/pack";

const mk = (id: string, w: number, h: number, priority: ClipIn["priority"]): ClipIn => ({ id, name: id, aspect: w / h, pxWidth: w, priority });
const clips = [
  mk("kavita", 505, 537, "general"),
  mk("rahul", 505, 490, "general"),
  mk("jobs", 505, 540, "general"),
  mk("mamata", 265, 664, "general"),
  mk("sonia", 505, 566, "general"),
  mk("revanth", 780, 535, "lead"),
];
for (const pos of ["top", "middle", "bottom"] as LeadPosition[]) {
  const r = packClippings(clips, pos);
  console.log("\n== lead", pos);
  for (const p of r.pages) {
    console.log(`page ${p.number} blank ${p.blankMm.toFixed(1)}mm`);
    for (const c of p.placed) console.log(`  ${c.id.padEnd(8)} row${c.row} x${c.x.toFixed(0)} y${c.y.toFixed(0)} ${c.w.toFixed(0)}x${c.h.toFixed(0)} dpi${c.dpi}`);
  }
  console.log(r.warnings.map((w) => w.kind).join(","));
}
const inside = packClippings([...clips.slice(0, 5), { ...clips[5], priority: "inside" }, mk("extra", 600, 500, "lead")], "top");
console.log("\n== with inside:", inside.pages.map((p) => `${p.number}:${p.placed.map((c) => c.id).join("+")}`).join(" | "));
console.log(inside.warnings.map((w) => w.text));
