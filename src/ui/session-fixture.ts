/**
 * Loads the fictional practice session fixture and exposes it typed against
 * the InterviewSession contract. The mock stays in mock/session.json (all
 * practice data is fictional — see the fixture's _note).
 */
import type { InterviewSession } from "../contracts";
import fixture from "../../mock/session.json" with { type: "json" };

export const mockSession = fixture as unknown as InterviewSession;
