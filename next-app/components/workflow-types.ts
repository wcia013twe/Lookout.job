export interface ApplicationQuestion {
  id?: string;
  question: string;
  answer: string;
  savedAnswerId?: string;
  savedAnswerVersion?: number;
}

export interface Application {
  imported?: {id:string;record:any;source_rows?:any[]};
  trackerItem?: {appliedDate?:string|null;openedDate?:string|null};
  archived?: boolean;
  id: string;
  company: string; companyId?:string|null;
  title: string;
  status: string;
  searchProfileId?: string;
  employmentType?: string;
  location?: string;
  applicationUrl?: string;
  url?: string;
  backendId?: string;
  backendRevision?: number;
  revision?: number;
  receipt?: { message: string; source: string; observedUrl?: string };
  resumeId?: string;
  blocker?: string;
  questions: ApplicationQuestion[];
  questionsReviewed?: boolean;
  lastAnswerConfirmation?: {id:string;fieldId:string};
  inspectedAt?: string;
  inspectionComplete?: boolean;
  submissionAttempts?: { id: string; state: string; startedAt: string }[];
  activity?: { text: string; actor: string; at: string }[];
  milestones?: ApplicationMilestone[];
  submittedResume?: { name: string; version?: string | number; evidenceSource?: string };
}

export interface ApplicationMilestone {
  id: string;
  application_id?: string;
  kind: string;
  label: string;
  phase: "scheduled" | "completed" | "received";
  occurred_at?: string | null;
  created_at?: string;
  source: { kind: string; note?: string; timestampConfirmed?: boolean; messageId?: string; subject?: string; excerpt?: string; receivedAt?: string; url?: string };
  observedConfirmation?: boolean;
}

export interface PreparationPlan {
  applicationId: string;
  dailyMinutes: number;
  deadline: {
    date: string | null;
    stage: string;
    status: string;
    source: { kind: string; subject?: string; excerpt?: string; messageId?: string; receivedAt?: string; url?: string };
  };
  warnings: string[];
  scheduleChanged?: boolean;
  previousDeadline?: string | null;
  tasks: { id: string; title: string; detail: string; minutes: number; completed: boolean; dueDate?: string | null }[];
  guides: { id: string; title: string; url: string; matchedTopics: string[]; source?: string; observedAt?: string; evidence?: string }[];
}

export interface SavedResume {
  id: string;
  name: string;
  objectPath?: string | null;
  sha256?: string | null;
  version?: number | string | null;
  variant?: string | null;
}

export interface LeaderboardEntry {
  alias: string;
  xp: number;
  streak: number;
  applications_count: number;
}
