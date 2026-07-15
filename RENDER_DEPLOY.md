# Deploying ProofGoal to Render

This app is a **pnpm-workspace monorepo** with two services that need to go live
separately on Render:

| Service | Render resource type | What it runs |
|---|---|---|
| API server | **Web Service** | Express + Postgres, built with esbuild |
| Frontend | **Static Site** | Vite build, static HTML/JS/CSS |
| Database | **PostgreSQL** (Render managed) | Drizzle ORM schema |

If your deploy has been "always failing," it is almost certainly one of the two
things in §0 below — read that first.

---

## 0. The #1 and #2 causes of a failing Render deploy on this repo

**#1 — Root Directory set to a subfolder.** If you configured the Render service with
"Root Directory" = `artifacts/api-server` (or `artifacts/proofgoal`), the build will
fail or silently produce a broken bundle. This repo uses pnpm workspaces —
`pnpm-workspace.yaml` and the lockfile live at the **repo root**, and packages like
`@workspace/db` and `@workspace/api-zod` are resolved as `workspace:*` links from
there. Point Root Directory at the repo root (`.`) for **both** services, and instead
`cd`/`--filter` into the right package from the build/start commands. This is the
single most common failure for monorepos on Render.

**#2 — npm instead of pnpm.** Render defaults to detecting `npm`/`yarn` from
`package-lock.json`/`yarn.lock`. This repo has neither — it has `pnpm-lock.yaml`. If
Render's build log shows `npm install` running and failing to resolve
`@workspace/...` packages, that's why. Every build command below starts by activating
pnpm via Corepack before installing.

If you already have services set up on Render with the wrong Root Directory, it's
faster to delete them and recreate following §2/§3 below than to fix them in place.

---

## 1. One-shot option: deploy with the included `render.yaml` Blueprint

This repo now includes a `render.yaml` at the root that defines both services plus
the database in one file (a Render "Blueprint"). This is the most reliable path
because it removes all manual dashboard configuration as a source of mistakes.

1. Push this repo to a GitHub/GitLab repository (Render deploys from a git repo, not
   a zip — connect your GitHub account if you haven't).
2. On Render: **New → Blueprint** → select the repo → Render reads `render.yaml` and
   shows you the 3 resources it will create (`proofgoal-api`, `proofgoal-frontend`,
   `proofgoal-db`). Click **Apply**.
3. Render will ask you to fill in the env vars marked `sync: false` in the blueprint
   (`ADMIN_SECRET`, `TREASURY_WALLET_PUBKEY`, `TREASURY_WALLET_PRIVATE_KEY`,
   `TXLINE_API_KEY`) — see §4 for what each does; you can leave them blank and the app
   still runs (see §4's fallback behavior).
4. Wait for `proofgoal-api` to finish deploying first, note its URL (shown at the top
   of its Render dashboard page, looks like `https://proofgoal-api.onrender.com`, or
   `https://proofgoal-api-xxxx.onrender.com` if that name was taken).
5. If the URL doesn't exactly match `https://proofgoal-api.onrender.com`, open
   `render.yaml`, fix the `destination` under `proofgoal-frontend`'s rewrite rule to
   match your actual API URL, commit, and push — Render auto-redeploys on push. (Or
   just edit it directly in the Render dashboard: `proofgoal-frontend` → **Redirects/Rewrites** tab.)
6. Once both services are live, do the one-time database setup in §5 (push schema +
   optionally seed) — Blueprint deploy does **not** run this for you.

If you'd rather configure everything by hand in the dashboard (e.g. you don't want to
push `render.yaml` or connect git yet), follow §2–§5 instead — they describe exactly
what the Blueprint automates.

---

## 2. Manual setup — Database

1. Render dashboard → **New → PostgreSQL**.
2. Name it (e.g. `proofgoal-db`), pick a region — **use the same region for the API
   service later**, cross-region DB calls add real latency.
3. Once created, open it and copy the **Internal Database URL** (for the API service
   to use) and separately keep the **External Database URL** handy (you'll need it
   from your own machine in §5 to push the schema).

---

## 3. Manual setup — API service (Web Service)

**New → Web Service** → connect your repo.

| Field | Value |
|---|---|
| Root Directory | *(leave blank / repo root — do NOT set to `artifacts/api-server`)* |
| Runtime | Node |
| Region | same as the database |
| Build Command | `corepack enable && corepack prepare pnpm@10.26.1 --activate && pnpm install --frozen-lockfile && pnpm --filter @workspace/api-server run build` |
| Start Command | `node artifacts/api-server/dist/index.mjs` |
| Instance Type | Free (or whatever tier you want) |

**Environment variables** (Environment tab):

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | paste the **Internal Database URL** from §2 |
| `TXLINE_NETWORK` | `devnet` |
| `ADMIN_SECRET` | optional — see §4 |
| `TREASURY_WALLET_PUBKEY` | optional — see §4 |
| `TREASURY_WALLET_PRIVATE_KEY` | optional — see §4 |
| `TXLINE_API_KEY` | optional — see §4 |

Do **not** set a `PORT` variable — Render injects its own `PORT` automatically and the
app already reads `process.env.PORT` (`artifacts/api-server/src/index.ts`), so it
binds to whatever Render assigns.

Deploy, then check the **Logs** tab for `Server listening — port: <n>`. Copy the
service's public URL from the top of the page (e.g.
`https://proofgoal-api.onrender.com`) — you need it in the next section.

