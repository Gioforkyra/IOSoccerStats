import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.local" });

const { Pool } = pg;
const RATINGS_DIR = path.resolve("ratings");

function parseCsvLine(line) {
  const fields = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { cur += c; }
    } else {
      if (c === '"') { inQuotes = true; }
      else if (c === ',') { fields.push(cur); cur = ""; }
      else { cur += c; }
    }
  }
  fields.push(cur);
  return fields;
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Re-parse the HubId-only file to find unresolved HubIds
const file = path.join(RATINGS_DIR, "ratings_12062022.xlsx - ratings.csv");
const text = fs.readFileSync(file, "utf8");
const lines = text.split(/\r?\n/).filter(l => l);
const header = parseCsvLine(lines[0]).map(h => h.trim());
const hubIdx = header.indexOf("HubId");
const nameIdx = header.indexOf("Name");
const ratingIdx = header.indexOf("Rating");
const matchIdx = header.indexOf("MatchesPlayed");

const csvRows = lines.slice(1).map(parseCsvLine).map(r => ({
  hubId: Number(r[hubIdx]),
  name: r[nameIdx],
  rating: Number(r[ratingIdx]),
  matches: Number(r[matchIdx]),
}));

const hubIds = csvRows.map(r => r.hubId);
const res = await pool.query(
  `SELECT iosoccer_id, steam_id, username FROM players WHERE iosoccer_id = ANY($1::int[])`,
  [hubIds]
);
const resolved = new Set(res.rows.map(r => r.iosoccer_id));
const unresolved = csvRows.filter(r => !resolved.has(r.hubId));

console.log(`\n=== Unresolved HubIds (no matching iosoccer_id in players table) ===`);
console.log(`Count: ${unresolved.length}\n`);
console.log("Full list (sorted desc by rating):");
unresolved
  .sort((a, b) => b.rating - a.rating)
  .forEach(r => {
    console.log(`  HubId ${String(r.hubId).padEnd(7)} | rating ${r.rating.toFixed(2)} | ${r.matches.toFixed(1).padStart(5)} matches | ${r.name}`);
  });

// Also check: how many imported players are stub-only (no iosoccer_id, etc.)?
const stubCheck = await pool.query(`
  SELECT COUNT(*) AS n
  FROM players p
  WHERE p.iosoccer_id IS NULL
    AND EXISTS (SELECT 1 FROM player_rating_history prh WHERE prh.steam_id = p.steam_id)
`);
console.log(`\nPlayers with rating history but no iosoccer_id: ${stubCheck.rows[0].n}`);

await pool.end();
