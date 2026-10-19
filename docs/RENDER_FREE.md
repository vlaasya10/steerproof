# Render Free: stable API within 512 MB

The public root now serves [three bundled showcase examples](SHOWCASE.md), independently of this backend. Private records and actions live at `/workspace`. The public experience does not display the workspace password or require a healthy API. The technical capability notice remains in the private workspace; public pages use a concise showcase explanation.

The entire processing pipeline cannot reliably run inside Render Free's 512 MB limit. The previous image started Docling/Torch and Node/Webpack together, waited for their health, and only then started the public Spring API. The failure was a memory problem before public-port startup, not a requirement to expose port 8002.

The same image now supports two modes. **API mode** runs only Spring with bounded JVM memory. **Full mode** retains PDF parsing, Gemini extraction, quote/number/semantic verification, both medical review gates, writing, Playwright images, edge-tts, Remotion reels and export. Nothing substitutes unverified text for scientific evidence. Run full mode on your own computer or another machine you control with sufficient memory; this change does not provision a paid worker or add a new service dependency.

## Exact Render settings

Keep the service on **Free**. Keep Runtime **Docker**, repository root as the build root, and Dockerfile `./Dockerfile`. Do not set a custom start command. Keep PostgreSQL, workspace password and CORS settings already configured.

Set these variables explicitly:

```text
PROCESSING_MODE=api
STORAGE_EPHEMERAL=true
STORAGE_DIR=/tmp/steerproof/storage
LLM_CACHE_DIR=/tmp/steerproof/storage/cache/llm
HF_HOME=/tmp/steerproof/cache/huggingface
XDG_CACHE_HOME=/tmp/steerproof/cache
DEMO_MODE=false
```

Preserve `DB_URL` (JDBC), `DB_USER`, `DB_PASSWORD`, `DEPLOYMENT_ACCESS_KEY`, `CORS_ALLOWED_ORIGINS`, and your existing Gemini/model/stock-footage variables. Gemini is not called in API mode; its key is needed for full mode. The password still needs at least 32 characters, and CORS still requires exact frontend origins. Never put these secrets into `NEXT_PUBLIC_` variables.

Leave Render's `PORT` alone. Spring listens publicly on **`0.0.0.0:$PORT`**, defaulting to 10000 locally. Ports 8001 and 8002 are internal ML/render ports in full mode; neither is the public API.

Use `/actuator/health` as Render's readiness path: it checks the API and PostgreSQL without checking workers. `/health` is a public, lightweight liveness endpoint that does not query PostgreSQL or start any heavyweight processing. Leave `app.health.check-processing` unset/false; optional worker checks must not make Free API readiness fail.

For a strictly manual release, turn off Render Auto-Deploy before pushing, then push the changes and use **Deploy latest commit** when ready. This patch does not change that setting or deploy anything. No plan change or persistent disk is required. Leave the Vercel frontend's `NEXT_PUBLIC_API_URL` pointed at the existing backend origin; redeploy the frontend to show the new capability notice.

## What happens at startup

1. The small Python launcher reads cgroup v2/v1 memory limits and validates deployment settings.
2. It resolves `PROCESSING_MODE` (`api`, `full` or `auto`). A detected budget below 1536 MiB always selects API mode, even if full was requested. Auto also chooses API mode on Render when it cannot determine a limit. Set `api` explicitly for Free instead of relying only on detection.
3. It creates writable temporary directories and drops to UID/GID 10001.
4. In API mode it replaces itself with Java using `exec`. There is no resident Python supervisor, ML process, Node process, Webpack or Chromium.
5. The JVM uses a 160 MiB maximum heap, 128 MiB maximum metaspace, 32 MiB code cache, 16 MiB direct-memory cap, Serial GC and a small thread budget. These are component limits, not a guarantee of total process memory. Native memory, stacks, libraries and filesystem cache also count against 512 MB.

Spring's database pool is limited to three connections by default (`DB_POOL_SIZE` can override it), HTTP threads/connections are bounded, and full-mode pipeline jobs run serially. Existing Java environment options are preserved; adding conflicting heap flags or enabling processing manually can invalidate the memory budget.

## Remotion is built once, outside runtime

Docker's Node build stage runs `render-service/scripts/build-bundle.ts`. It compiles the composition, brand/text-rule modules and public font/music assets into `/app/render-service/remotion-bundle`. This artifact is copied into the runtime image. The image sets:

```text
REMOTION_BUNDLE_DIR=/app/render-service/remotion-bundle
REMOTION_ALLOW_RUNTIME_BUNDLE=false
RENDER_CONCURRENCY=1
```

The Node service no longer warms or bundles Remotion when it starts. On a reel request, full mode passes the prebuilt directory to Remotion's renderer. A missing artifact fails explicitly and never falls back to Webpack in Docker. Local development can still bundle on the first reel request when no prebuilt directory is configured. A composition or font change requires a new image build.

