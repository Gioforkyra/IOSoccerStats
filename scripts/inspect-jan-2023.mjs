import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.local" });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// 1. Distribution of ratings in Jan 2023 (raw, no filters)
console.log("\n=== Raw rating distribution Jan 2023 (no min filter) ===");
const distRaw = await pool.query(`
  SELECT ROUND(prh.rating::numeric, 1) AS bucket, COUNT(*) AS cnt
  FROM player_rating_history prh
  WHERE TO_CHAR(DATE_TRUNC('month', prh.recorded_at), 'YYYY-MM') = '2023-01'
  GROUP BY ROUND(prh.rating::numeric, 1)
  ORDER BY bucket
`);
let total = 0;
for (const r of distRaw.rows) total += Number(r.cnt);
console.log(`Total raw rows: ${total}`);
distRaw.rows.forEach((r) => {
  const pct = ((Number(r.cnt) / total) * 100).toFixed(1);
  const bar = "█".repeat(Math.min(50, Math.round(Number(r.cnt) / 5)));
  console.log(`  ${Number(r.bucket).toFixed(1)}  ${String(r.cnt).padStart(4)}  ${pct.padStart(5)}%  ${bar}`);
});

// 2. How many distinct snapshots per player in Jan 2023?
console.log("\n=== Distinct snapshots per player in Jan 2023 ===");
const snaps = await pool.query(`
  SELECT n_snaps, COUNT(*) AS players
  FROM (
    SELECT prh.steam_id, COUNT(*) AS n_snaps
    FROM player_rating_history prh
    WHERE TO_CHAR(DATE_TRUNC('month', prh.recorded_at), 'YYYY-MM') = '2023-01'
    GROUP BY prh.steam_id
  ) sub
  GROUP BY n_snaps
  ORDER BY n_snaps
`);
snaps.rows.forEach((r) => console.log(`  ${r.n_snaps} snapshots → ${r.players} players`));

// 3. After applying the filters used in /ratings, how many at exactly 6.00?
console.log("\n=== After /ratings filters (min=100), distribution near 6.0 ===");
const filtered = await pool.query(`
  WITH eu_match_counts AS (
    SELECT mps.player_steam_id, COUNT(DISTINCT mps.match_id) AS cnt
    FROM match_player_stats mps
    JOIN matches m ON m.id = mps.match_id
    JOIN teams t ON t.id = m.home_team_id OR t.id = m.away_team_id
    WHERE t.region_id = 1
    GROUP BY mps.player_steam_id
  )
  SELECT ROUND(AVG(prh.rating)::numeric, 2) AS bucket, COUNT(*) AS cnt
  FROM player_rating_history prh
  JOIN players p ON p.steam_id = prh.steam_id
  JOIN eu_match_counts emc ON emc.player_steam_id = prh.steam_id
  WHERE TO_CHAR(DATE_TRUNC('month', prh.recorded_at), 'YYYY-MM') = '2023-01'
    AND prh.rating > 0
    AND emc.cnt >= 100
  GROUP BY prh.steam_id, p.username
  HAVING AVG(prh.rating) > 0
`);
const bucketCounts = new Map();
filtered.rows.forEach((r) => {
  const b = Number(r.bucket);
  bucketCounts.set(b, (bucketCounts.get(b) || 0) + 1);
});
const sorted = Array.from(bucketCounts.entries()).sort((a, b) => a[0] - b[0]);
const totalFilt = sorted.reduce((s, [, c]) => s + c, 0);
console.log(`Total filtered players: ${totalFilt}`);
sorted.slice(0, 30).forEach(([b, c]) => {
  const pct = ((c / totalFilt) * 100).toFixed(1);
  const bar = "█".repeat(Math.min(50, c));
  console.log(`  ${b.toFixed(2)}  ${String(c).padStart(4)}  ${pct.padStart(5)}%  ${bar}`);
});

// 4. Top players AT exactly rating 6.00 in Jan 2023 with min=100 — show all-time matches and Jan 2023 specifics
console.log("\n=== Top 15 players at rating ≤ 6.05 in Jan 2023 (min=100) ===");
const sample = await pool.query(`
  WITH eu_match_counts AS (
    SELECT mps.player_steam_id, COUNT(DISTINCT mps.match_id) AS cnt
    FROM match_player_stats mps
    JOIN matches m ON m.id = mps.match_id
    JOIN teams t ON t.id = m.home_team_id OR t.id = m.away_team_id
    WHERE t.region_id = 1
    GROUP BY mps.player_steam_id
  ),
  pre_jan_counts AS (
    SELECT mps.player_steam_id, COUNT(DISTINCT mps.match_id) AS cnt
    FROM match_player_stats mps
    JOIN matches m ON m.id = mps.match_id
    JOIN teams t ON t.id = m.home_team_id OR t.id = m.away_team_id
    WHERE t.region_id = 1 AND m.date < '2023-02-01'
    GROUP BY mps.player_steam_id
  )
  SELECT prh.steam_id, p.username, AVG(prh.rating)::float AS avg_rating, emc.cnt AS all_time, COALESCE(pjc.cnt, 0) AS pre_jan
  FROM player_rating_history prh
  JOIN players p ON p.steam_id = prh.steam_id
  JOIN eu_match_counts emc ON emc.player_steam_id = prh.steam_id
  LEFT JOIN pre_jan_counts pjc ON pjc.player_steam_id = prh.steam_id
  WHERE TO_CHAR(DATE_TRUNC('month', prh.recorded_at), 'YYYY-MM') = '2023-01'
    AND prh.rating > 0
    AND emc.cnt >= 100
  GROUP BY prh.steam_id, p.username, emc.cnt, pjc.cnt
  HAVING AVG(prh.rating) <= 6.05
  ORDER BY emc.cnt DESC
  LIMIT 15
`);
console.log(`${"username".padEnd(28)}${"avg_rating".padEnd(12)}${"all-time".padEnd(11)}pre-Feb-2023`);
sample.rows.forEach((r) => {
  console.log(
    `${(r.username || "").slice(0, 27).padEnd(28)}${r.avg_rating.toFixed(2).padEnd(12)}${String(r.all_time).padEnd(11)}${r.pre_jan}`
  );
});

await pool.end();
