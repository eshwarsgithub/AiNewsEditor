"use client";

export type Version = "1" | "2";

const OPTIONS: { v: Version; label: string; sub: string }[] = [
  { v: "1", label: "Version 1", sub: "Upload clippings" },
  { v: "2", label: "Version 2", sub: "Story desk" },
];

/** Slim bar above both flows so the client can pick the one they prefer during the pilot. */
export default function VersionBar({ version, onChange }: { version: Version; onChange: (v: Version) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 bg-ink px-10 py-2 text-[13px] text-white">
      <span className="text-white/75">Pilot: pick the flow that suits your newsroom. You can switch any time.</span>
      <div role="radiogroup" aria-label="Version" className="inline-flex rounded-[3px] border border-white/40 p-0.5">
        {OPTIONS.map((o) => {
          const on = version === o.v;
          return (
            <button
              key={o.v}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.v)}
              className={`cursor-pointer rounded-[2px] px-3.5 py-1.5 text-[13px] transition-colors ${on ? "bg-white font-semibold text-ink" : "text-white/85 hover:bg-white/15"}`}
            >
              {o.label} <span className={on ? "text-muted" : "text-white/60"}>· {o.sub}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
