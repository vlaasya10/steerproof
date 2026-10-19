# Public, no-login release

## Authentication investigation

The original application password screen came from `WorkspaceAccess`, formerly
mounted in the root layout. It appears when `GET /api/auth/config` returns
`enabled: true` and `readSession()` finds no valid workspace session. Production
authentication is enabled by the server-side `DEPLOYMENT_ACCESS_KEY` setting.

The current checkout already separates public routes from the private route group.
Its remaining public-navigation problem was the header's `/workspace` link, which
sent visitors into that private login flow. This revision removes that entry point.
It also applies the requested homepage copy and makes the hosted-mode limitation
visible without expanding a disclosure. The password form remains available only
through intentionally private URLs.

| Investigation | Actual code / behavior |
| --- | --- |
| Password UI | `frontend/components/WorkspaceAccess.tsx` |
| Password verification | `POST /api/auth/login`, `WorkspaceAuthController` → `WorkspaceAuth.login` |
| Deployment key | Server-side shared private-workspace credential; never automatically sent to public visitors |
| Guard scope | `frontend/app/(workspace)/layout.tsx`, covering `/workspace` and `/papers/[id]` and its subpages |
| Global authentication | Public root layout has no auth/reviewer provider; there is no middleware/proxy login redirect |
| Automatic bearer header | `frontend/lib/api.ts` attaches an existing private session only to the configured Spring API origin |
| Session storage | `frontend/lib/session.ts`; invalid, expired, missing or inaccessible sessions read as absent |
| Reviewer local storage | Private `ReviewerContext`; it is not mounted on showcase pages |
| 401 handling | Private API helper clears its session and emits `steerproof:signout`; only the private guard listens |
| 403 handling | API errors are reported; no public authentication redirect exists |
| Public data | `frontend/showcase/generated/cases.json`, imported without the private API/session helpers |
| Refresh / direct links | Static case/evidence routes render without tokens, cookies or browser storage |

No backend authorization code was changed. `WorkspaceAuthFilter` still protects
private reads, uploads, claim edits, approvals, deletion, private exports, processing
and `/files`. Health and login/configuration retain their existing public exceptions.
Scientific approval gates, audit logging, exact CORS origins and production secret
requirements remain intact. A regression test now checks real HTTP methods for
private reads and mutations, rejecting both anonymous requests and media-token misuse.

If a deployed root still shows a password, that behavior does not match the tested
current checkout. Verify its deployed commit, project root, URL and platform protection.
No production URL was supplied for inspecting the actual live deployment, and no
cloud deployment or settings were changed.

## Visitor experience and preserved samples

The root displays **SteerProof**, the requested **From Research Papers to
Evidence-Linked Instagram Content** headline, the requested supporting description,
and **Explore Three Completed Research Examples** with three **Explore Example**
actions. Public navigation contains only public links. The visible hosted-mode notice
explains that live processing is unavailable; technical details remain expandable.

| Public case | Genuine paper | Available outputs |
| --- | --- | --- |
| `/showcase/metabolic-health` | Schulze, *Metabolic health in normal-weight and obese individuals*, DOI `10.1007/s00125-018-4787-8` | 5 carousel slides, 3 static sizes, caption, voiced reel, VTT, educational ZIP |
| `/showcase/glp1-and-appetite` | Bodnaruc et al., *Nutritional modulation of endogenous glucagon-like peptide-1 secretion: a review*, DOI `10.1186/s12986-016-0153-3` | 6 carousel slides, 3 static sizes, caption, voiced reel, VTT, educational ZIP |
| `/showcase/muscle-preservation` | McCarthy & Berg, *Weight Loss Strategies and the Risk of Skeletal Muscle Mass Loss*, DOI `10.3390/nu13072473` | 5 carousel slides, 3 static sizes, caption, voiced reel, VTT, educational ZIP |

