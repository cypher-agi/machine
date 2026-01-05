/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Machine dark theme - jet black
        machine: {
          bg: '#000000',
          surface: '#000000',
          elevated: '#0a0a0a',
          border: '#1a1a1a',
          'border-light': '#2a2a2a',
        },
        // Accent colors
        neon: {
          cyan: '#00ffff',
          'cyan-dim': '#00cccc',
          green: '#00ff88',
          'green-dim': '#00cc6a',
          orange: '#ff9500',
          'orange-dim': '#cc7700',
          red: '#ff3366',
          'red-dim': '#cc2952',
          purple: '#bf5af2',
          'purple-dim': '#9945c2',
        },
        // Status colors
        status: {
          running: '#00ff88',
          stopped: '#6e7681',
          error: '#ff3366',
          warning: '#ff9500',
          pending: '#bf5af2',
          provisioning: '#00ffff',
        },
        // Text colors
        text: {
          primary: '#e6edf3',
          secondary: '#8b949e',
          tertiary: '#6e7681',
          inverse: '#0a0e14',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'SF Mono', 'Menlo', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'neon-cyan': '0 0 20px rgba(0, 255, 255, 0.15)',
        'neon-green': '0 0 20px rgba(0, 255, 136, 0.15)',
        'glow': '0 0 40px rgba(0, 255, 255, 0.1)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'slide-in-up': 'slideInUp 0.2s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(0, 255, 255, 0.1)' },
          '100%': { boxShadow: '0 0 30px rgba(0, 255, 255, 0.2)' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideInUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}

