import { prisma } from "./prisma";

/**
 * Given a steam ID, returns all steam IDs that belong to the same person
 * (linked via iosoccer_id or, as fallback, by matching username when one
 * side has an iosoccer_id). Always includes the input steamId itself.
 */
export async function getRelatedSteamIds(steamId: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ steam_id: string }[]>`
    WITH src AS (
      SELECT steam_id, iosoccer_id, LOWER(TRIM(username)) AS uname
      FROM players
      WHERE steam_id = ${steamId}
    )
    SELECT p.steam_id
    FROM players p, src
    WHERE p.steam_id = src.steam_id
       OR (
         src.iosoccer_id IS NOT NULL
         AND p.iosoccer_id = src.iosoccer_id
       )
       OR (
         src.iosoccer_id IS NULL
         AND p.iosoccer_id IS NOT NULL
         AND LOWER(TRIM(p.username)) = src.uname
       )
  `;

  if (rows.length === 0) return [steamId];
  return rows.map((r) => r.steam_id);
}
