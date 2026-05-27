import type { VercelRequest, VercelResponse } from "@vercel/node";

const NORMIES_API  = "https://api.normies.art";
const OPENSEA_API  = "https://api.opensea.io/api/v2";
const NORMIES_SLUG = "normies";
const NORMIES_CONTRACT = "0x9Eb6E2025B64f340691e424b7fe7022fFDE12438";

// Total Normies supply — fixed on-chain, 10000 minted minus burned
const TOTAL_MINTED = 10000;

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
      osStatsRes,
      osStats7dRes,
      osStats30dRes,
      osNFTsRes,
      canvasRes,
    ] = await Promise.allSettled([

      // 1. Awakened agent count
      fetch(`${NORMIES_API}/agents/count`).then(r => r.json()),

      // 2. Canvas global stats
      fetch(`${NORMIES_API}/history/stats`).then(r => r.json()),

      // 3. Recent burns
      fetch(`${NORMIES_API}/history/burns?limit=5`).then(r => r.json()),

      // 4. Recent awakenings
      fetch(`${NORMIES_API}/agents/list?limit=8&sort=newest`).then(r => r.json()),

      // 5. OpenSea collection stats — floor, volume, owners (1 day interval)
      fetch(`${OPENSEA_API}/collections/${NORMIES_SLUG}/stats`, {
        headers: { accept: "application/json" },
      }).then(r => r.json()),

      // 6. OpenSea 7 day stats
      fetch(`${OPENSEA_API}/collections/${NORMIES_SLUG}/stats?interval=7d`, {
        headers: { accept: "application/json" },
      }).then(r => r.json()),

      // 7. OpenSea 30 day stats
      fetch(`${OPENSEA_API}/collections/${NORMIES_SLUG}/stats?interval=30d`, {
        headers: { accept: "application/json" },
      }).then(r => r.json()),

      // 8. OpenSea collection info — supply and description
      fetch(`${OPENSEA_API}/collections/${NORMIES_SLUG}`, {
        headers: { accept: "application/json" },
      }).then(r => r.json()),

      // 9. Canvas contract status
      fetch(`${NORMIES_API}/canvas/status`).then(r => r.json()),
    ]);

    // ── PARSE ──────────────────────────────────────────────────────────────

    const count    = countRes.status    === "fulfilled" ? countRes.value    : null;
    const stats    = statsRes.status    === "fulfilled" ? statsRes.value    : null;
    const burns    = burnsRes.status    === "fulfilled" ? burnsRes.value    : null;
    const agents   = agentsRes.status   === "fulfilled" ? agentsRes.value   : null;
    const osStats  = osStatsRes.status  === "fulfilled" ? osStatsRes.value  : null;
    const osStats7 = osStats7dRes.status  === "fulfilled" ? osStats7dRes.value  : null;
    const osStats30 = osStats30dRes.status === "fulfilled" ? osStats30dRes.value : null;
    const osNFTs   = osNFTsRes.status   === "fulfilled" ? osNFTsRes.value   : null;
    const canvas   = canvasRes.status   === "fulfilled" ? canvasRes.value   : null;

    // OpenSea stats — total and interval breakdowns
    const total    = osStats?.total     || null;
    const intervals = osStats?.intervals || [];
    const day      = intervals.find((i: any) => i.interval === "one_day") || null;

    // Floor price
    const floorRaw = total?.floor_price ?? null;
    const floorEth = floorRaw ? parseFloat(floorRaw) : null;

    // Supply — from collection info or fallback calculation
    const totalSupply = osNFTs?.total_supply
      ?? (TOTAL_MINTED - (parseInt(stats?.totalBurnedTokens) || 0));

    // Market cap = floor × circulating supply
    const marketCap = floorEth && totalSupply
      ? (floorEth * totalSupply).toFixed(0)
      : null;

    // Volume
    const vol24h  = day?.volume          ?? total?.one_day_volume  ?? null;
    const vol7d   = osStats7?.total?.volume  ?? total?.seven_day_volume  ?? null;
    const vol30d  = osStats30?.total?.volume ?? total?.thirty_day_volume ?? null;
    const volAll  = total?.volume        ?? null;

    // Sales counts
    const sales24h  = day?.sales ?? total?.one_day_sales  ?? null;
    const sales7d   = osStats7?.total?.sales  ?? total?.seven_day_sales  ?? null;
    const sales30d  = osStats30?.total?.sales ?? total?.thirty_day_sales ?? null;

    // Floor change
    const floorChange24h = day?.floor_price_percentage_change
      ?? total?.one_day_change
      ?? null;
    const floorChange7d  = osStats7?.intervals?.[0]?.floor_price_percentage_change
      ?? total?.seven_day_change
      ?? null;

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

    // ── RESPONSE ──────────────────────────────────────────────────────────

    return res.status(200).json({
      snapshot_ts: Date.now(),

      collection: {
        floor_price:      floorEth
          ? `${floorEth.toFixed(4)} ETH`
          : null,
        floor_change_24h: floorChange24h !== null
          ? `${parseFloat(floorChange24h).toFixed(1)}%`
          : null,
        floor_change_7d:  floorChange7d !== null
          ? `${parseFloat(floorChange7d).toFixed(1)}%`
          : null,

        volume_24h:       vol24h !== null
          ? `${parseFloat(vol24h).toFixed(2)} ETH`
          : null,
        volume_7d:        vol7d !== null
          ? `${parseFloat(vol7d).toFixed(2)} ETH`
          : null,
        volume_30d:       vol30d !== null
          ? `${parseFloat(vol30d).toFixed(2)} ETH`
          : null,
        volume_all_time:  volAll !== null
          ? `${parseFloat(volAll).toFixed(0)} ETH`
          : null,

        sales_24h:        sales24h ?? null,
        sales_7d:         sales7d  ?? null,
        sales_30d:        sales30d ?? null,

        unique_holders:   total?.num_owners   ?? null,
        supply:           totalSupply          ?? null,
        market_cap:       marketCap
          ? `${marketCap} ETH`
          : null,
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
        // Note: OpenSea listings/offers endpoints require API key for live data
        // Top bid from collection stats
        top_bid: total?.floor_price
          ? null  // OpenSea doesn't return top bid in public stats
          : null,
      },
    });

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
