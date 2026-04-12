"""
Download all team logos locally so they can be served as Next.js static assets.

Reads distinct logo URLs from the teams table, downloads each to
public/team-logos/<sha1>.<ext>, and writes src/lib/local-logos.json mapping
the original URL -> local filename. The TS proxyImg helper uses that manifest
to short-circuit requests for known logos, eliminating /api/img invocations
(and the associated Vercel Fast Origin Transfer cost) for them.

Idempotent: skips files already on disk. Re-run after syncing new teams.

Usage:
    python scraper/download_logos.py
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import os
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

import asyncpg
import httpx
from dotenv import load_dotenv

HUB_RE = re.compile(r"(https?://[^\s]+/images/hub/)(\d+)_(sm|md|lg)\.(png|jpg|jpeg|webp)", re.IGNORECASE)

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "team-logos"
MANIFEST_PATH = ROOT / "src" / "lib" / "local-logos.json"

ALLOWED_EXTS = {"png", "jpg", "jpeg", "gif", "webp", "svg"}
CONCURRENCY = 16
TIMEOUT_SECS = 20


def filename_for(url: str) -> str:
    h = hashlib.sha1(url.encode("utf-8")).hexdigest()[:16]
    path = urlparse(url).path
    ext = path.rsplit(".", 1)[-1].lower() if "." in path else "png"
    if ext not in ALLOWED_EXTS:
        ext = "png"
    return f"{h}.{ext}"


def expand_variants(url: str) -> list[str]:
    """For a hub-style URL, return all three size variants (_sm/_md/_lg)
    alongside the original so the manifest covers whichever size a page
    helper ends up building. Non-hub URLs are returned as-is."""
    m = HUB_RE.match(url)
    if not m:
        return [url]
    prefix, img_id, _size, ext = m.group(1), m.group(2), m.group(3), m.group(4)
    return [f"{prefix}{img_id}_{s}.{ext}" for s in ("sm", "md", "lg")]


async def fetch_urls() -> list[str]:
    dsn = os.getenv("DIRECT_URL") or os.getenv("DATABASE_URL") or ""
    if not dsn:
        raise RuntimeError("DIRECT_URL or DATABASE_URL is required")
    conn = await asyncpg.connect(dsn)
    try:
        rows = await conn.fetch(
            "SELECT DISTINCT logo FROM teams WHERE logo IS NOT NULL AND logo != ''"
        )
    finally:
        await conn.close()

    raw = [r["logo"] for r in rows]
    expanded: list[str] = []
    seen: set[str] = set()
    for url in raw:
        for variant in expand_variants(url):
            if variant not in seen:
                seen.add(variant)
                expanded.append(variant)
    return expanded


async def download_one(
    client: httpx.AsyncClient, sem: asyncio.Semaphore, url: str
) -> tuple[str, str | None]:
    filename = filename_for(url)
    dest = OUT_DIR / filename
    if dest.exists() and dest.stat().st_size > 0:
        return url, filename
    async with sem:
        try:
            r = await client.get(
                url,
                headers={
                    "Referer": "https://www.iosoccer.com/",
                    "Origin": "https://www.iosoccer.com",
                    "User-Agent": "Mozilla/5.0 IOSoccerStats-logo-sync",
                },
                timeout=TIMEOUT_SECS,
                follow_redirects=True,
            )
            if r.status_code != 200 or not r.content:
                print(f"  [skip {r.status_code}] {url}")
                return url, None
            dest.write_bytes(r.content)
            return url, filename
        except Exception as e:
            print(f"  [err] {url}: {e}")
            return url, None


async def main() -> int:
    load_dotenv(ROOT / ".env.local")
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    urls = await fetch_urls()
    print(f"Found {len(urls)} distinct logo URLs")

    sem = asyncio.Semaphore(CONCURRENCY)
    async with httpx.AsyncClient() as client:
        results = await asyncio.gather(
            *(download_one(client, sem, u) for u in urls)
        )

    manifest: dict[str, str] = {}
    ok = 0
    for url, filename in results:
        if filename is not None:
            manifest[url] = filename
            ok += 1

    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(
        json.dumps(manifest, indent=2, sort_keys=True, ensure_ascii=False),
        encoding="utf-8",
    )

    print(f"Downloaded/verified {ok}/{len(urls)} logos")
    print(f"Manifest: {MANIFEST_PATH.relative_to(ROOT)}")
    print(f"Files:    {OUT_DIR.relative_to(ROOT)}/")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
