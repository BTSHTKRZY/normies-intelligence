import type { VercelRequest, VercelResponse } from "@vercel/node";

const MANIFEST = {
  type: "https://ercs.ethereum.org/ERCS/erc-8257#tool-manifest-v1",
  name: "normies-ecosystem-intelligence",
  description:
    "Real-time intelligence about the Normies NFT ecosystem on Ethereum. Returns current floor price, 24h volume, total supply, unique owners, awakened agent count, recent awakenings, burn statistics, canvas transforms, action points distributed, and recent sales.",
  endpoint: "https://normies-intelligence.vercel.app",
  verifiability: {
    tier: "self-attested",
    dataRetention: "none",
    sourceVisibility: "public",
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
        description: "Current market state of the Normies NFT collection",
      },
      agents: {
        type: "object",
        description: "Current state of awakened Normies AI agents on ERC-8004",
      },
      canvas: {
        type: "object",
        description: "On-chain canvas activity — burns, transforms, action points",
      },
      market: {
        type: "object",
        description: "Recent sales activity on OpenSea",
      },
    },
  },
  creatorAddress: "0x020d6409Ebc4fa13E754e0fEa275ac353eFD4f03",
};

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");
  return res.status(200).json(MANIFEST);
}
