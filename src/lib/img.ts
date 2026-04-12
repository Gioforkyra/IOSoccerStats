import localLogos from "./local-logos.json";

const LOGO_MANIFEST = localLogos as Record<string, string>;

/**
 * Resolve an external image URL to a local static asset when we have it
 * mirrored in public/team-logos (populated by scraper/download_logos.py),
 * otherwise fall back to the /api/img proxy that forwards the request with
 * the required Referer/Origin to bypass hotlink blocks.
 */
export function proxyImg(url: string | null | undefined): string | null {
  if (!url) return null;
  const local = LOGO_MANIFEST[url];
  if (local) return `/team-logos/${local}`;
  return `/api/img?url=${encodeURIComponent(url)}`;
}
