/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Sora", "Inter", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"]
      },
      colors: {
        felt: {
          900: "#06150f",
          800: "#0a2418",
          700: "#0e3624",
          600: "#0f4a30",
          500: "#136b46"
        },
        casino: {
          gold: "#fbbf24",
          goldDeep: "#b8860b",
          goldLight: "#fde68a",
          ruby: "#dc2626",
          rubyDeep: "#7f1d1d",
          royal: "#7c3aed",
          ivory: "#fdf6e3"
        }
      },
      boxShadow: {
        neon: "0 0 22px rgba(34, 211, 238, 0.28)",
        magenta: "0 0 24px rgba(236, 72, 153, 0.22)",
        gold: "0 0 28px rgba(251, 191, 36, 0.45), 0 0 10px rgba(251, 191, 36, 0.6) inset",
        goldSoft: "0 0 20px rgba(251, 191, 36, 0.3)",
        ruby: "0 0 28px rgba(220, 38, 38, 0.4)",
        emeraldGlow: "0 0 24px rgba(16, 185, 129, 0.45)",
        chip: "0 6px 0 rgba(0,0,0,0.45), 0 10px 16px rgba(0,0,0,0.6)",
        cardLift: "0 12px 28px rgba(0,0,0,0.55), 0 2px 0 rgba(255,255,255,0.6) inset"
      },
      backgroundImage: {
        "felt-radial":
          "radial-gradient(ellipse at center, #136b46 0%, #0f4a30 45%, #0a2418 100%)",
        "gold-gradient":
          "linear-gradient(135deg, #fde68a 0%, #fbbf24 35%, #b8860b 70%, #fbbf24 100%)",
        "ruby-gradient":
          "linear-gradient(135deg, #f87171 0%, #dc2626 50%, #7f1d1d 100%)",
        "royal-gradient":
          "linear-gradient(135deg, #a78bfa 0%, #7c3aed 50%, #4c1d95 100%)"
      },
      keyframes: {
        sparkle: {
          "0%, 100%": { opacity: "0.2", transform: "scale(0.8)" },
          "50%": { opacity: "1", transform: "scale(1.2)" }
        },
        "coin-fall": {
          "0%": { transform: "translateY(-120%) rotate(0deg)", opacity: "0" },
          "10%": { opacity: "1" },
          "90%": { opacity: "1" },
          "100%": { transform: "translateY(640%) rotate(720deg)", opacity: "0" }
        },
        "victory-pulse": {
          "0%, 100%": {
            transform: "scale(1)",
            filter: "drop-shadow(0 0 18px rgba(251,191,36,0.7))"
          },
          "50%": {
            transform: "scale(1.04)",
            filter: "drop-shadow(0 0 38px rgba(251,191,36,1))"
          }
        },
        "defeat-shake": {
          "0%, 100%": { transform: "translateX(0)" },
          "20%": { transform: "translateX(-6px)" },
          "40%": { transform: "translateX(6px)" },
          "60%": { transform: "translateX(-4px)" },
          "80%": { transform: "translateX(4px)" }
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" }
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 18px rgba(251,191,36,0.4)" },
          "50%": { boxShadow: "0 0 36px rgba(251,191,36,0.85)" }
        },
        "bounce-in": {
          "0%": { transform: "scale(0.3) rotate(-12deg)", opacity: "0" },
          "60%": { transform: "scale(1.12) rotate(4deg)", opacity: "1" },
          "100%": { transform: "scale(1) rotate(0deg)", opacity: "1" }
        },
        "slide-up-fade": {
          "0%": { transform: "translateY(14px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" }
        },
        "deal-card": {
          "0%": { transform: "translateY(-40px) rotate(-8deg)", opacity: "0" },
          "100%": { transform: "translateY(0) rotate(0)", opacity: "1" }
        },
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" }
        },
        "ring-spin": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" }
        },
        "chip-bounce": {
          "0%": { transform: "translateY(-200%) scale(0.6)", opacity: "0" },
          "60%": { transform: "translateY(8%) scale(1.05)", opacity: "1" },
          "100%": { transform: "translateY(0) scale(1)", opacity: "1" }
        },
        "deal-in": {
          "0%": { transform: "translate(60px, -130px) rotate(-18deg) scale(0.85)", opacity: "0" },
          "60%": { opacity: "1" },
          "100%": { transform: "translate(0, 0) rotate(var(--card-rot, 0deg)) scale(1)", opacity: "1" }
        },
        "card-flip": {
          "0%": { transform: "rotateY(90deg) scale(0.92)", opacity: "0" },
          "100%": { transform: "rotateY(0) scale(1)", opacity: "1" }
        },
        "turn-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(251,191,36,0.5), 0 0 22px rgba(251,191,36,0.32)" },
          "50%": { boxShadow: "0 0 0 7px rgba(251,191,36,0), 0 0 34px rgba(251,191,36,0.6)" }
        },
        "count-pop": {
          "0%": { transform: "scale(1)" },
          "35%": { transform: "scale(1.18)" },
          "100%": { transform: "scale(1)" }
        },
        "float-soft": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" }
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.8)", opacity: "0.7" },
          "100%": { transform: "scale(1.7)", opacity: "0" }
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" }
        },
        "pop-in": {
          "0%": { transform: "scale(0.6)", opacity: "0" },
          "70%": { transform: "scale(1.08)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" }
        }
      },
      animation: {
        sparkle: "sparkle 1.6s ease-in-out infinite",
        "coin-fall": "coin-fall 2.4s linear infinite",
        "victory-pulse": "victory-pulse 1.4s ease-in-out infinite",
        "defeat-shake": "defeat-shake 0.5s ease-in-out",
        shimmer: "shimmer 2.6s linear infinite",
        "glow-pulse": "glow-pulse 1.8s ease-in-out infinite",
        "bounce-in": "bounce-in 0.5s cubic-bezier(.34,1.56,.64,1) forwards",
        "slide-up-fade": "slide-up-fade 0.35s ease-out forwards",
        "deal-card": "deal-card 0.35s ease-out forwards",
        "spin-slow": "spin-slow 12s linear infinite",
        "ring-spin": "ring-spin 6s linear infinite",
        "chip-bounce": "chip-bounce 0.55s cubic-bezier(.34,1.56,.64,1) forwards",
        "deal-in": "deal-in 0.42s cubic-bezier(.22,1.2,.36,1) forwards",
        "card-flip": "card-flip 0.45s cubic-bezier(.4,0,.2,1) forwards",
        "turn-pulse": "turn-pulse 1.8s ease-in-out infinite",
        "count-pop": "count-pop 0.4s ease-out",
        "float-soft": "float-soft 4s ease-in-out infinite",
        "pulse-ring": "pulse-ring 1.6s ease-out infinite",
        "fade-in": "fade-in 0.3s ease-out forwards",
        "pop-in": "pop-in 0.4s cubic-bezier(.34,1.56,.64,1) forwards"
      }
    }
  },
  plugins: []
};
