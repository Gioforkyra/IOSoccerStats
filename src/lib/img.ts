/** Proxy external images through our API to avoid hotlink blocks */
export function proxyImg(url: string | null | undefined): string | null {
  if (!url) return null;
  return `/api/img?url=${encodeURIComponent(url)}`;
}