Each example preserves the existing seven-stage explorer, actual review records,
claim/quote/page links, source PDF, original Docling coordinates and scientific cautions.
Reviews are disclosed as demonstrations, not established clinician sign-off. The
curated selection contains 34 claims; nine rejected unused archive claims with
unreliable spatial records remain explicitly disclosed as excluded. Nothing was
regenerated or reapproved for this revision.

Public routes are `/`, `/showcase/{slug}`, `/showcase/{slug}/evidence/{claimId}`,
`/showcase/credits`, `GET /api/showcase`, `GET /api/showcase/{slug}`, and the fixed
`/showcase/media/...` and font files. Public JSON APIs are served by Next.js, not
proxied to Spring. They expose only the sanitized snapshots; mutating methods return
405. No new Spring public exception or paid storage was added.

The existing version-controlled public manifest and media remain under
`frontend/showcase/generated` and `frontend/public/showcase`. The 55 media files total
21.88 MiB; the largest is 2.85 MiB. Their delivery is independent of Render, PostgreSQL,
temporary files and the preparation laptop. Sources are attributed under CC BY 4.0;
composited footage credits, removed unverified music, original voice timings and
draft/clinical-review disclosures remain documented in [SHOWCASE.md](SHOWCASE.md).

## Tests executed for this revision

| Check | Result |
| --- | --- |
| Next.js production build with `VERCEL=1` and unreachable HTTPS API origin | Passed; 3 case pages and 34 evidence pages built without localhost/backend access |
| Frontend TypeScript | Passed |
| Full desktop/mobile public browser journey | Passed with cookies disabled through Chromium CDP and local/session storage getters throwing SecurityError |
| Empty browser storage | Passed: all three examples and refresh without login |
| Returning browser with stale private session | Passed: no public redirect or bearer-header leakage |
| Public navigation | No workspace/private-record link; all three real card actions navigate correctly |
| Images, carousels, reels, VTT and ZIPs | Passed on desktop/mobile; videos actually played |
| Public errors/mutations | Unknown cases 404; POST/PATCH/PUT/DELETE 405 |
| Private layout guard | Still prompts only on direct private URLs (auth configuration simulated in the browser test) |
| Existing private workspace browser suite | 17/17 passed against the local full application |
| Spring build and full tests | 87 passed; production JAR packaged |
| ML tests | 65 passed; one existing SDK deprecation warning |
| Renderer tests and TypeScript | 16 passed; typecheck passed |
| Source/media/secret integrity suite | 5 passed, including actual local secret comparisons against public text assets and built browser JavaScript |
| Free-mode startup tests | 3 passed |
| Actual authenticated 512 MiB / no-swap API container | Anonymous private reads, mutations, approvals, exports and media returned 401; health and authenticated capabilities passed; processing returned 503 |

The isolated API container ran Java only; observed memory after exercising endpoints
was 284.1 MiB of 512 MiB. This is an observation, not a peak-memory guarantee. No new
backend runtime dependency or startup process was added. The test container was stopped
after verification; the user's full local application was preserved.

The browser tests deliberately block every external/backend request during public
exploration and assert no Authorization headers. The production verification build
uses a deliberately unreachable `.invalid` HTTPS API address only as a test fixture;
that value is not a deployment setting or source-code default.

Screenshots: [desktop homepage](screenshots/showcase-home-desktop.png),
[mobile homepage](screenshots/showcase-home-mobile.png),
[desktop evidence](screenshots/showcase-evidence-desktop.png),
[mobile evidence](screenshots/showcase-evidence-mobile.png).
The updated [artifact manifest](showcase-artifacts.json) records exact file hashes.

## Files changed in this revision

- `frontend/components/showcase/PublicChrome.tsx`: remove the workspace login entry
  from every public header; show the hosted-mode limitation directly.
- `frontend/app/page.tsx`: requested headline, description, example heading and card
  actions; compact the existing hero without replacing the site's design.
- `scripts/showcase_browser_test.cjs`: cookie/storage-disabled tests, empty/returning
  sessions, no private navigation/bearer headers, exact card navigation and disclosure.
