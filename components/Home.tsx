"use client";

import { useEffect, useState } from "react";
import ClippingsApp from "@/components/clippings/ClippingsApp";
import VersionBar, { type Version } from "@/components/clippings/VersionBar";
import EditorApp from "@/components/editor/EditorApp";

const KEY = "ainews:version";

/** Version 1 (clippings) is the default; Version 2 (story desk) is one click away. */
export default function Home() {
  const [version, setVersion] = useState<Version | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- reading the remembered choice after mount */
  useEffect(() => {
    let v: Version = "1";
    try {
      const q = new URLSearchParams(window.location.search).get("v");
      const stored = localStorage.getItem(KEY);
      if (q === "1" || q === "2") v = q;
      else if (stored === "1" || stored === "2") v = stored;
    } catch {
      /* storage unavailable: default */
    }
    setVersion(v);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const choose = (v: Version) => {
    setVersion(v);
    try {
      localStorage.setItem(KEY, v);
    } catch {
      /* storage unavailable */
    }
    window.scrollTo({ top: 0 });
  };

  if (!version) return null;
  return (
    <>
      <VersionBar version={version} onChange={choose} />
      {version === "1" ? <ClippingsApp /> : <EditorApp />}
    </>
  );
}
