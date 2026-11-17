/**
 * Fictional English practice Q&A items for the speech recognition test tool.
 *
 * Content safety rules applied:
 * - No real names, addresses, dates of birth, or any personal details.
 * - No suggestion of what a user should claim on a real application.
 * - No current officeholder names. Generic civics facts only.
 * - Items are fictional practice examples only. Not legal advice.
 * - Do not use AI to translate questionText or expectedAnswer.
 */

export interface PracticeItem {
  id: string;
  /** The question shown and spoken to the tester. */
  questionText: string;
  /** The model answer the tester is asked to say aloud. Accuracy is scored against this. */
  expectedAnswer: string;
  /** Category shown to the tester for context. */
  category: "civics" | "n400" | "reading";
}

export const PRACTICE_ITEMS: PracticeItem[] = [
  // Civics
  {
    id: "q01",
    category: "civics",
    questionText: "What is the supreme law of the land?",
    expectedAnswer: "The Constitution is the supreme law of the land.",
  },
  {
    id: "q02",
    category: "civics",
    questionText: "What does Congress do?",
    expectedAnswer: "Congress makes the laws in the United States.",
  },
  {
    id: "q03",
    category: "civics",
    questionText: "What are the first ten amendments to the Constitution called?",
    expectedAnswer: "The first ten amendments are called the Bill of Rights.",
  },
  {
    id: "q04",
    category: "civics",
    questionText: "How many senators are in Congress?",
    expectedAnswer: "There are one hundred senators in Congress.",
  },
  {
    id: "q05",
    category: "civics",
    questionText: "What is the head of the executive branch called?",
    expectedAnswer: "The head of the executive branch is the President.",
  },
  {
    id: "q06",
    category: "civics",
    questionText: "What ocean is on the east coast of the United States?",
    expectedAnswer: "The Atlantic Ocean is on the east coast of the United States.",
  },
  {
    id: "q07",
    category: "civics",
    questionText: "What are the two major political parties in the United States?",
    expectedAnswer: "The two major political parties are the Democrats and the Republicans.",
  },
  {
    id: "q08",
    category: "civics",
    questionText: "During which war was Abraham Lincoln president?",
    expectedAnswer: "Abraham Lincoln was president during the Civil War.",
  },
  // N-400 biographical practice (generic, fictional — not a guide for real answers)
  {
    id: "q09",
    category: "n400",
    questionText: "How long have you lived in this country?",
    expectedAnswer: "I have lived in this country for five years.",
  },
  {
    id: "q10",
    category: "n400",
    questionText: "Have you always filed your taxes on time?",
    expectedAnswer: "Yes, I have always filed my taxes on time.",
  },
  {
    id: "q11",
    category: "n400",
    questionText: "Have you ever been a member of a group that wanted to overthrow the government?",
    expectedAnswer: "No, I have never been a member of any such group.",
  },
  {
    id: "q12",
    category: "n400",
    questionText: "Do you support the Constitution of the United States?",
    expectedAnswer: "Yes, I support the Constitution of the United States.",
  },
  {
    id: "q13",
    category: "n400",
    questionText: "Are you willing to take the oath of allegiance?",
    expectedAnswer: "Yes, I am willing to take the oath of allegiance.",
  },
  {
    id: "q14",
    category: "n400",
    questionText: "How long have you been a permanent resident?",
    expectedAnswer: "I have been a permanent resident for the past six years.",
  },
  {
    id: "q15",
    category: "n400",
    questionText: "Have you traveled outside the United States for more than six months at a time?",
    expectedAnswer: "No, I have not traveled outside the United States for more than six months at a time.",
  },
  // Reading-style sentences
  {
    id: "q16",
    category: "reading",
    questionText: "Please read this sentence aloud.",
    expectedAnswer: "Citizens have the right to vote.",
  },
  {
    id: "q17",
    category: "reading",
    questionText: "Please read this sentence aloud.",
    expectedAnswer: "Congress passes laws in the United States.",
  },
  {
    id: "q18",
    category: "reading",
    questionText: "Please read this sentence aloud.",
    expectedAnswer: "The White House is in Washington D.C.",
  },
  {
    id: "q19",
    category: "reading",
    questionText: "Please read this sentence aloud.",
    expectedAnswer: "The flag of the United States has fifty stars.",
  },
  {
    id: "q20",
    category: "reading",
    questionText: "Please read this sentence aloud.",
    expectedAnswer: "People have the right to freedom of speech.",
  },
];
