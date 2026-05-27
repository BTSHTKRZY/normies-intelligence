import type { VercelRequest, VercelResponse } from "@vercel/node";

const MANIFEST = {
  type: "https://ercs.ethereum.org/ERCS/erc-8257#tool-manifest-v1",
  name: "normies-ecosystem-intelligence",
  description:
    "Real-time intelligence about the Normies NFT ecosystem on Ethereum. Returns: floor price (live), 24h volume, all-time volume, 24h sales count, unique holders, circulating supply, market cap, cheapest floor listings with seller and expiry, total awakened agents, 8 most recent awakenings with timestamps, total tokens burned, canvas transforms, action points distributed, canvas paused status, and 5 most recent burn events with wallet addresses and AP earned. Single call. No authentication required.",
  endpoint: "https://normies-intelligence.vercel.app/api/handler",
  verifiability: {
    tier: "self-attested",
    execution: "serverless",
    dataRetention: "none",
    sourceVisibility: "open-source",
    sourceUrl: "https://github.com/BTSHTKRZY/normies-intelligence",
  },
  inputs: {
    type: "object",
    properties: {},
    required: [],
  },
  outputs: {
    type: "object",
    properties: {
      snapshot_ts: {
        type: "number",
        description: "Unix timestamp in milliseconds when this snapshot was taken",
      },
      collection: {
        type: "object",
        description: "Current market state of the Normies NFT collection — floor, volume, sales, holders, supply, market cap, floor listings",
      },
      agents: {
        type: "object",
        description: "Current state of awakened Normies AI agents on ERC-8004 — count and recent awakenings",
      },
      canvas: {
        type: "object",
        description: "On-chain canvas activity — burns, transforms, action points, recent burn events",
      },
      market: {
        type: "object",
        description: "Top bids and offers on the collection",
      },
    },
  },
  creatorAddress: "0x020d6409ebc4fa13e754e0fea275ac353efd4f03",
};

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");
  return res.status(200).json(MANIFEST);
}
