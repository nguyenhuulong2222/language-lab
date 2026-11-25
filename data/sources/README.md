# Source files for the civics answer keys

These are official USCIS documents, kept unchanged so every answer in `data/civics-answers/`
can be traced back to its source. Do not edit them. Files are public U.S. government
documents; Language Lab is an independent project and is not affiliated with USCIS.

The "AIza…" strings in the saved uscis.gov pages (one in each of the five saved HTML pages) are uscis.gov's own public browser key, embedded by USCIS in its page settings. They are not a Language Lab secret, and the pages are kept unchanged (audit F-03, December 2026).

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

## Reading and writing vocabulary (booth screens)

| File | Official source | Role |
|---|---|---|
| `uscis-reading-vocab.pdf` | https://www.uscis.gov/sites/default/files/document/guides/reading_vocab.pdf (rev. 08/08), fetched 2026-11-17 | Official reading vocabulary list. |
| `uscis-writing-vocab.pdf` | https://www.uscis.gov/sites/default/files/document/guides/writing_vocab.pdf (rev. 08/08), fetched 2026-11-17 | Official writing vocabulary list. |
| `uscis-reading-vocab.txt`, `uscis-writing-vocab.txt` | `pdftotext -layout` of the PDFs above | Text view, used to transcribe `data/practice/vocabulary.json`. |

```
56be9761b36d44afdbf6efeb825330232bd089d55eb1cf2865d00999a98db04a  uscis-reading-vocab.pdf
217244ecfb9ed6c5d79f9c281f9c1f6e4290ea358ced85192522b6218431bc08  uscis-writing-vocab.pdf
0e31a58adffd3cf04456fa381353dc1ce3494ae780a1ee8a5f0375404fd0be30  uscis-reading-vocab.txt
5bf1428c9d6a8373249fce41968ee9d5c13621488f9e1a56a5437ef9d1677261  uscis-writing-vocab.txt
```
## Scoring guidelines for the reading and writing portions
| File | Official source | Role |
|---|---|---|
| `uscis-policy-manual-vol12-parte-ch2.html` | https://www.uscis.gov/policy-manual/volume-12-part-e-chapter-2 (USCIS Policy Manual, Vol. 12, Part E, Ch. 2 "English and Civics Testing"), fetched 2026-11-18 | The page as fetched. Section D has the reading and writing guidelines. |
| `uscis-policy-manual-vol12-parte-ch2-reading-writing.txt` | Extracted from the page above | The "Reading Test" and "Writing Test" passages only, with line breaks added and nothing else changed. The spec quotes it. |
```
2aa57c88ab539dcb0a0f3417ae49865d1992e502b5aeea969a5125fb190ec2fd  uscis-policy-manual-vol12-parte-ch2.html
faa3c1e092e28cb2c9991aa7dc63f8315b825ec80b9965184dacdebebb10832b  uscis-policy-manual-vol12-parte-ch2-reading-writing.txt
```
The manual does not define "content word" or "short word". Language Lab uses the "Other (Function)" columns of the two official vocabulary lists above for "short words" (see `data/practice/practice-config.json`).

The practice sentences in `data/practice/` were written by this project, not taken from USCIS. They use only words from these lists.

## 65/20 special consideration (release/finish, Step 1)
| File | Official source | Role |
|---|---|---|
| `uscis-study-for-the-test.html` | https://www.uscis.gov/citizenship/find-study-materials-and-resources/study-for-the-test, fetched 2026-11-20 | The "65/20 Special Consideration" paragraph: 10 questions from a bank of 20, the asterisk, language of choice. |
| `uscis-2025-civics-test.html` | https://www.uscis.gov/citizenship-resource-center/naturalization-test-and-study-resources/2025-civics-test, fetched 2026-11-20 (page "Last Reviewed/Updated: 09/17/2025") | Checked for 65/20 rules: the page states none. Kept as the evidence of that. |
| `uscis-exceptions-and-accommodations.html` | https://www.uscis.gov/citizenship/exceptions-and-accommodations, fetched 2026-11-20 (page "Last Reviewed/Updated: 01/09/2026") | Civics test in the native language with an interpreter; 65/20 special consideration. The app links this page. |
| `uscis-65-20-passages.txt` | Copied from the three pages above and from `uscis-policy-manual-vol12-parte-ch2.html` (already saved, Section E.2 "Special Consideration") | The quoted sentences only, word for word. A test checks each one is in its page. |

The 2025 list (`uscis-2025-civics-128.pdf`, page 1) and the 2008 text (`uscis-2008-civics-100-rev0119.txt`, line 12) also state the 65/20 rule and mark the 20 designated questions with an asterisk; `data/civics-65-20.json` lists them and a test checks it against both lists and the 2008 web page.
```
80c519afbd353ef7b083ea568c0d9dc2e3de1a35b33c3abe7b7907ba5c23fa06  uscis-study-for-the-test.html
9beac946fe2109fb229b7e5f84b13a3b0a8f52415589347210e758e15dfd5afd  uscis-2025-civics-test.html
35d27cc43d5b1cec4e58017897f381afbc16828d762e6e92adc5aa228d62aeb4  uscis-exceptions-and-accommodations.html
afdf38d9b6fdb5782f37feb0e495833b5b39c5477a572c0609242dcfc65e0b31  uscis-65-20-passages.txt
```
