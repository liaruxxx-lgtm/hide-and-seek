import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        abyss: "#050608",
        panel: "rgba(24, 27, 31, 0.58)",
        glass: "rgba(255, 255, 255, 0.075)",
        titanium: "#16191d",
        frost: "#eff7ff",
        mist: "#9aa5b1",
        cyanfire: "#d8f6ff",
        volt: "#edf5f8",
        hazard: "#d8aeb8",
        ember: "#d7cbb8",
        violetx: "#aab3c0"
      },
      boxShadow: {
        glow: "0 0 34px rgba(216, 246, 255, 0.14)",
        hot: "0 0 30px rgba(216, 174, 184, 0.16)",
        glass: "0 24px 80px rgba(0, 0, 0, 0.38), inset 0 1px 0 rgba(255,255,255,0.14)"
      },
      fontFamily: {
        display: ["var(--font-space)", "-apple-system", "BlinkMacSystemFont", "system-ui", "sans-serif"],
        sans: ["var(--font-inter)", "-apple-system", "BlinkMacSystemFont", "system-ui", "sans-serif"]
      },
      backgroundImage: {
        "scan-lines":
          "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px)",
        "radar-grid":
          "linear-gradient(rgba(239,247,255,0.065) 1px, transparent 1px), linear-gradient(90deg, rgba(239,247,255,0.055) 1px, transparent 1px)"
      }
    }
  },
  plugins: []
};

export default config;
