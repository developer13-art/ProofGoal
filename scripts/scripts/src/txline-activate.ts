/**
 * TxLINE one-shot activation script.
 *
 * Handles all four steps from the TxLINE getting-started guide:
 *   1. Wallet setup (generates or loads a local keypair; airdrops on devnet)
 *   2. Subscribe on-chain (free tier, service level 1, 4 weeks)
 *   3. Activate the API token (sign + call /api/token/activate)
 *   4. Print the activated token → save it as TXLINE_API_KEY
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run txline:activate
 *
 * After running, copy the printed token into your TXLINE_API_KEY secret.
 * If you activated on devnet, also set TXLINE_NETWORK=devnet.
 */

import * as anchor from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import nacl from "tweetnacl";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WALLET_PATH = path.resolve(__dirname, "../.activation-wallet.json");

// ── Network config ────────────────────────────────────────────────────────────

const NETWORK = (process.env.TXLINE_NETWORK ?? "devnet") as "mainnet" | "devnet";

const CONFIG = {
  mainnet: {
    rpcUrl: "https://api.mainnet-beta.solana.com",
    apiOrigin: "https://txline.txodds.com",
    programId: new PublicKey("9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA"),
    txlTokenMint: new PublicKey("Zhw9TVKp68a1QrftncMSd6ELXKDtpVMNuMGr1jNwdeL"),
  },
  devnet: {
    rpcUrl: "https://api.devnet.solana.com",
    apiOrigin: "https://txline-dev.txodds.com",
    programId: new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J"),
    txlTokenMint: new PublicKey("4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG"),
  },
} as const;

const { rpcUrl, apiOrigin, programId, txlTokenMint } = CONFIG[NETWORK];

const SERVICE_LEVEL_ID = 1;
const DURATION_WEEKS = 4;
const SELECTED_LEAGUES: number[] = [];

// ── Wallet ────────────────────────────────────────────────────────────────────

function loadOrCreateKeypair(): Keypair {
  if (fs.existsSync(WALLET_PATH)) {
    const raw = JSON.parse(fs.readFileSync(WALLET_PATH, "utf-8")) as number[];
    const kp = Keypair.fromSecretKey(Uint8Array.from(raw));
    console.log("Loaded existing activation wallet:", kp.publicKey.toBase58());
    return kp;
  }
  const kp = Keypair.generate();
  fs.writeFileSync(WALLET_PATH, JSON.stringify(Array.from(kp.secretKey)));
  console.log("Generated new activation wallet:", kp.publicKey.toBase58());
  console.log("Saved keypair to", WALLET_PATH);
  return kp;
}

// ── Minimal fallback IDL ──────────────────────────────────────────────────────
// Used only if the IDL isn't stored on-chain.
// Anchor discriminator = sha256("global:<name>")[0..8]

function disc(name: string): number[] {
  return Array.from(
    crypto.createHash("sha256").update(`global:${name}`).digest().slice(0, 8),
  );
}

