"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { emitPlayersNavStart } from "./PlayersNavProgress";

type PendingLinkProps = {
  href: string;
  className?: string;
  title?: string;
  children: ReactNode;
  showSpinner?: boolean;
};

export function PendingLink({ href, className, title, children, showSpinner = false }: PendingLinkProps) {
  // Local pending provides immediate feedback while route transition starts.
  const [isPending, setIsPending] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Route/query changed -> navigation completed for this link context.
    if (isPending) setIsPending(false);
  }, [pathname, searchParams, isPending]);

  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey
    ) {
      return;
    }

    if (typeof window !== "undefined") {
      const current = window.location.pathname + window.location.search;
      if (href === current) return;
    }

    setIsPending(true);
    emitPlayersNavStart();
  }

  return (
    <Link
      href={href}
      onClick={onClick}
      prefetch={false}
      className={className}
      title={title}
      aria-busy={isPending}
      data-pending={isPending ? "true" : "false"}
    >
      {children}
      {showSpinner && isPending && (
        <span
          aria-hidden="true"
          className="inline-block w-2.5 h-2.5 rounded-full border border-current border-r-transparent animate-spin ml-1"
        />
      )}
    </Link>
  );
}
