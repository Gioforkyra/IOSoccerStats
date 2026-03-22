/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Barlow Condensed'", "sans-serif"],
        body: ["'DM Sans'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      colors: {
        pitch: {
          950: "#050810",
          900: "#080d1a",
          800: "#0d1528",
          700: "#121e38",
          600: "#1a2d52",
        },
        grass: {
          500: "#00e676",
          400: "#33ff88",
          300: "#69ffaa",
        },
        amber: {
          500: "#ffb300",
          400: "#ffca28",
        },
        chalk: {
          100: "#f0f4ff",
          200: "#c8d4f0",
          300: "#8a9dc4",
          400: "#5a6e94",
        },
      },
      backgroundImage: {
        "field-gradient":
          "linear-gradient(180deg, #050810 0%, #080d1a 40%, #0a1220 100%)",
      },
    },
  },
  plugins: [],
};
