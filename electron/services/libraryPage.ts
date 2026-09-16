/**
 * The school library as students see it on their phones. Same rules as the
 * exam page: one self-contained file, no internet, bilingual, RTL when Arabic.
 */
export function libraryPage(): string {
  return `<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<title>Library</title>
<style>
  :root { --bg:#f4f6fa; --card:#fff; --ink:#23272f; --muted:#57647b; --line:#d9dde5; --brand:#1f5ceb; }
  * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  body { margin:0; background:var(--bg); color:var(--ink); font-size:17px; line-height:1.6;
         font-family:system-ui,-apple-system,'Segoe UI',Tahoma,Arial,sans-serif; }
  .wrap { max-width:680px; margin:0 auto; padding:16px; }
  .bar { background:var(--card); border-bottom:1px solid var(--line); padding:14px 16px;
         display:flex; align-items:center; justify-content:space-between; gap:12px; }
  h1 { font-size:20px; margin:0; }
  .muted { color:var(--muted); }
  input { width:100%; min-height:52px; font-size:17px; font-family:inherit; padding:10px 12px;
          border:1px solid var(--line); border-radius:12px; text-align:start; }
  .book { background:var(--card); border:1px solid var(--line); border-radius:14px;
          padding:14px; margin-bottom:12px; }
  .book h2 { font-size:18px; margin:0 0 2px; }
  .cat { display:inline-block; background:#eef2f8; border-radius:999px; padding:2px 10px;
         font-size:13px; color:var(--muted); margin-top:6px; }
  a.open { display:block; text-align:center; margin-top:10px; min-height:50px; line-height:50px;
           background:var(--brand); color:#fff; border-radius:12px; font-weight:700; text-decoration:none; }
  .lang { background:none; border:0; font:inherit; font-weight:700; color:var(--brand); cursor:pointer; }
  .empty { text-align:center; color:var(--muted); padding:40px 0; }
</style>
</head>
<body>
<div class="bar"><h1 id="title">Library</h1><button class="lang" onclick="__lang()"></button></div>
<div class="wrap">
  <input id="q" placeholder="Search" autocomplete="off">
  <div style="height:14px"></div>
  <div id="list"></div>
</div>
<script>
(function () {
  var T = {
    en: { title:'School library', search:'Search for a book', open:'Open the book',
          by:'by', empty:'No books yet. Ask your teacher.', loading:'Please wait…' },
    ar: { title:'مكتبة المدرسة', search:'ابحث عن كتاب', open:'افتح الكتاب',
          by:'تأليف', empty:'لا توجد كتب بعد. اسأل معلمك.', loading:'انتظر من فضلك…' }
  };
  var lang = (navigator.language || '').indexOf('ar') === 0 ? 'ar' : 'en';
  var books = [], school = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  }
  function apply() {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.querySelector('.lang').textContent = lang === 'ar' ? 'English' : 'العربية';
    document.getElementById('q').placeholder = T[lang].search;
    var name = school ? ((lang === 'ar' && school.name_ar) ? school.name_ar : school.name) : '';
    document.getElementById('title').textContent = name || T[lang].title;
  }
  window.__lang = function () { lang = lang === 'ar' ? 'en' : 'ar'; apply(); render(); };

  function render() {
    var f = (document.getElementById('q').value || '').toLowerCase();
    var list = books.filter(function (b) {
      return !f || ((b.title || '') + ' ' + (b.title_ar || '') + ' ' + (b.author || '') + ' ' + (b.category || ''))
        .toLowerCase().indexOf(f) >= 0;
    });
    document.getElementById('list').innerHTML = list.length
      ? list.map(function (b) {
          var t = (lang === 'ar' && b.title_ar) ? b.title_ar : b.title;
          return '<div class="book"><h2>' + esc(t) + '</h2>' +
            (b.author ? '<div class="muted">' + esc(T[lang].by) + ' ' + esc(b.author) + '</div>' : '') +
            (b.description ? '<div class="muted" style="margin-top:6px">' + esc(b.description) + '</div>' : '') +
            (b.category ? '<div><span class="cat">' + esc(b.category) + '</span></div>' : '') +
            '<a class="open" href="/library/file/' + b.id + '" target="_blank" rel="noopener">' +
              esc(T[lang].open) + '</a></div>';
        }).join('')
      : '<div class="empty">' + esc(T[lang].empty) + '</div>';
  }

  document.getElementById('list').innerHTML = '<div class="empty">' + T[lang].loading + '</div>';
  fetch('/library/api/books').then(function (r) { return r.json(); }).then(function (j) {
    if (!j.ok) throw new Error(j.error);
    books = j.data.books; school = j.data.school;
    apply(); render();
  }).catch(function (e) {
    document.getElementById('list').innerHTML = '<div class="empty">' + esc(e.message) + '</div>';
  });

  document.getElementById('q').addEventListener('input', render);
  apply();
})();
</script>
</body>
</html>`
}
