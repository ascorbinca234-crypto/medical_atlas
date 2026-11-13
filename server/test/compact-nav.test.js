'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('белая полоса удалена из атласов и их шаблонов', () => {
  for (const subject of ['biochem', 'micro', 'pathophys']) {
    for (const suffix of ['index.html', 'src/template.html']) {
      const page = read(subject + '-atlas/' + suffix);
      assert.doesNotMatch(page, /<nav aria-label="Навигация по сайту" style="position:sticky/);
      if (subject === 'biochem') {
        assert.match(page, /class="site-links"/);
        assert.match(page, /href="\.\.\/#atlases"/);
        assert.match(page, /href="\.\.\/cabinet\/"/);
        assert.match(page, /\.top\{position:sticky;top:0;height:100vh/);
      } else assert.match(page, /auth\/auth\.js\?v=20261113-nav2/);
    }
  }
});

test('компактное меню сохраняет каталог, сообщения об ошибке и повтор загрузки', () => {
  const js = read('auth/auth.js');
  assert.match(js, /#ma-topic-controls\{position:fixed/);
  assert.match(js, /catalog\.topics\.map\(function \(t\)/);
  assert.ok(js.includes("esc(SITE_URL) + '#atlases"));
  assert.ok(js.includes("esc(SITE_URL) + 'cabinet/"));
  assert.match(js, /data-topic-retry/);
  assert.match(js, /r\.status === 'error' \|\| r\.status === 'limited'/);
  for (const subject of ['farma', 'micro', 'pathophys', 'patan']) {
    assert.match(read(subject + '-atlas/index.html'), /auth\/auth\.js\?v=20261113-nav2/);
  }
});
