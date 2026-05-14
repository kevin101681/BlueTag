/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './**/*.{ts,tsx}',
    '!./node_modules/**',
    '!./dist/**',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
        'primary-container': 'rgb(var(--color-primary-container) / <alpha-value>)',
        'on-primary-container': 'rgb(var(--color-on-primary-container) / <alpha-value>)',
        slate: {
          850: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        surface: {
          DEFAULT: '#fdfcff',
          container: '#f0f4f8',
          variant: '#e1e6ec',
        }
      },
      fontFamily: {
        sans: ['"Google Sans Flex"', 'Outfit', 'sans-serif'],
      },
      transitionTimingFunction: {
        'gentle': 'cubic-bezier(0.2, 0, 0, 1)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out forwards',
        'slow-fade-in': 'slowFadeIn 2s ease-out forwards',
        'fade-out': 'fadeOut 0.3s ease-in forwards',
        'fade-in-up': 'fadeInUp 0.7s ease-out forwards',
        'fade-in-scale': 'fadeInScale 1.5s cubic-bezier(0.2, 0, 0, 1) forwards',
        'scale-out': 'scaleOut 0.5s cubic-bezier(0.2, 0, 0, 1) forwards',
        'expand-horizontal': 'expandHorizontal 1.5s cubic-bezier(0.2, 0, 0, 1) forwards',
        'collapse-horizontal': 'collapseHorizontal 1.5s cubic-bezier(0.2, 0, 0, 1) forwards',
        'expand-sections': 'expandSections 1.8s cubic-bezier(0.16, 1, 0.3, 1) forwards 1.0s',
        'slide-up': 'slideUp 0.8s cubic-bezier(0.2, 0.0, 0, 1.0) both',
        'slide-down': 'slideDown 1s cubic-bezier(0.2, 0.0, 0, 1.0) forwards',
        'slide-down-exit': 'slideDownExit 0.6s cubic-bezier(0.2, 0.0, 0, 1.0) forwards',
        'dialog-enter': 'dialogEnter 0.4s cubic-bezier(0.05, 0.7, 0.1, 1.0) forwards',
        'dialog-exit': 'dialogExit 0.3s cubic-bezier(0.3, 0.0, 0.8, 0.15) forwards',
        'slide-in-right': 'slideInRight 0.3s ease-out forwards',
        'slide-in-from-right': 'slideInFromRight 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-in-left': 'slideInLeft 0.3s ease-out forwards',
        'shuttle-left': 'shuttleLeft 3s infinite ease-in-out',
        'shuttle-right': 'shuttleRight 3s infinite ease-in-out',
        'scroll-bounce': 'scrollBounce 0.5s ease-out',
        'shine-right': 'shineRight 3s infinite',
        'shine-left': 'shineLeft 3s infinite',
        'breathing-glow': 'breathingGlow 3s infinite ease-in-out',
        'reveal-left': 'revealLeft 2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'pulse-border-red': 'pulseBorderRed 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slowFadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px) scale(0.95)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        fadeInScale: {
          '0%': { opacity: '0', transform: 'scale(0.8)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        scaleOut: {
          '0%': { opacity: '1', transform: 'scale(1)' },
          '100%': { opacity: '0', transform: 'scale(0.95)' },
        },
        expandHorizontal: {
          '0%': { maxWidth: '0' },
          '100%': { maxWidth: '600px' },
        },
        collapseHorizontal: {
          '0%': { maxWidth: '600px', opacity: '1' },
          '100%': { maxWidth: '0', opacity: '0', padding: '0', margin: '0' },
        },
        expandSections: {
          '0%': { opacity: '0', maxHeight: '0', transform: 'translateY(-20px)' },
          '100%': { opacity: '1', maxHeight: '2000px', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(40px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDownExit: {
          '0%': { transform: 'translateY(0)', opacity: '1' },
          '100%': { transform: 'translateY(40px)', opacity: '0' },
        },
        dialogEnter: {
          '0%': { opacity: '0', transform: 'scale(0.95) translateY(20px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        dialogExit: {
          '0%': { opacity: '1', transform: 'scale(1) translateY(0)' },
          '100%': { opacity: '0', transform: 'scale(0.95) translateY(20px)' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(50px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideInFromRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-50px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        shuttleLeft: {
          '0%, 100%': { transform: 'translateX(0)', opacity: '0.4' },
          '50%': { transform: 'translateX(-6px)', opacity: '1' },
        },
        shuttleRight: {
          '0%, 100%': { transform: 'translateX(0)', opacity: '0.4' },
          '50%': { transform: 'translateX(6px)', opacity: '1' },
        },
        scrollBounce: {
          '0%, 100%': { transform: 'translateY(0)' },
          '40%': { transform: 'translateY(12px)' },
          '80%': { transform: 'translateY(-4px)' },
        },
        shineRight: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        shineLeft: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(-100%)' },
        },
        breathingGlow: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgb(var(--color-primary) / 0)' },
          '50%': { boxShadow: '0 0 15px 0 rgb(var(--color-primary) / 0.5)' },
        },
        revealLeft: {
          '0%': { clipPath: 'inset(0 0 0 100%)' },
          '100%': { clipPath: 'inset(-50% -50% -50% -50%)' },
        },
        pulseBorderRed: {
          '0%, 100%': { borderColor: 'rgba(239, 68, 68, 0.6)', boxShadow: '0 0 0 0 rgba(239, 68, 68, 0)' },
          '50%': { borderColor: 'rgba(239, 68, 68, 1)', boxShadow: '0 0 20px 4px rgba(239, 68, 68, 0.5), 0 0 10px 2px rgba(239, 68, 68, 0.3)' },
        }
      }
    },
  },
}
