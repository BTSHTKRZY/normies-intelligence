import type { VercelRequest, VercelResponse } from "@vercel/node";

const NORMIES_CONTRACT = "0x9Eb6E2025B64f340691e424b7fe7022fFDE12438";
const NORMIES_API      = "https://api.normies.art";
const RESERVOIR        = "https://api.reservoir.tools";

// Reservoir works without a key for basic endpoints — use empty string
const RES_HEADERS = { "accept": "application/json" };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const [
      countRes,
      statsRes,
      burnsRes,
      agentsRes,
      collectionRes,
      salesRes,
      bidsRes,
      holdersRes,
      canvasRes,
    ] = await Promise.allSettled([

      // 1. Total awakened agent count
      fetch(`${NORMIES_API}/agents/count`)
        .then(r => r.json()),

      // 2. Canvas global stats — burns, transforms, AP
      fetch(`${NORMIES_API}/history/stats`)
        .then(r => r.json()),

      // 3. Recent burn events with wallet addresses
      fetch(`${NORMIES_API}/history/burns?limit=5`)
        .then(r => r.json()),

      // 4. Recent awakenings
      fetch(`${NORMIES_API}/agents/list?limit=8&sort=newest`)
        .then(r => r.json()),

      // 5. Collection stats from Reservoir — floor, volume, supply, owners
      fetch(
        `${RESERVOIR}/collections/v7?id=${NORMIES_CONTRACT}&includeTopBid=true`,
        { headers: RES_HEADERS }
      ).then(r => r.json()),

      // 6. Recent sales
      fetch(
        `${RESERVOIR}/sales/v6?collection=${NORMIES_CONTRACT}&limit=8&sortBy=time`,
        { headers: RES_HEADERS }
      ).then(r => r.json()),

      // 7. Top bids (offers) on the collection
      fetch(
        `${RESERVOIR}/orders/bids/v6?collection=${NORMIES_CONTRACT}&limit=5&sortBy=price&status=active`,
        { headers: RES_HEADERS }
      ).then(r => r.json()),

      // 8. Holder distribution from Reservoir
      fetch(
        `${RESERVOIR}/collections/${NORMIES_CONTRACT}/owners/distribution/v1`,
        { headers: RES_HEADERS }
      ).then(r => r.json()),

      // 9. Canvas contract status
      fetch(`${NORMIES_API}/canvas/status`)
        .then(r => r.json()),
    ]);

    // ── PARSE ──────────────────────────────────────────────────────────────

    const count     = countRes.status     === "fulfilled" ? countRes.value     : null;
    const stats     = statsRes.status     === "fulfilled" ? statsRes.value     : null;
    const burns     = burnsRes.status     === "fulfilled" ? burnsRes.value     : null;
    const agents    = agentsRes.status    === "fulfilled" ? agentsRes.value    : null;
    const col       = collectionRes.status === "fulfilled"
      ? collectionRes.value?.collections?.[0]
      : null;
    const sales     = salesRes.status     === "fulfilled" ? salesRes.value     : null;
    const bids      = bidsRes.status      === "fulfilled" ? bidsRes.value      : null;
    const holders   = holdersRes.status   === "fulfilled" ? holdersRes.value   : null;
    const canvas    = canvasRes.status    === "fulfilled" ? canvasRes.value    : null;

    // Collection market data
    const floorPrice  = col?.floorAsk?.price?.amount?.decimal;
    const topBidPrice = col?.topBid?.price?.amount?.decimal;
    const volume24h   = col?.volume?.["1day"];
    const volume7d    = col?.volume?.["7day"];
    const volumeAll   = col?.volume?.["allTime"];
    const supply      = col?.tokenCount;
    const ownerCount  = col?.ownerCount;
    const marketCap   = col?.marketCap;

    // Price change
    const floorChange24h = col?.floorSaleChange?.["1day"];
    const floorChange7d  = col?.floorSaleChange?.["7day"];

    // Recent awakenings
    const agentItems    = agents?.items || [];
    const recentAgents  = agentItems.slice(0, 8).map((a: any) => ({
      name:         a.name || `Agent #${a.tokenId}`,
      id:           parseInt(a.tokenId) || 0,
      type:         a.type || "Human",
      registeredAt: a.registeredAt
        ? new Date(parseInt(a.registeredAt) * 1000).toISOString()
        : null,
    }));

    // Recent sales
    const saleList   = sales?.sales || [];
    const recentSales = saleList.slice(0, 8).map((s: any) => ({
      token:  s.token?.name || `Normie #${s.token?.tokenId}`,
      price:  s.price?.amount?.decimal
        ? `${parseFloat(s.price.amount.decimal).toFixed(4)} ETH`
        : null,
      from:   s.from
        ? `${s.from.slice(0, 6)}...${s.from.slice(-4)}`
        : "unknown",
      to:     s.to
        ? `${s.to.slice(0, 6)}...${s.to.slice(-4)}`
        : "unknown",
      ts:     s.timestamp ? s.timestamp * 1000 : null,
      txHash: s.txHash || null,
    }));

    // Top bids / offers
    const bidList  = bids?.orders || [];
    const topBids  = bidList.slice(0, 5).map((b: any) => ({
      price:   b.price?.amount?.decimal
        ? `${parseFloat(b.price.amount.decimal).toFixed(4)} ETH`
        : null,
      bidder:  b.maker
        ? `${b.maker.slice(0, 6)}...${b.maker.slice(-4)}`
        : "unknown",
      expires: b.expiration
        ? new Date(b.expiration * 1000).toISOString()
        : null,
    }));

    // Holder distribution
    const distData      = holders?.ownershipDistribution || null;
    const holderBuckets = distData
      ? Object.entries(distData).map(([range, count]) => ({
          range,
          holders: count,
        }))
      : null;

    // Recent burns
    const burnList    = Array.isArray(burns) ? burns : [];
    const recentBurns = burnList.slice(0, 5).map((b: any) => ({
      commitId:    b.commitId,
      owner:       b.owner
        ? `${b.owner.slice(0, 6)}...${b.owner.slice(-4)}`
        : "unknown",
      receiverToken: b.receiverTokenId,
      tokensBurned:  b.tokenCount,
      apEarned:      b.totalActions,
      ts:            b.timestamp
        ? new Date(parseInt(b.timestamp) * 1000).toISOString()
        : null,
    }));

    // ── RESPONSE ──────────────────────────────────────────────────────────

    return res.status(200).json({
      snapshot_ts: Date.now(),

      collection: {
        floor_price:      floorPrice
          ? `${parseFloat(floorPrice).toFixed(4)} ETH`
          : null,
        floor_change_24h: floorChange24h
          ? `${(floorChange24h * 100).toFixed(1)}%`
          : null,
        floor_change_7d:  floorChange7d
          ? `${(floorChange7d * 100).toFixed(1)}%`
          : null,
        top_bid:          topBidPrice
          ? `${parseFloat(topBidPrice).toFixed(4)} ETH`
          : null,
        volume_24h:       volume24h
          ? `${parseFloat(volume24h).toFixed(2)} ETH`
          : null,
        volume_7d:        volume7d
          ? `${parseFloat(volume7d).toFixed(2)} ETH`
          : null,
        volume_all_time:  volumeAll
          ? `${parseFloat(volumeAll).toFixed(0)} ETH`
          : null,
        market_cap:       marketCap
          ? `${parseFloat(marketCap).toFixed(0)} ETH`
          : null,
        supply:           parseInt(supply)    || null,
        unique_holders:   parseInt(ownerCount) || null,
      },

      agents: {
        total_awakened:    count?.count || null,
        recent_awakenings: recentAgents,
      },

      canvas: {
        total_burned:              stats?.totalBurnedTokens            || null,
        total_transforms:          stats?.totalTransforms              || null,
        action_points_distributed: stats?.totalActionPointsDistributed || null,
        total_burn_commitments:    stats?.totalBurnCommitments         || null,
        canvas_paused:             canvas?.paused ?? null,
        recent_burns:              recentBurns,
      },

      market: {
        recent_sales:       recentSales,
        top_bids:           topBids,
        holder_distribution: holderBuckets,
      },
    });

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
