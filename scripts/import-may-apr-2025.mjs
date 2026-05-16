import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.local" });

const { Pool } = pg;
const CSV = path.resolve("ratings", "Ratings_May-Apr-2025.csv");

const APRIL_TS = "2025-04-30T12:00:00Z";
const MAY_TS = "2025-05-31T12:00:00Z";

// ---- Final manual map ----
// Use STEAM_ID_MAP when we know the exact steam_id, USERNAME_MAP for fuzzy/encoding.
// USERNAME_MAP entries get tiebreak-resolved by match_count in DB.
const STEAM_ID_MAP = {
  18: "76561198208126212",   // Kaim → .kAimb0t
  21: "76561199446278404",   // slabuu → Slabo
  66: "76561198352037174",   // smasher → Xavi Simons
  118: "76561198939528906",  // Lyne → Lyneestar
  129: "76561198867680087",  // marcinoss → marcy
  131: "76561197969186609",  // Rhino → boy next door
  139: "76561198197641777",  // leber → janek
  144: "76561199211055932",  // Gurkster → ster
  155: "76561199114183049",  // KICHANO RONALDO → MSN(Kichano)
  220: "76561199484079355",  // Vice → v1ce
  222: "76561199055278320",  // BUSTILLO → BUSTI
  245: "76561199128644196",  // Guts → DudeMan
  299: "76561198444669617",  // afonso → fonser
  300: "76561199165825698",  // costa → unseen
  303: "76561198215405425",  // Franco → Franco Portofino
  310: "76561199261226631",  // Nuq' → Nuqqet
  316: "76561198170824989",  // Sujiro → Templle
  322: "76561199284196830",  // Twentyno → Thirtyno
  416: "76561199157087738",  // Ancentyz-GK → Acientyzz
};

const USERNAME_MAP = {
  // encoding fixes
  150: "Filipovič",
  166: "Đenqty",
  361: "Mèvàlgnò",
  // whitespace / punctuation
  15: "R0D ",
  175: "✪ skuza",
  209: "ObiWan #23",
  323: "bedplayer",
  339: "general g",
  344: "Roble ",     // user-confirmed Roble Tormentoso → "Roble "
  357: "nkr-",
  423: "SevenWay",
  // fuzzy plausibles
  19: "Chefkewilles",
  71: "Berie",
  250: "Incurs1oPinkman",
  279: "Roca",
  352: "toasty",
  // 379 "Sno" → "Snow" candidates max 7 matches — too weak, skip
  399: "Jordan",
  402: "edwar",
  411: "Lukaku",
  418: "Bogdan",
  440: "Balotelli.",
  451: "nito",
  469: "Saif",
  475: "LAKAKA",
  478: "Raptor",
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
const idIdx = header.indexOf("ID");
const nameIdx = header.indexOf("Name");
const newIdx = header.indexOf("New");
const oldIdx = header.indexOf("Old");

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
  const dbPlayers = dbRes.rows;
  const byUsername = new Map(); // case-sensitive username → array
  const byUsernameLower = new Map();
  for (const p of dbPlayers) {
    const arr = byUsername.get(p.username) || []; arr.push(p); byUsername.set(p.username, arr);
    const k = p.username.toLowerCase();
    const arr2 = byUsernameLower.get(k) || []; arr2.push(p); byUsernameLower.set(k, arr2);
  }

  // Resolve every row to a steamId
  const resolved = []; // {id, name, steamId, newRating, oldRating, source}
  const skipped = [];

  // Helper: pick best steam_id from candidates by match_count
  async function pickBest(candidates) {
    if (candidates.length === 1) return candidates[0].steam_id;
    const ids = candidates.map((c) => c.steam_id);
    const r = await client.query(`
      SELECT player_steam_id, COUNT(*) AS n
      FROM match_player_stats
      WHERE player_steam_id = ANY($1::text[])
      GROUP BY player_steam_id
      ORDER BY n DESC
    `, [ids]);
    if (r.rows.length === 0) return candidates[0].steam_id;
    return r.rows[0].player_steam_id;
  }

  for (const row of rows) {
    // 1) explicit steam_id mapping
    if (STEAM_ID_MAP[row.id]) {
      resolved.push({ ...row, steamId: STEAM_ID_MAP[row.id], source: "manual:steam_id" });
      continue;
    }
    // 2) explicit username mapping
    if (USERNAME_MAP[row.id]) {
      const target = USERNAME_MAP[row.id];
      const cands = byUsername.get(target) || byUsernameLower.get(target.toLowerCase()) || [];
      if (cands.length === 0) { skipped.push({ ...row, reason: `manual username "${target}" not in DB` }); continue; }
      const chosen = await pickBest(cands);
      resolved.push({ ...row, steamId: chosen, source: "manual:username" });
      continue;
    }
    // 3) name match (exact case)
    let cands = byUsername.get(row.name) || [];
    if (cands.length === 0) {
      // 4) case-insensitive
      cands = byUsernameLower.get(row.name.toLowerCase()) || [];
    }
    if (cands.length === 0) {
      // 5) mojibake fix
      const fixed = tryFixMojibake(row.name);
      if (fixed) {
        cands = byUsername.get(fixed) || byUsernameLower.get(fixed.toLowerCase()) || [];
      }
    }
    if (cands.length === 0) { skipped.push({ ...row, reason: "no match" }); continue; }
    const chosen = await pickBest(cands);
    resolved.push({ ...row, steamId: chosen, source: cands.length > 1 ? "auto:tiebreak" : "auto:unique" });
  }

  console.log(`Resolved: ${resolved.length} / Skipped: ${skipped.length} / Total: ${rows.length}`);

  // Idempotency: delete any rows at our two target timestamps
  const delRes = await client.query(
    `DELETE FROM player_rating_history WHERE recorded_at = ANY($1::timestamp[])`,
    [[APRIL_TS, MAY_TS]]
  );
  console.log(`Deleted ${delRes.rowCount} pre-existing rows at target timestamps.`);

  // Build insert payload: 2 rows per resolved (April old + May new)
  const insertRows = [];
  for (const r of resolved) {
    if (Number.isFinite(r.oldRating) && r.oldRating > 0) {
      insertRows.push([r.steamId, r.oldRating, APRIL_TS]);
    }
    if (Number.isFinite(r.newRating) && r.newRating > 0) {
      insertRows.push([r.steamId, r.newRating, MAY_TS]);
    }
  }

  // Bulk insert in chunks
  const CHUNK = 1000;
  let inserted = 0;
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

  // Show distinct steam_ids resolved
  const distinct = new Set(resolved.map((r) => r.steamId));
  console.log(`Distinct steam_ids covered: ${distinct.size}`);

  // Per-source breakdown
  const bySrc = {};
  for (const r of resolved) bySrc[r.source] = (bySrc[r.source] || 0) + 1;
  console.log(`By resolution source:`, bySrc);

  // Skipped detail
  if (skipped.length > 0) {
    console.log(`\nSkipped rows (${skipped.length}):`);
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
