import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.local" });

const { Pool } = pg;

const OLD_QUERY = `
  SELECT prh.steam_id, p.username, AVG(prh.rating)::float AS rating
  FROM player_rating_history prh
  JOIN players p ON p.steam_id = prh.steam_id
  WHERE TO_CHAR(DATE_TRUNC('month', prh.recorded_at), 'YYYY-MM') = $1
    AND prh.rating > 0
    AND EXISTS (
      SELECT 1 FROM match_player_stats mps
      JOIN matches m ON m.id = mps.match_id
      JOIN teams t ON t.id = m.home_team_id OR t.id = m.away_team_id
      WHERE mps.player_steam_id = prh.steam_id
        AND t.region_id = 1
    )
    AND (
      $2 = 0
      OR (
        SELECT COUNT(DISTINCT mps2.match_id)
        FROM match_player_stats mps2
        JOIN matches m2 ON m2.id = mps2.match_id
        JOIN teams t2 ON t2.id = m2.home_team_id OR t2.id = m2.away_team_id
        WHERE mps2.player_steam_id = prh.steam_id
          AND t2.region_id = 1
      ) >= $2
    )
  GROUP BY prh.steam_id, p.username
  HAVING AVG(prh.rating) > 0
  ORDER BY rating ASC
`;

const NEW_QUERY = `
  WITH eu_match_counts AS (
    SELECT mps.player_steam_id, COUNT(DISTINCT mps.match_id) AS cnt
    FROM match_player_stats mps
    JOIN matches m ON m.id = mps.match_id
    JOIN teams t ON t.id = m.home_team_id OR t.id = m.away_team_id
    WHERE t.region_id = 1
    GROUP BY mps.player_steam_id
  )
  SELECT prh.steam_id, p.username, AVG(prh.rating)::float AS rating
  FROM player_rating_history prh
  JOIN players p ON p.steam_id = prh.steam_id
  JOIN eu_match_counts emc ON emc.player_steam_id = prh.steam_id
  WHERE TO_CHAR(DATE_TRUNC('month', prh.recorded_at), 'YYYY-MM') = $1
    AND prh.rating > 0
    AND emc.cnt >= $2
  GROUP BY prh.steam_id, p.username
  HAVING AVG(prh.rating) > 0
  ORDER BY rating ASC
`;

const TEST_CASES = [
  ["2026-04", 0],
  ["2026-04", 100],
  ["2025-08", 100],
  ["2024-01", 50],
  ["2023-04", 100],
  ["2023-04", 0],
  ["2023-04", 500],
  ["2022-12", 100],
  ["2022-08", 1000],
  ["2022-06", 100],
];

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run(query, args) {
  const t0 = Date.now();
  const res = await pool.query(query, args);
  const elapsed = Date.now() - t0;
  return { rows: res.rows, elapsed };
}

function compareRows(oldRows, newRows) {
  if (oldRows.length !== newRows.length) {
    return { ok: false, reason: `row count: old=${oldRows.length} new=${newRows.length}` };
  }
  const oldMap = new Map(oldRows.map((r) => [r.steam_id, r.rating]));
  for (const r of newRows) {
    const oldRating = oldMap.get(r.steam_id);
    if (oldRating === undefined) {
      return { ok: false, reason: `steam_id ${r.steam_id} in NEW but not OLD` };
    }
    if (Math.abs(oldRating - r.rating) > 0.0001) {
      return { ok: false, reason: `rating mismatch for ${r.steam_id}: old=${oldRating} new=${r.rating}` };
    }
  }
  return { ok: true };
}

let allOk = true;
console.log(`\n${"period".padEnd(10)}${"min".padEnd(7)}${"rows".padEnd(7)}${"old(ms)".padEnd(10)}${"new(ms)".padEnd(10)}speedup    match`);
console.log("─".repeat(70));

for (const [period, min] of TEST_CASES) {
  try {
    const oldRes = await run(OLD_QUERY, [period, min]);
    const newRes = await run(NEW_QUERY, [period, min]);
    const cmp = compareRows(oldRes.rows, newRes.rows);
    if (!cmp.ok) allOk = false;
    const speedup = oldRes.elapsed > 0 ? `${(oldRes.elapsed / Math.max(newRes.elapsed, 1)).toFixed(1)}×` : "—";
    console.log(
      `${period.padEnd(10)}${String(min).padEnd(7)}${String(newRes.rows.length).padEnd(7)}${String(oldRes.elapsed).padEnd(10)}${String(newRes.elapsed).padEnd(10)}${speedup.padEnd(11)}${cmp.ok ? "✓" : `✗ ${cmp.reason}`}`
    );
  } catch (err) {
    console.log(`${period.padEnd(10)}${String(min).padEnd(7)}ERROR: ${err.message}`);
    allOk = false;
  }
}

console.log(allOk ? "\n✓ All test cases produced identical results." : "\n✗ Some test cases differ.");

await pool.end();
process.exit(allOk ? 0 : 1);
