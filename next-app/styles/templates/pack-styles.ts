import type { Tier } from "../../lib/drop-pack";

export type PackStyleId = "prismatic" | "supernova";

export type PackEffectsTemplate = {
  foilTint: string;
  baseParticles: number;
  particlesPerRank: number;
  finalParticleMultiplier: number;
  baseBurstDuration: number;
  burstDurationPerRank: number;
  finalDurationMultiplier: number;
  spread: number;
  finalSpreadMultiplier: number;
  pointScale: number;
  finalPointScale: number;
  gravity: number;
};

export type PackStyleTemplate = {
  id: PackStyleId;
  variables: Record<`--${string}`, string>;
  motion: {
    stageDuration: number;
    finalRevealDuration: number;
    finalHoldMs: number;
    forwardDuration: number;
    forwardDistance: number;
    flareDuration: number;
    flareScale: number;
  };
  effects: PackEffectsTemplate;
};

export const PACK_STYLE_TEMPLATES: Record<PackStyleId, PackStyleTemplate> = {
  prismatic: {
    id: "prismatic",
    variables: {
      "--pack-glow-opacity": ".58",
      "--pack-final-glow-opacity": ".86",
      "--pack-canvas-opacity": ".76",
      "--pack-flare-blur": "10px",
    },
    motion: {
      stageDuration: 0.44,
      finalRevealDuration: 0.92,
      finalHoldMs: 1250,
      forwardDuration: 0.42,
      forwardDistance: 72,
      flareDuration: 1.08,
      flareScale: 2.35,
    },
    effects: {
      foilTint: "#aa85e3",
      baseParticles: 22,
      particlesPerRank: 18,
      finalParticleMultiplier: 1.65,
      baseBurstDuration: 760,
      burstDurationPerRank: 170,
      finalDurationMultiplier: 1.35,
      spread: 190,
      finalSpreadMultiplier: 1.25,
      pointScale: 1,
      finalPointScale: 1.35,
      gravity: 40,
    },
  },
  supernova: {
    id: "supernova",
    variables: {
      "--pack-glow-opacity": ".72",
      "--pack-final-glow-opacity": "1",
      "--pack-canvas-opacity": ".92",
      "--pack-flare-blur": "6px",
    },
    motion: {
      stageDuration: 0.46,
      finalRevealDuration: 1.28,
      finalHoldMs: 1780,
      forwardDuration: 0.52,
      forwardDistance: 96,
      flareDuration: 1.48,
      flareScale: 3.15,
    },
    effects: {
      foilTint: "#c7a4ff",
      baseParticles: 30,
      particlesPerRank: 24,
      finalParticleMultiplier: 2.45,
      baseBurstDuration: 900,
      burstDurationPerRank: 210,
      finalDurationMultiplier: 1.7,
      spread: 220,
      finalSpreadMultiplier: 1.75,
      pointScale: 1.15,
      finalPointScale: 1.85,
      gravity: 34,
    },
  },
};

export function selectPackStyle(tiers: Tier[]): PackStyleId {
  return tiers.some((tier) => tier === "legendary" || tier === "mythic") ? "supernova" : "prismatic";
}

export function resolvePackStyle(id?: string): PackStyleTemplate {
  return PACK_STYLE_TEMPLATES[id as PackStyleId] || PACK_STYLE_TEMPLATES.prismatic;
}
