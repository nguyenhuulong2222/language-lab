import { describe, it, expect, vi } from "vitest";
import { loadAnswerKey } from "../civics-answer-key";
import { officialAnswerLines } from "../official-answer-text";

describe.each(["2008", "2025"] as const)("official answer lines, %s", (version) => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const key = loadAnswerKey(version, { production: false });
  warn.mockRestore();

  it("every static question has at least one official line", () => {
    for (const entry of key.values()) {
      const lines = officialAnswerLines(version, entry.id);
      if (entry.answerType === "static") expect(lines?.length, entry.id).toBeGreaterThan(0);
      else expect(lines, entry.id).toBeNull();
    }
  });

  it("an unknown id has no lines", () => {
    expect(officialAnswerLines(version, `${version}-999`)).toBeNull();
  });
});
