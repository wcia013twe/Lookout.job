"use client";

import { asset } from "../lib/workspace";
import styles from "./google-sign-in-button.module.css";

export default function GoogleSignInButton({onClick,disabled=false,label="Sign in with Google",className=""}:{onClick:()=>void;disabled?:boolean;label?:string;className?:string}) {
  return <button type="button" className={`${styles.button} ${className}`} disabled={disabled} onClick={onClick}>
    <img src={asset("brand/google-g.png")} width={20} height={20} alt="" aria-hidden="true"/>
    <span>{label}</span>
  </button>;
}
