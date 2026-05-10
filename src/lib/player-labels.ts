export type PlayerLabel = {
  text: string;
  sentiment: "positive" | "negative" | "neutral" | "carry" | "potm";
};

export type LabelInputs = {
  position: string | null;
  player_steam_id: string;
  profile_steam_id: string;
  minutes_played: number;
  goals: number;
  assists: number;
  shots: number;
  passes: number;
  passes_completed: number;
  key_passes: number;
  chances_created: number;
  interceptions: number;
  saves: number;
  own_goals: number;
  goals_conceded: number;
  possession: number;
};

export function getPlayerLabels(
  p: LabelInputs,
  pxg: number,
  potm: string | null,
  totalPossession: number,
  headerGoals: number,
  gkHeadersSaved: number,
): PlayerLabel[] {
  const pos = (p.position || "").toUpperCase();
  const isGK = pos === "GK";
  const isDefOrCM = pos === "LB" || pos === "CB" || pos === "RB" || pos === "CM";
  const isDefOrGK = pos === "LB" || pos === "CB" || pos === "RB" || pos === "GK";
  const isPotm = !!potm && (p.profile_steam_id === potm || p.player_steam_id === potm);

  const passPct = p.passes > 0 ? p.passes_completed / p.passes : 0;
  const possessionPct = totalPossession > 0 ? (p.possession / totalPossession) * 100 : 0;

  const positives: PlayerLabel[] = [];
  if (isGK) {
    if (p.saves >= 3 && p.saves >= p.goals_conceded * 2) {
      positives.push({ text: "Shot Stopper", sentiment: "positive" });
    }
    if (gkHeadersSaved > 2) {
      positives.push({ text: "Cross Catcher", sentiment: "positive" });
    }
  } else {
    if (p.goals === 3 || p.goals === 4) {
      positives.push({ text: "Hat-trick", sentiment: "positive" });
    }
    if ((p.goals + p.assists) >= 5) {
      positives.push({ text: "Carry", sentiment: "carry" });
    }
    const sniperCond = pxg > 0 && p.goals > pxg * 1.5;
    if (p.shots > 2 && p.goals / p.shots >= 0.65 && !sniperCond) {
      positives.push({ text: "Lethal", sentiment: "positive" });
    }
    if (sniperCond) {
      positives.push({ text: "Sniper", sentiment: "positive" });
    }
    if (headerGoals >= 2) {
      positives.push({ text: "Aerial Threat", sentiment: "positive" });
    }
    if (p.assists >= 2) {
      positives.push({ text: "Playmaker", sentiment: "positive" });
    }
    if (p.key_passes >= 3) {
      positives.push({ text: "Visionary", sentiment: "positive" });
    }
    if (p.chances_created >= 3) {
      positives.push({ text: "Threat", sentiment: "positive" });
    }
    if (p.passes >= 35 && passPct >= 0.80) {
      positives.push({ text: "Maestro", sentiment: "positive" });
    }
    if (p.interceptions >= 8) {
      positives.push({ text: "Interceptor", sentiment: "positive" });
    }
  }

  if (
    isDefOrGK &&
    ((p.goals + p.assists) >= 1 || (p.key_passes + p.chances_created) > 2)
  ) {
    positives.push({ text: "Aggressive", sentiment: "positive" });
  }

  let carry: PlayerLabel | null = null;
  if (isGK) {
    const wall =
      (p.goals_conceded <= 2 && p.saves > 5) ||
      (p.saves > 0 && p.saves >= p.goals_conceded * 4);
    if (wall) carry = { text: "Wall", sentiment: "carry" };
  } else {
    const has = (t: string) => positives.some((l) => l.text === t);
    const strikerCount = ["Hat-trick", "Playmaker", "Carry", "Aerial Threat", "Visionary"]
      .filter(has).length;
    const allRounderCount = ["Threat", "Maestro", "Interceptor", "Aggressive"]
      .filter(has).length;
    const artistCount = ["Visionary", "Threat", "Playmaker"]
      .filter(has).length;

    if (strikerCount >= 2) carry = { text: "Striker", sentiment: "carry" };
    else if (allRounderCount >= 3) carry = { text: "All Rounder", sentiment: "carry" };
    else if (artistCount >= 2) carry = { text: "Artist", sentiment: "carry" };
  }

  const negatives: PlayerLabel[] = [];
  if (p.own_goals >= 1) {
    negatives.push({ text: "Own Goal", sentiment: "negative" });
  }
  if (isGK) {
    if (p.goals_conceded >= 3 && p.goals_conceded >= p.saves * 2) {
      negatives.push({ text: "Exposed", sentiment: "negative" });
    }
  } else {
    if (
      p.goals === 0 && p.assists === 0 &&
      p.interceptions <= 2 && p.passes_completed <= 10 &&
      p.key_passes === 0 && p.minutes_played > 50
    ) {
      negatives.push({ text: "Ghost", sentiment: "negative" });
    }
    if (
      (p.goals === 0 && p.shots >= 4) ||
      (p.goals >= 1 && p.shots > 4 * p.goals)
    ) {
      negatives.push({ text: "Bad Shots", sentiment: "negative" });
    }
    if (
      possessionPct > 8 && p.goals === 0 && p.assists === 0 &&
      p.interceptions <= 4 && (p.chances_created < 2 || p.key_passes < 2)
    ) {
      negatives.push({ text: "Ball Hogger", sentiment: "negative" });
    }
    if (isDefOrCM) {
      if (p.passes > 10 && passPct < 0.60) {
        negatives.push({ text: "Bad Passes", sentiment: "negative" });
      }
      if (p.interceptions < 3 && p.minutes_played >= 50) {
        negatives.push({ text: "Low Ints", sentiment: "negative" });
      }
    }
  }

  const final: PlayerLabel[] = [];
  if (isPotm) final.push({ text: "POTM", sentiment: "potm" });

  if (carry) {
    final.push(carry);
  } else {
    for (const pos of positives) {
      if (final.length >= 2) break;
      final.push(pos);
    }
  }

  if (!isPotm) {
    for (const neg of negatives) {
      if (final.length >= 2) break;
      final.push(neg);
    }
  }

  return final.slice(0, 2);
}

