/**
 * Analyze real shot data from IOSoccer matches to calibrate xG model.
 *
 * Fetches match data from the API for recent matches stored in the DB,
 * extracts shot events with positions and bodyPart, then computes
 * actual conversion rates by distance bucket and shot type (header vs foot).
 *
 * Usage: npx tsx scraper/analyze_xg.ts
 */

const API_BASE = "https://iosoccer.com:44380/api";
const API_HEADERS = {
  Accept: "application/json",
  Origin: "https://www.iosoccer.com",
  Referer: "https://www.iosoccer.com/",
};

type ShotRecord = {
  matchId: number;
  normalizedX: number;
  normalizedY: number;
  distance: number; // normalized distance to nearest goal
  isGoal: boolean;
  isHeader: boolean;
};

function normalizeFromField(val: number, min: number, max: number): number {
  const range = max - min;
  if (!Number.isFinite(val) || !Number.isFinite(range) || range === 0) return 0.5;
  return Math.min(1, Math.max(0, (val - min) / range));
}

function computeDistance(nx: number, ny: number): number {
  const goalY = ny < 0.5 ? 0.0 : 1.0;
  const goalX = 0.5;
  const ASPECT = 105 / 68;
  const dx = nx - goalX;
  const dy = (ny - goalY) * ASPECT;
  return Math.sqrt(dx * dx + dy * dy);
}

