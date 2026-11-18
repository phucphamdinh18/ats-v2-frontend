"use client";
import {useEffect,useId,useRef,useState,type KeyboardEvent} from "react";
import {ChevronDown,Pencil,Plus} from "lucide-react";
import type {Job} from "@/lib/policy";
import styles from "./bosch-v2-jobs.module.css";
export default function JobActionsMenu({job,onCreate,onEdit,en}:{job:Job|null;onCreate?:()=>void;onEdit?:(job:Job)=>void;en:boolean}) {
 const [open,setOpen]=useState(false),id=useId();
 const wrapper=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),initialLast=useRef(false);
 const editable=!!job&&["DRAFT","OPEN","ON_HOLD"].includes(job.status);
 useEffect(()=>{
  if(!open)return;
  const items=wrapper.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)');
  items?.[initialLast.current?items.length-1:0]?.focus();
  const outside=(e:PointerEvent)=>{if(e.target instanceof Node&&!wrapper.current?.contains(e.target))setOpen(false);};
  document.addEventListener("pointerdown",outside);
  return()=>document.removeEventListener("pointerdown",outside);
 },[open]);
 if(!onCreate&&!onEdit)return null;
 function close(focus=false){setOpen(false);if(focus)trigger.current?.focus();}
 function keys(e:KeyboardEvent<HTMLDivElement>){
  if(e.key==="Escape"){e.preventDefault();e.stopPropagation();close(true);return;}
  if(e.key==="Tab"){close();return;}
  if(!["ArrowDown","ArrowUp","Home","End"].includes(e.key))return;
  e.preventDefault();const items=Array.from(wrapper.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')||[]);
  const at=items.findIndex(x=>x===document.activeElement);
  const next=e.key==="Home"?0:e.key==="End"?items.length-1:(at+(e.key==="ArrowDown"?1:-1)+items.length)%items.length;
  items[next]?.focus();
 }
 return <div className={styles.jobMenu} ref={wrapper}>
  <button type="button" className={styles.addJob} ref={trigger} aria-haspopup="menu" aria-expanded={open} aria-controls={open?id:undefined}
   onClick={()=>{initialLast.current=false;setOpen(x=>!x);}}
   onKeyDown={e=>{if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();initialLast.current=e.key==="ArrowUp";setOpen(true);}}}>
   {en?"Job actions":"Thao tác Job"}<ChevronDown size={17} aria-hidden="true"/>
  </button>
  {open&&<div id={id} role="menu" aria-label={en?"Job actions":"Thao tác Job"} className={styles.jobMenuPanel} onKeyDown={keys}>
   {onCreate&&<button type="button" role="menuitem" onClick={()=>{close();onCreate();}}><Plus size={17} aria-hidden="true"/><span>{en?"Add Job":"Thêm Job"}</span></button>}
   {onEdit&&<button type="button" role="menuitem" disabled={!editable} onClick={()=>{if(job&&editable){close();onEdit(job);}}}>
    <Pencil size={17} aria-hidden="true"/><span>{en?"Edit Job":"Sửa Job"}<small>{job?job.title:(en?"Select a Job first":"Chọn Job trước")}</small></span>
   </button>}
   {!editable&&onEdit&&<p className={styles.jobMenuHint}>{job?(en?"This Job cannot be edited in its current status.":"Trạng thái Job này không cho phép sửa."):(en?"Select a Job in the table to edit it.":"Chọn Job trong bảng để chỉnh sửa.")}</p>}
  </div>}
 </div>;
}
