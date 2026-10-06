import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["Manrope", "system-ui", "sans-serif"],
        display: ["Sora", "system-ui", "sans-serif"],
        body: ["Manrope", "system-ui", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        "scroll": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "jellyfish-float": {
          "0%": { transform: "translateY(-50%) translateX(0) scale(1) rotate(0deg)" },
          "12%": { transform: "translateY(-58%) translateX(-14px) scale(1.06) rotate(-4deg)" },
          "25%": { transform: "translateY(-46%) translateX(10px) scale(0.94) rotate(3deg)" },
          "38%": { transform: "translateY(-54%) translateX(-8px) scale(1.04) rotate(-2.5deg)" },
          "50%": { transform: "translateY(-44%) translateX(12px) scale(0.96) rotate(2deg)" },
          "62%": { transform: "translateY(-56%) translateX(-10px) scale(1.05) rotate(-3deg)" },
          "75%": { transform: "translateY(-48%) translateX(8px) scale(0.97) rotate(2.5deg)" },
          "88%": { transform: "translateY(-53%) translateX(-6px) scale(1.03) rotate(-1.5deg)" },
          "100%": { transform: "translateY(-50%) translateX(0) scale(1) rotate(0deg)" },
        },
        "jellyfish-pulse": {
          "0%, 100%": { transform: "scaleY(1) scaleX(1)" },
          "40%": { transform: "scaleY(0.92) scaleX(1.05)" },
          "70%": { transform: "scaleY(1.04) scaleX(0.97)" },
        },
        "jellyfish-sway": {
          "0%, 100%": { transform: "skewX(0deg)" },
          "33%": { transform: "skewX(3deg)" },
          "66%": { transform: "skewX(-3deg)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "scroll": "scroll 30s linear infinite",
        "jellyfish-float": "jellyfish-float 7s ease-in-out infinite",
        "jellyfish-pulse": "jellyfish-pulse 2.8s ease-in-out infinite",
        "jellyfish-sway": "jellyfish-sway 5s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
