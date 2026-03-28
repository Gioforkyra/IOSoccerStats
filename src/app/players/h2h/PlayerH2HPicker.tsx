"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface PlayerOption {
  steam_id: string;
  username: string;
  avatar: string | null;
  apps: number;
}

function PlayerSearchPanel({
  label,
  selected,
  onSelect,
  exclude,
}: {
  label: string;
  selected: PlayerOption | null;
  onSelect: (p: PlayerOption | null) => void;
  exclude: string | null;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlayerOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/players/search?q=${encodeURIComponent(query)}`);
        setResults(await res.json());
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const filtered = results.filter((r) => r.steam_id !== exclude);

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-chalk-400 mb-2 px-1">
        {label}
      </div>
      {selected ? (
        <div className="rounded-lg border border-[#F4119E]/30 bg-[#F4119E]/10 p-4 flex items-center gap-3">
          {selected.avatar ? (
            <img src={selected.avatar} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded bg-pitch-700 shrink-0 flex items-center justify-center font-display font-700 text-chalk-400 text-xs">
              {selected.username.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-body text-chalk-100 truncate">{selected.username}</div>
            <div className="text-[10px] font-mono text-chalk-500">{selected.apps} apps</div>
          </div>
          <button
            onClick={() => { onSelect(null); setQuery(""); setResults([]); }}
            className="text-chalk-500 hover:text-[#F4119E] transition-colors text-base font-mono shrink-0"
          >
            ✕
          </button>
        </div>
      ) : (
        <div className="flex flex-col">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search player by name…"
            className="w-full px-3 py-2 bg-pitch-800 border border-chalk-100/10 rounded-t text-sm text-chalk-100 placeholder-chalk-600 focus:outline-none focus:border-[#F4119E]/50"
          />
          <div className="rounded-b-lg border border-t-0 border-chalk-100/8 bg-pitch-900/40 overflow-y-auto h-[440px]">
            {query.length < 2 ? (
              <div className="text-xs font-mono text-chalk-500 text-center py-8">
                Type at least 2 characters…
              </div>
            ) : loading ? (
              <div className="text-xs font-mono text-chalk-500 text-center py-8">Searching…</div>
            ) : filtered.length === 0 ? (
              <div className="text-xs font-mono text-chalk-500 text-center py-8">No players found</div>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.steam_id}
                  onClick={() => onSelect(p)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left border-b border-chalk-100/5 last:border-b-0 hover:bg-chalk-100/5 transition-colors cursor-pointer"
                >
                  {p.avatar ? (
                    <img src={p.avatar} alt="" className="w-6 h-6 rounded object-cover shrink-0" />
                  ) : (
                    <div className="w-6 h-6 rounded bg-pitch-700 shrink-0" />
                  )}
                  <span className="text-sm font-body text-chalk-200 truncate flex-1">{p.username}</span>
                  <span className="text-[10px] font-mono text-chalk-500 shrink-0">{p.apps} apps</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function PlayerH2HPicker() {
  const router = useRouter();
  const [p1, setP1] = useState<PlayerOption | null>(null);
  const [p2, setP2] = useState<PlayerOption | null>(null);

  function handleCompare() {
    if (!p1 || !p2) return;
    router.push(`/players/h2h?p1=${encodeURIComponent(p1.steam_id)}&p2=${encodeURIComponent(p2.steam_id)}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <PlayerSearchPanel
          label="Pick Player One"
          selected={p1}
          onSelect={setP1}
          exclude={p2?.steam_id ?? null}
        />
        <PlayerSearchPanel
          label="Pick Player Two"
          selected={p2}
          onSelect={setP2}
          exclude={p1?.steam_id ?? null}
        />
      </div>
      <div className="flex justify-center">
        <button
          onClick={handleCompare}
          disabled={!p1 || !p2}
          className={`px-10 py-3 font-mono text-sm uppercase tracking-[0.22em] rounded transition-colors ${
            p1 && p2
              ? "bg-[#F4119E] text-white hover:bg-[#F4119E]/80 cursor-pointer"
              : "bg-pitch-800 text-chalk-600 cursor-not-allowed"
          }`}
        >
          Compare
        </button>
      </div>
    </div>
  );
}
