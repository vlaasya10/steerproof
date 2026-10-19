# Public showcase release

For the latest authentication audit, removal of the public workspace entry point,
cookie/storage-disabled browser checks and exact commit/redeployment commands,
see [PUBLIC_ACCESS.md](PUBLIC_ACCESS.md). The private workspace remains available
directly at `/workspace`; public navigation does not advertise a login.

The public homepage is `/`. The old password appeared because `app/layout.tsx`
wrapped **every route** in `WorkspaceAccess`. That guard checks `/api/auth/config`
and renders the workspace password form when production authentication is enabled.
It now lives only in `app/(workspace)/layout.tsx`. `/workspace` and the existing
`/papers/[id]` routes retain authentication and reviewer context. Public pages never
mount reviewer onboarding, request a token, or call Spring. Backend authentication,
PostgreSQL, CORS, deployment secrets and both review gates are unchanged.

## Sources and preparation

| Public case | Genuine source | Preparation |
| --- | --- | --- |
| `/showcase/metabolic-health` | Schulze, *Metabolic health in normal-weight and obese individuals*, DOI `10.1007/s00125-018-4787-8` | Existing Docling/verification run; content regenerated with stricter provenance and explicit demonstration review |
| `/showcase/glp1-and-appetite` | Bodnaruc et al., *Nutritional modulation of endogenous glucagon-like peptide-1 secretion: a review*, DOI `10.1186/s12986-016-0153-3` | New local parse/extract/verify/write/render run; demonstration reviews |
| `/showcase/muscle-preservation` | McCarthy & Berg, *Weight Loss Strategies and the Risk of Skeletal Muscle Mass Loss*, DOI `10.3390/nu13072473` | New local parse/extract/verify/write/render run; demonstration reviews |

