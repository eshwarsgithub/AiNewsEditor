"use client";

export type Version = "1" | "2";

const OPTIONS: { v: Version; label: string; sub: string }[] = [
  { v: "1", label: "Version 1", sub: "Upload clippings" },
  { v: "2", label: "Version 2", sub: "Story desk" },
];

/** Slim bar above both flows so the client can pick the one they prefer during the pilot. */
export default function VersionBar({ version, onChange }: { version: Version; onChange: (v: Version) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 bg-ink px-4 sm:px-6 lg:px-10 py-2 text-[13px] text-white">
      <span className="hidden text-white/75 sm:inline">Pilot: pick the flow that suits your newsroom. You can switch any time.</span>
      <div role="radiogroup" aria-label="Version" className="flex w-full rounded-[3px] border border-white/40 p-0.5 sm:inline-flex sm:w-auto">
        {OPTIONS.map((o) => {
          const on = version === o.v;
          return (
            <button
              key={o.v}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.v)}
              className={`min-h-10 flex-1 cursor-pointer rounded-[2px] px-3 py-1.5 text-center text-[13px] leading-tight transition-colors sm:min-h-0 sm:flex-none sm:px-3.5 ${on ? "bg-white font-semibold text-ink" : "text-white/85 hover:bg-white/15"}`}
            >
              {o.label}<span className={`block sm:inline ${on ? "text-muted" : "text-white/60"}`}><span className="hidden sm:inline"> · </span>{o.sub}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
