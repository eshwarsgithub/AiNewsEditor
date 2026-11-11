import fs from "node:fs";
import path from "node:path";

const fontDir = (pkg: string) => path.join(process.cwd(), "node_modules/@fontsource", pkg, "files");

function face(family: string, pkg: string, file: string, weight: number) {
  const buf = fs.readFileSync(path.join(fontDir(pkg), file));
  return `@font-face{font-family:"${family}";font-weight:${weight};font-style:normal;src:url(data:font/woff2;base64,${buf.toString("base64")}) format("woff2");}`;
}

// Fonts are embedded as base64 so the renderer is fully offline and PDF-embeddable.
export function fontCss() {
  return [
    face("Anek Telugu", "anek-telugu", "anek-telugu-telugu-400-normal.woff2", 400),
    face("Anek Telugu", "anek-telugu", "anek-telugu-telugu-800-normal.woff2", 800),
    face("Anek Telugu Latin", "anek-telugu", "anek-telugu-latin-400-normal.woff2", 400),
    face("Anek Telugu Latin", "anek-telugu", "anek-telugu-latin-800-normal.woff2", 800),
    face("Noto Serif Telugu", "noto-serif-telugu", "noto-serif-telugu-telugu-400-normal.woff2", 400),
    face("Noto Serif Telugu", "noto-serif-telugu", "noto-serif-telugu-telugu-700-normal.woff2", 700),
    face("Noto Serif Telugu Latin", "noto-serif-telugu", "noto-serif-telugu-latin-400-normal.woff2", 400),
    face("Noto Serif Telugu Latin", "noto-serif-telugu", "noto-serif-telugu-latin-700-normal.woff2", 700),
  ].join("\n");
}

// Broadsheet 340 x 540 mm (matches the pilot sample), 6 columns.
export const PAGE_W = 340;
export const PAGE_H = 540;

