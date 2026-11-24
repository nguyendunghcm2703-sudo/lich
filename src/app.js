(function () {
  'use strict';
  var L = window.Lunar;
  // build.js thay chuỗi này khi deploy; chạy trực tiếp từ src/ thì hiện "dev"
  var APP_VERSION = '__APP_VERSION__';
  if (APP_VERSION.indexOf('__') === 0) APP_VERSION = 'dev';

  /* ---------- Hằng số & tiện ích ---------- */
  var KEY_SPECIAL = 'lv_special_v1', KEY_HOL = 'lv_holidays_v1', KEY_CHECK = 'lv_hol_checked_v1', KEY_SET = 'lv_settings_v1', KEY_TREE = 'lv_tree_v1';
  var DOW = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
  var DOW_S = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  var ICON = {
    flag: '<svg viewBox="0 0 24 16" aria-hidden="true"><rect width="24" height="16" rx="2.5" fill="#DA251D"/><polygon points="12,2.6 13.6,7.3 18.5,7.3 14.5,10.2 16,14.9 12,12 8,14.9 9.5,10.2 5.5,7.3 10.4,7.3" fill="#FFDE00"/></svg>',
    cake: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="12" width="17" height="8.5" rx="2.2" fill="#E8528C"/><path d="M3.5 15c2 2.2 4.2 2.2 6.2 0s4.2-2.2 6.2 0 3 1.6 4.6 0" fill="none" stroke="#fff" stroke-width="1.5"/><rect x="11.1" y="7.2" width="1.8" height="4.8" rx=".9" fill="#F5B02E"/><path d="M12 2.6c1.3 1.3 1.5 2.6 0 3.8-1.5-1.2-1.3-2.5 0-3.8z" fill="#FF8A3D"/></svg>',
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
    set: Object.assign({ us: false, tree: false }, LS.get(KEY_SET, {})),
    tree: LS.get(KEY_TREE, null),
    holidays: LS.get(KEY_HOL, null),
    filter: 'all',
    q: '',
    installEvt: null
  };
  if (!Array.isArray(state.special)) state.special = [];
  state.special.forEach(function (s) { if (!GROUPS[s.group]) s.group = 'other'; }); // gộp "Kỷ niệm" cũ vào "Khác"
  if (!state.tree || !Array.isArray(state.tree.people) || !Array.isArray(state.tree.roots)) state.tree = { roots: [], people: [] };
  state.tsel = null; state.troot = state.tree.roots.length ? state.tree.roots[0].id : null;
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
      var meta = [cal + (s.repeat ? ' · mỗi năm' : ' · ' + s.y)];
      if (s.link) meta.push('từ Gia phả');
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
    if (old && old.link) { // sửa tay ngày tháng thì tách khỏi Gia phả
      if (old.cal === item.cal && old.d === item.d && old.m === item.m && old.y === item.y && !!old.leap === item.leap) item.link = old.link;
      else unlinkPerson(old.link);
    }
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
    if (s.link) unlinkPerson(s.link);
    persistSpecial();
    dlg.close();
    toast('Đã xoá');
    render();
  }

  dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('input', function () { syncForm(); syncDeath(); });
  dlg.addEventListener('change', function () { syncForm(); syncDeath(); });
  dlg.addEventListener('submit', function (e) {
    e.preventDefault();
    ({ spForm: saveForm, pForm: savePerson, dForm: saveDeath, rForm: saveRoot })[e.target.id]();
  });
  dlg.addEventListener('click', function (e) {
    var id = e.target.id;
    if (id === 'cancelBtn') dlg.close();
    else if (id === 'delBtn') deleteSpecial();
    else if (id === 'swapCal') swapCal();
    else if (id === 'pDel') deletePerson();
    else if (id === 'dClear') clearDeath();
    else if (id === 'rDel') deleteRoot();
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
      '<label class="set-line sw"><span>Hiện Gia phả</span><input type="checkbox" data-set="tree"' + (state.set.tree ? ' checked' : '') + '></label>' +
      '<label class="set-line sw"><span>Hiện ngày lễ Mỹ (được nghỉ)</span><input type="checkbox" data-set="us"' + (state.set.us ? ' checked' : '') + '></label>' +
      '<p class="note">Tắt Gia phả chỉ ẩn đi, dữ liệu vẫn được giữ lại.</p></section>' + html;
    html += '<section class="card"><h2>Sao lưu dữ liệu</h2>' +
      '<div class="set-line"><span>Sự kiện</span><span>' + state.special.length + '</span></div>' +
      '<div class="set-line"><span>Gia phả</span><span>' + state.tree.people.length + ' người</span></div>' +
      '<div class="btns"><button class="btn" data-act="export">Xuất file JSON</button><button class="btn" data-act="import">Nhập từ file</button></div>' +
      '<p class="note">Dữ liệu chỉ nằm trên máy này. Hãy xuất file để sao lưu hoặc chuyển sang điện thoại khác.</p></section>';
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
    var blob = new Blob([JSON.stringify({ app: 'lich-viet', version: 1, exportedAt: new Date().toISOString(), special: state.special, tree: state.tree }, null, 2)], { type: 'application/json' });
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
      link: typeof x.link === 'string' ? x.link : undefined
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
        var tr = data && !Array.isArray(data) ? sanitizeTree(data.tree) : null;
        if (!clean.length && !(tr && tr.people.length)) { toast('File không có dữ liệu hợp lệ'); return; }
        if (!confirm('Nhập ' + clean.length + ' sự kiện' + (tr ? ' và ' + tr.people.length + ' người trong gia phả' : '') + '? Mục trùng mã sẽ được ghi đè, mục còn lại giữ nguyên.')) return;
        var byId = {};
        state.special.forEach(function (s) { byId[s.id] = s; });
        clean.forEach(function (s) { byId[s.id] = s; });
        state.special = Object.keys(byId).map(function (k) { return byId[k]; });
        persistSpecial();
        if (tr) {
          var pm = {}, rm = {};
          state.tree.people.forEach(function (x) { pm[x.id] = x; }); tr.people.forEach(function (x) { pm[x.id] = x; });
          state.tree.roots.forEach(function (x) { rm[x.id] = x; }); tr.roots.forEach(function (x) { rm[x.id] = x; });
          state.tree = { roots: Object.keys(rm).map(function (k) { return rm[k]; }), people: Object.keys(pm).map(function (k) { return pm[k]; }) };
          if (!rm[state.troot]) state.troot = state.tree.roots.length ? state.tree.roots[0].id : null;
          persistTree();
        }
        toast('Đã nhập dữ liệu');
        render();
      } catch (e) { toast('File không đúng định dạng'); }
    };
    rd.readAsText(file);
  }

  /* ---------- Gia phả ---------- */
  var CW = 88, CH = 54, CG = 8, SG = 16, LG = 58, PAD = 24;
  var tv = { x: 0, y: 0, k: 1 }, tvFit = true, tsize = null;
  var pctx = null, dctx = null, rctx = null;

  function persistTree() { if (!LS.set(KEY_TREE, state.tree)) toast('Không lưu được dữ liệu trên trình duyệt này'); }
  function personById(id) { var a = state.tree.people; for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i]; return null; }
  function rootById(id) { return state.tree.roots.filter(function (r) { return r.id === id; })[0] || null; }
  function headOf(p) { return p.isSpouse && p.spouse ? (personById(p.spouse) || p) : p; }
  function childrenOf(hid) { return state.tree.people.filter(function (x) { return x.parent === hid && !x.isSpouse; }); }
  function rootDepth(p) {
    var h = headOf(p), depth = 0, guard = 0;
    while (h.parent && guard++ < 60) { var up = personById(h.parent); if (!up) break; h = headOf(up); depth++; }
    var r = state.tree.roots.filter(function (x) { return x.personId === h.id; })[0] || null;
    return { root: r, depth: depth };
  }
  function genOf(p) { var rd = rootDepth(p); return rd.root ? rd.root.gen + rd.depth : null; }
  function descOf(root, gen) {
    var a = [root.clan, root.branch].filter(Boolean).join(' ');
    return (a ? a + ' · ' : '') + 'đời thứ ' + gen;
  }
  function collect(hid, out, seen) {
    seen = seen || {};
    if (seen[hid]) return out; seen[hid] = 1;
    var h = personById(hid); if (!h) return out;
    out.push(h.id); if (h.spouse) out.push(h.spouse);
    childrenOf(hid).forEach(function (c) { collect(c.id, out, seen); });
    return out;
  }
  function unlinkPerson(pid) { var p = personById(pid); if (p && p.evId) { p.evId = null; persistTree(); } }
  function linkedEvent(p) { return p.evId ? state.special.filter(function (s) { return s.id === p.evId; })[0] || null : null; }

  function deathLunar(p) {
    var dd = p.dead && p.death; if (!dd) return null;
    if (dd.cal === 'lunar') return { d: dd.d, m: dd.m, y: dd.y || null, leap: !!dd.leap };
    var Y = dd.y || state.today.y;
    if (dd.d > L.daysInMonth(dd.m, Y)) return null;
    var l = L.solarToLunar(dd.d, dd.m, Y);
    return { d: l.d, m: l.m, y: dd.y ? l.y : null, leap: l.leap };
  }
  function syncDeathEvent(p) {
    var dl = deathLunar(p); if (!dl) return;
    var old = linkedEvent(p);
    var ev = { id: old ? old.id : uid(), name: 'Giỗ ' + p.name, group: 'memorial', cal: 'lunar', d: dl.d, m: dl.m, y: dl.y, leap: dl.leap, repeat: true, remind: old ? old.remind : 0, note: old ? old.note : '', link: p.id };
    if (old) state.special[state.special.indexOf(old)] = ev; else state.special.push(ev);
    p.evId = ev.id;
    persistSpecial();
  }
  function removeDeathEvent(p) {
    if (p.evId) { state.special = state.special.filter(function (s) { return s.id !== p.evId; }); p.evId = null; persistSpecial(); }
  }

  function sanitizeTree(t) {
    if (!t || !Array.isArray(t.people) || !Array.isArray(t.roots)) return null;
    var int = function (v, a, b) { var n = parseInt(v, 10); return n >= a && n <= b ? n : null; };
    var str = function (v, n) { return typeof v === 'string' ? v.trim().slice(0, n) : ''; };
    var people = t.people.map(function (x) {
      if (!x || typeof x.id !== 'string' || !str(x.name, 60)) return null;
      var dd = x.dead && x.death && int(x.death.d, 1, 31) && int(x.death.m, 1, 12) ? x.death : null;
      return {
        id: x.id, name: str(x.name, 60), sex: x.sex === 'f' ? 'f' : 'm', note: str(x.note, 60),
        bd: int(x.bd, 1, 31), bm: int(x.bm, 1, 12), by: int(x.by, 1000, 2199),
        dead: !!dd, death: dd ? { cal: dd.cal === 'solar' ? 'solar' : 'lunar', d: int(dd.d, 1, 31), m: int(dd.m, 1, 12), y: int(dd.y, 1000, 2199), leap: !!dd.leap } : null,
        evId: typeof x.evId === 'string' ? x.evId : null, spouse: typeof x.spouse === 'string' ? x.spouse : null,
        isSpouse: !!x.isSpouse, parent: typeof x.parent === 'string' ? x.parent : null
      };
    }).filter(Boolean);
    var roots = t.roots.map(function (r) {
      if (!r || typeof r.id !== 'string' || typeof r.personId !== 'string') return null;
      return { id: r.id, name: str(r.name, 30) || 'Nhánh', clan: str(r.clan, 30), branch: str(r.branch, 30), gen: int(r.gen, 1, 99) || 1, personId: r.personId };
    }).filter(Boolean);
    return { roots: roots, people: people };
  }

  /* --- bố cục cây --- */
  function layoutTree(head) {
    var items = [], lines = [], seen = {}, maxD = 0;
    function build(h) {
      seen[h.id] = 1;
      var sp = h.spouse ? personById(h.spouse) : null;
      var kids = childrenOf(h.id).filter(function (c) { return !seen[c.id]; }).map(build);
      var nw = sp ? 2 * CW + CG : CW;
      var kw = kids.reduce(function (a, k) { return a + k.w; }, 0) + Math.max(0, kids.length - 1) * SG;
      return { h: h, sp: sp, kids: kids, nw: nw, kw: kw, w: Math.max(nw, kw) };
    }
    function place(n, left, depth) {
      var y = depth * (CH + LG) + PAD, x0 = left + n.w / 2 - n.nw / 2, cx = left + n.w / 2;
      if (depth > maxD) maxD = depth;
      items.push({ p: n.h, x: x0, y: y });
      if (n.sp) { items.push({ p: n.sp, x: x0 + CW + CG, y: y }); lines.push([x0 + CW, y + CH / 2, x0 + CW + CG, y + CH / 2]); }
      n.ax = x0 + CW / 2;
      if (n.kids.length) {
        var cur = cx - n.kw / 2;
        n.kids.forEach(function (k) { place(k, cur, depth + 1); cur += k.w + SG; });
        var ym = y + CH + LG / 2, y0 = n.sp ? y + CH / 2 : y + CH;
        lines.push([cx, y0, cx, ym]);
        lines.push([Math.min(cx, n.kids[0].ax), ym, Math.max(cx, n.kids[n.kids.length - 1].ax), ym]);
        n.kids.forEach(function (k) { lines.push([k.ax, ym, k.ax, k.y]); });
      }
      n.y = y;
    }
    var root = build(head);
    place(root, PAD, 0);
    return { items: items, lines: lines, w: root.w + 2 * PAD, h: (maxD + 1) * CH + maxD * LG + 2 * PAD };
  }

  function yearsOf(p) {
    if (p.dead) { var dy = p.death && p.death.y; return p.by || dy ? (p.by || '?') + ' – ' + (dy || '?') : ''; }
    return p.by ? String(p.by) : '';
  }
  function personInfo(p) {
    var a = [];
    if (p.note) a.push(p.note);
    if (p.by) a.push('sinh ' + (p.bd && p.bm ? p.bd + '/' + p.bm + '/' : '') + p.by);
    if (p.dead && p.death) {
      var dd = p.death, dl = deathLunar(p);
      a.push('mất ' + (dd.cal === 'lunar' ? dd.d + '/' + dd.m + ' âm' + (dd.y ? ' ' + dd.y : '') : dd.d + '/' + dd.m + (dd.y ? '/' + dd.y : '')));
      if (dl) a.push('giỗ ' + dl.d + '/' + dl.m + ' âm lịch');
    } else if (p.dead) a.push('đã mất');
    return a.join(' · ');
  }

  function renderTree() {
    var T = state.tree;
    var cur = rootById(state.troot) || T.roots[0] || null;
    var top = ($('.appbar') || { offsetHeight: 56 }).offsetHeight;
    var html = '<div class="tree-screen" style="top:' + top + 'px">';
    if (!cur || !personById(cur.personId)) {
      html += '<div class="tree-empty"><section class="card"><h2>Gia phả</h2><p class="note" style="margin:0 0 12px">Chưa có gia phả. Bắt đầu từ người đời đầu tiên mà bạn muốn ghi, rồi thêm vợ/chồng và con cháu.</p><button class="btn primary block" data-act="tAddRoot">＋ Thêm gốc</button></section></div></div>';
      $('#view').innerHTML = html; tsize = null; return;
    }
    state.troot = cur.id;
    var sel = state.tsel ? personById(state.tsel) : null;
    if (sel && (!rootDepth(sel).root || rootDepth(sel).root.id !== cur.id)) { sel = null; state.tsel = null; }
    var lay = layoutTree(personById(cur.personId));
    tsize = { w: lay.w, h: lay.h };

    html += '<div class="tree-top">' + T.roots.map(function (r) {
      return '<button class="fchip" data-act="tBranch" data-id="' + esc(r.id) + '" aria-pressed="' + (r.id === cur.id) + '">' + esc(r.name) + '</button>';
    }).join('') + '<button class="fchip add" data-act="tAddRoot">＋ Thêm gốc</button></div>';
    html += '<div class="tree-desc"><span>' + esc(sel ? descOf(cur, genOf(sel)) : descOf(cur, cur.gen) + ' (người gốc)') + '</span><button class="linkbtn" data-act="tEditRoot">Sửa nhánh</button></div>';

    html += '<div class="tree-vp" id="tvp"><div class="tree-world" id="tworld" style="width:' + lay.w + 'px;height:' + lay.h + 'px">' +
      '<svg width="' + lay.w + '" height="' + lay.h + '" aria-hidden="true">' + lay.lines.map(function (l) {
        return '<line x1="' + l[0] + '" y1="' + l[1] + '" x2="' + l[2] + '" y2="' + l[3] + '"/>';
      }).join('') + '</svg>' + lay.items.map(function (it) {
        var p = it.p;
        return '<div class="pc ' + p.sex + (p.dead ? ' dead' : '') + (sel && sel.id === p.id ? ' sel' : '') + '" data-pid="' + esc(p.id) + '" style="left:' + it.x + 'px;top:' + it.y + 'px">' +
          '<b>' + esc(p.name) + '</b><i>' + esc(yearsOf(p)) + '</i>' + (p.dead ? '<span class="pl">' + ICON.lotus + '</span>' : '') + '</div>';
      }).join('') + '</div></div>';
    html += '<div class="tree-fabs"><button data-act="tZoomIn" aria-label="Phóng to">＋</button><button data-act="tZoomOut" aria-label="Thu nhỏ">−</button><button data-act="tFit" aria-label="Vừa khung">⤢</button></div>';
    if (!sel) html += '<div class="tree-hint">Kéo để di chuyển · Chụm hai ngón để phóng to · Chạm vào một người</div>';
    else {
      var g = genOf(sel);
      html += '<div class="tree-bar"><div class="tb-name">' + esc(sel.name) + (sel.dead ? '<span class="pl">' + ICON.lotus + '</span>' : '') + '</div>' +
        '<div class="tb-sub">' + esc(personInfo(sel) || '—') + '</div>' +
        '<div class="tb-sub">' + esc(g ? descOf(cur, g) : '') + '</div>' +
        '<div class="tb-btns"><button data-act="tEdit">Sửa</button><button class="death" data-act="tDeath">Ngày giỗ</button>' +
        '<button data-act="tSpouse"' + (sel.spouse ? ' disabled' : '') + '>＋ Vợ/chồng</button><button data-act="tChild">＋ Con</button></div></div>';
    }
    html += '</div>';
    $('#view').innerHTML = html;
    if (tvFit) { fitTree(); tvFit = false; } else applyTv();
    bindTree();
  }

  function applyTv() {
    var w = $('#tworld'); if (!w) return;
    w.style.transform = 'translate(' + tv.x + 'px,' + tv.y + 'px) scale(' + tv.k + ')';
  }
  function fitTree() {
    var vp = $('#tvp'); if (!vp || !tsize) return;
    var vw = vp.clientWidth, vh = vp.clientHeight;
    var k = Math.max(0.2, Math.min(vw / tsize.w, vh / tsize.h, 1));
    tv = { k: k, x: (vw - tsize.w * k) / 2, y: Math.max(0, (vh - tsize.h * k) / 2) };
    applyTv();
  }
  function zoomAt(f, cx, cy) {
    var k = Math.max(0.2, Math.min(3, tv.k * f)), r = k / tv.k;
    tv.x = cx - (cx - tv.x) * r; tv.y = cy - (cy - tv.y) * r; tv.k = k; applyTv();
  }
  function zoomBy(f) { var vp = $('#tvp'); if (vp) zoomAt(f, vp.clientWidth / 2, vp.clientHeight / 2); }

  function bindTree() {
    var vp = $('#tvp'); if (!vp) return;
    var ptrs = {}, drag = null, pinch = null;
    var rel = function (e) { var r = vp.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    var ids = function () { return Object.keys(ptrs); };
    var startPinch = function () {
      var a = ptrs[ids()[0]], b = ptrs[ids()[1]];
      var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, k: tv.k, wx: (mx - tv.x) / tv.k, wy: (my - tv.y) / tv.k };
    };
    vp.addEventListener('pointerdown', function (e) {
      ptrs[e.pointerId] = rel(e);
      try { vp.setPointerCapture(e.pointerId); } catch (x) {}
      if (ids().length === 1) {
        var c = e.target.closest ? e.target.closest('[data-pid]') : null;
        drag = { sx: ptrs[e.pointerId].x, sy: ptrs[e.pointerId].y, ox: tv.x, oy: tv.y, moved: false, pid: c ? c.dataset.pid : null };
      } else if (ids().length === 2) { drag = null; startPinch(); }
    });
    vp.addEventListener('pointermove', function (e) {
      if (!ptrs[e.pointerId]) return;
      ptrs[e.pointerId] = rel(e);
      if (pinch && ids().length >= 2) {
        var a = ptrs[ids()[0]], b = ptrs[ids()[1]];
        var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        var k = Math.max(0.2, Math.min(3, pinch.k * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d));
        tv.k = k; tv.x = mx - pinch.wx * k; tv.y = my - pinch.wy * k; applyTv();
      } else if (drag) {
        var p = ptrs[e.pointerId], dx = p.x - drag.sx, dy = p.y - drag.sy;
        if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 8) drag.moved = true;
        if (drag.moved) { tv.x = drag.ox + dx; tv.y = drag.oy + dy; applyTv(); }
      }
    });
    var up = function (e) {
      if (!ptrs[e.pointerId]) return;
      var d = drag; delete ptrs[e.pointerId];
      if (ids().length < 2) pinch = null;
      if (ids().length === 1) { var q = ptrs[ids()[0]]; drag = { sx: q.x, sy: q.y, ox: tv.x, oy: tv.y, moved: true, pid: null }; }
      else drag = null;
      if (e.type === 'pointerup' && d && !d.moved && d.pid && ids().length === 0) { state.tsel = d.pid; renderTree(); }
      else if (e.type === 'pointerup' && d && !d.moved && !d.pid && ids().length === 0 && state.tsel) { state.tsel = null; renderTree(); }
    };
    vp.addEventListener('pointerup', up);
    vp.addEventListener('pointercancel', up);
    vp.addEventListener('wheel', function (e) {
      e.preventDefault();
      var p = rel(e); zoomAt(Math.exp(-e.deltaY * 0.0015), p.x, p.y);
    }, { passive: false });
  }

  /* --- form: nhánh / gốc --- */
  function sexSeg(v) {
    return '<div class="seg" role="group" aria-label="Giới tính"><label><input type="radio" name="sex" value="m"' + (v !== 'f' ? ' checked' : '') + '><span>Nam</span></label>' +
      '<label><input type="radio" name="sex" value="f"' + (v === 'f' ? ' checked' : '') + '><span>Nữ</span></label></div>';
  }
  function openRootForm(id) {
    var r = id ? rootById(id) : null; if (id && !r) return;
    rctx = r ? r.id : null;
    var v = r || { name: state.tree.roots.length ? 'Nhánh ' + (state.tree.roots.length + 1) : 'Nhánh nội', clan: '', branch: '', gen: 1 };
    dlg.innerHTML = '<form class="form" id="rForm" novalidate autocomplete="off"><h2>' + (r ? 'Sửa nhánh' : 'Thêm gốc') + '</h2>' +
      '<label>Tên nhánh<input type="text" name="rname" maxlength="30" placeholder="VD: Nhánh nội" value="' + esc(v.name) + '"></label>' +
      '<div class="row2"><label>Họ / tộc<input type="text" name="clan" maxlength="30" placeholder="VD: Nguyễn" value="' + esc(v.clan) + '"></label>' +
      '<label>Chi / phái<input type="text" name="branch" maxlength="30" placeholder="VD: đệ ngũ" value="' + esc(v.branch) + '"></label></div>' +
      '<label>Người gốc ở đời thứ<input type="number" name="gen" inputmode="numeric" min="1" max="99" value="' + esc(v.gen) + '"></label>' +
      '<p class="note" style="margin:0">Hiển thị dạng: “Nguyễn đệ ngũ · đời thứ 10”. Đời của con cháu tự tính theo người gốc.</p>' +
      (r ? '' : '<div class="lbl">Người gốc</div><label>Họ tên<input type="text" name="pname" maxlength="60" placeholder="VD: Nguyễn Văn An"></label>' + sexSeg('m')) +
      '<p class="err" id="formErr"></p><div class="actions">' + (r ? '<button type="button" class="btn danger" id="rDel">Xoá nhánh</button><span class="grow"></span>' : '') +
      '<button type="button" class="btn" id="cancelBtn">Huỷ</button><button type="submit" class="btn primary">Lưu</button></div></form>';
    if (!dlg.open) dlg.showModal();
  }
  function saveRoot() {
    var f = $('#rForm').elements, err = $('#formErr');
    var name = f.rname.value.trim(), gen = parseInt(f.gen.value, 10);
    if (!name) { err.textContent = 'Hãy nhập tên nhánh.'; return; }
    if (!(gen >= 1 && gen <= 99)) { err.textContent = 'Đời phải từ 1 đến 99.'; return; }
    var vals = { name: name, clan: f.clan.value.trim(), branch: f.branch.value.trim(), gen: gen };
    if (rctx) Object.assign(rootById(rctx), vals);
    else {
      var pn = f.pname.value.trim();
      if (!pn) { err.textContent = 'Hãy nhập họ tên người gốc.'; return; }
      var p = { id: uid(), name: pn, sex: f.sex.value === 'f' ? 'f' : 'm', note: '', bd: null, bm: null, by: null, dead: false, death: null, evId: null, spouse: null, isSpouse: false, parent: null };
      var r = Object.assign({ id: uid(), personId: p.id }, vals);
      state.tree.people.push(p); state.tree.roots.push(r);
      state.troot = r.id; state.tsel = null; tvFit = true;
    }
    persistTree(); dlg.close(); toast('Đã lưu'); render();
  }
  function removePeople(idSet) {
    var evs = [];
    state.tree.people.forEach(function (p) { if (idSet[p.id] && p.evId && linkedEvent(p)) evs.push(p.evId); });
    if (evs.length) {
      if (confirm('Xoá luôn ' + evs.length + ' ngày giỗ tương ứng trong Sự kiện?\nBấm Huỷ để giữ lại các sự kiện.')) state.special = state.special.filter(function (s) { return evs.indexOf(s.id) < 0; });
      else state.special.forEach(function (s) { if (evs.indexOf(s.id) >= 0) delete s.link; });
      persistSpecial();
    }
    state.tree.people = state.tree.people.filter(function (p) { return !idSet[p.id]; });
    if (idSet[state.tsel]) state.tsel = null;
  }
  function deleteRoot() {
    var r = rootById(rctx); if (!r) return;
    var ids = collect(r.personId, []);
    if (!confirm('Xoá nhánh “' + r.name + '” và ' + ids.length + ' người trong nhánh này?')) return;
    var set = {}; ids.forEach(function (i) { set[i] = 1; });
    removePeople(set);
    state.tree.roots = state.tree.roots.filter(function (x) { return x.id !== r.id; });
    state.troot = state.tree.roots.length ? state.tree.roots[0].id : null; tvFit = true;
    persistTree(); dlg.close(); toast('Đã xoá nhánh'); render();
  }

  /* --- form: người --- */
  function openPersonForm(id, ctx) {
    var p = id ? personById(id) : null; if (id && !p) return;
    pctx = { id: id || null, kind: ctx && ctx.kind, of: ctx && ctx.of };
    var base = p || { name: '', sex: 'm', note: '', bd: '', bm: '', by: '' };
    if (!p && ctx && ctx.kind === 'spouse') { var o = personById(ctx.of); if (!o || o.spouse) return; base = Object.assign({}, base, { sex: o.sex === 'm' ? 'f' : 'm' }); }
    if (!p && ctx && ctx.kind === 'child' && !personById(ctx.of)) return;
    var title = p ? 'Sửa thông tin' : (ctx && ctx.kind === 'spouse' ? 'Thêm vợ/chồng' : 'Thêm con');
    dlg.innerHTML = '<form class="form" id="pForm" novalidate autocomplete="off"><h2>' + title + '</h2>' +
      '<label>Họ tên<input type="text" name="pname" maxlength="60" placeholder="VD: Nguyễn Văn Bình" value="' + esc(base.name) + '"></label>' + sexSeg(base.sex) +
      '<label>Quan hệ / ghi chú<input type="text" name="note" maxlength="60" placeholder="VD: Ông nội, con trưởng…" value="' + esc(base.note || '') + '"></label>' +
      '<div class="lbl">Ngày sinh (không bắt buộc)</div><div class="row3"><label>Ngày<input type="number" name="bd" inputmode="numeric" min="1" max="31" value="' + esc(base.bd || '') + '"></label>' +
      '<label>Tháng<input type="number" name="bm" inputmode="numeric" min="1" max="12" value="' + esc(base.bm || '') + '"></label>' +
      '<label>Năm<input type="number" name="by" inputmode="numeric" min="1000" max="2199" value="' + esc(base.by || '') + '"></label></div>' +
      '<p class="note" style="margin:0">Mặc định là còn sống. Muốn ghi ngày mất, bấm “Ngày giỗ” trên thẻ người đó.</p>' +
      '<p class="err" id="formErr"></p><div class="actions">' + (p ? '<button type="button" class="btn danger" id="pDel">Xoá</button><span class="grow"></span>' : '') +
      '<button type="button" class="btn" id="cancelBtn">Huỷ</button><button type="submit" class="btn primary">Lưu</button></div></form>';
    if (!dlg.open) dlg.showModal();
  }
  function savePerson() {
    var f = $('#pForm').elements, err = $('#formErr');
    var num = function (n) { var x = parseInt(f[n].value, 10); return isNaN(x) ? null : x; };
    var name = f.pname.value.trim(), bd = num('bd'), bm = num('bm'), by = num('by');
    if (!name) { err.textContent = 'Hãy nhập họ tên.'; return; }
    if ((bd && (bd < 1 || bd > 31)) || (bm && (bm < 1 || bm > 12))) { err.textContent = 'Ngày hoặc tháng sinh không hợp lệ.'; return; }
    if (by != null && (by < 1000 || by > 2199)) { err.textContent = 'Năm sinh không hợp lệ.'; return; }
    var vals = { name: name, sex: f.sex.value === 'f' ? 'f' : 'm', note: f.note.value.trim(), bd: bd, bm: bm, by: by };
    var p;
    if (pctx.id) {
      p = personById(pctx.id); Object.assign(p, vals);
      var ev = linkedEvent(p); if (ev) { ev.name = 'Giỗ ' + p.name; persistSpecial(); }
    } else {
      var of = personById(pctx.of);
      p = Object.assign({ id: uid(), dead: false, death: null, evId: null, spouse: null, isSpouse: false, parent: null }, vals);
      if (pctx.kind === 'spouse') { if (!of || of.spouse) return; p.isSpouse = true; p.spouse = of.id; of.spouse = p.id; }
      else { if (!of) return; p.parent = headOf(of).id; }
      state.tree.people.push(p); tvFit = true;
    }
    state.tsel = p.id;
    persistTree(); dlg.close(); toast('Đã lưu'); render();
  }
  function deletePerson() {
    var p = personById(pctx.id); if (!p) return;
    var ids, set = {};
    if (p.isSpouse) ids = [p.id]; else ids = collect(p.id, []);
    if (!confirm(ids.length > 1 ? 'Xoá “' + p.name + '” và ' + (ids.length - 1) + ' người liên quan (vợ/chồng, con cháu)?' : 'Xoá “' + p.name + '”?')) return;
    ids.forEach(function (i) { set[i] = 1; });
    if (p.isSpouse) { var h = personById(p.spouse); if (h) h.spouse = null; }
    removePeople(set);
    var r = state.tree.roots.filter(function (x) { return set[x.personId]; })[0];
    if (r) { state.tree.roots = state.tree.roots.filter(function (x) { return x.id !== r.id; }); state.troot = state.tree.roots.length ? state.tree.roots[0].id : null; tvFit = true; }
    persistTree(); dlg.close(); toast('Đã xoá'); render();
  }

  /* --- form: ngày giỗ / ngày mất --- */
  function openDeathForm(id) {
    var p = personById(id); if (!p) return;
    dctx = p.id;
    var dd = p.dead && p.death ? p.death : { cal: 'lunar', d: '', m: '', y: '', leap: false };
    dlg.innerHTML = '<form class="form" id="dForm" novalidate autocomplete="off"><h2>Ngày giỗ · ' + esc(p.name) + '</h2>' +
      '<div class="seg" role="group" aria-label="Loại lịch"><label><input type="radio" name="dcal" value="solar"' + (dd.cal === 'solar' ? ' checked' : '') + '><span>Dương lịch</span></label>' +
      '<label><input type="radio" name="dcal" value="lunar"' + (dd.cal === 'lunar' ? ' checked' : '') + '><span>Âm lịch</span></label></div>' +
      '<div class="row3"><label>Ngày mất<input type="number" name="d" inputmode="numeric" min="1" max="31" value="' + esc(dd.d || '') + '"></label>' +
      '<label>Tháng<input type="number" name="m" inputmode="numeric" min="1" max="12" value="' + esc(dd.m || '') + '"></label>' +
      '<label>Năm mất<input type="number" name="y" inputmode="numeric" min="1000" max="2199" placeholder="VD: 2022" value="' + esc(dd.y || '') + '"></label></div>' +
      '<label class="chk" id="dLeap"><input type="checkbox" name="leap"' + (dd.leap ? ' checked' : '') + '> Tháng nhuận</label>' +
      '<p class="preview" id="dprev"></p>' +
      '<label class="chk sw"><span>Thêm vào Sự kiện (Giỗ hằng năm)</span><input type="checkbox" name="ev"' + (linkedEvent(p) ? ' checked' : '') + '></label>' +
      '<p class="note" style="margin:0">Tắt: chỉ hiện ngày này trong cây gia phả, không nhắc trong lịch.</p>' +
      '<p class="err" id="formErr"></p><div class="actions">' + (p.dead ? '<button type="button" class="btn danger" id="dClear">Xoá ngày mất</button><span class="grow"></span>' : '') +
      '<button type="button" class="btn" id="cancelBtn">Huỷ</button><button type="submit" class="btn primary">Lưu</button></div></form>';
    syncDeath();
    if (!dlg.open) dlg.showModal();
  }
  function readDeath() {
    var f = $('#dForm').elements, num = function (n) { var x = parseInt(f[n].value, 10); return isNaN(x) ? null : x; };
    return { cal: f.dcal.value, d: num('d'), m: num('m'), y: num('y'), leap: f.dcal.value === 'lunar' && f.leap.checked, ev: f.ev.checked };
  }
  function validDeath(v) {
    if (!v.d || !v.m) return 'Hãy nhập ngày và tháng.';
    if (v.m < 1 || v.m > 12 || v.d < 1) return 'Ngày hoặc tháng không hợp lệ.';
    if (v.y != null && (v.y < 1000 || v.y > 2199)) return 'Năm mất không hợp lệ.';
    if (v.cal === 'solar') { if (v.d > L.daysInMonth(v.m, v.y || 2024)) return 'Ngày dương lịch không hợp lệ.'; }
    else {
      if (v.d > 30) return 'Ngày âm lịch tối đa là 30.';
      if (v.y != null && (v.y < 1900) ) return '';
      if (v.y != null && !resolveLunar(v.d, v.m, v.y, v.leap)) return 'Ngày âm lịch này không tồn tại ở năm ' + v.y + '.';
    }
    return '';
  }
  function syncDeath() {
    var form = $('#dForm'); if (!form) return;
    var v = readDeath();
    $('#dLeap').style.display = v.cal === 'lunar' ? '' : 'none';
    var pv = $('#dprev');
    if (!v.d || !v.m || validDeath(v)) { pv.textContent = 'Nhập ngày và tháng để xem ngày quy đổi.'; return; }
    var Y = v.y || state.today.y;
    if (v.cal === 'solar') {
      var l = L.solarToLunar(v.d, v.m, Y);
      pv.textContent = 'Ngày giỗ hằng năm: ' + l.d + '/' + l.m + (l.leap ? ' nhuận' : '') + ' âm lịch' + (v.y ? '' : ' (tính theo năm ' + Y + ')');
    } else {
      var r = resolveLunar(v.d, v.m, Y, v.leap);
      pv.textContent = r ? 'Tương đương ' + pad(r.d) + '/' + pad(r.m) + '/' + r.y + ' dương lịch' + (v.y ? '' : ' (năm ' + Y + ')') : 'Không tìm được ngày tương ứng.';
    }
  }
  function saveDeath() {
    var v = readDeath(), msg = validDeath(v), p = personById(dctx);
    if (msg) { $('#formErr').textContent = msg; return; }
    if (!p) return;
    p.dead = true; p.death = { cal: v.cal, d: v.d, m: v.m, y: v.y, leap: v.leap };
    if (v.ev) syncDeathEvent(p); else removeDeathEvent(p);
    persistTree(); dlg.close(); toast(v.ev ? 'Đã lưu và thêm vào Sự kiện' : 'Đã lưu'); render();
  }
  function clearDeath() {
    var p = personById(dctx); if (!p) return;
    if (!confirm('Xoá ngày mất của “' + p.name + '”? Ngày giỗ trong Sự kiện (nếu có) cũng sẽ bị xoá.')) return;
    p.dead = false; p.death = null; removeDeathEvent(p);
    persistTree(); dlg.close(); toast('Đã xoá ngày mất'); render();
  }

  /* ---------- Điều khiển chung ---------- */
  var toastTimer;
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  function render() {
    var titles = { today: 'Hôm nay', cal: 'Lịch', special: 'Sự kiện', settings: 'Cài đặt', tree: 'Gia phả' };
    if (state.tab === 'tree' && !state.set.tree) state.tab = 'settings';
    $('#treeBtn').hidden = !state.set.tree;
    $('#treeBtn').setAttribute('aria-current', state.tab === 'tree' ? 'page' : 'false');
    document.body.classList.toggle('on-tree', state.tab === 'tree');
    $('#title').textContent = titles[state.tab];
    document.querySelectorAll('#tabs button').forEach(function (b) { b.setAttribute('aria-current', b.dataset.tab === state.tab ? 'page' : 'false'); });
    $('#settingsBtn').setAttribute('aria-current', state.tab === 'settings' ? 'page' : 'false');
    ({ today: renderToday, cal: renderCal, special: renderSpecial, settings: renderSettings, tree: renderTree })[state.tab]();
  }
  function goTab(tab) { state.tab = tab; if (tab === 'tree') tvFit = true; render(); window.scrollTo(0, 0); }

  $('#tabs').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-tab]'); if (b) goTab(b.dataset.tab);
  });
  $('#settingsBtn').addEventListener('click', function () { goTab('settings'); });
  $('#treeBtn').addEventListener('click', function () { goTab('tree'); });

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
      case 'tBranch': state.troot = el.dataset.id; state.tsel = null; tvFit = true; renderTree(); break;
      case 'tAddRoot': openRootForm(null); break;
      case 'tEditRoot': openRootForm(state.troot); break;
      case 'tZoomIn': zoomBy(1.25); break;
      case 'tZoomOut': zoomBy(0.8); break;
      case 'tFit': fitTree(); break;
      case 'tEdit': openPersonForm(state.tsel); break;
      case 'tDeath': openDeathForm(state.tsel); break;
      case 'tSpouse': openPersonForm(null, { kind: 'spouse', of: state.tsel }); break;
      case 'tChild': openPersonForm(null, { kind: 'child', of: state.tsel }); break;
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
