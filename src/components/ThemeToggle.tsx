"use client";

import { useTheme } from "@/contexts/ThemeContext";

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();

  return (
    <label className="theme-switch">
      <input
        type="checkbox"
        checked={theme === "light"}
        onChange={toggle}
        aria-label="Toggle light mode"
      />
      <span className="theme-slider">
        <span className="theme-star theme-star-1" />
        <span className="theme-star theme-star-2" />
        <span className="theme-star theme-star-3" />
        <svg className="theme-cloud" viewBox="0 0 100 60" fill="white">
          <ellipse cx="50" cy="45" rx="40" ry="15" />
          <ellipse cx="35" cy="38" rx="20" ry="18" />
          <ellipse cx="60" cy="33" rx="25" ry="22" />
        </svg>
      </span>
    </label>
  );
}
