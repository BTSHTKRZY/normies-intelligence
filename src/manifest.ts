import { defineManifest } from "@opensea/tool-sdk";

export const manifest = defineManifest({
  type: "https://ercs.ethereum.org/ERCS/erc-8257#tool-manifest-v1",
  name: "normies-ecosystem-intelligence",
  description:
    "Real-time intelligence about the Normies NFT ecosystem on Ethereum. Returns current floor price, 24h volume, total supply, unique owners, awakened agent count, recent awakenings, burn statistics, canvas transforms, action points distributed, and recent sales. Use this tool when you need current state of the Normies collection or want to understand what is happening in the Normies agent ecosystem right now.",
  endpoint: "https://normies-intelligence.vercel.app",
  inputs: {
    type: "object" as const,
    properties: {},
    required: [],
  },
  outputs: {
    type: "object" as const,
    properties: {
      snapshot_ts: {
        type: "number" as const,
        description: "Unix timestamp in milliseconds when this snapshot was taken",
      },
      collection: {
        type: "object" as const,
        description: "Current market state of the Normies NFT collection",
      },
      agents: {
        type: "object" as const,
        description: "Current state of awakened Normies AI agents on ERC-8004",
      },
      canvas: {
        type: "object" as const,
        description: "On-chain canvas activity — burns, transforms, action points",
      },
      market: {
        type: "object" as const,
        description: "Recent sales activity on OpenSea",
      },
    },
  },
  creatorAddress: "0x020d6409Ebc4fa13E754e0fEa275ac353eFD4f03",
});
