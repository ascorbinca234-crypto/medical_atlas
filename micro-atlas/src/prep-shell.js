// The course-wide preparation engine is delivered only after authorization.
// Other pages retain links without constructing an incomplete exercise registry.
var PREP = {
  after(){}, modalOpen(){ return false; }, closeModal(){},
  page(){ return lockedPage('Подготовка к экзамену'); },
  title(){ return 'Подготовка к экзамену'; },
  topicStrip(t){ return '<div class="acts"><a class="btn pri" href="#learn/topic/'+t.id+'">Учить тему и проверить знания</a></div>'; },
  dossierStrip(){ return '<div class="acts"><a class="btn" href="#learn/pg">Карточки по плану ответа</a></div>'; },
  qActions(){ return '<div class="acts"><a class="btn" href="#learn/exam">Ответить как на экзамене</a></div>'; },
  homeCard(){ return '<div class="home7 pp-home"><a href="#learn"><svg viewBox="0 0 52 52" class="sv" aria-hidden="true"><rect x="2" y="2" width="48" height="48" rx="12" class="gv" stroke-width="1.4"/><path d="M12 40h28" class="gvs" stroke-width="2"/><rect x="13" y="30" width="5" height="8" rx="1.5" class="mg"/><rect x="21" y="24" width="5" height="14" rx="1.5" class="mb"/><rect x="29" y="18" width="5" height="20" rx="1.5" class="gv"/></svg><b>Подготовка к экзамену</b><small>План на сегодня, интервальное повторение, журнал ошибок, «Не перепутай», смешанный тест и экзамен</small></a></div>'; },
  homeList(){ return '<li><b>Подготовка к экзамену</b> — повторение по расписанию, журнал ошибок, свои сложные факты, сравнения, тесты и экзамен. Прогресс хранится в этом браузере и переносится файлом.</li>'; }
};
