/* Lõi âm lịch Việt Nam (múi giờ UTC+7)
 * Dựa trên thuật toán thiên văn của Hồ Ngọc Đức (https://www.informatik.uni-leipzig.de/~duc/amlich/)
 * Chạy hoàn toàn offline, không cần API. */
(function (global) {
  'use strict';
  var TZ = 7;
  var PI = Math.PI;

  function jdFromDate(dd, mm, yy) {
    var a = Math.floor((14 - mm) / 12);
    var y = yy + 4800 - a;
    var m = mm + 12 * a - 3;
    var jd = dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
    if (jd < 2299161) jd = dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083;
    return jd;
  }

  function jdToDate(jd) {
    var a, b, c;
    if (jd > 2299160) {
      a = jd + 32044;
      b = Math.floor((4 * a + 3) / 146097);
      c = a - Math.floor((b * 146097) / 4);
    } else {
      b = 0;
      c = jd + 32082;
    }
    var d = Math.floor((4 * c + 3) / 1461);
    var e = c - Math.floor((1461 * d) / 4);
    var m = Math.floor((5 * e + 2) / 153);
    var day = e - Math.floor((153 * m + 2) / 5) + 1;
    var month = m + 3 - 12 * Math.floor(m / 10);
    var year = b * 100 + d - 4800 + Math.floor(m / 10);
    return { d: day, m: month, y: year };
  }

  function newMoon(k) {
    var T = k / 1236.85, T2 = T * T, T3 = T2 * T, dr = PI / 180;
    var Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
    Jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
    var M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
    var Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
    var F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
    var C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
    C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
    C1 -= 0.0004 * Math.sin(dr * 3 * Mpr);
    C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
    C1 = C1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
    C1 = C1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
    C1 = C1 + 0.0010 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));
    var deltat;
    if (T < -11) deltat = 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3;
    else deltat = -0.000278 + 0.000265 * T + 0.000262 * T2;
    return Jd1 + C1 - deltat;
  }

  function sunLongitude(jdn) {
    var T = (jdn - 2451545.0) / 36525, T2 = T * T, dr = PI / 180;
    var M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
    var L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
    var DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
    DL += (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.00029 * Math.sin(dr * 3 * M);
    var L = (L0 + DL) * dr;
    L -= PI * 2 * Math.floor(L / (PI * 2));
    return L;
  }

  function getSunLongitude(dayNumber) {
    return Math.floor((sunLongitude(dayNumber - 0.5 - TZ / 24) / PI) * 6);
  }
  function getNewMoonDay(k) {
    return Math.floor(newMoon(k) + 0.5 + TZ / 24);
  }
  function getLunarMonth11(yy) {
    var off = jdFromDate(31, 12, yy) - 2415021;
    var k = Math.floor(off / 29.530588853);
    var nm = getNewMoonDay(k);
    if (getSunLongitude(nm) >= 9) nm = getNewMoonDay(k - 1);
    return nm;
  }
  function getLeapMonthOffset(a11) {
    var k = Math.floor((a11 - 2415021.076998695) / 29.530588853 + 0.5);
    var last, i = 1;
    var arc = getSunLongitude(getNewMoonDay(k + i));
    do {
      last = arc;
      i++;
      arc = getSunLongitude(getNewMoonDay(k + i));
    } while (arc !== last && i < 14);
    return i - 1;
  }

  function solarToLunar(dd, mm, yy) {
    var dayNumber = jdFromDate(dd, mm, yy);
    var k = Math.floor((dayNumber - 2415021.076998695) / 29.530588853);
    var monthStart = getNewMoonDay(k + 1);
    if (monthStart > dayNumber) monthStart = getNewMoonDay(k);
    var a11 = getLunarMonth11(yy), b11 = a11, lunarYear;
    if (a11 >= monthStart) {
      lunarYear = yy;
      a11 = getLunarMonth11(yy - 1);
    } else {
      lunarYear = yy + 1;
      b11 = getLunarMonth11(yy + 1);
    }
    var lunarDay = dayNumber - monthStart + 1;
    var diff = Math.floor((monthStart - a11) / 29);
    var lunarLeap = false;
    var lunarMonth = diff + 11;
    if (b11 - a11 > 365) {
      var leapMonthDiff = getLeapMonthOffset(a11);
      if (diff >= leapMonthDiff) {
        lunarMonth = diff + 10;
        if (diff === leapMonthDiff) lunarLeap = true;
      }
    }
    if (lunarMonth > 12) lunarMonth -= 12;
    if (lunarMonth >= 11 && diff < 4) lunarYear -= 1;
    return { d: lunarDay, m: lunarMonth, y: lunarYear, leap: lunarLeap };
  }

  // Trả về {d,m,y} dương lịch, hoặc null nếu không tồn tại (vd: tháng nhuận không có)
  function lunarToSolar(lunarDay, lunarMonth, lunarYear, lunarLeap) {
    var a11, b11;
    if (lunarMonth < 11) {
      a11 = getLunarMonth11(lunarYear - 1);
      b11 = getLunarMonth11(lunarYear);
    } else {
      a11 = getLunarMonth11(lunarYear);
      b11 = getLunarMonth11(lunarYear + 1);
    }
    var k = Math.floor(0.5 + (a11 - 2415021.076998695) / 29.530588853);
    var off = lunarMonth - 11;
    if (off < 0) off += 12;
    if (b11 - a11 > 365) {
      var leapOff = getLeapMonthOffset(a11);
      var leapMonth = leapOff - 2;
      if (leapMonth < 0) leapMonth += 12;
      if (lunarLeap && lunarMonth !== leapMonth) return null;
      else if (lunarLeap || off >= leapOff) off += 1;
    } else if (lunarLeap) {
      return null;
    }
    var monthStart = getNewMoonDay(k + off);
    return jdToDate(monthStart + lunarDay - 1);
  }

  var CAN = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
  var CHI = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];

  // 24 tiết khí, chỉ số 0 = Xuân phân (kinh độ mặt trời 0°), mỗi bước 15°
  var TERMS = ['Xuân phân', 'Thanh minh', 'Cốc vũ', 'Lập hạ', 'Tiểu mãn', 'Mang chủng', 'Hạ chí', 'Tiểu thử', 'Đại thử', 'Lập thu', 'Xử thử', 'Bạch lộ', 'Thu phân', 'Hàn lộ', 'Sương giáng', 'Lập đông', 'Tiểu tuyết', 'Đại tuyết', 'Đông chí', 'Tiểu hàn', 'Đại hàn', 'Lập xuân', 'Vũ thủy', 'Kinh trập'];

  // Chỉ số tiết khí tại thời điểm hết ngày j (0h ngày j+1 giờ VN)
  function termIdxEnd(j) {
    return Math.floor(sunLongitude(j + 0.5 - TZ / 24) / (PI / 12)) % 24;
  }

  function termInfo(d, m, y) {
    var j = jdFromDate(d, m, y);
    var idx = termIdxEnd(j);
    var a = j;
    while (termIdxEnd(a - 1) === idx && j - a < 20) a--;
    var b = j + 1;
    while (termIdxEnd(b) === idx && b - j < 20) b++;
    return {
      name: TERMS[idx],
      start: jdToDate(a),
      startsToday: a === j,
      next: { name: TERMS[termIdxEnd(b)], date: jdToDate(b) }
    };
  }

  function isLeap(y) {
    return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  }
  function daysInMonth(m, y) {
    return [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  }

  global.Lunar = {
    jd: jdFromDate,
    fromJd: jdToDate,
    dow: function (d, m, y) { return (jdFromDate(d, m, y) + 1) % 7; }, // 0 = Chủ nhật
    addDays: function (o, n) { return jdToDate(jdFromDate(o.d, o.m, o.y) + n); },
    diff: function (a, b) { return jdFromDate(b.d, b.m, b.y) - jdFromDate(a.d, a.m, a.y); },
    solarToLunar: solarToLunar,
    lunarToSolar: lunarToSolar,
    canChiDay: function (d, m, y) { var j = jdFromDate(d, m, y); return CAN[(j + 9) % 10] + ' ' + CHI[(j + 1) % 12]; },
    canChiMonth: function (lm, ly) { return CAN[(ly * 12 + lm + 3) % 10] + ' ' + CHI[(lm + 1) % 12]; },
    canChiYear: function (ly) { return CAN[(ly + 6) % 10] + ' ' + CHI[(ly + 8) % 12]; },
    termInfo: termInfo,
    isLeap: isLeap,
    daysInMonth: daysInMonth
  };
})(typeof window !== 'undefined' ? window : globalThis);
