# Aza MCP

[![npm version](https://img.shields.io/npm/v/aza-mcp.svg)](https://www.npmjs.com/package/aza-mcp)
[![license](https://img.shields.io/npm/l/aza-mcp.svg)](./LICENSE)
[![node](https://img.shields.io/node/v/aza-mcp.svg)](https://nodejs.org)

> Buy **airtime and data** — and check your wallet — from your own [Azabill](https://azabill.ng) account, without leaving your code editor.

**Aza MCP** is a [Model Context Protocol](https://modelcontextprotocol.io) server that connects your [Azabill](https://azabill.ng) wallet to any AI coding assistant. Once connected, you just tell your assistant *"send ₦200 MTN airtime to 0803…"* while you code, and it runs on your wallet — no context switch, no dashboard.

Works with any MCP client: **Claude Desktop, Claude Code, Cursor, VS Code (Copilot), Windsurf**, and others.

**What you can do:** buy airtime, buy data bundles, list data plans, check your wallet balance, and view recent transactions — for any Nigerian number (MTN, Glo, Airtel, 9mobile), straight from your editor's chat.

---

## 1. Connect your account (get an API key)

Your Aza account connects to the MCP through a **personal API key** — no password or PIN ever leaves your machine.

1. Open the Aza web app: **[app.azabill.ng](https://app.azabill.ng)** and log in.
2. Go to **Profile → Developers**.
3. Click **Create API key**, give it a name (e.g. *"Cursor on my laptop"*) and a **daily spending cap** (default ₦2,000/day).
4. Copy the key — it looks like `aza_live_xxxxxxxx`. **It's shown once.**

> The key spends only from *your* wallet and can never exceed the daily cap you set. Lost a laptop? Revoke the key on that same screen and it stops working instantly.

Make sure your Aza wallet is funded (fund it in the app) — purchases draw from your balance.

## 2. Add it to your editor

Use `npx` so there's nothing to install or keep updated. Replace `aza_live_…` with your key.

### Claude Desktop
Edit `claude_desktop_config.json` (Settings → Developer → Edit Config):

```json
{
  "mcpServers": {
    "aza": {
      "command": "npx",
      "args": ["-y", "aza-mcp"],
      "env": { "AZA_API_KEY": "aza_live_xxxxxxxx" }
    }
  }
}
```

### Claude Code
```bash
claude mcp add aza --env AZA_API_KEY=aza_live_xxxxxxxx -- npx -y aza-mcp
```

### Cursor
`Settings → MCP → Add new server`, or edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "aza": {
      "command": "npx",
      "args": ["-y", "aza-mcp"],
      "env": { "AZA_API_KEY": "aza_live_xxxxxxxx" }
    }
  }
}
```

### VS Code (GitHub Copilot / Agent mode)
`.vscode/mcp.json` in your workspace:

```json
{
  "servers": {
    "aza": {
      "command": "npx",
      "args": ["-y", "aza-mcp"],
      "env": { "AZA_API_KEY": "aza_live_xxxxxxxx" }
    }
  }
}
```

### Windsurf
`~/.codeium/windsurf/mcp_config.json` — same `mcpServers` block as Claude Desktop above.

Restart the editor after saving. You should see the **aza** tools appear.

## 3. Use it

Just talk to your assistant:

- *"What's my Aza balance?"*
- *"List MTN data plans."*
- *"Buy ₦100 Airtel airtime for 0803…."*
- *"Send the 1GB MTN plan to 0810…."*
- *"Show my last 5 Aza transactions."*

Your editor will ask you to approve each action before it runs.

---

## Tools

| Tool | What it does |
|------|--------------|
| `aza_wallet` | Account name, wallet balance, and today's remaining spend on the key |
| `aza_list_networks` | Supported networks (MTN, Glo, Airtel, 9mobile) |
| `aza_list_data_plans` | Data bundles + plan codes + prices for a network |
| `aza_buy_airtime` | Buy airtime (naira) for a number |
| `aza_buy_data` | Buy a data bundle (by plan code) for a number |
| `aza_transactions` | Recent purchases |

## Configuration

| Env var | Required | Default | Notes |
|---------|----------|---------|-------|
| `AZA_API_KEY` | yes | — | Your `aza_live_…` key |

## Safety

- **Daily cap** — every key has a per-day naira limit you set; the server refuses a purchase that would exceed it.
- **Revocable** — revoke a key anytime in the web app; it stops working immediately.
- **No secrets in your repo** — the key lives in your MCP config, not your code. Don't commit it.
- **Idempotent** — each purchase carries an idempotency key, so a network retry never charges twice.

## Run locally (development)

```bash
git clone https://github.com/Abdulkereem/aza-mcp.git && cd aza-mcp
npm install
AZA_API_KEY=aza_live_xxxx node src/index.js
```

## License

MIT — © CodeMatrix Consult LTD (Azabill)
