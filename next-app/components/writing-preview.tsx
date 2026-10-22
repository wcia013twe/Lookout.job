"use client";
import {useEffect, useState} from "react";
export default function WritingPreview({text}: {text:string}) {
  const [shown, setShown] = useState(text);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setShown(text); return; }
    let length = 0;
    setShown("");
    const timer = window.setInterval(() => {
      length += 8;
      setShown(text.slice(0, length));
      if (length >= text.length) window.clearInterval(timer);
    }, 24);
    return () => window.clearInterval(timer);
  }, [text]);
  return <p className="min-h-24 whitespace-pre-wrap break-words text-sm leading-relaxed" aria-label={text}><span aria-hidden="true">{shown}</span></p>;
}