Prebundling removes the compilation spike; it does **not** remove Chromium, decoded frames, FFmpeg or model memory. It cannot make the full pipeline safe inside 512 MB.

## Feature availability

| Feature | API mode on Free |
| --- | --- |
| Authentication, CORS, liveness/readiness | Available |
| List/view existing database records; rename/delete papers | Available |
| Review/edit existing claims, policy decisions and audit history | Available; no verification results are invented |
| Page/PDF/media previews and existing downloads | Available only while matching files exist locally |
| Caption approval | Available under existing claim/policy gates |
| Final visual asset approval | Requires successful final rendering in full mode; fails explicitly here |
| Export package | Available for already approved assets/claims with matching media present; approval gates remain enforced |
| New PDF uploads, parse/retry, Gemini extraction/verification/writing, regeneration | Unavailable here; HTTP 503 `PROCESSING_UNAVAILABLE` before new upload/job state changes |
| Playwright image rendering, speech generation and Remotion reels | Require full mode with more memory |

The authenticated `/api/capabilities` endpoint reports the configured mode. The frontend displays the limitation prominently. Buttons that would schedule unavailable work return an explicit explanation; they do not bypass verification or mark processing as successful. `processingEnabled=true` means full mode is configured, not that every worker is currently healthy. Actual stage failures are still recorded normally.

Reviewing or editing a claim invalidates its dependent assets as before; regenerating them needs full mode. Evidence relinking also needs the verifier. If it cannot run, the edit rolls back; the claim is never silently marked edited/approved. A `NEEDS_EVIDENCE` claim cannot be made eligible merely by editing copy without verified evidence.

Gemini itself is a remote API and does not need gigabytes locally. This conservative Free configuration does not start the current ML application because that application eagerly imports Docling/Torch. It does not claim that every individual ML endpoint intrinsically requires more than 512 MB. Splitting out a lightweight Gemini-only worker would be a separate change and would still not solve local PDF or video processing.

## Temporary storage and database limitations

Free has no persistent disk. Uploaded PDFs, images, audio, videos, export ZIPs and disk caches may disappear on a restart, redeploy or idle spin-down. PostgreSQL can retain record and review state independently of these files. The UI warns about this; export now returns `422 EXPORT_FILES_MISSING` rather than silently producing a package without approved media. Restore the original matching files or regenerate/review in full mode. Never fabricate missing evidence. LLM requests can only reuse disk caches while those caches survive; there is no promise of zero new requests after storage is wiped.

Download exports promptly and keep source papers/backups on your own machine. Render Free PostgreSQL also has its own expiration/storage limits; preserve your existing connection configuration and back up data separately. This deployment is suitable for a preview of existing records, not durable processing/storage for an unattended production pipeline.

## Verification on your machine

Build without traversing local papers/secrets:

```powershell
python deploy/build.py --tag steerproof-free:local
```

Use an ignored env file based on `deploy/backend.env.example` and a **separate test database** reachable inside Docker. Run with swap disabled so the test cannot hide an oversized working set:

```powershell
docker run -d --name steerproof-free-check --memory 512m --memory-swap 512m --cpus 1 -p 19002:10000 --env-file .cache/deployment/free.env steerproof-free:local
docker logs steerproof-free-check
docker exec steerproof-free-check python /app/deploy/memory.py
docker inspect steerproof-free-check --format '{{.State.OOMKilled}}'
```

Expected logs: `Processing mode: api`, followed by Spring listening on port 10000. There should be no Uvicorn startup, Node listener, Remotion bundling or Chromium process. Test login, protected `/api/papers`, `/api/capabilities`, a rejected processing request, ordinary reviews and guarded exports. Docker memory measurements validate this image under a local 512 MB cap; they do not prove all document sizes or arbitrary request concurrency will fit Render's environment.

For full mode on your own machine, use `PROCESSING_MODE=full` with adequate memory (the earlier demo ran on a host with about 8 GB available; evaluate at least 4 GB for modest workloads). Provide the same source/storage/database together. If using a local named volume, explicitly point `STORAGE_DIR`, `LLM_CACHE_DIR`, `HF_HOME`, `XDG_CACHE_HOME` at its mounted paths and set `STORAGE_EPHEMERAL=false`. Do not point a separate worker at the cloud database alone and assume files or authentication are shared automatically; an off-host worker transport/shared-storage design is not included in this patch.

## Root cause measurements

The original image was sampled locally under a 2 GiB cap: ML Python RSS about 444 MiB, Node about 473 MiB, Java about 278 MiB, plus the Python supervisor, esbuild helpers, shared libraries and filesystem cache. Docker reported about 1.64 GiB in use at idle. Individual RSS values are diagnostic and are not an additive measure of unique memory. During the new Docker build, the Remotion bundler process alone reported a peak RSS of about 1245 MiB. These measurements explain the 512 MiB startup failure without attributing it solely to a port setting. Build-time compilation is feasible, but the build environment must have more memory than the Free runtime.

