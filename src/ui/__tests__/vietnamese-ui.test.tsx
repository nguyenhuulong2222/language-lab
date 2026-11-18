/**
 * The interface in Vietnamese: the chrome changes language, the practice content does not.
 */
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { I18nProvider } from "../../i18n/react";
import { loadAnswerKey } from "../../engine/civics-answer-key";
import {
  createDefaultPracticeEnv,
  createPracticeEngine,
  type AnswerKeyResult,
  type PracticeAction,
  type PracticeState,
} from "../../engine/practice-flow";
import { createScriptedN400Coach } from "../../engine/n400-coach";
import type { CivicsTestVersion } from "../../engine/version-selector";
import { Header } from "../components/Header";
import { HomeScreen } from "../screens/HomeScreen";
import { Screen } from "../PracticeApp";
import { formatDate, formatDateTime } from "../format";

const AT = "2026-11-17T10:00:00.000Z";
function quiet(version: CivicsTestVersion): AnswerKeyResult {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    return { status: "ready", key: loadAnswerKey(version, { production: false }) };
  } finally {
    warn.mockRestore();
  }
}
const keys = { "2008": quiet("2008"), "2025": quiet("2025") };
const base = createDefaultPracticeEnv();
const engine = createPracticeEngine({ ...base, answerKey: (v) => keys[v] });
const profile = base.content.profiles[0]!.id;

function inVietnamese(state: PracticeState) {
  const dispatch = (_: PracticeAction) => {};
  return renderToString(
    <I18nProvider language="vi">
      <Screen
        engine={engine}
        state={state}
        dispatch={dispatch}
        coach={createScriptedN400Coach(base.content.n400Questions)}
        civicsLockedInBuild={false}
        now={() => AT}
        seed={() => 1}
        restart={() => {}}
      />
    </I18nProvider>
  );
}

describe("home in Vietnamese", () => {
  const html = renderToString(
    <I18nProvider language="vi">
      <HomeScreen civicsLocked={false} onChoose={() => {}} />
    </I18nProvider>
  );

  it("is in Vietnamese", () => {
    expect(html).toContain("Chào mừng đến buồng luyện tập");
    expect(html).toContain("Buổi phỏng vấn luyện tập đầy đủ");
    expect(html).toContain("Cách hoạt động");
    expect(html).not.toContain("Full practice interview");
  });

  it("says the real interview is in English", () => {
    expect(html).toContain("Buổi phỏng vấn thật được thực hiện bằng tiếng Anh");
  });

  it("keeps the disclaimers, in Vietnamese", () => {
    expect(html).toContain("Xin hãy đọc phần này");
    expect(html).toContain("không liên kết với");
    expect(html).toContain("không phải là tư vấn pháp lý");
  });

  it("says it too in English, since the real interview is in English", () => {
    const en = renderToString(<HomeScreen civicsLocked={false} onChoose={() => {}} />);
    expect(en).toContain("The real interview is held in English unless USCIS allows an exception for you.");
  });
});

