#!/usr/bin/env python3
"""Runs the guard against calls it must block and calls it must allow.

Run from the repository root:  python3 .kiro/hooks/scripts/test_block_sensitive_paths.py
Prints one line per case and exits 1 if any case is wrong.
"""
import json
import pathlib
import subprocess
import sys

HOOK = pathlib.Path(__file__).with_name("block_sensitive_paths.py")


def run(raw):
    return subprocess.run([sys.executable, str(HOOK)], input=raw, text=True, capture_output=True).returncode


def bash(command):
    return json.dumps({"toolName": "execute_bash", "toolInput": {"command": command}})


def file_call(tool, path):
    return json.dumps({"toolName": tool, "toolInput": {"path": path}})


BLOCK = [
    ("read_file tools/speech-test/.env", file_call("read_file", "tools/speech-test/.env")),
    ("read_file absolute .env.local", file_call("read_file", "/abs/path/.env.local")),
    ("fs_write worker/.dev.vars", file_call("fs_write", "worker/.dev.vars")),
    ("str_replace language-lab-private/notes.md", file_call("str_replace", "language-lab-private/notes.md")),
    ("bash cat tools/speech-test/.env", bash("cat tools/speech-test/.env")),
    ("bash grep ... tools/speech-test/.env | cut", bash("grep -E '^OPENAI_API_KEY=' tools/speech-test/.env | cut -c1-5")),
    ("bash cat .e*", bash("cat .e*")),
    ("bash cat .e?v", bash("cat .e?v")),
    ("bash cat .[e]nv", bash("cat .[e]nv")),
    ("bash cat '.e''nv' (split by quotes)", bash("cat '.e''nv'")),
    ("bash cd dir && cat .env", bash("cd tools/speech-test && cat .env")),
    ("bash set -a; . ./.env", bash("set -a; . ./.env; set +a")),
    ("bash cat < .dev.vars", bash("cat < .dev.vars")),
    ("input that is not JSON is refused", "not json"),
]
ALLOW = [
    ("read_file .env.example", file_call("read_file", "tools/speech-test/.env.example")),
    ("read_file src/environment.ts", file_call("read_file", "src/environment.ts")),
    ("read_file src/ui/PracticeApp.tsx", file_call("read_file", "src/ui/PracticeApp.tsx")),
    ("bash npm run typecheck", bash("npm run typecheck")),
    ("bash grep -rn envelope src", bash("grep -rn envelope src")),
    ("bash ls -la", bash("ls -la")),
    ("bash cat .gitignore", bash("cat .gitignore")),
]
failed = False
print("--- must block (exit 2)")
for name, raw in BLOCK:
    code = run(raw)
    failed |= code != 2
    print(("ok   " if code == 2 else "FAIL ") + f"exit {code}  {name}")
print("--- must allow (exit 0)")
for name, raw in ALLOW:
    code = run(raw)
    failed |= code != 0
    print(("ok   " if code == 0 else "FAIL ") + f"exit {code}  {name}")
print("SOME FAILED" if failed else "ALL OK")
sys.exit(1 if failed else 0)
