"use client";
import { useState } from "react";
import { companyLogoUrl } from "../lib/company-logo";
import { normCompany } from "../lib/role-display";
import logos from "../../data/logo-manifest.json";
import ProfileIcon from "./profile-icon";

export function CompanyLogo({ company }: { company: string }) {
  const providerUrl = companyLogoUrl(company, process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN);
  const cachedUrl = (logos as Record<string, { url: string }>)[normCompany(company)]?.url;
  return <CompanyLogoImage key={`${company}:${providerUrl}:${cachedUrl}`} company={company} urls={[normCompany(company) === "google" ? `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/brand/google-g.png` : null, providerUrl, cachedUrl].filter((url): url is string => Boolean(url))} />;
}
function CompanyLogoImage({ company, urls }: { company: string; urls: string[] }) {
  const [attempt, setAttempt] = useState(0);
  const url = urls[attempt];
  return url ? (
    <img
      src={url}
      alt={`${company} logo`}
      width="38"
      height="38"
      onError={() => setAttempt(value => value + 1)}
      className="h-10 w-10 shrink-0 rounded-lg bg-white object-contain p-1"
    />
  ) : (
    <span
      aria-hidden="true"
      className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-board-tag text-board-muted"
    >
      <ProfileIcon name="briefcase" width={24} height={24} />
    </span>
  );
}
