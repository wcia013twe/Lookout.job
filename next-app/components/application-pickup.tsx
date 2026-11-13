"use client";
import {useWorkspace} from "../lib/workspace";
import {applicationPickupOptions,readApplicationPickup,saveApplicationPickup} from "../../lib/agent-selection.mjs";
import {Field,control} from "./ui";

export default function ApplicationPickup({disabled=false}:{disabled?:boolean}) {
 const w=useWorkspace();
 return <div><Field label="Application pickup"><select className={control} disabled={w.locked || disabled} value={readApplicationPickup(w.state.workflow.searchPreferences)} onChange={event=>saveApplicationPickup(w.store,event.target.value)}>{applicationPickupOptions.map(option=><option key={option.id} value={option.id}>{option.name}</option>)}</select></Field><p className="mt-1 text-sm text-board-muted">Availability depends on your agent. You approve submissions. {w.demo?"Demo changes stay in this preview.":w.syncError?"Account sync needs attention.":!w.user?"Sign in to sync your choice.":w.state.workflow.cloudDirty?"Saving…":"Your agent receives changes when it next checks Lookout."}</p></div>;
}
