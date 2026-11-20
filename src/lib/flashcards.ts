import { addDays } from './dates';
import type { CollegeState, Flashcard } from './college';
import type { DateKey } from './types';

/** Days until the next review for each Leitner box (1 = every day … 5 = every 16 days). */
export const BOX_INTERVAL = [0, 1, 2, 4, 8, 16];
export const MAX_BOX = 5;
/** Box at which a card counts as "known". */
export const MASTERED_BOX = 4;

export function newCard(input: { id: string; front: string; back: string; subjectId?: string; examId?: string; topicId?: string }, today: DateKey): Flashcard {
  return { ...input, front: input.front.trim(), back: input.back.trim(), box: 1, due: today };
}

/** Right → up a box and wait longer; wrong → back to box 1, due tomorrow. */
export function reviewCard(card: Flashcard, correct: boolean, today: DateKey, now: number): Flashcard {
  const box = correct ? Math.min(MAX_BOX, card.box + 1) : 1;
  return { ...card, box, due: addDays(today, correct ? BOX_INTERVAL[box] : 1), reviewedAt: now };
}

export interface CardFilter {
  subjectId?: string;
  examId?: string;
}

export function cardsFor(cards: readonly Flashcard[] | undefined, f: CardFilter): Flashcard[] {
  return (cards ?? []).filter((c) => (!f.subjectId || c.subjectId === f.subjectId) && (!f.examId || c.examId === f.examId));
}

/** Due today or earlier, lowest box first (weakest cards first). */
export function dueCards(cards: readonly Flashcard[], today: DateKey): Flashcard[] {
  return cards.filter((c) => c.due <= today).sort((a, b) => a.box - b.box || a.due.localeCompare(b.due));
}

export function cardStats(cards: readonly Flashcard[], today: DateKey): { total: number; due: number; mastered: number; masteredShare: number | null } {
  const mastered = cards.filter((c) => c.box >= MASTERED_BOX).length;
  return { total: cards.length, due: cards.filter((c) => c.due <= today).length, mastered, masteredShare: cards.length ? mastered / cards.length : null };
}

export function upsertCard(state: CollegeState, card: Flashcard): CollegeState {
  const cards = state.cards ?? [];
  return { ...state, cards: cards.some((c) => c.id === card.id) ? cards.map((c) => (c.id === card.id ? card : c)) : [...cards, card] };
}

export function removeCard(state: CollegeState, id: string): CollegeState {
  return { ...state, cards: (state.cards ?? []).filter((c) => c.id !== id) };
}
