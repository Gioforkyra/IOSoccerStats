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
          950: "#171717",
          900: "#1c1c1c",
          800: "#232323",
          700: "#2a2a2a",
          600: "#333333",
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
          "linear-gradient(180deg, #171717 0%, #1c1c1c 40%, #1f1f1f 100%)",
      },
    },
  },
  plugins: [],
};
