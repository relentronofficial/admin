/**
 * Generates a Clerk JWT for a real member user and saves it to token.txt.
 * Run once before load tests: node get-token.mjs
 *
 * Requires env var: CLERK_SECRET (or set it inline below for local dev only — never commit)
 */

const CLERK_SECRET = process.env.CLERK_SECRET || "";
const CLERK_FAPI   = "https://glowing-sole-96.clerk.accounts.dev";

if (!CLERK_SECRET) {
  console.error("Missing CLERK_SECRET env var. Run: CLERK_SECRET=sk_test_... node get-token.mjs");
  process.exit(1);
}

async function getUsers() {
  const res = await fetch("https://api.clerk.com/v1/users?limit=10&order_by=-created_at", {
    headers: { Authorization: `Bearer ${CLERK_SECRET}` },
  });
  return res.json();
}

async function createSignInToken(userId) {
  const res = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CLERK_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id: userId, expires_in_seconds: 86400 }),
  });
  return res.json();
}

async function exchangeForJwt(ticket) {
  const res = await fetch(`${CLERK_FAPI}/v1/client/sign_ins?__clerk_api_version=2021-02-05`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ strategy: "ticket", ticket }),
  });
  const body = await res.json();
  const sessions = body?.client?.sessions ?? [];
  const jwt = sessions[0]?.last_active_token?.jwt;
  return jwt;
}

async function main() {
  console.log("Fetching users from Clerk...");
  const users = await getUsers();

  if (!Array.isArray(users) || users.length === 0) {
    console.error("No users found:", users);
    process.exit(1);
  }

  const member = users.find(u =>
    u.primary_email_address_id &&
    !u.email_addresses?.some(e => e.email_address === "manojdatascientist08@gmail.com")
  ) ?? users[0];

  console.log(`Using user: ${member.email_addresses?.[0]?.email_address} (${member.id})`);

  console.log("Creating sign-in token...");
  const sitRes = await createSignInToken(member.id);
  if (!sitRes.token) {
    console.error("Failed to create sign-in token:", sitRes);
    process.exit(1);
  }

  console.log("Exchanging for JWT...");
  const jwt = await exchangeForJwt(sitRes.token);
  if (!jwt) {
    console.error("Could not extract JWT from FAPI response.");
    process.exit(1);
  }

  const { writeFileSync } = await import("fs");
  writeFileSync("./token.txt", jwt, "utf8");
  console.log("Token saved to load-test/token.txt");
  console.log(`Token preview: ${jwt.slice(0, 60)}...`);
  console.log("\nNOTE: Clerk session JWT expires in ~60s. Run the k6 test immediately after this script.");
}

main().catch(console.error);
