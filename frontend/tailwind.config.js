/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Orbitron", "Inter", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"]
      },
      boxShadow: {
        neon: "0 0 22px rgba(34, 211, 238, 0.28)",
        magenta: "0 0 24px rgba(236, 72, 153, 0.22)"
      }
    }
  },
  plugins: []
};
