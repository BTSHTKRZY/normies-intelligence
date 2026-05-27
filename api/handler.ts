import type { VercelRequest, VercelResponse } from "@vercel/node";

const NORMIES_CONTRACT = "0x9Eb6E2025B64f340691e424b7fe7022fFDE12438";
const RESERVOIR_HEADERS = { "x-api-key": "demo-api-key" };

const MANIFEST = {
  type: "https://ercs.ethereum.org/ERCS/erc-8257#tool-manifest-v1",
  name: "normies-ecosystem-intelligence",
  description:
    "Real-time intelligence about the Normies NFT ecosystem on Ethereum. Returns current floor price, 24h volume, total supply, unique owners, awakened agent count, recent awakenings, burn statistics, canvas transforms, action points distributed, and recent sales.",
  endpoint: "https://normies-intelligence.vercel.app",
  inputs: { type: "object", properties: {}, required: [] },
  outputs: {
    type: "object",
    properties: {
      snapshot_ts: { type: "number" },
      collection:  { type: "object" },
      agents:      { type: "object" },
      canvas:      { type: "object" },
      market:      { type: "object" },
    },
  },
  creatorAddress: "0x020d6409Ebc4fa13E754e0fEa275ac353eFD4f03",
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  // Serve manifest at well-known endpoint
  if (req.url?.startsWith("/.well-known/")) {
    return res.status(200).json(MANIFEST);
  }

  // Tool endpoint accepts GET and POST
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const [countRes, statsRes, floorRes, agentsRes, salesRes] =
      await Promise.allSettled([
        fetch("https://api.normies.art/agents/count").then(r => r.json()),
        fetch("https://api.normies.art/history/stats").then(r => r.json()),
        fetch("https://api.reservoir.tools/collections/v7?slug=normies&includeTopBid=false",
          { headers: RESERVOIR_HEADERS }).then(r => r.json()),
        fetch("https://api.normies.art/agents/list?limit=8").then(r => r.json()),
        fetch(`https://api.reservoir.tools/collections/activity/v6?collection=${NORMIES_CONTRACT}&limit=10&types[]=sale`,
          { headers: RESERVOIR_HEADERS }).then(r => r.json()),
      ]);

    const count  = countRes.status  === "fulfilled" ? countRes.value  : null;
    const stats  = statsRes.status  === "fulfilled" ? statsRes.value  : null;
    const floor  = floorRes.status  === "fulfilled" ? floorRes.value  : null;
    const agents = agentsRes.status === "fulfilled" ? agentsRes.value : null;
    const sales  = salesRes.status  === "fulfilled" ? salesRes.value  : null;

    const col        = floor?.collections?.[0];
    const floorPrice = col?.floorAsk?.price?.amount?.decimal;
    const volume24h  = col?.volume?.["1day"];
    const supply     = col?.tokenCount;
    const owners     = col?.ownerCount;

    const agentList    = agents?.items || [];
    const recentAgents = agentList.slice(0, 8).map((a: any) => ({
      name:  a.name  || `Agent #${a.tokenId}`,
      id:    parseInt(a.tokenId) || 0,
      type:  a.type  || "Human",
      level: a.canvas?.level || 1,
      ap:    a.canvas?.actionPoints || 0,
    }));

    const activities  = sales?.activities || [];
    const recentSales = activities
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

    return res.status(200).json({
      snapshot_ts: Date.now(),
      collection: {
        floor_price:   floorPrice ? `${parseFloat(floorPrice).toFixed(4)} ETH` : null,
        volume_24h:    volume24h  ? `${parseFloat(volume24h).toFixed(2)} ETH`  : null,
        supply:        parseInt(supply)  || 8100,
        unique_owners: parseInt(owners)  || 1828,
      },
      agents: {
        total_awakened:    count?.count  || 1075,
        recent_awakenings: recentAgents,
      },
      canvas: {
        total_burned:              stats?.totalBurnedTokens            || 1900,
        total_transforms:          stats?.totalTransforms              || 891,
        action_points_distributed: stats?.totalActionPointsDistributed || 28366,
      },
      market: {
        recent_sales: recentSales,
      },
    });

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