export function labelClass(sentiment: PlayerLabel["sentiment"]) {
  if (sentiment === "positive")
    return "text-emerald-400 bg-emerald-950/70 border border-emerald-600/40";
  if (sentiment === "negative")
    return "text-red-400 bg-red-950/70 border border-red-600/40";
  return "text-amber-400 bg-amber-950/70 border border-amber-600/40";
}

export const TITLE_DESCRIPTIONS: Record<string, string> = {
  "POTM": "Player of the Match — the standout on the pitch.",
  "Shot Stopper": "Kept plenty of shots out.",
  "Cross Catcher": "Dominated balls coming in from above.",
  "Hat-trick": "Found the net multiple times.",
  "Carry": "Put the team on his back with goals.",
  "Lethal": "Was clinical in front of goal.",
  "Sniper": "Over-delivered on the chances he got.",
  "Aerial Threat": "Was dangerous with his head.",
  "Playmaker": "Set up teammates for goals.",
  "Visionary": "Unlocked defences with sharp passes.",
  "Threat": "Kept creating opportunities.",
  "Maestro": "Controlled the tempo with his passing.",
  "Interceptor": "Read the play and cut off moves.",
  "Aggressive": "Influenced both boxes in the match.",
  "Exposed": "Was beaten too often.",
  "Ghost": "Barely appeared in the game.",
  "Bad Shots": "Shot a lot but didn't convert.",
  "Ball Hogger": "Held the ball without producing much.",
  "Bad Passes": "Misplaced too many passes.",
  "Low Ints": "Didn't read defensive plays well.",
  "Own Goal": "Put the ball into his own net.",
  "Wall": "Was nearly impossible to beat.",
  "Striker": "Was decisive in attack across the board.",
  "Artist": "Orchestrated the offence creatively.",
  "All Rounder": "Impacted every phase of the game.",
};

export function sentimentForTitle(text: string): PlayerLabel["sentiment"] {
  if (text === "POTM") return "potm";
  if (["Striker", "All Rounder", "Artist", "Wall", "Carry"].includes(text)) return "carry";
  if (
    [
      "Exposed", "Ghost", "Bad Shots", "Ball Hogger",
      "Bad Passes", "Low Ints", "Own Goal",
    ].includes(text)
  ) return "negative";
  return "positive";
}
