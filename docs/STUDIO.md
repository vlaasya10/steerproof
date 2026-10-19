# Restored public Studio

The header now offers **Papers** (`/papers`) and **Public Showcase** (`/`). Both
routes are public and need no password, account, cookies or browser storage.
The default route remains the three-example showcase. Private paper details,
review, modifications, exports and `/workspace` retain their existing access guard.
The public Studio never fetches the private paper list.

## Restoration and files

The original Studio component was recovered from the existing `/workspace` page
and Git history, retaining its headline, explanation, logo, typography, palette,
cards, PDF drop zone, editorial theme, URL field, Fetch and Hall & Kahan sample.
It is shared instead of maintaining two copies of the uploader.

| File | Purpose |
| --- | --- |
| `frontend/components/StudioPapers.tsx` | Original uploader/list component, capability check, accessible disabled actions, PDF validation and deployment notice |
| `frontend/app/papers/page.tsx` | Public Studio shell, header, footer and upload toasts |
| `frontend/app/(workspace)/workspace/page.tsx` | Private wrapper of the same component; preserves reviewer context and private records |
| `frontend/components/showcase/PublicChrome.tsx` | Public Papers / Public Showcase navigation; Studio branding and mobile spacing |
| `frontend/components/Navbar.tsx` | Same destinations in private navigation |
| `backend/src/main/java/com/steerclub/steerproof/common/RuntimeController.java` | Minimal anonymous capability response |
| `backend/src/main/java/com/steerclub/steerproof/common/WorkspaceAuthFilter.java` | Exact GET exception for that endpoint; other authorization unchanged |
| `backend/src/test/java/com/steerclub/steerproof/common/PublicCapabilitiesTest.java` | Public response and authorization regression checks |
| `backend/src/test/java/com/steerclub/steerproof/paper/StudioUploadContractTest.java` | Real Hall PDF storage and original URL/theme/pipeline handoff contract |
| `scripts/studio_browser_test.cjs` | Desktop/mobile regression cases for API, full, protected-full, pending and unreachable modes |
| `docs/screenshots/*` and `docs/showcase-artifacts.json` | Updated navigation screenshots, Studio screenshots and artifact hashes |
| `docs/API.md`, `docs/PUBLIC_ACCESS.md`, `docs/DEPLOYMENT.md`, `README.md` | Updated route, capability and release documentation |

Scientific verification, writer, render, review gates, audit behavior, Docker startup,
PostgreSQL, temporary storage and existing environment variables are unchanged.
No database migration or paid service is introduced.

## Real capability detection

The public component requests `GET /api/public/capabilities` from
`NEXT_PUBLIC_API_URL`, without credentials and with `Cache-Control: no-store`.
The Spring response contains exactly three configuration fields:

```json
{"mode":"api","processingEnabled":false,"authenticationRequired":true}
```

It reuses `ProcessingAvailability`, including the startup supervisor's resolved
mode; no frontend deployment flag is invented. Configuration is not a worker-health
guarantee. Full mode still reports genuine processing failures through the existing
stage machinery when a required worker is down.

| Configuration | Studio behavior |
| --- | --- |
| API mode | Uploader stays visible, actions disabled, deployment notice immediately below it |
| Full mode, local open API | Original file, drop, URL and sample flows enabled; no deployment notice |
| Full mode, protected API | Public Studio stays visible, explains authorization requirement, actions disabled; authorized `/workspace` keeps full processing |
| Pending, malformed response or unreachable API | Actions stay disabled with accessible availability text; never invents a successful upload or deployment mode |

The private wrapper uses the existing authenticated `/api/capabilities`. Enabling
public processing on an authenticated deployment would bypass private job access;
this change deliberately preserves that protection. Neither public page introduces
a login form or redirects visitors to login.

## Exact API-mode notice

An information icon and a thin, rounded brand border sit below the original upload
card, with the existing warm background and maroon heading:

> **Live processing is unavailable in this deployment**
>
> This hosted version allows you to explore completed research-to-content examples. Uploading and processing new papers, AI content generation, and reel rendering require the full processing environment.
>
> Explore Completed Examples →

The action links to `/#examples`, the actual three-example section. Native disabled
inputs/buttons, `aria-disabled`, `aria-describedby` and status text explain availability.
Handlers also guard drag/drop and submitted forms, so UI bypasses do not send
known-unavailable processing requests. Backend processing guards remain in place.

## Verification scope

The production build includes public `/papers` and the existing protected
`/papers/[id]` routes. Browser coverage checks desktop and mobile in all five
availability states, direct navigation/refresh, both header destinations, real PDF
file selection and drag/drop, URL/theme/sample payloads, no private-list request,
no password prompt, API-mode disclaimer placement and no processing requests while
unavailable. The full-mode browser requests are intercepted and explicitly return
an error; they do not fabricate papers or consume Gemini calls.

