import { defineConfig } from 'vite';

// GitHub Pages для project-сайтов отдаёт файлы с поддиректории
// (evolzubkov.github.io/GTA_DUZ/), а не с корня — без base пути к JS/CSS и к
// раннтайм-ассетам (citypack/vehicles/citykit, см. import.meta.env.BASE_URL
// в src/config/*.js) в собранном билде были бы абсолютными от корня домена
// и не находились бы. Только для build — если включить и для dev-сервера,
// `npm run dev` перестанет открываться на localhost:8000/ (Vite ждал бы
// localhost:8000/GTA_DUZ/).
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/GTA_DUZ/' : '/',
  server: {
    port: 8000,
    open: true
  },
  build: {
    target: 'es2022'
  }
}));
