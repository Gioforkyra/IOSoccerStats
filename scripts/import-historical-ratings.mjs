import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.local" });

const { Pool } = pg;

const RATINGS_DIR = path.resolve("ratings");

function parseDateFromFilename(name) {
  // ratings_DDMMYYYY... → YYYY-MM-DD
  const m = name.match(/ratings_(\d{2})(\d{2})(\d{4})/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}T12:00:00Z`;
}

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

function parseCsvFile(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return { header: [], rows: [] };
  const header = parseCsvLine(lines[0]).map((h) => h.trim());
  const rows = lines.slice(1).map(parseCsvLine);
  return { header, rows };
}

function pickIndex(header, name) {
  const idx = header.indexOf(name);
  if (idx === -1) throw new Error(`Column "${name}" not found in header: ${header.join(",")}`);
  return idx;
}

function maybeIndex(header, name) {
  const idx = header.indexOf(name);
  return idx === -1 ? null : idx;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL not set in .env.local");
    process.exit(1);
  }

  const files = fs.readdirSync(RATINGS_DIR)
    .filter((f) => f.toLowerCase().endsWith(".csv"))
    .map((f) => path.join(RATINGS_DIR, f));

  console.log(`Found ${files.length} CSV files in ${RATINGS_DIR}`);

  // First pass: parse files into raw rows; some only have HubId, resolve later via DB lookup.
  const rawRows = []; // { steamId?, hubId?, name, rating, recordedAt, source }
  for (const file of files) {
    const recordedAt = parseDateFromFilename(path.basename(file));
    if (!recordedAt) {
      console.warn(`Skipping ${path.basename(file)} — could not parse date from filename`);
      continue;
    }
    const { header, rows } = parseCsvFile(file);
    const steamIdx = maybeIndex(header, "SteamId");
    const hubIdx = maybeIndex(header, "HubId");
    const nameIdx = pickIndex(header, "Name");
    const ratingIdx = pickIndex(header, "Rating");

    if (steamIdx === null && hubIdx === null) {
      console.warn(`Skipping ${path.basename(file)} — neither SteamId nor HubId column found`);
      continue;
    }

    let parsed = 0;
    let skipped = 0;
    for (const row of rows) {
      const steamId = steamIdx !== null ? (row[steamIdx] || "").trim() : "";
      const hubIdStr = hubIdx !== null ? (row[hubIdx] || "").trim() : "";
      const hubId = hubIdStr ? Number(hubIdStr) : null;
      const name = (row[nameIdx] || "").trim();
      const rating = Number((row[ratingIdx] || "").trim());

      if (!Number.isFinite(rating)) { skipped++; continue; }
      if (!steamId && !Number.isFinite(hubId)) { skipped++; continue; }

      rawRows.push({
        steamId: steamId || null,
        hubId: Number.isFinite(hubId) ? hubId : null,
        name: name || "Unknown",
        rating,
        recordedAt,
        source: path.basename(file),
      });
      parsed++;
    }
    const cols = steamIdx !== null ? "steamId" : "hubId only";
    console.log(`  ${path.basename(file)} → ${recordedAt.slice(0, 10)} | ${parsed} rows (${skipped} skipped, by ${cols})`);
  }

  console.log(`\nTotal raw rows parsed: ${rawRows.length}`);
  if (rawRows.length === 0) { console.log("Nothing to do."); return; }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Resolve hubId → steamId via players.iosoccer_id for rows that lack steamId.
    const hubIdsToResolve = Array.from(new Set(
      rawRows.filter((r) => !r.steamId && r.hubId != null).map((r) => r.hubId)
    ));
    const hubToSteam = new Map();
    if (hubIdsToResolve.length > 0) {
      const res = await client.query(
        `SELECT steam_id, iosoccer_id FROM players WHERE iosoccer_id = ANY($1::int[])`,
        [hubIdsToResolve]
      );
      for (const row of res.rows) hubToSteam.set(row.iosoccer_id, row.steam_id);
      console.log(`Resolved ${hubToSteam.size}/${hubIdsToResolve.length} HubIds to steamIds via players.iosoccer_id.`);
    }

    // Build final rows with resolved steamId. Drop unresolvable ones.
    const allRows = [];
    let unresolved = 0;
    for (const r of rawRows) {
      let steamId = r.steamId;
      if (!steamId && r.hubId != null) steamId = hubToSteam.get(r.hubId) || null;
      if (!steamId) { unresolved++; continue; }
      allRows.push({ steamId, name: r.name, rating: r.rating, recordedAt: r.recordedAt });
    }
    console.log(`Final rows to import: ${allRows.length} (${unresolved} unresolved HubIds dropped).`);
    if (allRows.length === 0) { await client.query("ROLLBACK"); return; }

    // Idempotency: delete any rows at these exact timestamps before re-inserting.
    const distinctTimestamps = Array.from(new Set(allRows.map((r) => r.recordedAt)));
    const delResult = await client.query(
      `DELETE FROM player_rating_history WHERE recorded_at = ANY($1::timestamp[])`,
      [distinctTimestamps]
    );
    console.log(`Deleted ${delResult.rowCount} pre-existing rows at target timestamps (idempotency).`);

    // Find which steam_ids are missing from players table.
    const distinctSteamIds = Array.from(new Set(allRows.map((r) => r.steamId)));
    const existingResult = await client.query(
      `SELECT steam_id FROM players WHERE steam_id = ANY($1::text[])`,
      [distinctSteamIds]
    );
    const existingSet = new Set(existingResult.rows.map((r) => r.steam_id));
    const missingSteamIds = distinctSteamIds.filter((s) => !existingSet.has(s));
    console.log(`Players: ${existingSet.size} already exist, ${missingSteamIds.length} missing.`);

    // Create stub Player records for missing IDs so they appear in JOINs.
    if (missingSteamIds.length > 0) {
      const nameBySteam = new Map();
      for (const r of allRows) {
        if (!existingSet.has(r.steamId)) nameBySteam.set(r.steamId, r.name);
      }
      const CHUNK_PLAYERS = 500;
      let totalInserted = 0;
      for (let i = 0; i < missingSteamIds.length; i += CHUNK_PLAYERS) {
        const chunk = missingSteamIds.slice(i, i + CHUNK_PLAYERS);
        const placeholders = [];
        const params = [];
        let p = 1;
        for (const steamId of chunk) {
          const name = nameBySteam.get(steamId) || "Unknown";
          placeholders.push(`($${p++}, $${p++})`);
          params.push(steamId, name);
        }
        const sql = `INSERT INTO players (steam_id, username) VALUES ${placeholders.join(",")} ON CONFLICT (steam_id) DO NOTHING`;
        const playersIns = await client.query(sql, params);
        totalInserted += playersIns.rowCount;
      }
      console.log(`Inserted ${totalInserted} stub player rows.`);
    }

    // Bulk insert into player_rating_history (chunked).
    const CHUNK = 1000;
    let inserted = 0;
    for (let i = 0; i < allRows.length; i += CHUNK) {
      const chunk = allRows.slice(i, i + CHUNK);
      const placeholders = [];
      const params = [];
      let p = 1;
      for (const r of chunk) {
        placeholders.push(`($${p++}, $${p++}, $${p++})`);
        params.push(r.steamId, r.rating, r.recordedAt);
      }
      const sql = `INSERT INTO player_rating_history (steam_id, rating, recorded_at) VALUES ${placeholders.join(",")}`;
      const res = await client.query(sql, params);
      inserted += res.rowCount;
    }
    console.log(`Inserted ${inserted} rating history rows.`);

    await client.query("COMMIT");
    console.log("\n✓ Import complete.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("✗ Import failed, rolled back:", err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
