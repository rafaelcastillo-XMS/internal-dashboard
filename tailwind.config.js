/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './app/**/*.{js,ts,jsx,tsx}',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // ── XMS Brand (SEO Dashboard) ──────────────────────────────────
        'xms-blue':        '#1A72D9',
        'xms-orange':      '#F47C20',
        'xms-black':       '#0D0D0D',
        // TailAdmin tokens (required by SEO components)
        body:              '#64748B',
        bodydark:          '#AEB7C0',
        stroke:            '#E2E8F0',
        strokedark:        '#2E3A47',
        boxdark:           '#24303F',
        'boxdark-2':       '#1A222C',
        'form-input':      '#1d2a39',
        gray:              '#EFF4FB',
        'gray-2':          '#F7F9FC',
        'meta-3':          '#10B981',
        'meta-4':          '#313D4A',
        danger:            '#D34053',
        warning:           '#FFA70B',
        // ──────────────────────────────────────────────────────────────
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
      },
      boxShadow: {
        default:   '0px 8px 13px -3px rgba(0, 0, 0, 0.07)',
        card:      '0px 1px 3px rgba(0, 0, 0, 0.12)',
        'xms-glow':'0 0 20px rgba(26, 114, 217, 0.15)',
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
