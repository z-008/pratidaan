/** Typed client for the Pratidaan API. */

export type Severity = 'urgent' | 'high' | 'moderate' | 'watch';

/** A Donor. The New donor is a new user with no records, so their blood group, district and body measures are null. */
export interface Donor {
  id: string; name: string; sex: 'M' | 'F' | null; age: number | null; bloodGroup: string | null; language: string; district: string | null;
  heightCm: number | null; smoker: boolean | null; familyHistory: string[]; communityIds: string[]; newUser?: boolean;
  consent: { shareHealthWithInsurer: boolean; showOnLeaderboard: boolean; includeInCommunityStats: boolean };
}

export interface Finding { id: string; title: string; severity: Severity; detail: string; evidence?: string[]; protocolId?: string; date?: string }

export interface Recipient { patient: string; context: string; contextKey: string; place: string; outcome: string; generalised: boolean }

export interface Journey {
  id: string; kind: string; name: string; shelf: string; role: string; donationDate: string; centre: string;
  status: string; statusLabel: string; helped: boolean; withheld: boolean;
  events: { type: string; label: string; when: string }[];
  recipient: Recipient | null;
  fractionation: { poolSize: number; albuminVials: number; ivigVials: number; factorViiiIu: number } | null;
  expiry: { days: number; issuedMeanwhile: number; alsoExpired: number; cause: string[]; effect: string[] } | null;
}

export interface Concern {
  id: string; category: string; categoryLabel: string; details: string; unitId: string | null; unitName: string | null;
  createdOn: string; status: 'open' | 'resolved'; owner: string; level: number; levels: number; dueOn: string;
  overdue: boolean; answered: boolean; canEscalate: boolean; nextOwner: string | null;
  steps: { on: string; text: string }[];
}

export interface ImpactSummary {
  components: number; patientsHelped: number; medicineDosesShare: number; children: number; inProgress: number;
  contexts: { context: string; count: number }[];
}

export interface AIStatus { model: string; live: boolean; reason: string | null; tokensUsedToday: number; dailyTokenBudget: number; callsToday: number; cacheReadTokens: number; rateLimitRps: number }

export interface Overview {
  donor: Donor; today: string;
  donations: { completed: number; deferred: number; firstDate: string | null; litres: number };
  impact: ImpactSummary; latestJourney: Journey | null;
  health: { score: number | null; previousScore: number | null; findings: Finding[] };
  eligibility: Eligibility;
  /** null until an insurer is linked */
  cover: { base: number; current: number; eligible: number; next: number | null; pointsToNext: number | null; blockedBy: string | null } | null;
  communities: { id: string; name: string; kind: string; memberCount: number; notCounted: number; totals: { donations: number; patientsHelped: number } }[];
  ai: AIStatus;
  badges?: Badge[];
  newBadges?: string[];
}

export interface Eligibility { eligibleNow: boolean; nextEligibleDate: string | null; gapDays: number; lastDonationDate: string | null; blockers: string[] }

export interface ScorePart { name: string; weight: number; points: number; value: string }
export interface LabPoint { id: string; date: string; value: number; unit: string; low: number | null; high: number | null; name: string; source: string }
export interface HealthData {
  findings: Finding[];
  scores: { date: string; score: number; parts: ScorePart[] }[];
  currentScore: { score: number; parts: ScorePart[] } | null;
  vitals: { date: string; status: string; systolic: number; diastolic: number; haemoglobin: number; weightKg: number; pulse: number }[];
  labs: Record<string, LabPoint[]>;
  eligibility: Eligibility;
  bmi: number | null;
}

/** Cover for a Donor with no insurer linked yet (the New donor). */
export interface CoverNotLinked {
  linked: false; healthScore: number | null; conditions: Record<string, { met: boolean; detail: string }>; demo: boolean;
}

