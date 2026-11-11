"use client";

import type { Config, StepKey } from "./types";
import { BTN, Brand, IconCheck, IconChevronLeft } from "./ui";

export type StepState = Partial<Record<StepKey, { detail?: string; headline?: string }>>;

const AI_STEP = { key: "ai" as StepKey, title: "Editing with AI", pending: "Writing headlines and key points, setting section and importance." };

const BASE_STEPS: { key: StepKey; title: string; pending: string }[] = [
  { key: "read", title: "Reading stories", pending: "Reading every story and photo." },
  { key: "lead", title: "Choosing the lead", pending: "Comparing importance across stories." },
  { key: "place", title: "Placing columns", pending: "Fitting stories into six columns on page 1." },
  { key: "check", title: "Checking fit", pending: "Looking for overflow, short columns and empty gaps." },
  { key: "pdf", title: "Preparing the PDF", pending: "Fonts embedded, 340 × 540 mm." },
];

type Props = {
  config: Config;
  done: StepState;
  leadHeadline: string;
  error: string;
  aiOn: boolean;
  onCancel: () => void;
};

export default function GeneratingView({ config, done, leadHeadline, error, aiOn, onCancel }: Props) {
  const STEPS = aiOn ? [BASE_STEPS[0], AI_STEP, ...BASE_STEPS.slice(1)] : BASE_STEPS;
  const doneCount = STEPS.filter((s) => done[s.key]).length;
  const activeIdx = error ? -1 : doneCount < STEPS.length ? doneCount : -1;
  const pct = Math.round((doneCount / STEPS.length) * 100);
  const stepNo = Math.min(doneCount + 1, STEPS.length);

  return (
    <div className="min-h-screen bg-paper">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-ink px-10 py-3.5">
        <Brand paperName={config.paperName} />
        <button
          onClick={onCancel}
          className={`${BTN} inline-flex min-h-11 items-center gap-2 rounded-[3px] border border-ink px-4 text-sm font-medium text-ink`}
        >
          <IconChevronLeft />
          {error ? "Return to story desk" : "Cancel and return to story desk"}
        </button>
      </header>

      <main className="mx-auto flex max-w-[1200px] flex-wrap items-start justify-center gap-16 px-10 pt-14 pb-16">
        {/* Progress */}
        <section aria-labelledby="g-h" className="flex min-w-0 max-w-[560px] flex-[1_1_440px] flex-col gap-7">
          <div>
            <p className="m-0 mb-2 text-xs font-semibold tracking-[.08em] text-navy uppercase">
              Step {stepNo} of {STEPS.length}
            </p>
            <h1 id="g-h" className="m-0 font-display text-[40px] leading-[1.1] font-bold tracking-[-0.015em]">
              {error ? "Could not set your pages" : "Setting your pages"}
            </h1>
            <p className="mt-2.5 mb-0 max-w-[46ch] text-[15px] text-ink-soft">
              {error || "The editor is reading every story, choosing the lead and fitting columns. Your draft stays saved if you leave."}
            </p>
          </div>

          <div
            role="progressbar"
            aria-label="Generation progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            className="relative h-1.5 overflow-hidden rounded-[3px] bg-[#ded6c1]"
          >
            <div className="relative h-full overflow-hidden bg-navy transition-[width] duration-500" style={{ width: `${Math.max(pct, 4)}%` }}>
              {!error && <span className="sweep absolute top-0 left-0 h-full w-2/5 bg-white/35" />}
            </div>
          </div>

          <ol className="m-0 list-none border-t border-ink p-0">
            {STEPS.map((s, i) => {
              const st = done[s.key];
              const isDone = !!st;
              const isActive = i === activeIdx;
              return (
                <li
                  key={s.key}
                  aria-current={isActive ? "step" : undefined}
                  className={`flex gap-4 border-b border-[#d9d0bd] py-4 ${isActive ? "-mx-4 bg-card px-4" : ""}`}
                >
                  {isDone ? (
                    <span aria-hidden="true" className="inline-flex size-[26px] flex-none items-center justify-center rounded-full bg-navy text-white">
                      <IconCheck size={14} sw={3} />
                    </span>
                  ) : isActive ? (
                    <span aria-hidden="true" className="inline-flex size-[26px] flex-none items-center justify-center rounded-full border-2 border-navy">
                      <span className="dot size-2.5 rounded-full bg-navy" />
                    </span>
                  ) : (
                    <span aria-hidden="true" className="size-[26px] flex-none rounded-full border-[1.5px] border-rule-strong" />
                  )}
                  <div className="min-w-0">
                    <div className={`font-display text-[19px] ${isActive ? "font-bold" : "font-semibold"} ${!isDone && !isActive ? "text-muted" : ""}`}>
                      {s.title}
                      {(isDone || isActive) && (
                        <span className="ml-1.5 font-sans text-xs font-semibold text-navy">{isDone ? "Done" : "In progress"}</span>
                      )}
                    </div>
                    {st?.headline && (
                      <div lang="te" className="mt-0.5 font-te text-[15px] leading-[1.8] font-semibold">
                        {st.headline}
                      </div>
                    )}
                    <div className={`text-[13px] ${isActive ? "text-ink-soft" : "text-muted"} ${st?.headline ? "" : "mt-0.5"}`}>
                      {st?.detail ?? s.pending}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[13px] text-muted">Usually under a minute.</span>
          </div>
        </section>

        {/* Page being built */}
        <figure aria-label="Page 1 being assembled" className="m-0 flex flex-none flex-col items-center gap-3">
          <div className="flex aspect-[340/540] w-[420px] max-w-full flex-col gap-3 overflow-hidden border border-[#b9af99] bg-card px-6 py-[22px] shadow-[0_1px_0_#d9d0bd,0_14px_30px_-18px_rgba(23,20,15,.35)]">
            <div className="border-y-0 border-t-[3px] border-b border-ink pt-2 pb-1 text-center">
              <div lang="te" className="font-te-serif text-[40px] leading-[1.5] font-extrabold text-navy">
                {config.paperName}
              </div>
            </div>
            <div className="flex justify-between border-b-[3px] border-double border-ink pb-1.5 text-[10px] text-[#4a4337]">
              <span lang="te" className="font-te leading-[1.6]">
                {config.date}
              </span>
              <span>Page 1</span>
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-6 gap-x-2.5">
              <div className="col-span-4 flex flex-col gap-2 border-r border-rule pr-2.5">
                <div lang="te" className="font-te-serif text-[19px] leading-[1.6] font-extrabold">
                  {leadHeadline}
                </div>
                <div className="h-28 border border-rule bg-[repeating-linear-gradient(135deg,#e9e2d0_0_6px,#ded6c1_6px_12px)]" />
                <div className="pending flex flex-col gap-[5px]">
                  <span className="h-[5px] rounded-[2px] bg-rule" />
                  <span className="h-[5px] rounded-[2px] bg-rule" />
                  <span className="h-[5px] w-4/5 rounded-[2px] bg-rule" />
                  <span className="h-[5px] rounded-[2px] bg-rule" />
                  <span className="h-[5px] w-3/5 rounded-[2px] bg-rule" />
                </div>
              </div>
              <div className="col-span-2 flex flex-col gap-2.5">
                <div className="pending h-14 rounded-[2px] bg-[#e6dfcd]" />
                <div className="pending flex flex-col gap-[5px]">
                  <span className="h-[5px] rounded-[2px] bg-[#d9d0bd]" />
                  <span className="h-[5px] rounded-[2px] bg-[#d9d0bd]" />
                  <span className="h-[5px] w-[70%] rounded-[2px] bg-[#d9d0bd]" />
                </div>
                <div className="pending h-[70px] rounded-[2px] bg-[#e6dfcd]" />
              </div>
            </div>
            <div className="pending grid h-[120px] grid-cols-3 gap-2.5 border-t border-ink pt-2.5">
              <span className="rounded-[2px] bg-[#e6dfcd]" />
              <span className="rounded-[2px] bg-[#e6dfcd]" />
              <span className="rounded-[2px] bg-[#e6dfcd]" />
            </div>
          </div>
          <figcaption className="text-xs text-muted">
            Page 1 · {done.lead ? "lead placed, " : ""}
            {doneCount >= 5 ? "ready" : "filling columns"}
          </figcaption>
        </figure>
      </main>
    </div>
  );
}
