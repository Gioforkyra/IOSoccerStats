const HEX_COLOR_RE = /^#([0-9a-fA-F]{6})$/;

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ];
}

export function normalizeHexColor(color: string | null | undefined, fallback = "#0f1220"): string {
  if (!color) return fallback;
  return HEX_COLOR_RE.test(color) ? color : fallback;
}

export function getCardContrastPalette(backgroundColor: string | null | undefined) {
  const bg = normalizeHexColor(backgroundColor);
  const [r, g, b] = hexToRgb(bg);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const isBright = luminance > 0.58;

  return {
    background: bg,
    isBright,
    primaryText: isBright ? "#111827" : "#ffffff",
    secondaryText: isBright ? "rgba(17,24,39,0.84)" : "rgba(243,244,246,0.92)",
    mutedText: isBright ? "rgba(17,24,39,0.7)" : "rgba(209,213,219,0.9)",
    chipBackground: isBright ? "rgba(255,255,255,0.58)" : "rgba(0,0,0,0.58)",
    chipText: isBright ? "#111827" : "#ffffff",
    accentValue: isBright ? "#4f002f" : "#ff7fd2",
  };
}