The final image was tested locally with `--memory 512m --memory-swap 512m --cpus 1`, `PROCESSING_MODE=auto`, a separate PostgreSQL database, public `PORT=10005`, and a deliberately missing Remotion bundle. It selected API mode, became healthy in about 27 seconds, and passed authentication, ordinary record access, explicit processing rejection without paper-state changes, claim review, stale/claim export gates, brand-caption approval/export/download, rename/delete and 80 capability requests with up to eight concurrent clients. After that workload, Java RSS was about 278 MiB and the container peak was about 330 MiB, including a temporary diagnostic Python process. Cgroup OOM/max/kill counters were all zero. The application had no resident Python/Node/browser process. These are local measurements for a small fixture workload, not a guarantee of Render latency or arbitrary production loads.

The same final image passed full-mode regression checks under a separate 4 GiB cap: a fresh parse of `demo/papers/hall-kahan-2018.pdf` produced 13 pages and 66 Docling passages; protected page previews, carousel/static images, edge-tts/FFmpeg audio and a 4.7-second H.264/AAC Remotion reel succeeded. Runtime logs contained no bundling, and the renderer used the prebuilt artifact. That container peaked at about **3.52 GiB** (including filesystem cache), with zero OOM events. Moving Webpack into the build is therefore useful but does not make even this modest full processing example fit 512 MB.

Final checks: **86 backend tests**, **16 renderer tests**, **3 startup tests**, Ruff for deployment scripts, frontend/renderer type checks, the frontend production build, the final Docker build, and production-browser sign-in/reload/sign-out with the Free capability notice all passed. The backend suite includes the two approval gates, verification-unavailable rollback and missing/restored-media export cases. No live Gemini extraction was rerun in these smoke tests, and no cloud deployment was performed. The existing Gemini/extraction/verification/writer implementation and cache/structured-output configuration remain in place for full mode.

Provider documentation: [Render Free lifecycle/storage limits](https://render.com/docs/free), [Remotion bundle artifact](https://www.remotion.dev/docs/bundle), [renderMedia serve URL](https://www.remotion.dev/docs/renderer/render-media).

## Files changed

Paths below are relative to the repository root.

| Files | Purpose |
| --- | --- |
| `Dockerfile`, `.dockerignore`, `.gitignore` | Build/copy the Remotion artifact; temporary defaults; ignore local bundles; include build scripts |
| `deploy/start.py`, `deploy/healthcheck.py` | Memory-aware API/full startup, bounded JVM, public port, health independent of workers |
| `deploy/build.py`, `deploy/memory.py`, `deploy/backend.env.example`, `deploy/test_start.py` | Allowlisted build context, memory diagnostic, Free environment checklist, startup tests |
| `render-service/scripts/build-bundle.ts`, `render-service/src/bundle.ts` | Build reusable assets; validate/reuse them without runtime Webpack |
| `render-service/src/server.ts`, `render-service/src/reel.ts`, `render-service/test/bundle.test.ts` | Remove warmup; consume artifact; test missing/prebuilt artifact behavior |
| `backend/src/main/resources/application.properties`, `backend/src/main/resources/application-prod.properties` | Processing/storage flags, smaller database/HTTP pools, serial jobs |
| `backend/src/main/java/com/steerclub/steerproof/common/ProcessingAvailability.java`, `ProcessingGuard.java`, `RuntimeController.java` (same directory) | Capabilities, early 503 responses, lightweight liveness |
| `backend/src/main/java/com/steerclub/steerproof/common/InternalServicesHealthIndicator.java`, `WorkspaceAuthFilter.java` (same directory) | Make worker readiness opt-in; allow public liveness while preserving protected API/media |
| `backend/src/main/java/com/steerclub/steerproof/pipeline/MlServiceClient.java`, `RenderServiceClient.java` (same directory) | Enforce processing availability even for internal calls |
| `backend/src/main/java/com/steerclub/steerproof/asset/AssetController.java` | Preserve explicit unavailable-processing response; roll back incomplete visual approvals |
| `backend/src/main/java/com/steerclub/steerproof/claim/ClaimService.java` | Fail closed when evidence relinking cannot verify; preserve needs-evidence status |
| `backend/src/main/java/com/steerclub/steerproof/export/ExportController.java` | Reject exports missing approved media after temporary-file loss |
| `backend/src/test/java/com/steerclub/steerproof/common/ProcessingAvailabilityIntegrationTest.java`, `backend/src/test/java/com/steerclub/steerproof/review/Gate2AndExportIntegrationTest.java` | Verify early guards, unchanged gates, and missing/restored media exports |
| `frontend/components/ProcessingNotice.tsx`, `frontend/app/layout.tsx` | Display truthful mode/storage limitations after sign-in |
| `docs/API.md`, `docs/DEPLOYMENT.md`, `docs/RENDER_FREE.md` | Document API changes, Free setup, measurements, limitations and verification |
