# xgram-mcp-server

A small MCP (Model Context Protocol) server that exposes the Xgram API as
tools your AI agent can call directly — no proxy hop, no Next.js running.

Useful when you want Claude Code (or any MCP client) to operate the Xgram
account without booting the web app: quoting pairs, creating exchanges,
polling status.

## Install

```bash
git clone https://github.com/xgramexchange-ai/xgram-mcp-server.git
cd xgram-mcp-server
npm install
npm run build
```

Produces `dist/index.js`.

## Configure (Claude Code)

Add to your Claude Code config (typically `~/.claude.json`):

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

Restart Claude Code. You should see the `xgram_*` tools become available.

## Tools

| Tool | Purpose |
|---|---|
| `xgram_list_pairs` | All available `[fromCcy, toCcy]` tuples |
| `xgram_list_currencies` | All currencies with `minFrom`/`maxFrom`/`network` |
| `xgram_get_rate` | Live floating rate for a pair + amount |
| `xgram_validate_address` | Check if an address is structurally valid for a coin |
| `xgram_create_exchange` | Initiate an exchange or fixed-receive payment |
| `xgram_get_status` | Normalized status of an exchange by ID |

All tools talk to `https://xgram.io/api/v1` directly using the `XGRAM_API_KEY`
env var. Override the base URL via `XGRAM_API_BASE` if you need to.

## Notes

- The status tool normalizes Xgram's `x-` prefixed status keys
  (`x-completed` → `completed`) so callers don't have to special-case them.
- Errors from Xgram (`{result: false, ...}`) are surfaced as MCP errors with
  the original message, not as a successful response.
