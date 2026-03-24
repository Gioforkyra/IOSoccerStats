"""Map the valid match ID range and full data structure."""
import httpx
import json

BASE = "https://iosoccer.com:44380/api"
HEADERS = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Origin": "https://www.iosoccer.com",
    "Referer": "https://www.iosoccer.com/",
}

def main():
    # Binary search for latest valid ID
    print("=== Finding latest match ID ===")
    lo, hi = 229806, 235000
    while lo < hi:
        mid = (lo + hi + 1) // 2
        r = httpx.get(f"{BASE}/match/{mid}", headers=HEADERS, timeout=10)
        if r.status_code == 200:
            lo = mid
            print(f"  {mid}: OK")
        else:
            hi = mid - 1
            print(f"  {mid}: {r.status_code}")
    print(f"Latest match ID: {lo}")

    # Binary search for earliest valid ID
    print("\n=== Finding earliest match ID ===")
    lo2, hi2 = 1, 10000
    while lo2 < hi2:
        mid = (lo2 + hi2) // 2
        r = httpx.get(f"{BASE}/match/{mid}", headers=HEADERS, timeout=10)
        if r.status_code == 200:
            hi2 = mid
            print(f"  {mid}: OK")
        else:
            lo2 = mid + 1
            print(f"  {mid}: not found")
    print(f"Earliest match ID: {lo2}")

    # Save a full match detail with all nested data
    print(f"\n=== Full structure of match 229806 ===")
    r = httpx.get(f"{BASE}/match/229806", headers=HEADERS, timeout=15)
    d = r.json()

    with open("full_match_229806.json", "w", encoding="utf-8") as f:
        json.dump(d, f, indent=2, ensure_ascii=False)

    # Print structure
    def print_structure(obj, prefix="", depth=0):
        if depth > 3:
            return
        if isinstance(obj, dict):
            for k, v in obj.items():
                if isinstance(v, dict):
                    print(f"{prefix}{k}: dict")
                    print_structure(v, prefix + "  ", depth + 1)
                elif isinstance(v, list):
                    print(f"{prefix}{k}: list[{len(v)}]")
                    if v and isinstance(v[0], dict):
                        print_structure(v[0], prefix + "  [0].", depth + 1)
                else:
                    val = repr(v)[:80]
                    print(f"{prefix}{k}: {type(v).__name__} = {val}")

    print_structure(d)
    print("\nSaved to full_match_229806.json")

if __name__ == "__main__":
    main()