export interface CoverData {
  linked: true;
  policy: { sponsor: string; kind: string; premium: number; paidBy: string };
  baseTerms: { label: string; value: string }[];
  stack: {
    layers: { name: string; insurer: string; cover: number; kind: 'base' | 'personal' | 'topup'; order: number; note: string; deductible?: number; premium?: number }[];
    total: number; multiple: boolean;
  };
  discounts: {
    rows: { id: string; label: string; rule: string; percent: number; met: boolean }[];
    percentOff: number; cap: number; premiumsYouPay: { name: string; premium: number }[]; fullPremium: number; saving: number;
  };
  baseCover: number; currentCover: number; eligibleCover: number; nextStep: number | null; pointsToNextStep: number | null;
  healthScore: number; relativeRisk: number; blockedBy: string | null; method: string; demo: boolean;
  /** What the insurer Choice does now: cover with sharing on, and off (the base) */
  insurerEffect: { on: number; off: number; qualifies: number; next: number | null; scoreForNext: number | null; needsVisit: boolean };
  conditions: Record<string, { met: boolean; detail: string }>;
  history: { date: string; score: number; cover: number }[];
}

export interface Stakeholder {
  id: string; name: string; icon: string; headline: string; story: string;
  metrics: { label: string; value: string | number }[];
  drilldown: { label: string; value: number }[];
}

export interface Community {
  id: string; name: string; kind: string; description: string; memberCount: number;
  totals: { donations: number; patientsHelped: number; activeThisYear: number };
  participation: number; contexts: { context: string; count: number }[];
  bloodGroups: { group: string; count: number }[];
  leaderboard: { name: string; isYou: boolean; onlyYou: boolean; donations: number; patientsHelped: number }[];
  /** members left out of every total because their Choice is off */
  notCounted: number;
  hiddenMembers: number; privacyNote: string;
}

export interface AgentStep { tool: string; input: Record<string, unknown>; ms: number; summary: string }


export interface ExtractedResult {
  marker: string; printedName: string; printedValue: string; printedUnit: string; value: number; confidence: string;
  name: string; unit: string; loinc: string; plausible: boolean; previous: { value: number; date: string } | null;
}
export interface Extraction { labName: string; reportDate: string; results: ExtractedResult[]; unmapped: string[]; notes: string }

export interface Insight { title: string; message: string; cta: string; generatedBy: string; considered: string[]; aiUnavailable?: string }

export interface ChartPoint { date: string; value: number; value2?: number; source: string }
/** Something a Drop reply puts on screen: a navigation, a live Card, a chart, a memory line or a receipt. */
export interface CopilotAction { type: 'navigate' | 'card' | 'chart' | 'memory' | 'receipt'; screen?: string; reason?: string; cardId?: string; marker?: string; points?: ChartPoint[]; text?: string }
export interface CopilotReply {
  reply: string; steps: AgentStep[]; actions: CopilotAction[];
  history: unknown[] | null; offline?: boolean; aiUnavailable?: string;
}

export interface Slot { id: string; centreId: string; centre: string; district: string; date: string; time: string }
export interface Appointment extends Slot { status: string; eventId?: string | null; emailSent?: boolean; emailError?: string; calendarError?: string | null; checkInCode?: string; donorId?: string }
export interface BookingLocation { label: string; lat: number; lng: number; source: 'gps' | 'manual' }
export interface BookingPreferences {
  days: string[];
  timeWindows: string[];
  maxDistanceKm: number | null;
  avoidHolidays: boolean | null;
  reminderMinutes: number[];
  location: BookingLocation | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  onboardingComplete: boolean;
  onboardingSkipped: boolean;
}
export interface BookingTurn {
  preferences: BookingPreferences;
  step: string | null;
  prompt: string | null;
  chips: { id: string; label: string }[];
  ready: boolean;
  places: { id: string; label: string }[];
}
export interface RankedSlot extends Slot {
  distanceKm: number | null;
  score: number;
  reasons: string[];
}

