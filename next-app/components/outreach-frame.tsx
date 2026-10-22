"use client";
import {useEffect, useState} from "react";
import {outreachSentences} from "../../lib/outreach-model.mjs";
const colors: Record<string,string> = {Background:"#bd9cf4",Connection:"#e4bc45",Achievement:"#60aef0","Why them":"#ed99bb",Timing:"#f4a361",Ask:"#57bd98"};
const escape = (value:string) => value.replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]!));
export default function OutreachFrame({message, name, highlights}: {message:string;name:string;highlights:boolean}) {
  const [theme,setTheme]=useState("");
  useEffect(()=>{
    const update=()=>setTheme(document.documentElement.dataset.theme || "");
    update();
    const observer=new MutationObserver(update);
    observer.observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
    return ()=>observer.disconnect();
  },[]);
  let character=0;
  const content=outreachSentences({message}).map(({text,kind}:{text:string;kind:string|null})=>{
    // Templates describe the evidence to supply; classify those explicit placeholders too.
    const category = /specific achievement|contribution and result|relevant achievement/i.test(text) ? "Achievement"
      : /specific company\/team work|specific team work|specific post|technical problem/i.test(text) ? "Why them"
      : /verified shared background|genuine reference to your relationship/i.test(text) ? "Connection" : kind;
    const letters=Array.from(text).map(letter=>`<span style="--delay:${character++ * 6}ms">${escape(letter)}</span>`).join("");
    return category && highlights ? `<mark style="--tag:${colors[category]}" title="${category}">${letters}</mark>` : letters;
  }).join("");
  const doc=`<!doctype html><html lang="en"${theme ? ` data-theme="${escape(theme)}"` : ""}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><style>
    :root{color-scheme:light dark;--ink:#e8eef6}body{margin:0;padding:4px 2px 20px;color:var(--ink);font:15px/1.85 system-ui,sans-serif;overflow-wrap:anywhere}
    @media(prefers-color-scheme:light){:root{--ink:#182a3f}}:root[data-theme=light]{color-scheme:light;--ink:#182a3f}:root[data-theme=dark]{color-scheme:dark;--ink:#e8eef6}
    article{white-space:pre-wrap}mark{color:inherit;background:color-mix(in srgb,var(--tag) 26%,transparent);border-radius:3px;box-decoration-break:clone;-webkit-box-decoration-break:clone;padding:2px 0}
    .animated span{animation:reveal 180ms ease-out var(--delay)}@keyframes reveal{from{opacity:.9}to{opacity:1}}@media(prefers-reduced-motion:reduce){.animated span{animation:none}}
    .sr{position:absolute;width:1px;height:1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap}::selection{background:#79b8e65c}html{scrollbar-width:thin;scrollbar-color:#7e90a6 transparent}
  </style></head><body><article aria-label="Message template"><span class="sr">${escape(message)}</span><span class="animated" aria-hidden="true">${content}</span></article></body></html>`;
  return <iframe key={`${name}-${theme}`} title={`${name} highlighted message preview`} sandbox="" srcDoc={doc} className="block h-[360px] w-full border-0 sm:h-[400px]"/>;
}
