"use client";
import {createContext,useContext} from 'react';
export const Context=createContext(null);
export const basePath=process.env.NEXT_PUBLIC_BASE_PATH||'';
export function asset(path){return `${basePath}/${path}`;}
/** @returns {any} */
export function useWorkspace(){return useContext(Context);}
export function useSlice(path){
 const {state,store}=useWorkspace();
 return [path.split('.').reduce((v,k)=>v?.[k],state),(value)=>store?.set(path,value)];
}
