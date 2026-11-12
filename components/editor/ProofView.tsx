"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { zoneOf, type Config, type Draft, type ProofResult } from "./types";
import { BTN, BTN_PRIMARY, Brand, FIELD, IconChevronLeft, IconDownload, IconRefresh, IconWarn, LABEL } from "./ui";

type Props = {
  config: Config;
  result: ProofResult;
  drafts: Draft[];
  setDrafts: Dispatch<SetStateAction<Draft[]>>;
  stale: boolean;
  setStale: (v: boolean) => void;
  onRegenerate: () => void;
  onBack: () => void;
  onNew: () => void;
};

const box = (b: { x: number; y: number; w: number; h: number }) => ({
  left: `${b.x}%`,
  top: `${b.y}%`,
  width: `${b.w}%`,
  height: `${b.h}%`,
});

export default function ProofView({ config, result, drafts, setDrafts, stale, setStale, onRegenerate, onBack, onNew }: Props) {
  const [pageNo, setPageNo] = useState(1);
  const [sel, setSel] = useState<string | null>(null);
  const [gapOn, setGapOn] = useState(false);

  const pages = result.pages;
  const pageIdx = Math.max(0, pages.findIndex((p) => p.number === pageNo));
  const page = pages[pageIdx];
  const byKey = new Map(drafts.map((d) => [d.key, d]));
  const nameOf = (id: string) => byKey.get(id)?.headline || "Untitled story";
  const impOf = (id: string) => byKey.get(id)?.importance ?? 5;

  const setImp = (id: string, v: number) => {
    setDrafts((l) => l.map((d) => (d.key === id ? { ...d, importance: v } : d)));
    setStale(true);
  };
  const promote = () => {
    if (!sel) return;
    setDrafts((l) => l.map((d) => (d.key === sel ? { ...d, importance: 10 } : d.importance >= 9 ? { ...d, importance: 8 } : d)));
    setStale(true);
  };
  const swap = (other: string) => {
    if (!sel || !other) return;
    const a = impOf(sel);
    const b = impOf(other);
    setDrafts((l) => l.map((d) => (d.key === sel ? { ...d, importance: b } : d.key === other ? { ...d, importance: a } : d)));
    setStale(true);
  };

  const lead = result.leadId ? result.leadId : null;
  const jumpNames = result.jumpIds.map(nameOf);
  const gapWarn = result.warnings.filter((w) => w.kind === "gap");
  const pageWarnCount = (n: number) => result.warnings.filter((w) => w.page === n).length;
  const selZone = sel ? zoneOf(impOf(sel)) : "";
  const gapHere = gapOn && page.gap && page.gapMm > 0;

  return (
    <div className="min-h-screen bg-paper">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-ink px-4 sm:px-6 lg:px-10 py-3.5">
        <Brand paperName={config.paperName} sub={`Proof${config.date ? ` · ${config.date}` : ""}`} />
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onBack}
            className={`${BTN} inline-flex min-h-11 items-center gap-2 rounded-[3px] border border-ink px-4 text-sm font-medium text-ink`}
          >
            <IconChevronLeft />
            Story desk
          </button>
          <button
            onClick={onNew}
            title="Start a new blank edition"
            aria-label="Start a new blank edition"
            className={`${BTN} inline-flex min-h-11 min-w-11 items-center justify-center rounded-[3px] border border-ink text-ink`}
          >
            <IconRefresh size={18} />
          </button>
          <a href={result.pdf} download="newspaper.pdf" className={`${BTN_PRIMARY} inline-flex min-h-12 items-center gap-2.5 px-[22px] text-[15px]`}>
            <IconDownload size={18} />
            Download PDF
          </a>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1440px] flex-wrap items-start gap-8 px-4 pt-6 pb-24 sm:px-6 sm:pt-7 sm:pb-14 lg:px-10">
        {/* Thumbnails */}
        <nav aria-label="Pages" className="flex w-full min-w-0 flex-none flex-col gap-3.5 sm:w-auto">
          <span className={`${LABEL} pl-1.5`}>Pages</span>
          <div className="flex flex-row gap-3.5 overflow-x-auto pb-2 sm:flex-col sm:overflow-visible sm:pb-0">
            {pages.map((p, i) => {
              const active = p.number === page.number;
              const warns = pageWarnCount(p.number);
              return (
                <button
                  key={p.number}
                  className={`${BTN} flex flex-none flex-col items-center gap-1.5 rounded-[3px] border-0 bg-transparent p-1.5 text-xs font-semibold text-ink`}
                  onClick={() => setPageNo(p.number)}
                  aria-current={active ? "page" : undefined}
                  aria-label={`Page ${p.number}${warns ? `, ${warns} ${warns === 1 ? "warning" : "warnings"}` : ""}`}
                >
                  <span
                    className={`relative block w-24 bg-card shadow-[0_6px_12px_-8px_rgba(23,20,15,.4)] ${active ? "border-2 border-navy" : "border border-[#b9af99]"}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={result.previews[i]} alt="" className="block aspect-[340/540] w-full" />
                    {warns > 0 && (
                      <span className="absolute -top-[7px] -right-[7px] flex size-5 items-center justify-center rounded-full border border-warn-line bg-warn-bg text-xs font-bold text-[#6a3f00]">
                        {warns}
                      </span>
                    )}
                  </span>
                  <span>Page {p.number}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Page */}
        <section aria-label="Page preview" className="flex min-w-0 flex-[1_1_560px] flex-col items-center gap-3.5">
          {stale && (
            <div className="flex w-full max-w-[580px] items-center gap-2.5 rounded-[3px] border border-warn-line bg-warn-bg px-3.5 py-2.5 text-[13px] font-medium text-[#4a2c00]">
              <IconWarn size={18} className="flex-none" />
              This proof is out of date. Regenerate to apply your change.
            </div>
          )}
          <div className="flex w-full max-w-[580px] items-baseline justify-between text-xs text-muted">
            <span>340 × 540 mm · 6 columns</span>
            <span>
              Page {page.number} of {pages.length}
            </span>
          </div>

          <div className="relative aspect-[340/540] w-full max-w-[580px] border border-[#b9af99] bg-card shadow-[0_1px_0_#d9d0bd,0_24px_40px_-26px_rgba(23,20,15,.45)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={result.previews[pageIdx]} alt={`Page ${page.number} of the edition`} className="absolute inset-0 size-full select-none" draggable={false} />

            {gapHere && page.gap && (
              <div
                role="img"
                aria-label={`Empty gap of about ${page.gapMm} millimetres`}
                className="absolute flex items-center justify-center border-[1.5px] border-dashed border-warn-line bg-[repeating-linear-gradient(135deg,#fbe3b0_0_8px,rgba(255,253,248,.55)_8px_16px)]"
                style={box(page.gap)}
              >
                <span className="rounded-[2px] bg-warn-soft px-1.5 text-[11px] font-semibold text-warn-ink">Empty gap · about {page.gapMm} mm</span>
              </div>
            )}

            {page.stories.map((s, i) => {
              const on = sel === s.id;
              return (
                <button
                  key={`${s.id}-${i}`}
                  onClick={() => setSel(on ? null : s.id)}
                  aria-pressed={on}
                  aria-label={nameOf(s.id)}
                  className={`absolute cursor-pointer rounded-[2px] bg-transparent p-0 hover:bg-navy/[.07] ${on ? "outline-2 outline-offset-1 outline-navy" : ""}`}
                  style={box(s)}
                />
              );
            })}
            {page.links.map((l, i) => (
              <button
                key={`l${i}`}
                onClick={() => setPageNo(l.to)}
                aria-label={l.kind === "jump" ? `Continues on page ${l.to}` : `Continued from page ${l.to}`}
                className="absolute z-10 cursor-pointer rounded-[2px] bg-transparent p-0 hover:bg-navy/15"
                style={box(l)}
              />
            ))}
          </div>
        </section>

        {/* Side panel */}
        <aside aria-label="Layout report" className="flex min-w-0 max-w-[420px] flex-[1_1_340px] flex-col gap-5">
          <div className="rounded-[3px] border border-ink bg-card">
            <div className="border-b-[3px] border-double border-ink px-5 pt-4 pb-3">
              <h2 className="m-0 font-display text-[22px] font-bold">Layout report</h2>
            </div>
            <div className="flex flex-col gap-3 px-5 pt-3.5 pb-[18px] text-sm leading-[1.6]">
              {lead && (
                <p className="m-0">
                  <strong className="font-semibold">Lead:</strong>{" "}
                  <span lang="te" className="font-te text-[15px] leading-[1.8]">
                    {nameOf(lead)}
                  </span>{" "}
                  <span className="text-muted">(importance {impOf(lead)}).</span>
                </p>
              )}
              {jumpNames.length > 0 && (
                <p className="m-0">
                  {jumpNames.length} {jumpNames.length === 1 ? "story continues" : "stories continue"} on page 2.
                </p>
              )}
              <p className="m-0">
                {result.storyCount} {result.storyCount === 1 ? "story" : "stories"} on {pages.length} {pages.length === 1 ? "page" : "pages"}. Fonts will be embedded in the PDF.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-[3px] border border-rule bg-card px-5 py-4">
            <h2 className="m-0 font-display text-lg font-semibold">Warnings</h2>
            {result.ai?.error && (
              <div className="flex items-start gap-2.5 rounded-[3px] border border-warn-line bg-warn-soft px-3 py-2.5 text-warn-ink">
                <IconWarn size={18} className="mt-0.5 flex-none" />
                <div className="text-[13px] leading-[1.55]">
                  <strong className="font-semibold">The AI editor was skipped.</strong> {result.ai.error} Your own headlines, section and importance were used.
                </div>
              </div>
            )}
            {result.warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2.5 rounded-[3px] border border-warn-line bg-warn-soft px-3 py-2.5 text-warn-ink">
                <IconWarn size={18} className="mt-0.5 flex-none" />
                <div className="text-[13px] leading-[1.55]">
                  <strong className="font-semibold">{w.kind === "gap" ? `Page ${w.page} has an empty gap` : w.text}</strong>
                  {w.kind === "gap" && (
                    <>
                      {" "}
                      of about {w.mm} mm. Add a story or raise one more to importance 6.
                      <div className="mt-2">
                        <button
                          onClick={() => {
                            setPageNo(w.page);
                            setGapOn(true);
                          }}
                          className={`${BTN} min-h-9 rounded-[3px] border border-warn-ink bg-transparent px-3 text-[13px] font-semibold text-warn-ink`}
                        >
                          Show on page
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
            {result.overflowFree && (
              <div className="flex items-start gap-2.5 text-[13px] leading-[1.55]">
                <span aria-hidden="true" className="mt-px inline-flex size-[18px] flex-none items-center justify-center rounded-full bg-navy text-[11px] font-bold text-white">
                  ✓
                </span>
                <span>No story overflows its columns, and no text is cut off.</span>
              </div>
            )}
            {gapWarn.length === 0 && result.overflowFree && (
              <div className="flex items-start gap-2.5 text-[13px] leading-[1.55]">
                <span aria-hidden="true" className="mt-px inline-flex size-[18px] flex-none items-center justify-center rounded-full bg-navy text-[11px] font-bold text-white">
                  ✓
                </span>
                <span>No large empty gaps on any page.</span>
              </div>
            )}
          </div>

          {result.why.length > 0 && (
            <div className="flex flex-col gap-2.5 rounded-[3px] border border-rule bg-card px-5 py-4">
              <h2 className="m-0 font-display text-lg font-semibold">Why it looks this way</h2>
              <ul className="m-0 flex flex-col gap-1.5 pl-[18px] text-[13px] leading-[1.55] text-[#2e2a21]">
                {result.why.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          )}

          {result.ai?.ran && (
            <div className="flex flex-col gap-3 rounded-[3px] border border-rule bg-card px-5 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="m-0 font-display text-lg font-semibold">AI editor&rsquo;s work</h2>
                <span className="text-xs text-muted">{result.ai.model}</span>
              </div>
              <p className="m-0 rounded-[3px] bg-warn-soft px-3 py-2 text-[13px] leading-[1.55] text-warn-ink">
                Headlines and key points below were written by AI. Read them before this goes to print.
              </p>
              <div className="flex flex-col divide-y divide-rule-soft">
                {result.ai.edits.map((e) => {
                  const changed = e.headline !== e.originalHeadline && e.originalHeadline.trim() !== "";
                  return (
                    <div key={e.id} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
                      <div lang="te" className="font-te-serif text-[15px] leading-[1.7] font-bold">
                        {e.headline}
                      </div>
                      {changed && (
                        <div lang="te" className="font-te text-[13px] leading-[1.7] text-muted line-through">
                          {e.originalHeadline}
                        </div>
                      )}
                      <ul lang="te" className="m-0 flex flex-col gap-0.5 pl-[18px] font-te text-[13px] leading-[1.7]">
                        {e.keypoints.map((k, i) => (
                          <li key={i}>{k}</li>
                        ))}
                      </ul>
                      <div className="text-xs text-muted">
                        {e.section} · importance {e.importance} · {e.reason}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Override */}
          <div className="flex flex-col gap-3 rounded-[3px] border border-dashed border-rule-strong px-5 py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="m-0 font-display text-lg font-semibold">Adjust a story</h2>
              <span className="text-xs text-muted">Optional</span>
            </div>
            {!sel ? (
              <p className="m-0 text-[13px] leading-[1.55] text-ink-soft">
                Click any story on the page to change its importance, swap it with another or promote it to lead. You can print without changing anything.
              </p>
            ) : (
              <div className="flex flex-col gap-3.5">
                <div lang="te" className="font-te-serif text-base leading-[1.7] font-bold">
                  {nameOf(sel)}
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between">
                    <label htmlFor="imp" className={LABEL}>
                      Importance
                    </label>
                    <span className="text-[13px]">
                      <span className="font-display text-xl font-bold">{impOf(sel)}</span> · <strong className="font-semibold">{selZone}</strong>
                    </span>
                  </div>
                  <input
                    id="imp"
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    value={impOf(sel)}
                    onChange={(e) => setImp(sel, parseInt(e.target.value, 10))}
                    className="m-0 h-8 w-full cursor-pointer accent-navy"
                  />
                  <div className="flex text-xs text-muted" aria-hidden="true">
                    <span className="flex-[5]">Inside</span>
                    <span className="flex-[3]">Front page</span>
                    <span className="flex-[2] text-right">Lead</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  <button onClick={promote} className={`${BTN} min-h-11 rounded-[3px] border border-ink bg-transparent px-3.5 text-sm font-semibold text-ink`}>
                    Promote to lead
                  </button>
                  <button onClick={() => setSel(null)} className={`${BTN} min-h-11 rounded-[3px] border border-rule bg-transparent px-3.5 text-sm font-medium text-ink`}>
                    Done
                  </button>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="swap" className={LABEL}>
                    Swap with
                  </label>
                  <select
                    id="swap"
                    value=""
                    onChange={(e) => swap(e.target.value)}
                    className={`${FIELD} min-h-12 px-2.5 font-te text-[15px]`}
                  >
                    <option value="">Choose a story…</option>
                    {result.stories
                      .filter((s) => s.id !== sel)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {nameOf(s.id)}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            )}
            {stale && (
              <button onClick={onRegenerate} className={`${BTN_PRIMARY} min-h-12 text-[15px]`}>
                Regenerate with this change
              </button>
            )}
          </div>

          <a href={result.pdf} download="newspaper.pdf" className={`${BTN_PRIMARY} flex min-h-14 items-center justify-center gap-2.5 text-base`}>
            <IconDownload size={18} />
            Download PDF · {pages.length} {pages.length === 1 ? "page" : "pages"}
          </a>
        </aside>
      </main>
    </div>
  );
}
