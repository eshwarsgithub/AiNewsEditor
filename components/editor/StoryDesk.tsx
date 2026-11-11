"use client";

import { useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { SECTIONS, ZONE_HINT, newDraft, zoneOf, type Config, type Draft, type Zone } from "./types";
import {
  BTN,
  BTN_OUTLINE,
  BTN_PRIMARY,
  Brand,
  FIELD,
  IconChevronDown,
  IconChevronUp,
  IconDuplicate,
  IconFile,
  IconGrip,
  IconImage,
  IconPlus,
  IconRefresh,
  IconTrash,
  IconCheck,
  Kbd,
  LABEL,
} from "./ui";

type Props = {
  config: Config;
  setConfig: Dispatch<SetStateAction<Config>>;
  drafts: Draft[];
  setDrafts: Dispatch<SetStateAction<Draft[]>>;
  saved: boolean;
  error: string;
  aiOn: boolean;
  aiAvailable: boolean | null;
  setAiOn: (v: boolean) => void;
  onGenerate: () => void;
  onLoadSample: () => void;
  onNew: () => void;
};

const iconBtn = `${BTN} inline-flex size-11 items-center justify-center rounded-[3px] border-0 bg-transparent text-ink-soft`;

function zoneChip(zone: Zone) {
  if (zone === "Lead") return "bg-navy text-white border-navy";
  if (zone === "Front page") return "bg-transparent text-navy border-navy";
  return "bg-transparent text-[#4a4337] border-rule-strong";
}

function PhotoThumb({ file, ext }: { file?: File; ext: string }) {
  // Object URL lives as long as the page; a revoke-on-cleanup breaks under React strict-mode effect replays.
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  return (
    <div className="relative h-24 w-[132px] flex-none overflow-hidden rounded-[2px] border border-rule bg-[repeating-linear-gradient(135deg,#e9e2d0_0_6px,#ded6c1_6px_12px)]">
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="absolute inset-0 size-full object-cover" />
      )}
      <span className="absolute bottom-1.5 left-1.5 rounded-[2px] bg-card px-1.5 py-px text-[11px] font-semibold text-ink-soft">{ext}</span>
    </div>
  );
}

type CardProps = {
  d: Draft;
  index: number;
  count: number;
  patch: (key: string, change: Partial<Draft>) => void;
  move: (key: string, dir: number) => void;
  duplicate: (key: string) => void;
  remove: (key: string) => void;
  dragKey: string | null;
  setDragKey: (k: string | null) => void;
  drop: (onto: string) => void;
  aiOn: boolean;
};

