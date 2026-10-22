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
  return <div className="grid whitespace-pre-wrap break-words text-sm leading-relaxed">
    <p className="invisible col-start-1 row-start-1" aria-hidden="true">{text}</p>
    <p className="col-start-1 row-start-1"><span className="sr-only">{text}</span><span aria-hidden="true">{shown}</span></p>
  </div>;
}
