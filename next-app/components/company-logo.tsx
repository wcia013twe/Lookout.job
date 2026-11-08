"use client";
import { useState } from "react";
import { companyLogoUrl } from "../lib/company-logo";
import ProfileIcon from "./profile-icon";

type LogoSize = "default" | "small";
export function CompanyLogo({ company, size = "default" }: { company: string; size?: LogoSize }) {
  const providerUrl = companyLogoUrl(company, process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN);
  return <CompanyLogoImage key={`${company}:${providerUrl}`} company={company} url={providerUrl} size={size} />;
}
function CompanyLogoImage({ company, url, size }: { company: string; url: string | null; size: LogoSize }) {
  const [failed, setFailed] = useState(false);
  const small = size === "small";
  return url && !failed ? (
    <img
      src={url}
      alt={`${company} logo`}
      width={small ? 20 : 38}
      height={small ? 20 : 38}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={`shrink-0 bg-white object-contain ${small ? "h-5 w-5 rounded p-0.5" : "h-10 w-10 rounded-lg p-1"}`}
    />
  ) : (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center bg-board-tag text-board-muted ${small ? "h-5 w-5 rounded" : "h-10 w-10 rounded-lg"}`}
    >
      <ProfileIcon name="briefcase" width={small ? 14 : 24} height={small ? 14 : 24} />
    </span>
  );
}
