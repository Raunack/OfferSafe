import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#F5F5F4",
        foreground: "#111827",
        border: "D1D5DB",
        muted: "#4B5563",
        card: "#FFFFFF",
        brand: "#111827",
        danger: "#B42318",
        dangerSoft: "#FEF3F2",
        warning: "#B45309",
        warningSoft: "#FEF3C7",
        success: "#166534",
        successSoft: "#DCFCE7",
      },
      borderRadius: {
        sm: "4px",
        md: "6px",
        lg: "8px",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(0, 0, 0, 0.05)",
      },
    },
  },
  plugins: [],
};

export default config;