---

## 4. What the optional env vars do (safe to leave blank)

- **`ADMIN_SECRET`** blank → the `/admin` API routes are open to anyone who knows the
  URL (fine to start with; set a real value once you're live to require the
  `x-admin-key` header).
- **`TREASURY_WALLET_PUBKEY`** / **`TREASURY_WALLET_PRIVATE_KEY`** blank → deposits,
  premiums, and payouts that need a real treasury wallet won't work, but browsing
  markets/matches/insurance/governance UI all work fine. Generate a Solana devnet
  keypair (`solana-keygen new`) and fund it via `solana airdrop` if you want real
  devnet money flows later.
- **`TXLINE_API_KEY`** blank → the sync job logs "TXLINE_API_KEY not set — sync
  skipped" and the app's built-in match **simulation** takes over automatically —
  the app still fully works end-to-end on simulated fixtures.

---

## 5. Manual setup — Frontend (Static Site)

**New → Static Site** → connect your repo.

| Field | Value |
|---|---|
| Root Directory | *(leave blank / repo root)* |
| Build Command | `corepack enable && corepack prepare pnpm@10.26.1 --activate && pnpm install --frozen-lockfile && PORT=5000 BASE_PATH=/ pnpm --filter @workspace/proofgoal run build` |
| Publish Directory | `artifacts/proofgoal/dist/public` |

`PORT` and `BASE_PATH` in the build command aren't used by the static output — Vite's
config just requires them to be *set* at build time or it throws (see
`artifacts/proofgoal/vite.config.ts`). `BASE_PATH=/` is correct since the site will be
served from its own domain root.

### Wire up the API — this is the step people miss

