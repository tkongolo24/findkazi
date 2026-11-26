/* FindKazi — prototype logic. Everything is stored only in this browser (localStorage). */
(function () {
  'use strict';

  var I18N = window.I18N;
  var JOB_EMAIL = 'jobs@hingamarket.example';
  var STEPS = ['cv', 'email', 'apply'];
  var ROUTES = ['home', 'cv', 'email', 'apply', 'facilitator'];

  var DISTRICTS = {
    kigali: ['Gasabo', 'Kicukiro', 'Nyarugenge'],
    north: ['Burera', 'Gakenke', 'Gicumbi', 'Musanze', 'Rulindo'],
    south: ['Gisagara', 'Huye', 'Kamonyi', 'Muhanga', 'Nyamagabe', 'Nyanza', 'Nyaruguru', 'Ruhango'],
    west: ['Karongi', 'Ngororero', 'Nyabihu', 'Nyamasheke', 'Rubavu', 'Rusizi', 'Rutsiro'],
    east: ['Bugesera', 'Gatsibo', 'Kayonza', 'Kirehe', 'Ngoma', 'Nyagatare', 'Rwamagana']
  };
  var LEVELS = ['s6', 'tvet', 's3', 'other'];
  var SKILLS = ['computer', 'phone', 'customer', 'team', 'money', 'sales', 'farming', 'communication'];
  var LANGS = ['rw', 'en', 'fr', 'sw'];
  var OBS = ['alone', 'little', 'lot', 'notDone'];

  /* ---------- helpers ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (html != null) e.innerHTML = html;
    return e;
  }

  var store = {
    get: function (k, d) {
      try { var v = localStorage.getItem('djc.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; }
    },
    set: function (k, v) {
      try { localStorage.setItem('djc.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ }
    },
    clearAll: function () {
      try {
        Object.keys(localStorage).forEach(function (k) {
          if (k.indexOf('djc.') === 0 && k !== 'djc.lang') localStorage.removeItem(k);
        });
      } catch (e) { /* ignore */ }
    }
  };

  var lang = store.get('lang', 'rw');
  if (!I18N[lang]) lang = 'rw';

  function t(key, vars, lng) {
    var d = I18N[lng || lang] || I18N.en;
    var s = d[key] != null ? d[key] : (I18N.en[key] != null ? I18N.en[key] : key);
    if (vars) s = s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; });
    return s;
  }
  /* Put translatable text on an element and keep it translatable on language change. */
  function setT(node, key, vars) {
    if (!node) return;
    if (!key) { delete node.dataset.i18n; delete node.dataset.i18nVars; node.textContent = ''; return; }
    node.dataset.i18n = key;
    if (vars) node.dataset.i18nVars = JSON.stringify(vars); else delete node.dataset.i18nVars;
    node.textContent = t(key, vars);
  }

  /* Hosted pages (claude.ai) block pop-ups, printing and downloads. */
  var HOSTED = !!window.DJC_HOSTED;

  /* Two-tap confirmation, shown on the button itself (no pop-up dialogs). */
  function tapConfirm(btn, action) {
    if (btn.dataset.armed) {
      clearTimeout(btn._armTimer);
      delete btn.dataset.armed;
      setT(btn, btn.dataset.origKey);
      action();
      return;
    }
    btn.dataset.armed = '1';
    btn.dataset.origKey = btn.dataset.i18n;
    setT(btn, 'confirm.again');
    btn._armTimer = setTimeout(function () {
      delete btn.dataset.armed;
      setT(btn, btn.dataset.origKey);
    }, 4000);
  }

  /* ---------- metrics (for user testing) ---------- */
  var metrics = store.get('metrics', {});
  STEPS.forEach(function (s) {
    metrics[s] = Object.assign({ ms: 0, help: 0, attempts: 0, errors: 0, done: false }, metrics[s] || {});
  });
  function saveMetrics() { store.set('metrics', metrics); }

  var currentRoute = null;
  var enterTs = Date.now();
  function flushTime() {
    var now = Date.now();
    if (STEPS.indexOf(currentRoute) > -1 && !document.hidden) {
      metrics[currentRoute].ms += Math.min(now - enterTs, 30 * 60 * 1000);
      saveMetrics();
    }
    enterTs = now;
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) flushTime(); else enterTs = Date.now();
  });
  window.addEventListener('pagehide', flushTime);
  setInterval(flushTime, 15000);

  /* ---------- language ---------- */
  function applyLang() {
    document.documentElement.lang = lang === 'rw' ? 'rw' : 'en';
    $$('[data-i18n]').forEach(function (n) {
      var vars = n.dataset.i18nVars ? JSON.parse(n.dataset.i18nVars) : null;
      n.textContent = t(n.dataset.i18n, vars);
    });
    $$('[data-i18n-html]').forEach(function (n) { n.innerHTML = t(n.dataset.i18nHtml); });
    $$('[data-i18n-ph]').forEach(function (n) { n.placeholder = t(n.dataset.i18nPh); });
    $$('[data-i18n-aria]').forEach(function (n) { n.setAttribute('aria-label', t(n.dataset.i18nAria)); });
    $$('[data-i18n-label]').forEach(function (n) { n.label = t(n.dataset.i18nLabel); });
    $$('.lang button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.lang === lang)); });
    renderCV();
    renderProgress();
    renderFacilitator();
  }
  $$('.lang button').forEach(function (b) {
    b.addEventListener('click', function () {
      lang = b.dataset.lang;
      store.set('lang', lang);
      applyLang();
    });
  });

  /* ---------- build dynamic controls ---------- */
  function buildSelects() {
    $$('.district-select').forEach(function (sel) {
      sel.appendChild(el('option', { value: '', 'data-i18n': 'choose' }));
      Object.keys(DISTRICTS).forEach(function (p) {
        var g = el('optgroup', { 'data-i18n-label': 'prov.' + p });
        DISTRICTS[p].forEach(function (d) { g.appendChild(el('option', { value: d }, esc(d))); });
        sel.appendChild(g);
      });
    });
    $$('.level-select').forEach(function (sel) {
      sel.appendChild(el('option', { value: '', 'data-i18n': 'choose' }));
      LEVELS.forEach(function (l) { sel.appendChild(el('option', { value: l, 'data-i18n': 'level.' + l })); });
    });
  }
  function chip(name, value, key) {
    var lab = el('label', { 'class': 'chip' });
    var inp = el('input', { type: 'checkbox', name: name, value: value });
    lab.appendChild(inp);
    lab.appendChild(el('span', { 'data-i18n': key }));
    return lab;
  }
  function radioChip(name, value, key) {
    var lab = el('label', { 'class': 'chip' });
    lab.appendChild(el('input', { type: 'radio', name: name, value: value }));
    lab.appendChild(el('span', { 'data-i18n': key }));
    return lab;
  }
  function buildChips() {
    var sk = $('#skillChips');
    SKILLS.forEach(function (s) { sk.appendChild(chip('skill', s, 'skill.' + s)); });
    var lg = $('#langChips');
    LANGS.forEach(function (l) { lg.appendChild(chip('cvlang', l, 'lang.' + l)); });
  }
  function buildHelp() {
    $$('[data-help]').forEach(function (holder) {
      var key = holder.dataset.help;
      var btn = el('button', { type: 'button', 'class': 'help-btn', 'aria-expanded': 'false', 'data-i18n-aria': 'help.aria' }, '?');
      var hint = el('p', { 'class': 'hint', 'data-i18n': key });
      hint.hidden = true;
      holder.appendChild(btn);
      holder.parentNode.insertBefore(hint, holder.nextSibling);
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var open = hint.hidden;
        hint.hidden = !open;
        btn.setAttribute('aria-expanded', String(open));
        if (open && STEPS.indexOf(currentRoute) > -1) { metrics[currentRoute].help++; saveMetrics(); }
      });
    });
  }

  /* ---------- routing ---------- */
  function route() {
    var r = location.hash.replace('#', '') || 'home';
    if (ROUTES.indexOf(r) === -1) {
      if (currentRoute) return;
      r = 'home';
    }
    flushTime();
    currentRoute = r;
    enterTs = Date.now();
    $$('.view').forEach(function (v) { v.hidden = v.id !== 'view-' + r; });
    $$('.steps-nav a').forEach(function (a) {
      a.classList.toggle('active', a.dataset.route === r);
      if (a.dataset.route === r) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    if (r === 'email') prefillEmail();
    if (r === 'apply') showApplyState();
    if (r === 'facilitator') renderFacilitator();
    if (r === 'home') renderProgress();
    window.scrollTo(0, 0);
    var h = $('#view-' + r + ' h1');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }
  window.addEventListener('hashchange', route);

  /* ---------- progress ---------- */
  function stepStarted(s) {
    if (s === 'cv') { var c = store.get('cv', {}); return !!(c.fullName || c.phone || c.school); }
    return metrics[s].ms > 3000 || metrics[s].attempts > 0;
  }
  function renderProgress() {
    STEPS.forEach(function (s) {
      var pill = $('#status-' + s);
      var done = metrics[s].done;
      pill.classList.toggle('done', done);
      setT(pill, done ? 'status.done' : (stepStarted(s) ? 'status.started' : 'status.todo'));
      var nav = $('.steps-nav a[data-route="' + s + '"]');
      if (nav) nav.classList.toggle('done', done);
    });
    var allDone = STEPS.every(function (s) { return metrics[s].done; });
    $('#allDone').hidden = !allDone;
    var cta = $('#homeCta');
    var next = STEPS.filter(function (s) { return !metrics[s].done; })[0];
    var anyStarted = STEPS.some(function (s) { return metrics[s].done || stepStarted(s); });
    if (allDone) { cta.href = '#cv'; setT(cta, 'home.review'); }
    else if (anyStarted) { cta.href = '#' + next; setT(cta, 'home.continue'); }
    else { cta.href = '#cv'; setT(cta, 'home.start'); }
  }

  /* =========================================================
     STEP 1 — CV builder
     ========================================================= */
  var CV_TEXT = ['fullName', 'phone', 'email', 'district', 'profile', 'school', 'combination', 'level', 'year',
    'otherSkill', 'expRole', 'expPlace', 'expWhen', 'expDesc', 'refName', 'refPhone'];
  var cvForm = $('#cvForm');
  var savedTimer;

  function readCV() {
    var d = {};
    CV_TEXT.forEach(function (k) { d[k] = ($('#cv-' + k).value || '').trim(); });
    d.skills = $$('input[name=skill]:checked', cvForm).map(function (i) { return i.value; });
    d.langs = $$('input[name=cvlang]:checked', cvForm).map(function (i) { return i.value; });
    return d;
  }
  function loadCV() {
    var d = store.get('cv', {});
    CV_TEXT.forEach(function (k) { if (d[k] != null) $('#cv-' + k).value = d[k]; });
    $$('input[name=skill]', cvForm).forEach(function (i) { i.checked = (d.skills || []).indexOf(i.value) > -1; });
    $$('input[name=cvlang]', cvForm).forEach(function (i) { i.checked = (d.langs || []).indexOf(i.value) > -1; });
    $('#cvOutLang').value = store.get('cvOutLang', lang);
  }
  function cvReady(d) { d = d || store.get('cv', {}); return !!(d.fullName && d.phone); }

  function cvHTML(d, L) {
    var T = function (k, v) { return t(k, v, L); };
    var h = '';
    var hasAny = d.fullName || d.phone || d.email || d.profile || d.school || (d.skills && d.skills.length);
    h += '<h1 class="cv-name' + (d.fullName ? '' : ' empty') + '">' + esc(d.fullName || T('cvh.namePh')) + '</h1>';
    var contact = [d.phone, d.email, d.district].filter(Boolean);
    if (contact.length) h += '<p class="cv-contact">' + contact.map(function (c) { return '<span>' + esc(c) + '</span>'; }).join('') + '</p>';
    if (!hasAny) return h + '<p class="cv-placeholder">' + esc(T('cvh.empty')) + '</p>';

    if (d.profile) h += '<h2 class="cv-h">' + esc(T('cvh.profile')) + '</h2><p>' + esc(d.profile) + '</p>';

    if (d.school || d.combination || d.level || d.year) {
      h += '<h2 class="cv-h">' + esc(T('cvh.education')) + '</h2><div class="cv-item">';
      if (d.school) h += '<strong>' + esc(d.school) + '</strong>';
      var sub = [d.level ? T('level.' + d.level) : '', d.combination].filter(Boolean).join(' — ');
      if (sub) h += '<span class="cv-sub">' + esc(sub) + '</span><br>';
      if (d.year) h += '<span class="cv-sub">' + esc(T('cvh.completed', { y: d.year })) + '</span>';
      h += '</div>';
    }

    var skills = (d.skills || []).map(function (s) { return T('skill.' + s); });
    if (d.otherSkill) skills.push(d.otherSkill);
    if (skills.length) h += '<h2 class="cv-h">' + esc(T('cvh.skills')) + '</h2><ul class="cv-list">' + skills.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>';

    if (d.expRole || d.expPlace || d.expDesc) {
      h += '<h2 class="cv-h">' + esc(T('cvh.experience')) + '</h2><div class="cv-item">';
      h += '<strong>' + esc([d.expRole, d.expPlace].filter(Boolean).join(' — ')) + '</strong>';
      if (d.expWhen) h += '<span class="cv-sub">' + esc(d.expWhen) + '</span>';
      if (d.expDesc) h += '<p>' + esc(d.expDesc) + '</p>';
      h += '</div>';
    }

    if (d.langs && d.langs.length) h += '<h2 class="cv-h">' + esc(T('cvh.languages')) + '</h2><div class="cv-tags">' + d.langs.map(function (l) { return '<span>' + esc(T('lang.' + l)) + '</span>'; }).join('') + '</div>';

    if (d.refName || d.refPhone) h += '<h2 class="cv-h">' + esc(T('cvh.references')) + '</h2><p>' + esc(d.refName) + (d.refPhone ? '<br>' + esc(d.refPhone) : '') + '</p>';
    return h;
  }
  function renderCV() {
    var d = store.get('cv', {});
    $('#cvPaper').innerHTML = cvHTML(d, $('#cvOutLang').value);
    $('#attachName').textContent = attachmentName();
  }
  function onCVInput() {
    var d = readCV();
    store.set('cv', d);
    renderCV();
    if (cvReady(d)) $('#cvMissing').hidden = true;
    var s = $('#cvSaved');
    s.classList.add('show');
    clearTimeout(savedTimer);
    savedTimer = setTimeout(function () { s.classList.remove('show'); }, 1400);
  }
  cvForm.addEventListener('input', onCVInput);
  cvForm.addEventListener('change', onCVInput);
  $('#cvOutLang').addEventListener('change', function () { store.set('cvOutLang', this.value); renderCV(); });

  $('#profileExample').addEventListener('click', function () {
    var ta = $('#cv-profile');
    var fill = function () { ta.value = t('f.profile.exampleText'); onCVInput(); ta.focus(); };
    if (ta.value.trim() && ta.value !== t('f.profile.exampleText')) tapConfirm(this, fill); else fill();
  });

  $('#cvPrint').addEventListener('click', function () { window.print(); });
  if (HOSTED) { $('#cvPrint').hidden = true; $('#cvDownload').hidden = true; }

  var CV_CSS = 'body{font:11pt/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1b1b1b;max-width:720px;margin:32px auto;padding:0 24px}' +
    '.cv-name{font-size:24pt;margin:0;color:#2a1240}.cv-contact{color:#555;margin:4px 0 14px}.cv-contact span+span:before{content:" · ";color:#aaa}' +
    '.cv-h{font-size:9pt;text-transform:uppercase;letter-spacing:.1em;color:#5b2a86;border-bottom:2px solid #5b2a86;padding-bottom:3px;margin:18px 0 8px}' +
    '.cv-item strong{display:block}.cv-sub{color:#555}.cv-list{margin:0;padding-left:18px}.cv-tags span{display:inline-block;background:#f3ecfa;border-radius:4px;padding:2px 8px;margin:0 6px 6px 0}' +
    '@media print{body{margin:0}}';
  $('#cvDownload').addEventListener('click', function () {
    var d = store.get('cv', {});
    var L = $('#cvOutLang').value;
    var html = '<!doctype html><html lang="' + L + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CV — ' +
      esc(d.fullName || 'CV') + '</title><style>' + CV_CSS + '</style></head><body>' + cvHTML(d, L) + '</body></html>';
    var blob = new Blob([html], { type: 'text/html' });
    var a = el('a', { href: URL.createObjectURL(blob), download: attachmentName().replace(/\.pdf$/, '.html') });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  });

  $('#cvDone').addEventListener('click', function () {
    if (!cvReady()) {
      $('#cvMissing').hidden = false;
      metrics.cv.errors++; saveMetrics();
      var f = !$('#cv-fullName').value.trim() ? $('#cv-fullName') : $('#cv-phone');
      f.focus();
      return;
    }
    metrics.cv.done = true; saveMetrics();
    location.hash = '#email';
  });
  $('#cvClear').addEventListener('click', function () {
    tapConfirm(this, function () {
      cvForm.reset();
      store.set('cv', {});
      metrics.cv.done = false; saveMetrics();
      renderCV(); renderProgress();
    });
  });

  $('#jumpPreview').addEventListener('click', function (e) {
    e.preventDefault();
    $('#cvPreviewWrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  // floating "See my CV" button — hide when the preview is on screen
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      $('#jumpPreview').style.display = entries[0].isIntersecting ? 'none' : '';
    }).observe($('#cvPreviewWrap'));
  }

  /* =========================================================
     STEP 2 — Email practice
     ========================================================= */
  var MAIL_FIELDS = ['from', 'to', 'subject', 'body'];
  function attachmentName() {
    var n = (store.get('cv', {}).fullName || '').trim().replace(/[^\w\u00C0-\u024F]+/g, '_').replace(/^_|_$/g, '');
    return 'CV' + (n ? '_' + n : '') + '.pdf';
  }
  function loadEmail() {
    var d = store.get('email', {});
    MAIL_FIELDS.forEach(function (k) { if (d[k] != null) $('#em-' + k).value = d[k]; });
    $('#em-attach').checked = !!d.attach;
  }
  function readEmail() {
    var d = {};
    MAIL_FIELDS.forEach(function (k) { d[k] = $('#em-' + k).value; });
    d.attach = $('#em-attach').checked;
    return d;
  }
  function prefillEmail() {
    var from = $('#em-from');
    if (!from.value) { from.value = store.get('cv', {}).email || ''; }
    $('#attachName').textContent = attachmentName();
    if (metrics.email.done) $('#emSent').hidden = false;
  }
  $('#mailForm').addEventListener('input', function () { store.set('email', readEmail()); });
  $('#mailForm').addEventListener('change', function () { store.set('email', readEmail()); });

  var NOT_PRO = /(sexy|baby|babe|boy|girl|king|queen|cute|love|sweet|killer|hot|swag|bad|lover|prince|princess|star|money|boss)/i;
  var JOB_WORDS = /(customer|service|assistant|wakira|abakiriya|umukiriya)/i;
  var GREETING = /^(dear|hello|hi\b|good\s+(morning|afternoon|day)|to whom|nyakubahwa|muraho|mwiriwe|mwaramutse|bwana|madamu|mbanje)/i;
  var SIGNOFF = /(regards|sincerely|thank you|thanks|yours|best wishes|murakoze|mbashimiye|mbaye)/i;
  var MENTION = /(\bcv\b|attach|umugereka|curriculum|resume|r\u00e9sum\u00e9)/i;

  function checkEmail(d) {
    var res = [];
    var from = d.from.trim();
    var fromOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(from) && !NOT_PRO.test(from.split('@')[0]);
    res.push({ id: 'from', ok: fromOk, key: fromOk ? 'fb.from.ok' : (from ? 'fb.from.no' : 'fb.from.empty') });

    var toOk = d.to.trim().toLowerCase() === JOB_EMAIL;
    res.push({ id: 'to', ok: toOk, key: toOk ? 'fb.to.ok' : 'fb.to.no', critical: true });

    var subjOk = JOB_WORDS.test(d.subject);
    res.push({ id: 'subject', ok: subjOk, key: subjOk ? 'fb.subject.ok' : 'fb.subject.no', critical: true });

    var lines = d.body.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    var greetOk = lines.length > 0 && GREETING.test(lines[0]);
    res.push({ id: 'greeting', ok: greetOk, key: greetOk ? 'fb.greeting.ok' : 'fb.greeting.no' });

    var jobOk = JOB_WORDS.test(d.body);
    res.push({ id: 'job', ok: jobOk, key: jobOk ? 'fb.job.ok' : 'fb.job.no' });

    var words = d.body.trim() ? d.body.trim().split(/\s+/).length : 0;
    var lenKey = words < 25 ? 'fb.length.short' : (words > 220 ? 'fb.length.long' : 'fb.length.ok');
    res.push({ id: 'length', ok: lenKey === 'fb.length.ok', key: lenKey, critical: words < 25 });

    var mentionOk = MENTION.test(d.body);
    res.push({ id: 'mention', ok: mentionOk, key: mentionOk ? 'fb.mention.ok' : 'fb.mention.no' });

    res.push({ id: 'attach', ok: d.attach, key: d.attach ? 'fb.attach.ok' : 'fb.attach.no', critical: true });

    // sign-off: a closing phrase near the end with a name after it, or the CV name in the last lines
    var signOk = false;
    var last = lines.slice(-4);
    for (var i = 0; i < last.length; i++) {
      if (SIGNOFF.test(last[i])) {
        var rest = last[i].replace(/^.*?(regards|sincerely|thank you|thanks|yours|best wishes|murakoze|mbashimiye|mbaye)[^,]*,?/i, '').trim();
        if (rest.length > 2 || i < last.length - 1) signOk = true;
      }
    }
    var cvName = (store.get('cv', {}).fullName || '').trim().toLowerCase();
    if (!signOk && cvName && last.join(' ').toLowerCase().indexOf(cvName.split(/\s+/)[0]) > -1 && SIGNOFF.test(d.body)) signOk = true;
    res.push({ id: 'signoff', ok: signOk, key: signOk ? 'fb.signoff.ok' : 'fb.signoff.no' });
    return res;
  }

  var lastCheckCritical = true;
  $('#emCheck').addEventListener('click', function () {
    var res = checkEmail(readEmail());
    metrics.email.attempts++;
    metrics.email.errors += res.filter(function (r) { return !r.ok; }).length;
    saveMetrics();

    var ul = $('#emChecks');
    ul.innerHTML = '';
    // problems first, then successes
    res.slice().sort(function (a, b) { return (a.ok ? 1 : 0) - (b.ok ? 1 : 0); }).forEach(function (r) {
      var li = el('li', { 'class': r.ok ? 'ok' : 'no' });
      li.appendChild(el('span', { 'class': 'ic', 'aria-hidden': 'true' }, r.ok ? '✓' : '!'));
      var s = el('span'); setT(s, r.key); li.appendChild(s);
      ul.appendChild(li);
    });
    var n = res.filter(function (r) { return r.ok; }).length;
    var score = $('#emScore');
    if (n === res.length) setT(score, 'fb.allGood'); else setT(score, 'fb.score', { n: n, t: res.length });
    $('#emBar').style.width = Math.round(n / res.length * 100) + '%';
    lastCheckCritical = res.some(function (r) { return r.critical && !r.ok; });
    $('#emSendBlocked').hidden = true;
    $('#emFeedback').hidden = false;
    $('#emFeedback').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  // editing after a check means they must check again before sending
  $('#mailForm').addEventListener('input', function () { lastCheckCritical = true; });
  $('#em-attach').addEventListener('change', function () { lastCheckCritical = true; });

  $('#emSend').addEventListener('click', function () {
    if (lastCheckCritical) { $('#emSendBlocked').hidden = false; return; }
    metrics.email.done = true; saveMetrics();
    $('#emFeedback').hidden = true;
    $('#emSent').hidden = false;
    $('#emSent').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  $('#emExampleBtn').addEventListener('click', function () {
    var box = $('#emExample');
    box.hidden = !box.hidden;
    this.setAttribute('aria-expanded', String(!box.hidden));
    setT(this, box.hidden ? 'em.example' : 'em.hideExample');
    if (!box.hidden) { metrics.email.help++; saveMetrics(); }
  });

  /* =========================================================
     STEP 3 — Online application
     ========================================================= */
  var apForm = $('#apForm');
  var apSubmitted = false;
  var fileNote = el('p', { 'class': 'hint-static', id: 'fileNote' });
  fileNote.hidden = true;
  $('#ap-file').parentNode.insertBefore(fileNote, $('#ap-file').nextSibling);

  $$('input[name=cvsource]').forEach(function (r) {
    r.addEventListener('change', function () {
      var up = $('input[name=cvsource]:checked').value === 'upload';
      $('#ap-file').hidden = !up;
      if (up) $('#ap-file').click();
    });
  });
  $('#ap-file').addEventListener('change', function () {
    var f = this.files && this.files[0];
    fileNote.hidden = !f;
    if (f) setT(fileNote, 'ap.fileChosen', { f: f.name });
  });

  function val(id) { return ($('#ap-' + id).value || '').trim(); }
  function radio(name) { var r = $('input[name=' + name + ']:checked', apForm); return r ? r.value : ''; }
  function ageFrom(dateStr) {
    var b = new Date(dateStr + 'T00:00:00');
    if (isNaN(b)) return null;
    var n = new Date();
    var a = n.getFullYear() - b.getFullYear();
    var m = n.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && n.getDate() < b.getDate())) a--;
    return a;
  }
  function normPhone(p) { return p.replace(/[\s\-().]/g, '').replace(/^\+?250/, '0'); }

  function validateApply() {
    var e = {};
    if (!val('firstName')) e.firstName = 'err.required';
    if (!val('lastName')) e.lastName = 'err.required';
    var dob = val('dob');
    if (!dob) e.dob = 'err.dob';
    else { var age = ageFrom(dob); if (age == null || age < 18 || age > 30) e.dob = 'err.age'; }
    var ph = val('phone');
    if (!ph) e.phone = 'err.required'; else if (!/^07\d{8}$/.test(normPhone(ph))) e.phone = 'err.phone';
    var em = val('email');
    if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) e.email = 'err.email';
    if (!val('district')) e.district = 'err.choose';
    var pos = radio('position');
    if (!pos) e.position = 'err.choose'; else if (pos !== 'customer') e.position = 'err.position';
    if (!radio('heard')) e.heard = 'err.choose';
    if (!val('level')) e.level = 'err.choose';
    var y = val('year'), yNow = new Date().getFullYear();
    if (!y) e.year = 'err.required'; else if (!/^\d{4}$/.test(y) || +y < 1990 || +y > yNow) e.year = 'err.year';
    var src = radio('cvsource');
    if (!src) e.cv = 'err.choose';
    else if (src === 'made' && !cvReady()) e.cv = 'err.noCv';
    else if (src === 'upload' && !($('#ap-file').files && $('#ap-file').files.length)) e.cv = 'err.file';
    var mot = val('motivation');
    if (!mot) e.motivation = 'err.required'; else if (mot.length < 50) e.motivation = 'err.short';
    if (!radio('start')) e.start = 'err.choose';
    if (!$$('input[name=aplang]:checked', apForm).length) e.langs = 'err.chooseSome';
    if (!$('#ap-declare').checked) e.declare = 'err.declare';
    return e;
  }
  function showErrors(errs) {
    $$('.field[data-field]', apForm).forEach(function (f) {
      var key = errs[f.dataset.field];
      f.classList.toggle('invalid', !!key);
      var p = $('.err', f);
      setT(p, key || null);
      $$('input,select,textarea', f).forEach(function (i) {
        if (key) i.setAttribute('aria-invalid', 'true'); else i.removeAttribute('aria-invalid');
      });
    });
    var n = Object.keys(errs).length;
    var sum = $('#apSummary');
    sum.hidden = n === 0;
    if (n) setT(sum, 'err.summary', { n: n });
    return n;
  }
  apForm.addEventListener('submit', function (ev) {
    ev.preventDefault();
    apSubmitted = true;
    var errs = validateApply();
    var n = showErrors(errs);
    metrics.apply.attempts++;
    metrics.apply.errors += n;
    saveMetrics();
    if (n) {
      var first = $('.field.invalid', apForm);
      first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      var inp = $('input,select,textarea', first);
      if (inp) setTimeout(function () { inp.focus({ preventScroll: true }); }, 350);
      return;
    }
    var ref = 'HM-' + new Date().getFullYear() + '-' + String(Math.floor(1000 + Math.random() * 9000));
    store.set('applyRef', ref);
    metrics.apply.done = true; saveMetrics();
    showApplyState();
    $('#apDone').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('#apDone').focus({ preventScroll: true });
  });
  function revalidate() { if (apSubmitted) showErrors(validateApply()); }
  apForm.addEventListener('input', revalidate);
  apForm.addEventListener('change', revalidate);

  function showApplyState() {
    var done = metrics.apply.done;
    apForm.hidden = done;
    $('#apDone').hidden = !done;
    if (done) $('#apRef').textContent = store.get('applyRef', '');
  }

  /* =========================================================
     Facilitator view
     ========================================================= */
  var fac = store.get('facilitator', { code: '', notes: '', obs: {} });
  function buildFacilitator() {
    var box = $('#facObs');
    STEPS.forEach(function (s) {
      var row = el('div', { 'class': 'obs-row' });
      var h = el('strong', { 'data-i18n': s === 'cv' ? 'step1.title' : s === 'email' ? 'step2.title' : 'step3.title' });
      var chips = el('div', { 'class': 'chips', role: 'radiogroup' });
      OBS.forEach(function (o) {
        var c = radioChip('obs-' + s, o, 'fac.obs.' + o);
        var inp = $('input', c);
        inp.checked = fac.obs[s] === o;
        inp.addEventListener('change', function () { fac.obs[s] = o; store.set('facilitator', fac); });
        chips.appendChild(c);
      });
      row.appendChild(h); row.appendChild(chips);
      box.appendChild(row);
    });
    $('#facCode').value = fac.code || '';
    $('#facNotes').value = fac.notes || '';
    $('#facCode').addEventListener('input', function () { fac.code = this.value; store.set('facilitator', fac); });
    $('#facNotes').addEventListener('input', function () { fac.notes = this.value; store.set('facilitator', fac); });
  }
  function fmtTime(ms) {
    var s = Math.round(ms / 1000), m = Math.floor(s / 60);
    return m + ':' + String(s % 60).padStart(2, '0');
  }
  function renderFacilitator() {
    var tb = $('#facStats');
    if (!tb) return;
    var rows = [
      ['fac.time', function (m) { return fmtTime(m.ms); }],
      ['fac.help', function (m) { return m.help; }],
      ['fac.attempts', function (m) { return m.attempts; }],
      ['fac.errors', function (m) { return m.errors; }],
      ['fac.completed', function (m) { return m.done ? '✅ ' + t('fac.yes') : '— ' + t('fac.no'); }]
    ];
    tb.innerHTML = rows.map(function (r) {
      return '<tr><th scope="row">' + esc(t(r[0])) + '</th>' + STEPS.map(function (s) { return '<td>' + esc(r[1](metrics[s])) + '</td>'; }).join('') + '</tr>';
    }).join('');
  }
  $('#facExport').addEventListener('click', function () {
    flushTime();
    var L = 'en';
    var lines = [];
    lines.push('FindKazi — user test results');
    lines.push('Participant: ' + (fac.code || '(no code)'));
    lines.push('Date: ' + new Date().toLocaleString());
    lines.push('Site language at export: ' + (lang === 'rw' ? 'Kinyarwanda' : 'English'));
    lines.push('');
    var names = { cv: 'Step 1 — CV', email: 'Step 2 — Email', apply: 'Step 3 — Apply' };
    STEPS.forEach(function (s) {
      var m = metrics[s];
      lines.push(names[s]);
      lines.push('  Time spent:      ' + fmtTime(m.ms));
      lines.push('  Help taps:       ' + m.help);
      lines.push('  Checks/submits:  ' + m.attempts);
      lines.push('  Problems shown:  ' + m.errors);
      lines.push('  Completed:       ' + (m.done ? 'Yes' : 'No'));
      lines.push('  Observation:     ' + (fac.obs[s] ? t('fac.obs.' + fac.obs[s], null, L) : '(not recorded)'));
      lines.push('');
    });
    lines.push('Notes:');
    lines.push(fac.notes || '(none)');
    if (HOSTED) {
      var out = $('#facOut');
      out.value = lines.join('\n');
      out.hidden = false;
      var note = $('#facCopied');
      var showCopied = function () { note.hidden = false; };
      var selectIt = function () { out.focus(); out.select(); setT(note, 'fac.copyManual'); note.hidden = false; };
      setT(note, 'fac.copied');
      try {
        navigator.clipboard.writeText(out.value).then(showCopied, selectIt);
      } catch (e) { selectIt(); }
      return;
    }
    var blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    var a = el('a', { href: URL.createObjectURL(blob), download: 'findkazi-results-' + (fac.code || 'participant').replace(/\W+/g, '') + '-' + new Date().toISOString().slice(0, 10) + '.txt' });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  });
  /* Send this participant's results to the team's Google Sheet (see google-sheet/Code.gs). */
  var SHEET_URL = (window.FINDKAZI_SHEET_URL || '').trim();
  if (SHEET_URL && !HOSTED) {
    var sendBtn = $('#facSend');
    sendBtn.hidden = false;
    sendBtn.addEventListener('click', function () {
      var note = $('#facSent');
      if (!fac.code.trim()) { setT(note, 'fac.sendNoCode'); note.hidden = false; $('#facCode').focus(); return; }
      flushTime();
      var steps = {};
      STEPS.forEach(function (s) {
        var m = metrics[s];
        steps[s] = { seconds: Math.round(m.ms / 1000), help: m.help, attempts: m.attempts, errors: m.errors, completed: m.done,
          observation: fac.obs[s] ? t('fac.obs.' + fac.obs[s], null, 'en') : '' };
      });
      var payload = { participant: fac.code.trim(), language: lang === 'rw' ? 'Kinyarwanda' : 'English', steps: steps, notes: fac.notes || '' };
      sendBtn.disabled = true;
      setT(sendBtn, 'fac.sending');
      note.hidden = true;
      // text/plain + no-cors: Google Apps Script accepts it without a CORS preflight; the reply can't be read.
      fetch(SHEET_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) })
        .then(function () { setT(note, 'fac.sent'); }, function () { setT(note, 'fac.sendFail'); })
        .then(function () { note.hidden = false; sendBtn.disabled = false; setT(sendBtn, 'fac.send'); });
    });
  }
  $('#facReset').addEventListener('click', function () {
    tapConfirm(this, function () {
      store.clearAll();
      location.hash = '#home';
      location.reload();
    });
  });
  if (HOSTED) setT($('#facExport'), 'fac.copy');

  /* ---------- start ---------- */
  buildSelects();
  buildChips();
  buildHelp();
  buildFacilitator();
  loadCV();
  loadEmail();
  applyLang();
  if (!location.hash) history.replaceState(null, '', '#home');
  route();
})();
