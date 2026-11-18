# Source files for the civics answer keys

These are official USCIS documents, kept unchanged so every answer in `data/civics-answers/`
can be traced back to its source. Do not edit them. Files are public U.S. government
documents; Language Lab is an independent project and is not affiliated with USCIS.

| File | Official source | Role |
|---|---|---|
| `uscis-2025-civics-128.pdf` | https://www.uscis.gov/sites/default/files/document/questions-and-answers/2025-Civics-Test-128-Questions-and-Answers.pdf (M-1778, 09/25) | Official 2025 list. Supplied by the project owner; SHA-256 is identical to a fresh download from the URL on 2026-11-17. |
| `uscis-2025-civics-128.txt` | Converted from the PDF above | Parsed to build `2025.json`. An independent `pdftotext -layout` conversion matches it line for line (596 non-empty lines each). |
| `uscis-2008-civics-100.html` | https://www.uscis.gov/civics-questions-and-answers-2008-version | Official 2008 list, the current web page. Saved on 2026-11-17. Parsed to build `2008.json`. |
| `uscis-2008-civics-100-rev0119.txt` | https://www.uscis.gov/sites/default/files/document/questions-and-answers/100q.txt ("rev. 01/19") | Older official text of the 100 questions with explicit question numbers. Used only to cross-check the numbering of the web page. Not used for answers. |

SHA-256:

```
f280608c0fb6dc1eba344b4746a7ba52d02fe411fba30cedd4371819f0abe11c  uscis-2025-civics-128.pdf
aaefc002514d9189b022ef9deacf8da4bc67f7159bada824578c43057d2c1dad  uscis-2025-civics-128.txt
e8e1015202e503da648db3e3c75056de9903fbf96ea8ecac1a76a133eacc1f42  uscis-2008-civics-100.html
f89f731acbc2c401b638d33880271a70b507e2d8222658ebb90e2d9ece3c9ac2  uscis-2008-civics-100-rev0119.txt
```

The 2020-version text (`M_1778TXT.txt`) that the first stub used for 2025 is NOT a source for
the 2025 key and is not stored here.
