#!/usr/bin/env node
/**
 * Aza MCP server
 * ==============
 * Lets an AI coding assistant (Claude Desktop, Cursor, VS Code, Windsurf, …)
 * buy airtime / data and check the wallet on the developer's OWN Aza account,
 * without leaving the editor.
 *
 * Auth is a personal API key the developer mints in the Aza web app
 * (Settings → Developers). Drop it into the MCP config as AZA_API_KEY. The key
 * drives only that user's wallet and is bounded by a per-key daily spend cap,
 * so it can never drain the account. We never see a password or a PIN here.
 *
 *   AZA_API_KEY   (required)  aza_live_…
 *   AZA_API_BASE  (optional)  defaults to https://aza.azabill.ng/api
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { randomUUID } from "node:crypto";

const API_KEY = process.env.AZA_API_KEY;
const API_BASE = (process.env.AZA_API_BASE || "https://aza.azabill.ng/api").replace(/\/+$/, "");

if (!API_KEY) {
  // Fail loudly on stderr — stdout is the MCP transport and must stay clean.
  process.stderr.write(
    "[aza-mcp] AZA_API_KEY is not set. Mint one in the Aza web app " +
      "(Settings → Developers) and add it to your MCP config.\n"
  );
  process.exit(1);
}

/** Call the Aza developer API. Money-moving writes carry an Idempotency-Key so a
 *  retried request can never double-charge. Returns parsed JSON or throws with
 *  the backend's own human-readable error text. */
async function api(method, path, body) {
  const headers = {
    Authorization: `Bearer ${API_KEY}`,
    Accept: "application/json",
  };
  const init = { method, headers };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    headers["Idempotency-Key"] = randomUUID();
    init.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, init);
  } catch (e) {
    throw new Error(`Could not reach Aza (${API_BASE}). ${e.message}`);
  }
  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Aza returned a non-JSON response (HTTP ${res.status}).`);
  }
  if (!res.ok) {
    throw new Error(data.error || data.message || `Aza request failed (HTTP ${res.status}).`);
  }
  return data;
}

const naira = (n) => "₦" + Number(n || 0).toLocaleString("en-NG");

/** Wrap a handler so any thrown error becomes a clean tool error result rather
 *  than crashing the transport. */
function tool(fn) {
  return async (args) => {
    try {
      const text = await fn(args || {});
      return { content: [{ type: "text", text }] };
    } catch (e) {
      return { content: [{ type: "text", text: `⚠ ${e.message}` }], isError: true };
    }
  };
}

const server = new McpServer({ name: "aza-mcp", version: "1.0.0" });

server.tool(
  "aza_wallet",
  "Show the connected Aza account: name, wallet balance, and how much spending " +
    "room is left on this API key today. Call this first to confirm the key works.",
  {},
  tool(async () => {
    const d = await api("GET", "/dev/me");
    const cap = d.key?.daily_cap ? naira(d.key.daily_cap) + "/day" : "uncapped";
    const left =
      d.key?.remaining_today === null || d.key?.remaining_today === undefined
        ? "uncapped"
        : naira(d.key.remaining_today) + " left today";
    return (
      `Account: ${d.user?.name || "—"} (${d.user?.phone || "no phone"})\n` +
      `Wallet balance: ${naira(d.wallet_balance)}\n` +
      `Key "${d.key?.name}" (…${d.key?.last4}) cap: ${cap} — ${left}`
    );
  })
);

server.tool(
  "aza_list_networks",
  "List the mobile networks Aza can top up (MTN, Glo, Airtel, 9mobile).",
  {},
  tool(async () => {
    const d = await api("GET", "/dev/networks");
    return "Networks:\n" + d.networks.map((n) => `• ${n.code} — ${n.name}`).join("\n");
  })
);

server.tool(
  "aza_list_data_plans",
  "List the data bundles available on a network, with their plan codes and " +
    "prices. Use a plan code with aza_buy_data.",
  { network: z.enum(["mtn", "glo", "airtel", "9mobile"]).describe("Mobile network") },
  tool(async ({ network }) => {
    const d = await api("GET", `/dev/data-plans?network=${encodeURIComponent(network)}`);
    if (!d.plans?.length) return `No data plans found for ${network}.`;
    return (
      `${network.toUpperCase()} data plans:\n` +
      d.plans.map((p) => `• ${p.plan} — ${p.name} (${naira(p.amount)})`).join("\n")
    );
  })
);

server.tool(
  "aza_buy_airtime",
  "Buy airtime for a Nigerian phone number, paid from the connected Aza wallet. " +
    "Amount is in naira.",
  {
    network: z.enum(["mtn", "glo", "airtel", "9mobile"]).describe("Mobile network of the number"),
    phone: z.string().describe("Recipient phone number, e.g. 08031234567"),
    amount: z.number().int().positive().describe("Airtime amount in naira, e.g. 200"),
  },
  tool(async ({ network, phone, amount }) => {
    const d = await api("POST", "/dev/airtime", { network, phone, amount });
    const left =
      d.remaining_today === null || d.remaining_today === undefined
        ? ""
        : ` Key has ${naira(d.remaining_today)} left today.`;
    return (
      `✅ Sent ${naira(amount)} ${network.toUpperCase()} airtime to ${phone} ` +
      `(status: ${d.transaction?.status}). Wallet: ${naira(d.wallet_balance)}.${left}`
    );
  })
);

server.tool(
  "aza_buy_data",
  "Buy a data bundle for a Nigerian phone number, paid from the connected Aza " +
    "wallet. Get a plan code from aza_list_data_plans first.",
  {
    network: z.enum(["mtn", "glo", "airtel", "9mobile"]).describe("Mobile network of the number"),
    phone: z.string().describe("Recipient phone number, e.g. 08031234567"),
    plan: z.string().describe("Plan code from aza_list_data_plans"),
  },
  tool(async ({ network, phone, plan }) => {
    const d = await api("POST", "/dev/data", { network, phone, plan });
    const left =
      d.remaining_today === null || d.remaining_today === undefined
        ? ""
        : ` Key has ${naira(d.remaining_today)} left today.`;
    return (
      `✅ Sent ${network.toUpperCase()} data (${plan}) to ${phone} ` +
      `(status: ${d.transaction?.status}). Wallet: ${naira(d.wallet_balance)}.${left}`
    );
  })
);

server.tool(
  "aza_transactions",
  "Show the most recent airtime/data/bill purchases on the connected account.",
  { limit: z.number().int().min(1).max(50).optional().describe("How many to show (default 10)") },
  tool(async ({ limit }) => {
    const d = await api("GET", `/dev/transactions?limit=${limit || 10}`);
    if (!d.transactions?.length) return "No transactions yet.";
    return (
      "Recent transactions:\n" +
      d.transactions
        .map(
          (t) =>
            `• ${t.category} ${naira(t.amount)} → ${t.biller_code || ""} ` +
            `[${t.status}] ${t.created_at?.slice(0, 16).replace("T", " ")}`
        )
        .join("\n")
    );
  })
);

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write("[aza-mcp] connected — ready to buy airtime & data.\n");