export interface Network {
  asOf: string; donors: number; donations: number; deferrals: number; components: number; patientsHelped: number;
  wastage: number; repeatDonorRate: number; labTests: number;
  byKind: { kind: string; name: string; count: number }[];
  byContext: { context: string; count: number }[];
  byHospitalKind: { kind: string; count: number }[];
  screening: { elevatedBp: number; prediabetes: number; lowHb: number; donorsWithCoverIncrease: number };
}

export interface Trace { id: string; at: string; feature: string; model: string; ms: number; stopReason?: string; inputTokens?: number; outputTokens?: number; cacheReadTokens?: number; error?: string }

export interface AuthUser {
  sub?: string;
  email: string;
  name: string;
  picture: string;
  expiresAt: number | null;
  local?: boolean;
  guest?: boolean;
}

/** What "Your data" shows about the Google account: profile, sign-in history and every booking. */
export interface AccountBooking { id: string; donorId: string; date: string; time: string; centre: string; district: string; status: string; calendar: boolean }
export interface AccountData {
  local: boolean; guest?: boolean; name: string; email: string; picture: string;
  firstSeen: string | null; signIns: number; lastSignIn: string | null; lastBrowser: string | null; bookings: AccountBooking[];
}
export interface AccountDeleted { bookings: number; calendarRemoved: number; calendarFailed: number; signIns: number; local: boolean }
/** A value read from a lab report photo (the photo itself is not kept). */
export interface UploadedValue { id: string; name: string; value: number; unit: string; date: string; lab: string }

export interface DemoClock { date: string; part: number; partName: 'morning' | 'afternoon' | 'evening' | 'night'; start: string }

