# xgram-mcp-server

**xgram-mcp-server is an open-source [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that exposes the [Xgram](https://xgram.io) cryptocurrency exchange API as tools for Claude and other AI agents.** It lets an AI assistant quote rates, validate addresses, create crypto exchanges, and poll their status — directly, with no proxy hop and no web app running.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Model Context Protocol](https://img.shields.io/badge/MCP-compatible-blue)](https://modelcontextprotocol.io)
[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A518.18-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Works with Claude Code](https://img.shields.io/badge/Claude%20Code-ready-orange)](https://claude.com/claude-code)

---

## What is this?

The **Model Context Protocol (MCP)** is an open standard that lets AI assistants call external tools. **xgram-mcp-server** implements that standard for [Xgram](https://xgram.io), a non-custodial cryptocurrency exchange. Once connected, any MCP client — Claude Code, Claude Desktop, or your own agent — can operate an Xgram account through plain language:

> "Quote me BTC → XMR for 0.05 BTC, then create the exchange to this address."

It talks to `https://xgram.io/api/v1` directly over HTTPS using your `XGRAM_API_KEY`. No Next.js, no proxy, no browser.

## Features

- 🔁 **Quote crypto swaps** — live floating rates and limits for any supported pair
- 💱 **Create exchanges & payments** — float or fixed-rate, swap or fixed-receive invoice
- 📡 **Track status** — normalized exchange status by ID
- ✅ **Validate addresses** — structural check before sending funds
- 🪙 **Discover currencies & pairs** — full list with min/max amounts and networks
- 🧩 **Client-agnostic** — works with any MCP client over stdio
- 📦 **Zero proxy** — calls the Xgram REST API directly; only `@modelcontextprotocol/sdk` + `zod`

## Install

```bash
git clone https://github.com/xgramexchange-ai/xgram-mcp-server.git
cd xgram-mcp-server
npm install
npm run build
```

This produces `dist/index.js`.

## Configure (Claude Code)

Add this to your Claude Code config (typically `~/.claude.json`):

```jsonc
{
  "mcpServers": {
    "xgram": {
      "command": "node",
      "args": ["/absolute/path/to/xgram-mcp-server/dist/index.js"],
      "env": {
        "XGRAM_API_KEY": "your-key-here"
      }
    }
  }
}
```

Restart Claude Code. The `xgram_*` tools become available. The same `command`/`args`/`env`
block works in any other MCP client (Claude Desktop, custom agents, etc.).

> Get an `XGRAM_API_KEY` from the [Xgram partner dashboard](https://xgram.io/business).

## Tools

| Tool | Purpose |
|---|---|
| `xgram_list_pairs` | All available `[fromCcy, toCcy]` trading pairs |
| `xgram_list_currencies` | All currencies with `minFrom` / `maxFrom` / `network` metadata |
| `xgram_get_rate` | Live floating rate and limits for a pair + amount |
| `xgram_validate_address` | Check whether an address is structurally valid for a coin |
| `xgram_create_exchange` | Initiate an exchange (`float`/`fixed`) or fixed-receive payment |
| `xgram_get_status` | Normalized status of an exchange by ID |

All tools call `https://xgram.io/api/v1` using the `XGRAM_API_KEY` env var. Override the
base URL with `XGRAM_API_BASE` if you need to point at a staging environment.

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `XGRAM_API_KEY` | Yes | — | Your Xgram API key, sent as the `x-api-key` header |
| `XGRAM_API_BASE` | No | `https://xgram.io/api/v1` | Override the API base URL |

## FAQ

**What is an MCP server?**
An MCP (Model Context Protocol) server exposes tools that an AI assistant can call. This one
wraps the Xgram cryptocurrency exchange API so Claude and other agents can quote rates and
create swaps without a custom integration.

**Which AI clients does it work with?**
Any MCP-compatible client. It is tested with Claude Code and works the same way with Claude
Desktop or your own agent, since it speaks MCP over stdio.

**Do I need to run the Xgram web app?**
No. The server calls the Xgram REST API directly — there is no proxy and no front-end required.

**Is it free and open source?**
Yes. It is released under the MIT license. You provide your own Xgram API key.

**How are Xgram's `x-` status fields handled?**
The status tool normalizes Xgram's `x-` prefixed status keys (e.g. `x-completed` → `completed`)
so callers don't have to special-case them. Xgram errors (`{result: false, ...}`) are surfaced
as MCP errors with the original message rather than as a successful response.

## Related

- [Xgram](https://xgram.io) — the cryptocurrency exchange this server connects to
- [Xgram partner dashboard](https://xgram.io/business) — register and get an API key
- [Model Context Protocol](https://modelcontextprotocol.io) — the open standard this implements
- [Claude Code](https://claude.com/claude-code) — Anthropic's CLI for Claude

## License

[MIT](LICENSE)
