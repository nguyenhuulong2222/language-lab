/**
 * tools/speech-test/generate-audio.mjs
 *
 * One-time local script: generates MP3 files for all practice item
 * questionText and expectedAnswer strings using the OpenAI TTS API.
 *
 * Usage:
 *   node tools/speech-test/generate-audio.mjs
 *
 * Requirements:
 *   - Create tools/speech-test/.env (gitignored) with:
 *       OPENAI_API_KEY=sk-...
 *   - Node 18+ (uses built-in fetch)
 *
 * Output:
 *   tools/speech-test/audio/
 *     q01-question.mp3
 *     q01-answer.mp3
 *     q02-question.mp3
 *     q02-answer.mp3
 *     ... (40 files total, 2 per item)
 *
 * Skips any file that already exists.
 * The API key is NEVER included in browser code.
 *
 * Model:    gpt-4o-mini-tts
 * Voice:    coral
 * Instruction: "Speak clear American English slowly and naturally, like a patient interviewer."
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Load .env from tools/speech-test/.env (local, gitignored)
// ---------------------------------------------------------------------------

const envPath = path.join(__dirname, ".env");
if (!fs.existsSync(envPath)) {
  console.error(
    `\nError: ${envPath} not found.\n` +
    `Create it with:\n` +
    `  OPENAI_API_KEY=sk-...\n`
  );
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, "utf8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
  process.env[key] = val;
}

const OPENAI_API_KEY = process.env["OPENAI_API_KEY"];
if (!OPENAI_API_KEY || !OPENAI_API_KEY.startsWith("sk-")) {
  console.error(
    `\nError: OPENAI_API_KEY is missing or invalid in ${envPath}.\n` +
    `It must start with "sk-".\n`
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Practice items — inlined to avoid importing TypeScript from an .mjs script
// These must stay in sync with tools/speech-test/sentences.ts
// ---------------------------------------------------------------------------

const PRACTICE_ITEMS = [
  { id: "q01", questionText: "What is the supreme law of the land?",                                        expectedAnswer: "The Constitution is the supreme law of the land." },
  { id: "q02", questionText: "What does Congress do?",                                                      expectedAnswer: "Congress makes the laws in the United States." },
  { id: "q03", questionText: "What are the first ten amendments to the Constitution called?",               expectedAnswer: "The first ten amendments are called the Bill of Rights." },
  { id: "q04", questionText: "How many senators are in Congress?",                                         expectedAnswer: "There are one hundred senators in Congress." },
  { id: "q05", questionText: "What is the head of the executive branch called?",                           expectedAnswer: "The head of the executive branch is the President." },
  { id: "q06", questionText: "What ocean is on the east coast of the United States?",                      expectedAnswer: "The Atlantic Ocean is on the east coast of the United States." },
  { id: "q07", questionText: "What are the two major political parties in the United States?",              expectedAnswer: "The two major political parties are the Democrats and the Republicans." },
  { id: "q08", questionText: "During which war was Abraham Lincoln president?",                             expectedAnswer: "Abraham Lincoln was president during the Civil War." },
  { id: "q09", questionText: "How long have you lived in this country?",                                   expectedAnswer: "I have lived in this country for five years." },
  { id: "q10", questionText: "Have you always filed your taxes on time?",                                  expectedAnswer: "Yes, I have always filed my taxes on time." },
  { id: "q11", questionText: "Have you ever been a member of a group that wanted to overthrow the government?", expectedAnswer: "No, I have never been a member of any such group." },
  { id: "q12", questionText: "Do you support the Constitution of the United States?",                      expectedAnswer: "Yes, I support the Constitution of the United States." },
  { id: "q13", questionText: "Are you willing to take the oath of allegiance?",                            expectedAnswer: "Yes, I am willing to take the oath of allegiance." },
  { id: "q14", questionText: "How long have you been a permanent resident?",                               expectedAnswer: "I have been a permanent resident for the past six years." },
  { id: "q15", questionText: "Have you traveled outside the United States for more than six months at a time?", expectedAnswer: "No, I have not traveled outside the United States for more than six months at a time." },
  { id: "q16", questionText: "Please read this sentence aloud.",                                           expectedAnswer: "Citizens have the right to vote." },
  { id: "q17", questionText: "Please read this sentence aloud.",                                           expectedAnswer: "Congress passes laws in the United States." },
  { id: "q18", questionText: "Please read this sentence aloud.",                                           expectedAnswer: "The White House is in Washington D.C." },
  { id: "q19", questionText: "Please read this sentence aloud.",                                           expectedAnswer: "The flag of the United States has fifty stars." },
  { id: "q20", questionText: "Please read this sentence aloud.",                                           expectedAnswer: "People have the right to freedom of speech." },
];

// ---------------------------------------------------------------------------
// TTS config
// ---------------------------------------------------------------------------

const MODEL      = "gpt-4o-mini-tts";
const VOICE      = "coral";
const INSTRUCTION = "Speak clear American English slowly and naturally, like a patient interviewer.";
const AUDIO_DIR   = path.join(__dirname, "audio");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Call the OpenAI TTS API and return the audio bytes.
 * @param {string} text
 * @returns {Promise<ArrayBuffer>}
 */
async function generateSpeech(text) {
  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      voice: VOICE,
      input: text,
      instructions: INSTRUCTION,
      response_format: "mp3",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${body}`);
  }

  return response.arrayBuffer();
}

/**
 * Save audio bytes to a file, creating directories as needed.
 * @param {string} filePath
 * @param {ArrayBuffer} data
 */
function saveAudio(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, Buffer.from(data));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });

  // Build the list of (filePath, text) pairs to generate
  const tasks = [];
  for (const item of PRACTICE_ITEMS) {
    tasks.push({
      filePath: path.join(AUDIO_DIR, `${item.id}-question.mp3`),
      text: item.questionText,
      label: `${item.id} question`,
    });
    tasks.push({
      filePath: path.join(AUDIO_DIR, `${item.id}-answer.mp3`),
      text: item.expectedAnswer,
      label: `${item.id} answer`,
    });
  }

  const total    = tasks.length;
  let generated  = 0;
  let skipped    = 0;
  let failed     = 0;

  console.log(`\nLanguage Lab — Audio Generator`);
  console.log(`Model: ${MODEL}  Voice: ${VOICE}`);
  console.log(`Output: ${AUDIO_DIR}`);
  console.log(`Tasks: ${total} files\n`);

  for (const task of tasks) {
    if (fs.existsSync(task.filePath)) {
      console.log(`  SKIP  ${path.basename(task.filePath)}`);
      skipped++;
      continue;
    }

    try {
      process.stdout.write(`  GEN   ${path.basename(task.filePath)} … `);
      const data = await generateSpeech(task.text);
      saveAudio(task.filePath, data);
      const kb = Math.round(data.byteLength / 1024);
      console.log(`done (${kb} kB)`);
      generated++;

      // Brief pause to respect rate limits (500 ms between requests)
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (err) {
      console.error(`FAIL  ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone. Generated: ${generated}  Skipped: ${skipped}  Failed: ${failed}`);
  if (failed > 0) {
    console.error(`\n${failed} file(s) failed. Re-run the script to retry them.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`\nFatal: ${err.message}`);
  process.exit(1);
});