export type DropCardType = 'results' | 'urgent' | 'checkin' | 'slots' | 'reminder' | 'impact' | 'report' | 'chart';
/** Opens a Chat in the side sheet with Drop's line and questions. `answers` are fixed replies to a question, by rules. */
export interface ChatOpen { text: string; questions: string[]; goalId?: string; answers?: Record<string, string> }
export interface DropAction { label: string; value: unknown; story?: boolean; ask?: string; open?: ChatOpen }
export interface DropCard {
  id: string; type: DropCardType; variant: string; label: string; urgent: boolean; counted: boolean; createdOn: string;
  text: string; ruleText: string; byAi: boolean; main: DropAction | null; out: DropAction | null; chips: DropAction[];
  wheel: { kind: 'bp'; s: number; d: number } | null; upload: boolean; story: string[] | null; last: StoryLast | null; snoozes: number;
  /** The Story slide (index in the viewer) that shows these new Badges; reaching it clears their "New" mark. */
  badgeSlide: { at: number; ids: string[] } | null;
}
/** The summary postcard that ends a component's Story (backend/src/domain/story.js). */
export interface Postcard { kind: string; component: string; headline: string; context: string; month: string; patientsHelped: number }
/** One of the 8 Badges (backend/src/domain/badges.js). */
export interface Badge {
  id: string; name: string; ring: string; rule: string; goal: string; earned: boolean;
  earnedMonth: string | null; earnedLabel: string | null; completedBy: { componentId?: string; donationId?: string } | null; progress: string | null;
  progressRatio: number | null;
}
/** A Story's shareable last slide: the postcard, or a Badge with how many of the 8 the Donor holds. */
export type StoryLast = { postcard: Postcard } | { badge: Badge; held: number };
export interface DropReading { id: string; marker: 'bp' | 'hb'; date: string; s?: number; d?: number; value?: number; observationId?: string }
/** A Goal (CONTEXT.md): made from results by fixed rules (backend/src/domain/goals.js). */
export type GoalState = 'active' | 'upnext' | 'done' | 'stopped';
export interface DropGoal {
  id: string; name: string; state: GoalState; createdOn: string; doneOn?: string; stoppedOn?: string | null;
  severity?: 'urgent' | 'high' | 'moderate'; stopsDonation?: boolean; target?: string; startsWhen?: string | null; findings?: string[];
  writeup?: GoalWriteup;
  /** What code writes: the trend against the target, the Goal's other findings, the doctor note and the next check */
  urgency?: string; also?: string[]; doctorNote?: string; nextCheck?: string; chat: ChatOpen;
  trend?: { marker: string; label: string; unit: string; points: ChartPoint[]; line: number | null; up: boolean; words: string; range: string };
}
/** Written once per Goal, when it is made or its findings change: "why this matters" and 2-3 tagged steps with evidence. */
export interface GoalWriteup {
  why: string; by: 'rules' | 'ai'; writtenOn: string;
  steps: { tag: 'movement' | 'food' | 'mind' | 'doctor' | 'reading'; text: string; evidence: string[] }[];
}
export interface DropPlan {
  activity: { label: string; minutesPerWeek: number } | null; notes?: string[];
  nextCheckin?: { date: string; marker: string }; reminders: { id: string; label: string; time: string }[];
}
/** A visit Drop booked. Check-ups ('care') carry the doctor and clinic. */
export interface DropBooking {
  id: string; kind: string; date: string; time: string; place: string;
  slotId?: string; urgent?: boolean; guided?: boolean; clinic?: string; address?: string; phone?: string;
  doctor?: string; speciality?: string; cost?: string; reason?: string; bring?: string[]; durationMinutes?: number;
}
/** Drop's Intro for a new user (CONTEXT.md: Intro). */
export type IntroStepId = 'language' | 'hello' | 'journey' | 'health' | 'data' | 'choices' | 'donate' | 'done';
export interface IntroStatus {
  status: 'new' | 'running' | 'done' | 'skipped'; step: number; total: number; finishedOn: string | null; replay: boolean;
  stepId: IntroStepId | null; title: string | null; canReplay: boolean; questions: { q: string; a: string; step: number }[];
}
export interface IntroButton { label: string; value: string; primary?: boolean }
export interface JourneyPicture { label: string; date: string; volumeMl: number; tested: string | null; parts: { name: string; tag: string; good: boolean; text: string }[]; story: string[] }
export interface ResultsPicture { label: string; title: string; rows: { name: string; value: string; status: string; good: boolean }[]; note: string }
export interface DataPicture { rows: { icon: string; what: string; where: string }[]; note: string }
export interface ChoicesPicture { rows: { key: keyof Donor['consent']; label: string; sub: string }[] }
export interface DaysPicture { days: { id: string; label: string }[]; times: { id: string; label: string }[]; places: { id: string; label: string }[] }
export interface SummaryPicture { rows: { what: string; value: string }[] }
export interface IntroStep {
  n: number; id: IntroStepId; title: string; text: string[]; after: string[]; buttons: IntroButton[];
  picture: 'journey' | 'results' | 'data' | 'choices' | 'days' | 'summary' | null;
  pictureData: JourneyPicture | ResultsPicture | DataPicture | ChoicesPicture | DaysPicture | SummaryPicture | null;
}
export interface IntroDonate { days: string | null; time: string | null; place: string | null }
export interface IntroView extends IntroStatus {
  steps: IntroStep[];
  /** The Intro's own words (bar, Skip, coming back, folded line), with {n}, {total}, {title} and {date} to fill in */
  ui: Record<'bar' | 'progress' | 'skip' | 'skipAsk' | 'skipYes' | 'keepGoing' | 'carryOn' | 'carryOnStep' | 'welcomeBack' | 'doneSoFar' | 'backTo' | 'input' | 'watched' | 'finished' | 'skipped' | 'replay' | 'questions', string>;
  prefill: { language: string; choices: Donor['consent']; donate: IntroDonate | null };
  /** The Intro is shown in Drop's language; fallback means some of it had to stay in English */
  translation: { language: string; fallback: boolean };
  saved?: string[];
}

