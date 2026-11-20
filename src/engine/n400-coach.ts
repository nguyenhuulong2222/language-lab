/**
 * src/engine/n400-coach.ts
 *
 * The one interface the N-400 interview screen talks to. Today only the scripted coach exists:
 * it asks the questions of data/practice/n400-questions.json in order, offers the sample answer
 * of the fictional profile, and gives no feedback. A later Worker-backed coach can implement the
 * same interface (follow-up questions, feedback) and the screen does not change.
 *
 * Rules for every implementation:
 * - Feedback never suggests what a user should claim and never scores civics.
 * - Sample answers belong to the fictional profile only.
 * - No real personal data is sent anywhere by this module.
 */
import type { N400Feedback } from "../contracts/session.js";
import type { N400Question, PracticeProfile } from "./practice-content.js";

export interface N400Answer {
  questionId: string;
  questionText: string;
  /** What the user said or typed. */
  transcript: string;
}

export interface N400Context {
  profile: PracticeProfile;
  /** Answers so far, in order. */
  answered: readonly N400Answer[];
}

export interface N400Prompt {
  id: string;
  text: string;
  /** The fictional profile's answer, or null when the coach has none. */
  sampleAnswer: string | null;
}

export interface N400Coach {
  /** The next question, or null when the interview is over. */
  nextQuestion(context: N400Context): Promise<N400Prompt | null>;
  /** Feedback on the latest answer, or null when this coach gives none. */
  feedback(context: N400Context, answer: N400Answer): Promise<N400Feedback | null>;
}

/** Asks every scripted question once, in order. No feedback, no scoring. */
export function createScriptedN400Coach(questions: readonly N400Question[]): N400Coach {
  return {
    nextQuestion(context) {
      const next = questions[context.answered.length];
      if (next === undefined) return Promise.resolve(null);
      return Promise.resolve({
        id: next.id,
        text: next.text,
        sampleAnswer: next.sampleAnswers[context.profile.id] ?? null,
      });
    },
    feedback() {
      return Promise.resolve(null);
    },
  };
}
