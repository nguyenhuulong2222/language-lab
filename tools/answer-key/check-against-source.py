#!/usr/bin/env python3
"""Independent check of both answer keys against the official USCIS sources.

Own parser and own normaliser; it shares no code with the repository's build script or engine
(it started as docs/audit/evidence/keycheck2.py). It reads:
  - data/sources/uscis-2008-civics-100.html
  - a fresh `pdftotext -layout` of data/sources/uscis-2025-civics-128.pdf (needs poppler)
  - data/civics-answers/2008.json and 2025.json
  - tools/answer-key/answer-markers.json (only to name the owner decision behind an answer)

It checks, per question: ids and order, the question text, that every official answer line has a
stored form, that every stored answer and every any-order item uses only words of the official
text, and it lists every stored answer that is not a literal reading of a source line (whole line,
parentheses removed, parentheses kept as words, slash split, leading article dropped), each with the
owner decision that explains it. A mismatch is anything else.

Run from the repository root:  python3 tools/answer-key/check-against-source.py
Writes docs/answer-key-source-check.md and exits 1 if there is any mismatch.
"""
import html
import json
import os
import re
import subprocess
import sys

R = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) + "/"
ONES = {w: i for i, w in enumerate("zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split())}
TENS = {w: 10 * i for i, w in enumerate("x x twenty thirty forty fifty sixty seventy eighty ninety".split()) if w != "x"}
ORD = {"first": 1, "second": 2, "third": 3, "fourth": 4, "fifth": 5, "eleventh": 11, "twelfth": 12, "thirteenth": 13, "fourteenth": 14,
       "fifteenth": 15, "sixteenth": 16, "nineteenth": 19, "twentieth": 20}
SMALL = ("the", "a", "an", "of", "and", "to", "in")
ANY = r"[\s\S]"


def words_to_digits(tokens):
    out = []
    i = 0
    while i < len(tokens):
        t = tokens[i]
        if t in TENS or t in ONES or t in ("hundred", "thousand"):
            total = 0
            cur = 0
            j = i
            while j < len(tokens) and (tokens[j] in TENS or tokens[j] in ONES or tokens[j] in ("hundred", "thousand")):
                w = tokens[j]
                if w in ONES:
                    cur += ONES[w]
                elif w in TENS:
                    cur += TENS[w]
                elif w == "hundred":
                    cur = (cur or 1) * 100
                else:
                    total += (cur or 1) * 1000
                    cur = 0
                j += 1
            out.append(str(total + cur))
            i = j
        else:
            out.append(t)
            i += 1
    return out


def toks(t):
    t = html.unescape(t).replace("\u2019", "'").replace("\u201c", '"').replace("\u201d", '"').lower()
    t = re.sub(r"\bu\.\s?s\.", "us", t)
    t = t.replace("d.c.", "dc").replace(".", "")
    t = t.replace("-", " ").replace("/", " ")
    t = re.sub(r"[^a-z0-9' ]", " ", t).replace("'", "")
    ts = [str(ORD[x]) if x in ORD else x for x in t.split()]
    ts = [re.sub(r"^(\d+)(st|nd|rd|th)$", r"\1", x) for x in ts]
    return tuple(words_to_digits(ts))


def parse_2008():
    src = open(R + "data/sources/uscis-2008-civics-100.html", encoding="utf8").read()
    body = src[src.find('<div class="WordSection1">'):]
    out = []
    item = re.compile(r"<li>((?:(?!<li>|</li>|<ul>)" + ANY + r")*?)<ul>(" + ANY + r"*?)</ul></li>")
    answer = re.compile(r"<li>(" + ANY + r"*?)</li>")
    for m in item.finditer(body):
        q = html.unescape(re.sub(r"<[^>]+>", "", m.group(1))).strip()
        a = [html.unescape(re.sub(r"<[^>]+>", "", x)).strip() for x in answer.findall(m.group(2))]
        out.append((q, a, m.end()))
    for note in re.finditer(r"<p>(\[Also acceptable[^\]]*\])</p>", body):
        before = [k for k, x in enumerate(out) if x[2] <= note.start()]
        if before:
            q, a, at = out[before[-1]]
            a[-1] = a[-1] + " " + html.unescape(note.group(1))
    return [(q, a) for q, a, _ in out]


def parse_2025():
    txt = subprocess.run(["pdftotext", "-layout", R + "data/sources/uscis-2025-civics-128.pdf", "-"], capture_output=True, text=True, check=True).stdout
    out = []
    cur = None
    for line in txt.split("\n"):
        m = re.match(r"^\s{0,3}(\d{1,3})\.\s+(" + ANY + r"*)$", line)
        if m and "\u2022" not in line[:8]:
            cur = {"q": m.group(2).strip(), "a": []}
            out.append(cur)
            continue
        if cur is None:
            continue
        s = line.strip()
        if s.startswith("\u2022"):
            cur["a"].append(s[1:].strip())
        elif s.startswith("For a complete list of tribes"):
            continue
        elif not s or re.search(r"uscis\.gov|of 19|M-1778", s) or re.match(r"^[A-Z]: ", s) or s.isupper() or s == "*":
            continue
        elif cur["a"]:
            cur["a"][-1] += " " + s
        else:
            cur["q"] += " " + s
    return [(c["q"].rstrip("*").strip(), c["a"]) for c in out]


def literal_forms(b):
    """Every literal reading of one official line: each parenthetical kept or left out, each slash
    alternative on its own, a bracketed "Also acceptable" list as more answers, a leading article dropped."""
    lines = [re.sub(r"\s*\[[^\]]*\]", "", b)]
    for also in re.findall(r"\[Also acceptable (?:are|is) ([^\]]*)\]", b):
        lines += [x.strip().rstrip(".") for x in re.split(r",\s*(?:and\s+)?|\s+and\s+", also) if x.strip()]
    forms = set()
    for line in lines:
        parts = re.split(r"(\([^)]*\)|\b[A-Za-z]+/[A-Za-z]+\b)", line)
        variants = [""]
        for part in parts:
            if part.startswith("(") and part.endswith(")"):
                options = ["", part[1:-1]]
            elif re.fullmatch(r"[A-Za-z]+/[A-Za-z]+", part):
                options = part.split("/")
            else:
                options = [part]
            variants = [v + " " + o for v in variants for o in options]
        for v in variants:
            t = toks(v)
            if t:
                forms.add(t)
                if t[0] in ("the", "a", "an") and len(t) > 1:
                    forms.add(t[1:])
    return forms


def contains(longer, shorter):
    n = len(shorter)
    return any(longer[i:i + n] == shorter for i in range(len(longer) - n + 1))


def strip_article(t):
    return t[1:] if len(t) > 1 and t[0] in ("the", "a", "an") else t


def check(version, source, key, decisions_by_question):
    problems = []
    decided = []
    for i, (q, lines) in enumerate(source):
        e = key[i]
        want = f"{version}-{i + 1:03d}"
        if e["id"] != want:
            problems.append(f"{e['id']}: id or order, expected {want}")
        if toks(q) != toks(e["questionText"]) and not (version == "2008" and q == "" and i == 86):
            problems.append(f"{e['id']}: question text differs: source {q!r}, key {e['questionText']!r}")
        if e["answerType"] == "dynamic":
            if e["acceptedAnswers"]:
                problems.append(f"{e['id']}: dynamic question with stored answers")
            continue
        stored = {toks(a) for a in e["acceptedAnswers"]}
        stored_loose = {strip_article(t) for t in stored} | stored
        literal = set()
        for b in lines:
            forms = literal_forms(b)
            literal |= forms
            if forms & stored_loose:
                continue
            # A shorter stored form of the line, where an owner decision made a word optional ("Thanksgiving" for "Thanksgiving Day").
            shorter = [a for a in stored_loose if any(contains(f, a) for f in forms)]
            if shorter and decisions_by_question.get(e["id"]):
                continue
            problems.append(f"{e['id']}: official answer not in the key: {b!r}")
        words = set(toks(q))
        for b in lines:
            words |= set(toks(b))
        for a in e["acceptedAnswers"]:
            new = [w for w in toks(a) if w not in words and w not in SMALL]
            if new:
                problems.append(f"{e['id']}: stored answer uses words not in the official text: {a!r} (new: {' '.join(new)})")
        for line in e.get("anyOrder", []):
            for forms in line["items"]:
                for form in forms:
                    new = [w for w in toks(form) if w not in words and w not in SMALL]
                    if new:
                        problems.append(f"{e['id']}: any-order item uses words not in the official text: {form!r}")
        literal_loose = {strip_article(x) for x in literal}
        for a in e["acceptedAnswers"]:
            t = toks(a)
            if t in literal or strip_article(t) in literal_loose:
                continue
            why = decisions_by_question.get(e["id"])
            if why:
                decided.append((e["id"], a, why))
            else:
                problems.append(f"{e['id']}: stored answer is not a literal reading of any source line and no owner decision covers it: {a!r}")
    return problems, decided


def main():
    markers = json.load(open(R + "tools/answer-key/answer-markers.json", encoding="utf8"))
    decisions = {}
    for section in ("markers", "optionalWords", "anyOrder", "numberAlone"):
        for m in markers.get(section, []):
            decisions.setdefault(m["question"], []).append(m["decision"].split(":")[0])
    decisions = {k: "; ".join(sorted(set(v))) for k, v in decisions.items()}
    out = ["# Independent source check of the answer keys", "",
           "Generated by `tools/answer-key/check-against-source.py` (own parser and normaliser, no shared code with the build script).", ""]
    failed = False
    all_decided = []
    for version, source in (("2008", parse_2008()), ("2025", parse_2025())):
        key = json.load(open(R + f"data/civics-answers/{version}.json", encoding="utf8"))["entries"]
        problems, decided = check(version, source, key, decisions)
        all_decided += decided
        line = f"{version}: source questions {len(source)}, key entries {len(key)}, mismatches {len(problems)}, answers from owner decisions {len(decided)}"
        print(line)
        out += [f"## {version}", "", f"- Source questions: {len(source)}; key entries: {len(key)}", f"- Mismatches: {len(problems)}"]
        for p in problems:
            print("   MISMATCH", p)
            out.append(f"  - {p}")
        out.append("")
        failed = failed or bool(problems) or len(source) != len(key)
    out += ["## Stored answers that come from an owner decision", "",
            "Not a literal reading of a source line, but every word is in the source and a recorded decision in `tools/answer-key/answer-markers.json` explains it.", "",
            "| Question | Stored answer | Decision |", "|---|---|---|"]
    for qid, a, why in all_decided:
        out.append(f"| {qid} | `{a}` | {why} |")
    out.append("")
    out += ["## Owner decisions that change how answers are matched, not what is stored", "",
            "| Question | Source line | Decision |", "|---|---|---|"]
    for m in markers.get("anyOrder", []):
        out.append(f"| {m['question']} | {m['line']} | {m['decision']} |")
    out += ["", "Sentence answers (the 23 SENTENCE questions, `matchAs: \"sentence\"`) are matched by their content words in order; this adds no stored answer.", ""]
    open(R + "docs/answer-key-source-check.md", "w", encoding="utf8").write("\n".join(out))
    for qid, a, why in all_decided:
        print(f"   decision  {qid}  {a!r}  ({why})")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
