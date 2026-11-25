(function () {
  'use strict';
  var L = window.Lunar;
  // build.js thay chuỗi này khi deploy; chạy trực tiếp từ src/ thì hiện "dev"
  var APP_VERSION = '__APP_VERSION__';
  if (APP_VERSION.indexOf('__') === 0) APP_VERSION = 'dev';

  /* ---------- Hằng số & tiện ích ---------- */
  var KEY_SPECIAL = 'lv_special_v1', KEY_HOL = 'lv_holidays_v1', KEY_CHECK = 'lv_hol_checked_v1', KEY_SET = 'lv_settings_v1';
  var DOW = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
  var DOW_S = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  var ICON = {
    flag: '<svg viewBox="0 0 24 16" aria-hidden="true"><rect width="24" height="16" rx="2.5" fill="#DA251D"/><polygon points="12,2.6 13.6,7.3 18.5,7.3 14.5,10.2 16,14.9 12,12 8,14.9 9.5,10.2 5.5,7.3 10.4,7.3" fill="#FFDE00"/></svg>',
    cake: '<u class="emo">🎂</u>',
    lotus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5c3 2.6 3.4 6.4 0 10.5-3.4-4.1-3-7.9 0-10.5z" fill="#F4A3BF"/><path d="M3.5 9.5c3.6-.2 6.6 1.7 8.5 6.2-4.2.8-7.8-1.2-8.5-6.2z" fill="#EE7FA4"/><path d="M20.5 9.5c-3.6-.2-6.6 1.7-8.5 6.2 4.2.8 7.8-1.2 8.5-6.2z" fill="#EE7FA4"/><path d="M4 17.5c4.5 3.2 11.5 3.2 16 0-4.5-1.2-11.5-1.2-16 0z" fill="#5FA971"/></svg>',
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="12,3 14.6,9 21,9.6 16.2,13.9 17.7,20.3 12,17 6.3,20.3 7.8,13.9 3,9.6 9.4,9" fill="#3B82C4"/></svg>',
    dot: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5.5" fill="#E0B04A"/></svg>'
  };
  var GROUPS = {
    birthday: { label: 'Sinh nhật', icon: ICON.cake, color: '#d6457f' },
    memorial: { label: 'Giỗ', icon: ICON.lotus, color: '#e07aa0' },
    other: { label: 'Khác', icon: ICON.star, color: '#3b82c4' }
  };
  var REMIND = [[0, 'Không nhắc'], [1, 'Trước 1 ngày'], [3, 'Trước 3 ngày'], [7, 'Trước 7 ngày']];

  var $ = function (s, el) { return (el || document).querySelector(s); };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var key = function (y, m, d) { return y + '-' + pad(m) + '-' + pad(d); };
  var keyOf = function (o) { return key(o.y, o.m, o.d); };
  var parseKey = function (k) { var p = k.split('-').map(Number); return { y: p[0], m: p[1], d: p[2] }; };
  var fmt = function (o) { return pad(o.d) + '/' + pad(o.m) + '/' + o.y; };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var LS = {
    get: function (k, def) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  };

  // Luôn tính theo giờ Việt Nam (UTC+7), không phụ thuộc múi giờ của máy
  function vnToday() {
    var t = new Date(Date.now() + 7 * 3600 * 1000);
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
  }

  var state = {
    tab: 'today',
    today: vnToday(),
    special: LS.get(KEY_SPECIAL, []),
    set: Object.assign({ us: false }, LS.get(KEY_SET, {})),
    holidays: LS.get(KEY_HOL, null),
    filter: 'all',
    q: '',
    installEvt: null
  };
  if (!Array.isArray(state.special)) state.special = [];
  state.special.forEach(function (s) { if (!GROUPS[s.group]) s.group = 'other'; }); // gộp "Kỷ niệm" cũ vào "Khác"
  state.view = { y: state.today.y, m: state.today.m };
  state.sel = { y: state.today.y, m: state.today.m, d: state.today.d };

  var yearCache = {};
  var H = function () { return state.holidays || { fixed: [], years: {} }; };

  function lunarDayName(l) { return (l.d <= 10 ? 'Mùng ' : '') + l.d; }
  function lunarFull(l) { return lunarDayName(l) + ' tháng ' + l.m + (l.leap ? ' (nhuận)' : '') + ' năm ' + L.canChiYear(l.y); }
  function lunarShort(l) { return l.d + '/' + l.m + (l.leap ? ' nhuận' : '') + ' âm'; }
  function dowOf(o) { return L.dow(o.d, o.m, o.y); }
  function countdown(dd) {
    if (dd === 0) return 'Hôm nay';
    if (dd === 1) return 'Ngày mai';
    return 'còn ' + dd + ' ngày';
  }

  /* ---------- Ngày đặc biệt: quy đổi & lặp lại ---------- */
  function resolveLunar(d, m, ly, leap) {
    var r = null;
    if (leap) r = L.lunarToSolar(d, m, ly, true);
    if (!r) r = L.lunarToSolar(d, m, ly, false);
    if (!r) return d > 29 ? resolveLunar(d - 1, m, ly, leap) : null;
    var b = L.solarToLunar(r.d, r.m, r.y);
    if (b.m !== m || b.d !== d) return d > 29 ? resolveLunar(d - 1, m, ly, leap) : null; // tháng thiếu: lùi về 29
    return r;
  }

  // Các lần xảy ra của một ngày đặc biệt trong năm dương Y
  function occurrences(s, Y) {
    var out = [];
    if (s.cal === 'solar') {
      if (!s.repeat) {
        if (s.y === Y) out.push({ y: Y, m: s.m, d: s.d, n: 0 });
        return out;
      }
      if (s.y && Y < s.y) return out;
      var d = Math.min(s.d, L.daysInMonth(s.m, Y)); // 29/2 năm không nhuận -> 28/2
      out.push({ y: Y, m: s.m, d: d, n: s.y ? Y - s.y : null });
    } else {
      [Y - 1, Y].forEach(function (ly) {
        if (!s.repeat && s.y !== ly) return;
        if (s.repeat && s.y && ly < s.y) return;
        var r = resolveLunar(s.d, s.m, ly, s.leap);
        if (r && s.shift) r = L.addDays(r, s.shift);
        if (r && r.y === Y) out.push({ y: r.y, m: r.m, d: r.d, n: s.y ? ly - s.y : null });
      });
    }
    return out;
  }

  // Lần xảy ra gần nhất kể từ ngày `from`; nếu đã qua hết thì trả về lần cuối với past = true
  function nextOcc(s, from) {
    var years = [], i;
    if (s.repeat) { var y0 = Math.max(from.y, (s.y || 0) - 1); for (i = 0; i < 3; i++) years.push(y0 + i); }
    else if (s.y) years = [s.y - 1, s.y, s.y + 1];
    var all = [];
    years.forEach(function (Y) { occurrences(s, Y).forEach(function (o) { all.push(o); }); });
    var fut = null, past = null;
    all.forEach(function (o) {
      var dd = L.diff(from, o);
      if (dd >= 0) { if (!fut || dd < fut.dd) fut = { date: o, dd: dd, n: o.n }; }
      else if (!past || dd > past.dd) past = { date: o, dd: dd, n: o.n, past: true };
    });
    return fut || past;
  }

  /* ---------- Sự kiện theo năm (lễ + ngày đặc biệt) ---------- */
  function buildYear(Y) {
    if (yearCache[Y]) return yearCache[Y];
    var map = {};
    var add = function (o, ev) { if (o && o.y === Y) (map[keyOf(o)] = map[keyOf(o)] || []).push(ev); };
    var hol = H();
    (hol.fixed || []).forEach(function (h) {
      var ev = { kind: 'holiday', name: h.name, off: !!h.off, cal: h.cal };
      if (h.cal === 'solar') add({ y: Y, m: h.m, d: h.d }, ev);
      else [Y - 1, Y].forEach(function (ly) {
        var s = L.lunarToSolar(h.d, h.m, ly, false);
        if (s && h.shift) s = L.addDays(s, h.shift);
        add(s, ev);
      });
    });
    var yo = (hol.years || {})[String(Y)];
    if (yo) {
      (yo.off || []).forEach(function (x) { add(parseKey(x.date), { kind: 'holiday', name: x.name || 'Ngày nghỉ', off: true, cal: 'solar', extra: true }); });
      (yo.work || []).forEach(function (x) { add(parseKey(x.date), { kind: 'work', name: x.name || 'Làm bù' }); });
    }
    state.special.forEach(function (s) {
      occurrences(s, Y).forEach(function (o) {
        add(o, { kind: 'special', id: s.id, name: s.name, group: s.group, n: o.n, note: s.note, remind: s.remind || 0, s: s });
      });
    });
    yearCache[Y] = map;
    return map;
  }
  function eventsOn(o) { return buildYear(o.y)[keyOf(o)] || []; }

  function upcoming(days) {
    var t = state.today, out = [];
    [t.y, t.y + 1].forEach(function (Y) {
      var map = buildYear(Y);
      Object.keys(map).forEach(function (k) {
        var o = parseKey(k), dd = L.diff(t, o);
        if (dd < 0 || dd > days) return;
        map[k].forEach(function (ev) { if (ev.kind !== 'work') out.push({ date: o, dd: dd, ev: ev }); });
      });
    });
    out.sort(function (a, b) { return a.dd - b.dd || (a.ev.kind === 'special' ? -1 : 0) - (b.ev.kind === 'special' ? -1 : 0); });
    return out;
  }

  /* ---------- Thành phần giao diện ---------- */
  function grp(g) { return GROUPS[g] || GROUPS.other; }
  function evIcon(ev) {
    if (ev.kind === 'special') return grp(ev.group).icon;
    if (ev.kind === 'work') return '💼';
    return ev.off ? ICON.flag : ICON.dot;
  }
  function evColor(ev) { return ev.kind === 'special' ? grp(ev.group).color : ''; }
  function specialSub(ev) {
    if (ev.n == null) return '';
    if (ev.group === 'birthday') return ev.n > 0 ? 'Tròn ' + ev.n + ' tuổi' : 'Năm sinh';
    if (ev.group === 'memorial') return ev.n === 1 ? 'Giỗ đầu' : (ev.n > 1 ? 'Giỗ lần thứ ' + ev.n : '');
    return ev.n > 0 ? ev.n + ' năm' : 'Ngày bắt đầu';
  }
  function chip(ev) {
    var cls = ev.kind === 'work' ? ' work' : (ev.off ? ' off' : '');
    var st = ev.kind === 'special' ? ' style="--c:' + evColor(ev) + '"' : '';
    return '<span class="chip' + cls + '"' + st + '>' + evIcon(ev) + ' ' + esc(ev.name) + '</span>';
  }
  function evRow(ev, right, extra) {
    var sub = [];
    if (ev.kind === 'special') {
      sub.push(grp(ev.group).label);
      var ss = specialSub(ev); if (ss) sub.push(ss);
      if (ev.note) sub.push(ev.note);
    } else if (ev.kind === 'work') sub.push('Ngày đi làm bù');
    else {
      sub.push(ev.cal === 'lunar' ? 'Âm lịch' : 'Dương lịch');
      if (ev.off) sub.push('Nghỉ lễ');
    }
    var attrs = ev.kind === 'special' ? ' data-act="edit" data-id="' + esc(ev.id) + '"' : ' disabled';
    return '<li><button class="row"' + attrs + '>' +
      '<span class="ico' + (ev.off ? ' off' : '') + '" style="' + (ev.kind === 'special' ? '--c:' + evColor(ev) : '') + '">' + evIcon(ev) + '</span>' +
      '<span class="row-body"><span class="row-name">' + esc(ev.name) + (extra || '') + '</span><br><span class="row-sub">' + esc(sub.join(' · ')) + '</span></span>' +
      (right ? '<span class="row-right">' + right + '</span>' : '') + '</button></li>';
  }
  function upRight(it) {
    return '<b>' + countdown(it.dd) + '</b>' + DOW_S[dowOf(it.date)] + ' ' + pad(it.date.d) + '/' + pad(it.date.m);
  }

  /* ---------- Ngày lễ liên bang Mỹ (ngày nghỉ), tính theo quy tắc nên không cần cập nhật hằng năm ---------- */
  function nthDow(Y, m, wd, n) { // wd: 0 = Chủ nhật; n = 1..4, hoặc -1 là lần cuối của tháng
    var d, last;
    if (n > 0) { d = 1 + ((wd - L.dow(1, m, Y) + 7) % 7) + (n - 1) * 7; return { y: Y, m: m, d: d }; }
    last = new Date(Y, m, 0).getDate();
    d = last - ((L.dow(last, m, Y) - wd + 7) % 7);
    return { y: Y, m: m, d: d };
  }
  function usHolidays(Y) {
    var fixed = function (m, d) { return { y: Y, m: m, d: d }; };
    var list = [
      ['Năm mới', 'New Year’s Day', fixed(1, 1), true],
      ['Ngày Martin Luther King', 'Martin Luther King Jr. Day', nthDow(Y, 1, 1, 3)],
      ['Ngày Tổng thống', 'Presidents’ Day', nthDow(Y, 2, 1, 3)],
      ['Ngày Chiến sĩ trận vong', 'Memorial Day', nthDow(Y, 5, 1, -1)],
      ['Juneteenth (ngày giải phóng nô lệ)', 'Juneteenth', fixed(6, 19), true],
      ['Quốc khánh Mỹ', 'Independence Day', fixed(7, 4), true],
      ['Ngày Lao động Mỹ', 'Labor Day', nthDow(Y, 9, 1, 1)],
      ['Ngày Columbus / Thổ dân', 'Columbus Day', nthDow(Y, 10, 1, 2)],
      ['Ngày Cựu chiến binh', 'Veterans Day', fixed(11, 11), true],
      ['Lễ Tạ ơn', 'Thanksgiving', nthDow(Y, 11, 4, 4)],
      ['Giáng sinh', 'Christmas Day', fixed(12, 25), true]
    ];
    return list.map(function (h) {
      var date = h[2], note = '', w = L.dow(date.d, date.m, date.y);
      if (h[3]) { // ngày cố định: rơi vào thứ Bảy thì nghỉ bù thứ Sáu, Chủ nhật thì nghỉ bù thứ Hai
        if (w === 6 && !(date.m === 1 && date.d === 1)) { date = L.addDays(date, -1); note = 'nghỉ bù thứ Sáu'; }
        else if (w === 0) { date = L.addDays(date, 1); note = 'nghỉ bù thứ Hai'; }
      }
      return { name: h[0], en: h[1], date: date, note: note };
    });
  }
  function usUpcoming(n) {
    var t = state.today, out = [];
    [t.y, t.y + 1].forEach(function (Y) {
      usHolidays(Y).forEach(function (h) {
        var dd = L.diff(t, h.date);
        if (dd >= 0) out.push({ h: h, dd: dd, date: h.date });
      });
    });
    out.sort(function (a, b) { return a.dd - b.dd; });
    return out.slice(0, n);
  }

  /* ---------- Tab: Hôm nay ---------- */
  function renderToday() {
    var t = state.today, lu = L.solarToLunar(t.d, t.m, t.y);
    var evs = eventsOn(t).slice();
    if (lu.d === 1) evs.unshift({ kind: 'holiday', name: 'Mùng 1 âm lịch', cal: 'lunar', off: false });
    if (lu.d === 15) evs.unshift({ kind: 'holiday', name: 'Rằm', cal: 'lunar', off: false });
    var ups = upcoming(366);
    var reminders = ups.filter(function (u) { return u.ev.kind === 'special' && u.ev.remind > 0 && u.dd > 0 && u.dd <= u.ev.remind; });
    var list = ups.filter(function (u) { return u.dd > 0; }).slice(0, 7);

    var html = '<section class="hero" aria-label="Hôm nay">' +
      '<div class="hero-top"><span>Tháng ' + t.m + ' năm ' + t.y + '</span><span>' + DOW[dowOf(t)] + '</span></div>' +
      '<div class="hero-day">' + t.d + '</div>' +
      '<div class="hero-lunar"><small>Âm lịch</small> ' + esc(lunarFull(lu)) + '</div>' +
      '<div class="hero-cc"><span>Ngày ' + L.canChiDay(t.d, t.m, t.y) + '</span> · <span>Tháng ' + L.canChiMonth(lu.m, lu.y) + '</span></div>' +
      '</section>';

    if (evs.length) html += '<div class="chips">' + evs.map(chip).join('') + '</div>';

    if (reminders.length) {
      html += '<section class="card alert"><h2>Nhắc nhở</h2><ul class="rows">' +
        reminders.map(function (u) { return evRow(u.ev, upRight(u)); }).join('') + '</ul></section>';
    }

    html += '<section class="card"><h2>Sắp tới</h2>';
    html += list.length ? '<ul class="rows">' + list.map(function (u) {
      var badge = u.ev.kind === 'special' && u.ev.remind > 0 && u.dd <= u.ev.remind ? '<span class="badge">Nhắc</span>' : '';
      return evRow(u.ev, upRight(u), badge);
    }).join('') + '</ul>' : '<div class="empty">Chưa có ngày lễ hay ngày đặc biệt nào sắp tới.</div>';
    html += '</section>';

    if (state.set.us) html += '<section class="card"><h2>Ngày lễ Mỹ được nghỉ</h2><ul class="rows">' + usUpcoming(4).map(function (u) {
      var sub = ['Lễ liên bang Mỹ', u.h.en]; if (u.h.note) sub.push(u.h.note);
      return '<li><button class="row" disabled><span class="ico off">🇺🇸</span><span class="row-body"><span class="row-name">' + esc(u.h.name) + '</span><br><span class="row-sub">' + esc(sub.join(' · ')) + '</span></span><span class="row-right">' + upRight(u) + '</span></button></li>';
    }).join('') + '</ul></section>';

    $('#view').innerHTML = html;
  }

  /* ---------- Tab: Lịch tháng ---------- */
  function renderCal() {
    var v = state.view, t = state.today, sel = state.sel;
    var first = { y: v.y, m: v.m, d: 1 };
    var offset = (L.dow(1, v.m, v.y) + 6) % 7; // tuần bắt đầu từ Thứ hai
    var dim = L.daysInMonth(v.m, v.y);
    var rows = Math.ceil((offset + dim) / 7);
    var l1 = L.solarToLunar(1, v.m, v.y), l2 = L.solarToLunar(dim, v.m, v.y);
    var sub = L.canChiYear(l2.y) + ' · âm ' + l1.m + (l1.leap ? 'n' : '') + (l1.m !== l2.m || l1.leap !== l2.leap ? '–' + l2.m + (l2.leap ? 'n' : '') : '');

    var html = '<div class="cal-head">' +
      '<button class="iconbtn" data-act="prev" aria-label="Tháng trước">‹</button>' +
      '<div class="cal-title"><b>Tháng ' + v.m + ' / ' + v.y + '</b><small>' + esc(sub) + '</small></div>' +
      '<button class="iconbtn" data-act="next" aria-label="Tháng sau">›</button>' +
      '<label class="iconbtn" aria-label="Chọn ngày">📅<input type="date" id="jump" min="1900-01-01" max="2199-12-31" value="' + keyOf(sel) + '"></label>' +
      '<button class="pill" data-act="goToday">Hôm nay</button></div>';

    html += '<div class="grid" id="grid">';
    ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].forEach(function (n, i) { html += '<div class="dow' + (i === 6 ? ' we' : '') + '">' + n + '</div>'; });
    for (var i = 0; i < rows * 7; i++) {
      var c = L.addDays(first, i - offset);
      var lc = L.solarToLunar(c.d, c.m, c.y);
      var evs = eventsOn(c);
      var dw = (i % 7); // 0 = Thứ hai
      var cls = 'cell';
      if (c.m !== v.m) cls += ' dim';
      if (dw === 5) cls += ' sat';
      if (dw === 6) cls += ' sun';
      if (evs.some(function (e) { return e.off; })) cls += ' off';
      if (lc.d === 1) cls += ' moon1';
      if (lc.d === 15) cls += ' moon15';
      if (c.y === t.y && c.m === t.m && c.d === t.d) cls += ' today';
      if (c.y === sel.y && c.m === sel.m && c.d === sel.d) cls += ' sel';
      var shown = evs.filter(function (e) { return e.kind !== 'work'; });
      var rank = function (e) { return e.kind === 'special' ? 0 : (e.off ? 1 : 2); };
      shown.sort(function (a, b) { return rank(a) - rank(b); });
      var dots = shown.slice(0, 2).map(function (e) { return evIcon(e); }).join('') + (shown.length > 2 ? '<em>+' + (shown.length - 2) + '</em>' : '');
      html += '<button class="' + cls + '" data-act="pick" data-date="' + keyOf(c) + '" aria-label="' + c.d + '/' + c.m + '/' + c.y + '">' +
        '<span class="s">' + c.d + '</span><span class="l">' + (lc.d === 1 ? lc.d + '/' + lc.m + (lc.leap ? 'n' : '') : lc.d) + '</span>' +
        (dots ? '<span class="dots">' + dots + '</span>' : '') + '</button>';
    }
    html += '</div>';
    html += '<section class="card detail" id="detail"></section>';
    $('#view').innerHTML = html;
    renderDetail();
  }

  function renderDetail() {
    var s = state.sel, lu = L.solarToLunar(s.d, s.m, s.y);
    var evs = eventsOn(s).slice();
    if (lu.d === 1) evs.unshift({ kind: 'holiday', name: 'Mùng 1 âm lịch', cal: 'lunar', off: false });
    if (lu.d === 15) evs.unshift({ kind: 'holiday', name: 'Rằm', cal: 'lunar', off: false });
    var dd = L.diff(state.today, s);
    var rel = dd === 0 ? ' · hôm nay' : (dd > 0 ? ' · ' + countdown(dd) : ' · ' + (-dd) + ' ngày trước');
    var html = '<h3>' + DOW[dowOf(s)] + ', ' + s.d + ' tháng ' + s.m + ', ' + s.y + '</h3>' +
      '<p class="kv">Âm lịch: <b>' + esc(lunarFull(lu)) + '</b>' + rel + '</p>' +
      '<p class="kv">Ngày <b>' + L.canChiDay(s.d, s.m, s.y) + '</b> · tháng <b>' + L.canChiMonth(lu.m, lu.y) + '</b></p>';
    if (evs.length) html += '<ul class="rows" style="margin-top:8px">' + evs.map(function (e) { return evRow(e, ''); }).join('') + '</ul>';
    html += '<button class="btn block" data-act="addOnDate">＋ Thêm sự kiện vào ngày này</button>';
    $('#detail').innerHTML = html;
  }

  function setSel(o) {
    state.sel = { y: o.y, m: o.m, d: o.d };
    if (o.y !== state.view.y || o.m !== state.view.m) { state.view = { y: o.y, m: o.m }; renderCal(); }
    else renderCal();
  }
  function shiftMonth(n) {
    var m = state.view.m + n, y = state.view.y;
    if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; }
    if (y < 1900 || y > 2199) return;
    state.view = { y: y, m: m };
    renderCal();
  }

  /* ---------- Tab: Ngày đặc biệt ---------- */
  function renderSpecial() {
    var html = '<button class="addbig" data-act="add">＋ Thêm sự kiện</button>' +
      '<input class="search" id="q" type="search" placeholder="Tìm theo tên…" value="' + esc(state.q) + '" autocomplete="off">' +
      '<div class="filters" id="filters"></div><div id="spList"></div>';
    $('#view').innerHTML = html;
    renderSpecialList();
  }
  function renderSpecialList() {
    var counts = { all: state.special.length };
    Object.keys(GROUPS).forEach(function (g) { counts[g] = state.special.filter(function (s) { return s.group === g; }).length; });
    var f = '<button class="fchip" data-act="filter" data-g="all" aria-pressed="' + (state.filter === 'all') + '">Tất cả (' + counts.all + ')</button>';
    Object.keys(GROUPS).forEach(function (g) {
      f += '<button class="fchip" data-act="filter" data-g="' + g + '" aria-pressed="' + (state.filter === g) + '">' + '<span class="fi">' + GROUPS[g].icon + '</span>' + GROUPS[g].label + ' (' + counts[g] + ')</button>';
    });
    $('#filters').innerHTML = f;

    var q = state.q.trim().toLowerCase();
    var items = state.special.filter(function (s) {
      return (state.filter === 'all' || s.group === state.filter) && (!q || s.name.toLowerCase().indexOf(q) >= 0);
    }).map(function (s) { return { s: s, occ: nextOcc(s, state.today) }; });
    items.sort(function (a, b) {
      var ap = !a.occ || a.occ.past, bp = !b.occ || b.occ.past;
      if (ap !== bp) return ap ? 1 : -1;
      return (a.occ ? a.occ.dd : 0) - (b.occ ? b.occ.dd : 0);
    });

    var html;
    if (!state.special.length) html = '<div class="card empty">Chưa có sự kiện nào. Bấm “＋ Thêm sự kiện” để thêm sinh nhật, ngày giỗ…</div>';
    else if (!items.length) html = '<div class="card empty">Không tìm thấy kết quả.</div>';
    else html = '<ul class="rows cards">' + items.map(function (it) {
      var s = it.s, g = grp(s.group), o = it.occ;
      var cal = s.cal === 'lunar' ? 'Âm lịch ' + s.d + '/' + s.m + (s.leap ? ' nhuận' : '') : 'Dương lịch ' + s.d + '/' + s.m;
      if (s.shift && s.cal === 'lunar') cal = 'Mất ' + s.d + '/' + s.m + ' âm · giỗ trước 1 ngày';
      var meta = [cal + (s.repeat ? ' · mỗi năm' : ' · ' + s.y)];
      var extra = '';
      if (o && !o.past) {
        var ev = { group: s.group, n: o.n };
        extra = specialSub(ev);
        if (extra) meta.push(extra);
      }
      var right = !o ? '' : (o.past ? '<b>Đã qua</b>' + fmt(o.date) :
        '<b>' + countdown(o.dd) + '</b>' + DOW_S[dowOf(o.date)] + ' ' + pad(o.date.d) + '/' + pad(o.date.m) + (o.date.y !== state.today.y ? '/' + o.date.y : ''));
      return '<li><button class="row" data-act="edit" data-id="' + esc(s.id) + '">' +
        '<span class="ico" style="--c:' + g.color + '">' + g.icon + '</span>' +
        '<span class="row-body"><span class="row-name">' + esc(s.name) + '</span><br><span class="row-sub">' + esc(meta.join(' · ')) + '</span></span>' +
        '<span class="row-right">' + right + '</span></button></li>';
    }).join('') + '</ul>';
    $('#spList').innerHTML = html;
  }

  /* ---------- Form thêm/sửa ---------- */
  var uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };
  var dlg = $('#dlg');
  var editingId = null;

  var TYPES = [['birthday', 'Sinh nhật'], ['memorial', 'Giỗ'], ['other', 'Khác']];
  function openForm(id, preset) {
    editingId = id || null;
    var s = id ? state.special.filter(function (x) { return x.id === id; })[0] : null;
    if (id && !s) return;
    var v = s || Object.assign({ name: '', group: 'birthday', cal: 'solar', d: '', m: '', y: '', leap: false, repeat: true, remind: 0, note: '' }, preset || {});
    var html = '<form class="form" id="spForm" novalidate autocomplete="off">' +
      '<h2>' + (s ? 'Sửa sự kiện' : 'Thêm sự kiện') + '</h2>' +
      '<label>Tên sự kiện<input type="text" name="name" maxlength="60" placeholder="VD: Sinh nhật mẹ" value="' + esc(v.name) + '"></label>' +
      '<div class="lbl">Loại</div><div class="types">' + TYPES.map(function (t) {
        return '<label class="type"><input type="radio" name="group" value="' + t[0] + '"' + (v.group === t[0] ? ' checked' : '') + '><span>' + GROUPS[t[0]].icon + t[1] + '</span></label>';
      }).join('') + '</div>' +
      '<div class="lbl">Ngày</div>' +
      '<div class="seg" role="group" aria-label="Loại lịch"><label><input type="radio" name="cal" value="solar"' + (v.cal === 'solar' ? ' checked' : '') + '><span>Dương lịch</span></label>' +
      '<label><input type="radio" name="cal" value="lunar"' + (v.cal === 'lunar' ? ' checked' : '') + '><span>Âm lịch</span></label></div>' +
      '<div class="row3"><label>Ngày<input type="number" name="d" inputmode="numeric" min="1" max="31" value="' + esc(v.d) + '"></label>' +
      '<label>Tháng<input type="number" name="m" inputmode="numeric" min="1" max="12" value="' + esc(v.m) + '"></label>' +
      '<label><span id="yLbl">Năm</span><input type="number" name="y" inputmode="numeric" min="1900" max="2199" placeholder="Tuỳ chọn" value="' + esc(v.y || '') + '"></label></div>' +
      '<p class="preview" id="preview"></p>' +
      '<button type="button" class="linkbtn" id="swapCal"></button>' +
      '<label class="chk sw"><span>Lặp lại mỗi năm</span><input type="checkbox" name="repeat"' + (v.repeat ? ' checked' : '') + '></label>' +
      '<details class="more"><summary>Tuỳ chọn thêm: nhắc trước, tháng nhuận, ghi chú</summary><div class="more-in">' +
      '<label class="chk" id="leapRow"><input type="checkbox" name="leap"' + (v.leap ? ' checked' : '') + '> Tháng nhuận</label>' +
      '<label>Nhắc trước<select name="remind">' + REMIND.map(function (r) { return '<option value="' + r[0] + '"' + (Number(v.remind) === r[0] ? ' selected' : '') + '>' + r[1] + '</option>'; }).join('') + '</select></label>' +
      '<label>Ghi chú<textarea name="note" rows="2" maxlength="200">' + esc(v.note || '') + '</textarea></label></div></details>' +
      '<p class="err" id="formErr"></p>' +
      '<div class="actions">' + (s ? '<button type="button" class="btn danger" id="delBtn">Xoá</button><span class="grow"></span>' : '') +
      '<button type="button" class="btn" id="cancelBtn">Huỷ</button><button type="submit" class="btn primary">Lưu</button></div></form>';
    dlg.innerHTML = html;
    if (v.leap || v.note || v.remind) $('#spForm .more').open = true;
    syncForm();
    if (!dlg.open) dlg.showModal();
  }

  function readForm() {
    var f = $('#spForm').elements;
    var num = function (n) { var x = parseInt(f[n].value, 10); return isNaN(x) ? null : x; };
    return {
      name: f.name.value.trim(), group: f.group.value, cal: f.cal.value,
      d: num('d'), m: num('m'), y: num('y'),
      leap: f.cal.value === 'lunar' && f.leap.checked, repeat: f.repeat.checked,
      remind: parseInt(f.remind.value, 10) || 0, note: f.note.value.trim()
    };
  }

  function validateForm(v) {
    if (!v.name) return 'Hãy nhập tên.';
    if (!v.d || !v.m) return 'Hãy nhập ngày và tháng.';
    if (v.m < 1 || v.m > 12) return 'Tháng phải từ 1 đến 12.';
    if (v.y != null && (v.y < 1900 || v.y > 2199)) return 'Năm phải từ 1900 đến 2199.';
    if (!v.repeat && v.y == null) return 'Sự kiện một lần cần có năm.';
    if (v.d < 1) return 'Ngày không hợp lệ.';
    if (v.cal === 'solar') {
      if (v.d > L.daysInMonth(v.m, v.y || 2024)) return 'Ngày dương lịch không hợp lệ.';
    } else {
      if (v.d > 30) return 'Ngày âm lịch tối đa là 30.';
      if (v.y != null && !resolveLunar(v.d, v.m, v.y, v.leap)) return 'Ngày âm lịch này không tồn tại (tháng nhuận không có ở năm ' + v.y + ').';
    }
    return '';
  }

  function syncForm() {
    var form = $('#spForm'); if (!form) return;
    var v = readForm();
    $('#leapRow').style.display = v.cal === 'lunar' ? '' : 'none';
    $('#yLbl').textContent = v.group === 'birthday' ? 'Năm sinh' : (v.group === 'memorial' ? 'Năm mất' : 'Năm');
    $('#swapCal').textContent = v.cal === 'solar' ? '⇄ Đổi ngày này sang âm lịch' : '⇄ Đổi ngày này sang dương lịch';
    var p = $('#preview');
    if (!v.d || !v.m || validateForm(Object.assign({}, v, { name: 'x', repeat: true }))) { p.textContent = 'Nhập ngày và tháng để xem ngày quy đổi.'; return; }
    var occ = nextOcc(Object.assign({ id: 'tmp' }, v), state.today);
    if (!occ) { p.textContent = 'Không tìm được ngày tương ứng.'; return; }
    var lu = L.solarToLunar(occ.date.d, occ.date.m, occ.date.y);
    p.textContent = (occ.past ? 'Lần gần nhất (đã qua): ' : 'Lần tới: ') + DOW[dowOf(occ.date)] + ', ' + fmt(occ.date) + ' dương lịch = ' + lunarShort(lu) + ' (' + (occ.past ? -occ.dd + ' ngày trước' : countdown(occ.dd)) + ')';
  }

  function swapCal() {
    var form = $('#spForm'), f = form.elements, v = readForm(), err = $('#formErr');
    err.textContent = '';
    if (!v.d || !v.m) { err.textContent = 'Hãy nhập ngày và tháng trước khi đổi.'; return; }
    var t = state.today;
    if (v.cal === 'solar') {
      var Y = v.y || t.y;
      if (v.d > L.daysInMonth(v.m, Y)) { err.textContent = 'Ngày dương lịch không hợp lệ.'; return; }
      var l = L.solarToLunar(v.d, v.m, Y);
      f.cal.value = 'lunar'; f.d.value = l.d; f.m.value = l.m; f.leap.checked = l.leap; f.y.value = v.y ? l.y : '';
      if (!v.y) err.textContent = 'Đã đổi theo năm ' + Y + '. Ngày âm có thể khác ở các năm khác.';
    } else {
      var LY = v.y || L.solarToLunar(t.d, t.m, t.y).y;
      var r = resolveLunar(v.d, v.m, LY, v.leap);
      if (!r) { err.textContent = 'Ngày âm lịch này không tồn tại ở năm ' + LY + '.'; return; }
      f.cal.value = 'solar'; f.d.value = r.d; f.m.value = r.m; f.leap.checked = false; f.y.value = v.y ? r.y : '';
      if (!v.y) err.textContent = 'Đã đổi theo năm âm lịch ' + LY + '. Ngày dương có thể khác ở các năm khác.';
    }
    syncForm();
  }

  function saveForm() {
    var v = readForm(), msg = validateForm(v);
    if (msg) { $('#formErr').textContent = msg; return; }
    var item = { id: editingId || uid(), name: v.name, group: v.group, cal: v.cal, d: v.d, m: v.m, y: v.y, leap: v.leap, repeat: v.repeat, remind: v.remind, note: v.note };
    var i = state.special.map(function (s) { return s.id; }).indexOf(item.id);
    var old = i >= 0 ? state.special[i] : null;
    if (old && old.shift && old.cal === item.cal && old.d === item.d && old.m === item.m && old.y === item.y && !!old.leap === item.leap) item.shift = old.shift; // giữ "giỗ trước 1 ngày" của dữ liệu cũ
    if (i >= 0) state.special[i] = item; else state.special.push(item);
    persistSpecial();
    dlg.close();
    toast(editingId ? 'Đã cập nhật' : 'Đã thêm "' + item.name + '"');
    render();
  }

  function persistSpecial() {
    yearCache = {};
    if (!LS.set(KEY_SPECIAL, state.special)) toast('Không lưu được dữ liệu trên trình duyệt này');
  }

  function deleteSpecial() {
    var s = state.special.filter(function (x) { return x.id === editingId; })[0];
    if (!s || !confirm('Xoá "' + s.name + '"?')) return;
    state.special = state.special.filter(function (x) { return x.id !== editingId; });
    persistSpecial();
    dlg.close();
    toast('Đã xoá');
    render();
  }

  dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('input', function () { syncForm(); });
  dlg.addEventListener('change', function () { syncForm(); });
  dlg.addEventListener('submit', function (e) {
    e.preventDefault();
    if (e.target.id === 'spForm') saveForm();
  });
  dlg.addEventListener('click', function (e) {
    var id = e.target.id;
    if (id === 'cancelBtn') dlg.close();
    else if (id === 'delBtn') deleteSpecial();
    else if (id === 'swapCal') swapCal();
  });

  /* ---------- Tab: Cài đặt ---------- */
  function fmtTime(ts) {
    if (!ts) return 'chưa kiểm tra';
    var d = new Date(ts + 7 * 3600 * 1000);
    return pad(d.getUTCDate()) + '/' + pad(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear() + ' ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes());
  }
  function renderSettings() {
    var h = state.holidays;
    var html = '<section class="card"><h2>Dữ liệu ngày lễ</h2>' +
      '<div class="set-line"><span>Phiên bản</span><span>' + (h ? esc(h.version) : '—') + '</span></div>' +
      '<div class="set-line"><span>Cập nhật lần cuối</span><span>' + (h ? esc(h.updatedAt || '—') : '—') + '</span></div>' +
      '<div class="set-line"><span>Kiểm tra lần cuối</span><span>' + fmtTime(LS.get(KEY_CHECK, 0)) + '</span></div>' +
      '<div class="btns"><button class="btn primary" data-act="check">Kiểm tra cập nhật</button></div>' +
      '<p class="note">App tự kiểm tra mỗi lần mở khi có mạng. Không có mạng thì dùng bản đã lưu.</p></section>';
    html = '<section class="card"><h2>Hiển thị</h2>' +
      '<label class="set-line sw"><span>Hiện ngày lễ Mỹ (được nghỉ)</span><input type="checkbox" data-set="us"' + (state.set.us ? ' checked' : '') + '></label></section>' + html;
    html += '<section class="card"><h2>Sao lưu dữ liệu</h2>' +
      '<div class="set-line"><span>Sự kiện</span><span>' + state.special.length + '</span></div>' +
      '<div class="btns"><button class="btn" data-act="export">Xuất file JSON</button><button class="btn" data-act="import">Nhập từ file</button></div>' +
      '<p class="note">Dữ liệu chỉ nằm trên máy này. Hãy giữ file sao lưu riêng tư.</p></section>';
    html += '<section class="card"><h2>Ứng dụng</h2>' +
      '<div class="set-line"><span>Múi giờ</span><span>Việt Nam (UTC+7)</span></div>' +
      '<div class="set-line"><span>Phiên bản app</span><span>' + esc(APP_VERSION) + '</span></div>' +
      '<div class="btns"><button class="btn" data-act="checkApp">Kiểm tra bản mới của app</button></div>' +
      (state.installEvt ? '<div class="btns"><button class="btn primary" data-act="install">Cài lên màn hình chính</button></div>' : '') +
      '</section>';
    $('#view').innerHTML = html;
  }

  function fetchHolidays() {
    return fetch('holidays.json', { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (data) {
      if (!data || !Array.isArray(data.fixed)) throw new Error('Sai định dạng');
      return data;
    });
  }
  function checkHolidays(manual) {
    return fetchHolidays().then(function (data) {
      var old = state.holidays;
      var changed = !old || old.version !== data.version || old.updatedAt !== data.updatedAt;
      state.holidays = data;
      LS.set(KEY_HOL, data);
      LS.set(KEY_CHECK, Date.now());
      if (changed) { yearCache = {}; render(); }
      else if (state.tab === 'settings') render();
      if (manual) toast(changed ? 'Đã cập nhật dữ liệu ngày lễ' : 'Dữ liệu ngày lễ đã là mới nhất');
    }).catch(function () {
      if (manual) toast('Không tải được, đang dùng bản đã lưu');
    });
  }

  function exportData() {
    var blob = new Blob([JSON.stringify({ app: 'lich-viet', version: 1, exportedAt: new Date().toISOString(), special: state.special }, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'lich-viet-sao-luu-' + keyOf(state.today) + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
    toast('Đã xuất file sao lưu');
  }

  function sanitize(x) {
    if (!x || typeof x.name !== 'string' || !x.name.trim()) return null;
    var cal = x.cal === 'lunar' ? 'lunar' : 'solar';
    var d = parseInt(x.d, 10), m = parseInt(x.m, 10), y = x.y == null || x.y === '' ? null : parseInt(x.y, 10);
    if (!(d >= 1 && d <= 31 && m >= 1 && m <= 12)) return null;
    if (y != null && !(y >= 1900 && y <= 2199)) y = null;
    var repeat = x.repeat !== false;
    if (!repeat && y == null) repeat = true;
    return {
      id: typeof x.id === 'string' && x.id ? x.id : Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: x.name.trim().slice(0, 60), group: GROUPS[x.group] ? x.group : 'other', cal: cal, d: d, m: m, y: y,
      leap: cal === 'lunar' && !!x.leap, repeat: repeat, remind: [0, 1, 3, 7].indexOf(Number(x.remind)) >= 0 ? Number(x.remind) : 0,
      note: typeof x.note === 'string' ? x.note.slice(0, 200) : '',
      shift: cal === 'lunar' && parseInt(x.shift, 10) ? parseInt(x.shift, 10) : undefined
    };
  }
  function importData(file) {
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var data = JSON.parse(rd.result);
        var arr = Array.isArray(data) ? data : data.special;
        if (arr != null && !Array.isArray(arr)) throw new Error('format');
        var clean = (arr || []).map(sanitize).filter(Boolean);
        if (!clean.length) { toast('File không có dữ liệu hợp lệ'); return; }
        if (!confirm('Nhập ' + clean.length + ' sự kiện? Mục trùng mã sẽ được ghi đè, mục còn lại giữ nguyên.')) return;
        var byId = {};
        state.special.forEach(function (s) { byId[s.id] = s; });
        clean.forEach(function (s) { byId[s.id] = s; });
        state.special = Object.keys(byId).map(function (k) { return byId[k]; });
        persistSpecial();
        toast('Đã nhập dữ liệu');
        render();
      } catch (e) { toast('File không đúng định dạng'); }
    };
    rd.readAsText(file);
  }

  /* ---------- Điều khiển chung ---------- */
  var toastTimer;
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  function render() {
    var titles = { today: 'Hôm nay', cal: 'Lịch', special: 'Sự kiện', settings: 'Cài đặt' };
    if (!titles[state.tab]) state.tab = 'today';
    $('#title').textContent = titles[state.tab];
    document.querySelectorAll('#tabs button').forEach(function (b) { b.setAttribute('aria-current', b.dataset.tab === state.tab ? 'page' : 'false'); });
    $('#settingsBtn').setAttribute('aria-current', state.tab === 'settings' ? 'page' : 'false');
    ({ today: renderToday, cal: renderCal, special: renderSpecial, settings: renderSettings })[state.tab]();
  }
  function goTab(tab) { state.tab = tab; render(); window.scrollTo(0, 0); }

  $('#tabs').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-tab]'); if (b) goTab(b.dataset.tab);
  });
  $('#settingsBtn').addEventListener('click', function () { goTab('settings'); });

  var main = $('#view');
  main.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el) return;
    switch (el.dataset.act) {
      case 'prev': shiftMonth(-1); break;
      case 'next': shiftMonth(1); break;
      case 'goToday': state.view = { y: state.today.y, m: state.today.m }; state.sel = Object.assign({}, state.today); renderCal(); break;
      case 'pick': setSel(parseKey(el.dataset.date)); break;
      case 'addOnDate': openForm(null, { cal: 'solar', d: state.sel.d, m: state.sel.m }); break;
      case 'add': openForm(null); break;
      case 'edit': openForm(el.dataset.id); break;
      case 'filter': state.filter = el.dataset.g; renderSpecialList(); break;
      case 'check': checkHolidays(true); break;
      case 'checkApp': checkAppUpdate(true); break;
      case 'export': exportData(); break;
      case 'import': $('#importFile').click(); break;
      case 'install':
        if (state.installEvt) { state.installEvt.prompt(); state.installEvt = null; }
        break;
    }
  });
  main.addEventListener('input', function (e) {
    if (e.target.id === 'q') { state.q = e.target.value; renderSpecialList(); }
  });
  main.addEventListener('change', function (e) {
    if (e.target.id === 'jump' && e.target.value) setSel(parseKey(e.target.value));
    var k = e.target.dataset && e.target.dataset.set;
    if (k) { state.set[k] = e.target.checked; LS.set(KEY_SET, state.set); yearCache = {}; render(); }
  });
  $('#importFile').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0]; if (f) importData(f); e.target.value = '';
  });

  // Vuốt trái/phải để đổi tháng
  var tx = null, ty = null;
  main.addEventListener('touchstart', function (e) { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
  main.addEventListener('touchend', function (e) {
    if (tx == null || state.tab !== 'cal') { tx = null; return; }
    var dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
    tx = null;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 2) shiftMonth(dx < 0 ? 1 : -1);
  }, { passive: true });

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); state.installEvt = e; if (state.tab === 'settings') render();
  });

  /* ---------- Tự đổi ngày khi qua nửa đêm ---------- */
  function rollover() {
    var n = vnToday();
    if (keyOf(n) === keyOf(state.today)) return;
    var wasOnToday = keyOf(state.sel) === keyOf(state.today);
    state.today = n;
    if (wasOnToday) { state.sel = Object.assign({}, n); state.view = { y: n.y, m: n.m }; }
    if (!dlg.open) render();
  }
  function scheduleMidnight() {
    var ms = 86400000 - ((Date.now() + 7 * 3600 * 1000) % 86400000) + 1000;
    setTimeout(function () { rollover(); scheduleMidnight(); }, ms);
  }
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) { rollover(); checkHolidays(false); checkAppUpdate(false); }
  });

  /* ---------- Cập nhật phiên bản app (service worker) ---------- */
  var swReg = null, updating = false;
  function showUpdateBar(worker) {
    if ($('#updateBar')) return;
    var bar = document.createElement('div');
    bar.id = 'updateBar';
    bar.setAttribute('role', 'alert');
    bar.innerHTML = '<span>Có phiên bản mới của app</span><button class="btn primary" type="button">Cập nhật</button>';
    bar.querySelector('button').addEventListener('click', function () {
      updating = true;
      worker.postMessage({ type: 'SKIP_WAITING' });
    });
    document.body.appendChild(bar);
  }
  function watchWorker(reg) {
    var w = reg.installing;
    if (!w) return;
    w.addEventListener('statechange', function () {
      // Có bản cũ đang chạy thì mới hỏi; lần cài đầu tiên thì không cần
      if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdateBar(w);
    });
  }
  function checkAppUpdate(manual) {
    if (!swReg) { if (manual) toast('Chưa bật chế độ offline trên trình duyệt này'); return; }
    swReg.update().then(function () {
      if (!manual) return;
      // Chờ bản mới (nếu có) tải xong rồi mới báo kết quả
      return new Promise(function (resolve) {
        var t0 = Date.now();
        (function poll() {
          var el = Date.now() - t0;
          if ((el > 600 && !swReg.installing) || el > 8000) return resolve();
          setTimeout(poll, 200);
        })();
      }).then(function () {
        toast(swReg.waiting ? 'Có phiên bản mới, bấm Cập nhật' : 'Bạn đang dùng bản mới nhất');
      });
    }).catch(function () { if (manual) toast('Không kiểm tra được, hãy thử lại khi có mạng'); });
  }
  function initServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      swReg = reg;
      if (reg.waiting && navigator.serviceWorker.controller) showUpdateBar(reg.waiting);
      reg.addEventListener('updatefound', function () { watchWorker(reg); });
      setInterval(function () { checkAppUpdate(false); }, 2 * 3600 * 1000);
    }).catch(function () {});
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (updating) location.reload();
    });
  }
  window.addEventListener('focus', rollover);

  /* ---------- Khởi động ---------- */
  render();
  scheduleMidnight();
  checkHolidays(false);
  window.addEventListener('load', initServiceWorker);
})();