export const pageCss = `
@page { size: ${PAGE_W}mm ${PAGE_H}mm; margin: 0; }
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#fff}
body{font-family:"Noto Serif Telugu","Noto Serif Telugu Latin",serif;color:#111;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.hl,.masthead,.infobar,.jump,.strip{font-family:"Anek Telugu","Anek Telugu Latin",sans-serif}

.page{width:${PAGE_W}mm;height:${PAGE_H}mm;padding:9mm 10mm 14mm;display:flex;flex-direction:column;gap:3mm;page-break-after:always;overflow:hidden;position:relative;background:#fff}

/* ---- front masthead ---- */
.masthead{display:flex;flex-direction:column;align-items:center;justify-content:center;height:62mm;text-align:center;border-bottom:0.4mm solid #111}
.masthead .name{font-weight:800;font-size:76pt;line-height:1.15;color:#1b2a6b;letter-spacing:-0.5pt}
.masthead .en{font-weight:800;font-size:15pt;letter-spacing:1pt;margin-top:1mm}
.infobar{background:#111;color:#fff;display:flex;justify-content:space-between;align-items:center;height:11mm;padding:0 6mm;font-size:13pt;font-weight:400}

/* ---- front rows ---- */
.rows{flex:1;min-height:0;display:flex;flex-direction:column;gap:3mm}
.row{display:flex;gap:3mm;min-height:0}
.row.r1{flex:30 1 0}.row.r2{flex:27 1 0}.row.r3{flex:43 1 0}

/* ---- story ---- */
.story{display:flex;flex-direction:column;min-height:0;min-width:0;overflow:hidden;padding:2.5mm 3mm;gap:1.6mm}
.story .hl{font-weight:800;line-height:1.28;text-align:center}
.story .sub{font-family:"Anek Telugu","Anek Telugu Latin",sans-serif;font-weight:400;font-size:12pt;line-height:1.3;text-align:center}
.story ul.bullets{list-style:none;font-family:"Anek Telugu","Anek Telugu Latin",sans-serif;font-weight:800;line-height:1.3}
.story ul.bullets li{display:flex;gap:2mm;margin-bottom:0.8mm}
.story ul.bullets li::before{content:"";flex:none;width:2.6mm;height:2.6mm;border-radius:50%;background:#111;margin-top:2.2mm}
.story .img{flex:0 1 var(--ih,40mm);min-height:14mm;display:flex;flex-direction:column;overflow:hidden}
.story .img img{display:block;width:100%;flex:1 1 0;min-height:0;object-fit:cover}
.story .img .cap{flex:none;font-size:7.5pt;line-height:1.3;padding-top:0.8mm;font-family:"Anek Telugu","Anek Telugu Latin",sans-serif}
.story .body{flex:1 1 0;min-height:0;overflow:hidden;font-size:9.3pt;line-height:1.42;text-align:justify;column-fill:auto;column-gap:3.2mm;column-rule:0.2mm solid #cfcfcf}
.story .body p{margin-bottom:1.2mm}
.story .dl{font-family:"Anek Telugu","Anek Telugu Latin",sans-serif;font-weight:800;font-size:8pt;color:#b3202a;text-align:center}
.story .jump{flex:none;font-weight:800;font-size:9pt;text-align:right;font-style:italic}
.story .from{font-family:"Anek Telugu","Anek Telugu Latin",sans-serif;font-weight:800;font-size:8pt;color:#b3202a;text-align:center}

/* slot sizing */
.slot-teaser{flex:1 1 0}
.slot-teaser .hl{font-size:19pt}.slot-teaser .body{column-count:2}.slot-teaser{--ih:34mm}
.slot-mid{flex:1 1 0}
.slot-mid .hl{font-size:24pt}.slot-mid .body{column-count:3}.slot-mid{--ih:34mm}
.slot-lead{flex:2 1 0}
.slot-lead .hl{font-size:34pt;color:#c2185b;line-height:1.22}.slot-lead .body{column-count:4}.slot-lead{--ih:60mm}
.slot-lead ul.bullets{font-size:13pt}
.slot-side{flex:1 1 0}
.slot-side .hl{font-size:22pt;color:#c2185b}.slot-side .body{column-count:2}.slot-side{--ih:40mm}
.slot-side ul.bullets{font-size:12pt}
.slot-teaser ul.bullets,.slot-mid ul.bullets{font-size:9.5pt}
.tone-0{background:#e5f1ea}.tone-1{background:#f1edf2}.tone-2{background:#f3f0e2}.tone-3{background:#fdf1d0}.tone-4{background:#f6e6e3}.tone-5{background:#fff}

/* ---- inside pages ---- */
.strip{display:flex;align-items:stretch;height:20mm;gap:4mm;border-bottom:0.4mm solid #111}
.strip .num{background:#7a1020;color:#fff;font-weight:800;font-size:34pt;width:20mm;display:flex;align-items:center;justify-content:center}
.strip .brand{display:flex;flex-direction:column;justify-content:center;flex:1}
.strip .brand .name{font-weight:800;font-size:30pt;color:#1b2a6b;line-height:1.1}
.strip .brand .en{font-weight:800;font-size:8pt}
.strip .sect{background:#111;color:#fff;padding:0 8mm;display:flex;flex-direction:column;justify-content:center;align-items:center;font-weight:800;font-size:14pt}
.strip .sect b{letter-spacing:6pt;font-size:13pt;color:#f3c64a}
.inside{flex:1;min-height:0;display:flex;gap:3mm}
.main{flex:1 1 0;min-width:0;display:flex;flex-direction:column;gap:3mm}
.rail{flex:0 0 112mm;display:flex;flex-direction:column;gap:2mm;background:#f2eee0;border-left:0.6mm solid #7a6a2b;padding:0 0 0 2mm}
.rail:empty{display:none}
.main .story{flex-basis:0;border-bottom:0.3mm solid #bbb}
.main .story .hl{font-size:32pt}
.main .story .body{column-count:4}
.has-rail .main .story .body{column-count:4}
.no-rail .main .story .body{column-count:6}
.main .story{--ih:48mm}
.main .story.has-img .body{}
.rail .story{flex-basis:0;padding:2mm 2mm}
.rail .story .hl{font-size:20pt}
.rail .story .body{column-count:1;font-size:8.8pt}

/* print registration bars */
.regbar{position:absolute;left:10mm;right:10mm;bottom:4mm;height:5mm;display:flex;gap:6mm;align-items:center}
.regbar i{display:block;height:5mm;width:6mm}
`;
