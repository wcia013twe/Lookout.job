"use client";
import type { ReactNode } from "react";
import { CompanyLogo, type Role } from "./role-card";
import { Dots } from "./onboarding-ui";

/** Shared tutorial card face. Children own the contextual explanation/actions. */
export default function TutorialRoleCard({ role, label, children, className = "", hidden = false }: {
  role: Role | null; label: string; children: ReactNode; className?: string; hidden?: boolean;
}) {
  return <article className={`gold-card ${className}`} aria-hidden={hidden || undefined} inert={hidden || undefined}>
    <div className="gold-banner"><Dots /><span className="gold-tier">{label}</span></div>
    <div className="gold-body">
      {role && <><div className="gold-company"><CompanyLogo company={role.company} /><span>{role.company}</span></div>
        <h2>{role.title}</h2><p className="meta">{role.employmentType === "FT" ? "Full-time" : role.employmentType} · {role.location || "Location not recorded"}</p></>}
      {children}
    </div>
  </article>;
}
