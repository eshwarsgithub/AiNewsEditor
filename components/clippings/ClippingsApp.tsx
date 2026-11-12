"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import HowToUse from "@/components/editor/HowToUse";
import { emptyConfig, type Config } from "@/components/editor/types";
import { BTN, BTN_OUTLINE, BTN_PRIMARY, FIELD, LABEL, Brand, IconCheck, IconDownload, IconImage, IconTrash, IconWarn } from "@/components/editor/ui";

type Priority = "lead" | "general" | "inside";
type LeadPosition = "top" | "middle" | "bottom";
type Item = { id: string; file: File; url: string; priority: Priority };

type Result = {
  job: string;
  pdf: string;
  previews: string[];
  pages: { number: number; kind: "front" | "inside"; blankMm: number; placed: { id: string; row: number; dpi: number }[] }[];
  clips: { id: string; name: string; priority: Priority }[];
  warnings: { kind: string; id?: string; page?: number; text: string }[];
  why: Record<string, string>;
};

type Step = { key: string; title: string; pending: string };
const STEPS: Step[] = [
  { key: "read", title: "Reading clippings", pending: "Checking each image and measuring its shape." },
  { key: "lead", title: "Choosing the lead", pending: "Putting the lead where you asked." },
  { key: "place", title: "Placing the page", pending: "Tiling clippings so the page is full." },
  { key: "check", title: "Checking the page", pending: "Looking at colours, gaps and print size." },
  { key: "pdf", title: "Preparing the PDF", pending: "340 × 540 mm, fonts embedded." },
];

const HOW = [
  { title: "Drop your clippings", text: "Drag the article images into the box, or click it to choose files. One article per image works best (PNG, JPEG or WebP)." },
  { title: "Say how important each one is", text: "Lead is the main story of the day (choose one). General fills the front page. Inside goes to page 2 and later." },
  { title: "Press Generate newspaper", text: "The app tiles the clippings into a full front page, with your masthead on top. It takes under a minute." },
  { title: "Check and download", text: "Look at the page and read any warnings. If you want the lead somewhere else, go back, change Lead position, and generate again. Then press Download PDF." },
];

const PRIORITIES: { v: Priority; label: string; hint: string }[] = [
  { v: "lead", label: "Lead", hint: "The main story. Gets the biggest block on page 1." },
  { v: "general", label: "General", hint: "Fills the rest of page 1." },
  { v: "inside", label: "Inside", hint: "Goes to page 2 and later." },
];

const POSITIONS: { v: LeadPosition; label: string; sub: string }[] = [
  { v: "top", label: "Top", sub: "Standard" },
  { v: "middle", label: "Middle", sub: "" },
  { v: "bottom", label: "Bottom", sub: "As in the Nov 11 sample" },
];

const KEY = "ainews:clippings:v1";

