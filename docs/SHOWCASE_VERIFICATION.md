# Showcase implementation and verification

Verified locally on 19 October 2026. No cloud deployment, purchase or plan change was performed.

## Outcome

`/` opens the public showcase immediately. The former global `WorkspaceAccess` wrapper
caused the password screen; authentication/reviewer context now wraps only `/workspace`
and the existing private paper routes. Spring authentication was not relaxed.

Three genuine exported runs provide all four content formats: 16 carousel images,
9 static sizes, 3 captions and 3 AI-voiced reels. Each case exposes seven workflow
stages, source evidence, independent checks, recorded reviews and educational downloads.
No clinician credentials or clinical endorsement are claimed.

| Case | Original claims | Public claims | Public source passages | Reel |
| --- | ---: | ---: | ---: | ---: |
| Metabolic health — Schulze, DOI 10.1007/s00125-018-4787-8 | 14 | 10 | 8 | 23.936 s |
| GLP-1 — Bodnaruc et al., DOI 10.1186/s12986-016-0153-3 | 14 | 11 | 11 | 30.336 s |
| Muscle — McCarthy & Berg, DOI 10.3390/nu13072473 | 15 | 13 | 13 | 27.051 s |

All 34 public quotations reproduce at ≥90 against their original Docling passage,
their recorded PDF page and their recorded region. The minimum independent PDF-page
and region score is **94.77/100**. Original numerical, entailment, risk and population
results are preserved independently, including failed numerical/meaning checks.

Nine **rejected, unused** archive claims failed spatial checks and are disclosed as
omitted. They were never silently moved to a guessed page. The parser defect was
multi-region item text being assigned to its first provenance box; future parses now
split by actual Docling character spans. Missing/ambiguous spans fail explicitly.
Old database records remain unchanged. A fresh required demo PDF parse succeeded
with **97 passages across 13 pages**.

The GLP-1 half-life consumer draft was corrected through the audited EDIT API before
regeneration. A missing brand sign-off in the metabolic reel was manually overridden
under an explicit demonstration actor; its recorded policy flag is visible. No
scientific verification failure was overridden. Generated text can still oversimplify
research and is not a substitute for actual clinician review.

## Durable storage and access

The final public media consists of **55 files, 21.88 MiB total**, largest file **2.85 MiB**.
Metadata, CC BY source PDFs, previews, media, VTT and ZIPs are repository-bundled with
the frontend. They do not depend on Render, PostgreSQL, temporary storage or a laptop
at runtime. Videos are 720 × 1280 H.264 with AAC audio; ffprobe and actual Chromium
playback confirmed all three. Music with unverified rights was removed by substituting
the original scene voiceovers; genuine draft watermarks and word timings are retained.

The two small public JSON GET handlers read only the allowlisted bundled data, with
CDN cache headers. Their method dispatch remains dynamic to avoid this Next version's
forced-static unsupported-method behavior. Case pages, all 34 evidence pages, credits
and media are static. POST/PATCH/PUT/DELETE return 405. Unknown cases return 404.

Private paper reads, uploads, claims, approvals, modifications, deletion and `/files`
still require workspace credentials in production. No public backend proxy, approval
identity input or expensive anonymous generation endpoint was added.

## Verification results

| Check | Result |
| --- | --- |
| Spring tests and production JAR (`mvn package`) | 86 passed, zero failures/errors/skips |
| ML suite | 65 passed, including new fail-closed writer and multi-region provenance tests |
| Renderer unit tests and TypeScript | 16 passed; typecheck passed |
| Docker startup tests | 3 passed |
| Offline public snapshot/source/media/security checks | 5 passed |
| Frontend production build and TypeScript | Passed; 3 case pages and 34 evidence pages generated |
| Final root Docker image build | Passed via `deploy/build.py` allowlisted context |
| Existing private workspace browser suite | 17/17 passed |
| Anonymous desktop and mobile production browser suite | Both passed, then repeated successfully with test backend stopped |
| Actual video streams and playback | All three H.264/AAC; playback time advanced; VTT loaded |
| Secret checks | Actual local secret values absent from shipped text assets and generated browser bundles; private identity/path fields excluded |
| 512 MiB/no-swap API container | Health, auth, denied anonymous mutation/media, API-only capabilities and 503 processing guard passed |

The rebuilt API image ran Java only, binding `0.0.0.0:10000` through Render's configured
public port architecture. Observed idle Docker memory was **251.7 MiB** after startup;
an earlier exercised instance was approximately **297 MiB**. These are observations,
not peak-memory guarantees. No ML, Node, Chromium or runtime Remotion bundling occurred
in API mode. The isolated test backend containers were stopped after verification;
the user's existing local application and PostgreSQL were preserved.

Browser checks use fresh incognito-style contexts and block all backend/external
requests during public exploration. They cover root access/no password, direct links,
refresh, three examples, evidence/page overlays, image/carousel availability, reel
playback, subtitle retrieval, valid ZIP download, unknown IDs, rejected methods and
private layout guards. Private UI guard checks simulate auth configuration; actual
private endpoint protection was separately verified against the authenticated Docker
API. The API-offline repetition confirms public exploration does not need it.

Screenshots: [desktop home](screenshots/showcase-home-desktop.png),
[mobile home](screenshots/showcase-home-mobile.png),
[desktop evidence](screenshots/showcase-evidence-desktop.png),
[mobile evidence](screenshots/showcase-evidence-mobile.png).

