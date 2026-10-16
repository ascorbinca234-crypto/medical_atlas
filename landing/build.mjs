// Собирает стили главной страницы и вставляет их в index.html между метками /*tw:start*/ и /*tw:end*/.
// Запуск из корня репозитория:  node landing/build.mjs
// Нужен Node.js 18+ и пакет tailwindcss 4 (npm i -D tailwindcss@4). Без сети и CDN: страница получает готовый CSS.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = path.join(root, 'index.html');
const cssPath = path.join(root, 'landing', 'styles.css');

const require = createRequire(import.meta.url);
let twDir = process.env.TAILWIND_DIR;
if (!twDir) {
  try { twDir = path.resolve(path.dirname(require.resolve('tailwindcss')), '..'); }
  catch (e) { console.error('Не найден пакет tailwindcss. Установите: npm i -D tailwindcss@4'); process.exit(1); }
}
const { compile } = await import(pathToFileURL(path.join(twDir, 'dist', 'lib.mjs')).href);

const START = '/*tw:start*/', END = '/*tw:end*/';
let html = fs.readFileSync(htmlPath, 'utf8');
const a = html.indexOf(START), b = html.indexOf(END);
if (a < 0 || b < a) { console.error('В index.html нет меток ' + START + ' … ' + END); process.exit(1); }

// кандидаты в классы: все «слова» разметки и скриптов, кроме уже вставленного CSS
const source = html.slice(0, a) + html.slice(b);
const candidates = new Set(source.split(/[\s"'`<>=]+/).filter(t => t && t.length < 200));

const load = async (id, base) => {
  let file;
  if (id === 'tailwindcss') file = path.join(twDir, 'index.css');
  else if (id.startsWith('tailwindcss/')) file = path.join(twDir, id.slice('tailwindcss/'.length));
  else file = path.resolve(base, id);
  if (!file.endsWith('.css')) file += '.css';
  return { path: file, base: path.dirname(file), content: fs.readFileSync(file, 'utf8') };
};
const compiler = await compile(fs.readFileSync(cssPath, 'utf8'), { base: path.dirname(cssPath), loadStylesheet: load });
let css = compiler.build([...candidates]);

// лёгкое сжатие: убрать комментарии и лишние пробелы (строки в CSS не трогаем — их здесь нет, кроме content: "")
css = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s*\n\s*/g, '\n').replace(/\n+/g, '\n').trim();
if (css.includes('</style')) { console.error('В CSS встретилось </style'); process.exit(1); }

html = html.slice(0, a + START.length) + '\n' + css + '\n' + html.slice(b);
fs.writeFileSync(htmlPath, html);
console.log('index.html: стили обновлены,', Math.round(css.length / 1024), 'КБ CSS');
