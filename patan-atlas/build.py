#!/usr/bin/env python3
"""Build public patan-atlas (first 2 lessons open: norma, necrosis, infarction) and per-topic protected packages."""
import argparse, hashlib, json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
DEMO_IDS = ['norma', 'necrosis', 'infarction']
HERO_IDS = ['tb-granuloma', 'nutmeg-liver', 'amyloid-spleen', 'myocardial-infarct', 'lobar-pneumonia', 'squamous-carcinoma']


def enc_json(obj):
    return json.dumps(obj, ensure_ascii=False, separators=(',', ':')).replace('</script', '<\\/script')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--full', action='store_true')
    parser.parse_args()

    src_html = (ROOT / 'src/full.html').read_text(encoding='utf-8')

    m_data = re.search(r'<script id="patan-data">\s*window\.PATAN_DATA\s*=\s*(\{.*?\});\s*</script>', src_html, re.S)
    if not m_data:
        raise SystemExit('Could not find window.PATAN_DATA in src/full.html')
    full_data = json.loads(m_data.group(1))
    topics = full_data['topics']
    assert len(topics) == 26, f'Expected 26 topics, got {len(topics)}'

    catalog = {
        'topics': [{'id': t['id'], 'title': t['title']} for t in topics],
        'aliases': {},
        'demo': DEMO_IDS,
        'publicRoutes': ['diag', 'method'],
    }
    (ROOT / 'topics.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    # Calculate global totals and hero-strip preview items from the full dataset
    kaf_micro_count = 0
    extra_micro_count = 0
    macro_count = 0
    em_count = 0
    schemes_count = 0
    quiz_count = 0
    hero_map = {}

    for t in topics:
        for m in t.get('micro') or []:
            if m.get('kaf'):
                kaf_micro_count += 1
            else:
                extra_micro_count += 1
            if m.get('id') in HERO_IDS:
                hero_map[m['id']] = {
                    'id': m['id'],
                    'topic': t['id'],
                    'key': f"{t['id']}--{m['id']}",
                    'name': m['name'],
                    'draw': m.get('draw'),
                    'kaf': m.get('kaf') or [],
                }
        macro_count += len(t.get('macro') or [])
        em_count += len(t.get('em') or [])
        schemes_count += len(t.get('schemes') or [])
        quiz_count += len(t.get('quiz') or [])

    totals = {
        'kafMicro': kaf_micro_count,
        'extraMicro': extra_micro_count,
        'macro': macro_count,
        'em': em_count,
        'schemes': schemes_count,
        'quiz': quiz_count,
    }
    hero_pick = [hero_map[hid] for hid in HERO_IDS if hid in hero_map]

    # Write per-topic packages to server/content/topics/patan/ and patan-atlas/topics/
    server_dest = REPO / 'server/content/topics/patan'
    local_dest = ROOT / 'topics'
    server_dest.mkdir(parents=True, exist_ok=True)
    local_dest.mkdir(parents=True, exist_ok=True)

    manifest = {'policy': 'topic-delivery-v1', 'topics': {}}
    for t in topics:
        t_full = dict(t)
        t_full['locked'] = False
        code = (
            '(function(){var d=window.PATAN_DATA;if(d&&Array.isArray(d.topics)){'
            'var t=' + enc_json(t_full) + ';'
            'var i=d.topics.findIndex(function(x){return x.id===t.id;});'
            'if(i>=0)d.topics[i]=t;else d.topics.push(t);'
            '}})();\n'
        )
        raw_bytes = code.encode('utf-8')
        (server_dest / f"{t['id']}.js").write_bytes(raw_bytes)
        (local_dest / f"{t['id']}.js").write_bytes(raw_bytes)
        manifest['topics'][t['id']] = {
            'sha256': hashlib.sha256(raw_bytes).hexdigest(),
            'bytes': len(raw_bytes),
        }

    (server_dest / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')

    # Build public PATAN_DATA: only DEMO_IDS (first 2 lessons: 0 and 1) are open; remaining 23 are locked stubs
    public_topics = []
    for t in topics:
        micro_list = t.get('micro') or []
        kaf_list = [m for m in micro_list if m.get('kaf')]
        extra_list = [m for m in micro_list if not m.get('kaf')]
        counts = {
            'kaf': len(kaf_list),
            'extra': len(extra_list),
            'macro': len(t.get('macro') or []),
            'em': len(t.get('em') or []),
            'schemes': len(t.get('schemes') or []),
            'quiz': len(t.get('quiz') or []),
        }
        cover_m = next((m for m in kaf_list if m.get('draw')), micro_list[0] if micro_list else None)
        cover_stub = {
            'id': cover_m['id'],
            'topic': t['id'],
            'key': f"{t['id']}--{cover_m['id']}",
            'name': cover_m['name'],
            'draw': cover_m.get('draw'),
            'kaf': cover_m.get('kaf') or [],
        } if cover_m else None

        if t['id'] in DEMO_IDS:
            t_pub = dict(t)
            t_pub['locked'] = False
            t_pub['_counts'] = counts
            t_pub['_cover'] = cover_stub
            public_topics.append(t_pub)
        else:
            public_topics.append({
                'id': t['id'],
                'lesson': t['lesson'],
                'title': t['title'],
                'sub': t.get('sub', ''),
                'tags': [],
                'locked': True,
                '_counts': counts,
                '_cover': cover_stub,
                'def': '',
                'blocks': [],
                'tables': [],
                'schemes': [],
                'micro': [],
                'macro': [],
                'em': [],
                'quiz': [],
            })

    public_data = {
        'lessons': full_data['lessons'],
        'topics': public_topics,
        'totals': totals,
        'heroPick': hero_pick,
    }

    out_html = src_html
    # 1. Update window.MA_TOPICS
    out_html = re.sub(
        r'<script>window\.MA_TOPICS=.*?;</script>',
        lambda _: f'<script>window.MA_TOPICS={enc_json(catalog)};</script>',
        out_html,
        count=1,
    )
    # 2. Replace window.PATAN_DATA with public_data
    out_html = re.sub(
        r'<script id="patan-data">\s*window\.PATAN_DATA\s*=\s*\{.*?\};\s*</script>',
        lambda _: f'<script id="patan-data">\nwindow.PATAN_DATA={enc_json(public_data)};\n</script>',
        out_html,
        count=1,
        flags=re.S,
    )

    # 3. Patch patan-app for locked topics, progress reporting, and account widget
    old_report = '''  function report() {
    try {
      if (window.MAP && typeof window.MAP.sections === "function") {
        window.MAP.sections(ATLAS, TOPICS.map(function (t) {
          return { id: t.id, n: t.title, total: 1, learned: S.done[t.id] ? 1 : 0, seen: S.seen[t.id] ? 1 : 0, locked: false };
        }));
      }
    } catch (e) {}
  }
  function card(ok) { try { if (window.MAP && typeof window.MAP.card === "function") window.MAP.card({ ok: !!ok }); } catch (e) {} }'''

    new_report = '''  function hasAccess() {
    return !!(window.MA && typeof window.MA.hasAtlasAccess === "function" && window.MA.hasAtlasAccess(ATLAS));
  }
  function isLocked(t) {
    return !!(t && t.locked && !hasAccess());
  }
  function report() {
    try {
      if (window.MAP && typeof window.MAP.sections === "function") {
        window.MAP.sections(ATLAS, TOPICS.map(function (t) {
          return { id: t.id, n: t.title, total: 1, learned: S.done[t.id] ? 1 : 0, seen: S.seen[t.id] ? 1 : 0, locked: isLocked(t) };
        }));
      }
    } catch (e) {}
  }
  function card(ok) { try { if (window.MAP && typeof window.MAP.card === "function") window.MAP.card({ atlas: ATLAS, ok: !!ok }); } catch (e) {} }'''
    assert old_report in out_html, 'old_report not found'
    out_html = out_html.replace(old_report, new_report, 1)

    old_icon = '''    check: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m5 12 5 5 9-10"/></svg>'
  };'''
    new_icon = '''    check: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m5 12 5 5 9-10"/></svg>',
    lock: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>'
  };'''
    assert old_icon in out_html, 'old_icon not found'
    out_html = out_html.replace(old_icon, new_icon, 1)

    out_html = out_html.replace("'<span id=\"login\"></span>'", "'<span id=\"login\" data-ma-acct></span>'", 1)
    old_login_iife = '''  (function login() {
    try {
      if (window.MA && typeof window.MA.signedIn === "function" && !window.MA.signedIn() && typeof window.MA.loginUrl === "function") {
        $("#login").innerHTML = '<a class="pa-btn hide-sm" href="' + esc(window.MA.loginUrl()) + '">Войти</a>';
      }
    } catch (e) {}
  })();'''
    new_login_iife = '''  (function login() {
    try {
      if (window.MA && typeof window.MA.mount === "function") {
        window.MA.mount(document.querySelectorAll("[data-ma-acct]"));
      } else if (window.MA && typeof window.MA.signedIn === "function" && !window.MA.signedIn() && typeof window.MA.loginUrl === "function") {
        $("#login").innerHTML = '<a class="pa-btn hide-sm" href="' + esc(window.MA.loginUrl()) + '">Войти</a>';
      }
    } catch (e) {}
  })();'''
    assert old_login_iife in out_html, 'old_login_iife not found'
    out_html = out_html.replace(old_login_iife, new_login_iife, 1)

    old_nav_loop = '''      items.forEach(function (x) {
        var t = x.t, st = S.done[t.id] ? "done" : S.seen[t.id] ? "seen" : "";
        html += '<a class="nav-item' + (current === t.id ? " is-active" : "") + '" href="#' + t.id + '"><span class="nav-dot ' + st + '"></span><span class="lbl">' + hl(t.title, q) +
          (x.m.hit ? '<br><small style="color:var(--nav-ink-2)">' + hl(x.m.hit, q) + '</small>' : "") + '</span>' +
          (S.quiz[t.id] ? '<span class="badge">' + S.quiz[t.id].best + '/' + t.quiz.length + '</span>' : "") + '</a>';
      });'''
    new_nav_loop = '''      items.forEach(function (x) {
        var t = x.t, locked = isLocked(t), st = S.done[t.id] ? "done" : S.seen[t.id] ? "seen" : "";
        var qLen = t._counts ? t._counts.quiz : (t.quiz || []).length;
        html += '<a class="nav-item' + (current === t.id ? " is-active" : "") + '" href="#' + t.id + '" style="' + (locked ? "opacity:.78" : "") + '"><span class="nav-dot ' + st + '"></span><span class="lbl">' + hl(t.title, q) +
          (x.m.hit ? '<br><small style="color:var(--nav-ink-2)">' + hl(x.m.hit, q) + '</small>' : "") + '</span>' +
          (locked ? '<span class="badge" title="Доступно по подписке" style="display:inline-flex;align-items:center;padding:2px 6px">' + ICON.lock + '</span>' : (S.quiz[t.id] && qLen ? '<span class="badge">' + S.quiz[t.id].best + '/' + qLen + '</span>' : "")) + '</a>';
      });'''
    assert old_nav_loop in out_html, 'old_nav_loop not found'
    out_html = out_html.replace(old_nav_loop, new_nav_loop, 1)

    old_mbykey = '  var MBYKEY = {}; ALL_MICRO.forEach(function (m) { MBYKEY[m.key] = m; });'
    new_mbykey = '  var MBYKEY = {}; ALL_MICRO.forEach(function (m) { MBYKEY[m.key] = m; }); TOPICS.forEach(function (t) { if (t._cover && t._cover.key && !MBYKEY[t._cover.key]) MBYKEY[t._cover.key] = t._cover; }); (DATA.heroPick || []).forEach(function (m) { if (m && m.key && !MBYKEY[m.key]) MBYKEY[m.key] = m; });'
    assert old_mbykey in out_html, 'old_mbykey not found'
    out_html = out_html.replace(old_mbykey, new_mbykey, 1)

    old_home = '''    var first = TOPICS[0], nSch = TOPICS.reduce(function (s, t) { return s + (t.schemes || []).length; }, 0);
    var hero = KAF_MICRO.filter(function (m) { return m.draw; }).slice(0);
    var pick = ["tb-granuloma", "nutmeg-liver", "amyloid-spleen", "myocardial-infarct", "lobar-pneumonia", "squamous-carcinoma"].map(function (id) { return ALL_MICRO.filter(function (m) { return m.id === id; })[0]; }).filter(Boolean);
    var html = '<div class="pa-gutter"><div class="pa-wrap" style="padding-top:28px">' +
      '<div class="eyebrow">Общая патологическая анатомия · 3 курс · ПСПбГМУ</div>' +
      '<h1 class="h1" style="margin-top:8px">Атлас патологической анатомии</h1>' +
      '<p class="lead">' + SECTIONS.length + ' занятий осеннего семестра, ' + TOPICS.length + ' тем. В каждой теме — паспорт, подробный конспект, схемы процессов, микропрепараты кафедры со схематичными рисунками в цветах окраски, макропрепараты, электронограммы и тест.</p>' +
      '<div class="cta"><a class="pa-btn pa-btn-primary" href="#' + first.id + '">Начать: ' + esc(first.title.toLowerCase()) + '</a><a class="pa-btn" href="#diag">Диагностикум · ' + plural(KAF_MICRO.length, "препарат", "препарата", "препаратов") + ' кафедры</a><a class="pa-btn" href="#method">Окраски</a></div>' +
      '<div class="hero-strip">' + pick.map(function (m) { return '<a href="#' + m.topic + '--mp-' + m.id + '" title="' + esc(m.name) + '">' + thumb(m, "hs-img") + '<span>' + esc(m.name.split(" (")[0]) + '</span></a>'; }).join("") + '</div>' +
      '<div class="card stats">' +
        stat(done + "/" + TOPICS.length, "тем изучено") + stat(acc, "точность тестов (лучшие попытки)") + stat(S.diag.total ? Math.round(100 * S.diag.right / S.diag.total) + "%" : "—", "диагностикум: " + S.diag.right + " из " + S.diag.total) +
        stat(KAF_MICRO.length + " + " + (ALL_MICRO.length - KAF_MICRO.length), "микропрепаратов: перечень кафедры + дополнительные") + stat(ALL_MACRO.length + " · " + ALL_EM.length, "макропрепаратов · электронограмм") + stat(nSch + " · " + QCOUNT, "схем процессов · вопросов") +
      '</div>';
    SECTIONS.forEach(function (sec) {
      var ts = TOPICS.filter(function (t) { return t.sec === sec.id; });
      if (!ts.length) return;
      html += '<div class="section"><div class="section-head"><h2 class="h2">' + esc(sec.title) + '</h2><span class="note">' + plural(ts.length, "тема", "темы", "тем") + '</span></div><div class="topic-grid">';
      ts.forEach(function (t) {
        var st = S.done[t.id] ? '<span class="status done">изучено</span>' : S.seen[t.id] ? '<span class="status seen">начато</span>' : "";
        var cover = t.micro.filter(function (m) { return m.kaf.length && m.draw; })[0] || t.micro[0];
        html += '<a class="card tcard' + (cover ? " has-cover" : "") + '" href="#' + t.id + '">' + (cover ? '<div class="tcover">' + thumb(cover, "tc-img") + '</div>' : "") + '<div class="tbody"><div class="tt"><span class="tn">' + t.n + '</span><div style="flex:1;min-width:0"><div class="ti">' + esc(t.title) + '</div><div class="ts">' + esc(t.sub) + '</div></div>' + st + '</div>' +
          '<div class="tm"><span>микро · ' + t.micro.filter(function (m) { return m.kaf.length; }).length + (t.micro.some(function (m) { return !m.kaf.length; }) ? " + " + t.micro.filter(function (m) { return !m.kaf.length; }).length : "") + '</span><span>макро · ' + (t.macro || []).length + '</span><span>схем · ' + (t.schemes || []).length + '</span><span>тест · ' + t.quiz.length + (S.quiz[t.id] ? " (" + S.quiz[t.id].best + ")" : "") + '</span></div></div></a>';
      });'''

    new_home = '''    var tot = DATA.totals || { kafMicro: KAF_MICRO.length, extraMicro: ALL_MICRO.length - KAF_MICRO.length, macro: ALL_MACRO.length, em: ALL_EM.length, schemes: TOPICS.reduce(function (s, t) { return s + (t.schemes || []).length; }, 0), quiz: QCOUNT };
    var first = TOPICS[0], nSch = tot.schemes;
    var pick = (DATA.heroPick && DATA.heroPick.length) ? DATA.heroPick : ["tb-granuloma", "nutmeg-liver", "amyloid-spleen", "myocardial-infarct", "lobar-pneumonia", "squamous-carcinoma"].map(function (id) { return ALL_MICRO.filter(function (m) { return m.id === id; })[0]; }).filter(Boolean);
    var html = '<div class="pa-gutter"><div class="pa-wrap" style="padding-top:28px">' +
      '<div class="eyebrow">Общая патологическая анатомия · 3 курс · ПСПбГМУ</div>' +
      '<h1 class="h1" style="margin-top:8px">Атлас патологической анатомии</h1>' +
      '<p class="lead">' + SECTIONS.length + ' занятий осеннего семестра, ' + TOPICS.length + ' тем. В каждой теме — паспорт, подробный конспект, схемы процессов, микропрепараты кафедры со схематичными рисунками в цветах окраски, макропрепараты, электронограммы и тест. Первые два занятия (Занятие 0 «Вспомним норму» и Занятие 1 «Некроз. Апоптоз. Инфаркт») открыты всем без подписки.</p>' +
      '<div class="cta"><a class="pa-btn pa-btn-primary" href="#' + first.id + '">Начать: ' + esc(first.title.toLowerCase()) + '</a><a class="pa-btn" href="#diag">Диагностикум · ' + plural(tot.kafMicro, "препарат", "препарата", "препаратов") + ' кафедры</a><a class="pa-btn" href="#method">Окраски</a></div>' +
      '<div class="hero-strip">' + pick.map(function (m) { return '<a href="#' + m.topic + '--mp-' + m.id + '" title="' + esc(m.name) + '">' + thumb(m, "hs-img") + '<span>' + esc(m.name.split(" (")[0]) + '</span></a>'; }).join("") + '</div>' +
      '<div class="card stats">' +
        stat(done + "/" + TOPICS.length, "тем изучено") + stat(acc, "точность тестов (лучшие попытки)") + stat(S.diag.total ? Math.round(100 * S.diag.right / S.diag.total) + "%" : "—", "диагностикум: " + S.diag.right + " из " + S.diag.total) +
        stat(tot.kafMicro + " + " + tot.extraMicro, "микропрепаратов: перечень кафедры + дополнительные") + stat(tot.macro + " · " + tot.em, "макропрепаратов · электронограмм") + stat(nSch + " · " + tot.quiz, "схем процессов · вопросов") +
      '</div>';
    SECTIONS.forEach(function (sec) {
      var ts = TOPICS.filter(function (t) { return t.sec === sec.id; });
      if (!ts.length) return;
      html += '<div class="section"><div class="section-head"><h2 class="h2">' + esc(sec.title) + '</h2><span class="note">' + plural(ts.length, "тема", "темы", "тем") + '</span></div><div class="topic-grid">';
      ts.forEach(function (t) {
        var locked = isLocked(t);
        var st = locked
          ? '<span class="status" style="display:inline-flex;align-items:center;gap:4px">' + ICON.lock + 'по подписке</span>'
          : S.done[t.id] ? '<span class="status done">изучено</span>' : S.seen[t.id] ? '<span class="status seen">начато</span>' : (!hasAccess() && t.lesson <= 1 ? '<span class="status seen">открыто</span>' : "");
        var cover = t.micro.filter(function (m) { return m.kaf.length && m.draw; })[0] || t.micro[0] || t._cover;
        var cKaf = t._counts ? t._counts.kaf : t.micro.filter(function (m) { return m.kaf.length; }).length;
        var cExtra = t._counts ? t._counts.extra : t.micro.filter(function (m) { return !m.kaf.length; }).length;
        var cMacro = t._counts ? t._counts.macro : (t.macro || []).length;
        var cSch = t._counts ? t._counts.schemes : (t.schemes || []).length;
        var cQuiz = t._counts ? t._counts.quiz : (t.quiz || []).length;
        html += '<a class="card tcard' + (cover ? " has-cover" : "") + '" href="#' + t.id + '">' + (cover ? '<div class="tcover">' + thumb(cover, "tc-img") + '</div>' : "") + '<div class="tbody"><div class="tt"><span class="tn">' + t.n + '</span><div style="flex:1;min-width:0"><div class="ti">' + esc(t.title) + '</div><div class="ts">' + esc(t.sub) + '</div></div>' + st + '</div>' +
          '<div class="tm"><span>микро · ' + cKaf + (cExtra ? " + " + cExtra : "") + '</span><span>макро · ' + cMacro + '</span><span>схем · ' + cSch + '</span><span>тест · ' + cQuiz + (S.quiz[t.id] ? " (" + S.quiz[t.id].best + ")" : "") + '</span></div></div></a>';
      });'''
    assert old_home in out_html, 'old_home not found'
    out_html = out_html.replace(old_home, new_home, 1)

    old_render_topic = '''  function renderTopic(t, sub) {
    crumbs(t.title);
    if (!S.seen[t.id]) { S.seen[t.id] = true; save(); }
    var sec = SECTIONS.filter(function (s) { return s.id === t.sec; })[0];'''

    new_render_topic = '''  function renderTopic(t, sub) {
    crumbs(t.title);
    var sec = SECTIONS.filter(function (s) { return s.id === t.sec; })[0];
    if (isLocked(t)) {
      var toneL = lessonTone(t.lesson);
      var authState = window.MA_STATE && window.MA_STATE.auth;
      var retry = authState === "error" || authState === "limited";
      var signed = !!(window.MA && typeof window.MA.signedIn === "function" && window.MA.signedIn());
      var loginHref = signed ? SITE + "auth/#account" : (window.MA && typeof window.MA.loginUrl === "function" ? window.MA.loginUrl() : SITE + "auth/");
      view.innerHTML =
        '<div class="pa-gutter" data-patan-locked="true"><div class="pa-wrap" style="padding-top:36px;max-width:760px">' +
          '<div class="card pad" style="padding:28px;border-radius:18px">' +
            '<div class="t-head" style="margin-bottom:16px">' +
              '<div class="t-tile tone-' + toneL + '" aria-hidden="true"><small>занятие</small><b>' + t.lesson + '</b></div>' +
              '<div class="t-ttl">' +
                '<div class="eyebrow">' + esc(sec ? sec.title : "Занятие " + t.lesson) + '</div>' +
                '<h1 class="h1" style="margin-top:4px">' + esc(t.title) + '</h1>' +
                (t.sub ? '<p class="lead">' + esc(t.sub) + '</p>' : '') +
              '</div>' +
            '</div>' +
            '<p style="font-size:15px;line-height:1.6;color:var(--ink-2);margin:14px 0 0">' +
              (retry
                ? "Не удалось загрузить тему. Проверьте соединение и повторите попытку."
                : "Эта тема доступна по подписке на патологическую анатомию. Два первых занятия (Занятие 0 «Вспомним норму» и Занятие 1 «Некроз. Апоптоз. Инфаркт») открыты всем без подписки.") +
            '</p>' +
            '<div class="cta" style="margin-top:22px;display:flex;flex-wrap:wrap;gap:10px">' +
              (retry
                ? '<button type="button" class="pa-btn pa-btn-primary" id="retryLockedBtn">Повторить загрузку</button>'
                : '<a class="pa-btn pa-btn-primary" href="' + esc(loginHref) + '">' + (signed ? "Мой аккаунт и подписка" : "Войти в аккаунт") + '</a>') +
              '<a class="pa-btn" href="#norma">Открыть занятие 0 (Норма)</a>' +
              '<a class="pa-btn" href="#necrosis">Открыть занятие 1 (Некроз)</a>' +
            '</div>' +
          '</div>' +
          footer() +
        '</div></div>';
      var rb = $("#retryLockedBtn");
      if (rb) rb.onclick = function () { location.reload(); };
      return;
    }
    if (!S.seen[t.id]) { S.seen[t.id] = true; save(); }
    try {
      if (window.MAP && typeof window.MAP.last === "function") {
        window.MAP.last({ atlas: ATLAS, title: t.title, sub: sec ? sec.title : "Патанатомия", url: location.href });
      }
    } catch (e) {}'''
    assert old_render_topic in out_html, 'old_render_topic not found'
    out_html = out_html.replace(old_render_topic, new_render_topic, 1)

    # 4. Enable bootAtlas('patan', 'patan-app') and include anti-theft-guard.js
    old_boot = '''<script>
/* По умолчанию атлас запускается сам. Когда на сервере появится доставка тем для 'patan',
   поставьте window.PATAN_USE_BOOT = true — запуск пойдёт через MA.bootAtlas, как у патофизиологии. */
(function(){var code=document.getElementById('patan-app').textContent;
if(window.PATAN_USE_BOOT&&window.MA&&typeof window.MA.bootAtlas==='function'){window.MA.bootAtlas('patan','patan-app');}
else{var s=document.createElement('script');s.textContent=code;document.body.appendChild(s);}})();
</script>'''
    new_boot = '''<script>
window.PATAN_USE_BOOT = true;
(function(){var code=document.getElementById('patan-app').textContent;
if(window.PATAN_USE_BOOT&&window.MA&&typeof window.MA.bootAtlas==='function'){window.MA.bootAtlas('patan','patan-app');}
else{var s=document.createElement('script');s.textContent=code;document.body.appendChild(s);}})();
</script>
<script src="../assets/anti-theft-guard.js?v=20261113-v5"></script>'''
    assert old_boot in out_html, 'old_boot not found'
    out_html = out_html.replace(old_boot, new_boot, 1)

    (ROOT / 'index.html').write_text(out_html, encoding='utf-8')
    print('Pathological Anatomy: 26 topics, 2 open lessons (3 demo topics), 26 protected packages')


if __name__ == '__main__':
    main()
