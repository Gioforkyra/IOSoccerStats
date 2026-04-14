/**
 * Fit xG logistic model to real IOSoccer shot data.
 * Uses gradient descent on the raw shot-level data.
 *
 * Usage: npx tsx scraper/fit_xg.ts
 */

const API_BASE = "https://iosoccer.com:44380/api";
const API_HEADERS = {
  Accept: "application/json",
  Origin: "https://www.iosoccer.com",
  Referer: "https://www.iosoccer.com/",
};

type Shot = {
  distance: number;
  angle: number;
  isGoal: boolean;
  isHeader: boolean;
};

function normalizeFromField(val: number, min: number, max: number): number {
  const range = max - min;
  if (!Number.isFinite(val) || !Number.isFinite(range) || range === 0) return 0.5;
  return Math.min(1, Math.max(0, (val - min) / range));
}

function computeDistAndAngle(nx: number, ny: number): { distance: number; angle: number } {
  const goalY = ny < 0.5 ? 0.0 : 1.0;
  const goalX = 0.5;
  const GOAL_HALF_WIDTH = 0.054;
  const ASPECT = 105 / 68;
  const dx = nx - goalX;
  const dy = (ny - goalY) * ASPECT;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const distY = Math.abs(ny - goalY) * ASPECT;
  let angle = 0;
  if (distY > 0.001) {
    const a1 = Math.atan2(goalX - GOAL_HALF_WIDTH - nx, distY);
    const a2 = Math.atan2(goalX + GOAL_HALF_WIDTH - nx, distY);
    angle = Math.abs(a2 - a1);
  } else {
    angle = Math.PI;
  }
  return { distance, angle };
}

async function fetchMatchShots(matchId: number): Promise<Shot[]> {
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
    const fieldInfo = matchStats.matchInfo || {};
    const fMin = fieldInfo.fieldMin || matchStats.fieldMin;
    const fMax = fieldInfo.fieldMax || matchStats.fieldMax;
    if (!fMin || !fMax) return [];

    const shots: Shot[] = [];
    const seen = new Set<string>();
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
      const { distance, angle } = computeDistAndAngle(nx, ny);
      shots.push({ distance, angle, isGoal: evtType === "GOAL", isHeader: evt.bodyPart === 4 });
    }
    return shots;
  } catch {
    return [];
  }
}

// Logistic regression via gradient descent
function sigmoid(z: number): number {
  if (z > 20) return 1;
  if (z < -20) return 0;
  return 1 / (1 + Math.exp(-z));
}

function fitLogistic(
  shots: Shot[],
  features: (s: Shot) => number[],
  numParams: number,
  lr = 0.01,
  iterations = 50000,
): number[] {
  const params = new Array(numParams).fill(0);
  params[0] = 0.5; // bias init

  for (let iter = 0; iter < iterations; iter++) {
    const grad = new Array(numParams).fill(0);
    let loss = 0;

    for (const s of shots) {
      const feat = features(s);
      let z = 0;
      for (let j = 0; j < numParams; j++) z += params[j] * feat[j];
      const pred = sigmoid(z);
      const y = s.isGoal ? 1 : 0;
      const err = pred - y;
      loss += y * Math.log(pred + 1e-10) + (1 - y) * Math.log(1 - pred + 1e-10);
      for (let j = 0; j < numParams; j++) grad[j] += err * feat[j];
    }

    for (let j = 0; j < numParams; j++) {
      params[j] -= (lr / shots.length) * grad[j];
    }

    if (iter % 10000 === 0) {
      const avgLoss = -loss / shots.length;
      console.log(`  iter ${iter}: loss=${avgLoss.toFixed(6)}, params=[${params.map(p => p.toFixed(4)).join(", ")}]`);
    }
  }
  return params;
}

function evaluateModel(
  shots: Shot[],
  predict: (s: Shot) => number,
  label: string,
) {
  const BUCKETS = [
    { label: "0-0.05 (6-yard)", min: 0, max: 0.05 },
    { label: "0.05-0.10", min: 0.05, max: 0.10 },
    { label: "0.10-0.15", min: 0.10, max: 0.15 },
    { label: "0.15-0.20", min: 0.15, max: 0.20 },
    { label: "0.20-0.30", min: 0.20, max: 0.30 },
    { label: "0.30-0.40", min: 0.30, max: 0.40 },
    { label: "0.40-0.55", min: 0.40, max: 0.55 },
    { label: "0.55+", min: 0.55, max: 2.0 },
  ];

  console.log(`\n${label}`);
  console.log(`${"Dist".padEnd(18)} ${"N".padStart(5)} ${"Actual".padStart(8)} ${"Model".padStart(8)} ${"Δ".padStart(7)}`);
  console.log("─".repeat(50));

  for (const b of BUCKETS) {
    const inB = shots.filter((s) => s.distance >= b.min && s.distance < b.max);
    if (inB.length === 0) continue;
    const actual = inB.filter((s) => s.isGoal).length / inB.length;
    const predicted = inB.reduce((sum, s) => sum + predict(s), 0) / inB.length;
    const delta = actual - predicted;
    console.log(
      `${b.label.padEnd(18)} ${String(inB.length).padStart(5)} ${(actual * 100).toFixed(1).padStart(7)}% ${(predicted * 100).toFixed(1).padStart(7)}% ${(delta > 0 ? "+" : "") + (delta * 100).toFixed(1).padStart(5)}%`
    );
  }
}

