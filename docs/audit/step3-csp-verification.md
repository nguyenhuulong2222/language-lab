# Step 3: CSP verification (SEC-01, SEC-02, PERF-02)

Production build (`npx vite build --outDir /tmp/ll-dist`), served by `docs/audit/evidence/probe.mjs csp` with the
policy copied from `public/_headers`, driven by headless Chrome. Raw output: `evidence/probe-csp-after-step3.json`.

Policy: `default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'`

Screens visited: Home, language menu, Study first, 2008 civics, Picture credits, Reading.
Result: every request went to the page's own origin (`/`, the JS, the CSS, `/fonts/bitter-latin.woff2`), none was
blocked, and the only console message is the deliberate inline-script test (proving the policy is enforced).
Zero violations. Third-party requests: none (before: fonts.googleapis.com and fonts.gstatic.com).

Not covered: playing a recording (`media-src blob:`) needs a microphone; it is allowed by the policy but was not exercised here.
The Cloudflare Pages `_headers` file itself was not run on Cloudflare; the probe applied the same values.
