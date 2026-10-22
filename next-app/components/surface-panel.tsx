import { createElement, type ComponentPropsWithoutRef } from "react";

/** Shared Sharing & privacy material, with native section/form semantics. */
export default function SurfacePanel<T extends "section" | "form" | "div" = "section">({
  as,
  className = "",
  ...props
}: { as?: T } & ComponentPropsWithoutRef<T>) {
  return createElement(as || "section", {
    ...props,
    className: `glass-panel surface-panel min-w-0 rounded-2xl p-5 md:p-6 ${className}`,
  });
}
