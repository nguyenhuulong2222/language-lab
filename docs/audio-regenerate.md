# Audio clips to regenerate

The fictional profile "Aurora Vance" was renamed "Aurora Thistlewood" (audit fix pass, Step 9), so that
no practice profile shares a surname with a current or recent national officeholder. The 7 sample-answer
clips of that profile were deleted with their manifest entries, because their ids contained the old
name and the first one spoke it. Until they are generated again, the N-400 screen plays these samples
with the device voice (labelled "Device voice"); nothing else changes.

The audio generator was not run. To make the clips (it calls the OpenAI text-to-speech API and costs
a little; only these 7 are new, every other clip is skipped because its hash is unchanged):

```
node --no-warnings tools/audio/generate-audio.mjs --dry-run --only=n400-samples
node --no-warnings tools/audio/generate-audio.mjs --only=n400-samples
```

The dry run should list exactly these 7 clips:

| Clip id | File | Text |
|---|---|---|
| `n400-001-sample-aurora-thistlewood` | `public/audio/n400/n400-001-sample-aurora-thistlewood.mp3` | My name is Aurora Thistlewood. |
| `n400-002-sample-aurora-thistlewood` | `public/audio/n400/n400-002-sample-aurora-thistlewood.mp3` | I was born in Brazil. |
| `n400-003-sample-aurora-thistlewood` | `public/audio/n400/n400-003-sample-aurora-thistlewood.mp3` | I have lived in the United States for seven years. |
| `n400-004-sample-aurora-thistlewood` | `public/audio/n400/n400-004-sample-aurora-thistlewood.mp3` | I work as a nurse. |
| `n400-005-sample-aurora-thistlewood` | `public/audio/n400/n400-005-sample-aurora-thistlewood.mp3` | Yes. I visited my family for two weeks last year. |
| `n400-006-sample-aurora-thistlewood` | `public/audio/n400/n400-006-sample-aurora-thistlewood.mp3` | I prepare them myself with a tax program. |
| `n400-007-sample-aurora-thistlewood` | `public/audio/n400/n400-007-sample-aurora-thistlewood.mp3` | I want to vote and to help my community. |
