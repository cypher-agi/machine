/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Cursor-style dark theme
        cursor: {
          // Base backgrounds
          bg: '#0F1115',
          surface: '#14161C',
          elevated: '#1A1D24',
          border: '#23262F',
          'border-light': '#2D3139',
        },
        // Text colors
        text: {
          primary: '#E6E8EB',
          secondary: '#A1A6B3',
          muted: '#6B7280',
          inverse: '#0F1115',
        },
        // Accent (very limited use)
        accent: {
          blue: '#5E9EFF',
          'blue-dim': '#4A8AE8',
        },
        // Status colors (subtle)
        status: {
          success: '#4ADE80',
          warning: '#FACC15',
          error: '#F87171',
          pending: '#A78BFA',
          info: '#5E9EFF',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'SF Mono', 'Menlo', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'xs': ['12px', { lineHeight: '1.5' }],
        'sm': ['13px', { lineHeight: '1.5' }],
        'base': ['14px', { lineHeight: '1.5' }],
        'lg': ['16px', { lineHeight: '1.5' }],
        'xl': ['18px', { lineHeight: '1.4' }],
        '2xl': ['20px', { lineHeight: '1.4' }],
      },
      borderRadius: {
        'sm': '4px',
        'DEFAULT': '6px',
        'md': '6px',
        'lg': '8px',
        'xl': '10px',
      },
      animation: {
        'fade-in': 'fadeIn 100ms ease-out',
        'slide-in-right': 'slideInRight 150ms ease-out',
        'spin': 'spin 1s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(16px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
      boxShadow: {
        'sm': '0 1px 2px rgba(0, 0, 0, 0.3)',
        'DEFAULT': '0 2px 4px rgba(0, 0, 0, 0.3)',
        'md': '0 4px 8px rgba(0, 0, 0, 0.3)',
        'lg': '0 8px 16px rgba(0, 0, 0, 0.4)',
        'xl': '0 16px 32px rgba(0, 0, 0, 0.5)',
      },
    },
  },
  plugins: [],
}
