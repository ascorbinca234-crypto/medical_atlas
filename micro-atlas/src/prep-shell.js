// The course-wide preparation engine is delivered only after authorization.
// Other pages retain links without constructing an incomplete exercise registry.
var PREP = {
  after(){}, modalOpen(){ return false; }, closeModal(){},
  page(){ return lockedPage('Подготовка к экзамену'); },
  title(){ return 'Подготовка к экзамену'; },
  topicStrip(t){ return '<div class="acts"><a class="btn pri" href="#learn/topic/'+t.id+'">Учить тему и проверить знания</a></div>'; },
  dossierStrip(){ return '<div class="acts"><a class="btn" href="#learn/pg">Карточки по плану ответа</a></div>'; },
  qActions(){ return '<div class="acts"><a class="btn" href="#learn/exam">Ответить как на экзамене</a></div>'; },
  homeCard(){ return '<div class="home7 pp-home"><a href="#learn"><b>Подготовка к экзамену</b><small>План на сегодня, интервальное повторение, журнал ошибок, «Не перепутай», смешанный тест и экзамен</small></a></div>'; },
  homeList(){ return '<li><b>Подготовка к экзамену</b> — повторение по расписанию, журнал ошибок, свои сложные факты, сравнения, тесты и экзамен. Прогресс хранится в этом браузере и переносится файлом.</li>'; }
};
