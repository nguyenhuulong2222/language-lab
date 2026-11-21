/**
 * src/ui/coach/ai-n400-coach.ts
 *
 * The AI coach as an N400Coach (spec REQ-C01): the questions always come from the scripted coach;
 * `turnFeedback` asks the AI coach session about the current answer only. `feedback` makes no call:
 * it returns what the last `turnFeedback` gave for that question, or the scripted coach's (none).
 */
import type { N400Feedback } from "../../contracts/session";
import type { N400Coach } from "../../engine/n400-coach";
import type { CoachTurnResult } from "../../engine/coach/types";
import type { AiCoachSession } from "./ai-coach-client";

export function createAiN400Coach(scripted: N400Coach, session: AiCoachSession): N400Coach & Required<Pick<N400Coach, "turnFeedback">> {
  const lastFeedback = new Map<string, N400Feedback>();
  return {
    nextQuestion: (context) => scripted.nextQuestion(context),
    feedback(context, answer) {
      const known = lastFeedback.get(answer.questionId);
      return known ? Promise.resolve(known) : scripted.feedback(context, answer);
    },
    async turnFeedback(context, answer): Promise<CoachTurnResult> {
      // Only this answer and the ids: context.answered (earlier turns) is never sent.
      const result = await session.submit({ profileId: context.profile.id, questionId: answer.questionId, answer: answer.transcript });
      if (result.kind === "ai") lastFeedback.set(answer.questionId, { feedback: result.reply.feedback });
      return result;
    },
  };
}
