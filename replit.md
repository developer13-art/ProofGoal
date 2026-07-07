# ProofGoal

A full-featured Solana sports prediction and insurance platform for the FIFA World Cup. Users connect a real Solana wallet (Phantom, Solflare, mobile) to trade prediction markets, purchase coverage policies, and vote on governance proposals. Live match data flows in from the TxLINE oracle once activated.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/proofgoal run dev` — run the React frontend
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run seed` — seed platform-defined content (insurance products, liquidity pools, governance proposals)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `TXLINE_API_KEY` — TxLINE oracle API key (present; needs on-chain activation)

## Stack

- pnpm workspaces, Node.js 20 (Replit runtime), TypeScript 5.9
- Frontend: React 18 + Vite, Tailwind CSS, shadcn/ui, TanStack Query, Wouter router
- Wallet: `@solana/wallet-adapter-react` + `@solana/wallet-adapter-react-ui` (Phantom, Solflare, mobile WalletConnect)
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/db/src/schema/` — DB schema source of truth (matches, markets, positions, insurance, proofs, liquidity, governance)
- `lib/api-zod/src/generated/` — generated Zod schemas and TypeScript types from OpenAPI spec
- `lib/api-client-react/src/generated/` — generated TanStack Query hooks
- `artifacts/api-server/src/routes/` — all Express route handlers
- `artifacts/api-server/src/lib/txline.ts` — TxLINE oracle sync + background polling
- `artifacts/proofgoal/src/pages/` — all frontend pages
- `artifacts/proofgoal/src/lib/wallet.tsx` — Solana wallet context + backend registration
- `scripts/src/seed.ts` — platform content seed (idempotent)

## Architecture decisions

- **Oracle-first data**: Matches and markets are NEVER seeded with fake data. Only `syncMatchesFromTxline()` can populate matches — this runs on a 60s background poll once the API key is activated.
- **Backend-simulated settlement**: No real Anchor smart contracts. The Express API simulates on-chain settlement for development/demo purposes.
- **Solana wallet adapter**: Real wallet connection via browser extension (Phantom, Solflare) or mobile QR. Wallet public key is registered with the backend on connection.
- **Platform-seeded content**: Insurance products, liquidity pools, and governance proposals are pre-seeded via `scripts/src/seed.ts`. Run this once after DB push.
- **Path-based proxy**: All services route through the shared Replit reverse proxy. Never call service ports directly in app code.

## Product

- **Dashboard** — platform analytics and live match overview
- **Markets** — prediction market browser and trading (bet on match outcomes, scores, scorers)
- **Matches** — World Cup fixture list with live scores from TxLINE oracle
- **Insurance** — on-chain coverage products (team exit, goal milestones, qualification)
- **Portfolio** — wallet-gated view of open positions and active insurance policies
- **Proofs** — oracle-attested match result proofs used for settlement
- **Governance** — DAO voting on platform proposals; liquidity pool browser

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `@solana/wallet-adapter-wallets` is blocked by Replit's package firewall (Trezor deps fetch protobufjs). Use individual adapters: `@solana/wallet-adapter-phantom` and `@solana/wallet-adapter-solflare` instead.
- Solana web3.js needs `buffer/` alias in Vite config + `buffer` in `optimizeDeps.include` to avoid "module externalized for browser" errors.
- Composite libs (`@workspace/db`, `@workspace/api-zod`) require `pnpm run typecheck:libs` after schema changes before dependent packages resolve exports.
- `pnpm add <workspace-pkg>` fails with 404 against npm registry; manually edit package.json with `"workspace:*"` then `pnpm install`.
- Never seed fake match/market data — matches only come from TxLINE oracle sync.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
