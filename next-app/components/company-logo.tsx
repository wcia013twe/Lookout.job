"use client";
import { useState } from "react";
import { companyLogoUrl } from "../lib/company-logo";
import ProfileIcon from "./profile-icon";

export function CompanyLogo({ company }: { company: string }) {
  const providerUrl = companyLogoUrl(company, process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN);
  return <CompanyLogoImage key={`${company}:${providerUrl}`} company={company} url={providerUrl} />;
}
function CompanyLogoImage({ company, url }: { company: string; url: string | null }) {
  const [failed, setFailed] = useState(false);
  return url && !failed ? (
    <img
      src={url}
      alt={`${company} logo`}
      width="38"
      height="38"
      onError={() => setFailed(true)}
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