All three original papers are CC BY 4.0. Licenses were checked against the PDFs and
publisher/repository records. The earlier BMJ Open protocol was excluded because
its CC BY-NC license does not establish permission for a product showcase. Sources:
[Schulze](https://link.springer.com/article/10.1007/s00125-018-4787-8),
[Bodnaruc et al.](https://link.springer.com/article/10.1186/s12986-016-0153-3),
[McCarthy & Berg repository PDF](https://repository.londonmet.ac.uk/6890/1/nutrients-13-02473_final.pdf).

No clinician credentials or medical approvals have been established. Sample-preparation
reviews use the actual actor `Showcase automation (demonstration, not clinician)` and
are audited by the existing backend. UI labels, snapshots and ZIP disclosures state
this plainly. Failed number/meaning checks and rejected claims are retained. Only
approved claims were passed to the writer; source data was never changed to fit copy.

The three private runs contain 43 claims and 654 extracted passages. The public
selection contains **34 claims and 32 original linked passages**: 10 metabolic,
11 GLP-1 and 13 muscle claims. Nine rejected, unused archive claims failed an
additional check against their recorded PDF page/region and are explicitly listed
as omitted in each case's selection disclosure. All claims used by generated assets
passed that spatial check. Original private records are retained, not silently relinked.
The original quote, number, entailment and risk results for published claims remain
unchanged; independent PDF-page/region scores are separately labeled.

Investigation found that the old parser attached a multi-region Docling item's full
text to `prov[0]`. The parser now uses each provenance character span with its actual
Docling page/box and rejects ambiguous multi-region items rather than guessing.
The parse cache is versioned `docling-v2-region-spans`; fresh parses invalidate old
cache entries. Existing database records are not rewritten. A fresh Hall–Kahan demo
parse succeeds with 97 passages across 13 pages. Ambiguous multi-region items without
usable character spans fail parsing explicitly and require review of that source.

Writer validation now fails after its one invalid retry rather than returning bad
output. Writer calls use structured output, disk caching and temperature 0.7.
The original Flash daily quota was exhausted during preparation. Generation resumed
locally with the supported free `gemini-3.5-flash-lite`; original Flash extraction and
verification results were retained. This is recorded in stage metadata. No billing
or deployment model setting was changed.

## Durable architecture and routes

`frontend/showcase/generated/cases.json` is a reviewed field allowlist, not a database
dump. `frontend/public/showcase/media` contains versioned source PDFs, cited-page
previews, carousel/static PNGs, compressed MP4s, actual-timing VTT and educational ZIPs.
They ship with the Vercel frontend. Nothing is fetched from `/tmp/steerproof/storage`
at runtime. Public exploration works with Render stopped, an empty database, or the
preparation laptop offline. A new publication requires committing the new artifacts.

Public routes: `/`, `/showcase/{slug}`, `/showcase/{slug}/evidence/{claimId}`,
`/showcase/credits`, `GET /api/showcase`, `GET /api/showcase/{slug}` and the fixed static
media/font URLs. Known cases/evidence are statically generated; unknown IDs return 404.
Mutating methods on the showcase API return 405. The two small GET API handlers
read only bundled JSON and use CDN cache headers. They keep method dispatch active
because this Next.js version's forced-static handler returned GET bodies even for
unsupported methods. The actual case/evidence pages and all media remain static.
There is no privileged public proxy.

Protected frontend routes: `/workspace`, `/papers/{id}` and its claims/assets/export
pages. Protected backend operations retain existing HMAC session/media-token checks.
The frontend layout is a UX guard; the Spring filter is the actual authorization
boundary. Public health/auth configuration remain intentional exceptions.

The seven-stage explorer shows actual passages, extraction, independent numerical
and entailment checks, risk/population cautions, two review gates, generated formats
and educational export. Claim chips lead to a refreshable source page showing the
exact quote, full original passage, page image, Docling box and original PDF page.
Reproduced quote scores are separately labeled; they do not replace original results.

## Media rights and adaptations

Paper PDFs are copied unmodified. Page PNGs are converted to WebP without changing
the text; bounding boxes are interface overlays. Original authors, DOI, license and
metadata corrections are visible. Inter, Instrument Serif and Caveat ship locally
with official SIL OFL texts, avoiding third-party font requests.

The bundled background music's rights were not verifiable, so it is **not** included
in public reels. `build_showcase.py` replaces the genuine pipeline draft's mixed
audio with the original per-scene generated voiceovers at the renderer's exact scene
offsets, retains the draft watermark, and compresses to 720p H.264/AAC with fast-start.
VTT cues use original word timings. This adaptation is disclosed in each case.
Composited Pixabay footage retains source/creator credit; raw stock clips and raw
audio are excluded from downloads. See the [Pixabay license](https://pixabay.com/service/license-summary/).

Downloads are educational sample packages, explicitly not clinical publishing
clearance. The publisher requires actual backend EXPORTED state and checks asset,
claim, quotation, number and entailment eligibility again. Missing files or broken
provenance fail publication. It never creates approval records. Source evidence remains
available even when an output is inspection-only. Do not reuse old private ZIPs:
they contain reviewer identities and different review language.

## Rebuilding the snapshots locally

This is an intentional local publication step, never a Vercel build/start task.
Run the existing full pipeline with sufficient memory, complete explicitly labeled
reviews through the actual API and save each genuine draft reel **before** final
approval removes its watermark:

```powershell
# From the repository root; update only the explicit curation entries when selecting new runs.
New-Item -ItemType Directory -Force .cache/showcase/draft-reels
# Copy storage/renders/P-0003/reel.mp4 to .cache/showcase/draft-reels/P-0003.mp4,
# and similarly P-0004/P-0005, while those assets are still genuine rendered drafts.
# Complete final review/export through the app, then:
ml-service/.venv/Scripts/python.exe scripts/build_showcase.py
ml-service/.venv/Scripts/python.exe scripts/test_showcase.py
```

If local authentication is enabled, set `SHOWCASE_SESSION_TOKEN` only in the shell.
`SHOWCASE_API_URL` defaults to local port 8081. No password is embedded in scripts.
The current bundled snapshots do not need to be regenerated for deployment.
The publisher does not start or deploy services. Its Windows FFmpeg lookup uses the
existing renderer dependency; adapt that lookup to a system binary on Linux.

## Exact release steps

1. In GitHub, use the existing repository/branch. If this checkout has no `.git`, run
   `git init`, `git branch -M main`, and add your own repository as `origin`.
   Review `git status --short`; commit `frontend/public/showcase`, generated public
   JSON, font/licenses, code, tests and docs. Never add `.env*`, `.cache`, `storage`,
   virtual environments, dependencies or build directories. The ignore files retain
   these exclusions. Stage the changed code/docs and the explicit public folders;
   do not use an unchecked `git add .` because this older repository also tracks
   local service logs. For example, `git add README.md docs frontend scripts ml-service/app/prompts/writer.md ml-service/app/write/writer.py ml-service/tests/test_writer_fail_closed.py render-service/src/server.ts`.
   Inspect `git diff --cached --stat` and verify no logs/credentials are staged, then
   `git commit -m "Add public evidence-linked SteerProof showcase"` and
   `git push -u origin main` (or your existing branch). Pushing may trigger existing
   auto-deploy settings; disable those first in the dashboards if you want a manual release.
2. Render: keep **Free**, Docker, repository root, `./Dockerfile`, one instance and no
   custom startup command. Keep `PROCESSING_MODE=api`, `STORAGE_EPHEMERAL=true`,
   `STORAGE_DIR=/tmp/steerproof/storage`, `DEMO_MODE=false`. Preserve DB credentials,
   `DEPLOYMENT_ACCESS_KEY`, exact CORS origins and all existing API/model environment
   variables. Health path `/actuator/health`; lightweight liveness `/health`. Do not
   set public port 8002: Java binds `0.0.0.0:$PORT`. Manually deploy latest commit if
   desired; no new persistent disk or worker is needed. Full processing stays local.
3. Vercel: existing project → Settings → Build and Deployment: Root Directory
   **frontend**, framework **Next.js**, Node **22.x**, install `npm ci`, build
   `npm run build`, default output directory. Set only `NEXT_PUBLIC_API_URL` to the
   existing public HTTPS Render origin for private workspace access. **Do not add
   deployment/Gemini/database secrets to Vercel public variables.** Deployments →
   Redeploy the latest commit (without old build cache if stale routes persist).
   Environment changes need a new deployment. The public build does not call Render.
4. If Vercel project-level Deployment Protection is enabled, allow public access to
   the intended production domain in its dashboard; application code cannot bypass
   platform protection. Do not change private application authentication.
5. Open production `/` and each direct case/evidence link in incognito and on mobile.
   Confirm three cards, no password, playable reels, source previews and ZIP downloads.
   Check `/workspace` still requires the workspace password and anonymous Spring
   mutations return 401. Repeat public checks while Render is asleep.

Official references: [Vercel environment variables](https://vercel.com/docs/environment-variables),
[Next.js public files](https://nextjs.org/docs/app/api-reference/file-conventions/public-folder),
[Render Free behavior](https://render.com/docs/free).

## Limits

Static samples are frozen, curated educational records, not live jobs. No clinical
endorsement is established. Live upload/generation remains unavailable on Free;
private record/media availability still depends on PostgreSQL and ephemeral storage.
Vercel bandwidth/usage and Render database expiration limits still apply. No external
service can be promised permanent uptime. Static artifacts must stay in the repository;
Git ignore exclusions for local storage must not be broadened to hide the public folder.
Generated language can still oversimplify an observational finding or introduce
unestablished context despite passing automated checks. Content-to-claim links are
traceability, not an independent clinical review of every generated sentence. The
metabolic reel retains a recorded manual override for a missing brand sign-off;
the policy flag remains visible. No scientific verification failure was overridden.
The GLP-1 half-life consumer wording was corrected through an audited EDIT before
regeneration; original consumer draft and source checks are retained separately.
This change does not deploy, purchase resources or modify paid settings.
