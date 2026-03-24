import { prisma } from "@/lib/prisma";

const AVATAR_TTL_MS = 60 * 60 * 1000; // 1 hour

/** Fetch avatar URL from Steam community XML profile. */
async function fetchFromSteam(steamId64: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://steamcommunity.com/profiles/${steamId64}?xml=1`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const xml = await res.text();
    const match = xml.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

/**
 * Get a player's Steam avatar, using the DB cache.
 * If the cached value is fresher than AVATAR_TTL_MS, returns it immediately.
 * Otherwise fetches from Steam, updates the DB, and returns the new URL.
 */
export async function getSteamAvatar(
  steamId: string,
  currentAvatar: string | null | undefined,
  avatarUpdatedAt: Date | null | undefined
): Promise<string | null> {
  const now = Date.now();
  const lastUpdate = avatarUpdatedAt ? new Date(avatarUpdatedAt).getTime() : 0;

  // Return cached if fresh enough
  if (currentAvatar && now - lastUpdate < AVATAR_TTL_MS) {
    return currentAvatar;
  }

  // Fetch fresh from Steam
  const freshUrl = await fetchFromSteam(steamId);

  // Update DB (fire-and-forget to not block render if it's slow)
  if (freshUrl) {
    prisma.player
      .update({
        where: { steamId },
        data: { avatar: freshUrl, avatarUpdatedAt: new Date() },
      })
      .catch(() => {}); // silently ignore DB errors
  } else if (currentAvatar) {
    // Steam failed but we have a cached one — just bump the timestamp so we don't retry every request
    prisma.player
      .update({
        where: { steamId },
        data: { avatarUpdatedAt: new Date() },
      })
      .catch(() => {});
    return currentAvatar;
  }

  return freshUrl;
}

/**
 * Batch-fetch avatars for a list of players, using DB cache.
 * Only fetches from Steam for players with stale/missing avatars.
 * Limits concurrent Steam requests to avoid rate limiting.
 */
export async function batchGetSteamAvatars(
  players: { steam_id: string; avatar: string | null; avatar_updated_at: Date | null }[]
): Promise<Map<string, string | null>> {
  const now = Date.now();
  const result = new Map<string, string | null>();
  const stale: typeof players = [];

  for (const p of players) {
    const lastUpdate = p.avatar_updated_at ? new Date(p.avatar_updated_at).getTime() : 0;
    if (p.avatar && now - lastUpdate < AVATAR_TTL_MS) {
      result.set(p.steam_id, p.avatar);
    } else {
      stale.push(p);
    }
  }

  // Fetch stale ones in parallel, max 5 at a time
  const CONCURRENCY = 5;
  for (let i = 0; i < stale.length; i += CONCURRENCY) {
    const batch = stale.slice(i, i + CONCURRENCY);
    const fetched = await Promise.all(
      batch.map(async (p) => {
        const url = await fetchFromSteam(p.steam_id);
        if (url) {
          prisma.player
            .update({
              where: { steamId: p.steam_id },
              data: { avatar: url, avatarUpdatedAt: new Date() },
            })
            .catch(() => {});
        } else if (p.avatar) {
          // Bump timestamp so we don't retry next request
          prisma.player
            .update({
              where: { steamId: p.steam_id },
              data: { avatarUpdatedAt: new Date() },
            })
            .catch(() => {});
        }
        return { steamId: p.steam_id, url: url || p.avatar };
      })
    );
    for (const f of fetched) {
      result.set(f.steamId, f.url);
    }
  }

  return result;
}
