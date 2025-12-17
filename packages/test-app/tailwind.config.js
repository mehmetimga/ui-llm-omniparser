/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        poker: {
          dark: '#0a0e17',
          darker: '#060912',
          card: '#111827',
          border: '#1f2937',
          accent: '#22d3ee',
          gold: '#fbbf24',
          red: '#ef4444',
          green: '#10b981',
          purple: '#8b5cf6',
        }
      },
      fontFamily: {
        display: ['Orbitron', 'sans-serif'],
        body: ['Rajdhani', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'poker-felt': 'linear-gradient(135deg, #0a3622 0%, #052e1a 50%, #0a3622 100%)',
      },
      boxShadow: {
        'neon': '0 0 20px rgba(34, 211, 238, 0.3)',
        'neon-gold': '0 0 20px rgba(251, 191, 36, 0.3)',
        'card': '0 4px 20px rgba(0, 0, 0, 0.5)',
      }
    },
  },
  plugins: [],
}

