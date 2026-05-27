import type { VercelRequest, VercelResponse } from "@vercel/node";

const NORMIES_API      = "https://api.normies.art";
const OPENSEA_API      = "https://api.opensea.io/api/v2";
const NORMIES_SLUG     = "normies";
const TOTAL_MINTED     = 10000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const OS_KEY = process.env.OPENSEA_API_KEY || "";
  const OS_HEADERS = {
    "accept": "application/json",
    "x-api-key": OS_KEY,
  };

  try {
    const [
      countRes,
      statsRes,
      burnsRes,
      agentsRes,
      osStatsRes,
      osCollectionRes,
      osListingsRes,
      osOffersRes,
      canvasRes,
    ] = await Promise.allSettled([

      // 1. Awakened agent count
      fetch(`${NORMIES_API}/agents/count`)
        .then(r => r.json()),

      // 2. Canvas global stats
      fetch(`${NORMIES_API}/history/stats`)
        .then(r => r.json()),

      // 3. Recent burns
      fetch(`${NORMIES_API}/history/burns?limit=5`)
        .then(r => r.json()),

      // 4. Recent awakenings
      fetch(`${NORMIES_API}/agents/list?limit=8&sort=newest`)
        .then(r => r.json()),

      // 5. OpenSea collection stats — floor, volume, owners, all intervals
      fetch(`${OPENSEA_API}/collections/${NORMIES_SLUG}/stats`, {
        headers: OS_HEADERS,
      }).then(r => r.json()),

      // 6. OpenSea collection info — supply, description
      fetch(`${OPENSEA_API}/collections/${NORMIES_SLUG}`, {
        headers: OS_HEADERS,
      }).then(r => r.json()),

      // 7. Floor listings — cheapest 5 available now
      fetch(`${OPENSEA_API}/listings/collection/${NORMIES_SLUG}/best?limit=5`, {
        headers: OS_HEADERS,
      }).then(r => r.json()),

      // 8. Best offers on collection
      fetch(`${OPENSEA_API}/offers/collection/${NORMIES_SLUG}/best?limit=5`, {
        headers: OS_HEADERS,
      }).then(r => r.json()),

      // 9. Canvas contract status
      fetch(`${NORMIES_API}/canvas/status`)
        .then(r => r.json()),
    ]);

    // ── PARSE ──────────────────────────────────────────────────────────────

    const count      = countRes.status      === "fulfilled" ? countRes.value      : null;
    const stats      = statsRes.status      === "fulfilled" ? statsRes.value      : null;
    const burns      = burnsRes.status      === "fulfilled" ? burnsRes.value      : null;
    const agents     = agentsRes.status     === "fulfilled" ? agentsRes.value     : null;
    const osStats    = osStatsRes.status    === "fulfilled" ? osStatsRes.value    : null;
    const osCol      = osCollectionRes.status === "fulfilled" ? osCollectionRes.value : null;
    const osListings = osListingsRes.status === "fulfilled" ? osListingsRes.value : null;
    const osOffers   = osOffersRes.status   === "fulfilled" ? osOffersRes.value   : null;
    const canvas     = canvasRes.status     === "fulfilled" ? canvasRes.value     : null;

    // OpenSea stats breakdown
    const total     = osStats?.total     || null;
    const intervals = osStats?.intervals || [];
    const day       = intervals.find((i: any) => i.interval === "one_day")   || null;
    const week      = intervals.find((i: any) => i.interval === "one_week")  || null;
    const month     = intervals.find((i: any) => i.interval === "one_month") || null;

    // Floor
    const floorRaw = total?.floor_price ?? null;
    const floorEth = floorRaw ? parseFloat(floorRaw) : null;

    // Supply and market cap
    const burnedCount = parseInt(stats?.totalBurnedTokens) || 0;
    const supply      = osCol?.total_supply
      ? parseInt(osCol.total_supply)
      : TOTAL_MINTED - burnedCount;
    const marketCap   = floorEth && supply
      ? (floorEth * supply).toFixed(0)
      : null;

    // Recent awakenings
    const agentItems   = agents?.items || [];
    const recentAgents = agentItems.slice(0, 8).map((a: any) => ({
      name:         a.name || `Agent #${a.tokenId}`,
      id:           parseInt(a.tokenId) || 0,
      type:         a.type || "Human",
      registeredAt: a.registeredAt
        ? new Date(parseInt(a.registeredAt) * 1000).toISOString()
        : null,
    }));

    // Recent burns
    const burnList    = Array.isArray(burns) ? burns : [];
    const recentBurns = burnList.slice(0, 5).map((b: any) => ({
      commitId:      b.commitId,
      owner:         b.owner
        ? `${b.owner.slice(0, 6)}...${b.owner.slice(-4)}`
        : "unknown",
      receiverToken: b.receiverTokenId,
      tokensBurned:  b.tokenCount,
      apEarned:      b.totalActions,
      ts:            b.timestamp
        ? new Date(parseInt(b.timestamp) * 1000).toISOString()
        : null,
    }));

    // Floor listings — cheapest available right now
    const listingItems  = osListings?.listings || [];
    const floorListings = listingItems.slice(0, 5).map((l: any) => {
      const params    = l.protocol_data?.parameters || {};
      const priceWei  = params.consideration?.[0]?.startAmount;
      const priceEth  = priceWei
        ? (parseInt(priceWei) / 1e18).toFixed(4)
        : null;
      const tokenId   = params.offer?.[0]?.identifierOrCriteria;
      const seller    = params.offerer;
      const endTime   = params.endTime;
      return {
        token:   tokenId ? `Normie #${parseInt(tokenId)}` : "Unknown",
        price:   priceEth ? `${priceEth} ETH` : null,
        seller:  seller
          ? `${seller.slice(0, 6)}...${seller.slice(-4)}`
          : "unknown",
        expires: endTime
          ? new Date(parseInt(endTime) * 1000).toISOString()
          : null,
      };
    });

    // Top bids / offers
    const offerItems = osOffers?.offers || [];
    const topBids    = offerItems.slice(0, 5).map((o: any) => {
      const params   = o.protocol_data?.parameters || {};
      const priceWei = params.consideration?.[0]?.startAmount;
      const priceEth = priceWei
        ? (parseInt(priceWei) / 1e18).toFixed(4)
        : null;
      const bidder   = params.offerer;
      const endTime  = params.endTime;
      return {
        price:   priceEth ? `${priceEth} ETH` : null,
        bidder:  bidder
          ? `${bidder.slice(0, 6)}...${bidder.slice(-4)}`
          : "unknown",
        expires: endTime
          ? new Date(parseInt(endTime) * 1000).toISOString()
          : null,
      };
    });

    // ── RESPONSE ──────────────────────────────────────────────────────────

    return res.status(200).json({
      snapshot_ts: Date.now(),

      collection: {
        floor_price:      floorEth
          ? `${floorEth.toFixed(4)} ETH`
          : null,
        floor_change_24h: day?.floor_price_percentage_change !== undefined
          ? `${parseFloat(day.floor_price_percentage_change).toFixed(1)}%`
          : null,
        floor_change_7d:  week?.floor_price_percentage_change !== undefined
          ? `${parseFloat(week.floor_price_percentage_change).toFixed(1)}%`
          : null,

        volume_24h:      day?.volume !== undefined
          ? `${parseFloat(day.volume).toFixed(2)} ETH`
          : null,
        volume_7d:       week?.volume !== undefined
          ? `${parseFloat(week.volume).toFixed(2)} ETH`
          : null,
        volume_30d:      month?.volume !== undefined
          ? `${parseFloat(month.volume).toFixed(2)} ETH`
          : null,
        volume_all_time: total?.volume !== undefined
          ? `${parseFloat(total.volume).toFixed(0)} ETH`
          : null,

        sales_24h:  day?.sales   ?? null,
        sales_7d:   week?.sales  ?? null,
        sales_30d:  month?.sales ?? null,

        unique_holders: total?.num_owners   ?? null,
        supply:         supply              ?? null,
        market_cap:     marketCap
          ? `${marketCap} ETH`
          : null,

        floor_listings: floorListings.length > 0 ? floorListings : null,
      },

      agents: {
        total_awakened:    count?.count   || null,
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
        top_bids: topBids.length > 0 ? topBids : null,
      },
    });

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
