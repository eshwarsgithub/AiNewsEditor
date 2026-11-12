"use client";

import { useRef } from "react";
import { BTN } from "./ui";

const STEPS: { title: string; text: string }[] = [
  {
    title: "Add your stories",
    text: "Type or paste each story, or attach a Word file. Add a photo if you have one.",
  },
  {
    title: "Say how big each story is",
    text: "Give every story a number from 1 to 10. A bigger number means a bigger place in the newspaper. 9–10 is the main story on the front page.",
  },
  {
    title: "Press Generate edition",
    text: "The app lays out your pages by itself. It takes about a minute.",
  },
  {
    title: "Check the pages and download",
    text: "Look at each page. To change something, click a story, change its number, and press Regenerate. When you are happy, press Download PDF.",
  },
];

export type HowStep = { title: string; text: string };

export default function HowToUse({ steps = STEPS, footer }: { steps?: HowStep[]; footer?: boolean } = {}) {
  const ref = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        aria-label="How to use this app"
        title="How to use this app"
        className={`${BTN} fixed right-5 bottom-5 z-40 inline-flex size-11 items-center justify-center rounded-full border border-ink bg-card font-display text-[22px] leading-none font-bold text-ink italic shadow-[0_6px_16px_-8px_rgba(23,20,15,.5)]`}
      >
        i
      </button>

      {/* Native dialog: focus is trapped inside and Esc closes it. */}
      <dialog
        ref={ref}
        aria-labelledby="how-h"
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
        className="m-auto w-[min(560px,calc(100vw-32px))] rounded-[3px] border border-ink bg-card p-0 text-ink backdrop:bg-ink/40"
      >
        <div className="flex items-start justify-between gap-4 border-b-[3px] border-double border-ink px-6 pt-5 pb-4">
          <div>
            <h2 id="how-h" className="m-0 font-display text-2xl font-bold tracking-[-0.01em]">
              How to use this app
            </h2>
            <p className="mt-1 mb-0 text-sm text-muted">You give it stories. It gives you a newspaper ready to print.</p>
          </div>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Close"
            className={`${BTN} -mt-1 -mr-2 inline-flex size-11 flex-none items-center justify-center rounded-[3px] border-0 bg-transparent text-ink`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <ol className="m-0 list-none px-6 py-2">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-4 border-b border-rule-soft py-4 last:border-b-0">
              <span aria-hidden="true" className="inline-flex size-[26px] flex-none items-center justify-center rounded-full bg-navy text-[13px] font-semibold text-white">
                {i + 1}
              </span>
              <div>
                <div className="font-display text-[18px] font-semibold">{s.title}</div>
                <div className="mt-0.5 text-[14px] leading-[1.55] text-ink-soft">{s.text}</div>
              </div>
            </li>
          ))}
        </ol>

        {footer !== false ? (
        <div className="flex flex-col gap-2 border-t border-rule-soft bg-paper px-6 py-4 text-[13px] leading-[1.55] text-ink-soft">
          <p className="m-0">
            <strong className="font-semibold text-ink">Short on time?</strong> Switch on the <strong className="font-semibold text-ink">AI editor</strong>. Just paste the story text. The AI writes the
            headline and key points and decides how important each story is. Always read what it wrote before printing.
          </p>
          <p className="m-0">Your work saves on this computer by itself, so you will not lose it if you close the page.</p>
        </div>
        ) : null}
      </dialog>
    </>
  );
}