The upload controller tests save the actual `demo/papers/hall-kahan-2018.pdf` bytes
unchanged to temporary test storage and check pipeline handoff. Repositories and
pipeline are mocked there; these tests do not assert a fresh scientific end-to-end run.
Existing genuine showcase outputs and their scientific evidence remain unchanged.
Existing showcase browser, publication integrity, backend and renderer tests are
also run. Screenshots are under `docs/screenshots/studio-api-{desktop,mobile}.png`.
There was no separate reference image attached to this request; visual preservation
is based on the recovered original component and existing brand styles.

Results for this checkout:

| Check | Result |
| --- | --- |
| Frontend production build and TypeScript | Passed; public Studio generated without a reachable backend |
| Backend package/tests | 92 passed, zero failures/errors/skips |
| ML tests | 65 passed, using the installed async test plugin |
| Renderer tests / TypeScript | 16 passed / passed |
| Startup / publication integrity | 3 passed / 5 passed |
| Studio browser regression | 10 desktop/mobile mode combinations passed |
| Existing public browser suite | Desktop, mobile, first-time and stale-session contexts passed; all three examples preserved |
| Existing private browser suite | 17 checks passed against the actual full-mode local backend |
| Actual local public Studio | Full mode, anonymous load, Fetch enabled after URL entry, no deployment notice |
| Docker build and 512 MB runtime | Passed; public capabilities/health 200, private papers and non-GET capability requests 401, exact configured CORS allowed |

The isolated Free-mode smoke container used about 267 MiB at the sampled idle point,
listened on port 10000 and ran Java only (the supervisor replaces itself with Java).
It was stopped after checking. This is a startup/idle observation, not a peak-load
guarantee. Existing Maven integration tests leave background work alive long enough
to produce Surefire's fork-shutdown timeout warning; all 92 test result reports pass
and packaging exits successfully. The installed Java 25 and Python 3.14 development
runtimes also emit dependency/native-access deprecation warnings; Docker retains
the project's intended Java 21 / Python 3.11 runtime. No new scientific run was
claimed or generated as part of the Studio upload regression tests.

## Commit and release

Nothing is deployed automatically. From the repository root, review and commit the
scoped change (including the two new tests, public page, screenshots and docs):

```powershell
git diff --check
git status --short
git add backend/src/main/java/com/steerclub/steerproof/common/RuntimeController.java backend/src/main/java/com/steerclub/steerproof/common/WorkspaceAuthFilter.java backend/src/test/java/com/steerclub/steerproof/common/PublicCapabilitiesTest.java backend/src/test/java/com/steerclub/steerproof/paper/StudioUploadContractTest.java
git add frontend/components/StudioPapers.tsx frontend/app/papers/page.tsx 'frontend/app/(workspace)/workspace/page.tsx' frontend/components/Navbar.tsx frontend/components/showcase/PublicChrome.tsx
git add scripts/studio_browser_test.cjs docs/STUDIO.md docs/API.md docs/PUBLIC_ACCESS.md docs/DEPLOYMENT.md docs/showcase-artifacts.json docs/screenshots README.md
git diff --cached --stat
git commit -m "Restore public Studio uploader with deployment capability notice"
git push
```

1. Redeploy the existing Render backend from this commit to add the public endpoint.
   Keep the Free plan, Docker setup, `PROCESSING_MODE=api`, `STORAGE_DIR`, PostgreSQL,
   exact `CORS_ALLOWED_ORIGINS` and server-only access/Gemini credentials unchanged.
   No schema change is needed. Verify `/health` and `/api/public/capabilities`.
2. Redeploy Vercel from the same commit, project root `frontend`. Keep
   `NEXT_PUBLIC_API_URL` pointing to that Render HTTPS origin. Never place a
   deployment access key or Gemini key in a `NEXT_PUBLIC_*` variable.
3. Open `/papers` anonymously. Expect the original uploader, disabled processing
   actions and exact notice; open Public Showcase and check all three examples.
   Refresh both routes. Check mobile navigation and private API requests still return
   401 without a session. If the backend has not been redeployed or is cold/unreachable,
   the Studio safely displays the availability-unknown helper until a reload succeeds.
4. Locally, keep Spring in full mode with the existing ML and render workers running.
   The public Studio enables upload when that local API is open; protected local/full
   deployments continue to use their authorized workspace for processing.

Render Free retains temporary storage and API-only operation. This release restores
the interface; it does not claim that Docling, Gemini processing or Remotion rendering
can execute inside the Free container. The bundled showcase still works independently
of Render, PostgreSQL and the preparation laptop.