export default function ClippingsApp() {
  const [view, setView] = useState<"desk" | "generating" | "proof">("desk");
  const [items, setItems] = useState<Item[]>([]);
  const [config, setConfig] = useState<Config>(emptyConfig);
  const [leadPosition, setLeadPosition] = useState<LeadPosition>("top");
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [page, setPage] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- hydrating client-only state after mount */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw) as { config?: Config; leadPosition?: LeadPosition };
        if (s.config) setConfig({ ...emptyConfig, ...s.config });
        if (s.leadPosition) setLeadPosition(s.leadPosition);
      } else {
        const date = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
        setConfig((c) => ({ ...c, date }));
      }
    } catch {
      /* storage unavailable */
    }
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ config, leadPosition }));
    } catch {
      /* storage unavailable */
    }
  }, [config, leadPosition, hydrated]);

  const addFiles = useCallback((list: FileList | File[]) => {
    const ok = Array.from(list).filter((f) => /^image\/(png|jpeg|webp)$/.test(f.type));
    if (!ok.length) {
      setError("Only PNG, JPEG or WebP images can be added.");
      return;
    }
    setError("");
    setItems((cur) => [...cur, ...ok.map((file) => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file), priority: "general" as Priority }))]);
  }, []);

  const setPriority = (id: string, priority: Priority) =>
    setItems((cur) => cur.map((i) => (i.id === id ? { ...i, priority } : priority === "lead" && i.priority === "lead" ? { ...i, priority: "general" } : i)));

  const remove = (id: string) =>
    setItems((cur) => {
      const gone = cur.find((i) => i.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return cur.filter((i) => i.id !== id);
    });

  const generate = async () => {
    if (!items.length) {
      setError("Add at least one clipping first.");
      return;
    }
    setError("");
    setDone({});
    setResult(null);
    setPage(0);
    setView("generating");
    const ctl = new AbortController();
    abortRef.current = ctl;
    const fd = new FormData();
    fd.set("payload", JSON.stringify({ config, leadPosition, clips: items.map((i) => ({ id: i.id, name: i.file.name.replace(/\.[^.]+$/, ""), priority: i.priority })) }));
    for (const i of items) fd.set(`image_${i.id}`, i.file);
    try {
      const res = await fetch("/api/clippings", { method: "POST", body: fd, signal: ctl.signal });
      if (!res.body) throw new Error("No response from the server.");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done: fin } = await reader.read();
        if (fin) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const ln of lines) {
          if (!ln.trim()) continue;
          const m = JSON.parse(ln) as { step?: string; detail?: string; result?: Result; error?: string };
          if (m.error) throw new Error(m.error);
          if (m.step) setDone((d) => ({ ...d, [m.step!]: m.detail ?? "" }));
          if (m.result) {
            setResult(m.result);
            setView("proof");
          }
        }
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
    setView("desk");
  };

  const startFresh = () => {
    if (items.length && !window.confirm("Start over? This removes the clippings you added.")) return;
    items.forEach((i) => URL.revokeObjectURL(i.url));
    setItems([]);
    setResult(null);
    setError("");
    setView("desk");
  };

  if (!hydrated) return null;

  const doneCount = STEPS.filter((s) => s.key in done).length;

  /* ------------------------------- generating ------------------------------- */
  if (view === "generating") {
    return (
      <div className="min-h-screen bg-paper">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-ink px-10 py-3.5">
          <Brand paperName={config.paperName} />
          <button onClick={cancel} className={BTN_OUTLINE}>
            {error ? "Back to clippings" : "Cancel"}
          </button>
        </header>
        <main className="mx-auto max-w-[620px] px-6 pt-14 pb-16">
          <h1 className="m-0 font-display text-[34px] leading-[1.15] font-bold tracking-[-0.01em]">{error ? "Could not build the newspaper" : "Building your newspaper"}</h1>
          {error ? (
            <p role="alert" className="mt-4 rounded-[3px] border border-danger bg-warn-soft px-4 py-3 text-[14px] text-danger">
              {error}
            </p>
          ) : (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-rule-soft" role="progressbar" aria-valuenow={Math.round((doneCount / STEPS.length) * 100)} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-navy transition-[width] duration-500" style={{ width: `${(doneCount / STEPS.length) * 100}%` }} />
            </div>
          )}
          <ol className="m-0 mt-8 list-none p-0">
            {STEPS.map((s, i) => {
              const fin = s.key in done;
              const active = !error && !fin && i === doneCount;
              return (
                <li key={s.key} className="flex gap-4 border-b border-rule-soft py-4">
                  <span className={`inline-flex size-7 flex-none items-center justify-center rounded-full text-[13px] font-semibold ${fin ? "bg-navy text-white" : active ? "border-2 border-navy text-navy" : "border border-rule text-muted"}`}>
                    {fin ? <IconCheck size={14} /> : i + 1}
                  </span>
                  <div>
                    <div className={`font-display text-[18px] font-semibold ${fin || active ? "text-ink" : "text-muted"}`}>{s.title}</div>
                    <div className="text-[14px] text-ink-soft">{fin && done[s.key] ? done[s.key] : s.pending}</div>
                  </div>
                </li>
              );
            })}
          </ol>
        </main>
      </div>
    );
  }

  /* --------------------------------- proof --------------------------------- */
  if (view === "proof" && result) {
    const nameOf = (id: string) => result.clips.find((c) => c.id === id)?.name ?? id;
    const placedOn = (id: string) => result.pages.find((p) => p.placed.some((c) => c.id === id))?.number;
    return (
      <div className="min-h-screen bg-paper">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-ink px-10 py-3.5">
          <Brand paperName={config.paperName} sub="Proof" />
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setView("desk")} className={BTN_OUTLINE}>
              Back to clippings
            </button>
            <a href={result.pdf} download="newspaper.pdf" className={`${BTN_PRIMARY} inline-flex min-h-11 items-center gap-2 px-5 text-sm`}>
              <IconDownload size={16} /> Download PDF
            </a>
          </div>
        </header>

        <main className="mx-auto flex max-w-[1280px] flex-wrap items-start gap-10 px-10 py-10">
          <section className="min-w-0 flex-[1_1_460px]" aria-label="Page preview">
            {result.pages.length > 1 && (
              <div className="mb-3 flex gap-2">
                {result.pages.map((p, i) => (
                  <button key={p.number} onClick={() => setPage(i)} aria-pressed={page === i} className={`${BTN} min-h-10 rounded-[3px] border px-4 text-sm ${page === i ? "border-ink bg-ink text-white hover:bg-ink" : "border-rule"}`}>
                    Page {p.number}
                  </button>
                ))}
              </div>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element -- generated proof image */}
            <img src={result.previews[page]} alt={`Page ${result.pages[page]?.number} of the newspaper`} className="block w-full max-w-[640px] border border-rule bg-white shadow-[0_8px_24px_-14px_rgba(23,20,15,.5)]" />
          </section>

          <section className="flex min-w-0 flex-[1_1_360px] flex-col gap-8">
            <div>
              <h2 className="m-0 font-display text-[26px] font-bold">{result.warnings.length ? `${result.warnings.length} things to check` : "Ready to print"}</h2>
              {result.warnings.length ? (
                <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
                  {result.warnings.map((w, i) => (
                    <li key={i} className="flex gap-3 rounded-[3px] border border-warn-line bg-warn-soft px-3.5 py-3 text-[13.5px] leading-[1.5] text-warn-ink">
                      <span className="mt-0.5 flex-none">
                        <IconWarn size={16} />
                      </span>
                      <span>{w.text}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[14px] text-ink-soft">No gaps, no low-resolution images.</p>
              )}
            </div>
            <div>
              <h2 className="m-0 font-display text-[22px] font-bold">Why each clipping is where it is</h2>
              <ul className="m-0 mt-3 list-none divide-y divide-rule-soft border-y border-rule-soft p-0">
                {result.clips.map((c) => (
                  <li key={c.id} className="py-3 text-[14px]">
                    <div className="flex items-baseline justify-between gap-3">
                      <strong className="font-semibold">{nameOf(c.id)}</strong>
                      <span className="text-[12px] text-muted uppercase">
                        {c.priority}
                        {placedOn(c.id) ? ` · page ${placedOn(c.id)}` : ""}
                      </span>
                    </div>
                    <div className="mt-0.5 text-ink-soft">{result.why[c.id] ?? ""}</div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </main>
        <HowToUse steps={HOW} footer={false} />
      </div>
    );
  }

  /* ---------------------------------- desk ---------------------------------- */
  const leadCount = items.filter((i) => i.priority === "lead").length;
  const set = (k: keyof Config) => (e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, [k]: e.target.value });
  const fields: { k: keyof Config; label: string; te?: boolean }[] = [
    { k: "paperName", label: "Paper name", te: true },
    { k: "paperNameEn", label: "Paper name (English)" },
    { k: "tagline", label: "Tagline" },
    { k: "date", label: "Date line", te: true },
    { k: "issue", label: "Issue" },
    { k: "volume", label: "Volume" },
    { k: "price", label: "Price", te: true },
  ];

  return (
    <div className="min-h-screen bg-paper">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-ink px-10 py-3.5">
        <Brand paperName={config.paperName} sub={config.date} />
        <button onClick={startFresh} className={BTN_OUTLINE}>
          Start over
        </button>
      </header>

      <main className="mx-auto flex max-w-[1200px] flex-wrap items-start gap-10 px-10 py-10">
        <section className="min-w-0 flex-[1_1_560px]" aria-labelledby="up-h">
          <h1 id="up-h" className="m-0 font-display text-[34px] leading-[1.15] font-bold tracking-[-0.01em]">
            Upload your clippings
          </h1>
          <p className="mt-2 mb-5 max-w-[560px] text-[15px] text-ink-soft">Drop the article images. Mark one as the Lead. The app tiles them into a finished front page.</p>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              addFiles(e.dataTransfer.files);
            }}
            onClick={() => fileRef.current?.click()}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), fileRef.current?.click())}
            role="button"
            tabIndex={0}
            aria-label="Add clipping images"
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[3px] border-2 border-dashed px-6 py-10 text-center transition-colors ${dragging ? "border-navy bg-hover" : "border-rule-strong bg-card hover:bg-hover"}`}
          >
            <IconImage size={30} />
            <div className="font-display text-[19px] font-semibold">Drop article images here</div>
            <div className="text-[13px] text-muted">or click to choose files · PNG, JPEG or WebP</div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => (e.target.files && addFiles(e.target.files), (e.target.value = ""))} />
          </div>

          {error && (
            <p role="alert" className="mt-3 rounded-[3px] border border-danger bg-warn-soft px-4 py-2.5 text-[14px] text-danger">
              {error}
            </p>
          )}

          {items.length > 0 && (
            <ul className="m-0 mt-6 flex list-none flex-col gap-3 p-0">
              {items.map((it) => (
                <li key={it.id} className="flex flex-wrap items-center gap-4 rounded-[3px] border border-rule bg-card p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local preview of an uploaded file */}
                  <img src={it.url} alt="" className="h-[84px] w-[84px] flex-none rounded-[2px] border border-rule-soft bg-white object-contain" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-semibold">{it.file.name}</div>
                    <div className="text-[12px] text-muted">{(it.file.size / 1024).toFixed(0)} KB</div>
                    <div role="radiogroup" aria-label={`Priority for ${it.file.name}`} className="mt-2 inline-flex rounded-[3px] border border-rule-strong p-0.5">
                      {PRIORITIES.map((p) => {
                        const on = it.priority === p.v;
                        return (
                          <button key={p.v} type="button" role="radio" aria-checked={on} title={p.hint} onClick={() => setPriority(it.id, p.v)} className={`cursor-pointer rounded-[2px] px-3.5 py-1.5 text-[13px] transition-colors ${on ? "bg-navy font-semibold text-white" : "text-ink-soft hover:bg-hover"}`}>
                            {p.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <button onClick={() => remove(it.id)} aria-label={`Remove ${it.file.name}`} className={`${BTN} inline-flex size-11 items-center justify-center rounded-[3px] border border-rule text-ink`}>
                    <IconTrash size={18} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-6 lg:max-w-[380px]">
          <div className="rounded-[3px] border border-rule bg-card p-5">
            <h2 className="m-0 font-display text-[20px] font-bold">Lead position</h2>
            <p className="mt-1 mb-3 text-[13px] text-muted">Where the main story sits on page 1.</p>
            <div role="radiogroup" aria-label="Lead position" className="flex flex-col gap-2">
              {POSITIONS.map((p) => {
                const on = leadPosition === p.v;
                return (
                  <button key={p.v} type="button" role="radio" aria-checked={on} onClick={() => setLeadPosition(p.v)} className={`flex cursor-pointer items-center justify-between rounded-[3px] border px-3.5 py-2.5 text-left text-[14px] transition-colors ${on ? "border-navy bg-hover font-semibold" : "border-rule hover:bg-hover"}`}>
                    <span>{p.label}</span>
                    <span className="text-[12px] font-normal text-muted">{p.sub}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <details className="rounded-[3px] border border-rule bg-card p-5">
            <summary className={`${LABEL} cursor-pointer`}>Edition details (masthead)</summary>
            <div className="mt-4 flex flex-col gap-3">
              {fields.map((f) => (
                <label key={f.k} className="flex flex-col gap-1">
                  <span className={LABEL}>{f.label}</span>
                  <input value={config[f.k]} onChange={set(f.k)} lang={f.te ? "te" : undefined} className={`${FIELD} min-h-11 px-3 text-[14px]`} />
                </label>
              ))}
            </div>
          </details>

          <div>
            <button onClick={generate} disabled={!items.length} className={`${BTN_PRIMARY} flex min-h-14 w-full items-center justify-center text-base`}>
              Generate newspaper
            </button>
            <p className="mt-2 mb-0 text-[13px] text-muted">
              {items.length
                ? `${items.length} ${items.length === 1 ? "clipping" : "clippings"}${leadCount ? "" : " · no Lead chosen yet"}`
                : "Add clippings to begin."}
            </p>
          </div>
        </aside>
      </main>
      <HowToUse steps={HOW} footer={false} />
    </div>
  );
}
