"use client";
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {safeBoardReturn} from '../../lib/action-board.mjs';
export default function BoardReturn(){const [href,setHref]=useState<string|null>(null);useEffect(()=>{setHref(safeBoardReturn(new URL(location.href).searchParams.get('returnTo')));},[]);return href?<Link className="handoff-action mb-3" href={href}>Back to Action Board</Link>:null;}
