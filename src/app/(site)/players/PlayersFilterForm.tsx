"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { emitPlayersNavStart } from "./PlayersNavProgress";

type Props = {
  view: string;
  initialQuery: string;
  sortKey: string;
  dir: string;
  minApps: number;
};

export function PlayersFilterForm({ view, initialQuery, sortKey, dir, minApps }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    const q = String(formData.get("q") || "").trim();
    const sp = new URLSearchParams();
    sp.set("view", view);
    sp.set("sort", sortKey);
    sp.set("dir", dir);
    if (q) sp.set("q", q);
    if (minApps > 0) sp.set("minApps", String(minApps));
    const target = `/players?${sp.toString()}`;

    if (typeof window !== "undefined") {
      const current = window.location.pathname + window.location.search;
      if (target === current) return;
    }

    emitPlayersNavStart();
    startTransition(() => {
      router.push(target);
    });
  }

  return (
    <form action={onSubmit} className="flex items-center gap-2 flex-wrap">
      <input
        type="text"
        name="q"
        placeholder="Filter By Player Name"
        defaultValue={initialQuery}
        className="bg-pitch-800 border border-chalk-100/10 rounded px-3 py-1.5 text-sm text-chalk-100 placeholder:text-chalk-400/50 font-body focus:outline-none focus:border-[#F4119E]/50 w-52"
      />
      <button
        type="submit"
        disabled={isPending}
        className="px-3 py-1.5 text-xs font-mono rounded border border-chalk-100/10 text-chalk-300 hover:border-[#F4119E]/40 hover:text-[#F4119E] transition-colors disabled:opacity-60"
      >
        {isPending ? "LOADING..." : "FILTER"}
      </button>
      {isPending && (
        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#F4119E]">
          <span className="w-2 h-2 rounded-full border border-[#F4119E] border-r-transparent animate-spin" />
          APPLYING
        </span>
      )}
    </form>
  );
}
