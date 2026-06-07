#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const XGRAM_API_BASE = process.env.XGRAM_API_BASE ?? "https://xgram.io/api/v1";
const XGRAM_API_KEY = process.env.XGRAM_API_KEY;

if (!XGRAM_API_KEY) {
  console.error("[xgram-mcp] XGRAM_API_KEY is not set. Set it in the MCP server's env before launching.");
  process.exit(1);
}

const ListPairsArgs = z.object({}).strict();
const ListCurrenciesArgs = z.object({}).strict();
const GetRateArgs = z
  .object({
    fromCcy: z.string().min(1),
    toCcy: z.string().min(1),
    ccyAmount: z.number().positive(),
  })
  .strict();
const ValidateAddressArgs = z
  .object({
    coin: z.string().min(1),
    address: z.string().min(1),
  })
  .strict();
const CreateExchangeArgs = z
  .object({
    toAddress: z.string().min(1),
    toAddressTag: z.string().optional(),
    refundAddress: z.string().optional(),
    refundTag: z.string().optional(),
    fromCcy: z.string().min(1),
    toCcy: z.string().min(1),
    ccyAmount: z.number().positive(),
    type: z.enum(["float", "fixed"]).optional(),
    mode: z.enum(["exchange", "payment"]).default("exchange"),
  })
  .strict();
const GetStatusArgs = z
  .object({
    id: z.string().min(1),
  })
  .strict();

const TOOLS = [
  {
    name: "xgram_list_pairs",
    description: "List all available trading pairs as [fromCcy, toCcy] tuples.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "xgram_list_currencies",
    description:
      "List all supported currencies with metadata (minFrom, maxFrom, network, tagname, available).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "xgram_get_rate",
    description: "Get the current floating rate and limits for a pair.",
    inputSchema: {
      type: "object",
      required: ["fromCcy", "toCcy", "ccyAmount"],
      properties: {
        fromCcy: { type: "string", description: "Source ticker, e.g. BTC." },
        toCcy: { type: "string", description: "Target ticker, e.g. ETH." },
        ccyAmount: { type: "number", description: "Amount of fromCcy to quote." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "xgram_validate_address",
    description: "Check whether a crypto address is structurally valid for a given coin.",
    inputSchema: {
      type: "object",
      required: ["coin", "address"],
      properties: {
        coin: { type: "string", description: "Currency ticker for the address (e.g. BTC)." },
        address: { type: "string", description: "Address to verify." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "xgram_create_exchange",
    description:
      "Create an exchange (or fixed-amount payment). Returns deposit address + exchange id. Use mode=exchange for swaps, mode=payment for fixed-receive invoices.",
    inputSchema: {
      type: "object",
      required: ["toAddress", "fromCcy", "toCcy", "ccyAmount"],
      properties: {
        toAddress: { type: "string" },
        toAddressTag: { type: "string" },
        refundAddress: { type: "string" },
        refundTag: { type: "string" },
        fromCcy: { type: "string" },
        toCcy: { type: "string" },
        ccyAmount: { type: "number" },
        type: { type: "string", enum: ["float", "fixed"] },
        mode: { type: "string", enum: ["exchange", "payment"], default: "exchange" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "xgram_get_status",
    description:
      "Get the current status of an exchange by id. Returns normalized status (without x- prefix) and amounts/addresses.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string" },
      },
      additionalProperties: false,
    },
  },
] as const;

async function callXgram(path: string, query?: Record<string, string | number | undefined>) {
  const url = new URL(`${XGRAM_API_BASE.replace(/\/$/, "")}/${path.replace(/^\//, "")}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue;
      url.searchParams.set(key, String(value));
    }
  }
  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "x-api-key": XGRAM_API_KEY!,
      "Content-Type": "application/json; charset=UTF-8",
    },
  });
  const text = await response.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Xgram returned non-JSON (HTTP ${response.status}): ${text.slice(0, 200)}`);
  }
  if (!response.ok) {
    throw new Error(`Xgram HTTP ${response.status}: ${JSON.stringify(body)}`);
  }
  if (body && typeof body === "object" && "result" in body && (body as { result: unknown }).result === false) {
    const message =
      ((body as { error?: string; message?: string }).error ??
        (body as { error?: string; message?: string }).message) || "Xgram returned result: false";
    throw new Error(message);
  }
  return body;
}

function normalizeStatusPayload(raw: Record<string, unknown>) {
  const rawStatus = String(raw["x-status"] ?? "");
  const status = rawStatus.startsWith("x-") ? rawStatus.slice(2) : rawStatus;
  return {
    id: raw.id,
    status,
    fromCcy: raw["x-fromCcy"],
    toCcy: raw["x-toCcy"],
    depositAddress: raw["x-ccyDepositAddress"],
    depositTag: raw["x-ccyDepositTag"],
    depositHash: raw["x-ccyDepositHash"],
    destinationAddress: raw["x-ccyDestinationAddress"],
    destinationTag: raw["x-ccyDestinationTag"],
    refundAddress: raw["x-ccyRefundAddress"],
    refundTag: raw["x-ccyRefundTag"],
    expectedAmountFrom: raw["x-ccyExpectedAmountFrom"],
    expectedAmountTo: raw["x-ccyExpectedAmountTo"],
    amountFrom: raw["x-ccyAmountFrom"],
    amountTo: raw["x-ccyAmountTo"],
    date: raw.date,
    txId: raw.txId,
    result: raw.result,
  };
}

const server = new Server(
  { name: "xgram-starter-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: unknown;
    switch (name) {
      case "xgram_list_pairs":
        ListPairsArgs.parse(args ?? {});
        result = await callXgram("load-pairs-options");
        break;
      case "xgram_list_currencies":
        ListCurrenciesArgs.parse(args ?? {});
        result = await callXgram("list-currency-options");
        break;
      case "xgram_get_rate": {
        const parsed = GetRateArgs.parse(args ?? {});
        result = await callXgram("retrieve-rate-value", parsed);
        break;
      }
      case "xgram_validate_address": {
        const parsed = ValidateAddressArgs.parse(args ?? {});
        result = await callXgram("crypto-address-verification", {
          cryptoDigitalCoin: parsed.coin,
          cryptoDigitalAddress: parsed.address,
        });
        break;
      }
      case "xgram_create_exchange": {
        const parsed = CreateExchangeArgs.parse(args ?? {});
        const { mode, ...params } = parsed;
        const path = mode === "payment" ? "launch-new-payment-exchange" : "launch-new-exchange";
        result = await callXgram(path, params);
        break;
      }
      case "xgram_get_status": {
        const parsed = GetStatusArgs.parse(args ?? {});
        const raw = (await callXgram("fetch-status-info", { id: parsed.id })) as Record<string, unknown>;
        result = normalizeStatusPayload(raw);
        break;
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[xgram-mcp] ready on stdio");
