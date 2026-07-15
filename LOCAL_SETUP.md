# Running ProofGoal Locally (VS Code / your own machine)

This guide walks through taking the zip export from Replit and getting the app running
locally end-to-end: API server (Express + Postgres) and frontend (Vite + React).

The project is a **pnpm monorepo** with two runnable services:

| Service | Location | Port | What it is |
|---|---|---|---|
| API Server | `artifacts/api-server` | `8080` | Express + Drizzle ORM + Postgres |
| Frontend | `artifacts/proofgoal` | `5000` | Vite + React, proxies `/api` to the API server |

Shared code lives in `lib/` (`db`, `api-zod`, `api-client-react`) and is linked via
pnpm workspaces — you don't run those directly, they're just imported.

---

## 1. Prerequisites to install

Install these before doing anything else:

1. **Node.js 20.x** — https://nodejs.org (the project was built and tested on Node 20; a
   newer LTS will very likely work too, but 20 is the safe choice).
   Check with:
   ```bash
   node -v
   ```
2. **pnpm** — this repo uses pnpm workspaces (not plain npm/yarn) for dependency linking.
   ```bash
   corepack enable
   corepack prepare pnpm@10 --activate
   pnpm -v
   ```
   (If `corepack` isn't available, install pnpm directly: `npm install -g pnpm`.)
3. **PostgreSQL** — you need a running Postgres database and a connection string.
   Pick ONE of these:
   - **Local Postgres** (simplest for pure offline dev):
     - macOS: `brew install postgresql@16 && brew services start postgresql@16`
     - Windows: install via https://www.postgresql.org/download/windows/
     - Linux: `sudo apt install postgresql` (or your distro's equivalent), then
       `sudo systemctl start postgresql`
     - Create a database and user:
       ```bash
       psql -U postgres
       CREATE DATABASE proofgoal;
       CREATE USER proofgoal WITH PASSWORD 'proofgoal';
       GRANT ALL PRIVILEGES ON DATABASE proofgoal TO proofgoal;
       \q
       ```
     - Your connection string will be:
       `postgresql://proofgoal:proofgoal@localhost:5432/proofgoal`
   - **A free hosted Postgres** (no local install needed) — e.g. [Neon](https://neon.tech)
     or [Supabase](https://supabase.com). Create a project, copy the connection string
     they give you (it looks like `postgresql://user:pass@host/dbname?sslmode=require`).
4. **VS Code** — https://code.visualstudio.com, plus (optional but recommended) the
   *ESLint* and *Tailwind CSS IntelliSense* extensions.
5. **Git** (optional) — only needed if you want to `git init` the extracted folder to
   track changes yourself; not required to run the app.

---

## 2. Unzip and open the project

1. Download the zip export from Replit (Replit menu → **Download as zip**, or from the
   project's three-dot menu if you're viewing it in the browser).
2. Extract it somewhere sensible, e.g. `~/dev/proofgoal`.
3. Open the extracted folder in VS Code:
   ```bash
   cd ~/dev/proofgoal
   code .
   ```
4. Open a terminal inside VS Code (`` Ctrl+` `` / `` Cmd+` ``) — you'll run every command
   below from there, at the **repo root** unless a step says to `cd` into a subfolder.

---

## 3. Install dependencies

From the repo root:

```bash
pnpm install
```

This installs and links every workspace package (`artifacts/*`, `lib/*`, `scripts`) in
one shot — you do **not** need to run `pnpm install` separately inside each subfolder.

---

## 4. Configure environment variables

Replit injects these as project secrets; locally you provide them as **plain `.env`
files** (already git-ignored by Replit's setup, so create them fresh).

### 4a. API server — `artifacts/api-server/.env`

Create the file and fill in:

```env
# Required
DATABASE_URL=postgresql://proofgoal:proofgoal@localhost:5432/proofgoal
PORT=8080
NODE_ENV=development

# Optional — leave unset for a fully working app in "no-admin-lock, no-payouts" mode
ADMIN_SECRET=
TREASURY_WALLET_PUBKEY=
TREASURY_WALLET_PRIVATE_KEY=
TXLINE_API_KEY=
TXLINE_NETWORK=devnet
LOG_LEVEL=info
```

What each optional var does if you skip it:
- **`ADMIN_SECRET`** unset → the `/admin` API routes are open to anyone (fine for local
  dev on your own machine). Set it to require an `x-admin-key` header / `?adminKey=`
  query param matching this value.
- **`TREASURY_WALLET_PUBKEY` / `TREASURY_WALLET_PRIVATE_KEY`** unset → deposits/premiums
  can't be verified against a real treasury wallet and payouts can't be sent; the rest of
  the app (markets, browsing, UI) still works. To exercise real Solana devnet flows,
  generate a devnet keypair and fund it — see §7.
- **`TXLINE_API_KEY`** unset → the app falls back to its built-in match **simulation**
  instead of pulling real fixtures from the TxLINE oracle. This is the easiest way to run
  the app locally without any external account.

### 4b. Frontend — the dev server needs two env vars, but they're already wired into the
Replit workflow command rather than a `.env` file. Locally, set them the same way. No
`.env` file is required unless you want to override the admin panel password:

```env
# artifacts/proofgoal/.env (optional)
VITE_ADMIN_KEY=proofgoal-admin
```

(`VITE_ADMIN_KEY` only gates the `/admin` page in the browser UI; leave it out to use the
default password `proofgoal-admin`.)

> **Note:** never commit real secrets (private keys, API keys) to git. Both `.env` files
> above should be added to `.gitignore` if you start tracking this folder with git.

---

## 5. Set up the database schema

From the repo root, push the Drizzle schema to your database:

```bash
cd lib/db
DATABASE_URL="postgresql://proofgoal:proofgoal@localhost:5432/proofgoal" pnpm run push
cd ../..
```

(If you already exported `DATABASE_URL` in your shell session, or it's picked up from
`artifacts/api-server/.env` via a tool like `dotenv-cli`, you can just run `pnpm run push`
directly — the command above is the no-assumptions version.)

This creates all the tables (`matches`, `markets`, `positions`, `insurance_products`,
`insurance_policies`, `liquidity_pools`, `liquidity_positions`, `governance_proposals`,
`governance_votes`, `proof_records`, `users`). It's empty at this point — no seed data.

### Optional: seed some starter data

There's a seed script at `scripts/src/seed.ts`:

```bash
cd scripts
DATABASE_URL="postgresql://proofgoal:proofgoal@localhost:5432/proofgoal" pnpm run seed
cd ..
```

If you skip seeding and also skip `TXLINE_API_KEY`, the app will still populate matches
via its background simulation job once the API server starts — you don't strictly need
this step to see the app working.

---

## 6. Run the app

You need **two terminals** running at once (or one terminal + VS Code's split terminal).

**Terminal 1 — API server:**
```bash
cd artifacts/api-server
PORT=8080 pnpm run dev
```
Wait for `Server listening — port: 8080` in the log.

**Terminal 2 — Frontend:**
```bash
cd artifacts/proofgoal
PORT=5000 BASE_PATH=/ pnpm run dev
```
Wait for the Vite `Local: http://localhost:5000/` line.

Then open **http://localhost:5000** in your browser. The frontend's dev server proxies
any `/api/*` request to `http://localhost:8080`, so both need to be running — the
frontend alone will show network errors if the API server isn't up.

Visit **http://localhost:5000/admin** for the admin dashboard (password: `proofgoal-admin`
unless you changed `VITE_ADMIN_KEY`).

### Optional: run both with one command

If you'd rather not manage two terminals, install `concurrently` at the root and add a
convenience script, or just use two VS Code integrated terminal panes side by side
(right-click the terminal panel → "Split Terminal").

---

## 7. (Optional) Enabling real Solana devnet + TxLINE features

Skip this section entirely if you just want to click around the UI locally — everything
above already gives you a fully working app on simulated data with no real money
movement.

To exercise actual devnet transactions (deposits, premiums, payouts):

1. Install the Solana CLI (https://docs.solana.com/cli/install) or use `@solana/web3.js`
   directly to generate a keypair:
   ```bash
   solana-keygen new --outfile treasury-keypair.json
   solana airdrop 5 <the-generated-pubkey> --url devnet
   ```
2. Put the resulting base58 secret key into `TREASURY_WALLET_PRIVATE_KEY` and the public
   key into `TREASURY_WALLET_PUBKEY` in `artifacts/api-server/.env`.
3. Restart the API server.
4. Use a browser wallet extension (Phantom or Solflare) set to **devnet** to connect from
   the frontend and sign real transactions.

To pull real World Cup fixtures instead of the simulation, you'll need a TxLINE API key
from their provider and set `TXLINE_API_KEY` — without one, the sync job logs
"TXLINE_API_KEY not set — sync skipped" and the simulation fallback takes over
automatically, which is expected and fine for local development.

---

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| `DATABASE_URL must be set` on API server start | You didn't create `artifacts/api-server/.env` or didn't export it in the shell running the server. |
| `PORT environment variable is required` | Set `PORT=8080` (API) / `PORT=5000` (frontend) before `pnpm run dev`. |
| Frontend loads but every request 404s / network errors | The API server (port 8080) isn't running — start it first. |
| `pnpm: command not found` | Re-run the corepack steps in §1, or `npm install -g pnpm`. |
| Drizzle push fails with a connection error | Confirm Postgres is actually running (`pg_isready` locally, or check your hosted provider's dashboard) and the connection string is correct — for hosted Postgres you usually need `?sslmode=require` appended. |
| Port 5000 or 8080 already in use | Something else on your machine is bound to that port — either stop it or change `PORT` in both the `.env`/command and remember the frontend's Vite proxy target (`http://localhost:8080`) would then need updating too if you move the API server's port. |

---

## 9. Quick reference — full command sequence

```bash
# one-time setup
pnpm install
# create artifacts/api-server/.env with DATABASE_URL, PORT=8080, NODE_ENV=development
cd lib/db && pnpm run push && cd ../..

# every time you want to run it, in two terminals:
cd artifacts/api-server && PORT=8080 pnpm run dev
cd artifacts/proofgoal && PORT=5000 BASE_PATH=/ pnpm run dev

# then open http://localhost:5000
```
