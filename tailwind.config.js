/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,js,ts,jsx,tsx}",
    "./dist/**/*.{html,js}"
  ],
  theme: {
    extend: {
      colors: {
        'github-dark': {
          100: '#f0f6fc',
          200: '#c9d1d9',
          300: '#8b949e',
          400: '#6e7681',
          500: '#484f58',
          600: '#30363d',
          700: '#21262d',
          800: '#161b22',
          900: '#0d1117'
        },
        'github-primary': '#58a6ff',
        'github-success': '#28a745',
        'github-error': '#f85149',
        'github-warning': '#ffc107'
      },
      backdropBlur: {
        'xs': '2px',
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}