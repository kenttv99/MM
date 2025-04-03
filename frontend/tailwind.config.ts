import type { Config } from 'tailwindcss';

// Интерфейс для параметра функции плагина
interface PluginAPI {
  addUtilities: (utilities: Record<string, Record<string, string | { [key: string]: string }>>) => void;
}

const config: Config = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [
    function({ addUtilities }: PluginAPI) {
      const newUtilities = {
        '.scrollbar-hide': {
          /* Для Firefox */
          'scrollbar-width': 'none',
          /* Для IE и Edge */
          '-ms-overflow-style': 'none',
          /* Для Chrome, Safari и Opera */
          '&::-webkit-scrollbar': {
            display: 'none'
          }
        }
      };
      addUtilities(newUtilities);
    }
  ],
};

export default config;