function StoryCard({ d, index, patch, move, duplicate, remove, dragKey, setDragKey, drop, aiOn }: CardProps) {
  const docxRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const zone = zoneOf(d.importance);
  const num = String(index + 1).padStart(2, "0");
  const sec = SECTIONS.find((s) => s.value === d.section);
  const hasPhoto = !!(d.imageFile || d.imagePath);
  const photoName = d.imageFile?.name ?? d.imagePath?.split("/").pop() ?? "";
  const ext = (photoName.split(".").pop() || "IMG").toUpperCase();
  const id = d.key;

  return (
    <article
      className={`rounded-[3px] border bg-card ${dragKey && dragKey !== d.key ? "border-rule-strong" : "border-rule"}`}
      onDragOver={(e) => dragKey && e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        drop(d.key);
      }}
    >
      {/* card head */}
      <div className="flex flex-wrap items-center gap-3 py-2.5 pr-3.5 pl-2">
        <span
          aria-hidden="true"
          title="Drag to reorder"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("text/plain", d.key);
            const card = e.currentTarget.closest("article");
            if (card) e.dataTransfer.setDragImage(card, 0, 0);
            setDragKey(d.key);
          }}
          onDragEnd={() => setDragKey(null)}
          className="inline-flex h-11 w-7 cursor-grab items-center justify-center text-[#6d6556]"
        >
          <IconGrip />
        </span>
        <span className="min-w-[30px] font-display text-[22px] font-semibold text-navy">{num}</span>

        {!d.open ? (
          <span lang="te" className="min-w-0 flex-[1_1_280px] font-te-serif text-[17px] font-semibold leading-[1.8]">
            {d.headline || <span className="font-sans text-sm font-normal text-muted">Untitled story</span>}
          </span>
        ) : (
          <span className="flex-[1_1_40px]" />
        )}

        <span className={LABEL}>{sec?.label ?? d.section}</span>
        <span className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold ${zoneChip(zone)}`}>{zone}</span>
        <span className="min-w-11 text-right font-display text-lg font-semibold" aria-label={`Importance ${d.importance} of 10`}>
          {d.importance}
          <span className="text-xs font-normal text-muted"> /10</span>
        </span>

        <div className="flex items-center gap-0.5">
          <button className={iconBtn} onClick={() => move(d.key, -1)} aria-label="Move story up">
            <IconChevronUp size={18} />
          </button>
          <button className={iconBtn} onClick={() => move(d.key, 1)} aria-label="Move story down">
            <IconChevronDown size={18} />
          </button>
          <button className={iconBtn} onClick={() => duplicate(d.key)} aria-label="Duplicate story">
            <IconDuplicate size={18} />
          </button>
          <button className={`${iconBtn} !text-danger`} onClick={() => remove(d.key)} aria-label="Remove story">
            <IconTrash size={18} />
          </button>
          <button
            className={`${BTN} ml-1.5 inline-flex size-11 items-center justify-center rounded-[3px] border border-rule bg-transparent text-ink`}
            onClick={() => patch(d.key, { open: !d.open })}
            aria-expanded={d.open}
            aria-label="Show or hide story details"
          >
            <IconChevronDown size={18} className={d.open ? "rotate-180" : ""} />
          </button>
        </div>
      </div>

      {d.open && (
        <div className="flex flex-col gap-[18px] border-t border-rule-soft px-[22px] pt-[18px] pb-[22px]">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`h-${id}`} className={LABEL}>
              Headline
            </label>
            <textarea
              id={`h-${id}`}
              lang="te"
              rows={2}
              value={d.headline}
              placeholder={aiOn ? "Optional. Leave blank and the AI editor will write the headline." : undefined}
              onChange={(e) => patch(d.key, { headline: e.target.value })}
              className={`${FIELD} min-h-[84px] w-full resize-y px-3.5 py-2.5 font-te-serif text-[22px] font-bold leading-[1.75]`}
            />
          </div>

          <div className="flex flex-wrap items-start gap-6">
            {/* body + meta */}
            <div className="flex min-w-0 flex-[1.7_1_360px] flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label htmlFor={`b-${id}`} className={LABEL}>
                    Story text
                  </label>
                  <input
                    ref={docxRef}
                    type="file"
                    accept=".docx"
                    className="hidden"
                    onChange={(e) => patch(d.key, { docxFile: e.target.files?.[0] })}
                  />
                  <button
                    className={`${BTN} inline-flex min-h-9 items-center gap-2 rounded-[3px] border border-rule bg-transparent px-3 text-[13px] font-medium text-ink`}
                    onClick={() => docxRef.current?.click()}
                  >
                    <IconFile />
                    {d.docxFile ? d.docxFile.name : "Attach .docx"}
                  </button>
                </div>
                <textarea
                  id={`b-${id}`}
                  lang="te"
                  rows={5}
                  value={d.body}
                  onChange={(e) => patch(d.key, { body: e.target.value })}
                  placeholder={d.docxFile ? "The attached .docx text will be used." : undefined}
                  className={`${FIELD} min-h-[140px] w-full resize-y px-3.5 py-2.5 font-te text-base leading-[1.9]`}
                />
              </div>

              <div className="flex flex-wrap gap-3.5">
                <div className="flex flex-[1_1_180px] flex-col gap-1.5">
                  <label htmlFor={`s-${id}`} className={LABEL}>
                    Section
                  </label>
                  <select
                    id={`s-${id}`}
                    value={d.section}
                    onChange={(e) => patch(d.key, { section: e.target.value })}
                    className={`${FIELD} min-h-12 px-2.5 text-[15px]`}
                  >
                    {SECTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label} · {s.te}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-[2_1_260px] flex-col gap-1.5">
                  <label htmlFor={`d-${id}`} className={LABEL}>
                    Dateline <span className="font-normal tracking-normal normal-case">(optional)</span>
                  </label>
                  <input
                    id={`d-${id}`}
                    lang="te"
                    value={d.dateline}
                    onChange={(e) => patch(d.key, { dateline: e.target.value })}
                    className={`${FIELD} min-h-12 px-3 font-te text-base`}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor={`k-${id}`} className={LABEL}>
                  Key points <span className="font-normal tracking-normal normal-case">(optional, one per line)</span>
                </label>
                <textarea
                  id={`k-${id}`}
                  lang="te"
                  rows={2}
                  value={d.keypoints}
                  onChange={(e) => patch(d.key, { keypoints: e.target.value })}
                  className={`${FIELD} min-h-[72px] w-full resize-y px-3 py-2 font-te text-[15px] leading-[1.8]`}
                />
              </div>
            </div>

            {/* photo + importance */}
            <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
                <span className={LABEL}>Photo</span>
                <input
                  ref={photoRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) patch(d.key, { imageFile: f, imagePath: undefined });
                  }}
                />
                {hasPhoto ? (
                  <div className="flex items-start gap-3">
                    <PhotoThumb file={d.imageFile} ext={ext} />
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <span className="text-[13px] font-medium [overflow-wrap:anywhere]">{photoName}</span>
                      <button
                        className={`${BTN} min-h-9 self-start rounded-[3px] border border-rule bg-transparent px-3 text-[13px] font-medium text-ink`}
                        onClick={() => {
                          patch(d.key, { imageFile: undefined, imagePath: undefined });
                          photoRef.current?.click();
                        }}
                      >
                        Replace photo
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className={`${BTN} flex min-h-24 w-full flex-col items-center justify-center gap-1.5 rounded-[3px] border-[1.5px] border-dashed border-rule-strong bg-transparent text-sm font-medium text-ink`}
                    onClick={() => photoRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const f = e.dataTransfer.files?.[0];
                      if (f && f.type.startsWith("image/")) patch(d.key, { imageFile: f });
                    }}
                  >
                    <IconImage size={22} />
                    Drop a photo or click to upload
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`c-${id}`} className={LABEL}>
                  Caption
                </label>
                <input
                  id={`c-${id}`}
                  lang="te"
                  value={d.caption}
                  onChange={(e) => patch(d.key, { caption: e.target.value })}
                  className={`${FIELD} min-h-12 px-3 font-te text-[15px]`}
                />
              </div>

              <div className="flex flex-col gap-2 border-t border-rule-soft pt-3.5">
                <div className="flex items-baseline justify-between gap-2">
                  <label htmlFor={`i-${id}`} className={LABEL}>
                    Importance
                  </label>
                  <span className="text-[13px]">
                    <span className="font-display text-[22px] font-bold">{d.importance}</span> · <strong className="font-semibold">{zone}</strong>
                  </span>
                </div>
                <input
                  id={`i-${id}`}
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={d.importance}
                  onChange={(e) => patch(d.key, { importance: parseInt(e.target.value, 10) })}
                  className="m-0 h-8 w-full cursor-pointer accent-navy"
                />
                <div className="flex h-1.5 gap-0.5" aria-hidden="true">
                  <span className={`flex-[5] rounded-[2px] ${zone === "Inside" ? "bg-[#4a4337]" : "bg-[#ded6c1]"}`} />
                  <span className={`flex-[3] rounded-[2px] ${zone === "Front page" ? "bg-navy" : "bg-[#ded6c1]"}`} />
                  <span className={`flex-[2] rounded-[2px] ${zone === "Lead" ? "bg-navy" : "bg-[#ded6c1]"}`} />
                </div>
                <div className="flex text-xs text-muted" aria-hidden="true">
                  <span className="flex-[5]">Inside · 1–5</span>
                  <span className="flex-[3]">Front page · 6–8</span>
                  <span className="flex-[2] text-right">Lead · 9–10</span>
                </div>
                <p className="m-0 text-[13px] leading-[1.55] text-ink-soft">{ZONE_HINT[zone]}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

export default function StoryDesk({ config, setConfig, drafts, setDrafts, saved, error, aiOn, aiAvailable, setAiOn, onGenerate, onLoadSample, onNew }: Props) {
  const [setupOpen, setSetupOpen] = useState(true);
  const [dragKey, setDragKey] = useState<string | null>(null);

  const patch = (key: string, change: Partial<Draft>) => setDrafts((l) => l.map((s) => (s.key === key ? { ...s, ...change } : s)));
  const move = (key: string, dir: number) =>
    setDrafts((l) => {
      const list = l.slice();
      const i = list.findIndex((s) => s.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return l;
      [list[i], list[j]] = [list[j], list[i]];
      return list;
    });
  const duplicate = (key: string) =>
    setDrafts((l) => {
      const i = l.findIndex((s) => s.key === key);
      if (i < 0) return l;
      const list = l.slice();
      list.splice(i + 1, 0, { ...l[i], key: crypto.randomUUID(), open: true });
      return list;
    });
  const remove = (key: string) => setDrafts((l) => l.filter((s) => s.key !== key));
  const drop = (onto: string) => {
    if (!dragKey || dragKey === onto) return setDragKey(null);
    setDrafts((l) => {
      const from = l.findIndex((s) => s.key === dragKey);
      const to = l.findIndex((s) => s.key === onto);
      if (from < 0 || to < 0) return l;
      const list = l.slice();
      const [m] = list.splice(from, 1);
      list.splice(to, 0, m);
      return list;
    });
    setDragKey(null);
  };

  const nums = new Map(drafts.map((d, i) => [d.key, String(i + 1).padStart(2, "0")]));
  const zones = [
    { label: "Lead", range: "Importance 9–10", test: (n: number) => n >= 9 },
    { label: "Front page", range: "Importance 6–8", test: (n: number) => n >= 6 && n <= 8 },
    { label: "Inside", range: "Importance 1–5", test: (n: number) => n <= 5 },
  ].map((z) => {
    const items = drafts.filter((d) => z.test(d.importance));
    return { ...z, items, count: items.length === 1 ? "1 story" : `${items.length} stories` };
  });

  const leadCount = zones[0].items.length;
  const noPhotoTop = drafts.filter((d) => d.importance >= 6 && !d.imageFile && !d.imagePath);
  const noBody = drafts.filter((d) => !d.body.trim() && !d.docxFile);
  const checks: { ok: boolean; text: string }[] = [{ ok: true, text: `${drafts.length} ${drafts.length === 1 ? "story" : "stories"} ready to place.` }];
  if (leadCount === 1) checks.push({ ok: true, text: "One clear lead story." });
  else if (leadCount === 0) checks.push({ ok: false, text: "No story is marked as lead. The editor will choose one." });
  else checks.push({ ok: false, text: `${leadCount} stories compete for the lead. The editor will choose one.` });
  if (noPhotoTop.length) checks.push({ ok: false, text: `Story ${noPhotoTop.map((d) => nums.get(d.key)).join(", ")} is front-page level but has no photo.` });
  if (aiOn) checks.push({ ok: true, text: "The AI editor will write headlines and key points, and set section and importance." });
  if (noBody.length) checks.push({ ok: false, text: `Story ${noBody.map((d) => nums.get(d.key)).join(", ")} has no text yet.` });

  const setupFields: { id: string; label: string; key: keyof Config; ph?: string; te?: boolean }[] = [
    { id: "f-en", label: "Paper name · English", key: "paperNameEn" },
    { id: "f-date", label: "Date line", key: "date", te: true },
    { id: "f-vol", label: "Volume", key: "volume", ph: "[Volume]" },
    { id: "f-iss", label: "Issue", key: "issue", ph: "[Issue no.]" },
    { id: "f-price", label: "Price", key: "price", ph: "₹ [Price]" },
  ];

  const generateBtn = (big: boolean) => (
    <button
      onClick={onGenerate}
      className={`${BTN_PRIMARY} inline-flex items-center justify-center gap-3 ${big ? "min-h-14 text-base" : "min-h-12 px-[22px] text-[15px]"}`}
    >
      Generate edition
      <Kbd>⌘ ↵</Kbd>
    </button>
  );

  return (
    <div className="min-h-screen bg-paper">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-ink bg-paper px-10 py-3.5">
        <Brand paperName={config.paperName} sub={config.date} />
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5 text-[13px] text-muted">
            <IconCheck size={16} className="text-navy" />
            {saved ? "Draft saved on this device" : "Not saved yet"}
          </span>
          <button className={BTN_OUTLINE} onClick={onLoadSample}>
            Load sample edition
          </button>
          <button
            className={`${BTN_OUTLINE} !min-w-11 justify-center !px-0`}
            onClick={onNew}
            title="Start a new blank edition"
            aria-label="Start a new blank edition"
          >
            <IconRefresh size={18} />
          </button>
          {generateBtn(false)}
        </div>
      </header>

      <main className="mx-auto flex max-w-[1360px] flex-col gap-7 px-10 pt-7 pb-16">
        {/* Edition setup */}
        <section aria-labelledby="setup-h" className="rounded-[3px] border border-rule bg-card">
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5">
            <div className="flex flex-wrap items-baseline gap-3.5">
              <h2 id="setup-h" className="m-0 font-display text-xl font-semibold">
                Edition setup
              </h2>
              <span className="text-[13px] text-muted">Printed in the masthead. Remembered between sessions.</span>
            </div>
            <button
              className={`${BTN} inline-flex min-h-11 items-center gap-2 rounded-[3px] border border-rule bg-transparent px-3.5 text-[13px] font-medium text-ink`}
              onClick={() => setSetupOpen((o) => !o)}
              aria-expanded={setupOpen}
            >
              {setupOpen ? "Collapse" : "Edit"}
              <IconChevronDown className={setupOpen ? "rotate-180" : ""} />
            </button>
          </div>
          {setupOpen && (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(190px,100%),1fr))] gap-x-5 gap-y-4 border-t border-rule-soft px-5 pt-[18px] pb-[22px]">
              <div className="flex flex-col gap-1.5 [grid-column:span_2]">
                <label htmlFor="f-te" className={LABEL}>
                  Paper name · Local language
                </label>
                <input
                  id="f-te"
                  value={config.paperName}
                  placeholder="Paper name in your language"
                  onChange={(e) => setConfig({ ...config, paperName: e.target.value })}
                  className={`${FIELD} min-h-[52px] px-3 py-1 font-te-serif text-xl font-bold leading-[1.9]`}
                />
              </div>
              {setupFields.map((f) => (
                <div key={f.id} className="flex flex-col gap-1.5">
                  <label htmlFor={f.id} className={LABEL}>
                    {f.label}
                  </label>
                  <input
                    id={f.id}
                    lang={f.te ? "te" : undefined}
                    value={config[f.key]}
                    placeholder={f.ph}
                    onChange={(e) => setConfig({ ...config, [f.key]: e.target.value })}
                    className={`${FIELD} min-h-[52px] px-3 ${f.te ? "font-te text-base" : "text-[15px]"}`}
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Story desk */}
        <div className="flex flex-wrap items-start gap-8">
          <section aria-labelledby="desk-h" className="flex min-w-0 flex-[999_1_640px] flex-col gap-[18px]">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink pb-2.5">
              <div>
                <h1 id="desk-h" className="m-0 font-display text-[34px] leading-[1.15] font-bold tracking-[-0.015em]">
                  Story desk
                </h1>
                <p className="mt-1 mb-0 text-sm text-muted">Add stories in any order. The editor decides what leads and where everything goes.</p>
              </div>
              <button className={`${BTN_OUTLINE} font-semibold`} onClick={() => setDrafts((l) => [...l, newDraft()])}>
                <IconPlus />
                Add story
              </button>
            </div>

            {drafts.map((d, i) => (
              <StoryCard
                key={d.key}
                d={d}
                index={i}
                count={drafts.length}
                patch={patch}
                move={move}
                duplicate={duplicate}
                remove={remove}
                dragKey={dragKey}
                setDragKey={setDragKey}
                drop={drop}
                aiOn={aiOn}
              />
            ))}
            {drafts.length === 0 && (
              <p className="rounded-[3px] border border-dashed border-rule-strong p-6 text-center text-[15px] text-ink-soft">
                No stories yet. Add a story or load the sample edition.
              </p>
            )}
          </section>

          {/* Placement forecast */}
          <aside aria-labelledby="fc-h" className="flex min-w-0 max-w-full flex-[1_1_300px] flex-col gap-5">
            <div className="rounded-[3px] border border-ink bg-card">
              <div className="border-b-[3px] border-double border-ink px-5 pt-4 pb-3">
                <h2 id="fc-h" className="m-0 font-display text-[22px] font-bold">
                  Where stories will land
                </h2>
                <p className="mt-1 mb-0 text-[13px] text-muted">Based on importance. The editor may still adjust to make the page fit.</p>
              </div>
              {zones.map((z) => (
                <div key={z.label} className="border-b border-rule-soft px-5 py-3.5 last:border-b-0">
                  <div className="mb-1.5 flex items-baseline justify-between gap-2">
                    <span className="font-display text-[17px] font-semibold">{z.label}</span>
                    <span className="text-xs text-muted">
                      {z.range} · {z.count}
                    </span>
                  </div>
                  {z.items.map((it) => (
                    <div key={it.key} className="flex items-baseline gap-2 py-0.5">
                      <span className="min-w-[22px] font-display font-semibold text-navy">{nums.get(it.key)}</span>
                      <span lang="te" className="font-te text-sm leading-[1.8]">
                        {it.headline || "Untitled story"}
                      </span>
                    </div>
                  ))}
                  {z.items.length === 0 && <span className="text-[13px] text-muted">No stories here yet.</span>}
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2.5 rounded-[3px] border border-rule bg-card px-5 py-4">
              <h2 className="m-0 font-display text-lg font-semibold">Before you generate</h2>
              {checks.map((c, i) => (
                <div key={i} className="flex items-start gap-2.5 text-[13px] leading-[1.55]">
                  <span
                    aria-hidden="true"
                    className={`mt-px inline-flex size-[18px] flex-none items-center justify-center rounded-full text-[11px] font-bold ${c.ok ? "bg-navy text-white" : "bg-warn-bg text-[#6a3f00]"}`}
                  >
                    {c.ok ? "✓" : "!"}
                  </span>
                  <span>{c.text}</span>
                </div>
              ))}
            </div>

            <div className="flex items-start gap-3.5 rounded-[3px] border border-rule bg-card px-5 py-4">
              <button
                type="button"
                role="switch"
                aria-checked={aiOn}
                aria-labelledby="ai-h"
                aria-describedby="ai-d"
                disabled={aiAvailable !== true}
                onClick={() => setAiOn(!aiOn)}
                className="group -my-2 flex min-h-11 flex-none cursor-pointer items-center disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className={`relative h-6 w-11 rounded-full transition-colors ${aiOn ? "bg-navy" : "bg-rule-strong"}`}>
                  <span className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white transition-transform ${aiOn ? "translate-x-5" : ""}`} />
                </span>
              </button>
              <div className="min-w-0">
                <h2 id="ai-h" className="m-0 font-display text-lg font-semibold">
                  AI editor <span className="ml-1 font-sans text-xs font-semibold text-navy">{aiOn ? "On" : "Off"}</span>
                </h2>
                <p id="ai-d" className="mt-1 mb-0 text-[13px] leading-[1.55] text-ink-soft">
                  When on, the AI writes headlines and key points and sets each story&rsquo;s section and importance.
                </p>
              </div>
            </div>

            {error && (
              <div role="alert" className="rounded-[3px] border border-warn-line bg-warn-soft px-3 py-2.5 text-[13px] font-medium text-warn-ink">
                {error}
              </div>
            )}
            {generateBtn(true)}
          </aside>
        </div>
      </main>
    </div>
  );
}
