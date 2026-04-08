function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return null;
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function darkenHex(hex: string, factor = 0.75): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return (
    "#" +
    rgb
      .map((v) => Math.round(v * factor).toString(16).padStart(2, "0"))
      .join("")
  );
}

export default function Jersey({
  color,
  size = 80,
  label,
}: {
  color: string;
  size?: number;
  label?: string;
}) {
  const isWhite =
    color.trim().toLowerCase() === "white" ||
    color.trim().toLowerCase() === "#fff" ||
    color.trim().toLowerCase() === "#ffffff";

  const dark = darkenHex(isWhite ? "#cccccc" : color, 0.75);
  const textColor = isWhite ? "#111111" : "white";

  return (
    <svg
      viewBox="0 0 45 45"
      width={size}
      height={size}
      className="drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
    >
      <g transform="matrix(1.25,0,0,-1.25,0,45)">
        <g>
          <g>
            {/* Left sleeve */}
            <g transform="translate(11,34)">
              <path
                d="m 0,0 c -3,0 -11,-2 -11,-4 0,-2 1,-7 2,-9 1,-2 8,0 9,1 1,1 2,12 0,12"
                fill={color}
              />
            </g>
            <g transform="translate(1,31.2832)">
              <path
                d="m 0,0 c -0.648,-0.371 -1,-0.849 -1,-1.283 0,-2 1,-7 2,-9 0.281,-0.563 1.039,-0.778 2,-0.85 C 2,-8.283 1,-4.283 0,0"
                fill={dark}
              />
            </g>
            {/* Right sleeve */}
            <g transform="translate(25,34)">
              <path
                d="m 0,0 c 3,0 11,-2 11,-4 0,-2 -1,-7 -2,-9 -1,-2 -8,0 -9,1 -1,1 -2,12 0,12"
                fill={color}
              />
            </g>
            <g transform="translate(35,31.2832)">
              <path
                d="m 0,0 c 0.648,-0.371 1,-0.849 1,-1.283 0,-2 -1,-7 -2,-9 -0.281,-0.563 -1.039,-0.778 -2,-0.85 1,2.85 2,6.85 3,11.133"
                fill={dark}
              />
            </g>
            {/* Body */}
            <g transform="translate(25,34)">
              <path
                d="M 0,0 -1.068,0 C -1.485,-1.695 -3.979,-3 -7,-3 c -3.021,0 -5.515,1.305 -5.932,3 L -14,0 c -2.209,0 -5,-1.791 -5,-4 0,0 0,-20 -1,-24 -1,-4 1.791,-4 4,-4 l 18,0 c 2.209,0 5,0 4,4 -1,4 -1,24 -1,24 0,2.209 -2.791,4 -5,4"
                fill={color}
              />
            </g>
            {/* Collar */}
            <g transform="translate(18,29)">
              <path
                d="M 0,0 C 3.866,0 7,2.239 7,5 L 5.932,5 C 5.515,3.305 3.021,2 0,2 -3.021,2 -5.515,3.305 -5.932,5 L -7,5 C -7,2.239 -3.866,0 0,0"
                fill={dark}
              />
            </g>
          </g>
        </g>
      </g>
      {/* Position label in screen coords */}
      {label && (
        <text
          x="22.5"
          y="26"
          textAnchor="middle"
          fill={textColor}
          fontSize="12"
          fontFamily="monospace"
          fontWeight="bold"
        >
          {label}
        </text>
      )}
    </svg>
  );
}
