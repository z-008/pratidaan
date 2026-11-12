/** Which Chat (CONTEXT.md): the General Chat, a Goal's, a Habit's, or Past Cycles. */
export type ChatId = 'general' | 'past' | `goal:${string}` | `habit:${string}`;

export interface ChatOpenDetail { chat: ChatId; text: string; questions: string[]; answers: Record<string, string> }

/**
 * Open a Chat in the side sheet (ChatSheet listens for this), with Drop's line and questions.
 * A `goalId` opens that Goal's Chat; with no text, the Chat just opens.
 */
export function openChat(chat: { text?: string; questions?: string[]; goalId?: string; habit?: string; answers?: Record<string, string> } = {}) {
  const id: ChatId = chat.goalId ? `goal:${chat.goalId}` : chat.habit ? `habit:${chat.habit}` : 'general';
  const detail: ChatOpenDetail = { chat: id, text: chat.text || '', questions: chat.questions || [], answers: chat.answers || {} };
  window.dispatchEvent(new CustomEvent('drop:open', { detail }));
}

/** A Habit's Chat. Week plans come in build plan step 6; until then it offers to plan this week. */
export const habitOpener = (name: string) => ({ habit: name.toLowerCase(), text: `${name}: no Week plan yet.`, questions: [`Help me plan this week's ${name.toLowerCase()}`] });

/** Whether the side sheet is open: Home's General Chat leaves Drop's events to it while it is. */
export const sheet = { open: false };