- `backend/src/test/java/com/steerclub/steerproof/common/WorkspaceAuthTest.java`:
  anonymous and media-token rejection for private HTTP reads and mutations.
- `docs/PUBLIC_ACCESS.md`, `docs/SHOWCASE.md`, `docs/SHOWCASE_VERIFICATION.md`,
  `README.md`: release instructions and accurate audit/test results.
- `docs/screenshots/*`, `docs/showcase-artifacts.json`: updated visual evidence/hashes.

The root/private layouts, auth filter/controller, private API helpers, model pipeline,
sample data/media, Docker startup and database schema require no changes in this revision.

## Exact commit and release steps

Run from the repository root. These commands are instructions; they have not been run:

```powershell
git status --short
git add README.md frontend/app/page.tsx frontend/components/showcase/PublicChrome.tsx scripts/showcase_browser_test.cjs backend/src/test/java/com/steerclub/steerproof/common/WorkspaceAuthTest.java docs/PUBLIC_ACCESS.md docs/SHOWCASE.md docs/SHOWCASE_VERIFICATION.md docs/screenshots docs/showcase-artifacts.json
git diff --cached --stat
git commit -m "Remove public workspace login entry and verify anonymous showcase"
git push origin HEAD
```

Keep this repository private. Do not stage runtime logs, `.env*`, caches, storage,
dependencies or build directories. The existing public sample assets must remain
tracked; they are intentionally public and already part of the repository. Pushing
can trigger existing auto-deploy settings; disable auto-deploy in the dashboards first
if you want a strictly manual release.

| Deployment item | Required for this revision? |
| --- | --- |
| Vercel redeployment | **Yes**, to publish the new public navigation, copy and notice |
| Render redeployment | **No runtime backend change**; optional if your release process redeploys the repository |
| Environment changes | None if the current URLs/CORS are correct; keep the real Render HTTPS origin in `NEXT_PUBLIC_API_URL` for private workspace access |
| Database migrations | None |
| Static asset publication | Existing bundled media must ship with `frontend`; updated screenshots/docs are review evidence |
| Billing/paid services | None |

1. In Vercel, select the existing project, the new commit and the intended production
   branch. Keep Root Directory `frontend`, Framework Next.js, Node 22.x, install
   `npm ci`, build `npm run build`, and default output directory. Redeploy the latest
   commit; disable old build cache if you are still seeing an older UI.
2. Keep `NEXT_PUBLIC_API_URL=https://YOUR_EXISTING_RENDER_SERVICE.onrender.com` for
   private workspace calls. Never put deployment, Gemini or database secrets in
   `NEXT_PUBLIC_` variables. Public examples do not call this origin. Environment
   changes take effect on a new deployment. See [Vercel deployment management](https://vercel.com/docs/deployments/managing-deployments)
   and [environment variables](https://vercel.com/docs/environment-variables).
3. If the intended production domain has Vercel Deployment Protection enabled, make
   that public domain accessible in the project dashboard. Platform authentication
   cannot be removed by changing React or Spring. Keep private app authentication.
4. Keep Render on Free with `PROCESSING_MODE=api`, temporary storage and
   `DEMO_MODE=false`. Preserve PostgreSQL, `DEPLOYMENT_ACCESS_KEY`, model variables
   and the exact frontend CORS origin. Keep Docker/root Dockerfile, no custom start
   command, `/actuator/health` readiness, and Render's assigned public `PORT`.
   No new worker, persistent disk or processing service is required. Render's
   [Free service filesystem is ephemeral](https://render.com/docs/free); public
   media is therefore served from the Vercel deployment.
5. Open production `/`, each case and a direct evidence URL in a new private window.
   Confirm no workspace link/password, three cases, readable evidence and playable
   media/downloads. Refresh and repeat on mobile. Direct private URLs should retain
   protection; do not clear the server-side deployment key.

No automatic deployment, Git push, billing update or cloud setting change was made.
The live production commit/domain cannot be confirmed without its URL/dashboard.