/** Answering a Card that no longer exists (the server restarted, or it was already answered). */
export const isStaleCard = (e: unknown) => /card not found|no longer open|not open/i.test((e as Error)?.message || '');
export interface DropView {
  clock: DemoClock; intro: IntroStatus; language: string; preferredLanguage: string;
  open: DropCard[]; receipts: { id: string; receipt: string; undo: boolean }[]; earlier: { id: string; label: string; receipt: string; on: string }[];
  memory: { id: string; text: string }[]; memReceipt: string | null; plan: DropPlan | null; goals: DropGoal[]; readings: DropReading[]; hiddenResults: string[];
  /** Findings with no Goal of their own, rechecked at the next donation */
  keepAnEye: { id: string; title: string; detail: string }[];
  bookings: DropBooking[];
  donate: { from: string | null; daysTo: number | null };
  budget: { kind: 'goal' | 'healthy'; today: number; perDay: number; week: number; perWeek: number; weekOf: string; report: 'week' | 'month'; quiet: boolean };
  waiting: { name: string; foldOnly: boolean }[]; later: { label: string; status: string; snoozes: number; reason: string | null }[];
  upcoming: { name: string; on: string }[]; log: { at: string; text: string }[];
}
export type SnoozeOption = 'hour' | 'tonight' | 'tomorrow' | 'week';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

let onUnauthorized = () => {};
export function setUnauthorizedHandler(handler: () => void) { onUnauthorized = handler; }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  const body = await response.json().catch(() => ({ success: false, error: `HTTP ${response.status}` }));
  if (response.status === 401) onUnauthorized();
  if (!response.ok || !body.success) throw new ApiError(response.status, body.error || `HTTP ${response.status}`);
  return body.data as T;
}

const post = <T,>(path: string, data?: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(data || {}) });

