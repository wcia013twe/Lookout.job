export type ResumeRecord = { id: string; name: string; variant?: string; version?: number; objectPath?: string; contentHash?: string; supersededBy?: string | null; url?: string };
export type AnswerRecord = { id: string; question: string; answer: string; companyScope: string; policy: string; imported?: boolean; verifiedAt?: string; requestedPolicy?: string };
export type TierListReference = { id: string; name: string; employmentType?: string };
export function errorMessage(error: unknown): string { return error instanceof Error ? error.message : "Something went wrong. Please retry."; }
