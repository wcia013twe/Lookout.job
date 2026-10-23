/** Shared calendar label for Circle posts, including the existing timezone policy. */
export function formatPostDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/New_York",
  });
}
