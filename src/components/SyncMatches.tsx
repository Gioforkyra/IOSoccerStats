"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SyncMatches() {
  const router = useRouter();

  useEffect(() => {
    fetch("/api/sync-matches")
      .then((res) => res.json())
      .then((data) => {
        if (data.inserted > 0) {
          router.refresh();
        }
      })
      .catch(() => {});
  }, [router]);

  return null;
}