The precise static artifact list, sizes and SHA-256 hashes are in
[showcase-artifacts.json](showcase-artifacts.json). Snapshots also contain file hashes.

## Changed files

| Exact path(s) | Purpose |
| --- | --- |
| `frontend/app/layout.tsx` | Remove the global private guard/reviewer wrapper; public metadata |
| `frontend/app/page.tsx` | Public three-case homepage |
| `frontend/app/(workspace)/layout.tsx` | Scope private access, reviewer, navbar and processing notice |
| `frontend/app/(workspace)/workspace/page.tsx` | Move the original paper list to `/workspace` |
| `frontend/app/(workspace)/papers/[id]/page.tsx` | Move private detail route; update back/delete navigation |
| `frontend/app/(workspace)/papers/[id]/claims/page.tsx` | Move existing private claim UI unchanged |
| `frontend/app/(workspace)/papers/[id]/assets/page.tsx` | Move existing private asset UI unchanged |
| `frontend/app/(workspace)/papers/[id]/export/page.tsx` | Move existing private export UI unchanged |
| `frontend/components/Navbar.tsx` | Link private list and public showcase |
| `frontend/app/showcase/[slug]/page.tsx` | Whitelisted static cases |
| `frontend/app/showcase/[slug]/evidence/[claimId]/page.tsx` | Whitelisted static evidence URLs |
| `frontend/app/showcase/credits/page.tsx` | Research/media licenses and review methodology |
| `frontend/app/api/showcase/route.ts` | Anonymous GET-only case summaries |
| `frontend/app/api/showcase/[slug]/route.ts` | Anonymous GET-only allowlisted snapshots |
| `frontend/components/showcase/PublicChrome.tsx` | Public navigation/footer and concise hosted-mode disclosure |
| `frontend/components/showcase/ShowcaseExplorer.tsx` | Seven stages, read-only reviews, gallery/video/caption/export and selection disclosure |
| `frontend/components/showcase/Evidence.tsx` | Original quote, checks, cautions, coordinates and original PDF/page |
| `frontend/showcase/types.ts`, `frontend/showcase/data.ts`, `frontend/showcase/generated/cases.json` | Sanitized public schema, fixed lookup and genuine snapshots |
| `frontend/app/globals.css`, `frontend/public/fonts/*` | Local fonts and official SIL license texts |
| `frontend/public/showcase/media/*` | Exact rights-reviewed artifact list in manifest |
| `frontend/next-env.d.ts` | Normalize generated references to default `.next` rather than an old verification directory |
| `ml-service/app/write/writer.py`, `ml-service/app/prompts/writer.md` | Strict failure after one invalid retry, temperature 0.7, traceable scientific source copy and clearer constraints |
| `ml-service/app/parse/docling_parser.py` | Actual provenance-span handling and versioned parse cache |
| `ml-service/tests/test_writer_fail_closed.py`, `ml-service/tests/test_parser_provenance.py` | Writer/provenance regressions |
| `render-service/src/server.ts` | Allow explicit `musicSrc: null` without inserting unverified default music |
| `scripts/build_showcase.py` | Explicit local-only publication allowlist, spatial eligibility, media rights adaptations and sanitized educational ZIPs |
| `scripts/test_showcase.py` | Independent shipped-source/media/provenance/privacy checks |
| `scripts/showcase_browser_test.cjs` | Anonymous desktop/mobile production and security browser checks |
| `scripts/ui_smoke_test.js` | Portable Playwright path; new private list URL; inspect real nested paper links without weakening ID assertion |
| `README.md`, `docs/API.md`, `docs/DEPLOYMENT.md`, `docs/RENDER_FREE.md`, `docs/SHOWCASE.md` | Accurate public/private behavior and manual release instructions |
| `docs/SHOWCASE_VERIFICATION.md`, `docs/showcase-artifacts.json`, `docs/screenshots/*` | This report and reproducible verification evidence |

The prior Docker/startup/auth/PostgreSQL/CORS/free-mode architecture is retained. No
Spring auth allowlist was expanded. Completing real pipeline runs also updated local
runtime logs and generated `demo/CREDITS.md`; local logs are not release files. This
older repository tracks some logs despite ignore rules, so follow the explicit staging
instructions and do not stage them accidentally.

## Reproduce and release

```powershell
# From repository root; use existing service environments.
ml-service/.venv/Scripts/python.exe scripts/test_showcase.py
node scripts/showcase_browser_test.cjs   # production frontend on localhost:3030
python -m unittest discover -s deploy -p 'test_*.py'
python deploy/build.py --tag steerproof-showcase:local
# Frontend: npm run typecheck; npm run build (cwd frontend)
# Renderer: npm test; npm run typecheck (cwd render-service)
# ML: .venv/Scripts/python.exe -m pytest -q (cwd ml-service)
# Backend: mvnw.cmd package (cwd backend; Java 21+ and local test PostgreSQL)
```

[Exact GitHub, Render and Vercel release instructions](SHOWCASE.md#exact-release-steps).
Keep `PROCESSING_MODE=api` and temporary storage on Render Free. Public artifacts
must be committed with the frontend; copying only code without them is insufficient.
Vercel deployment protection, provider usage limits and database expiration remain
external constraints. No live upload/model/video processing is claimed on Free.
