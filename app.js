/* HSK 3 · 词句练习 — sentence-based writing practice
 *
 * Data (data.js):
 *   PRACTICE.questions[i] = {k, w, py, pre, post, en, meaning, level, lesson, alts}
 *     k      unique key for progress (a few characters repeat across levels)
 *     w      the word to type
 *     py     pinyin shown above the blank
 *     pre/post  the supplied example sentence around the blank
 *     en     English hint for that sentence
 *     level  hsk1 | hsk2 | hsk3
 *     lesson 1..20 for new HSK 3 words, null for HSK 1-2 words
 *     alts   other accepted surfaces (e.g. 那 / 那儿)
 *
 * Spaced repetition lives in localStorage under hsk3.practice.v1:
 *   words[key] = {b: box 0..6, due: ms, seen, ok, no}
 *   mistakes   = {key: ms}
 *   stats      = {attempts, correct}
 */
(function () {
  'use strict';

  var STORE_KEY = 'hsk3.practice.v1';
  var THEME_KEY = 'hsk3.practice.theme';
  var DAYS = [1, 3, 7, 14, 30, 90, 90];   // box 1..6 interval, in days
  var WRONG_DELAY = 10 * 60 * 1000;       // 10 minutes
  var SMART_SIZE = 20;
  var RANDOM_SIZE = 20;
  var MISTAKE_SIZE = 40;

  var QUESTIONS = PRACTICE.questions;
  var BY_ID = {};
  for (var q = 0; q < QUESTIONS.length; q++) BY_ID[QUESTIONS[q].k] = QUESTIONS[q];

  var APP = document.getElementById('app');

  /* --------------------------------------------------------------- storage */

  function blankStore() {
    return { v: 1, words: {}, mistakes: {}, stats: { attempts: 0, correct: 0 } };
  }

  var S = blankStore();
  try {
    var raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && parsed.words) S = parsed;
    }
  } catch (e) { /* corrupt or unavailable storage */ }
  if (!S.words) S.words = {};
  if (!S.mistakes) S.mistakes = {};
  if (!S.stats) S.stats = { attempts: 0, correct: 0 };

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* ignore */ }
  }

  function record(key, ok) {
    var rec = S.words[key] || { b: 0, due: 0, seen: 0, ok: 0, no: 0 };
    rec.seen++;
    if (ok) {
      rec.ok++;
      rec.b = Math.min(rec.b + 1, 6);
      rec.due = Date.now() + DAYS[rec.b - 1] * 864e5;
      delete S.mistakes[key];
    } else {
      rec.no++;
      rec.b = 0;
      rec.due = Date.now() + WRONG_DELAY;
      S.mistakes[key] = Date.now();
    }
    S.words[key] = rec;
    S.stats.attempts++;
    if (ok) S.stats.correct++;
    save();
  }

  function dueWords() {
    var now = Date.now(), out = [];
    for (var w in S.words) {
      if (BY_ID[w] && S.words[w].due <= now) out.push(w);
    }
    out.sort(function (a, b) { return S.words[a].due - S.words[b].due; });
    return out;
  }

  function masteredCount() {
    var n = 0;
    for (var w in S.words) if (BY_ID[w] && S.words[w].b >= 4) n++;
    return n;
  }

  function accuracy() {
    if (!S.stats.attempts) return 0;
    return Math.round((S.stats.correct / S.stats.attempts) * 100);
  }

  /* ----------------------------------------------------------------- utils */

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function shuffle(a) {
    var x = a.slice();
    for (var i = x.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = x[i]; x[i] = x[j]; x[j] = t;
    }
    return x;
  }

  function norm(s) {
    return (s || '')
      .replace(/[\s\u3000]/g, '')
      .replace(/[，。！？、；：,.!?;:'"“”‘’（）()\[\]\-—…~·]/g, '')
      .toLowerCase();
  }

  function accepted(question, value) {
    var v = norm(value);
    if (!v) return false;
    if (norm(question.w) === v) return true;
    var alts = question.alts || [];
    for (var i = 0; i < alts.length; i++) {
      if (norm(alts[i]) === v) return true;
    }
    return false;
  }

  function scrollTop() { window.scrollTo(0, 0); }

  /* ---------------------------------------------------------------- theme */

  var savedTheme = null;
  try { savedTheme = localStorage.getItem(THEME_KEY); } catch (e) { /* ignore */ }
  if (savedTheme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');

  document.getElementById('t-theme').addEventListener('click', function () {
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.documentElement.setAttribute('data-theme', dark ? 'light' : 'dark');
    try { localStorage.setItem(THEME_KEY, dark ? 'light' : 'dark'); } catch (e) { /* ignore */ }
  });

  /* ------------------------------------------------------------------ home */

  function statCard(num, label, cls) {
    var box = el('div', 'stat' + (cls ? ' ' + cls : ''));
    box.appendChild(el('span', 'num', String(num)));
    box.appendChild(el('span', 'lbl', label));
    return box;
  }

  function modeCard(mode, icon, title, desc, badge, badgeQuiet, cls) {
    var b = el('button', 'mode' + (cls ? ' ' + cls : ''));
    b.type = 'button';
    b.appendChild(el('span', 'mode-icon', icon));
    var body = el('span', 'mode-body');
    body.appendChild(el('span', 'mode-title', title));
    body.appendChild(el('span', 'mode-desc', desc));
    b.appendChild(body);
    if (badge != null) {
      b.appendChild(el('span', 'badge' + (badgeQuiet ? ' quiet' : ''), badge));
    }
    b.addEventListener('click', function () { go('#/play/' + mode); });
    return b;
  }

  function renderHome() {
    APP.innerHTML = '';
    var wrap = el('div', 'wrap');

    var hero = el('section', 'hero');
    hero.appendChild(el('p', 'eyebrow', 'HSK 3 · 书写练习 · ' + PRACTICE.words + ' words'));
    var h1 = el('h1');
    h1.appendChild(document.createTextNode('Write the missing '));
    h1.appendChild(el('em', null, 'word'));
    h1.appendChild(document.createTextNode('.'));
    hero.appendChild(h1);
    hero.appendChild(el('p', 'lede',
      'Every word comes with a ready-made example sentence. One word is blanked out, ' +
      'its pinyin sits above the blank — type the Chinese characters that fit the sentence. ' +
      '600 words: about 15 new words per lesson, plus HSK 1–2 vocabulary.'));
    wrap.appendChild(hero);

    var stats = el('section', 'stats');
    stats.appendChild(statCard(PRACTICE.words, 'Words', ''));
    stats.appendChild(statCard(masteredCount(), 'Mastered', 'accent'));
    stats.appendChild(statCard(dueWords().length, 'Due now', 'gold'));
    stats.appendChild(statCard(accuracy() + '%', 'Accuracy', ''));
    wrap.appendChild(stats);

    var due = dueWords();
    var seenCount = 0;
    for (var sw in S.words) if (BY_ID[sw]) seenCount++;
    var unseen = QUESTIONS.length - seenCount;
    var modes = el('section', 'modes');

    modes.appendChild(modeCard('smart', '复',
      'Smart review',
      'Words due today, then new ones. Spaced over 90 days.',
      due.length ? due.length + ' due' : (unseen > 0 ? unseen + ' new' : 'rest day'),
      !due.length));

    modes.appendChild(modeCard('random', '随',
      'Random practice',
      'A mixed set of ' + RANDOM_SIZE + ' sentences from all 600 words.',
      RANDOM_SIZE + ' words', true));

    var mistakeCount = 0;
    for (var mw in S.mistakes) if (BY_ID[mw]) mistakeCount++;
    modes.appendChild(modeCard('mistakes', '错',
      'Mistakes',
      'Only the words you got wrong, until they stick.',
      mistakeCount ? mistakeCount + ' to fix' : 'none yet',
      !mistakeCount, 'gold'));

    wrap.appendChild(modes);

    var lessons = el('section', 'lessons');
    var head = el('div', 'section-head');
    head.appendChild(el('h2', null, 'By lesson'));
    head.appendChild(el('p', 'note', 'New HSK 3 words — about 15 per lesson'));
    lessons.appendChild(head);

    var grid = el('div', 'lesson-grid');
    PRACTICE.lessons.forEach(function (L) {
      if (!L.total) return;
      var b = el('button', 'lesson');
      b.type = 'button';
      var ln = el('span', 'ln');
      ln.appendChild(el('span', null, 'LESSON ' + (L.n < 10 ? '0' + L.n : L.n)));
      ln.appendChild(el('span', 'cnt', L.total + ' words'));
      b.appendChild(ln);
      b.appendChild(el('span', 'lzh', L.zh));
      b.appendChild(el('span', 'len', L.en));
      b.addEventListener('click', function () { go('#/play/lesson/' + L.n); });
      grid.appendChild(b);
    });
    lessons.appendChild(grid);
    wrap.appendChild(lessons);

    var how = el('section', 'how');
    var hg = el('div', 'how-grid');
    [
      ['Read the sentence', 'The blank shows the pinyin of the missing HSK 3 word.'],
      ['Type the characters', 'Use your Chinese IME. Enter checks the answer.'],
      ['Learn from feedback', 'See the full sentence, the meaning and the English hint.']
    ].forEach(function (s, i) {
      var st = el('div', 'step');
      st.appendChild(el('span', 'n', String(i + 1)));
      var body = el('div');
      body.appendChild(el('strong', null, s[0]));
      body.appendChild(el('span', null, s[1]));
      st.appendChild(body);
      hg.appendChild(st);
    });
    how.appendChild(hg);
    wrap.appendChild(how);

    APP.appendChild(wrap);
    scrollTop();
  }

  /* --------------------------------------------------------------- session */

  var session = null;

  function go(hash) {
    if (location.hash === hash) route();
    else location.hash = hash;
  }

  function buildQueue(mode, lesson) {
    if (mode === 'lesson') {
      var n = parseInt(lesson, 10);
      return {
        title: 'Lesson ' + n,
        list: QUESTIONS.filter(function (x) { return x.lesson === n; })
      };
    }
    if (mode === 'random') {
      return { title: 'Random practice', list: shuffle(QUESTIONS).slice(0, RANDOM_SIZE) };
    }
    if (mode === 'mistakes') {
      var keys = Object.keys(S.mistakes).filter(function (k) { return BY_ID[k]; });
      return {
        title: 'Mistakes',
        list: shuffle(keys.map(function (k) { return BY_ID[k]; })).slice(0, MISTAKE_SIZE)
      };
    }
    // smart: due first, then unseen words
    var due = dueWords();
    var seen = {};
    var queue = due.map(function (k) { seen[k] = 1; return BY_ID[k]; });
    if (queue.length < SMART_SIZE) {
      var fresh = QUESTIONS.filter(function (x) { return !S.words[x.k] && !seen[x.k]; });
      queue = queue.concat(shuffle(fresh).slice(0, SMART_SIZE - queue.length));
    }
    return { title: 'Smart review', list: queue.slice(0, SMART_SIZE) };
  }

  function start(mode, lesson) {
    var built = buildQueue(mode, lesson);
    if (!built.list.length) {
      renderEmpty(mode);
      return;
    }
    session = {
      mode: mode,
      lesson: lesson,
      title: built.title,
      list: built.list,
      i: 0,
      correct: 0,
      missed: [],
      answered: false
    };
    renderQuestion();
  }

  function renderEmpty(mode) {
    APP.innerHTML = '';
    var wrap = el('div', 'wrap');
    var card = el('div', 'card empty');
    if (mode === 'mistakes') {
      card.appendChild(el('h2', null, 'No mistakes to review'));
      card.appendChild(el('p', null,
        'Wrong answers from any practice set land here automatically. ' +
        'Do a random set or a lesson and they will collect.'));
    } else if (mode === 'smart') {
      card.appendChild(el('h2', null, 'All caught up'));
      card.appendChild(el('p', null,
        'Nothing is due right now. Come back later, or keep sharp with a random set.'));
    } else {
      card.appendChild(el('h2', null, 'No questions here'));
      card.appendChild(el('p', null, 'This set is empty. Pick another mode.'));
    }
    var actions = el('div', 'actions');
    var home = el('button', 'btn primary', 'Back to practice');
    home.type = 'button';
    home.addEventListener('click', function () { go('#/'); });
    actions.appendChild(home);
    card.appendChild(actions);
    wrap.appendChild(card);
    APP.appendChild(wrap);
    scrollTop();
  }

  function renderQuestion() {
    APP.innerHTML = '';
    var s = session;
    var question = s.list[s.i];

    var wrap = el('div', 'wrap');
    var quiz = el('div', 'quiz');

    var bar = el('div', 'quiz-bar');
    var exit = el('a', 'exit', '‹ Exit');
    exit.href = '#/';
    bar.appendChild(exit);

    var prog = el('div', 'progress');
    var fill = el('div', 'progress-fill');
    fill.style.width = (s.i / s.list.length * 100) + '%';
    prog.appendChild(fill);
    bar.appendChild(prog);
    bar.appendChild(el('span', 'counter', (s.i + 1) + ' / ' + s.list.length));
    quiz.appendChild(bar);

    var card = el('div', 'card qcard');
    card.appendChild(el('p', 'q-eyebrow', 'Write the word for the pinyin'));

    var p = el('p', 'sentence');
    p.appendChild(document.createTextNode(question.pre));

    var blank = el('span', 'blank-wrap');
    blank.appendChild(el('span', 'blank-py', question.py));

    var input = document.createElement('input');
    input.className = 'ans';
    input.type = 'text';
    input.lang = 'zh-Hans';
    input.autocomplete = 'off';
    input.autocorrect = 'off';
    input.spellcheck = false;
    input.setAttribute('aria-label', 'Type the missing word in Chinese');
    input.setAttribute('enterkeyhint', 'done');
    input.style.width = (question.w.length + 1) + 'em';
    blank.appendChild(input);

    p.appendChild(blank);
    p.appendChild(document.createTextNode(question.post));
    card.appendChild(p);

    var hintRow = el('p', 'hint-row');
    var hintBtn = el('button', 'link-btn', 'Show English hint');
    hintBtn.type = 'button';
    hintRow.appendChild(hintBtn);
    card.appendChild(hintRow);

    var hint = el('p', 'hint');
    hint.hidden = true;
    hint.textContent = question.en;
    card.appendChild(hint);

    hintBtn.addEventListener('click', function () {
      hint.hidden = !hint.hidden;
      hintBtn.textContent = hint.hidden ? 'Show English hint' : 'Hide English hint';
    });

    var actions = el('div', 'actions');
    var check = el('button', 'btn primary', 'Check');
    check.type = 'button';
    var skip = el('button', 'btn ghost', 'Show answer');
    skip.type = 'button';
    actions.appendChild(check);
    actions.appendChild(skip);
    card.appendChild(actions);
    quiz.appendChild(card);

    var holder = el('div');
    quiz.appendChild(holder);
    wrap.appendChild(quiz);
    APP.appendChild(wrap);

    var composing = false;
    input.addEventListener('compositionstart', function () { composing = true; });
    input.addEventListener('compositionend', function () { composing = false; });

    function submit() {
      if (s.answered) return;
      var value = input.value;
      if (!norm(value)) { input.focus(); return; }
      finish(accepted(question, value), value);
    }

    function reveal() {
      if (s.answered) return;
      finish(false, input.value);
    }

    function finish(ok, value) {
      s.answered = true;
      input.disabled = true;
      input.classList.add(ok ? 'ok' : 'no');
      if (!ok) input.value = question.w;

      record(question.k, ok);
      if (!ok) s.missed.push(question.k);
      else s.correct++;

      fill.style.width = ((s.i + 1) / s.list.length * 100) + '%';

      check.disabled = true;
      skip.disabled = true;
      hint.hidden = false;
      hintBtn.hidden = true;

      holder.appendChild(feedbackNode(question, ok, value));
      holder.firstChild.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    check.addEventListener('click', submit);
    skip.addEventListener('click', reveal);

    input.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      if (composing || e.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      e.stopPropagation();
      submit();
    });

    input.focus();
    scrollTop();
  }

  function feedbackNode(question, ok, value) {
    var fb = el('div', 'card feedback ' + (ok ? 'ok' : 'no'));

    var head = el('div', 'fb-head');
    head.appendChild(el('span', 'fb-state ' + (ok ? 'ok' : 'no'), ok ? 'Correct' : 'Not quite'));
    head.appendChild(el('span', 'fb-word', question.w));
    head.appendChild(el('span', 'fb-py', question.py));
    fb.appendChild(head);

    fb.appendChild(el('p', 'fb-mean', question.meaning));

    var full = el('p', 'fb-full');
    full.appendChild(document.createTextNode(question.pre));
    full.appendChild(el('mark', null, question.w));
    full.appendChild(document.createTextNode(question.post));
    fb.appendChild(full);

    fb.appendChild(el('p', 'fb-en', question.en));

    if (!ok && norm(value)) {
      var you = el('p', 'fb-you');
      you.appendChild(document.createTextNode('You wrote: '));
      you.appendChild(el('b', null, value));
      fb.appendChild(you);
    }

    var actions = el('div', 'actions');
    var next = el('button', 'btn primary', session.i + 1 < session.list.length ? 'Next ›' : 'See results ›');
    next.type = 'button';
    next.addEventListener('click', nextQuestion);
    actions.appendChild(next);
    fb.appendChild(actions);

    return fb;
  }

  function nextQuestion() {
    if (!session || !session.answered) return;
    session.i++;
    session.answered = false;
    if (session.i >= session.list.length) renderResult();
    else renderQuestion();
  }

  document.addEventListener('keydown', function (e) {
    if (!session || !session.answered) return;
    if (e.key !== 'Enter' || e.isComposing) return;
    if (document.activeElement && document.activeElement.tagName === 'BUTTON') return;
    e.preventDefault();
    nextQuestion();
  });

  /* ---------------------------------------------------------------- result */

  function renderResult() {
    var s = session;
    var total = s.list.length;
    var pct = Math.round(s.correct / total * 100);

    APP.innerHTML = '';
    var wrap = el('div', 'wrap');
    var quiz = el('div', 'quiz');
    var card = el('div', 'card result');

    card.appendChild(el('p', 'eyebrow', s.title + ' · complete'));
    var score = el('p', 'score');
    score.appendChild(document.createTextNode(String(pct)));
    score.appendChild(el('small', null, '%'));
    card.appendChild(score);
    card.appendChild(el('p', 'result-sub', s.correct + ' of ' + total + ' correct'));

    var stats = el('div', 'result-stats');
    var toReview = 0;
    for (var mk in S.mistakes) if (BY_ID[mk]) toReview++;
    [
      [String(s.correct), 'Correct'],
      [String(total - s.correct), 'Missed'],
      [String(toReview), 'To review']
    ].forEach(function (r) {
      var b = el('div', 'rs');
      b.appendChild(el('b', null, r[0]));
      b.appendChild(el('span', null, r[1]));
      stats.appendChild(b);
    });
    card.appendChild(stats);

    if (s.missed.length) {
      var missed = el('div', 'missed');
      missed.appendChild(el('h3', null, 'Words to remember'));
      var ul = el('ul');
      var seen = {};
      s.missed.forEach(function (k) {
        if (seen[k]) return;
        seen[k] = 1;
        var question = BY_ID[k];
        if (!question) return;
        var li = el('li');
        li.appendChild(el('span', 'mw', question.w));
        li.appendChild(el('span', 'mp', question.py));
        li.appendChild(el('span', 'mm', question.meaning));
        var sentence = el('span', 'ms');
        sentence.appendChild(document.createTextNode(question.pre));
        sentence.appendChild(el('mark', null, question.w));
        sentence.appendChild(document.createTextNode(question.post));
        li.appendChild(sentence);
        ul.appendChild(li);
      });
      missed.appendChild(ul);
      card.appendChild(missed);
    }

    var actions = el('div', 'actions');
    if (s.missed.length) {
      var again = el('button', 'btn primary', 'Practice mistakes');
      again.type = 'button';
      again.addEventListener('click', function () { go('#/play/mistakes'); });
      actions.appendChild(again);
    } else {
      var home = el('button', 'btn primary', 'Back to practice');
      home.type = 'button';
      home.addEventListener('click', function () { go('#/'); });
      actions.appendChild(home);
    }

    var retry = el('button', 'btn', 'Try again');
    retry.type = 'button';
    retry.addEventListener('click', function () {
      if (s.mode === 'lesson') go('#/play/lesson/' + s.lesson);
      else go('#/play/' + s.mode);
    });
    actions.appendChild(retry);

    var back = el('button', 'btn ghost', 'Home');
    back.type = 'button';
    back.addEventListener('click', function () { go('#/'); });
    actions.appendChild(back);

    card.appendChild(actions);
    quiz.appendChild(card);
    wrap.appendChild(quiz);
    APP.appendChild(wrap);
    scrollTop();
  }

  /* ---------------------------------------------------------------- router */

  function route() {
    var parts = (location.hash || '#/').replace(/^#\/?/, '').split('/').filter(Boolean);
    session = null;
    if (parts[0] === 'play' && parts[1]) {
      start(parts[1], parts[2]);
    } else {
      renderHome();
    }
  }

  window.addEventListener('hashchange', route);
  route();
})();
