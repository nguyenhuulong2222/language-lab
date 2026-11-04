/**
 * Fictional English practice sentences for the speech recognition test tool.
 *
 * Content safety rules applied:
 * - No real names, addresses, or personal details.
 * - No suggestion of what a user should claim.
 * - Sentences are representative of N-400 biographical answers and civics answers
 *   but are entirely fictional and generic.
 * - Do not use these as a guide for what to say on a real application.
 */

export interface PracticeSentence {
  id: string;
  text: string;
  /** Category shown to the tester for context. */
  category: "civics" | "n400" | "reading";
}

export const PRACTICE_SENTENCES: PracticeSentence[] = [
  // Civics-style answers
  {
    id: "s01",
    category: "civics",
    text: "The Constitution is the supreme law of the land.",
  },
  {
    id: "s02",
    category: "civics",
    text: "Congress makes the laws in the United States.",
  },
  {
    id: "s03",
    category: "civics",
    text: "The President is the head of the executive branch.",
  },
  {
    id: "s04",
    category: "civics",
    text: "There are one hundred senators in Congress.",
  },
  {
    id: "s05",
    category: "civics",
    text: "The Bill of Rights protects the basic rights of Americans.",
  },
  {
    id: "s06",
    category: "civics",
    text: "The two major political parties are the Democrats and the Republicans.",
  },
  {
    id: "s07",
    category: "civics",
    text: "The Atlantic Ocean is on the east coast of the United States.",
  },
  {
    id: "s08",
    category: "civics",
    text: "Abraham Lincoln was president during the Civil War.",
  },
  // N-400-style biographical answers (generic, fictional)
  {
    id: "s09",
    category: "n400",
    text: "I have lived in this country for five years.",
  },
  {
    id: "s10",
    category: "n400",
    text: "I have always filed my taxes on time.",
  },
  {
    id: "s11",
    category: "n400",
    text: "I have never been a member of any group that wanted to overthrow the government.",
  },
  {
    id: "s12",
    category: "n400",
    text: "I support the Constitution of the United States.",
  },
  {
    id: "s13",
    category: "n400",
    text: "I am willing to take the oath of allegiance.",
  },
  {
    id: "s14",
    category: "n400",
    text: "I have been a permanent resident for the past six years.",
  },
  {
    id: "s15",
    category: "n400",
    text: "I have not traveled outside the United States for more than six months at a time.",
  },
  // Reading-aloud sentences (from standard USCIS reading vocabulary)
  {
    id: "s16",
    category: "reading",
    text: "Citizens have the right to vote.",
  },
  {
    id: "s17",
    category: "reading",
    text: "Congress passes laws in the United States.",
  },
  {
    id: "s18",
    category: "reading",
    text: "The White House is in Washington D.C.",
  },
  {
    id: "s19",
    category: "reading",
    text: "The flag of the United States has fifty stars.",
  },
  {
    id: "s20",
    category: "reading",
    text: "People have the right to freedom of speech.",
  },
];
