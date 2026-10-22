const normCompany = (name) =>
  String(name)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

/* ---------- Rarity (display badges only, derived from company name) ---------- */
const TIER_ORDER = ["common", "rare", "epic", "legendary", "mythic"];
/* Two track-specific tier lists: FT ranks career signal, Intern ranks conversion + program strength.
     Legendary = asymmetric upside. DoorDash Labs is legendary via the labs-title rule below. */
const RARITY_FT = {
  mythic: ["databricks", "snowflake", "google", "akuna-capital"],
  legendary: [
    "nvidia",
    "amd",
    "jane-street",
    "citadel-securities",
    "hrt",
    "anthropic",
    "openai",
  ],
  epic: [
    "meta",
    "apple",
    "netflix",
    "tesla",
    "stripe",
    "doordash",
    "uber",
    "bloomberg",
    "chalk",
    "tenstorrent",
    "singlestore",
  ],
  rare: ["oracle", "microsoft", "amazon", "cisco", "ibm", "intel"],
};
const RARITY_INTERN = {
  mythic: ["databricks", "snowflake", "google", "akuna-capital"],
  legendary: ["jane-street", "citadel-securities", "hrt", "nvidia"],
  epic: ["bloomberg", "doordash", "uber", "meta", "stripe"],
  rare: ["oracle", "microsoft", "amazon"],
};
const RARITY_LABEL = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
  mythic: "Mythic",
};
const rarityOf = (company, type, title) => {
  const n = normCompany(company);
  const hay = (String(company) + " " + String(title || "")).toLowerCase();
  if (n === "doordash" && hay.includes("labs")) return "legendary";
  const map = /intern/i.test(String(type || "")) ? RARITY_INTERN : RARITY_FT;
  for (let i = TIER_ORDER.length - 1; i >= 0; i--) {
    const t = TIER_ORDER[i];
    if (map[t] && map[t].includes(n)) return t;
  }
  return "common";
};
const tierIndex = (t) => TIER_ORDER.indexOf(t);
const TIER_HEX = {
  common: "#58B368",
  rare: "#4EA8DE",
  epic: "#9B5DE5",
  legendary: "#FFC53D",
  mythic: "#E3350D",
};
// Display only compensation explicitly present in the collected analysis.
const compensationTag = (text) => {
  const t = String(text || "");
  const money =
    /\$\s?[\d,]+(?:\.\d+)?\s?[KkMm]?(?:\s*[-–—]\s*\$?\s?[\d,]+(?:\.\d+)?\s?[KkMm]?)?(?:\s*(?:\/(?:hr|hour|year|yr|week)|per (?:hour|year)))?/g;
  const matches = [...t.matchAll(money)];
  if (!matches.length) return "Comp not listed";
  const labelled = matches.find((m) =>
    /(?:base|salary|total compensation|\bTC\b)\s*[:=]?\s*$/i.test(
      t.slice(Math.max(0, m.index - 30), m.index),
    ),
  );
  const hit = labelled || matches[0];
  const before = t.slice(Math.max(0, hit.index - 30), hit.index);
  const after = t.slice(
    hit.index + hit[0].length,
    hit.index + hit[0].length + 25,
  );
  const kind = /(?:total compensation|\bTC\b)\s*[:=]?\s*$/i.test(before)
    ? "TC"
    : /(?:base|salary)\s*[:=]?\s*$/i.test(before) ||
        /^\s*(?:US\s+)?(?:base|salary)\b/i.test(after)
      ? "Base"
      : "Comp";
  return `${kind} ${hit[0].trim()}`;
};

export { normCompany, rarityOf, RARITY_LABEL, TIER_HEX, compensationTag, tierIndex };
