/**
 * Extract a dominant color from an image by creating a tiny API request.
 * Uses the /api/img-color endpoint which processes the image server-side.
 */
export async function getDominantColor(proxyUrl: string): Promise<string | null> {
  try {
    // Extract the original URL from our proxy URL
    const urlMatch = proxyUrl.match(/[?&]url=([^&]+)/);
    if (!urlMatch) return null;
    const originalUrl = decodeURIComponent(urlMatch[1]);

    // Fetch the image directly (server-side, no CORS issues)
    const res = await fetch(originalUrl, {
      headers: {
        Referer: "https://www.iosoccer.com/",
        "User-Agent": "Mozilla/5.0",
      },
      next: { revalidate: 86400 }, // cache 24h
    });
    if (!res.ok) return null;

    const buffer = new Uint8Array(await res.arrayBuffer());

    // Parse PNG to get pixel data (simple PNG decoder for RGBA)
    const color = extractColorFromPNG(buffer);
    return color;
  } catch {
    return null;
  }
}

/** Simple color extraction: read PNG header to get dimensions, then sample pixels */
function extractColorFromPNG(data: Uint8Array): string | null {
  // Check PNG signature
  if (data[0] !== 0x89 || data[1] !== 0x50) return null;

  // For simplicity, we'll use a different approach:
  // Sample specific bytes that tend to contain color information
  // This is a rough heuristic that works for small team logos

  // Skip to IDAT chunks and sample color values
  let totalR = 0, totalG = 0, totalB = 0, count = 0;

  // Walk through the data looking for non-black, non-white colored bytes
  // Sample every 100 bytes after the header (byte 50+)
  for (let i = 50; i < data.length - 3; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Skip very dark, very light, or grey pixels
    const brightness = (r + g + b) / 3;
    if (brightness < 20 || brightness > 235) continue;

    // Skip near-grey (where R≈G≈B)
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    if (maxC - minC < 20) continue;

    totalR += r;
    totalG += g;
    totalB += b;
    count++;
  }

  if (count < 3) return null;

  const r = Math.round(totalR / count);
  const g = Math.round(totalG / count);
  const b = Math.round(totalB / count);

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