async function fetchMatchShots(matchId: number): Promise<ShotRecord[]> {
  try {
    const res = await fetch(`${API_BASE}/match/${matchId}`, {
      headers: API_HEADERS,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json();

    const matchStats = data?.matchStatistics?.matchData;
    if (!matchStats) return [];

    const events: any[] = matchStats.matchEvents || matchStats.events || [];

    const shots: ShotRecord[] = [];
    const seen = new Set<string>();

    const fieldInfo = matchStats.matchInfo || {};
    const fMin = fieldInfo.fieldMin || matchStats.fieldMin;
    const fMax = fieldInfo.fieldMax || matchStats.fieldMax;
    if (!fMin || !fMax) return [];

    for (const evt of events) {
      const evtType: string = evt.matchEventType || evt.event || "";
      if (!["GOAL", "SAVE", "MISS"].includes(evtType)) continue;

      const pos = evt.shotPosition || evt.startPosition || evt.position;
      if (!pos || pos.x == null || pos.y == null) continue;

      const dedupKey = `${evtType}-${evt.second}-${pos.x}-${pos.y}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);

      const nx = normalizeFromField(Number(pos.x), Number(fMin.x), Number(fMax.x));
      const ny = normalizeFromField(Number(pos.y), Number(fMin.y), Number(fMax.y));
      const distance = computeDistance(nx, ny);

      shots.push({
        matchId,
        normalizedX: nx,
        normalizedY: ny,
        distance,
        isGoal: evtType === "GOAL",
        isHeader: evt.bodyPart === 4,
      });
    }
    return shots;
  } catch {
    return [];
  }
}

async function main() {
  // Get match IDs from database
  const dotenv = await import("dotenv");
  dotenv.config({ path: ".env.local" });

  const { PrismaClient } = await import("../src/generated/prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const connectionString = (process.env.DATABASE_URL || "").replace(/^["']|["']$/g, "");
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    // Get recent completed matches with scores
    const matches = await prisma.$queryRaw<{ id: number }[]>`
      SELECT id FROM matches
      WHERE (home_score > 0 OR away_score > 0)
        AND date >= '2024-01-01'
      ORDER BY date DESC
    `;

    console.log(`Found ${matches.length} matches to analyze`);

    const allShots: ShotRecord[] = [];
    const BATCH_SIZE = 10;

    for (let i = 0; i < matches.length; i += BATCH_SIZE) {
      const batch = matches.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map((m) => fetchMatchShots(m.id)));
      for (const shots of results) allShots.push(...shots);

      const pct = ((i + batch.length) / matches.length * 100).toFixed(0);
      process.stdout.write(`\r  Fetched ${i + batch.length}/${matches.length} matches (${pct}%) — ${allShots.length} shots so far`);

      // Small delay to avoid rate limiting
      await new Promise((r) => setTimeout(r, 200));
    }

    console.log(`\n\nTotal shots collected: ${allShots.length}`);

    const footShots = allShots.filter((s) => !s.isHeader);
    const headerShots = allShots.filter((s) => s.isHeader);

    console.log(`  Foot shots: ${footShots.length} (${footShots.filter(s => s.isGoal).length} goals)`);
    console.log(`  Header shots: ${headerShots.length} (${headerShots.filter(s => s.isGoal).length} goals)`);
    console.log(`  Overall conversion: ${(allShots.filter(s => s.isGoal).length / allShots.length * 100).toFixed(1)}%`);
    console.log(`  Foot conversion: ${(footShots.filter(s => s.isGoal).length / footShots.length * 100).toFixed(1)}%`);
    console.log(`  Header conversion: ${headerShots.length > 0 ? (headerShots.filter(s => s.isGoal).length / headerShots.length * 100).toFixed(1) : "N/A"}%`);

    // Distance buckets (normalized distance)
    const BUCKETS = [
      { label: "0-0.05 (6-yard box)", min: 0, max: 0.05 },
      { label: "0.05-0.10 (edge 6yd)", min: 0.05, max: 0.10 },
      { label: "0.10-0.15 (penalty area)", min: 0.10, max: 0.15 },
      { label: "0.15-0.20 (penalty spot)", min: 0.15, max: 0.20 },
      { label: "0.20-0.30 (edge box)", min: 0.20, max: 0.30 },
      { label: "0.30-0.40 (20-25m)", min: 0.30, max: 0.40 },
      { label: "0.40-0.55 (25-35m)", min: 0.40, max: 0.55 },
      { label: "0.55-0.70 (35-45m)", min: 0.55, max: 0.70 },
      { label: "0.70+ (half+)", min: 0.70, max: 2.0 },
    ];

    console.log("\n═══════════════════════════════════════════════════════════════════");
    console.log("FOOT SHOTS — Conversion by distance");
    console.log("═══════════════════════════════════════════════════════════════════");
    console.log(`${"Distance Bucket".padEnd(28)} ${"Shots".padStart(6)} ${"Goals".padStart(6)} ${"Conv%".padStart(8)} ${"Suggested xG".padStart(12)}`);
    console.log("─".repeat(65));

    for (const bucket of BUCKETS) {
      const inBucket = footShots.filter((s) => s.distance >= bucket.min && s.distance < bucket.max);
      const goals = inBucket.filter((s) => s.isGoal).length;
      const conv = inBucket.length > 0 ? goals / inBucket.length : 0;
      console.log(
        `${bucket.label.padEnd(28)} ${String(inBucket.length).padStart(6)} ${String(goals).padStart(6)} ${(conv * 100).toFixed(1).padStart(7)}% ${conv.toFixed(3).padStart(12)}`
      );
    }

    console.log("\n═══════════════════════════════════════════════════════════════════");
    console.log("HEADER SHOTS — Conversion by distance");
    console.log("═══════════════════════════════════════════════════════════════════");
    console.log(`${"Distance Bucket".padEnd(28)} ${"Shots".padStart(6)} ${"Goals".padStart(6)} ${"Conv%".padStart(8)} ${"Suggested xG".padStart(12)}`);
    console.log("─".repeat(65));

    for (const bucket of BUCKETS) {
      const inBucket = headerShots.filter((s) => s.distance >= bucket.min && s.distance < bucket.max);
      const goals = inBucket.filter((s) => s.isGoal).length;
      const conv = inBucket.length > 0 ? goals / inBucket.length : 0;
      console.log(
        `${bucket.label.padEnd(28)} ${String(inBucket.length).padStart(6)} ${String(goals).padStart(6)} ${(conv * 100).toFixed(1).padStart(7)}% ${conv.toFixed(3).padStart(12)}`
      );
    }

    // Also output current model vs actual for comparison
    console.log("\n═══════════════════════════════════════════════════════════════════");
    console.log("CURRENT MODEL vs ACTUAL (foot shots only, center angle)");
    console.log("═══════════════════════════════════════════════════════════════════");

    function currentXg(distance: number): number {
      const GOAL_HALF_WIDTH = 0.054;
      const distY = distance; // approximate for center shots
      const a1 = Math.atan2(0.5 - GOAL_HALF_WIDTH - 0.5, distY);
      const a2 = Math.atan2(0.5 + GOAL_HALF_WIDTH - 0.5, distY);
      const angle = Math.abs(a2 - a1);
      const z = 1.16 - 8.0 * distance + 2.0 * angle;
      return Math.max(0.02, Math.min(0.95, 1 / (1 + Math.exp(-z))));
    }

    console.log(`${"Distance".padEnd(28)} ${"Actual%".padStart(8)} ${"Model%".padStart(8)} ${"Delta".padStart(8)}`);
    console.log("─".repeat(55));

    for (const bucket of BUCKETS) {
      const inBucket = footShots.filter((s) => s.distance >= bucket.min && s.distance < bucket.max);
      const actual = inBucket.length > 0 ? inBucket.filter((s) => s.isGoal).length / inBucket.length : 0;
      const midDist = (bucket.min + bucket.max) / 2;
      const model = currentXg(midDist);
      const delta = actual - model;
      console.log(
        `${bucket.label.padEnd(28)} ${(actual * 100).toFixed(1).padStart(7)}% ${(model * 100).toFixed(1).padStart(7)}% ${(delta > 0 ? "+" : "") + (delta * 100).toFixed(1).padStart(6)}%`
      );
    }

    // Raw data export for further analysis
    console.log("\n═══════════════════════════════════════════════════════════════════");
    console.log("ANGLE ANALYSIS — Conversion by angle bucket (foot shots)");
    console.log("═══════════════════════════════════════════════════════════════════");

    const ANGLE_BUCKETS = [
      { label: "0-10° (tight)", min: 0, max: 10 },
      { label: "10-20°", min: 10, max: 20 },
      { label: "20-30°", min: 20, max: 30 },
      { label: "30-45°", min: 30, max: 45 },
      { label: "45-90° (wide)", min: 45, max: 90 },
    ];

    function shotAngleDeg(nx: number, ny: number): number {
      const goalY = ny < 0.5 ? 0.0 : 1.0;
      const goalX = 0.5;
      const GOAL_HALF_WIDTH = 0.054;
      const ASPECT = 105 / 68;
      const distY = Math.abs(ny - goalY) * ASPECT;
      if (distY < 0.001) return 90;
      const a1 = Math.atan2(goalX - GOAL_HALF_WIDTH - nx, distY);
      const a2 = Math.atan2(goalX + GOAL_HALF_WIDTH - nx, distY);
      return Math.abs(a2 - a1) * (180 / Math.PI);
    }

    console.log(`${"Angle Bucket".padEnd(22)} ${"Shots".padStart(6)} ${"Goals".padStart(6)} ${"Conv%".padStart(8)}`);
    console.log("─".repeat(45));

    for (const bucket of ANGLE_BUCKETS) {
      const inBucket = footShots.filter((s) => {
        const deg = shotAngleDeg(s.normalizedX, s.normalizedY);
        return deg >= bucket.min && deg < bucket.max;
      });
      const goals = inBucket.filter((s) => s.isGoal).length;
      const conv = inBucket.length > 0 ? goals / inBucket.length : 0;
      console.log(
        `${bucket.label.padEnd(22)} ${String(inBucket.length).padStart(6)} ${String(goals).padStart(6)} ${(conv * 100).toFixed(1).padStart(7)}%`
      );
    }

  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