describe("practice screens in Vietnamese", () => {
  it("civics: buttons and help in Vietnamese, the question itself in English, with the notice", () => {
    let s = engine.reduce(engine.initial(), { type: "choose", mode: "civics", seed: 3, at: AT });
    s = engine.reduce(s, { type: "start", filedOn: "before", seed: 3, at: AT });
    const question = engine.civicsProgress(s).current!;
    const html = inVietnamese(s);
    expect(html).toContain("Kiểm tra câu trả lời");
    expect(html).toContain("Cách dùng màn hình này");
    expect(html).toContain("Buổi phỏng vấn thật được thực hiện bằng tiếng Anh");
    expect(html).toContain('lang="en"');
    const escaped = question.questionText.replace(/&/g, "&amp;").replace(/'/g, "&#x27;");
    expect(html).toContain(escaped);
    expect(html).not.toContain("Check my answer");
  });

  it("reading and writing: the sentence stays English, the labels are Vietnamese", () => {
    for (const mode of ["reading", "writing"] as const) {
      const s = engine.reduce(engine.initial(), { type: "choose", mode, seed: 3, at: AT });
      const html = inVietnamese(s);
      expect(html).toContain(mode === "reading" ? "Kiểm tra bài đọc của tôi" : "Kiểm tra bài viết của tôi");
      expect(html).toContain("Buổi phỏng vấn thật được thực hiện bằng tiếng Anh");
      expect(html).not.toContain("Check my");
    }
    const reading = engine.reduce(engine.initial(), { type: "choose", mode: "reading", seed: 3, at: AT });
    const sentence = engine.englishProgress(reading, "reading").current!.text;
    expect(inVietnamese(reading)).toContain(sentence.replace(/&/g, "&amp;"));
  });

  it("setup: the choices are Vietnamese, the profile names are not translated", () => {
    const s = engine.reduce(engine.initial(), { type: "choose", mode: "full", seed: 3, at: AT });
    const html = inVietnamese(s);
    expect(html).toContain("Chọn một hồ sơ luyện tập");
    expect(html).toContain("Hồ sơ luyện tập giả định");
    for (const p of base.content.profiles) expect(html).toContain(p.displayName);
    expect(html).toContain("Trước ngày 20 tháng 10, 2025");
    expect(html).toContain("Vào hoặc sau ngày 20 tháng 10, 2025");
  });

  it("the English notice is not shown in English screens", () => {
    const s = engine.reduce(engine.initial(), { type: "choose", mode: "reading", seed: 3, at: AT });
    const html = renderToString(
      <Screen
        engine={engine}
        state={s}
        dispatch={() => {}}
        coach={createScriptedN400Coach(base.content.n400Questions)}
        civicsLockedInBuild={false}
        now={() => AT}
        seed={() => 1}
        restart={() => {}}
      />
    );
    expect(html).not.toContain("The real interview is in English");
  });

  it("the N-400 question and the sample answer stay English", () => {
    let s = engine.reduce(engine.initial(), { type: "choose", mode: "n400", seed: 3, at: AT });
    s = engine.reduce(s, { type: "start", profileId: profile, seed: 3, at: AT });
    // The question loads asynchronously; the loading state is shown on the server render.
    const html = inVietnamese(s);
    expect(html).toContain("Phỏng vấn N-400");
    expect(html).toContain("Đang lấy câu hỏi tiếp theo");
  });

  it("the full report carries the Vietnamese disclaimer next to the engine's English one", () => {
    let s = engine.reduce(engine.initial(), { type: "choose", mode: "full", seed: 3, at: AT });
    s = engine.reduce(s, { type: "start", profileId: profile, filedOn: "before", seed: 3, at: AT });
    s = engine.reduce(s, { type: "finishN400", at: AT });
    for (const kind of ["reading", "writing"] as const) {
      for (;;) {
        const p = engine.englishProgress(s, kind);
        if (p.done || p.current === null) break;
        s = engine.reduce(s, { type: kind === "reading" ? "submitReading" : "submitWriting", transcript: p.current.text, input: "typed", at: AT });
      }
      s = engine.reduce(s, { type: "continue", at: AT });
    }
    for (;;) {
      const p = engine.civicsProgress(s);
      if (p.done || p.current === null) break;
      s = engine.reduce(s, { type: "submitCivics", response: "zzz", input: "typed", at: AT });
    }
    s = engine.reduce(s, { type: "continue", at: AT });
    expect(s.phase).toBe("report");
    const html = inVietnamese(s);
    expect(html).toContain("This is a practice tool only.");
    expect(html).toContain("Đây chỉ là công cụ luyện tập.");
    expect(html).toContain("Có vài điều cần xem lại");
  });
});

describe("the header language button", () => {
  it("offers Vietnamese in English, labelled with its own name", () => {
    const html = renderToString(<Header />);
    expect(html).toContain("header__lang");
    expect(html).toContain('lang="vi"');
    expect(html).toContain("Tiếng Việt");
  });

  it("offers English in Vietnamese", () => {
    const html = renderToString(
      <I18nProvider language="vi">
        <Header />
      </I18nProvider>
    );
    expect(html).toContain("header__lang");
    expect(html).toContain('lang="en"');
    expect(html).toContain(">English<");
    expect(html).toContain("Ngôn ngữ");
  });
});

describe("dates follow the language", () => {
  it("English and Vietnamese forms", () => {
    expect(formatDate("2025-10-20")).toBe("October 20, 2025");
    expect(formatDate("2025-10-20", "vi")).toBe("20 tháng 10, 2025");
    expect(formatDateTime("2024-03-20T10:42:00Z")).toBe("March 20, 2024 at 10:42 AM");
    expect(formatDateTime("2024-03-20T10:42:00Z", "vi")).toContain("2024");
  });
});