The frontend's code calls the API with **relative** paths like `fetch("/api/matches")`
(there's no hardcoded backend URL in the source). That only works automatically when
frontend and API share an origin — which two separate Render services never do. Fix
it with a rewrite rule so the static site transparently proxies `/api/*` to your API
service:

1. Open the Static Site → **Redirects/Rewrites** tab → **Add Rule**.
2. Source: `/api/*` — Destination: `https://<your-api-service>.onrender.com/api/*`
   (use the exact URL you copied at the end of §3) — Action: **Rewrite**.
3. Add a second rule for client-side routing so refreshing on `/portfolio`, `/admin`,
   etc. doesn't 404: Source `/*` — Destination `/index.html` — Action: **Rewrite**.
   Order matters: this catch-all rule must be **below** the `/api/*` rule.

Deploy, then open the site's URL — the frontend should now load matches/markets from
the live API.

---

## 6. One-time database setup (schema + seed data)

Render's free web service doesn't give you a persistent shell to run one-off
commands, so do this from **your own machine**, pointed at Render's Postgres:

```bash
git clone <your-repo-url>
cd <repo>
pnpm install

# use the EXTERNAL Database URL from the Render Postgres dashboard here
export DATABASE_URL="postgresql://user:pass@dpg-xxxx.render.com/proofgoal_xxxx"

# create all tables
pnpm --filter @workspace/db run push

# optional: seed insurance products / liquidity pools / governance proposals
pnpm --filter @workspace/scripts run seed
```

Re-run `pnpm --filter @workspace/db run push` any time you change
`lib/db/src/schema/*` and redeploy — schema changes are not automatic on deploy.

---

## 7. Verifying the deploy

1. Visit the API service's own URL directly:
   `https://<your-api-service>.onrender.com/api/analytics/summary` should return JSON,
   not a 404 or 502.
2. Visit the frontend URL — matches/markets should load. Open browser DevTools →
   Network tab, confirm `/api/...` requests return 200s from the frontend's own
   domain (proof the rewrite proxy is working) rather than failing with a CORS error
   or 404.
3. Visit `/admin` on the frontend — password is `proofgoal-admin` unless you set
   `VITE_ADMIN_KEY` (note: that one has to be baked in at **build time** as an env
   var on the Static Site's Environment tab, since Vite inlines `VITE_*` vars into
   the built JS).

---

## 8. Common failure signatures and fixes

| Symptom | Cause | Fix |
|---|---|---|
| Build log shows `npm install` or `Cannot find module '@workspace/db'` | Root Directory set to a subfolder, or pnpm never activated | Root Directory → repo root; use the Corepack + `pnpm install --frozen-lockfile` build command from §3/§5 |
| API deploys but `Logs` show `DATABASE_URL must be set` | Env var missing/misnamed, or pasted the wrong (External vs Internal) URL | Use the **Internal** Database URL, same region as the API service |
| API deploys, logs show `Server listening`, but the URL 502s | Health check path wrong, or app crashed after boot — check for a second error further down the log | Confirm `healthCheckPath` (if using the Blueprint) hits a real route (`/api/analytics/summary`), check DB connectivity |
| Frontend loads, but every page is stuck loading / console shows failed `fetch` to `/api/...` returning HTML (404 page) | Missing or misordered rewrite rule | Add the `/api/*` → API URL rewrite from §5, make sure it's listed **above** the `/*` → `/index.html` catch-all |
| Frontend loads, `/admin` or `/portfolio` 404s on direct visit/refresh | No SPA fallback rewrite | Add the `/*` → `/index.html` rewrite rule |
| Static Site build fails with `PORT environment variable is required` | Build command didn't set `PORT`/`BASE_PATH` inline | Use the exact build command from §5 (`PORT=5000 BASE_PATH=/ pnpm --filter ...`) |
| Everything deploys but data never appears / matches list stays empty | `TXLINE_API_KEY` unset and DB was never seeded | That's expected for matches (simulation kicks in once a match's kickoff passes) but run §6's seed step for insurance/liquidity/governance content |
| Free-tier services "sleep" and the first request after inactivity times out or is very slow | Render free Web Services spin down after 15 min idle | Expected on the free plan; upgrade to a paid instance to avoid it, or ignore it for a demo/dev deployment |

---

## 9. Quick reference

```
render.yaml at repo root defines everything — Blueprint deploy is the fastest path.

Manual equivalent:
  proofgoal-db          → Render PostgreSQL
  proofgoal-api         → Web Service, root=., build+start per §3, DATABASE_URL from DB
  proofgoal-frontend    → Static Site, root=., build per §5, publish=artifacts/proofgoal/dist/public
                           + rewrite /api/* -> proofgoal-api URL
                           + rewrite /*     -> /index.html

One-time, from your machine:
  DATABASE_URL=<render external url> pnpm --filter @workspace/db run push
  DATABASE_URL=<render external url> pnpm --filter @workspace/scripts run seed
```
