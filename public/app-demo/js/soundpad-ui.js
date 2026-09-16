// Tikkies Tools — แท็บ Sound (Soundpad): แผงคีย์บอร์ด + คิวเสียง + แผงตั้งค่าต่อปุ่ม
// -------------------------------------------------------------------
// หน้าที่ของไฟล์นี้คือ "หน้าจอ" อย่างเดียว — เสียงจริงอยู่ที่ soundpad-audio.js (window.TkPad)
// ส่วนการจองปุ่ม/กินปุ่มอยู่ที่ main process แล้วส่งกลับมาเป็น event 'soundpadKey' (กด/ปล่อยปุ่ม)
// กับ 'soundpadCmd' (คำสั่งรวม เช่น หยุดทุกเสียง)
//
// รอบสองรื้อหน้าจอใหม่ทั้งใบ ของเดิมอัดตัวควบคุม 6 อย่างไว้แถวเดียว ปุ่มคีย์บอร์ดเล็กจนอ่านชื่อ
// เสียงไม่ออก และเหลือกล่องว่างใหญ่ๆ ค้างอยู่ล่างจอ โครงใหม่เรียงตาม "ความถี่ที่ต้องใช้จริง":
//   1) แถบควบคุมหลัก  — สวิตช์เปิด/ปิดทั้งระบบ + ระดับเสียงรวม + ปุ่มหยุดทุกเสียง (แค่ 3 อย่าง)
//   2) แผงปุ่ม        — พระเอกของหน้า กินความกว้างเต็ม ขนาดปุ่มคำนวณจากที่ว่างจริงให้ใหญ่ที่สุด
//   3) คิวเสียง + ตั้งค่าปุ่มที่เลือก — สองคอลัมน์เคียงกัน (ที่ว่างเดิมกลายเป็นของมีประโยชน์)
//   4) ตั้งค่าขั้นสูง  — ยุบไว้ (ชุดปุ่ม · ปุ่มลัด · โหมดเล่น · กินปุ่ม · อุปกรณ์เสียง · เสียงติ๊ด)
//
// แนวคิดที่เปลี่ยนจากรอบแรก: เลิก "โหมดแพด" ที่ต้องกดเปิดก่อนใช้ เหลือสวิตช์เดียวคือเปิด/ปิดระบบ
// และค่าเริ่มต้นคือ "ไม่กินปุ่ม" — กดปุ่มที่ตั้งเสียงไว้แล้วได้ทั้งเสียงและตัวอักษรตามปกติ
//
// ทำไมโมดูลนี้ต้องทำงานตั้งแต่เปิดแอป ไม่ใช่ตอนเปิดแท็บ:
// สตรีมเมอร์กดแพดตอนอยู่ในเกม แอปย่ออยู่ท้ายจอ — ถ้ารอวาดแท็บก่อนถึงจะ setPads
// กดปุ่มแรกจะเงียบเพราะไฟล์ยังไม่ถูกโหลด จึงโหลดค่าตั้งแต่ mount() แล้วดันเข้าเอนจินเลย
//
// เปิดผ่าน file:// เหมือนไฟล์อื่นในโฟลเดอร์นี้ จึงเป็น IIFE ตั้ง global ไม่ใช้ require/import
window.SoundpadUI = (function () {
  'use strict';

  var Tk = window.Tk;
  var el = Tk.el, invoke = Tk.invoke, toast = Tk.toast;
  function t(k, v) { return Tk.t(k, v); }        // เรียกตอนใช้ ไม่ cache — ผู้ใช้สลับภาษาได้ระหว่างทาง

  var DEFAULT_COLOR = '#4a9eda';
  var SAVE_MS = 400;          // หน่วงก่อนเขียนลง settings.json — main เขียนไฟล์ทั้งก้อนแบบ sync ลากสไลเดอร์แล้วจะสะดุด
  var AUTO_OFF_MAX = 86400;   // ตรงกับเพดานใน src/core/soundpad.js — ใหญ่กว่านี้ setTimeout overflow
  var KB_BLOCKS = 3;          // แผงหลัก / แผงนำทาง / แผงตัวเลข
  var KB_UNITS = 22;          // ความกว้างรวมเป็น "หน่วยปุ่ม" (15 + 3 + 4) ใช้คำนวณขนาดปุ่มให้พอดีจอ
  var KB_MIN_U = 26, KB_MAX_U = 56;

  var S = {
    conf: null,        // settings.soundpad ทั้งก้อน (แหล่งความจริงฝั่งหน้าจอ)
    on: false,         // ระบบเปิดอยู่ไหม (= soundpad.enabled ฝั่ง main)
    sel: '',           // ปุ่มที่กำลังเปิดแผงตั้งค่าอยู่
    playing: {},       // key → true (มาจาก TkPad.onState)
    queued: {},        // key → true ปุ่มที่รออยู่ในคิว
    errors: {},        // key → true ปุ่มที่โหลดไฟล์ไม่ขึ้น
    port: 21213,
    err: null,         // ข้อความ error ตอนโหลดค่าไม่ได้ (เช่นสิทธิ์หมดอายุ)
    hookOk: true,      // ตัวดักคีย์ของเครื่องนี้ใช้ได้ไหม — false = ปุ่มที่ตั้งไว้จะไม่ดังเลย
    loading: false,
    mounted: false,    // app.js เรียก mount() แล้วหรือยัง (setupTabs วิ่งก่อน state:get เสมอ)
    pushed: false,     // เคยดันปุ่มเข้าเอนจินแล้วหรือยัง (กันสร้าง AudioContext ทิ้งเปล่าตอนยังไม่มีปุ่มสักอัน)
    devWarned: false,  // เตือนเรื่องอุปกรณ์เสียงที่เคยเลือกหายไปแล้วครั้งหนึ่ง (เดิมเด้งซ้ำทุกครั้งที่วาดใหม่)
    riskWarned: false, // เตือนเรื่องใส่เสียงลงปุ่มที่ใช้พิมพ์ไปแล้วครั้งหนึ่ง
    noKeyUpWarned: false // เตือนเรื่องเครื่องนี้ดักปุ่มปล่อยไม่ได้ไปแล้วครั้งหนึ่ง
  };

  var root = null, editHost = null, qHost = null, kbWrap = null, kbEl = null;
  var keyNodes = {}, keyLabels = {};
  var powerBtn = null, powerTitle = null, powerSub = null, powerKey = null;
  var qUi = null;      // ชิ้นส่วนแผงคิว — อัปเดตในที่ ไม่วาดใหม่ทุก 250ms (ไม่งั้นโฟกัส/สกรอลล์กระตุก)
  var qOff = null;     // ตัวถอนการติดตามคิวของ TkPad
  var progKey = '';    // ปุ่มที่กำลังโชว์แถบความคืบหน้าอยู่ (ล้างของเก่าก่อนย้ายไปปุ่มใหม่)

  // ---------- ตัวช่วยเล็กๆ ----------
  // debounce ของตัวเอง (app.js มีแต่เก็บไว้ใน IIFE ของมัน) — flush ตอนปิดหน้าต่างด้วย
  // ไม่งั้นลากโวลุ่มเสร็จแล้วปิดโปรแกรมภายในครึ่งวินาที ค่าล่าสุดหายเงียบ
  var pending = [];
  function debounce(fn, ms) {
    var timer = null, args = null;
    function run() { var a = args; timer = null; args = null; drop(); fn.apply(null, a); }
    function drop() { var i = pending.indexOf(flush); if (i >= 0) pending.splice(i, 1); }
    function flush() { if (timer) { clearTimeout(timer); run(); } }
    var wrapped = function () {
      args = arguments;
      if (timer) clearTimeout(timer); else pending.push(flush);
      timer = setTimeout(run, ms);
    };
    wrapped.flush = flush;
    return wrapped;
  }
  window.addEventListener('beforeunload', function () {
    pending.slice().forEach(function (f) { try { f(); } catch (_) {} });
  });

  function pad() { return window.TkPad || null; }
  function clamp(v, lo, hi) { v = Number(v); if (!isFinite(v)) return lo; return Math.max(lo, Math.min(hi, v)); }
  function bankList() { return (S.conf && Array.isArray(S.conf.banks)) ? S.conf.banks : []; }
  function bankById(id) {
    var list = bankList();
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].id === id) return list[i];
    return null;
  }
  function bankOf() {
    if (!S.conf) return null;
    return bankById(S.conf.activeBank) || bankList()[0] || null;
  }
  function keysOf() { var b = bankOf(); return (b && b.keys) || {}; }
  function padOf(k) { return keysOf()[k] || null; }
  function blankPad() {
    return { url: '', name: '', volume: 1, mode: 'oneshot', loop: false, fadeIn: 0, fadeOut: 0, choke: '', color: DEFAULT_COLOR };
  }
  function playMode() {
    var m = S.conf && S.conf.playMode;
    return (m === 'overlap' || m === 'cut') ? m : 'queue';
  }
  function swallows() { return !!(S.conf && S.conf.swallowKeys); }
  function field(label, ctrl, hint) {
    return el('div', { class: 'field' }, [
      el('label', { text: label }),
      ctrl,
      hint ? el('div', { class: 'hint', text: hint }) : null
    ]);
  }
  // 0:03 — คิวโชว์เวลาเป็นนาที:วินาทีเสมอ เพลง 5 นาทีจะได้ไม่กลายเป็นเลขวินาทีดิบๆ
  function mmss(sec) {
    var n = Math.max(0, Math.floor(Number(sec) || 0));
    return Math.floor(n / 60) + ':' + (n % 60 < 10 ? '0' : '') + (n % 60);
  }
  function visible() {
    var sec = document.querySelector('.tab[data-tab="soundpad"]');
    return !!sec && !sec.hidden;
  }

  // ---------- โครงคีย์บอร์ด ----------
  // วาดจากตารางนี้ทั้งหมด — เพิ่ม/ย้ายปุ่มแก้ที่เดียว ไม่ต้องไปไล่แก้ HTML ทีละใบ
  //   k = ชื่อปุ่มแบบ accelerator ของ Electron (ตัวเดียว ไม่มี modifier) ใช้เป็นคีย์ใน bank.keys
  //   l = ป้ายที่โชว์บนปุ่ม, w = ความกว้างเป็นหน่วยปุ่ม
  //   dead = ปุ่มที่ลงทะเบียนเดี่ยวๆ ไม่ได้ (Shift/Ctrl/Alt/Win = modifier ล้วน,
  //          CapsLock/NumLock/PrtSc/Pause = OS กินไปก่อนหรือใช้แล้วสถานะเครื่องเพี้ยน) — วาดไว้ให้ครบแผงแต่กดไม่ได้
  function K(k, l, w) { return { k: k, l: l || k, w: w || 1 }; }
  function D(l, w) { return { dead: true, l: l, w: w || 1 }; }
  function G(w) { return { gap: true, w: w || 1 }; }

  var ROWS_MAIN = [
    [K('Escape', 'Esc'), G(1), K('F1'), K('F2'), K('F3'), K('F4'), G(0.5), K('F5'), K('F6'), K('F7'), K('F8'), G(0.5), K('F9'), K('F10'), K('F11'), K('F12')],
    [K('`'), K('1'), K('2'), K('3'), K('4'), K('5'), K('6'), K('7'), K('8'), K('9'), K('0'), K('-'), K('='), K('Backspace', '⌫', 2)],
    [K('Tab', 'Tab', 1.5), K('Q'), K('W'), K('E'), K('R'), K('T'), K('Y'), K('U'), K('I'), K('O'), K('P'), K('['), K(']'), K('\\', '\\', 1.5)],
    [D('Caps', 1.75), K('A'), K('S'), K('D'), K('F'), K('G'), K('H'), K('J'), K('K'), K('L'), K(';'), K('\'', '\''), K('Enter', 'Enter', 2.25)],
    [D('Shift', 2.25), K('Z'), K('X'), K('C'), K('V'), K('B'), K('N'), K('M'), K(','), K('.'), K('/'), D('Shift', 2.75)],
    [D('Ctrl', 1.5), D('Win', 1.25), D('Alt', 1.5), K('Space', 'Space', 6.5), D('Alt', 1.5), D('Menu', 1.25), D('Ctrl', 1.5)]
  ];
  var ROWS_NAV = [
    [D('PrtSc'), K('ScrollLock', 'Scroll'), D('Pause')],
    [K('Insert', 'Ins'), K('Home'), K('PageUp', 'PgUp')],
    [K('Delete', 'Del'), K('End'), K('PageDown', 'PgDn')],
    [G(3)],
    [G(1), K('Up', '↑'), G(1)],
    [K('Left', '←'), K('Down', '↓'), K('Right', '→')]
  ];
  var ROWS_NUM = [
    [G(4)],
    [D('Num'), K('numdiv', '/'), K('nummult', '*'), K('numsub', '−')],
    [K('num7', '7'), K('num8', '8'), K('num9', '9'), K('numadd', '+')],
    [K('num4', '4'), K('num5', '5'), K('num6', '6'), G(1)],
    [K('num1', '1'), K('num2', '2'), K('num3', '3'), D('Ent')],
    [K('num0', '0', 2), K('numdec', '.'), G(1)]
  ];

  // ปุ่มที่ "ใช้พิมพ์" — ค่าเริ่มต้นของระบบคือไม่กินปุ่ม เสียงบนปุ่มพวกนี้จึงลั่นตอนพิมพ์แชท/ชื่อไฟล์ด้วย
  // เอาจากแถว 1–5 ของแผงหลัก (ตัวเลขแถวบน · ตัวอักษร · เครื่องหมาย · Tab/Enter/Backspace/Space)
  // ไม่รวมแถว F1–F12 กับแป้นตัวเลขด้านขวา เพราะนั่นคือปุ่มที่แนะนำให้ใช้ทำแพดจริงๆ
  var TYPING_KEYS = (function () {
    var m = {};
    ROWS_MAIN.slice(1).forEach(function (row) {
      row.forEach(function (c) { if (c && c.k) m[c.k] = true; });
    });
    return m;
  })();
  function isTypingKey(k) { return !!TYPING_KEYS[k]; }
  // เสี่ยงลั่นเฉพาะตอนไม่กินปุ่มเท่านั้น — ติ๊กกินปุ่มแล้วปุ่มไม่ทะลุไปไหน จุดเตือนต้องหายไปด้วย
  function isRisky(k) { return isTypingKey(k) && !swallows(); }

  // ---------- เลเยอร์ปุ่มร่วม (Ctrl/Shift/Alt/Win) ----------
  // ปุ่มแพดตั้งเป็นปุ่มร่วมได้ เช่น Ctrl+R — เก็บเป็น id เดียวกันทั้งระบบ ('Ctrl+R')
  // แผงปุ่มจึงทำงานเป็น "เลเยอร์": ติ๊ก Ctrl แล้วแผงจะแสดงเสียงของเลเยอร์ Ctrl
  // วิธีนี้ได้ที่ว่างเพิ่มเป็นเท่าตัวโดยไม่ต้องขยายคีย์บอร์ด และไม่ไปแย่งปุ่มเดี่ยวที่ใช้พิมพ์
  // ลำดับต้องคงที่เสมอ ไม่งั้น id ของปุ่มเดียวกันจะไม่ตรงกันระหว่างครั้งที่ตั้งกับครั้งที่กด
  var MOD_ORDER = ['Ctrl', 'Shift', 'Alt', 'Super'];
  var MOD_LABEL = { Ctrl: 'Ctrl', Shift: 'Shift', Alt: 'Alt', Super: IS_MAC_EARLY() ? 'Cmd' : 'Win' };
  function IS_MAC_EARLY() { return /Mac/i.test(navigator.platform || ''); }
  var curMods = { Ctrl: false, Shift: false, Alt: false, Super: false };

  function modPrefix() {
    return MOD_ORDER.filter(function (m) { return curMods[m]; });
  }
  // id ของปุ่มบนเลเยอร์ที่เปิดอยู่ตอนนี้ — เลเยอร์เปล่าคืนชื่อปุ่มเดิม (ของเก่าจึงไม่พัง)
  function withMods(base) {
    var pre = modPrefix();
    return pre.length ? pre.concat(base).join('+') : base;
  }
  function hasAnyMod() { return modPrefix().length > 0; }

  // ---------- จำเลเยอร์ข้ามการปิด-เปิดโปรแกรม ----------
  // ปัญหาที่แก้: ผู้ใช้วางเสียงไว้บนเลเยอร์ Ctrl พอปิดแล้วเปิดใหม่ แผงกลับไปเป็นปุ่มเดี่ยว
  // เห็นแผงเปล่าแล้วเข้าใจว่าเสียงที่ตั้งไว้หายหมด
  var layerRestored = false;
  function restoreLayer() {
    if (layerRestored || !S.conf) return;
    layerRestored = true;   // กู้ครั้งเดียวต่อการเปิดแอป ไม่งั้น load() รอบหลังจะทับเลเยอร์ที่ผู้ใช้เพิ่งเลือก
    var saved = String(S.conf.activeLayer || '').split('+');
    MOD_ORDER.forEach(function (m) { curMods[m] = saved.indexOf(m) !== -1; });
  }
  function saveLayer() { setConf({ activeLayer: modPrefix().join('+') }); }
  // นับว่าเลเยอร์ไหนมีเสียงอยู่กี่ปุ่ม — ใช้ติดตัวเลขบนปุ่มโมดิฟายเออร์ กันผู้ใช้ลืมว่าซ่อนอะไรไว้
  function countOnLayer(mods) {
    var pre = MOD_ORDER.filter(function (m) { return mods[m]; }).join('+');
    var all = keysOf(), n = 0;
    Object.keys(all).forEach(function (id) {
      var i = id.lastIndexOf('+');
      var got = i < 0 ? '' : id.slice(0, i);
      if (got === pre && all[id] && all[id].url) n++;
    });
    return n;
  }

  // ---------- ช่องจับปุ่มลัด ----------
  // ใช้กติกาเดียวกับ acceleratorField ใน actions-editor.js (โปรแกรมเดียวกันต้องจับปุ่มเหมือนกัน)
  var IS_MAC = /Mac/i.test(navigator.platform || '');
  function eventToAccelerator(e) {
    var mods = [];
    // ปุ่ม meta: macOS = Command, Windows = ปุ่ม Win (Electron เรียก 'Super')
    if (e.metaKey) mods.push(IS_MAC ? 'Command' : 'Super');
    if (e.ctrlKey) mods.push('Control');
    if (e.altKey) mods.push('Alt');
    if (e.shiftKey) mods.push('Shift');
    var code = e.code || '', key = null, m;
    if ((m = /^Key([A-Z])$/.exec(code))) key = m[1];
    else if ((m = /^Digit([0-9])$/.exec(code))) key = m[1];
    else if ((m = /^Numpad([0-9])$/.exec(code))) key = 'num' + m[1];
    else if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) key = code;
    else {
      var MAP = { Space: 'Space', Enter: 'Enter', Tab: 'Tab', Backspace: 'Backspace', Delete: 'Delete',
        ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
        Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown', Insert: 'Insert',
        ScrollLock: 'ScrollLock', NumLock: 'NumLock', Pause: 'Pause', Escape: 'Escape',
        Minus: '-', Equal: '=', Comma: ',', Period: '.', Slash: '/', Backquote: '`',
        BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Backslash: '\\' };
      key = MAP[code] || null;
    }
    if (!key) return null;
    return mods.concat([key]).join('+');
  }
  // แปลง accelerator ที่เก็บจริง → คำแบบ Windows สำหรับแสดงผล (โปรแกรมใช้บน Windows เป็นหลัก)
  // ชื่อปุ่มที่ "คนอ่านออก" — เดิมโชว์ค่าดิบอย่าง num1 / numadd ซึ่งอ่านแล้วเหมือนรหัส error
  var KEY_PRETTY = {
    numadd: 'Numpad +', numsub: 'Numpad −', nummult: 'Numpad ×', numdiv: 'Numpad ÷', numdec: 'Numpad .',
    ScrollLock: 'Scroll Lock', NumLock: 'Num Lock', CapsLock: 'Caps Lock', PrintScreen: 'Print Screen',
    PageUp: 'Page Up', PageDown: 'Page Down', Escape: 'Esc', Backspace: 'Backspace', Delete: 'Delete',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: 'Space'
  };
  function prettyKey(k) {
    var s = String(k || '');
    var m = /^num([0-9])$/i.exec(s);
    if (m) return 'Numpad ' + m[1];
    m = /^numpad([0-9])$/i.exec(s);
    if (m) return 'Numpad ' + m[1];
    return KEY_PRETTY[s] || s;
  }
  // ป้ายชื่อปุ่มสำหรับ "id เต็ม" ที่อาจมี modifier ('Ctrl+num1' → 'Ctrl + Numpad 1')
  // ใช้ทุกที่ที่ผู้ใช้อ่าน โดยเฉพาะกล่องยืนยันลบ — เดิมโชว์ฝาปุ่มดิบ ทำให้ Numpad 1 กับเลข 1
  // แถวบนดูเหมือนกันเป๊ะ กดยืนยันไปโดยไม่รู้ว่าลบปุ่มไหน
  function keyLabelFull(id) {
    var W = { Super: 'Win', Command: 'Win', CommandOrControl: 'Ctrl', Control: 'Ctrl', Alt: 'Alt', Option: 'Alt', Shift: 'Shift' };
    return String(id || '').split('+').map(function (p) { return W[p] || prettyKey(p); }).join(' + ');
  }

  // เทียบปุ่มโดยไม่สนรูปแบบการเขียน modifier — ต้องตรงกับ normAccelerator ฝั่ง main
  // ไม่งั้นกรอบเตือน "ปุ่มนี้ถูกใช้เป็นปุ่มลัด" ไม่มีวันขึ้นเมื่อปุ่มลัดมี modifier
  var MOD_CANON = { control: 'ctrl', ctrl: 'ctrl', commandorcontrol: 'ctrl', cmdorctrl: 'ctrl',
    alt: 'alt', option: 'alt', altgr: 'alt', shift: 'shift',
    command: 'meta', cmd: 'meta', super: 'meta', meta: 'meta' };
  function normAcc(acc) {
    var parts = String(acc || '').split('+').map(function (x) { return x.trim(); }).filter(Boolean);
    if (!parts.length) return '';
    var mods = [], key = '';
    parts.forEach(function (x) {
      var m = MOD_CANON[x.toLowerCase()];
      if (m) { if (mods.indexOf(m) < 0) mods.push(m); return; }
      key = x.toLowerCase();
    });
    // ชื่อปุ่มแพดกับปุ่มลัดอาจเขียนคนละแบบ ('Numpad1' vs 'num1') — ยุบให้เหมือนกันก่อนเทียบ
    var mm = /^numpad([0-9])$/.exec(key);
    if (mm) key = 'num' + mm[1];
    return key ? mods.sort().concat(key).join('+') : '';
  }
  function sameKey(a, b) { return !!a && !!b && normAcc(a) === normAcc(b); }

  function accelLabel(acc) {
    if (!acc) return t('ยังไม่ได้ตั้ง');
    var W = { Super: 'Win', Command: 'Win', CommandOrControl: 'Ctrl', Control: 'Ctrl', Alt: 'Alt', Option: 'Alt', Shift: 'Shift' };
    return String(acc).split('+').map(function (p) { return W[p] || prettyKey(p); }).join(' + ');
  }

  // ช่องจับปุ่มลัดหนึ่งช่อง (ใช้ทั้ง toggleKey และ stopAllKey)
  // ปัญหาที่ต้องแก้: ปุ่มที่ตั้งไว้แล้วถูกจองอยู่ กดตอนอยู่ในช่องนี้จะ "สั่งงานจริง" แทนที่จะถูกจับ
  // (globalShortcut กินไปก่อนถึงหน้าเว็บ) แล้วช่องค้างสถานะรอรับปุ่มตลอด — จึงถอดค่าที่ตั้งไว้ออก
  // ก่อนเริ่มจับ (main จะ unregister ให้เอง) แล้วคืนค่าเดิมถ้าผู้ใช้ยกเลิก
  var CAPTURE_TIMEOUT_MS = 20000;   // เผลอกดเปิดช่องแล้วเดินหนี — ต้องคืนปุ่มเดิมให้เองอยู่ดี
  // ช่อง "กินปุ่ม" ถูกล็อกไว้จนกว่าจะมีปุ่มลัดเปิด/ปิด — ตั้งปุ่มลัดเสร็จต้องปลดล็อกให้เห็นทันที
  // ไม่ใช่รอผู้ใช้ปิด-เปิดตั้งค่าขั้นสูงใหม่ถึงจะกดได้
  var syncSwallowLock = function () {};
  function hotkeyField(confKey) {
    var btn = el('button', { type: 'button', class: 'btn keycap', text: accelLabel(S.conf[confKey]) });
    // มีไอคอนกำกับด้วย ไม่ใช่ตัวหนังสือล้วน — ผู้ใช้ที่แยกสียากจะได้ยังเห็นว่าเป็นปุ่มลบค่า
    var clearBtn = el('button', { type: 'button', class: 'btn btn-sm keycap-clear', title: t('ล้างปุ่มลัดนี้') }, [
      window.Icon.el('x', 12), el('span', { text: t('ล้าง') })
    ]);
    var capturing = false, prev = '', timer = null;

    function put(v) { var p = {}; p[confKey] = v; commitNow(p); }
    function label() { btn.textContent = accelLabel(S.conf[confKey]); }

    function stop(restore) {
      if (!capturing) return;
      capturing = false;
      if (timer) { clearTimeout(timer); timer = null; }
      btn.classList.remove('capturing');
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('mousedown', onOutside, true);
      if (restore && prev) put(prev);      // ยกเลิกกลางคัน = ต้องได้ปุ่มเดิมกลับคืน ไม่ใช่กลายเป็นว่าง
      label();
      paintPower();
      paintKeys();
      syncSwallowLock();
    }
    function onKey(e) {
      if (!capturing) return;
      e.preventDefault(); e.stopPropagation();
      if (e.key === 'Escape') { stop(true); return; }
      if (['Shift', 'Control', 'Alt', 'Meta'].indexOf(e.key) >= 0) return; // ปุ่ม modifier ล้วน → รอปุ่มจริง
      var acc = eventToAccelerator(e);
      if (!acc) return;
      prev = '';                            // จับได้แล้ว ไม่ต้องคืนของเก่า
      put(acc);
      stop(false);
    }
    // เผลอคลิกที่อื่นระหว่างจับปุ่ม = เลิกจับ ไม่งั้น listener ค้างแล้วกลืนปุ่มถัดไปที่กด
    function onOutside(e) { if (e.target !== btn) stop(true); }

    btn.addEventListener('click', function () {
      if (capturing) { stop(true); return; }
      capturing = true;
      prev = S.conf[confKey] || '';
      if (prev) put('');                    // ถอด binding ก่อน ไม่งั้นกดปุ่มเดิมจะไปสั่งงานจริงแทนที่จะถูกจับ
      btn.classList.add('capturing');
      btn.textContent = t('กดคีย์ที่ต้องการ... (Esc = ยกเลิก)');
      window.addEventListener('keydown', onKey, true);
      setTimeout(function () { document.addEventListener('mousedown', onOutside, true); }, 0);
      timer = setTimeout(function () { stop(true); }, CAPTURE_TIMEOUT_MS);
    });
    clearBtn.addEventListener('click', function () {
      if (capturing) { prev = ''; stop(false); }
      put('');
      label();
      paintPower();
      paintKeys();
    });
    return el('div', { class: 'keycap-row' }, [btn, clearBtn]);
  }

  // ---------- บันทึกค่า ----------
  // การเขียนทุกชนิดเดินเป็น "สายเดียว" — เดิม set กับ assign ต่างคนต่างยิงแล้วคำตอบกลับมาสลับลำดับ
  // ผลคือคำตอบของคำสั่งเก่าไปทับ S.conf ทีหลัง (สลับชุดปุ่มแล้วหน้าจอกับเอนจินหลุดจากกัน)
  var chain = Promise.resolve();
  function enqueue(fn) {
    chain = chain.then(fn, fn);   // ล้มเหลวแล้วต้องเดินต่อ ไม่งั้นสายตายทั้งเส้น การบันทึกครั้งถัดไปจะค้าง
    return chain;
  }
  // คำตอบจาก main คือ "ของ ณ ตอนที่สั่ง" — งานที่ยังหน่วงอยู่ในคิวคือของใหม่กว่า ต้องทาทับกลับไป
  // ไม่งั้นหน้าจอเด้งย้อนกลับไปค่าเก่าระหว่างที่ผู้ใช้ยังลากสไลเดอร์/พิมพ์ชื่ออยู่
  function overlayPending() {
    if (!S.conf) return;
    Object.keys(patchQ).forEach(function (k) { S.conf[k] = patchQ[k]; });
    Object.keys(assignQ).forEach(function (k) {
      var q = assignQ[k], b = bankById(q.bank);
      if (!b) return;
      if (!b.keys || typeof b.keys !== 'object') b.keys = {};
      if (q.pad) b.keys[k] = q.pad; else delete b.keys[k];
    });
  }
  function applyConf(conf) {
    if (!conf) return;
    S.conf = conf;
    overlayPending();
  }

  // patch สะสมไว้ก้อนเดียวแล้วยิงทีเดียว — ลากสไลเดอร์ 30 เฟรมต้องได้เขียนไฟล์ครั้งเดียว
  var patchQ = {};
  var flushSet = debounce(function () {
    var p = patchQ; patchQ = {};
    if (!Object.keys(p).length) return;
    enqueue(function () {
      return invoke('soundpad:set', { patch: p }, { toast: false })
        .then(function (conf) { applyConf(conf); paintKeys(); })
        .catch(function (e) { toast(t('บันทึกค่าแพดไม่สำเร็จ: {err}', { err: (e && e.message) || e }), 'err'); });
    });
  }, SAVE_MS);
  function setConf(patch) {
    if (!S.conf) return;
    Object.keys(patch).forEach(function (k) { S.conf[k] = patch[k]; });   // optimistic — หน้าจอต้องขยับตามมือทันที
    Object.keys(patch).forEach(function (k) { patchQ[k] = patch[k]; });
    flushSet();
  }
  // ค่าที่ "เปลี่ยนแล้วต้องมีผลเดี๋ยวนี้" (สลับชุดปุ่ม / ปุ่มลัด) — หน่วงไว้ 400ms แล้วผู้ใช้กดปุ่มพอดี
  // จะได้พฤติกรรมของค่าเก่า จึงดันของที่ค้างอยู่ออกให้หมดก่อนแล้วค่อยเขียน
  // ดัน set ออกก่อน assign เสมอ — คำตอบของ assign ถือ activeBank ณ ตอนสั่ง ถ้ามาทีหลัง set
  // มันจะทาชุดปุ่มเก่ากลับเข้า S.conf ชั่วขณะ แล้วแผงปุ่มกะพริบเป็นชุดเดิมก่อนจะเด้งกลับ
  function commitNow(patch) {
    setConf(patch);
    flushSet.flush();
    flushAssign.flush();
  }

  // assign = เปลี่ยนของในปุ่ม (โครงสร้างเปลี่ยน) จึงส่งแยกจาก set
  // opts.redraw = วาดแผงตั้งค่าใหม่ด้วย (ใช้ตอนนำเข้าไฟล์/ลบเสียง ไม่ใช้ตอนพิมพ์ชื่อ เดี๋ยวโฟกัสหลุด)
  var assignQ = {};
  var flushAssign = debounce(function () {
    var q = assignQ; assignQ = {};
    Object.keys(q).forEach(function (k) {
      // ใช้ bank ที่จำไว้ตอนเข้าคิว ไม่ใช่ bank ปัจจุบัน — สลับชุดระหว่างที่ยังหน่วงอยู่ เสียงจะไปลงผิดชุด
      enqueue(function () {
        return invoke('soundpad:assign', { bank: q[k].bank, key: k, pad: q[k].pad }, { toast: false })
          .then(function (conf) {
            applyConf(conf);
            paintKeys();
            pushPads();
            if (q[k].redraw) drawEdit();
          })
          .catch(function (e) { toast(t('บันทึกปุ่มไม่สำเร็จ: {err}', { err: (e && e.message) || e }), 'err'); });
      });
    });
  }, SAVE_MS);
  function assignPad(key, padObj, redraw) {
    var b = bankOf();
    if (!b) return;
    b.keys = b.keys || {};
    if (padObj) b.keys[key] = padObj; else delete b.keys[key];
    assignQ[key] = { bank: b.id, pad: padObj || null, redraw: !!redraw };
    paintKey(key);
    flushAssign();
  }
  // แก้ค่าในปุ่มที่เลือกอยู่ (ชื่อ/โวลุ่ม/โหมด/…) — รวมกับ pad เดิมแล้วส่งทั้งก้อนตามสัญญา
  function patchSelected(patch, redraw) {
    var p = padOf(S.sel);
    if (!p) return;
    Object.keys(patch).forEach(function (k) { p[k] = patch[k]; });
    assignPad(S.sel, p, redraw);
  }

  // ---------- ดันปุ่มเข้าเอนจินเสียง ----------
  function pushPads() {
    var eng = pad();
    if (!eng || !S.conf) return;
    var keys = keysOf();
    if (!Object.keys(keys).length && !S.pushed) return;   // ยังไม่เคยมีปุ่มสักอัน — อย่าเพิ่งสร้าง AudioContext ทิ้งเปล่า
    // ต้องตั้งพอร์ตก่อนเสมอ: url ในปุ่มเป็น '/media/...' เอนจินต่อ host จากตัวแปรนี้
    window.__TK_SERVER_PORT = S.port;
    S.pushed = true;
    eng.setPlayMode(playMode());
    eng.setPads(keys);
    eng.setMaster(S.conf.masterVolume != null ? S.conf.masterVolume : 1);
    eng.setOutput(S.conf.outputDeviceId || '');
  }

  // ---------- 1) แถบควบคุมหลัก ----------
  function controlBar() {
    var c = S.conf;

    powerTitle = el('b', { class: 'pad-power-title' });
    powerSub = el('span', { class: 'pad-power-sub' });
    powerKey = el('span', { class: 'pad-power-key' });
    powerBtn = el('button', {
      class: 'pad-power', type: 'button', 'aria-label': t('เปิด/ปิดระบบ Soundpad')
    }, [
      el('span', { class: 'pad-power-dot' }),
      el('span', { class: 'pad-power-txt' }, [powerTitle, powerSub]),
      powerKey
    ]);
    powerBtn.addEventListener('click', function () {
      // ใช้ soundpad:toggle ไม่ใช่ soundpad:set — main ต้องคายปุ่มที่ค้าง + สั่งหยุดเสียงให้ด้วย
      invoke('soundpad:toggle', { on: !S.on }, { toast: false })
        .then(function (r) { S.on = !!(r && r.on); if (S.conf) S.conf.enabled = S.on; paintPower(); })
        .catch(function (e) { toast(t('เปิด/ปิดระบบไม่สำเร็จ: {err}', { err: (e && e.message) || e }), 'err'); });
    });

    // ระดับเสียงรวม — ป้ายขยับตามมือทันที ส่วนการเขียนลงดิสก์รอหยุดลากก่อน
    var volVal = el('b', { text: Math.round((c.masterVolume != null ? c.masterVolume : 1) * 100) + '%' });
    var vol = el('input', { type: 'range', min: '0', max: '1', step: '0.01', value: String(c.masterVolume != null ? c.masterVolume : 1) });
    vol.addEventListener('input', function () {
      var v = clamp(vol.value, 0, 1);
      volVal.textContent = Math.round(v * 100) + '%';
      if (pad()) pad().setMaster(v);
      setConf({ masterVolume: v });
    });

    var stopBtn = el('button', {
      class: 'btn pad-stop-all', type: 'button', title: t('หยุดทุกเสียงที่กำลังเล่นและล้างคิวทั้งหมด')
    }, [window.Icon.el('pause', 14), el('span', { text: t('หยุดทุกเสียง') })]);
    stopBtn.addEventListener('click', function () { if (pad()) pad().stopAll(); });

    return el('div', { class: 'card pad-top' }, [
      powerBtn,
      el('div', { class: 'pad-top-vol' }, [
        el('label', {}, [el('span', { text: t('ระดับเสียงรวม') }), volVal]),
        vol
      ]),
      stopBtn
    ]);
  }

  // แถบเตือนตอนตัวดักคีย์ของเครื่องนี้ใช้ไม่ได้
  // ไม่มีอันนี้ = กดปุ่มที่ตั้งไว้แล้วเงียบสนิท ไม่มีอะไรบอกว่าทำไม (เคสจริงบน Windows
  // รุ่นติดตั้ง ที่ไฟล์ helper ถูกแพ็กเข้า asar จนรันไม่ได้ ผู้ใช้นั่งงงว่าตั้งผิดตรงไหน)
  function paintHookWarn() {
    if (!root) return;
    var host = root.querySelector('.pad-hook-warn');
    var bad = S.conf && !S.hookOk;
    if (!bad) { if (host) host.remove(); return; }
    if (host) return;                       // มีอยู่แล้ว ไม่ต้องสร้างซ้ำ
    var top = root.querySelector('.pad-top');
    if (!top) return;
    // ทางออกที่ใช้ได้จริงบนเครื่องที่ตัวอ่านปุ่มถูกบล็อก: โหมด "กินปุ่ม"
    // เพราะโหมดนั้นใช้ globalShortcut ของ Electron ซึ่งไม่ต้องพึ่งไฟล์ helper ที่โดนบล็อก
    // (เคสจริง: Windows ตอบ spawn UNKNOWN ทั้งที่ไฟล์อยู่ครบ = แอนตี้ไวรัสไม่ยอมให้รัน)
    var fixBtn = el('button', { class: 'btn btn-sm', type: 'button' }, [
      el('span', { text: t('ใช้โหมดกินปุ่มแทน') })
    ]);
    fixBtn.addEventListener('click', function () {
      if (!(S.conf && S.conf.toggleKey)) {
        // เปิดกินปุ่มโดยไม่มีปุ่มลัดปิด = คีย์บอร์ดถูกยึดแล้วไม่มีทางออก — main ก็ปฏิเสธอยู่ดี
        toast(t('ตั้ง "ปุ่มลัดเปิด/ปิดระบบ" ในตั้งค่าขั้นสูงก่อน แล้วค่อยกดปุ่มนี้อีกที'), 'warn', 6000);
        advOpen = true;
        draw();
        var adv = root && root.querySelector('.pad-adv');
        if (adv && adv.scrollIntoView) { try { adv.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) {} }
        return;
      }
      setConf({ swallowKeys: true });
      toast(t('เปลี่ยนเป็นโหมดกินปุ่มแล้ว — ปุ่มที่ตั้งเสียงไว้จะถูกยึดไว้ใช้กับ Soundpad กดปุ่มลัดเพื่อปิดชั่วคราวได้'), 'ok', 7000);
      draw();
    });
    var box = el('div', { class: 'card pad-hook-warn' }, [
      window.Icon.el('info', 15),
      el('div', { class: 'pad-hook-warn-main' }, [
        el('div', { class: 'pad-hook-warn-t', text: t('ปุ่มที่ตั้งไว้จะยังไม่ทำงานบนเครื่องนี้') }),
        el('div', { class: 'hint', text: t('โปรแกรมเปิดตัวอ่านปุ่มไม่ได้ · บน macOS ต้องอนุญาต "การช่วยการเข้าถึง" (Accessibility) ให้โปรแกรมก่อน · ถ้ายังไม่หาย ลองกด "ลองเปิดระบบปุ่มใหม่" ในตั้งค่าขั้นสูง หรือเปลี่ยนไปใช้โหมด "กินปุ่ม" ซึ่งใช้กลไกคนละตัว (ปุ่มที่ตั้งเสียงจะถูกยึดไว้ กดปุ่มลัดปิดชั่วคราวได้)') }),
        el('div', { class: 'pad-hook-warn-acts' }, [fixBtn])
      ])
    ]);
    top.parentNode.insertBefore(box, top.nextSibling);
  }

  function paintPower() {
    if (!powerBtn || !S.conf) return;
    // ระบบปิดอยู่ = กดปุ่มจริงแล้วไม่มีเสียง แต่เดิมแผงปุ่มหน้าตาเหมือนตอนเปิดเป๊ะ
    // หนักสุดตอนปิดเองอัตโนมัติ (auto-off) ผู้ใช้ไม่ได้กดอะไรเลยแต่เสียงหยุดทำงาน
    // อยู่ใน paintPower เพราะนี่คือฟังก์ชันที่ถูกเรียกทุกครั้งที่สถานะเปิด/ปิดเปลี่ยน
    var kbCard = root && root.querySelector('.pad-kb-card');
    if (kbCard) kbCard.classList.toggle('is-off', !S.on);
    powerBtn.classList.toggle('on', !!S.on);
    powerBtn.setAttribute('aria-pressed', S.on ? 'true' : 'false');
    powerTitle.textContent = S.on ? t('Soundpad เปิดอยู่') : t('Soundpad ปิดอยู่');
    powerSub.textContent = !S.on
      ? t('ปุ่มทั้งหมดถูกปล่อยคืนแล้ว — ไม่มีเสียงลั่นแน่นอน')
      : (swallows()
        ? t('ปุ่มที่ตั้งเสียงไว้ถูกยึดไว้ — จะไม่ทะลุไปเกม/ช่องแชท')
        : t('ปุ่มที่ตั้งเสียงไว้พร้อมใช้ — พิมพ์และเล่นเกมได้ตามปกติ'));
    var acc = S.conf.toggleKey || '';
    powerKey.textContent = acc ? accelLabel(acc) : '';
    powerKey.hidden = !acc;
  }

  // ---------- 2) แผงปุ่ม ----------
  function keyboardCard() {
    kbEl = el('div', { class: 'pad-kb' }, [
      block(ROWS_MAIN, 'main'), block(ROWS_NAV, 'nav'), block(ROWS_NUM, 'num')
    ]);
    kbWrap = el('div', { class: 'pad-kb-wrap' }, [kbEl]);
    // ลากไฟล์มาวางยังใช้ไม่ได้จริงบน Electron 33 (File.path ถูกถอดออก และ preload ยังไม่ส่ง
    // webUtils.getPathForFile มาให้) — ดักไว้ไม่ให้เบราว์เซอร์เปิดไฟล์ทับหน้าต่างแอปทิ้งงานที่ค้างอยู่
    kbWrap.addEventListener('dragover', function (e) { e.preventDefault(); });
    kbWrap.addEventListener('drop', function (e) {
      e.preventDefault();
      toast(t('เวอร์ชันนี้ยังลากไฟล์มาวางไม่ได้ — คลิกที่ปุ่มแล้วเลือกไฟล์เสียงแทน'), 'warn', 4000);
    });
    // ป้ายบอกเลเยอร์ต้องค้างอยู่ตลอดเวลาที่ไม่ใช่ปุ่มเดี่ยว — ไม่งั้นคนที่ลืมว่าติ๊ก Ctrl ค้างไว้
    // จะเห็นแผงว่างเปล่าแล้วนึกว่าเสียงหายไปหมด (แผงเปลี่ยนความหมายทั้งแผงแบบเงียบๆ)
    var layerBadge = hasAnyMod()
      ? el('div', { class: 'pad-layer-tag' }, [
          window.Icon.el('info', 12),
          el('span', { text: t('กำลังดูเลเยอร์ {mods} — คลิกปุ่มเพื่อตั้งเสียงแบบกดพร้อมกัน', {
            mods: modPrefix().map(function (m) { return MOD_LABEL[m]; }).join(' + ')
          }) })
        ])
      : null;

    var head = el('div', { class: 'pad-kb-head' }, [
      el('div', { class: 'card-title' }, [window.Icon.el('keyboard', 14), el('span', { text: t('แผงปุ่ม') })])
    ]);
    // ชุดปุ่มเป็นของที่สลับบ่อยพอๆ กับเลเยอร์ (สลับตามเกม) ไม่ควรต้องกางตั้งค่าขั้นสูงทุกครั้ง
    // โชว์เฉพาะตอนมีมากกว่าหนึ่งชุด — มีชุดเดียวแล้วโชว์ดรอปดาวน์ว่างๆ คือเพิ่มของรกเปล่าๆ
    var bankPick = quickBankPick();
    if (bankPick) head.appendChild(bankPick);
    head.appendChild(modBar());

    var kids = [head];
    if (layerBadge) kids.push(layerBadge);
    kids.push(kbWrap);
    // คำอธิบายสัญลักษณ์ — จุดสีทอง 5px สื่อความหมายด้วยตัวเองไม่ได้ ต้องมีคำกำกับ
    kids.push(el('div', { class: 'pad-kb-legend' }, [
      el('span', { class: 'pad-lg' }, [el('i', { class: 'pad-lg-dot risk' }), el('span', { text: t('ปุ่มนี้ใช้พิมพ์ด้วย เสียงจะลั่นตอนพิมพ์') })]),
      el('span', { class: 'pad-lg' }, [el('i', { class: 'pad-lg-dot hot' }), el('span', { text: t('ถูกใช้เป็นปุ่มลัดของ Soundpad') })]),
      el('span', { class: 'pad-lg' }, [el('i', { class: 'pad-lg-dot bad' }), el('span', { text: t('ไฟล์เสียงโหลดไม่ขึ้น') })]),
      el('span', { class: 'pad-lg pad-lg-tip', text: t('ดับเบิลคลิกที่ปุ่ม = เลือกไฟล์เสียงเลย · คลิกเดียว = เปิดแผงตั้งค่า · ปุ่มร่วมด้านบนตั้งแบบ Ctrl+R ได้') })
    ]));
    return el('div', { class: 'card pad-kb-card' + (hasAnyMod() ? ' on-layer' : '') }, kids);
  }
  // ตัวเลือกชุดปุ่มแบบเร็วบนหัวแผง — ส่วนจัดการ (เพิ่ม/เปลี่ยนชื่อ/ลบ) ยังอยู่ในตั้งค่าขั้นสูงตามเดิม
  function quickBankPick() {
    var banks = (S.conf && S.conf.banks) || [];
    if (banks.length < 2) return null;
    var b = bankOf();
    var sel = el('select', { class: 'pad-quick-bank' });
    banks.forEach(function (bk) {
      if (!bk) return;
      sel.appendChild(el('option', { value: bk.id, text: bk.name || bk.id, selected: bk.id === (b && b.id) ? 'selected' : null }));
    });
    sel.addEventListener('change', function () { switchBank(sel.value); });
    return el('label', { class: 'pad-quick-bank-wrap' }, [
      el('span', { text: t('ชุดปุ่ม') }), sel
    ]);
  }

  // แถบเลือกปุ่มร่วม — ติ๊กแล้วแผงปุ่มสลับไปเลเยอร์นั้นทันที
  function modBar() {
    var wrap = el('div', { class: 'pad-mods' }, [
      el('span', { class: 'pad-mods-label', text: t('ปุ่มร่วม') })
    ]);
    MOD_ORDER.forEach(function (m) {
      // ตัวเลข = จำนวนเสียงของ "เลเยอร์ที่มี modifier ตัวนี้" เสมอ
      // ของเดิมใช้ค่าสลับ (probe[m] = !curMods[m]) ทำให้ปุ่มที่เปิดอยู่ไปโชว์จำนวนของเลเยอร์
      // ปุ่มเดี่ยวแทน — อยู่บนเลเยอร์ Ctrl ที่ว่างเปล่าแต่ปุ่ม Ctrl โชว์ 12 คนอ่านแล้วเข้าใจผิดทันที
      var probe = Object.assign({}, curMods); probe[m] = true;
      var n = countOnLayer(probe);
      var b = el('button', {
        class: 'pad-mod' + (curMods[m] ? ' on' : ''), type: 'button',
        'aria-pressed': curMods[m] ? 'true' : 'false',
        title: t('เปิด/ปิดเลเยอร์ปุ่มร่วม {mod}', { mod: MOD_LABEL[m] })
      }, [el('span', { text: MOD_LABEL[m] })]);
      // ตัวเลขบอกว่าถ้ากดเข้าไปแล้วจะเจอเสียงกี่ปุ่ม — กันลืมว่าซ่อนเสียงไว้ในเลเยอร์ไหน
      if (n > 0) b.appendChild(el('span', { class: 'pad-mod-n', text: String(n) }));
      b.addEventListener('click', function () {
        curMods[m] = !curMods[m];
        S.sel = '';          // ปุ่มที่เลือกอยู่เป็นของเลเยอร์เดิม ไม่เกี่ยวกับเลเยอร์ใหม่
        saveLayer();
        drawKb();
      });
      wrap.appendChild(b);
    });
    if (hasAnyMod()) {
      var clr = el('button', { class: 'pad-mod-clear', type: 'button', text: t('กลับปุ่มเดี่ยว') });
      // ตัวเลขเดียวกับที่ปุ่มโมดิฟายเออร์มี — ตอนนี้แอปเปิดมาค้างบนเลเยอร์เดิมได้แล้ว
      // ถ้าไม่บอกว่าปุ่มเดี่ยวมีเสียงอยู่กี่ปุ่ม คนที่ค้างบนเลเยอร์ Ctrl จะเจอปัญหาเดิมกลับด้าน
      var baseN = countOnLayer({});
      if (baseN > 0) clr.appendChild(el('span', { class: 'pad-mod-n', text: String(baseN) }));
      clr.addEventListener('click', function () {
        MOD_ORDER.forEach(function (m) { curMods[m] = false; });
        S.sel = '';
        saveLayer();
        drawKb();
      });
      wrap.appendChild(clr);
    }
    return wrap;
  }

  function block(rows, cls) {
    return el('div', { class: 'pad-block pad-block-' + cls }, rows.map(function (r) {
      return el('div', { class: 'pad-row' }, r.map(cell));
    }));
  }
  function cell(c) {
    if (c.gap) return el('span', { class: 'pk-gap', style: '--w:' + c.w });
    if (c.dead) {
      // ปุ่มพวกนี้จองเดี่ยวๆ ไม่ได้ (เป็น modifier/ปุ่มระบบ) แต่เดิมกดแล้วเงียบสนิทไม่มีคำอธิบาย
      // และตอนนี้ Ctrl/Shift/Alt/Win โผล่สองที่ (ตรงนี้เทาๆ กับแถบ "ปุ่มร่วม" ด้านบนที่กดได้จริง)
      // คนที่อยากตั้ง Ctrl+R ย่อมมากดตรงนี้ก่อน — ต้องชี้ทางให้
      var isMod = /^(Ctrl|Shift|Alt|Win)$/i.test(c.l);
      return el('span', {
        class: 'pk pk-dead' + (isMod ? ' pk-dead-mod' : ''), style: '--w:' + c.w,
        title: isMod ? t('ตั้งเสียงบนปุ่มนี้เดี่ยวๆ ไม่ได้ — ใช้ปุ่ม {mod} บนแถบ "ปุ่มร่วม" ด้านบนเพื่อตั้งแบบกดพร้อมกัน', { mod: c.l })
                     : t('ปุ่มนี้ตั้งเสียงไม่ได้')
      }, [el('span', { class: 'pk-cap', text: c.l })]);
    }
    // id รวม modifier ของเลเยอร์ที่เปิดอยู่ — โค้ดส่วนอื่น (ระบายสี/ไฮไลต์ที่กำลังเล่น/เลือก)
    // ทำงานด้วย id เต็มอยู่แล้ว จึงไม่ต้องแก้อะไรเพิ่มเมื่อสลับเลเยอร์ แค่วาดแผงปุ่มใหม่
    var id = withMods(c.k);
    var node = el('button', { class: 'pk', type: 'button', style: '--w:' + c.w, 'data-key': id }, [
      el('span', { class: 'pk-cap', text: c.l }),
      el('span', { class: 'pk-name' }),
      el('span', { class: 'pk-prog' })
    ]);
    node.addEventListener('click', function () { select(id); });
    // ดับเบิลคลิก = เลือกไฟล์เสียงใส่ปุ่มนั้นเลย ไม่ต้องไปกดปุ่มในแผงตั้งค่าอีกที
    // (คลิกเดียวยังเป็นแค่ "เลือกดู" เหมือนเดิม คนที่แค่คลิกสำรวจจะได้ไม่โดนกล่องไฟล์เด้งใส่)
    node.addEventListener('dblclick', function (e) {
      e.preventDefault();
      select(id);
      importInto(id);
    });
    keyNodes[id] = node;
    keyLabels[id] = hasAnyMod() ? modPrefix().map(function (m) { return MOD_LABEL[m]; }).concat(c.l).join('+') : c.l;
    paintKey(id);
    return node;
  }

  // ขนาดปุ่มคำนวณจากที่ว่างจริง ไม่ใช่ media query — ปุ่มคือพระเอกของหน้านี้ ต้องใหญ่ที่สุดเท่าที่จอให้ได้
  // (จอกว้างแล้วปล่อยปุ่มเล็กเท่าเดิม = เสียพื้นที่เปล่า จอแคบแล้วปุ่มล้น = ต้องเลื่อนซ้ายขวาทุกครั้ง)
  function sizeKeyboard() {
    if (!kbEl || !kbWrap) return;
    var avail = kbWrap.clientWidth;
    if (!avail) return;              // แท็บยังซ่อนอยู่ วัดไม่ได้ — เดี๋ยววัดใหม่ตอนเปิดแท็บ
    var cs = window.getComputedStyle(kbEl);
    var gap = parseFloat(cs.getPropertyValue('--pk-gap')) || 4;
    var blockGap = parseFloat(cs.columnGap) || 16;
    // ความกว้างรวม = u*หน่วยทั้งหมด + ช่องไฟในแถว + ช่องไฟระหว่างแผง (ดูสูตรความกว้างปุ่มใน app.css)
    var u = (avail - gap * (KB_UNITS - KB_BLOCKS) - blockGap * (KB_BLOCKS - 1)) / KB_UNITS;
    var px = Math.floor(clamp(u, KB_MIN_U, KB_MAX_U));
    // เขียนค่าเดิมซ้ำก็ยังนับเป็นการเปลี่ยนสไตล์ → กล่องถูกวัดใหม่ → ResizeObserver ปลุกตัวเองไม่จบ
    // (เบราว์เซอร์ขึ้นเตือน "ResizeObserver loop completed with undelivered notifications")
    // ค่าไม่เปลี่ยนก็ไม่ต้องแตะ DOM เลย ตัดวงจรตั้งแต่ต้นทาง
    if (px === lastU) return;
    lastU = px;
    kbEl.style.setProperty('--pk-u', px + 'px');
  }
  var lastU = 0;   // ขนาดปุ่มที่เขียนลง DOM ไปแล้วล่าสุด
  var sizeSoon = null;
  function scheduleSize() {
    sizeKeyboard();                 // DOM ต่อเข้าไปแล้ว วัดได้เลยถ้าแท็บเปิดอยู่
    if (sizeSoon) return;
    // ตามไปวัดซ้ำอีกทีหลังเลย์เอาต์นิ่ง (แถบเลื่อนแนวตั้งโผล่แล้วความกว้างเปลี่ยน)
    // ใช้ setTimeout ไม่ใช่ requestAnimationFrame เพราะ rAF ไม่เดินตอนหน้าต่างถูกย่อ/ซ่อน
    sizeSoon = setTimeout(function () { sizeSoon = null; sizeKeyboard(); }, 60);
  }
  window.addEventListener('resize', scheduleSize);
  // แท็บ Sound อาจถูกวาดตอนยังซ่อนอยู่ (แอปเปิดค้างแท็บอื่น) ตอนนั้นความกว้างเป็น 0 วัดไม่ได้เลย
  // และการเปิดแท็บทีหลังไม่ยิง event resize ของหน้าต่าง → ปุ่มจะค้างขนาดสำรองใน CSS ตลอด
  // ResizeObserver ยิงให้เองเมื่อกล่องมีขนาดจริง จึงครอบทั้งกรณีเปิดแท็บและกรณีย่อ/ขยายหน้าต่าง
  var kbRO = null;
  function watchKbSize() {
    if (kbRO) { try { kbRO.disconnect(); } catch (_) {} kbRO = null; }
    if (!kbWrap || typeof window.ResizeObserver !== 'function') return;
    // เขียนสไตล์ในคอลแบ็กของ ResizeObserver ตรงๆ ทำให้เบราว์เซอร์ขึ้นเตือน
    // "ResizeObserver loop completed with undelivered notifications" เพราะการวัดกับการเขียน
    // อยู่ในรอบเดียวกัน — เลื่อนการเขียนออกไปอีกทอดหนึ่ง (ใช้ setTimeout ไม่ใช่ rAF เพราะ
    // rAF ไม่เดินตอนหน้าต่างถูกย่อ ซึ่งเป็นจังหวะที่ต้องวัดใหม่พอดี)
    var roSoon = null;
    kbRO = new window.ResizeObserver(function () {
      if (roSoon) return;
      roSoon = setTimeout(function () { roSoon = null; sizeKeyboard(); }, 0);
    });
    kbRO.observe(kbWrap);
  }

  function select(k) {
    var had = !!padOf(k);
    S.sel = k;
    paintKeys();
    drawEdit();
    // แผงตั้งค่าอยู่ใต้แผงปุ่ม จอเตี้ยๆ จะไม่เห็นว่ามีอะไรเปลี่ยน — เลื่อนให้เห็นเองพอดีๆ
    if (editHost && editHost.firstChild && editHost.scrollIntoView) {
      try { editHost.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (_) {}
    }
    // เดิมคลิกปุ่มว่างแล้วเด้งกล่องเลือกไฟล์ทันที คิดว่าช่วยลดคลิก แต่มันแย่งการควบคุมไปจากผู้ใช้
    // คนที่แค่คลิกดูเฉยๆ ว่าปุ่มนี้มีอะไรจะโดนกล่องไฟล์เด้งใส่ทั้งที่ยังไม่ได้อยากใส่เสียง
    // ให้เปิดแผงตั้งค่าที่มีปุ่ม "เลือกไฟล์เสียง" เด่นๆ แทน — ผู้ใช้เป็นคนตัดสินใจกดเอง
    void had;
  }

  function paintKeys() {
    Object.keys(keyNodes).forEach(paintKey);
    paintPower();
  }
  function paintKey(k) {
    var node = keyNodes[k];
    if (!node) return;
    var p = padOf(k);
    var nameEl = node.querySelector('.pk-name');
    var hotkey = !!S.conf && (sameKey(S.conf.toggleKey, k) || sameKey(S.conf.stopAllKey, k));
    node.classList.toggle('has', !!p);
    node.classList.toggle('sel', S.sel === k);
    node.classList.toggle('playing', !!S.playing[k]);
    node.classList.toggle('queued', !S.playing[k] && !!S.queued[k]);
    node.classList.toggle('bad', !!S.errors[k]);
    node.classList.toggle('hotkey', hotkey);
    node.classList.toggle('risk', !!p && isRisky(k));
    // คีย์บอร์ดมี 90 ปุ่ม ถ้าให้ทุกปุ่มอยู่ใน tab order ต้องกด Tab เกือบร้อยครั้งกว่าจะข้ามไปแผงคิว
    // ให้แวะเฉพาะปุ่มที่มีเสียงกับปุ่มที่เลือกอยู่ (ปุ่มว่างยังคลิกได้ตามปกติ)
    node.tabIndex = (p || S.sel === k) ? 0 : -1;
    node.style.setProperty('--pc', (p && p.color) || DEFAULT_COLOR);
    if (nameEl) nameEl.textContent = p ? (p.name || t('ไม่มีชื่อ')) : '';
    var label = keyLabels[k] || keyLabelFull(k);
    var tip = p ? t('ปุ่ม {key} — {name}', { key: label, name: p.name || t('ไม่มีชื่อ') }) : t('ปุ่ม {key}', { key: label });
    if (S.errors[k]) tip += ' · ' + t('ไฟล์เสียงโหลดไม่ขึ้น — คลิกเพื่อเลือกไฟล์ใหม่');
    tip += ' · ' + t('ดับเบิลคลิก = เลือกไฟล์เสียง');
    if (hotkey) tip += ' · ' + t('ใช้เป็นปุ่มลัดของ Soundpad อยู่');
    else if (p && isRisky(k)) tip += ' · ' + t('ปุ่มนี้ใช้พิมพ์ด้วย — เสียงจะลั่นตอนพิมพ์');
    node.title = tip;
  }

  // ---------- 3ก) แผงคิวเสียง ----------
  // สร้างชิ้นส่วนไว้ครั้งเดียวแล้วอัปเดตในที่ — onQueue ยิงราว 4 ครั้ง/วินาทีตอนมีเสียง
  // ถ้าวาดใหม่ทั้งแผงทุกครั้ง ปุ่มจะกะพริบและกดไม่ทัน
  // ตัวเลือกโหมดเล่นแบบปุ่มเรียง — ต้องอยู่ "ที่เดียวกับคำอธิบายโหมด" คือหัวแผงคิว
  // เดิมคำอธิบายอยู่ในแผงคิวแต่ตัวเปลี่ยนไปซ่อนในตั้งค่าขั้นสูง คนอ่านว่า "ไม่มีคิวรอ"
  // แล้วหาที่เปลี่ยนไม่เจอ (ละเมิดหลักที่ว่าตัวควบคุมต้องอยู่ติดกับสิ่งที่มันคุม)
  var PLAY_MODES_UI = [
    { v: 'queue', t: 'ต่อคิว', tip: 'ดังทีละเสียง กดเพิ่มระหว่างเล่นจะต่อท้ายคิว' },
    { v: 'overlap', t: 'ซ้อนกัน', tip: 'กดกี่ปุ่มก็ดังพร้อมกันหมด' },
    { v: 'cut', t: 'ตัดเสียงเก่า', tip: 'กดเสียงใหม่ เสียงที่ดังอยู่หยุดทันที' }
  ];
  function applyMode(v, btn, wrap) {
    setConf({ playMode: v });
    if (pad()) pad().setPlayMode(v);
    [].forEach.call(wrap.children, function (x) {
      x.classList.toggle('on', x === btn);
      x.setAttribute('aria-pressed', x === btn ? 'true' : 'false');
    });
    paintQueue(pad() ? pad().queue() : null);
    drawEdit();       // คำอธิบายกลุ่มตัดเสียงต่างกันตามโหมด
  }

  function playModeSeg() {
    var wrap = el('div', { class: 'pad-seg' });
    PLAY_MODES_UI.forEach(function (m) {
      var b = el('button', {
        class: 'pad-seg-b' + (playMode() === m.v ? ' on' : ''), type: 'button',
        'aria-pressed': playMode() === m.v ? 'true' : 'false',
        title: t(m.tip), text: t(m.t)
      });
      b.addEventListener('click', function () {
        if (playMode() === m.v) return;
        // สลับออกจากโหมดต่อคิว = เอนจินล้างคิวที่รออยู่ทิ้ง กู้คืนไม่ได้
        // ปุ่มนี้อยู่เหนือรายการคิวพอดี เผลอกดตอนไลฟ์แล้วเพลงที่จัดคิวไว้หายหมด จึงต้องถามก่อน
        var q = pad() ? pad().queue() : null;
        var waiting = (q && q.waiting && q.waiting.length) || 0;
        if (playMode() === 'queue' && m.v !== 'queue' && waiting > 0) {
          Tk.confirmDialog(
            t('เปลี่ยนไปโหมดนี้แล้วเสียงที่รอคิวอยู่ {n} รายการจะถูกล้างทิ้ง ทำต่อไหม', { n: waiting }),
            t('เปลี่ยนโหมด')
          ).then(function (yes) { if (yes) applyMode(m.v, b, wrap); });
          return;
        }
        applyMode(m.v, b, wrap);
      });
      wrap.appendChild(b);
    });
    return wrap;
  }

  function queueCard() {
    var curName = el('span', { class: 'pq-name' });
    var curKey = el('span', { class: 'pq-key' });
    var barFill = el('span', { class: 'pq-bar-fill' });
    var curTime = el('span', { class: 'pq-time' });
    // หยุดเฉพาะเสียงนี้ — เดิมมีแต่ "ข้ามเสียงนี้" ที่โผล่เฉพาะโหมดต่อคิว
    var curStop = el('button', { class: 'pq-del', type: 'button', title: t('หยุดเสียงนี้') }, [window.Icon.el('pause', 12)]);
    curStop.addEventListener('click', function () {
      if (pad() && qUi && qUi.curKey) pad().stop(qUi.curKey);
    });
    var cur = el('div', { class: 'pq-cur' }, [
      el('span', { class: 'pq-ic' }, [window.Icon.el('play', 12)]),
      el('div', { class: 'pq-cur-main' }, [
        el('div', { class: 'pq-cur-top' }, [curName, curKey]),
        el('span', { class: 'pq-bar' }, [barFill])
      ]),
      curTime, curStop
    ]);
    // โหมดซ้อนกัน: แถบ "กำลังเล่น" ด้านบนโชว์ได้ตัวเดียว ทั้งที่เสียงอื่นยังดังอยู่
    // และไม่มีทางหยุดทีละเสียง — มีแต่ "หยุดทุกเสียง" ที่เหวี่ยงเกินไปตอนไลฟ์
    var others = el('div', { class: 'pq-others' });
    var list = el('div', { class: 'pq-list' });
    var empty = el('div', { class: 'pq-empty' }, [
      el('div', { text: t('ยังไม่มีเสียงในคิว') }),
      el('div', { class: 'hint', text: t('กดปุ่มที่ตั้งเสียงไว้ แล้วรายการจะขึ้นที่นี่') })
    ]);
    var note = el('div', { class: 'hint pq-note' });

    var skipBtn = el('button', { class: 'btn btn-sm', type: 'button' }, [
      window.Icon.el('chevronRight', 13), el('span', { text: t('ข้ามเสียงนี้') })
    ]);
    skipBtn.addEventListener('click', function () { if (pad()) pad().skip(); });
    var clearBtn = el('button', { class: 'btn btn-sm btn-ghost', type: 'button', text: t('ล้างคิว') });
    clearBtn.addEventListener('click', function () { if (pad()) pad().clearQueue(); });
    var foot = el('div', { class: 'pq-foot' }, [skipBtn, clearBtn]);

    qUi = { cur: cur, name: curName, key: curKey, bar: barFill, time: curTime,
      curStop: curStop, others: others, oSig: null, oRows: {},
      list: list, empty: empty, note: note, skip: skipBtn, clear: clearBtn, foot: foot, sig: null };

    var card = el('div', { class: 'card pad-queue' }, [
      el('div', { class: 'pad-q-head' }, [
        el('div', { class: 'card-title' }, [window.Icon.el('music', 14), el('span', { text: t('คิวเสียง') })]),
        playModeSeg()
      ]),
      cur, others, list, empty, note, foot
    ]);
    paintQueue(pad() ? pad().queue() : null);
    return card;
  }

  function paintQueue(s) {
    if (!qUi) return;
    s = s || { mode: playMode(), current: null, playing: [], waiting: [] };
    var waiting = s.waiting || [];
    var c = s.current;

    qUi.cur.hidden = !c;
    qUi.curKey = c ? c.key : '';
    if (c) {
      qUi.name.textContent = c.name || t('ไม่มีชื่อ');
      qUi.key.textContent = keyLabelFull(c.key);
      var dur = Number(c.dur) || 0, pos = Number(c.pos) || 0;
      qUi.bar.style.width = dur > 0 ? Math.max(0, Math.min(100, (pos / dur) * 100)) + '%' : '0%';
      qUi.bar.parentNode.classList.toggle('unknown', !(dur > 0));   // ไฟล์ที่ยังไม่รู้ความยาว = ไม่หลอกว่าเดินได้
      qUi.time.textContent = dur > 0 ? mmss(pos) + ' / ' + mmss(dur) : mmss(pos);
    }

    // รายการรอคิวเปลี่ยนไม่บ่อยเท่าแถบความคืบหน้า — เทียบลายเซ็นก่อนค่อยสร้าง DOM ใหม่
    var sig = waiting.map(function (x) { return x.id + ':' + (x.name || '') + ':' + x.key; }).join('|');
    if (sig !== qUi.sig) {
      qUi.sig = sig;
      qUi.list.innerHTML = '';
      waiting.forEach(function (it, i) {
        var del = el('button', { class: 'pq-del', type: 'button', title: t('เอาออกจากคิว') }, [window.Icon.el('x', 12)]);
        del.addEventListener('click', function () { if (pad()) pad().dequeue(it.id); });
        qUi.list.appendChild(el('div', { class: 'pq-item' }, [
          el('span', { class: 'pq-no', text: String(i + 2) + '.' }),   // 1 คือตัวที่กำลังเล่นอยู่
          el('span', { class: 'pq-name', text: it.name || t('ไม่มีชื่อ') }),
          el('span', { class: 'pq-key', text: keyLabelFull(it.key) }),
          el('span', { class: 'pq-dur', text: it.dur > 0 ? mmss(it.dur) : '' }),
          del
        ]));
      });
    }

    // เสียงอื่นที่ยังดังอยู่นอกจากตัวบนสุด (เกิดได้เฉพาะโหมดซ้อนกัน)
    var rest = (s.playing || []).filter(function (x) { return !c || x.key !== c.key; });
    var oSig = rest.map(function (x) { return x.key; }).join('|');
    if (oSig !== qUi.oSig) {
      qUi.oSig = oSig;
      qUi.oRows = {};
      qUi.others.innerHTML = '';
      rest.forEach(function (it) {
        var tm = el('span', { class: 'pq-time' });
        var st = el('button', { class: 'pq-del', type: 'button', title: t('หยุดเสียงนี้') }, [window.Icon.el('pause', 12)]);
        st.addEventListener('click', function () { if (pad()) pad().stop(it.key); });
        qUi.oRows[it.key] = tm;
        qUi.others.appendChild(el('div', { class: 'pq-item pq-live' }, [
          el('span', { class: 'pq-ic' }, [window.Icon.el('music', 11)]),
          el('span', { class: 'pq-name', text: it.name || t('ไม่มีชื่อ') }),
          el('span', { class: 'pq-key', text: keyLabelFull(it.key) }),
          tm, st
        ]));
      });
    }
    rest.forEach(function (it) {
      var tm = qUi.oRows[it.key];
      if (tm) tm.textContent = it.dur > 0 ? mmss(it.pos) + ' / ' + mmss(it.dur) : mmss(it.pos);
    });
    qUi.others.hidden = !rest.length;

    // โหมดซ้อนกับโหมดตัดเสียงเก่า ไม่มีคิวทั้งคู่ แต่ต้องบอกเหตุผลคนละแบบ
    // ไม่งั้นผู้ใช้เห็นแผงคิวว่างแล้วนึกว่าระบบพัง
    var noQueue = s.mode === 'overlap' || s.mode === 'cut';
    // โหมดที่ไม่มีคิว: ข้อความ "ยังไม่มีเสียงในคิว / รายการจะขึ้นที่นี่" ขัดกับหมายเหตุใต้ล่าง
    // ที่บอกว่า "ไม่มีคิวรอ" — ซ่อนกล่องว่างไปเลย เหลือหมายเหตุอธิบายโหมดอย่างเดียว
    qUi.empty.hidden = !!c || waiting.length > 0 || rest.length > 0 || noQueue;
    qUi.note.textContent = s.mode === 'overlap' ? t('โหมดซ้อนกัน — เสียงดังพร้อมกันได้ ไม่มีคิวรอ')
      : s.mode === 'cut' ? t('โหมดตัดเสียงเก่า — กดเสียงใหม่แล้วเสียงเดิมหยุดทันที ไม่มีคิวรอ')
      : '';
    qUi.note.hidden = !noQueue;
    qUi.skip.disabled = !c;
    qUi.clear.disabled = !waiting.length;
    qUi.foot.hidden = noQueue;      // ไม่มีคิว จึงไม่มีอะไรให้ข้าม/ล้าง
    // โหมดต่อคิวมีปุ่ม "ข้ามเสียงนี้" ด้านล่างอยู่แล้ว ซึ่งได้ผลเหมือนกันเป๊ะ
    // โชว์สองปุ่มที่ทำงานเดียวกันคือเพิ่มความงงเปล่าๆ — เก็บไอคอนหยุดไว้ให้โหมดที่ไม่มีคิว
    qUi.curStop.hidden = !noQueue;

    paintProgress(c);
  }

  // แถบความคืบหน้าในตัวปุ่มเอง — เหลือบดูแผงปุ่มก็รู้ว่าเสียงเดินไปถึงไหนแล้ว
  function paintProgress(c) {
    var k = c && c.key;
    if (progKey && progKey !== k && keyNodes[progKey]) keyNodes[progKey].style.setProperty('--prog', '0%');
    progKey = k || '';
    if (!k || !keyNodes[k]) return;
    var dur = Number(c.dur) || 0;
    keyNodes[k].style.setProperty('--prog', dur > 0 ? Math.max(0, Math.min(100, (c.pos / dur) * 100)) + '%' : '0%');
  }

  function watchQueue() {
    if (qOff || !pad()) return;
    qOff = pad().onQueue(function (s) { paintQueue(s); });
  }
  function unwatchQueue() {
    if (!qOff) return;
    try { qOff(); } catch (_) {}
    qOff = null;
  }

  // ---------- 3ข) แผงตั้งค่าปุ่มที่เลือก ----------
  function drawEdit() {
    if (!editHost) return;
    editHost.innerHTML = '';
    if (!S.sel) {
      editHost.appendChild(el('div', { class: 'card pad-edit pad-edit-empty' }, [
        window.Icon.el('keyboard', 22),
        el('div', { class: 'pad-edit-empty-t', text: t('ยังไม่ได้เลือกปุ่ม') }),
        el('div', { class: 'hint', text: t('คลิกปุ่มบนแผงด้านบนเพื่อใส่เสียงและตั้งค่า') })
      ]));
      return;
    }
    var key = S.sel, p = padOf(key);

    var head = el('div', { class: 'pad-edit-head' }, [
      el('span', { class: 'pad-edit-key', text: keyLabelFull(key) }),
      el('span', { class: 'pad-edit-file', text: p ? (p.name || p.url || '') : t('ปุ่มนี้ยังไม่มีเสียง') }),
      el('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: t('ปิดแผง'), onclick: function () { S.sel = ''; paintKeys(); drawEdit(); } })
    ]);

    var pickBtn = el('button', { class: 'btn btn-primary btn-sm', type: 'button' }, [
      window.Icon.el('music', 13), el('span', { text: p ? t('เปลี่ยนไฟล์เสียง') : t('เลือกไฟล์เสียง') })
    ]);
    pickBtn.addEventListener('click', function () { importInto(key); });

    var tools = el('div', { class: 'pad-edit-tools' }, [pickBtn]);
    if (p) {
      var playBtn = el('button', { class: 'btn btn-sm', type: 'button' }, [window.Icon.el('play', 13), el('span', { text: t('ทดลองเล่น') })]);
      playBtn.addEventListener('click', function () { if (pad()) { pushPads(); pad().play(key); } });
      var stopBtn = el('button', { class: 'btn btn-sm', type: 'button' }, [window.Icon.el('pause', 13), el('span', { text: t('หยุด') })]);
      stopBtn.addEventListener('click', function () { if (pad()) pad().stop(key); });
      var delBtn = el('button', { class: 'btn btn-sm btn-danger', type: 'button' }, [window.Icon.el('trash', 13), el('span', { text: t('ลบเสียงออกจากปุ่มนี้') })]);
      delBtn.addEventListener('click', function () {
        Tk.confirmDialog(t('เอาเสียงออกจากปุ่ม {key}?', { key: keyLabelFull(key) }), t('ลบ'), { danger: true }).then(function (yes) {
          if (!yes) return;
          assignPad(key, null, true);
        });
      });
      tools.appendChild(playBtn); tools.appendChild(stopBtn); tools.appendChild(delBtn);
    }

    var kids = [head, tools];
    // เตือนเบาๆ ตรงที่ผู้ใช้กำลังมองอยู่ — ค่าเริ่มต้นไม่กินปุ่ม เสียงบนปุ่มพิมพ์จะลั่นตอนพิมพ์แชทด้วย
    if (p && isRisky(key)) {
      kids.push(el('div', { class: 'pad-warn' }, [
        window.Icon.el('info', 13),
        el('span', { text: t('ปุ่มนี้ใช้พิมพ์ด้วย — เสียงจะลั่นทุกครั้งที่พิมพ์ตัวนี้ ถ้าไม่ต้องการให้เลือกปุ่ม F1–F12 หรือแป้นตัวเลขด้านขวา หรือเปิด "กินปุ่ม" ในตั้งค่าขั้นสูง') })
      ]));
    }
    if (p) kids.push(padForm(key, p));
    else kids.push(el('div', { class: 'hint', text: t('เลือกไฟล์เสียงจากเครื่อง แล้วปุ่มนี้จะพร้อมใช้ทันที') }));

    editHost.appendChild(el('div', { class: 'card pad-edit' }, kids));
  }

  function padForm(key, p) {
    // ชื่อ
    // ไม่ต้อง debounce ซ้อนตรงนี้ — assignPad หน่วงให้อยู่แล้ว ซ้อนสองชั้นจะกลายเป็นรอ 800ms กว่าจะบันทึก
    var name = el('input', { type: 'text', value: p.name || '', placeholder: t('ชื่อที่โชว์บนปุ่ม') });
    name.addEventListener('input', function () {
      var n = keyNodes[key] && keyNodes[key].querySelector('.pk-name');
      if (n) n.textContent = name.value || t('ไม่มีชื่อ');   // ป้ายบนปุ่มขยับตามมือ ส่วนการเขียนไฟล์รอหยุดพิมพ์
      patchSelected({ name: name.value });
    });

    // ระดับเสียง
    var volVal = el('b', { text: Math.round((p.volume != null ? p.volume : 1) * 100) + '%' });
    var vol = el('input', { type: 'range', min: '0', max: '1', step: '0.01', value: String(p.volume != null ? p.volume : 1) });
    vol.addEventListener('input', function () {
      var v = clamp(vol.value, 0, 1);
      volVal.textContent = Math.round(v * 100) + '%';
      patchSelected({ volume: v });
    });

    // โหมด
    var mode = el('select', {}, [
      el('option', { value: 'oneshot', text: t('กดครั้งเดียว — เล่นจนจบ') }),
      el('option', { value: 'hold', text: t('กดค้าง — ปล่อยแล้วหยุด') }),
      el('option', { value: 'toggle', text: t('กดสลับ — กดอีกครั้งหยุด (เหมาะกับเพลง)') })
    ]);
    mode.value = p.mode || 'oneshot';
    mode.addEventListener('change', function () { patchSelected({ mode: mode.value }); });

    var loop = el('input', { type: 'checkbox' });
    loop.checked = !!p.loop;
    loop.addEventListener('change', function () { patchSelected({ loop: loop.checked }); });

    var fadeIn = el('input', { type: 'number', min: '0', max: '30', step: '0.1', value: String(p.fadeIn || 0) });
    fadeIn.addEventListener('change', function () { patchSelected({ fadeIn: clamp(fadeIn.value || 0, 0, 30) }); });
    var fadeOut = el('input', { type: 'number', min: '0', max: '30', step: '0.1', value: String(p.fadeOut || 0) });
    fadeOut.addEventListener('change', function () { patchSelected({ fadeOut: clamp(fadeOut.value || 0, 0, 30) }); });

    // กลุ่มตัดเสียง — datalist จากกลุ่มที่มีอยู่แล้วในแบงก์นี้ ผู้ใช้จะได้ไม่พิมพ์ชื่อเพี้ยนจนตัดกันไม่ติด
    var listId = 'padChokeList';
    var dl = el('datalist', { id: listId });
    var seen = {};
    var ks = keysOf();
    Object.keys(ks).forEach(function (k) {
      var g = ks[k] && ks[k].choke;
      if (g && !seen[g]) { seen[g] = 1; dl.appendChild(el('option', { value: g })); }
    });
    var choke = el('input', { type: 'text', list: listId, value: p.choke || '', placeholder: t('เช่น music') });
    // กลุ่มตัดเสียงมีผลเฉพาะโหมดเล่นซ้อน — โหมดอื่นปล่อยให้พิมพ์ได้ทั้งที่ไม่เกิดอะไรขึ้น
    // คือหลอกว่าตั้งแล้วได้ผล ปิดช่องไปเลย (คำอธิบายใต้ช่องบอกเหตุผลอยู่แล้ว)
    if (playMode() !== 'overlap') { choke.disabled = true; }
    choke.addEventListener('input', function () { patchSelected({ choke: choke.value.trim() }); });

    var color = el('input', { type: 'color', class: 'opt-color', value: p.color || DEFAULT_COLOR });
    color.addEventListener('input', function () {
      var node = keyNodes[key];
      if (node) node.style.setProperty('--pc', color.value);
      patchSelected({ color: color.value });
    });

    return el('div', { class: 'pad-form' }, [
      field(t('ชื่อเสียง'), name),
      el('div', { class: 'slider-row' }, [
        el('label', {}, [el('span', { text: t('ระดับเสียงของปุ่มนี้') }), volVal]), vol
      ]),
      field(t('โหมดการเล่น'), mode),
      field(t('กลุ่มตัดเสียง'), el('div', {}, [choke, dl]),
        playMode() === 'overlap'
          ? t('ปุ่มที่อยู่กลุ่มเดียวกันจะไม่ดังพร้อมกัน — ใส่ชื่อเดียวกันให้ทุกเพลง เช่น music')
          : playMode() === 'cut'
            ? t('โหมดตัดเสียงเก่าหยุดทุกเสียงอยู่แล้ว — ช่องนี้จึงไม่มีผลในโหมดนี้')
            : t('ใช้เฉพาะโหมดเล่นแบบ "ซ้อนกัน" — โหมดต่อคิวดังทีละเสียงอยู่แล้ว')),
      field(t('เฟดเข้า (วินาที)'), fadeIn),
      field(t('เฟดออก (วินาที)'), fadeOut),
      field(t('สีปุ่ม'), color),
      el('label', { class: 'switch-row pad-form-loop' }, [el('span', { text: t('เล่นวนซ้ำ (ลูป)') }), loop])
    ]);
  }

  // นำไฟล์เข้าคลังแล้วผูกกับปุ่ม — main เป็นคนเปิดกล่องเลือกไฟล์เอง
  function importInto(key) {
    invoke('soundpad:import', {}, { toast: false })
      .then(function (r) {
        if (!r || !r.ok || !r.url) return;              // ผู้ใช้กดยกเลิกกล่องเลือกไฟล์ = เงียบไว้
        var p = padOf(key) || blankPad();
        p.url = r.url;
        if (!p.name) p.name = r.name || '';
        S.sel = key;
        assignPad(key, p, true);
        pushPads();
        // เตือนครั้งเดียวต่อการเปิดแอปหนึ่งครั้ง — เตือนทุกใบจะกลายเป็นรำคาญ
        if (isRisky(key) && !S.riskWarned) {
          S.riskWarned = true;
          toast(t('ใส่เสียงลงปุ่มที่ใช้พิมพ์ — เสียงจะลั่นตอนพิมพ์ด้วย (เปิด "กินปุ่ม" ในตั้งค่าขั้นสูงถ้าไม่ต้องการ)'), 'warn', 5000);
        }
      })
      .catch(function (e) { toast(t('นำเข้าไฟล์เสียงไม่สำเร็จ: {err}', { err: (e && e.message) || e }), 'err'); });
  }

  // ---------- 4) ตั้งค่าขั้นสูง (ยุบไว้) ----------
  // จำสถานะพับ/กางไว้นอกฟังก์ชัน — หน้าถูกวาดใหม่ทั้งใบตอนสลับชุดปุ่มหรือสลับภาษา
  // ถ้าไม่จำ ผู้ใช้ที่กำลังตั้งค่าขั้นสูงอยู่จะโดนพับใส่หน้าทุกครั้ง
  var advOpen = false;
  function advancedCard() {
    var body = el('div', { class: 'optgrp-body pad-adv-body' }, [
      bankRow(),
      el('div', { class: 'pad-adv-grid' }, [
        field(t('ปุ่มลัดเปิด/ปิดระบบ'), hotkeyField('toggleKey'),
          t('กดจากโปรแกรมไหนก็ได้เพื่อเปิด/ปิด Soundpad ทั้งระบบ')),
        field(t('ปุ่มลัดหยุดทุกเสียง'), hotkeyField('stopAllKey'),
          t('กดแล้วเสียงที่ดังอยู่หยุดทันทีและล้างคิวทิ้ง')),
        outputField()
      ]),
      swallowRow(),
      el('div', { class: 'switch-grid pad-adv-switches' }, [cueRow()]),
      diagRow()
    ]);
    var det = el('details', { class: 'optgrp pad-adv', open: advOpen ? 'open' : null }, [
      el('summary', {}, [window.Icon.el('settings', 13), el('span', { text: t('ตั้งค่าขั้นสูง') })]),
      body
    ]);
    det.addEventListener('toggle', function () { advOpen = det.open; });
    return det;
  }

  // แผงตรวจสภาพ — ไว้ให้ผู้ใช้ส่งค่าจริงจากเครื่องตัวเองมาให้ดูตอนแจ้งปัญหา
  // "กดปุ่มแล้วไม่มีอะไรเกิดขึ้น" เกิดได้หลายสาเหตุที่หน้าตาเหมือนกันหมด เดาจากปลายทางไม่ได้
  function diagRow() {
    var out = el('pre', { class: 'pad-diag-out' });
    out.hidden = true;
    var runBtn = el('button', { class: 'btn btn-sm', type: 'button' }, [
      window.Icon.el('flask', 13), el('span', { text: t('ตรวจสภาพระบบปุ่ม') })
    ]);
    var copyBtn = el('button', { class: 'btn btn-sm btn-ghost', type: 'button' }, [
      window.Icon.el('copy', 13), el('span', { text: t('คัดลอกผล') })
    ]);
    copyBtn.hidden = true;
    // ลองเปิดตัวดักคีย์ใหม่โดยไม่ต้องปิดเปิดแอป — ช่วยเคสที่รอบแรกพลาดเพราะจังหวะ
    // (เช่นแอนตี้ไวรัสยังสแกนไฟล์ helper อยู่ตอนเปิดโปรแกรมครั้งแรกหลังติดตั้ง)
    var retryBtn = el('button', { class: 'btn btn-sm', type: 'button' }, [
      window.Icon.el('refresh', 13), el('span', { text: t('ลองเปิดระบบปุ่มใหม่') })
    ]);
    retryBtn.addEventListener('click', function () {
      retryBtn.disabled = true;
      invoke('soundpad:retryHook', {}, { toast: false })
        .then(function (r) {
          toast(r && r.ok ? t('เปิดระบบปุ่มได้แล้ว — ลองกดปุ่มที่ตั้งเสียงไว้ดู') : t('ยังเปิดไม่ได้ — กดตรวจสภาพแล้วส่งผลให้ผู้พัฒนาดู'),
            r && r.ok ? 'ok' : 'err', 5000);
          runBtn.click();   // อัปเดตผลตรวจให้เห็นค่าล่าสุดทันที
        })
        .finally(function () { retryBtn.disabled = false; });
    });
    var text = '';
    runBtn.addEventListener('click', function () {
      invoke('soundpad:diag', {}, { toast: false }).then(function (d) {
        text = JSON.stringify(d, null, 2);
        out.textContent = text;
        out.hidden = false; copyBtn.hidden = false;
      }).catch(function (e) {
        out.textContent = t('ตรวจไม่สำเร็จ: ') + ((e && e.message) || e);
        out.hidden = false;
      });
    });
    copyBtn.addEventListener('click', function () {
      try { navigator.clipboard.writeText(text); toast(t('คัดลอกแล้ว'), 'ok'); } catch (_) {}
    });
    return el('div', { class: 'pad-diag' }, [
      el('div', { class: 'pad-diag-head' }, [runBtn, retryBtn, copyBtn]),
      el('div', { class: 'hint', text: t('กดปุ่มบนคีย์บอร์ดสัก 2-3 ครั้งก่อน แล้วค่อยกดตรวจ — ผลจะบอกว่าโปรแกรมเห็นปุ่มที่กดหรือเปล่า') }),
      out
    ]);
  }

  function bankRow() {
    var c = S.conf, b = bankOf();
    var sel = el('select', { class: 'pad-bank-sel' });
    (c.banks || []).forEach(function (bk) {
      if (!bk) return;
      sel.appendChild(el('option', { value: bk.id, text: bk.name || bk.id, selected: bk.id === (b && b.id) ? 'selected' : null }));
    });
    sel.addEventListener('change', function () { switchBank(sel.value); });

    var name = el('input', { type: 'text', value: (b && b.name) || '', placeholder: t('ชื่อชุดปุ่ม') });
    name.addEventListener('input', function () {     // setConf หน่วงให้อยู่แล้ว ไม่ต้องซ้อนอีกชั้น
      var bk = bankOf();
      if (!bk) return;
      bk.name = name.value;
      setConf({ banks: S.conf.banks });
      var opt = sel.querySelector('option[value="' + bk.id + '"]');
      if (opt) opt.textContent = bk.name || bk.id;
    });

    var addBtn = el('button', { class: 'btn btn-sm', type: 'button', title: t('เพิ่มชุดปุ่มใหม่') }, [window.Icon.el('plus', 13)]);
    addBtn.addEventListener('click', function () {
      var list = (S.conf.banks || []).slice();
      var id = 'b_' + Date.now().toString(36);
      // ชื่อชุดที่บันทึกลงข้อมูลผู้ใช้ตั้งเป็นอังกฤษเสมอ (ดูเหตุผลที่ addProfile ใน app.js)
      list.push({ id: id, name: 'Bank ' + (list.length + 1), keys: {} });
      setConf({ banks: list });
      switchBank(id);
    });

    var delBtn = el('button', { class: 'btn btn-sm btn-danger', type: 'button', title: t('ลบชุดปุ่มนี้') }, [window.Icon.el('trash', 13)]);
    delBtn.addEventListener('click', function () {
      var list = (S.conf.banks || []).slice();
      if (list.length <= 1) { toast(t('ต้องเหลือชุดปุ่มอย่างน้อย 1 ชุด'), 'warn'); return; }
      var cur = bankOf();
      Tk.confirmDialog(t('ลบชุด "{name}" พร้อมเสียงทุกปุ่มในชุดนี้?', { name: (cur && cur.name) || '' }), t('ลบ'), { danger: true })
        .then(function (yes) {
          if (!yes) return;
          list = list.filter(function (x) { return x && x.id !== cur.id; });
          setConf({ banks: list });
          switchBank(list[0].id);
        });
    });

    return el('div', { class: 'pad-banks' }, [
      el('span', { class: 'pad-banks-label', text: t('ชุดปุ่ม') }),
      sel, name, addBtn, delBtn
    ]);
  }

  // สลับชุดปุ่มต้องเขียนทันทีและวาดใหม่ทั้งหน้า — เดิมหน่วงไว้ 400ms แล้วคำตอบของคำสั่งก่อนหน้า
  // กลับมาทับ activeBank ทีหลัง ทำให้ dropdown เป็นชุดใหม่แต่แผงปุ่ม/เอนจินยังเป็นชุดเก่า
  function switchBank(id) {
    if (!id) return;
    S.sel = '';
    commitNow({ activeBank: id });
    draw();
    pushPads();
  }


  function outputField() {
    var sel = el('select', {}, [el('option', { value: '', text: t('อุปกรณ์เริ่มต้นของระบบ') })]);
    sel.addEventListener('change', function () {
      if (pad()) pad().setOutput(sel.value);
      setConf({ outputDeviceId: sel.value });
    });
    // Chromium ปกปิดชื่ออุปกรณ์จนกว่าจะได้สิทธิ์ไมโครโฟน — ปุ่มนี้ให้ผู้ใช้กดขอเอง
    // (ขอเงียบๆ ตอนเปิดแท็บจะเด้งกล่องสิทธิ์ใส่หน้าโดยไม่มีใครรู้ว่าทำไม)
    var askBtn = el('button', { class: 'btn btn-sm', type: 'button', text: t('อนุญาตเพื่อดูรายชื่ออุปกรณ์') });
    askBtn.addEventListener('click', function () {
      if (!pad()) return;
      askBtn.disabled = true;
      pad().devices({ ask: true }).then(function (list) {
        askBtn.disabled = false;
        fillDevices(sel, list, askBtn);
      }).catch(function () { askBtn.disabled = false; });
    });
    if (pad()) pad().devices({ ask: false }).then(function (list) { fillDevices(sel, list, askBtn); }).catch(function () {});
    return field(t('อุปกรณ์เสียงออก'), el('div', { class: 'pad-dev-row' }, [sel, askBtn]),
      t('เลือกลำโพง/สายเสมือนที่จะให้เสียงแพดออก — ตั้งเป็นสายที่โปรแกรมไลฟ์รับอยู่ได้'));
  }

  function fillDevices(sel, list, askBtn) {
    // คำตอบอาจกลับมาหลังหน้าถูกวาดใหม่ไปแล้ว — ช่องเก่าที่หลุดจาก DOM ไม่ควรไปแก้ค่าที่บันทึกไว้
    if (sel.isConnected === false) return;
    while (sel.options.length > 1) sel.remove(1);
    var added = 0;
    (list || []).forEach(function (d) {
      if (!d || !d.deviceId || d.deviceId === 'default') return;   // 'default' ซ้ำกับตัวเลือกแรกอยู่แล้ว
      sel.appendChild(el('option', { value: d.deviceId, text: d.label }));
      added++;
    });
    // เห็นรายชื่อแล้วก็ไม่ต้องมีปุ่มขอสิทธิ์เกะกะอีก (ปุ่มยาวกว่าช่องเลือกเสียด้วยซ้ำ)
    if (askBtn) askBtn.hidden = added > 0;
    var want = (S.conf && S.conf.outputDeviceId) || '';
    sel.value = want;
    if (!want || sel.value === want) return;
    sel.value = '';
    // ยังไม่ได้สิทธิ์ดูรายชื่ออุปกรณ์ = มองไม่เห็นอะไรเลย ห้ามสรุปว่าอุปกรณ์หาย
    // (ไม่งั้นแค่เปิดแท็บก็ลบค่าที่ผู้ใช้ตั้งไว้ทิ้งเงียบๆ)
    if (!added) return;
    // อุปกรณ์ที่เคยเลือกไว้ถูกถอดออกไปจริง — ล้างค่าที่ค้างด้วย ไม่งั้นเตือนซ้ำทุกครั้งที่เปิดแท็บ
    setConf({ outputDeviceId: '' });
    if (pad()) pad().setOutput('');
    if (S.devWarned) return;
    S.devWarned = true;
    toast(t('ไม่พบอุปกรณ์เสียงที่เคยเลือกไว้ — กลับไปใช้อุปกรณ์เริ่มต้น'), 'warn', 4000);
  }

  function swallowRow() {
    var sw = el('input', { type: 'checkbox' });
    sw.checked = swallows();
    var auto = el('input', {
      type: 'number', min: '0', max: String(AUTO_OFF_MAX), step: '5',
      value: String(S.conf.autoOffSec || 0)
    });
    var lockHint = el('span', { class: 'hint pad-lock-hint' });
    function syncAuto() {
      auto.disabled = !swallows();      // ปิดเองมีเหตุผลเฉพาะตอนกินปุ่ม (ดู src/core/soundpad.js)
    }
    // เดิม: ติ๊กได้ แล้วเด้งกลับพร้อม toast — ผู้ใช้เห็นช่องเปิดใช้งานได้แต่กดแล้วไม่ติด
    // ตอนนี้ล็อกไว้ตั้งแต่ต้นพร้อมบอกเหตุผลตรงนั้นเลย ไม่ต้องลองผิดก่อนถึงจะรู้
    function syncLock() {
      var ready = !!(S.conf && S.conf.toggleKey);
      sw.disabled = !ready;
      lockHint.textContent = ready ? '' : t('ตั้ง "ปุ่มลัดเปิด/ปิดระบบ" ด้านบนก่อน ถึงจะเปิดได้');
      lockHint.hidden = ready;
    }
    syncSwallowLock = syncLock;
    sw.addEventListener('change', function () {
      // กินปุ่มโดยไม่มีปุ่มลัดปิด = คีย์บอร์ดถูกยึดแล้วไม่มีทางออก — main ก็ปฏิเสธไม่จองให้อยู่ดี
      if (sw.checked && !(S.conf.toggleKey || '')) {
        sw.checked = false;
        toast(t('ตั้ง "ปุ่มลัดเปิด/ปิดระบบ" ก่อน แล้วค่อยเปิดกินปุ่ม — ไม่งั้นคืนคีย์บอร์ดให้เกม/ช่องแชทไม่ได้'), 'warn', 5000);
        return;
      }
      setConf({ swallowKeys: sw.checked });
      syncAuto();
      paintPower();
      paintKeys();      // จุดเตือน "ปุ่มนี้ใช้พิมพ์" มีความหมายเฉพาะตอนไม่กินปุ่ม
    });
    auto.addEventListener('change', function () {
      var v = Math.round(clamp(auto.value || 0, 0, AUTO_OFF_MAX));
      auto.value = String(v);
      setConf({ autoOffSec: v });
    });
    syncAuto();
    syncLock();
    var autoField = field(t('ปิดระบบเองเมื่อไม่ได้กด (วินาที)'), auto,
      t('0 = ไม่ปิดเอง · ใช้ได้เฉพาะตอนเปิด "กินปุ่ม" — กันลืมเปิดค้างแล้วพิมพ์ไม่ได้'));
    autoField.classList.add('pad-autooff');   // ช่องตัวเลขสองหลักไม่ต้องกว้างครึ่งจอ
    return el('div', { class: 'pad-adv-grid' }, [
      el('label', { class: 'switch-row pad-swallow' }, [
        el('span', {}, [
          el('b', { text: t('กินปุ่ม (ไม่ให้ทะลุไปเกม/ช่องแชท)') }),
          el('span', { class: 'hint', text: t('ปิดไว้ = กด num1 แล้วได้ทั้งเสียงและตัวเลข · เปิด = ปุ่มที่ตั้งเสียงจะถูกยึดไว้') }),
          lockHint
        ]),
        sw
      ]),
      autoField
    ]);
  }

  function cueRow() {
    var cue = el('input', { type: 'checkbox' });
    cue.checked = S.conf.cueSound !== false;
    cue.addEventListener('change', function () { setConf({ cueSound: cue.checked }); });
    return el('label', { class: 'switch-row' }, [el('span', { text: t('เสียงติ๊ดตอนเปิด/ปิดระบบ') }), cue]);
  }

  // ---------- วาดทั้งหน้า ----------
  function draw() {
    root = document.getElementById('soundpadRoot');
    if (!root) return;
    unwatchQueue();
    if (kbRO) { try { kbRO.disconnect(); } catch (_) {} kbRO = null; }   // ของเก่าเฝ้ากล่องที่กำลังจะถูกทิ้ง
    lastU = 0;   // คีย์บอร์ดตัวใหม่ยังไม่เคยถูกตั้งขนาด ต้องยอมให้เขียนค่าแรกเสมอ
    root.innerHTML = '';
    keyNodes = {}; keyLabels = {}; qUi = null; progKey = '';
    powerBtn = null; powerTitle = null; powerSub = null; powerKey = null;
    kbEl = null; kbWrap = null; qHost = null; editHost = null;
    if (S.err) {
      // เดิมเป็นทางตัน: ข้อความสีจางอย่างเดียว ต้องปิดเปิดแอปใหม่ถึงจะหาย
      var retry = el('button', { class: 'btn btn-sm', type: 'button' }, [
        window.Icon.el('refresh', 13), el('span', { text: t('ลองใหม่') })
      ]);
      retry.addEventListener('click', function () { S.err = null; draw(); load(); });
      root.appendChild(el('div', { class: 'card pad-edit-empty' }, [
        el('span', { class: 'muted', text: S.err }),
        el('div', { style: 'margin-top:12px' }, [retry])
      ]));
      return;
    }
    if (!S.conf) {
      root.appendChild(el('div', { class: 'card pad-edit-empty' }, [
        el('span', { class: 'muted', text: t('กำลังโหลด...') })
      ]));
      return;
    }
    root.appendChild(controlBar());
    root.appendChild(keyboardCard());
    qHost = el('div', { class: 'pad-col' });
    editHost = el('div', { class: 'pad-col' });
    qHost.appendChild(queueCard());
    root.appendChild(el('div', { class: 'pad-cols' }, [qHost, editHost]));
    root.appendChild(advancedCard());
    paintKeys();
    paintHookWarn();
    drawEdit();
    watchKbSize();
    scheduleSize();
    if (visible()) watchQueue();   // ปิดแท็บอยู่ก็ไม่ต้องให้ตัวจับเวลาของเอนจินเดินฟรี
  }

  // วาดเฉพาะการ์ดแผงปุ่มใหม่ (ใช้ตอนสลับเลเยอร์ปุ่มร่วม) — ไม่ต้องวาดทั้งหน้า
  // เพราะแถบควบคุม/คิว/ตั้งค่าขั้นสูงไม่ได้เปลี่ยนอะไรเลย วาดทั้งหน้าจะทำให้ details ที่กางไว้หุบ
  function drawKb() {
    if (!root) return;
    var old = root.querySelector('.pad-kb-card');
    if (!old) { draw(); return; }
    if (kbRO) { try { kbRO.disconnect(); } catch (_) {} kbRO = null; }
    // ปุ่มของเลเยอร์เดิมกำลังจะถูกทิ้ง ต้องล้างทะเบียนก่อน ไม่งั้นค้างชี้ไป node ที่หลุดจาก DOM
    keyNodes = {}; keyLabels = {}; kbEl = null; kbWrap = null; lastU = 0;
    var fresh = keyboardCard();
    old.parentNode.replaceChild(fresh, old);
    paintKeys();
    drawEdit();          // ปุ่มที่เลือกถูกล้างไปแล้ว แผงตั้งค่าต้องกลับเป็นสถานะว่าง
    watchKbSize();
    scheduleSize();
  }

  // ---------- โหลดค่า ----------
  function load() {
    if (S.loading) return Promise.resolve();
    S.loading = true;
    return invoke('soundpad:get', {}, { toast: false })
      .then(function (r) {
        S.loading = false;
        S.err = null;
        S.conf = r || null;
        S.on = !!(r && r.on);
        S.hookOk = !r || r.hookOk !== false;
        restoreLayer();   // ต้องมาก่อน draw() ไม่งั้นแผงวาดด้วยเลเยอร์ผิดแล้วค่อยกระพริบเปลี่ยน
        pushPads();
        draw();
      })
      .catch(function (e) {
        S.loading = false;
        // คำสั่งกลุ่ม soundpad: ผ่านด่านสิทธิ์ — ผู้ใช้ที่สมาชิกหมดอายุจะมาถึงตรงนี้ ต้องบอกเหตุผล ไม่ใช่หน้าว่าง
        S.err = t('เปิด Soundpad ไม่ได้: {err}', { err: (e && e.message) || e });
        draw();
      });
  }

  // ---------- API ที่ app.js เรียก ----------
  function mount(opts) {
    S.mounted = true;
    S.port = (opts && opts.port) || S.port;
    window.__TK_SERVER_PORT = S.port;      // ตั้งไว้ตั้งแต่ต้น เผื่อ event เข้ามาก่อนผู้ใช้เปิดแท็บ
    if (pad()) {
      pad().onState(function (st) {
        S.playing = {}; S.errors = {}; S.queued = {};
        (st.playing || []).forEach(function (k) { S.playing[k] = true; });
        (st.errors || []).forEach(function (k) { S.errors[k] = true; });
        (st.queued || []).forEach(function (k) { S.queued[k] = true; });
        Object.keys(keyNodes).forEach(paintKey);
      });
    }
    load();
  }

  // เปิดแท็บ — setupTabs() ของ app.js วิ่งก่อน state:get เสมอ ตอนนั้นยังไม่รู้พอร์ตเซิร์ฟเวอร์
  // ถ้าปล่อยให้โหลดตรงนี้ ปุ่มจะถูกดันเข้าเอนจินด้วยพอร์ตเดา → ไฟล์เสียง 404 ทั้งแผง
  function show() {
    if (!S.mounted) return;
    if (!S.conf && !S.loading) { load(); return; }
    draw();
  }
  function hide() {
    unwatchQueue();   // เอนจินต้องทำงานต่อแม้ปิดแท็บ แต่แถบความคืบหน้าไม่มีใครดูแล้ว
  }

  function onEvent(event, data) {
    if (event === 'soundpadKey') {
      if (!pad() || !data || !data.key) return;
      if (data.down) {
        pad().play(data.key);
        // เครื่องที่ดักปุ่ม "ปล่อย" ไม่ได้ (ไม่มี keyHook) จะไม่มี down:false ตามมา โหมดกดค้างจึงกลาย
        // เป็นเล่นจนจบเอง — บอกผู้ใช้ครั้งเดียวพอ ไม่ใช่ปล่อยให้งงว่าทำไมปล่อยแล้วไม่หยุด
        if (data.noKeyUp && !S.noKeyUpWarned) {
          var p = padOf(data.key);
          if (p && p.mode === 'hold') {
            S.noKeyUpWarned = true;
            toast(t('เครื่องนี้ดักจังหวะ "ปล่อยปุ่ม" ไม่ได้ — ปุ่มโหมดกดค้างจะเล่นเหมือนกดครั้งเดียว'), 'warn', 5000);
          }
        }
      } else pad().release(data.key);
      return;
    }
    // คำสั่งรวมจาก main (ปุ่มลัดหยุดทุกเสียง / ปิดระบบ) — main เล่นหรือหยุดเสียงเองไม่ได้
    // รับชื่อ event สำรอง 'soundpadStopAll' ไว้ด้วย เผื่อฝั่ง core เปลี่ยนไปใช้ชื่อนั้น
    if (event === 'soundpadCmd' || event === 'soundpadStopAll') {
      var cmd = event === 'soundpadStopAll' ? 'stopAll' : (data && data.cmd);
      if (cmd === 'stopAll' && pad()) pad().stopAll();
      return;
    }
    if (event !== 'soundpadState' || !data) return;
    var wasOn = S.on;
    var bankId = data.bank && data.bank.id;
    if (S.conf && bankId && bankId !== S.conf.activeBank) { load(); return; }   // แบงก์ถูกสลับจากที่อื่น — ดึงค่าใหม่ทั้งก้อน
    var b = bankOf();
    if (b && data.keys) { b.keys = data.keys; overlayPending(); pushPads(); paintKeys(); }
    S.on = !!data.on;
    if (S.conf) S.conf.enabled = S.on;
    if ('hookOk' in data) { S.hookOk = !!data.hookOk; paintHookWarn(); }
    paintPower();
    // เสียงติ๊ดต้องดังจาก renderer (main เล่นเสียงเองไม่ได้) — เฉพาะตอนสถานะเปลี่ยนจริง
    if (pad() && S.conf && S.conf.cueSound !== false && wasOn !== S.on &&
        (data.reason === 'toggle' || data.reason === 'auto-off')) pad().cue(S.on);
  }

  function rerender() { if (S.conf || S.err) draw(); }

  return { mount: mount, show: show, hide: hide, onEvent: onEvent, rerender: rerender };
})();
