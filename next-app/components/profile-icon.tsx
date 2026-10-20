import type { SVGProps } from "react";
const paths = {
  user: "M20 21v-2a7 7 0 0 0-14 0v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  briefcase:
    "M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 11l7 4h4l7-4M10 13v4h4v-4M5 7h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z",
  send: "m22 2-7 20-4-9-9-4 20-7ZM22 2 11 13",
  conversation: "M21 11a8 8 0 0 1-8 8H7l-5 3 2-6a8 8 0 1 1 17-5ZM8 10h8M8 14h5",
  award: "m8 14-2 8 6-3 6 3-2-8M19 8a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z",
  mail: "m3 6 9 7 9-7M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
  file: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6ZM14 2v6h6M8 13h8M8 17h6",
  sliders:
    "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 10h6M9 12h6M17 16h6",
  pen: "m16 3 5 5M4 16 16 4a3 3 0 0 1 4 4L8 20l-6 2 2-6Z",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  check: "m5 12 4 4L19 6",
  location:
    "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
};
export type ProfileIconName = keyof typeof paths;
export default function ProfileIcon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: ProfileIconName }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d={paths[name]} />
    </svg>
  );
}
