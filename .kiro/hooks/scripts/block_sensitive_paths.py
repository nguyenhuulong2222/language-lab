#!/usr/bin/env python3
"""PreToolUse guard: refuse tool calls that name a secret file.

Reads the hook payload (JSON) on stdin and checks every string in it. Each string is split into
words and each word into path segments, so `tools/speech-test/.env` is caught, `environment.ts`
and `.env.example` are not. A segment is sensitive when it is:
  - `.env`, or `.env.<anything>` except `.env.example`
  - `.dev.vars` (or `.dev.vars.<anything>`)
  - `language-lab-private`
Quotes and backslashes are removed first (a split name such as `.e` + `nv` in quotes), and a segment
that starts with a literal `.` and holds a glob (`.e*`, `.e?v`, `.*`) is blocked when it could match
a sensitive name.

This is a guard against accidents, not a security boundary. It cannot see inside variables,
encoded strings, scripts that build a name at run time, or files read by a program that was
started earlier. Keep real secrets out of the repository folder.

Exit 2 blocks the call (message on stderr); exit 0 allows it.
"""
import fnmatch
import json
import re
import sys

SENSITIVE_NAMES = (".env", ".dev.vars")
ALLOWED = {".env.example"}
SEPARATORS = re.compile(r"[\s;|&<>()$`=,:{}]+")
GLOB_CHARS = set("*?[")


def strings(obj):
    if isinstance(obj, str):
        yield obj
    elif isinstance(obj, dict):
        for value in obj.values():
            yield from strings(value)
    elif isinstance(obj, list):
        for value in obj:
            yield from strings(value)


def is_sensitive_segment(seg):
    if not seg or seg in ALLOWED:
        return False
    if seg == "language-lab-private":
        return True
    for name in SENSITIVE_NAMES:
        if seg == name or seg.startswith(name + "."):
            return True
    if seg.startswith(".") and GLOB_CHARS & set(seg):
        # A shell glob only matches a dot-file when the pattern starts with a literal dot.
        for name in SENSITIVE_NAMES:
            if fnmatch.fnmatchcase(name, seg):
                return True
    return False


def find(text):
    cleaned = re.sub(r"[\"'\\]", "", text)
    for word in SEPARATORS.split(cleaned):
        for seg in word.split("/"):
            if is_sensitive_segment(seg):
                return seg
    return None


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        print("Blocked: the hook could not read its input, so it refuses the call.", file=sys.stderr)
        return 2
    for text in strings(payload):
        hit = find(text)
        if hit is not None:
            print(f"Blocked: a tool call names a sensitive path ({hit}).", file=sys.stderr)
            return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
