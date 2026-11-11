import type { ReactNode, SVGProps } from "react";

export const LABEL = "text-xs font-semibold text-muted tracking-[.04em] uppercase";
export const FIELD =
  "border border-rule bg-card rounded-[3px] text-ink hover:border-rule-strong focus:border-navy focus:outline-2 focus:outline-navy focus:outline-offset-0";
export const BTN = "cursor-pointer transition-colors hover:bg-hover";
export const BTN_OUTLINE = `${BTN} inline-flex items-center gap-2 min-h-11 px-4 border border-ink bg-transparent rounded-[3px] text-sm font-medium text-ink`;
export const BTN_PRIMARY =
  "cursor-pointer transition-colors bg-navy text-white rounded-[3px] font-semibold hover:bg-navy-dark disabled:opacity-60 disabled:cursor-not-allowed";

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 16, sw = 1.8): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: sw,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
});

export const IconCheck = ({ size, sw = 2, ...r }: P & { sw?: number }) => (
  <svg {...base(size, sw)} {...r}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
export const IconChevronDown = ({ size, ...r }: P) => (
  <svg {...base(size)} {...r}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);
export const IconChevronUp = ({ size, ...r }: P) => (
  <svg {...base(size)} {...r}>
    <path d="M6 15l6-6 6 6" />
  </svg>
);
export const IconChevronLeft = ({ size, ...r }: P) => (
  <svg {...base(size)} {...r}>
    <path d="M15 6l-6 6 6 6" />
  </svg>
);
export const IconRefresh = ({ size, ...r }: P) => (
  <svg {...base(size)} {...r}>
    <path d="M20 11a8 8 0 10-2.3 5.7" />
    <path d="M20 4v7h-7" />
  </svg>
);
export const IconPlus = ({ size, ...r }: P) => (
  <svg {...base(size, 2)} {...r}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const IconDuplicate = ({ size, ...r }: P) => (
  <svg {...base(size, 1.7)} {...r}>
    <rect x="9" y="9" width="11" height="11" rx="1.5" />
    <path d="M5 15V5.5A1.5 1.5 0 0 1 6.5 4H15" />
  </svg>
);
export const IconTrash = ({ size, ...r }: P) => (
  <svg {...base(size, 1.7)} {...r}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7M9 7V4.5h6V7" />
  </svg>
);
export const IconFile = ({ size, ...r }: P) => (
  <svg {...base(size, 1.7)} {...r}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
  </svg>
);
export const IconImage = ({ size, ...r }: P) => (
  <svg {...base(size, 1.7)} {...r}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="1.8" />
    <path d="M21 16l-5-5-8 8" />
  </svg>
);
export const IconWarn = ({ size, ...r }: P) => (
  <svg {...base(size, 2)} {...r}>
    <path d="M12 9v4M12 17h.01M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
  </svg>
);
export const IconDownload = ({ size, ...r }: P) => (
  <svg {...base(size, 2)} {...r}>
    <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />
  </svg>
);
export const IconGrip = () => (
  <svg width="14" height="22" viewBox="0 0 14 22" fill="currentColor" aria-hidden="true">
    <circle cx="4" cy="4" r="1.6" />
    <circle cx="10" cy="4" r="1.6" />
    <circle cx="4" cy="11" r="1.6" />
    <circle cx="10" cy="11" r="1.6" />
    <circle cx="4" cy="18" r="1.6" />
    <circle cx="10" cy="18" r="1.6" />
  </svg>
);

/** Brand block shared by every screen's header. */
export function Brand({ paperName, sub }: { paperName: string; sub?: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-4">
      <span className="font-display text-[22px] font-bold tracking-[-0.01em]">News Editor</span>
      <span className="h-[18px] w-px self-center bg-[#b9af99]" />
      <span lang="te" className="font-te-serif text-[17px] font-bold leading-[1.7]">
        {paperName}
      </span>
      {sub ? <span className="text-[13px] text-muted">{sub}</span> : null}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <span className="rounded-[3px] border border-white/55 px-[7px] py-[3px] text-xs font-medium tracking-[.02em]">{children}</span>;
}
