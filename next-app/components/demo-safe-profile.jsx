"use client";
import { useWorkspace } from '../lib/workspace';
import { Notice } from './ui';
export default function DemoSafeProfile({children}) {
 const w=useWorkspace();
 return <>{w.demo && <Notice>Fictional profile and settings. Edits stay in memory; private files and account services remain unavailable.</Notice>}{children}</>;
}
