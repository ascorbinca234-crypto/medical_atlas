'use strict';
// Опыт, стрик и дефибриллятор по журналу занятий. Чистые функции без доступа к базе.
// Тот же алгоритм работает в браузере: progress/progress.js (тест test/progress.test.js сверяет их).
//
// Журнал: { 'ГГГГ-ММ-ДД': [карточек, вспомнил, флаги] }, даты — по местному времени пользователя.
// Флаги: 1 — занятие ночью (00:00–04:59), 2 — утром (05:00–07:59).

const RULES = {
  goal: 10,          // карточек в день, чтобы день засчитался в стрик
  xpCard: 5,         // за каждую карточку
  xpRight: 3,        // доплата, если вспомнил
  goalBase: 20,      // бонус за выполненную дневную цель…
  goalStep: 2,       // …плюс 2 XP за каждый день стрика
  goalCap: 20,       // …но не больше чем за 20 дней
  freezes: 2,        // зарядов дефибриллятора максимум
  rechargeEvery: 7,  // +1 заряд за каждые 7 дней стрика
  horizon: 400,      // сколько дней журнала хранить
};

function isoAdd(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const weekday = iso => (new Date(iso + 'T00:00:00Z').getUTCDay() + 6) % 7;   // 0 — понедельник
const mondayOf = iso => isoAdd(iso, -weekday(iso));
// tz — как Date#getTimezoneOffset(): для Москвы −180
const todayFor = (tz, nowMs) => new Date((nowMs == null ? Date.now() : nowMs) - (Number(tz) || 0) * 60000).toISOString().slice(0, 10);

/** Сумма журналов нескольких устройств. */
function mergeDays(list) {
  const out = {};
  for (const days of list) {
    for (const k of Object.keys(days || {})) {
      const x = days[k], o = out[k] || (out[k] = [0, 0, 0]);
      o[0] += x[0] || 0; o[1] += x[1] || 0; o[2] |= x[2] || 0;
    }
  }
  return out;
}

/** Опыт и стрик на дату today. bonus — опыт не из журнала (рукопожатия, дуэли). */
function compute(days, today, bonus) {
  const R = RULES;
  const out = { xp: bonus || 0, streak: 0, best: 0, freezes: R.freezes, frozen: [], todayCards: 0, todayDone: false,
    week: 0, cards: 0, activeDays: 0, dayXp: {}, night: false, morning: false };
  const keys = Object.keys(days || {}).filter(k => k <= today && days[k] && days[k][0] > 0).sort();
  const mon = mondayOf(today);
  let streak = 0;
  if (keys.length) {
    for (let d = keys[0]; d <= today; d = isoAdd(d, 1)) {
      const x = days[d], n = x ? x[0] : 0, ok = x ? Math.min(x[1], n) : 0;
      let xp = n * R.xpCard + ok * R.xpRight;
      if (n) {
        out.cards += n; out.activeDays++;
        if (x[2] & 1) out.night = true;
        if (x[2] & 2) out.morning = true;
      }
      if (n >= R.goal) {
        streak++;
        if (streak > out.best) out.best = streak;
        xp += R.goalBase + Math.min(streak, R.goalCap) * R.goalStep;
        if (streak % R.rechargeEvery === 0 && out.freezes < R.freezes) out.freezes++;
      } else if (d !== today && streak > 0) {
        if (out.freezes > 0) { out.freezes--; out.frozen.push(d); }
        else streak = 0;
      }
      if (xp) { out.dayXp[d] = xp; out.xp += xp; if (d >= mon) out.week += xp; }
    }
  }
  out.streak = streak;
  out.todayCards = days && days[today] ? days[today][0] : 0;
  out.todayDone = out.todayCards >= R.goal;
  return out;
}

/** Опыт за период [from, to] включительно — для дуэлей. */
function xpBetween(days, from, to) {
  const c = compute(days, to, 0);
  let s = 0;
  for (const d of Object.keys(c.dayXp)) if (d >= from && d <= to) s += c.dayXp[d];
  return s;
}

module.exports = { RULES, isoAdd, weekday, mondayOf, todayFor, mergeDays, compute, xpBetween };