export const api = {
  authConfig: () => request<{ authDisabled: boolean; clientId: string; sessionMinutes: number }>('/auth/config'),
  me: () => request<AuthUser>('/auth/me'),
  googleSignIn: (credential: string) => post<AuthUser>('/auth/google', { credential }),
  guestSignIn: () => post<AuthUser>('/auth/guest'),
  logout: () => post<{ signedOut: boolean }>('/auth/logout'),
  preferences: () => request<BookingPreferences | null>('/auth/preferences'),
  savePreferences: (preferences: Partial<BookingPreferences>) => request<BookingPreferences>('/auth/preferences', { method: 'PUT', body: JSON.stringify(preferences) }),
  deletePreferences: () => request<null>('/auth/preferences', { method: 'DELETE' }),
  accountData: () => request<AccountData>('/auth/data'),
  deleteSignIns: () => request<{ deleted: number }>('/auth/signins', { method: 'DELETE' }),
  deleteBooking: (id: string, accessToken?: string) => request<{ deleted: string }>(`/auth/bookings/${id}`, { method: 'DELETE', body: JSON.stringify({ accessToken }) }),
  deleteAccount: (body: { accessToken?: string; removeCalendar: boolean }) => request<AccountDeleted>('/auth/account', { method: 'DELETE', body: JSON.stringify(body) }),
  uploadedValues: (id: string) => request<UploadedValue[]>(`/donors/${id}/labs/uploaded`),
  deleteUploadedValue: (id: string, observationId: string) => request<UploadedValue[]>(`/donors/${id}/labs/${observationId}`, { method: 'DELETE' }),
  bookingTurn: (preferences?: Partial<BookingPreferences>, answer?: { step: string; value: string | BookingPreferences['location'] }) =>
    post<BookingTurn>('/auth/booking/turn', { preferences, answer }),
  personas: () => request<{ id: string; name: string; bloodGroup: string | null; language: string; newUser: boolean }[]>('/donors'),
  overview: (id: string) => request<Overview>(`/donors/${id}/overview`),
  impact: (id: string) => request<{ summary: ImpactSummary; journeys: Journey[]; badges: Badge[]; newBadges: string[]; k: number }>(`/donors/${id}/impact`),
  impactStory: (id: string, componentId: string) => request<{ slides: string[]; postcard: Postcard }>(`/donors/${id}/impact/${componentId}/story`),
  stakeholders: (id: string) => request<Stakeholder[]>(`/donors/${id}/stakeholders`),
  health: (id: string) => request<HealthData>(`/donors/${id}/health`),
  cover: (id: string) => request<CoverData | CoverNotLinked>(`/donors/${id}/cover`),
  simulateCover: (id: string, score: number) => request<{ score: number; cover: number; relativeRisk: number }>(`/donors/${id}/cover/simulate?score=${score}`),
  communities: (id: string) => request<Community[]>(`/donors/${id}/communities`),
  consent: (id: string) => request<Donor['consent']>(`/donors/${id}/consent`),
  setConsent: (id: string, consent: Partial<Donor['consent']>) => request<Donor['consent']>(`/donors/${id}/consent`, { method: 'PATCH', body: JSON.stringify(consent) }),
  slots: (id: string) => request<{ eligibility: Eligibility; slots: Slot[] }>(`/donors/${id}/slots`),
  appointments: (id: string) => request<Appointment[]>(`/donors/${id}/appointments`),
  recommend: (id: string, preferences: BookingPreferences, accessToken?: string) =>
    post<{ eligibility: Eligibility; slots: RankedSlot[]; calendarConnected: boolean }>(`/donors/${id}/booking/recommend`, { preferences, accessToken }),
  book: (id: string, body: { slotId: string; preferences: BookingPreferences; accessToken?: string }) => post<Appointment>(`/donors/${id}/appointments`, body),
  cancelAppointment: (id: string, appointmentId: string, accessToken?: string) =>
    post<Appointment>(`/donors/${id}/appointments/${appointmentId}/cancel`, { accessToken }),
  checkIn: (id: string, appointmentId: string, vitals: Record<string, number>) =>
    post<{ status: string; reasons: string[]; visitId: string; components: string[] }>(`/donors/${id}/appointments/${appointmentId}/checkin`, vitals),
  /** `chat` says which Chat the question was asked in (General, a Goal's or a Habit's) */
  copilot: (id: string, message: string, history: unknown[] | null, chat = 'general') => post<CopilotReply>(`/donors/${id}/copilot`, { message, history, chat }),
  chatActive: (id: string, chat = 'general') => request<{ cycleId: string; turns: { at: string; user: string; assistant: string }[]; history: unknown[] | null }>(`/donors/${id}/chat/active?chat=${encodeURIComponent(chat)}`),
  chatCurrentCycle: (id: string) => request<{
    cycleId: string; label: string; startedOn: string;
    chats: Record<string, { turns: { at: string; user: string; assistant: string }[]; history: unknown[] | null }>;
  }>(`/donors/${id}/chat/current-cycle`),
  chatCycles: (id: string) => request<{ cycles: { id: string; label: string; startedOn: string; endedOn: string; chatCount: number; dropCount: number }[] }>(`/donors/${id}/chat/cycles`),
  chatCycle: (id: string, cycleId: string) => request<{
    id: string; label: string; startedOn: string; endedOn: string;
    chats: Record<string, { turns: { at: string; user: string; assistant: string }[]; history: unknown[] | null }>;
    dropEarlier: { id: string; label: string; receipt: string; on: string }[];
  }>(`/donors/${id}/chat/cycles/${encodeURIComponent(cycleId)}`),
  extractLabs: (id: string, input: { text?: string; image?: string }) => post<Extraction>(`/donors/${id}/labs/extract`, input),
  saveLabs: (id: string, extraction: Extraction) => post<{ saved: number; date: string }>(`/donors/${id}/labs/save`, extraction),
  concerns: (id: string) => request<Concern[]>(`/donors/${id}/concerns`),
  raiseConcern: (id: string, body: { category: string; details: string; unitId?: string }) => post<Concern>(`/donors/${id}/concerns`, body),
  concernAction: (id: string, concernId: string, action: 'escalate' | 'resolve') => post<Concern>(`/donors/${id}/concerns/${concernId}/${action}`),
  insight: (id: string) => request<Insight>(`/donors/${id}/insights`),
  network: () => request<Network>('/network'),
  aiStatus: () => request<AIStatus>('/ai/status'),
  traces: () => request<Trace[]>('/ai/traces'),
  drop: (id: string) => request<DropView>(`/donors/${id}/drop`),
  dropReopen: (id: string) => post<DropView>(`/donors/${id}/drop/reopen`),
  dropAnswer: (id: string, cardId: string, value: unknown) => post<DropView>(`/donors/${id}/drop/cards/${cardId}/answer`, { value }),
  dropSnooze: (id: string, cardId: string, option: SnoozeOption) => post<DropView>(`/donors/${id}/drop/cards/${cardId}/snooze`, { option }),
  dropHide: (id: string, cardId: string) => post<DropView>(`/donors/${id}/drop/cards/${cardId}/hide`),
  dropUndo: (id: string) => post<DropView>(`/donors/${id}/drop/undo`),
  dropBadgesSeen: (id: string, ids: string[]) => post<{ newBadges: string[] }>(`/donors/${id}/drop/badges/seen`, { ids }),
  dropOffer: (id: string, kind: 'care_slots' | 'reminder') => post<{ cardId: string; view: DropView }>(`/donors/${id}/drop/offer`, { kind }),
  dropCancelBooking: (id: string, bookingId: string, reschedule: boolean) => post<DropView>(`/donors/${id}/drop/bookings/${bookingId}/cancel`, { reschedule }),
  dropMemoryUndo: (id: string) => post<DropView>(`/donors/${id}/drop/memory/undo`),
  dropForget: (id: string, memoryId?: string) => request<DropView>(`/donors/${id}/drop/memory${memoryId ? `/${memoryId}` : ''}`, { method: 'DELETE' }),
  dropAddReading: (id: string, reading: { s: number; d: number }) => post<DropView>(`/donors/${id}/drop/readings`, reading),
  dropStopGoal: (id: string, goalId: string) => post<DropView>(`/donors/${id}/drop/goals/${goalId}/stop`),
  dropStartGoalAgain: (id: string, goalId: string) => post<DropView>(`/donors/${id}/drop/goals/${goalId}/start-again`),
  dropDeleteReading: (id: string, readingId: string) => request<DropView>(`/donors/${id}/drop/readings/${readingId}`, { method: 'DELETE' }),
  dropHideResult: (id: string, observationId: string) => post<DropView>(`/donors/${id}/drop/results/${observationId}/hide`),
  dropLanguage: (id: string, language: string) => post<DropView>(`/donors/${id}/drop/language`, { language }),
  dropLine: (id: string, screen: string) => request<{ screen: string; text: string; questions: string[]; date: string }>(`/donors/${id}/drop/line/${screen}`),
  intro: (id: string) => request<IntroView>(`/donors/${id}/intro`),
  introAnswer: (id: string, step: number, value: unknown) => post<IntroView>(`/donors/${id}/intro/answer`, { step, value }),
  introSkip: (id: string) => post<IntroView>(`/donors/${id}/intro/skip`),
  introReplay: (id: string) => post<IntroView>(`/donors/${id}/intro/replay`),
  introFinish: (id: string) => post<IntroView>(`/donors/${id}/intro/finish`),
  demoClock: () => request<DemoClock>('/demo'),
  demoAdvance: (parts: number) => post<DemoClock>('/demo/advance', { parts }),
  demoNext: (donorId: string) => post<DemoClock>('/demo/next', { donorId }),
  demoReset: () => post<DemoClock>('/demo/reset'),
};

export const rupees = (n: number) => (n >= 100000 ? `₹${(n / 100000).toFixed(n % 100000 ? 1 : 0)} lakh` : `₹${n.toLocaleString('en-IN')}`);
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
