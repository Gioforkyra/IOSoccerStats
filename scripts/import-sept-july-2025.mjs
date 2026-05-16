import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.local" });

const { Pool } = pg;
const CSV = path.resolve("ratings", "Ratings_Sept-July2025.csv");

const JULY_TS = "2025-07-31T12:00:00Z";
const SEPT_TS = "2025-09-30T12:00:00Z";

// Mappings by explicit steam_id (exact disambiguation)
const STEAM_ID_MAP = {
  26: "76561199233185377",   // Milos (zero) → Milos (3288 matches)
  33: "76561198878169506",   // Milos (Esperanza) → Miloš (4581 matches)
  79: "76561198352037174",   // smasher → Xavi Simons
  116: "76561199114183049",  // KICHANO RONALDO → MSN(Kichano)
  125: "76561198825428085",  // Krib → kr1b (1679 matches)
  134: "76561197969186609",  // Rhino → boy next door
  142: "76561199211055932",  // Gurkster → ster
  143: "76561199152667852",  // Ulli im Gulli → "ulli " (with space)
  160: "76561198197641777",  // leber → janek
  178: "76561199484079355",  // vice → v1ce
  192: "76561199165825698",  // costa → unseen
  226: "76561199055278320",  // BUSTILLO → BUSTI
  239: "76561199467753098",  // quper → poizon (1900 matches)
  290: "76561199128644196",  // Guts → DudeMan
  316: "76561198215405425",  // Franco → Franco Portofino
  351: "76561198170824989",  // Sujiro → Templle
  31:  "76561198061757191",  // faum → fom
};

// Mappings by username (case-sensitive when possible)
const USERNAME_MAP = {
  // encoding / spazi / punteggiatura
  12: "Slabo",
  17: "R0D ",
  64: "yamikami.",
  138: "Filipovič",
  154: "Đenqty",
  181: "✪ skuza",
  251: "c4terrr!",
  269: "fonser",
  352: "Courtois<3",
  376: "SevenWay",
  443: "Roble ",
  498: "TL. Madani",
  // other plausibles
  71: "Berie",
  193: "Myaaarwin Nunez",
};

function parseCsvLine(line) {
  const fields = []; let cur = ""; let inQuotes = false;
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
  fields.push(cur); return fields;
}
function tryFixMojibake(s) {
  if (!/[À-ÿ]/.test(s)) return null;
  try {
    const decoded = Buffer.from(s, "latin1").toString("utf8");
    if (decoded.includes("�")) return null;
    return decoded;
  } catch { return null; }
}

const text = fs.readFileSync(CSV, "utf8");
const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
const header = parseCsvLine(lines[0]).map((h) => h.trim());
const idIdx = header.indexOf("ID"), nameIdx = header.indexOf("Name");
const newIdx = header.indexOf("New"), oldIdx = header.indexOf("Old");

const rows = lines.slice(1).map(parseCsvLine).map((r) => ({
  id: Number(r[idIdx]),
  name: (r[nameIdx] || "").trim(),
  newRating: Number(r[newIdx]),
  oldRating: Number(r[oldIdx]),
}));

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query("BEGIN");

  const dbRes = await client.query(`SELECT steam_id, username FROM players`);
  const byUsername = new Map(), byUsernameLower = new Map();
  for (const p of dbRes.rows) {
    (byUsername.get(p.username) || byUsername.set(p.username, []).get(p.username)).push(p);
    const k = p.username.toLowerCase();
    (byUsernameLower.get(k) || byUsernameLower.set(k, []).get(k)).push(p);
  }

  async function pickBest(candidates) {
    if (candidates.length === 1) return candidates[0].steam_id;
    const ids = candidates.map((c) => c.steam_id);
    const r = await client.query(`
      SELECT player_steam_id, COUNT(*) AS n
      FROM match_player_stats WHERE player_steam_id = ANY($1::text[])
      GROUP BY player_steam_id ORDER BY n DESC
    `, [ids]);
    if (r.rows.length === 0) return candidates[0].steam_id;
    return r.rows[0].player_steam_id;
  }

  const resolved = []; const skipped = [];

  for (const row of rows) {
    if (STEAM_ID_MAP[row.id]) {
      resolved.push({ ...row, steamId: STEAM_ID_MAP[row.id], source: "manual:steam_id" });
      continue;
    }
    if (USERNAME_MAP[row.id]) {
      const target = USERNAME_MAP[row.id];
      const cands = byUsername.get(target) || byUsernameLower.get(target.toLowerCase()) || [];
      if (cands.length === 0) { skipped.push({ ...row, reason: `manual username "${target}" not in DB` }); continue; }
      resolved.push({ ...row, steamId: await pickBest(cands), source: "manual:username" });
      continue;
    }
    let cands = byUsername.get(row.name) || [];
    if (cands.length === 0) cands = byUsernameLower.get(row.name.toLowerCase()) || [];
    if (cands.length === 0) {
      const fixed = tryFixMojibake(row.name);
      if (fixed) cands = byUsername.get(fixed) || byUsernameLower.get(fixed.toLowerCase()) || [];
    }
    if (cands.length === 0) { skipped.push({ ...row, reason: "no match" }); continue; }
    resolved.push({ ...row, steamId: await pickBest(cands), source: cands.length > 1 ? "auto:tiebreak" : "auto:unique" });
  }

  console.log(`Resolved: ${resolved.length} / Skipped: ${skipped.length} / Total: ${rows.length}`);

  // Idempotency: delete any existing rows at our two timestamps
  const delRes = await client.query(
    `DELETE FROM player_rating_history WHERE recorded_at = ANY($1::timestamp[])`,
    [[JULY_TS, SEPT_TS]]
  );
  console.log(`Deleted ${delRes.rowCount} pre-existing rows at target timestamps.`);

  // Build insert payload
  const insertRows = [];
  for (const r of resolved) {
    if (Number.isFinite(r.oldRating) && r.oldRating > 0) insertRows.push([r.steamId, r.oldRating, JULY_TS]);
    if (Number.isFinite(r.newRating) && r.newRating > 0) insertRows.push([r.steamId, r.newRating, SEPT_TS]);
  }

  const CHUNK = 1000; let inserted = 0;
  for (let i = 0; i < insertRows.length; i += CHUNK) {
    const chunk = insertRows.slice(i, i + CHUNK);
    const placeholders = []; const params = []; let p = 1;
    for (const [sid, rating, ts] of chunk) {
      placeholders.push(`($${p++}, $${p++}, $${p++})`);
      params.push(sid, rating, ts);
    }
    const sql = `INSERT INTO player_rating_history (steam_id, rating, recorded_at) VALUES ${placeholders.join(",")}`;
    const r = await client.query(sql, params);
    inserted += r.rowCount;
  }
  console.log(`Inserted ${inserted} rating history rows.`);
  console.log(`Distinct steam_ids covered: ${new Set(resolved.map((r) => r.steamId)).size}`);

  const bySrc = {};
  for (const r of resolved) bySrc[r.source] = (bySrc[r.source] || 0) + 1;
  console.log(`By resolution source:`, bySrc);

  if (skipped.length > 0) {
    console.log(`\nSkipped (${skipped.length}):`);
    for (const s of skipped) console.log(`  ID ${s.id} "${s.name}" — ${s.reason}`);
  }

  await client.query("COMMIT");
  console.log("\n✓ Import complete.");
} catch (err) {
  await client.query("ROLLBACK");
  console.error("✗ Failed, rolled back:", err);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
