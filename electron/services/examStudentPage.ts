/**
 * The page a student sees on their own phone. It is served as one self-contained
 * file: no build step, no external fonts or scripts, nothing fetched from the
 * internet — the school Wi-Fi may well have no internet at all.
 *
 * It is bilingual and flips to RTL the moment Arabic is chosen, matching the
 * desktop app.
 */
export function studentPage(): string {
  return `<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<title>Exam</title>
<style>
  :root { --bg:#f4f6fa; --card:#fff; --ink:#23272f; --muted:#57647b; --line:#d9dde5; --brand:#1f5ceb; --ok:#059669; --bad:#e11d48; }
  * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  body { margin:0; background:var(--bg); color:var(--ink); font-size:17px; line-height:1.6;
         font-family:system-ui,-apple-system,'Segoe UI',Tahoma,Arial,sans-serif; }
  .wrap { max-width:640px; margin:0 auto; padding:16px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:16px; padding:18px; margin-bottom:14px; }
  h1 { font-size:22px; margin:0 0 4px; }
  h2 { font-size:18px; margin:0 0 10px; }
  p.muted { color:var(--muted); margin:4px 0 0; }
  label { display:block; font-weight:600; margin-bottom:6px; }
  input, select, textarea { width:100%; min-height:52px; font-size:17px; font-family:inherit;
    padding:10px 12px; border:1px solid var(--line); border-radius:12px; background:#fff; color:var(--ink); text-align:start; }
  textarea { min-height:96px; }
  button { width:100%; min-height:54px; font-size:18px; font-weight:700; font-family:inherit;
    border:0; border-radius:12px; background:var(--brand); color:#fff; cursor:pointer; }
  button.ghost { background:#fff; color:var(--ink); border:1px solid var(--line); }
  button:disabled { opacity:.5; }
  .row { display:flex; gap:10px; }
  .row > * { flex:1; }
  .choice { display:flex; align-items:center; gap:12px; border:2px solid var(--line); border-radius:12px;
    padding:12px 14px; margin-bottom:10px; cursor:pointer; background:#fff; font-size:17px; }
  .choice.sel { border-color:var(--brand); background:#eef4ff; }
  .choice input { width:22px; height:22px; min-height:0; flex:0 0 auto; }
  .bar { position:sticky; top:0; z-index:5; background:var(--card); border-bottom:1px solid var(--line);
    padding:10px 16px; display:flex; align-items:center; justify-content:space-between; gap:12px; font-weight:700; }
  .time { font-variant-numeric:tabular-nums; }
  .time.low { color:var(--bad); }
  .err { background:#fff1f2; border:1px solid #fecdd3; color:#9f1239; border-radius:12px; padding:12px; margin-bottom:12px; }
  .pill { display:inline-block; background:#eef2f8; border-radius:999px; padding:3px 12px; font-size:14px; color:var(--muted); }
  .lang { background:none; border:0; font:inherit; font-weight:700; color:var(--brand); width:auto; min-height:0; cursor:pointer; }
  .big { font-size:40px; font-weight:800; text-align:center; margin:10px 0; }
  .center { text-align:center; }
  .qnum { color:var(--muted); font-size:14px; font-weight:700; }
  .saved { font-size:13px; color:var(--ok); min-height:18px; }
</style>
</head>
<body>
<div class="wrap" id="app"></div>
<script>
(function () {
  var T = {
    en: {
      join:'Join the exam', code:'Exam code from your teacher', pickName:'Find your name',
      search:'Type your name to find it', start:'Start the exam', already:'Already finished',
      of:'of', next:'Next', back:'Back', finish:'Finish and hand in',
      confirm:'Hand in your exam now? You cannot change your answers after this.',
      yes:'Yes, hand it in', no:'Not yet', done:'Your exam has been handed in',
      score:'Your score', pending:'Your teacher will check some answers and give you your mark.',
      timeLeft:'Time left', timeUp:'Time is up. Your exam was handed in automatically.',
      answerHere:'Write your answer here', unanswered:'Not answered yet',
      saving:'Saving…', savedOk:'Saved', true_:'True', false_:'False',
      loading:'Please wait…', retry:'Try again', close:'You may close this page.',
      noName:'Please find your name in the list.', questionsLeft:'question(s) with no answer yet'
    },
    ar: {
      join:'الدخول إلى الامتحان', code:'رمز الامتحان من معلمك', pickName:'ابحث عن اسمك',
      search:'اكتب اسمك للبحث عنه', start:'ابدأ الامتحان', already:'تم التسليم مسبقاً',
      of:'من', next:'التالي', back:'السابق', finish:'إنهاء وتسليم',
      confirm:'هل تريد تسليم امتحانك الآن؟ لا يمكنك تغيير إجاباتك بعد ذلك.',
      yes:'نعم، سلّم', no:'ليس بعد', done:'تم تسليم امتحانك',
      score:'درجتك', pending:'سيراجع معلمك بعض الإجابات ويمنحك درجتك.',
      timeLeft:'الوقت المتبقي', timeUp:'انتهى الوقت. تم تسليم امتحانك تلقائياً.',
      answerHere:'اكتب إجابتك هنا', unanswered:'لم تتم الإجابة بعد',
      saving:'جارٍ الحفظ…', savedOk:'تم الحفظ', true_:'صح', false_:'خطأ',
      loading:'انتظر من فضلك…', retry:'حاول مرة أخرى', close:'يمكنك إغلاق هذه الصفحة.',
      noName:'من فضلك ابحث عن اسمك في القائمة.', questionsLeft:'سؤال بدون إجابة'
    }
  };

  var lang = (navigator.language || '').indexOf('ar') === 0 ? 'ar' : 'en';
  var t = function (k) { return T[lang][k]; };
  var app = document.getElementById('app');
  var S = { step:'join', code:'', students:[], info:null, paper:null, answers:{}, idx:0, deadline:0, filter:'' };
  var timer = null;

  function applyLang() {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  }
  function api(path, opts) {
    return fetch(path, opts).then(function (r) { return r.json(); }).then(function (j) {
      if (!j.ok) throw new Error(j.error || 'Error');
      return j.data;
    });
  }
  function err(msg) { return '<div class="err">' + esc(msg) + '</div>'; }
  function langBtn() {
    return '<button class="lang" onclick="__lang()">' + (lang === 'ar' ? 'English' : 'العربية') + '</button>';
  }
  window.__lang = function () { lang = lang === 'ar' ? 'en' : 'ar'; applyLang(); render(); };

  /* ---------- screens ---------- */

  function renderJoin(message) {
    app.innerHTML =
      '<div class="card">' +
        '<div style="display:flex;justify-content:space-between;align-items:center">' +
          '<h1>' + esc(t('join')) + '</h1>' + langBtn() +
        '</div>' +
        (message ? err(message) : '') +
        '<label for="code">' + esc(t('code')) + '</label>' +
        '<input id="code" autocomplete="off" autocapitalize="characters" spellcheck="false" ' +
          'style="text-transform:uppercase;letter-spacing:4px;font-size:26px;text-align:center;font-weight:800" ' +
          'value="' + esc(S.code) + '" maxlength="6">' +
        '<div style="height:12px"></div>' +
        '<button onclick="__lookup()">' + esc(t('pickName')) + '</button>' +
      '</div>';
    var el = document.getElementById('code');
    el.focus();
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter') window.__lookup(); });
  }

  window.__lookup = function () {
    var code = (document.getElementById('code').value || '').trim().toUpperCase();
    if (!code) return;
    S.code = code;
    app.innerHTML = '<div class="card center">' + esc(t('loading')) + '</div>';
    api('/api/students?code=' + encodeURIComponent(code))
      .then(function (d) { S.info = d; S.students = d.students; S.step = 'name'; render(); })
      .catch(function (e) { S.step = 'join'; renderJoin(e.message); });
  };

  function renderName() {
    var title = lang === 'ar' && S.info.exam.title_ar ? S.info.exam.title_ar : S.info.exam.title;
    var school = lang === 'ar' && S.info.school.name_ar ? S.info.school.name_ar : S.info.school.name;
    var f = S.filter.toLowerCase();
    var list = S.students.filter(function (s) {
      return !f || (s.full_name + ' ' + (s.full_name_ar || '') + ' ' + s.student_code).toLowerCase().indexOf(f) >= 0;
    });
    app.innerHTML =
      '<div class="card">' +
        '<div style="display:flex;justify-content:space-between;align-items:center">' +
          '<div><h1>' + esc(title) + '</h1><p class="muted">' + esc(school) + '</p></div>' + langBtn() +
        '</div>' +
      '</div>' +
      '<div class="card">' +
        '<label for="q">' + esc(t('pickName')) + '</label>' +
        '<input id="q" placeholder="' + esc(t('search')) + '" value="' + esc(S.filter) + '" autocomplete="off">' +
        '<div style="height:12px"></div>' +
        list.map(function (s) {
          var name = lang === 'ar' && s.full_name_ar ? s.full_name_ar : s.full_name;
          return '<button class="ghost" style="margin-bottom:8px;text-align:start" ' +
            (s.done ? 'disabled' : 'onclick="__start(' + s.id + ')"') + '>' +
            esc(name) + ' <span class="pill">' + esc(s.done ? t('already') : s.student_code) + '</span></button>';
        }).join('') +
        (list.length ? '' : '<p class="muted">' + esc(t('noName')) + '</p>') +
      '</div>';
    var q = document.getElementById('q');
    q.addEventListener('input', function () { S.filter = q.value; renderName(); document.getElementById('q').focus(); });
  }

  window.__start = function (studentId) {
    app.innerHTML = '<div class="card center">' + esc(t('loading')) + '</div>';
    api('/api/join', {
      method:'POST', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ code: S.code, studentId: studentId })
    }).then(function (d) {
      S.paper = d;
      S.answers = d.answers || {};
      S.idx = 0;
      // The clock follows the server's start time, so reloading buys nothing.
      var started = new Date(d.startedAt.replace(' ', 'T') + 'Z').getTime();
      S.deadline = started + d.durationMinutes * 60000;
      S.step = 'exam';
      render();
      tick();
      timer = setInterval(tick, 1000);
    }).catch(function (e) { S.step = 'name'; render(); alert(e.message); });
  };

  function tick() {
    var el = document.getElementById('time');
    if (!el) return;
    var left = Math.max(0, S.deadline - Date.now());
    var m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
    el.textContent = m + ':' + (s < 10 ? '0' : '') + s;
    el.className = 'time' + (left < 120000 ? ' low' : '');
    if (left <= 0) { clearInterval(timer); submit(true); }
  }

  function save(qid, value) {
    S.answers[qid] = value;
    var note = document.getElementById('saved');
    if (note) note.textContent = t('saving');
    api('/api/answer', {
      method:'POST', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ attemptId: S.paper.attemptId, questionId: qid, answer: value })
    }).then(function () { if (note) note.textContent = t('savedOk'); })
      .catch(function () { if (note) note.textContent = ''; });
  }
  window.__pick = function (qid, value) { save(qid, value); render(); };
  window.__type = function (qid, value) { save(qid, value); };
  window.__go = function (d) { S.idx = Math.max(0, Math.min(S.paper.questions.length - 1, S.idx + d)); render(); };

  function renderExam() {
    var qs = S.paper.questions, q = qs[S.idx], a = S.answers[q.id];
    var body = '';
    if (q.kind === 'mcq') {
      body = q.options.map(function (opt, i) {
        var sel = String(a) === String(i);
        return '<div class="choice' + (sel ? ' sel' : '') + '" onclick="__pick(' + q.id + ',\\'' + i + '\\')">' +
          '<input type="radio" ' + (sel ? 'checked' : '') + ' readonly><span>' + esc(opt) + '</span></div>';
      }).join('');
    } else if (q.kind === 'truefalse') {
      body = [['true', t('true_')], ['false', t('false_')]].map(function (p) {
        var sel = a === p[0];
        return '<div class="choice' + (sel ? ' sel' : '') + '" onclick="__pick(' + q.id + ',\\'' + p[0] + '\\')">' +
          '<input type="radio" ' + (sel ? 'checked' : '') + ' readonly><span>' + esc(p[1]) + '</span></div>';
      }).join('');
    } else {
      body = '<textarea id="ta" placeholder="' + esc(t('answerHere')) + '">' + esc(a || '') + '</textarea>';
    }

    app.innerHTML =
      '<div class="bar"><span>' + (S.idx + 1) + ' ' + esc(t('of')) + ' ' + qs.length + '</span>' +
        '<span>' + esc(t('timeLeft')) + ' <span id="time" class="time">--:--</span></span></div>' +
      '<div class="wrap" style="padding:16px 0">' +
        '<div class="card">' +
          '<div class="qnum">' + esc(t('of')) + ' ' + q.marks + '</div>' +
          '<h2>' + esc(q.text) + '</h2>' + body +
          '<div class="saved" id="saved"></div>' +
        '</div>' +
        '<div class="row">' +
          '<button class="ghost" onclick="__go(-1)" ' + (S.idx === 0 ? 'disabled' : '') + '>' + esc(t('back')) + '</button>' +
          (S.idx === qs.length - 1
            ? '<button onclick="__confirm()">' + esc(t('finish')) + '</button>'
            : '<button onclick="__go(1)">' + esc(t('next')) + '</button>') +
        '</div>' +
      '</div>';

    var ta = document.getElementById('ta');
    if (ta) {
      var to = null;
      ta.addEventListener('input', function () {
        clearTimeout(to);
        to = setTimeout(function () { window.__type(q.id, ta.value); }, 600);
      });
    }
  }

  window.__confirm = function () {
    var missing = S.paper.questions.filter(function (q) {
      var v = S.answers[q.id];
      return v === undefined || v === null || v === '';
    }).length;
    var msg = t('confirm') + (missing ? '\\n\\n' + missing + ' ' + t('questionsLeft') : '');
    if (confirm(msg)) submit(false);
  };

  function submit(auto) {
    clearInterval(timer);
    app.innerHTML = '<div class="card center">' + esc(t('loading')) + '</div>';
    api('/api/submit', {
      method:'POST', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ attemptId: S.paper.attemptId })
    }).then(function (d) {
      app.innerHTML =
        '<div class="card center">' +
          '<h1>' + esc(t('done')) + '</h1>' +
          (auto ? '<p class="muted">' + esc(t('timeUp')) + '</p>' : '') +
          (d.provisional
            ? '<p class="muted">' + esc(t('pending')) + '</p>'
            : '<p class="muted">' + esc(t('score')) + '</p><div class="big">' + d.score + ' / ' + d.maxScore + '</div>') +
          '<p class="muted">' + esc(t('close')) + '</p>' +
        '</div>';
    }).catch(function (e) {
      app.innerHTML = '<div class="card">' + err(e.message) +
        '<button onclick="location.reload()">' + esc(t('retry')) + '</button></div>';
    });
  }

  function render() {
    applyLang();
    if (S.step === 'join') return renderJoin('');
    if (S.step === 'name') return renderName();
    if (S.step === 'exam') return renderExam();
  }

  applyLang();
  render();
})();
</script>
</body>
</html>`
}
