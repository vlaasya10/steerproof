# Deploy to Vercel and Render

For the restored public Studio and deployment disclaimer, follow [the Studio release instructions](STUDIO.md#commit-and-release). Redeploy the backend first for `GET /api/public/capabilities`, then Vercel. Existing environment variables, authentication and Free API mode remain unchanged.

**For the public no-login showcase on the existing free deployment, use [the showcase release steps](SHOWCASE.md#exact-release-steps).** Public metadata/media ship with Vercel; `/workspace` remains private. No live processing or persistent Render storage is needed for these bundled samples.

**Using Render Free (512 MB)? Follow [the Free deployment guide](RENDER_FREE.md).** The instructions below describe the full processing deployment on a machine with more memory. The Docker image now defaults to temporary storage and automatically selects API-only mode under a small memory limit. Free hosting cannot run the complete pipeline locally.

The frontend runs on Vercel. One Docker web service on Render runs Spring, the Python ML service, and the Node renderer together. They share one persistent disk; only Spring is public. PostgreSQL is a separate database. Keep **one backend instance**: local files and job recovery are designed for a single worker.

This setup does not create cloud resources automatically. Render persistent disks require paid hosting, and the free 512 MB instance is too small for Docling plus Chromium/video rendering. Start by evaluating a backend with at least 4 GB RAM, use render concurrency 1, and measure peak memory with your PDFs. Larger documents may need more. Database, compute and disk charges are separate. If hosting must remain free, keep the backend and database on your own machine and use Vercel only for the frontend; a public HTTPS endpoint is still required.

## 1. Put the source in a private GitHub repository

Upload the source, Dockerfile, lockfiles and deployment configuration. Do not upload `.env`, `.env.local`, `.cache`, `storage`, virtual environments, `node_modules` or `target`. The repository ignore files exclude these. Review staged files before pushing: existing papers, rendered assets and API keys belong outside Git.

If this folder is not yet a Git repository, run from the project root:

```powershell
git init
git add .
git status --short
git commit -m "Prepare deployment"
git branch -M main
git remote add origin https://github.com/YOUR_ACCOUNT/YOUR_PRIVATE_REPOSITORY.git
git push -u origin main
```

For an existing repository, commit and push to its existing remote instead.

## 2. Create the database on Render

Create a PostgreSQL database in the same region as the backend. Choose storage and retention appropriate for real papers; Render's free database expires and is unsuitable for durable data. Save the internal hostname, database name, username and password from its connection details.

Spring needs a JDBC URL, not Render's `postgresql://user:password@host/database` URL:

```text
DB_URL=jdbc:postgresql://INTERNAL_HOST:5432/DATABASE_NAME
DB_USER=DATABASE_USER
DB_PASSWORD=DATABASE_PASSWORD
```

Keep credentials in the separate fields. Use `?sslmode=require` if the database connection requires TLS. Flyway creates/migrates the schema automatically. An external compatible PostgreSQL database can also be used.

## 3. Deploy the backend on Render

Create a **Web Service**, connect the private GitHub repository, and set:

| Setting | Value |
| --- | --- |
| Runtime | Docker |
| Root directory | Leave empty (repository root) |
| Dockerfile path | `./Dockerfile` |
| Health check path | `/actuator/health` |
| Instances | 1, no horizontal autoscaling |
| Persistent disk mount path | `/var/data` |
| Disk capacity | Allow room for PDFs, page images, videos and model caches; monitor usage |

Do not set a separate build or start command. The image starts all three processes and exposes Render's `PORT` automatically. A disk is required **before processing papers**: a normal container filesystem is temporary. The image places papers and LLM caches in `/var/data/storage`, and Docling model caches in `/var/data/cache`. Internal ML/render ports bind to loopback.

Add these environment variables using `deploy/backend.env.example` as a checklist:

| Variable | Value |
| --- | --- |
| `DB_URL`, `DB_USER`, `DB_PASSWORD` | Database values from step 2 |
| `GEMINI_API_KEY` | Your Google AI Studio key, using the free tier |
| `GEMINI_MODEL` | `gemini-2.5-flash`, or a model available to your account |
| `GEMINI_MODEL_EXTRACT` | Same available model |
| `GEMINI_MODEL_VERIFY` | Same available model |
| `GEMINI_MODEL_WRITE` | Same available model |
| `LLM_MAX_RPM` | `8`, or lower to fit your free quota |
| `DEPLOYMENT_ACCESS_KEY` | A private random workspace password, at least 32 characters |
| `CORS_ALLOWED_ORIGINS` | Your exact frontend origin, e.g. `https://steerproof.vercel.app` |
| `DEMO_MODE` | `false` |
| `PIXABAY_API_KEY` | Optional free stock footage key |

Generate a password locally and save it in a password manager:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Never use a `NEXT_PUBLIC_` variable for a backend secret. The production profile requires access protection and an explicit CORS allowlist. Use the intended Vercel project domain initially; update it after Vercel assigns the actual domain. Origins have no trailing slash or path. Multiple trusted origins may be comma-separated; wildcards are rejected.

Deploy and inspect the logs. First image build and first parse are slow because CPU Torch, Chromium, FFmpeg and Docling model files must be downloaded. Model downloads are cached on the disk. Backend health checks include PostgreSQL, ML and renderer availability. Save the resulting URL, e.g. `https://steerproof-api.onrender.com`.

## 4. Deploy the frontend on Vercel

Import the same GitHub repository as a new project:

| Setting | Value |
| --- | --- |
| Root directory | `frontend` |
| Framework | Next.js |
| Node.js | 22.x |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | Framework default |

Set this variable for Production (and Preview only if desired):

```text
NEXT_PUBLIC_API_URL=https://YOUR_BACKEND.onrender.com
```

Use the backend origin without `/api`. It must be HTTPS and cannot be localhost on Vercel. This value is embedded during the build: redeploy the frontend whenever it changes. No database, Gemini or workspace password belongs in Vercel.

Deploy, copy the actual frontend origin into Render's `CORS_ALLOWED_ORIGINS`, and redeploy the backend. Preview URLs need their own explicit trusted origin or a fixed preview domain; arbitrary Vercel preview domains are not allowed automatically.

## 5. Verify before using real papers

1. Open `https://YOUR_BACKEND.onrender.com/actuator/health`; expect `{"status":"UP"}`. Unauthenticated `/api/papers` must return 401.
2. Open Vercel and sign in using the workspace password. Check that the reviewer name is correct.
3. Upload `demo/papers/hall-kahan-2018.pdf`. Verify page previews and extraction, then review the claims at Gate 1.
4. Approve the claims you have actually reviewed, generate assets, and verify carousel/static previews and reel playback/audio.
5. Review assets at Gate 2 and export. Unapproved claims/assets must still block export. Policy overrides are explicit, audited reviewer actions.
6. Restart the backend and confirm the paper, previews and export remain available. If a deploy interrupted a running stage, the paper becomes failed with a restart message; use **Retry stage** to resume. Avoid deploying during active jobs.

Workspace access is shared access for a private, trusted team. Sessions last eight hours in the current browser tab. Reviewer names are audit labels, not verified doctor identities. This is not a public multi-user account system. Changing the workspace password invalidates existing sessions. Keep the repository, storage, database and shared password private; do not place sensitive patient information in the demo deployment.

Back up PostgreSQL **and** `/var/data/storage` together. To move existing local papers, stop writes, migrate the local database and copy the matching storage directory; deploying source alone starts with an empty database. Imported storage must be readable and writable by the container's UID/GID `10001`. Keep IDs and relative paths intact. Windows path separators are normalized when resolving stored paths. Never commit paper data to Git.

## Optional: check the production container locally

From the repository root with Docker running:

```powershell
python deploy/build.py
```

The helper builds `steerproof-deploy:local` using an allowlisted context, so local data, secrets and environments are not traversed. A standard `docker build -t steerproof-deploy:local .` also works where the filesystem supports Docker's normal context walk.

Copy `deploy/backend.env.example` into `.cache/deployment/local.env`, fill the values, and point `DB_URL` to a database reachable **inside** Docker (`host.docker.internal` for a database on the host, or a container hostname on the same network). Then run:

```powershell
docker run --rm --name steerproof-deploy -p 10000:10000 --env-file .cache/deployment/local.env --mount source=steerproof-deploy-data,target=/var/data steerproof-deploy:local
```

Use `http://localhost:10000/actuator/health` to check readiness. Do not reuse the production database for a smoke test.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Vercel build rejects API URL | Set a real HTTPS `NEXT_PUBLIC_API_URL`, then redeploy |
| Browser CORS error | Match the actual Vercel origin exactly in Render; check backend health first |
| Workspace sign-in fails | Check `DEPLOYMENT_ACCESS_KEY`; changing it signs everyone out |
| Missing data after deploy | Verify `/var/data` disk is attached and database settings did not change |
| Container exits during parse/render | Inspect out-of-memory events; increase RAM or use a smaller PDF |
| Parse first run takes a long time | Docling model download; check outbound access and available disk |
| Gemini 429 | Lower `LLM_MAX_RPM`, wait for quota reset, then retry; cached requests are reused |
| Reel audio fails | Check outbound access to edge-tts; FFmpeg and Chromium are installed in the image |

Provider references: [Render Docker](https://render.com/docs/docker), [persistent disks](https://render.com/docs/disks), [free-tier limits](https://render.com/docs/free), [Vercel Next.js](https://vercel.com/docs/frameworks/full-stack/nextjs), and [Vercel environment variables](https://vercel.com/docs/environment-variables).

## Local deployment verification

Validated on 19 October 2026: 82 backend tests, 15 renderer tests, 3 parser provenance tests, frontend type checking and production builds. The frontend production dependency audit reported zero vulnerabilities. The Linux production image passed protected API/media access, browser password rejection/sign-in/refresh/sign-out, demo parsing (13 pages, 66 passages), carousel/static rendering, edge-tts/FFmpeg audio and a 4.7-second Remotion reel with H.264 video/AAC audio. A container restart retained the reel and converted an interrupted parse fixture into an audited, retryable failure. These checks used a separate local database and volume; cloud provisioning and a full live Gemini run in the deployed environment remain part of the verification in step 5.
