import { createToolHandler, createWellKnownHandler, toVercelHandler } from "@opensea/tool-sdk";
import { z } from "zod";
import { manifest } from "./manifest.js";

// ── OUTPUT SCHEMA ─────────────────────────────────────────────────────────────

const outputSchema = z.object({
  snapshot_ts: z.number(),
  collection: z.object({
    floor_price:   z.string().nullable(),
    volume_24h:    z.string().nullable(),
    supply:        z.number(),
    unique_owners: z.number(),
  }),
  agents: z.object({
    total_awakened:    z.number(),
    recent_awakenings: z.array(z.object({
      name:  z.string(),
      id:    z.number(),
      type:  z.string(),
      level: z.number(),
      ap:    z.number(),
    })),
  }),
  canvas: z.object({
    total_burned:              z.number(),
    total_transforms:          z.number(),
    action_points_distributed: z.number(),
  }),
  market: z.object({
    recent_sales: z.array(z.object({
      token: z.string(),
      price: z.string(),
      from:  z.string(),
      to:    z.string(),
      ts:    z.number(),
    })),
  }),
});

// ── NORMIES CONTRACT ON ETHEREUM ──────────────────────────────────────────────

const NORMIES_CONTRACT = "0x9Eb6E2025B64f340691e424b7fe7022fFDE12438";
const RESERVOIR_HEADERS = { "x-api-key": "demo-api-key" };

// ── TOOL HANDLER ──────────────────────────────────────────────────────────────

const toolHandler = createToolHandler({
  manifest,
  inputSchema:  z.object({}),
  outputSchema,
  gates: [], // open access — no predicate, no payment required
  handler: async () => {

    // Fetch all data sources in parallel
    const [countRes, statsRes, floorRes, agentsRes, salesRes] =
      await Promise.allSettled([

        // 1. Total awakened agent count
        fetch("https://api.normies.art/agents/count")
          .then(r => r.json()),

        // 2. Canvas stats — burns, transforms, action points
        fetch("https://api.normies.art/history/stats")
          .then(r => r.json()),

        // 3. Collection floor + volume from Reservoir
        fetch(
          `https://api.reservoir.tools/collections/v7?slug=normies&includeTopBid=false`,
          { headers: RESERVOIR_HEADERS }
        ).then(r => r.json()),

        // 4. Recent awakenings
        fetch("https://api.normies.art/agents/list?limit=8")
          .then(r => r.json()),

        // 5. Recent sales from Reservoir
        fetch(
          `https://api.reservoir.tools/collections/activity/v6?collection=${NORMIES_CONTRACT}&limit=10&types[]=sale`,
          { headers: RESERVOIR_HEADERS }
        ).then(r => r.json()),

      ]);

    // ── PARSE RESPONSES ───────────────────────────────────────────────────────

    const count  = countRes.status  === "fulfilled" ? countRes.value  : null;
    const stats  = statsRes.status  === "fulfilled" ? statsRes.value  : null;
    const floor  = floorRes.status  === "fulfilled" ? floorRes.value  : null;
    const agents = agentsRes.status === "fulfilled" ? agentsRes.value : null;
    const sales  = salesRes.status  === "fulfilled" ? salesRes.value  : null;

    // Collection market data
    const col          = floor?.collections?.[0];
    const floorPrice   = col?.floorAsk?.price?.amount?.decimal;
    const volume24h    = col?.volume?.["1day"];
    const supply       = col?.tokenCount;
    const owners       = col?.ownerCount;

    // Recent awakenings
    const agentList    = agents?.items || [];
    const recentAgents = agentList.slice(0, 8).map((a: any) => ({
      name:  a.name  || `Agent #${a.tokenId}`,
      id:    parseInt(a.tokenId) || 0,
      type:  a.type  || "Human",
      level: a.canvas?.level || 1,
      ap:    a.canvas?.actionPoints || 0,
    }));

    // Recent sales
    const activities   = sales?.activities || [];
    const recentSales  = activities
      .filter((a: any) => a.type === "sale" && a.price?.amount?.decimal)
      .slice(0, 5)
      .map((a: any) => ({
        token: a.token?.tokenName || `Normie #${a.token?.tokenId}`,
        price: `${parseFloat(a.price.amount.decimal).toFixed(4)} ETH`,
        from:  a.fromAddress
          ? `${a.fromAddress.slice(0, 6)}...${a.fromAddress.slice(-4)}`
          : "unknown",
        to: a.toAddress
          ? `${a.toAddress.slice(0, 6)}...${a.toAddress.slice(-4)}`
          : "unknown",
        ts: (a.timestamp || 0) * 1000,
      }));

    // ── RETURN PAYLOAD ────────────────────────────────────────────────────────

    return {
      snapshot_ts: Date.now(),
      collection: {
        floor_price:   floorPrice
          ? `${parseFloat(floorPrice).toFixed(4)} ETH`
          : null,
        volume_24h:    volume24h
          ? `${parseFloat(volume24h).toFixed(2)} ETH`
          : null,
        supply:        parseInt(supply)  || 8100,
        unique_owners: parseInt(owners)  || 1828,
      },
      agents: {
        total_awakened:    count?.count  || 1075,
        recent_awakenings: recentAgents,
      },
      canvas: {
        total_burned:              stats?.totalBurnedTokens           || 1900,
        total_transforms:          stats?.totalTransforms             || 891,
        action_points_distributed: stats?.totalActionPointsDistributed || 28366,
      },
      market: {
        recent_sales: recentSales,
      },
    };
  },
});

// ── WELL-KNOWN MANIFEST ENDPOINT ──────────────────────────────────────────────

const wellKnownHandler = createWellKnownHandler(manifest);

// ── VERCEL ROUTING ────────────────────────────────────────────────────────────

const vercelHandler = toVercelHandler(toolHandler);
const vercelWellKnown = toVercelHandler(wellKnownHandler);

export default async function handler(req: any, res: any) {
  if (req.url?.startsWith("/.well-known/")) {
    return vercelWellKnown(req, res);
  }
  return vercelHandler(req, res);
}