async function main() {
  const dotenv = await import("dotenv");
  dotenv.config({ path: ".env.local" });
  const { PrismaClient } = await import("../src/generated/prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const connectionString = (process.env.DATABASE_URL || "").replace(/^["']|["']$/g, "");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    const matches = await prisma.$queryRaw<{ id: number }[]>`
      SELECT id FROM matches
      WHERE (home_score > 0 OR away_score > 0)
        AND date >= '2024-01-01'
      ORDER BY date DESC
    `;
    console.log(`Fetching shots from ${matches.length} matches...`);

    const allShots: Shot[] = [];
    const BATCH_SIZE = 50;
    for (let i = 0; i < matches.length; i += BATCH_SIZE) {
      const batch = matches.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map((m) => fetchMatchShots(m.id)));
      for (const s of results) allShots.push(...s);
      process.stdout.write(`\r  ${i + batch.length}/${matches.length} — ${allShots.length} shots`);
    }

    const footShots = allShots.filter((s) => !s.isHeader);
    const headerShots = allShots.filter((s) => s.isHeader);

    console.log(`\n\nTotal: ${allShots.length} shots (${footShots.length} foot, ${headerShots.length} header)`);
    console.log(`Foot goals: ${footShots.filter(s => s.isGoal).length} (${(footShots.filter(s => s.isGoal).length/footShots.length*100).toFixed(1)}%)`);
    console.log(`Header goals: ${headerShots.filter(s => s.isGoal).length} (${(headerShots.filter(s => s.isGoal).length/headerShots.length*100).toFixed(1)}%)`);

    // ── Model 1: Unified model with header flag ──
    // Features: [1, distance, angle, isHeader]
    console.log("\n══════════════════════════════════════════");
    console.log("FIT: Unified model (distance + angle + header)");
    console.log("══════════════════════════════════════════");

    const unifiedParams = fitLogistic(
      allShots,
      (s) => [1, s.distance, s.angle, s.isHeader ? 1 : 0],
      4,
      0.05,
      20000,
    );

    const [b0, b1, b2, b3] = unifiedParams;
    console.log(`\nFinal: z = ${b0.toFixed(4)} + ${b1.toFixed(4)}*dist + ${b2.toFixed(4)}*angle + ${b3.toFixed(4)}*isHeader`);
    console.log(`       xG = 1 / (1 + exp(-z))`);

    const unifiedPredict = (s: Shot) => {
      const z = b0 + b1 * s.distance + b2 * s.angle + b3 * (s.isHeader ? 1 : 0);
      return sigmoid(z);
    };

    evaluateModel(footShots, unifiedPredict, "UNIFIED MODEL — Foot shots");
    evaluateModel(headerShots, unifiedPredict, "UNIFIED MODEL — Header shots");

    // ── Model 2: Separate foot / header models ──
    console.log("\n══════════════════════════════════════════");
    console.log("FIT: Separate FOOT model (distance + angle)");
    console.log("══════════════════════════════════════════");

    const footParams = fitLogistic(
      footShots,
      (s) => [1, s.distance, s.angle],
      3,
      0.05,
      20000,
    );
    const [f0, f1, f2] = footParams;
    console.log(`\nFoot:   z = ${f0.toFixed(4)} + ${f1.toFixed(4)}*dist + ${f2.toFixed(4)}*angle`);

    const footPredict = (s: Shot) => sigmoid(f0 + f1 * s.distance + f2 * s.angle);
    evaluateModel(footShots, footPredict, "FOOT MODEL — Foot shots");

    console.log("\n══════════════════════════════════════════");
    console.log("FIT: Separate HEADER model (distance + angle)");
    console.log("══════════════════════════════════════════");

    const headerParams = fitLogistic(
      headerShots,
      (s) => [1, s.distance, s.angle],
      3,
      0.05,
      20000,
    );
    const [h0, h1, h2] = headerParams;
    console.log(`\nHeader: z = ${h0.toFixed(4)} + ${h1.toFixed(4)}*dist + ${h2.toFixed(4)}*angle`);

    const headerPredict = (s: Shot) => sigmoid(h0 + h1 * s.distance + h2 * s.angle);
    evaluateModel(headerShots, headerPredict, "HEADER MODEL — Header shots");

    // ── Compare old vs new ──
    console.log("\n══════════════════════════════════════════");
    console.log("COMPARISON: Old model vs New unified");
    console.log("══════════════════════════════════════════");

    const oldPredict = (s: Shot) => {
      const z = 1.16 - 8.0 * s.distance + 2.0 * s.angle;
      return Math.max(0.02, Math.min(0.95, sigmoid(z)));
    };

    evaluateModel(allShots, oldPredict, "OLD MODEL — All shots");
    evaluateModel(allShots, unifiedPredict, "NEW UNIFIED — All shots");

    // Brier score (lower = better)
    const brierOld = allShots.reduce((sum, s) => {
      const p = oldPredict(s);
      const y = s.isGoal ? 1 : 0;
      return sum + (p - y) ** 2;
    }, 0) / allShots.length;

    const brierNew = allShots.reduce((sum, s) => {
      const p = unifiedPredict(s);
      const y = s.isGoal ? 1 : 0;
      return sum + (p - y) ** 2;
    }, 0) / allShots.length;

    console.log(`\nBrier Score (lower = better):`);
    console.log(`  Old model: ${brierOld.toFixed(6)}`);
    console.log(`  New model: ${brierNew.toFixed(6)}`);
    console.log(`  Improvement: ${((1 - brierNew / brierOld) * 100).toFixed(1)}%`);

  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
