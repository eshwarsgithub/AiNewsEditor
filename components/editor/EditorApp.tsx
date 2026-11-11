"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import HowToUse from "./HowToUse";
import GeneratingView, { type StepState } from "./GeneratingView";
import ProofView from "./ProofView";
import StoryDesk from "./StoryDesk";
import { emptyConfig, newDraft, type Config, type Draft, type ProofResult, type StepKey } from "./types";

const STORAGE_KEY = "ainews:desk:v1";

type Stored = { config: Config; drafts: Omit<Draft, "imageFile" | "docxFile">[]; aiOn?: boolean };

type SampleArticle = {
  headline: string;
  section?: string;
  importance?: number;
  bullets?: string[];
  body: string;
  dateline?: string;
  image?: { path: string; caption?: string };
};

// With the AI editor on, a story only needs text: the AI writes the headline.
const hasText = (d: Draft, ai = false) => (ai || d.headline.trim()) && (d.body.trim() || d.docxFile);

function EditorScreens() {
  const [view, setView] = useState<"desk" | "generating" | "proof">("desk");
  const [config, setConfig] = useState<Config>(emptyConfig);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [steps, setSteps] = useState<StepState>({});
  const [result, setResult] = useState<ProofResult | null>(null);
  const [stale, setStale] = useState(false);
  const [aiOn, setAiOn] = useState(false);
  const [aiRanThisRun, setAiRanThisRun] = useState(false);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Restore the saved draft (or start with one blank story and today's date line).
  /* eslint-disable react-hooks/set-state-in-effect -- hydrating client-only state (localStorage, locale date) after mount */
  useEffect(() => {
    let restored = false;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as Stored;
        setConfig({ ...emptyConfig, ...s.config });
        setDrafts(s.drafts.length ? s.drafts : [newDraft()]);
        setAiOn(!!s.aiOn);
        restored = true;
        setSaved(true);
      }
    } catch {
      /* storage unavailable or corrupt: start fresh */
    }
    if (!restored) {
      let date = "";
      try {
        date = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      } catch {
        /* locale unsupported */
      }
      setConfig((c) => ({ ...c, date }));
      setDrafts([newDraft()]);
    }
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Is the AI editor usable on this server (credentials present)?
  useEffect(() => {
    fetch("/api/ai-status")
      .then((r) => r.json())
      .then((j: { configured?: boolean }) => setAiAvailable(!!j.configured))
      .catch(() => setAiAvailable(false));
  }, []);

  // Autosave text fields (files stay in memory only).
  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => {
      try {
        const stored: Stored = {
          aiOn,
          config,
          drafts: drafts.map((d) => {
            const { imageFile, docxFile, ...text } = d;
            void imageFile;
            void docxFile;
            return text;
          }),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
        setSaved(true);
      } catch {
        setSaved(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [config, drafts, aiOn, hydrated]);

  const useAi = aiOn && aiAvailable === true;

  const generate = useCallback(async (opts?: { skipAi?: boolean }) => {
    const ai = useAi && !opts?.skipAi;
    if (!drafts.some((d) => hasText(d, ai))) {
      setError(ai ? "Add at least one story with text." : "Add at least one story with a headline and text.");
      setView("desk");
      return;
    }
    setError("");
    setSteps({});
    setStale(false);
    setAiRanThisRun(ai);
    setView("generating");
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const form = new FormData();
      form.set(
        "payload",
        JSON.stringify({
          config,
          ai,
          articles: drafts.map((d) => ({
            id: d.key,
            headline: d.headline,
            section: d.section,
            importance: d.importance,
            bullets: d.keypoints.split("\n").filter((b) => b.trim()),
            body: d.body,
            dateline: d.dateline,
            imageCaption: d.caption,
            imagePath: d.imageFile ? undefined : d.imagePath,
          })),
        }),
      );
      for (const d of drafts) {
        if (d.imageFile) form.set(`image_${d.key}`, d.imageFile);
        if (d.docxFile) form.set(`docx_${d.key}`, d.docxFile);
      }
      const res = await fetch("/api/generate", { method: "POST", body: form, signal: ctrl.signal });
      if (!res.body) throw new Error("No response from the editor.");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let finished = false;
      for (;;) {
        const { value, done } = await reader.read();
        if (value) buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const msg = JSON.parse(line) as { step?: StepKey; detail?: string; headline?: string; result?: ProofResult; error?: string };
          if (msg.error) throw new Error(msg.error);
          if (msg.step) setSteps((s) => ({ ...s, [msg.step!]: { detail: msg.detail, headline: msg.headline } }));
          if (msg.result) {
            finished = true;
            const aiEdits = msg.result.ai?.edits ?? [];
            if (aiEdits.length) {
              // Write the AI's work back so the desk, later regenerates and manual overrides all start from it.
              const byId = new Map(aiEdits.map((e) => [e.id, e]));
              setDrafts((l) =>
                l.map((d) => {
                  const e = byId.get(d.key);
                  return e ? { ...d, headline: e.headline, section: e.section, importance: e.importance, keypoints: e.keypoints.join("\n") } : d;
                }),
              );
            }
            setResult(msg.result);
            setView("proof");
          }
        }
        if (done) break;
      }
      if (!finished) throw new Error("The editor stopped before finishing. Try again.");
    } catch (e) {
      if (ctrl.signal.aborted) return;
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }, [config, drafts, useAi]);

  // ⌘/Ctrl + Enter generates from the story desk.
  const generateRef = useRef(generate);
  generateRef.current = generate;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (view === "desk" && (e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        generateRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view]);

  const loadSample = async () => {
    try {
      const data = (await (await fetch("/api/sample")).json()) as { config: Config; articles: SampleArticle[] };
      setConfig({ ...emptyConfig, ...data.config });
      setDrafts(
        data.articles.map((a, i) =>
          newDraft({
            open: i < 2,
            headline: a.headline,
            section: a.section ?? "general",
            importance: a.importance ?? 5,
            keypoints: (a.bullets ?? []).join("\n"),
            body: a.body,
            dateline: a.dateline ?? "",
            caption: a.image?.caption ?? "",
            imagePath: a.image?.path,
          }),
        ),
      );
      setError("");
    } catch {
      setError("Could not load the sample edition.");
    }
  };

  // Wipe the desk (stories, edition setup, proof) and start a blank edition.
  const startFresh = () => {
    if (!window.confirm("Start a new blank edition? This clears the current stories and proof.")) return;
    abortRef.current?.abort();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage unavailable */
    }
    setAiOn(false);
    let date = "";
    try {
      date = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    } catch {
      /* locale unsupported */
    }
    setConfig({ ...emptyConfig, date });
    setDrafts([newDraft()]);
    setResult(null);
    setSteps({});
    setStale(false);
    setError("");
    setView("desk");
    window.scrollTo({ top: 0 });
  };

  const cancel = () => {
    abortRef.current?.abort();
    setView("desk");
  };

  if (!hydrated) return null;

  if (view === "generating") {
    const top = drafts.reduce<Draft | null>((m, d) => (hasText(d, useAi) && (!m || d.importance > m.importance) ? d : m), null);
    return <GeneratingView config={config} done={steps} leadHeadline={steps.lead?.headline ?? top?.headline ?? ""} error={error} aiOn={aiRanThisRun} onCancel={cancel} />;
  }
  if (view === "proof" && result) {
    return (
      <ProofView
        config={config}
        result={result}
        drafts={drafts}
        setDrafts={setDrafts}
        stale={stale}
        setStale={setStale}
        onRegenerate={() => generate({ skipAi: true })}
        onBack={() => setView("desk")}
        onNew={startFresh}
      />
    );
  }
  return <StoryDesk config={config} setConfig={setConfig} drafts={drafts} setDrafts={setDrafts} saved={saved} error={error} aiOn={aiOn} aiAvailable={aiAvailable} setAiOn={setAiOn} onGenerate={() => generate()} onLoadSample={loadSample} onNew={startFresh} />;
}

export default function EditorApp() {
  return (
    <>
      <EditorScreens />
      <HowToUse />
    </>
  );
}