function buildMinimalIdl(address: string): anchor.Idl {
  return {
    address,
    metadata: { name: "txoracle", version: "0.1.0", spec: "0.1.0" },
    instructions: [
      {
        name: "subscribe",
        discriminator: disc("subscribe"),
        accounts: [
          { name: "user", writable: true, signer: true },
          { name: "pricingMatrix" },
          { name: "tokenMint" },
          { name: "userTokenAccount", writable: true },
          { name: "tokenTreasuryVault", writable: true },
          { name: "tokenTreasuryPda" },
          { name: "tokenProgram" },
          { name: "associatedTokenProgram" },
          { name: "systemProgram" },
        ],
        args: [
          { name: "serviceLevelId", type: "u8" },
          { name: "durationWeeks", type: "u8" },
        ],
      },
    ],
    accounts: [],
    types: [],
    errors: [],
    events: [],
    constants: [],
  } as unknown as anchor.Idl;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nTxLINE Activation Script (${NETWORK.toUpperCase()})`);
  console.log("=".repeat(52));

  // ── Step 1: Wallet + RPC ───────────────────────────────────────────────────
  const keypair = loadOrCreateKeypair();
  const connection = new Connection(rpcUrl, "confirmed");

  const balance = await connection.getBalance(keypair.publicKey);
  console.log(`Wallet balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);

  if (NETWORK === "devnet" && balance < 0.05 * LAMPORTS_PER_SOL) {
    console.log("Balance low — requesting devnet airdrop...");
    try {
      const sig = await connection.requestAirdrop(
        keypair.publicKey,
        0.5 * LAMPORTS_PER_SOL,
      );
      const latestBlockhash = await connection.getLatestBlockhash();
      await connection.confirmTransaction(
        { signature: sig, ...latestBlockhash },
        "confirmed",
      );
      const newBalance = await connection.getBalance(keypair.publicKey);
      console.log(`Airdrop successful. New balance: ${(newBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
    } catch (e) {
      console.warn(
        "Airdrop failed (rate-limited). Fund manually at https://faucet.solana.com with address:",
        keypair.publicKey.toBase58(),
      );
      process.exit(1);
    }
  }

  // ── Step 2: Subscribe on-chain ─────────────────────────────────────────────
  const wallet = new anchor.Wallet(keypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  let idl: anchor.Idl;
  try {
    console.log("\nFetching program IDL from chain...");
    const fetched = await anchor.Program.fetchIdl(programId, provider);
    if (!fetched) throw new Error("IDL not stored on-chain");
    idl = fetched;
    console.log("IDL fetched.");
  } catch {
    console.log("IDL not on-chain — using built-in minimal IDL.");
    idl = buildMinimalIdl(programId.toBase58());
  }

  const program = new anchor.Program(idl, provider);

  const [tokenTreasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_treasury_v2")],
    program.programId,
  );
  const tokenTreasuryVault = getAssociatedTokenAddressSync(
    txlTokenMint,
    tokenTreasuryPda,
    true,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const [pricingMatrixPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("pricing_matrix")],
    program.programId,
  );
  const userTokenAccount = getAssociatedTokenAddressSync(
    txlTokenMint,
    provider.wallet.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  console.log(`\n[1/3] Subscribing on-chain (service level ${SERVICE_LEVEL_ID}, ${DURATION_WEEKS} weeks)...`);
  let txSig: string;
  try {
    txSig = await program.methods
      .subscribe(SERVICE_LEVEL_ID, DURATION_WEEKS)
      .accounts({
        user: provider.wallet.publicKey,
        pricingMatrix: pricingMatrixPda,
        tokenMint: txlTokenMint,
        userTokenAccount,
        tokenTreasuryVault,
        tokenTreasuryPda,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log("  Transaction:", txSig);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    // If already subscribed, some programs return an AlreadyInitialized error.
    // In that case we can still proceed to re-activate the API token.
    if (msg.includes("already") || msg.includes("AlreadyInUse") || msg.includes("0x0")) {
      console.log("  Wallet already subscribed on-chain — skipping subscribe tx.");
      txSig = "already-subscribed";
    } else {
      throw e;
    }
  }

  // ── Step 3: Get guest JWT + activate ───────────────────────────────────────
  console.log("\n[2/3] Getting guest JWT...");
  const authRes = await fetch(`${apiOrigin}/auth/guest/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!authRes.ok) {
    throw new Error(
      `Guest auth failed: ${authRes.status} — ${await authRes.text()}`,
    );
  }
  const { token: jwt } = (await authRes.json()) as { token: string };
  console.log("  JWT obtained.");

  console.log("\n[3/3] Signing and activating...");
  const messageString = `${txSig}:${SELECTED_LEAGUES.join(",")}:${jwt}`;
  const message = new TextEncoder().encode(messageString);
  const signatureBytes = nacl.sign.detached(message, keypair.secretKey);
  const walletSignature = Buffer.from(signatureBytes).toString("base64");

  const activateRes = await fetch(`${apiOrigin}/api/token/activate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      txSig,
      walletSignature,
      leagues: SELECTED_LEAGUES,
    }),
  });

  if (!activateRes.ok) {
    const body = await activateRes.text();
    throw new Error(`Activation failed: ${activateRes.status} — ${body}`);
  }

  const activationData = (await activateRes.json()) as
    | { token?: string }
    | string;
  const apiToken =
    typeof activationData === "string"
      ? activationData
      : activationData.token;

  if (!apiToken) {
    throw new Error(
      "No token in activation response: " + JSON.stringify(activationData),
    );
  }

  // ── Done ───────────────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(52));
  console.log("ACTIVATION SUCCESSFUL");
  console.log("=".repeat(52));
  console.log("\nYour activated TxLINE API token:\n");
  console.log("  " + apiToken);
  console.log("\nNext steps:");
  console.log(
    "  1. Copy the token above into your TXLINE_API_KEY environment secret.",
  );
  if (NETWORK === "devnet") {
    console.log(
      "  2. Set TXLINE_NETWORK=devnet so the server uses the devnet API endpoint.",
    );
  }
  console.log(
    "  3. Restart the API server — the background poll will start syncing matches.",
  );
}

main().catch((e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  console.error("\nERROR:", msg);
  process.exit(1);
});
