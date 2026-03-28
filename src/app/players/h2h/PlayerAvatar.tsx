"use client";
import { useState } from "react";

type Props = {
  src: string | null;
  username: string;
  color: string;
};

export function PlayerAvatar({ src, username, color }: Props) {
  const [failed, setFailed] = useState(false);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={username}
        className="w-20 h-20 rounded-lg object-cover group-hover:scale-105 transition-transform"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className="w-20 h-20 rounded-lg flex items-center justify-center text-xl font-display font-800 text-chalk-100 border-2 shrink-0"
      style={{ backgroundColor: `${color}25`, borderColor: `${color}90` }}
    >
      {username.slice(0, 2).toUpperCase()}
    </div>
  );
}
