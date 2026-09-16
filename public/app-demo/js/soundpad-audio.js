// เอนจินเสียงของ Soundpad (ฝั่ง renderer) — window.TkPad
// -------------------------------------------------------------------
// ทำไมไม่ใช้ new Audio(url) ต่อการกดหนึ่งครั้งแบบ playSound() ใน app.js:
// สตรีมเมอร์กดปุ่มแล้วต้องดังทันที แต่ new Audio() เริ่มโหลดไฟล์ตอนกด ดีเลย์ 100–400ms
// (และกดรัวๆ ก็สร้าง element ทิ้งขว้างเรื่อยๆ) จึงเตรียมของไว้ล่วงหน้าตั้งแต่ setPads:
//   - ไฟล์สั้น  → decodeAudioData เก็บ AudioBuffer ไว้ใน RAM กดแล้วดังทันที ปุ่มอื่นซ้อนกันได้
//   - ไฟล์ยาว  → <audio> + createMediaElementSource สตรีมจากดิสก์ (เพลง 5 นาที decode แล้วกิน RAM
//                หลายสิบ MB ต่อปุ่ม ถ้าทั้ง bank เป็นเพลงจะบวมจนแอปหน่วงกลางไลฟ์)
// ทุกเสียงเดินผ่าน GainNode ของตัวเอง → master gain → destination เพื่อทำ fade/โวลุ่มต่อปุ่ม
// ได้โดยไม่แตะ el.volume (ซึ่ง ramp ไม่ได้ ต้องไล่ทีละ step)
//
// โหมดการเล่นมีสามแบบ (ค่าเริ่มต้น = 'queue' ตามค่าเริ่มต้นของ settings.soundpad.playMode):
//   queue   — ดังทีละเสียง กดเพิ่มระหว่างเล่น = ต่อท้ายคิว (สตรีมเมอร์กดรัวแล้วเสียงไม่ตีกัน)
//   overlap — พฤติกรรมเดิม ซ้อนกันได้ และใช้ choke group คุมว่าปุ่มไหนห้ามดังพร้อมกัน
//
// เปิดผ่าน file:// เหมือนไฟล์อื่นในโฟลเดอร์นี้ จึงเป็น IIFE ตั้ง global ไม่ใช้ require/import
(function () {
  'use strict';

  var SHORT_SEC = 15;                       // ยาวเกินนี้ถือเป็น "เพลง" → สตรีม ไม่เก็บลง RAM
  var MAX_DECODE_BYTES = 4 * 1024 * 1024;   // เสียงมีม 15 วิ ไม่เคยเกินนี้ (WAV 15 วิ ~2.6MB) ใหญ่กว่านี้ข้ามไปสตรีมเลย
  var CLICK_GUARD = 0.015;                  // เฟดขั้นต่ำ 15ms — ตัด gain ดิบๆ จะได้ยินเสียง "ป๊อก"
  var LOAD_TIMEOUT_MS = 12000;              // กันปุ่มค้างสถานะ "กำลังโหลด" ตลอดกาลเมื่อไฟล์หาย
  var PENDING_PLAY_MS = 5000;               // กดตอนยังโหลดไม่เสร็จ → เล่นให้เมื่อพร้อม แต่ไม่ย้อนหลังเกินนี้ (กันเสียงลั่นทีหลัง)
  var RETRY_FAILED_MS = 15000;              // ปุ่มที่โหลดพัง รอเท่านี้ก่อนลองใหม่ — setPads ถูกเรียกทุกครั้งที่แก้ค่า จะได้ไม่ยิงซ้ำรัว
  var QUEUE_TICK_MS = 250;                  // ~4 ครั้ง/วินาที พอให้แถบความคืบหน้าเดินลื่น แต่ไม่กิน CPU (เดินเฉพาะตอนมีเสียง)
  var DEFAULT_PORT = 21213;                 // ตรงกับ settings.serverPort เริ่มต้น เผื่อ UI ยังไม่ได้ตั้ง __TK_SERVER_PORT

  var ctx = null;          // AudioContext ตัวเดียวของทั้งแอป
  var master = null;       // gain รวม (ทุกปุ่มลงที่นี่)
  var cueBus = null;       // เสียงติ๊ดแยกสายจาก master — ผู้ใช้หรี่เสียงแพดไว้ก็ยังต้องได้ยินว่าโหมดเปิด/ปิด
  var masterVol = 1;
  var outputId = '';
  var sinkDone = false;    // เคยสั่งสลับอุปกรณ์สำเร็จด้วย outputId ปัจจุบันแล้วหรือยัง (กันสั่งซ้ำจนเสียงสะดุด)
  var pads = {};           // key → rec (ของที่โหลดไว้แล้ว)
  var voices = {};         // key → เสียงที่ "กำลังเล่นอยู่" (ปุ่มละหนึ่ง — กดซ้ำ = เริ่มใหม่ ตามสัญญา)
  var dying = [];          // เสียงที่กำลังเฟดออก ยังดังอยู่แต่ไม่นับว่ากำลังเล่นแล้ว
  var voiceSeq = 0;        // ลำดับการเริ่มเสียง — ใช้หา "ตัวที่กำลังเล่น" ตัวล่าสุดสำหรับแผงคิว
  var stateCbs = [];
  var lastSig = null;      // ลายเซ็นสถานะล่าสุด กันยิง callback ซ้ำถี่ๆ
  var warned = {};         // กัน console.warn ท่วมเมื่อผู้ใช้กดปุ่มเสียซ้ำๆ

  var playMode = 'queue';  // 'queue' | 'overlap'
  var queue = [];          // คิวรอเล่น (เฉพาะโหมด queue) — [{ id, key, mode, name, waitAt }]
  var qSeq = 0;
  var pumping = false;     // กัน pump() เรียกซ้อนตัวเองตอน startVoice ล้มเหลวแล้วต้องไล่ตัวถัดไป
  var qCbs = [];
  var qTimer = null;
  var lastQSig = null;

  // ---------- helpers ----------
  function clamp01(v) { v = Number(v); return isFinite(v) ? Math.max(0, Math.min(1, v)) : 1; }
  function noop() {}
  function warn(msg, key) {
    if (key) { if (warned[key]) return; warned[key] = 1; }
    try { console.warn('[TkPad] ' + msg); } catch (_) {}
  }

  // /media/... มาจาก media.js เสิร์ฟผ่าน overlay server — หน้า Dashboard เป็น file:// จึงต้องต่อ origin เต็ม
  // อ่านพอร์ตตอนเรียกทุกครั้ง เพราะ overlay server อาจย้ายพอร์ต (findFreePort) หลังหน้าโหลดไปแล้ว
  function resolveUrl(u) {
    if (!u) return '';
    if (/^(https?:|file:|data:|blob:)/i.test(u)) return u;
    if (u.charAt(0) === '/') return (window.__TK_DEMO_BASE || ('http://localhost:' + (window.__TK_SERVER_PORT || DEFAULT_PORT))) + u;
    return u;
  }

  function padOf(rec) { return (rec && rec.pad) || {}; }
  function padVol(rec) { var p = padOf(rec); return clamp01(p.volume == null ? 1 : p.volume); }
  function fadeInOf(rec) { var n = Number(padOf(rec).fadeIn); return isFinite(n) && n > 0 ? n : 0; }
  function fadeOutOf(rec) { var n = Number(padOf(rec).fadeOut); return isFinite(n) && n > 0 ? n : 0; }
  function hasVoice() { for (var k in voices) if (voices.hasOwnProperty(k)) return true; return false; }

  // ---------- AudioContext ----------
  function init() {
    if (ctx) { resume(); return ctx; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { warn('เบราว์เซอร์นี้ไม่มี Web Audio API', 'noac'); return null; }
    try {
      ctx = new AC({ latencyHint: 'interactive' });   // ขอ buffer เล็ก — กดปุ่มแล้วต้องดังเดี๋ยวนั้น
    } catch (_) {
      try { ctx = new AC(); } catch (e) { warn('สร้าง AudioContext ไม่ได้: ' + (e && e.message), 'noac'); return null; }
    }
    master = ctx.createGain();
    master.gain.value = masterVol;
    master.connect(ctx.destination);
    cueBus = ctx.createGain();
    cueBus.gain.value = 1;
    cueBus.connect(ctx.destination);
    armGesture();
    resume();
    return ctx;
  }

  // AudioContext มักเกิดมาเป็น suspended ตามนโยบาย autoplay ของ Chromium
  // แพดถูกสั่งเล่นจาก globalShortcut (ไม่ใช่ user gesture ในหน้านี้) ถ้าไม่ resume ไว้ก่อนจะเงียบสนิทแบบไม่มี error
  function resume() {
    if (ctx && ctx.state === 'suspended') { try { ctx.resume().catch(noop); } catch (_) {} }
  }
  var gestureArmed = false;
  function armGesture() {
    if (gestureArmed) return;
    gestureArmed = true;
    ['pointerdown', 'keydown'].forEach(function (ev) {
      try { window.addEventListener(ev, resume, { capture: true, passive: true }); } catch (_) {}
    });
  }

  // ---------- โหลดไฟล์ ----------
  // rec.kind: 'empty' | 'loading' | 'buffer' | 'stream' | 'element' | 'error'
  //   empty   = ปุ่มยังไม่ได้ใส่ไฟล์ — ไม่ใช่ความผิดพลาด ห้ามนับเป็น error ไม่งั้น UI ทาปุ่มว่างเป็นสีแดงทั้งแผง
  //   buffer  = AudioBuffer พร้อมเล่น (ไฟล์สั้น)
  //   stream  = <audio> ที่ต่อเข้า Web Audio ได้ (เซิร์ฟเวอร์ยอม CORS)
  //   element = <audio> ล้วน ไม่ผ่าน Web Audio — ทางถอยเมื่อ CORS ไม่ผ่าน เสียงยังออกแต่เฟดต้องไล่ที่ el.volume
  function newRec(key, pad) {
    var url = resolveUrl(pad && pad.url);
    return {
      key: key, pad: pad || {}, url: url,
      kind: url ? 'loading' : 'empty', buffer: null, el: null, node: null, gain: null,
      wantAt: 0, failedAt: 0
    };
  }

  function alive(rec) { return pads[rec.key] === rec; }   // setPads ใหม่มาแล้ว = ผลโหลดเก่าต้องถูกทิ้ง

  function fail(rec, err) {
    if (!alive(rec)) return;
    rec.kind = 'error';
    rec.failedAt = Date.now();
    rec.wantAt = 0;                     // เลิกค้างสถานะ "กดไว้แล้วรอไฟล์" ไม่งั้นจะไปดังทีหลังตอนโหลดใหม่สำเร็จ
    warn('ปุ่ม ' + rec.key + ' โหลดเสียงไม่ได้: ' + ((err && err.message) || err || 'ไม่ทราบสาเหตุ'), 'load:' + rec.key + rec.url);
    if (dropQueued(rec.key)) emitQueue();   // ไฟล์เสียแล้วไม่มีวันถึงคิว เอาออกไม่ให้แผงคิวโชว์ของผี
    emitState();
    pump();
  }

  function ready(rec) {
    if (!alive(rec)) return;
    var want = rec.wantAt;
    rec.wantAt = 0;
    emitState();
    // โหมดคิว: คนตัดสินว่าถึงคิวหรือยังคือ pump() ไม่ใช่ wantAt — ถ้าเล่นตรงนี้จะแซงคิวและซ้อนกับตัวที่ดังอยู่
    if (playMode === 'queue') { pump(); return; }
    if (want && Date.now() - want < PENDING_PLAY_MS) play(rec.key);
  }

  function load(rec) {
    if (!rec.url) return;   // ปุ่มว่าง (kind = 'empty') — ไม่ต้องโหลด ไม่ต้องเตือน
    loadBuffer(rec).then(function (done) {
      if (!alive(rec) || done) return;
      return loadStream(rec);
    }).catch(function (e) { fail(rec, e); });
  }

  // ลอง decode ก่อนเสมอ: ตัดสินจาก content-length ระหว่างทาง (ใหญ่เกิน = ยกเลิกกลางคัน ไม่ดูด RAM)
  // แล้วเช็คความยาวจริงหลัง decode อีกชั้น (bitrate ต่ำๆ ไฟล์เล็กแต่ยาว 4 นาทีก็มี)
  function loadBuffer(rec) {
    if (!ctx) return Promise.resolve(false);
    var ac = null;
    try { ac = new AbortController(); } catch (_) {}
    var opt = ac ? { signal: ac.signal } : {};
    return fetch(rec.url, opt).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var len = Number(res.headers && res.headers.get && res.headers.get('content-length'));
      if (isFinite(len) && len > MAX_DECODE_BYTES) {
        if (ac) { try { ac.abort(); } catch (_) {} }
        return null;                                   // ไฟล์ใหญ่ → ไปทางสตรีม
      }
      return res.arrayBuffer();
    }).then(function (buf) {
      if (!buf || !alive(rec)) return false;
      return decode(buf).then(function (audio) {
        if (!alive(rec)) return true;                  // ถูกแทนที่ไปแล้ว ถือว่าจบ ไม่ต้องไปสตรีมต่อ
        if (audio.duration > SHORT_SEC) return false;  // เพลงเต็มเพลง → ทิ้ง buffer ให้ GC เก็บ แล้วสตรีมแทน
        rec.buffer = audio;
        rec.kind = 'buffer';
        ready(rec);
        return true;
      });
    }).catch(function (e) {
      // ปกติเส้นทางนี้ควรผ่าน (overlay server ส่ง CORS ให้ /media แล้ว) — ที่ยังเหลือคือไฟล์เสีย/เซิร์ฟเวอร์ยังไม่ขึ้น
      // ทั้งคู่ยังมีลุ้นทางสตรีม จึงถอยไปโหมด element แทนที่จะฟันเป็น error ทันที
      warn('ปุ่ม ' + rec.key + ' decode ไม่สำเร็จ (' + ((e && e.message) || e) + ') → ใช้โหมดสตรีมแทน', 'dec:' + rec.key + rec.url);
      return false;
    });
  }

  // decodeAudioData แบบ callback เก่ายังต้องรองรับไว้ เผื่อ Chromium ตัวที่ไม่คืน Promise
  function decode(buf) {
    return new Promise(function (resolve, reject) {
      var p;
      try { p = ctx.decodeAudioData(buf, resolve, reject); } catch (e) { reject(e); return; }
      if (p && typeof p.then === 'function') p.then(resolve, reject);
    });
  }

  // สตรีมด้วย <audio>: ขอ CORS ก่อน เพราะ createMediaElementSource กับสื่อข้ามโดเมนที่ไม่มี
  // Access-Control-Allow-Origin จะได้ "ความเงียบ" แบบไม่มี error ให้จับ (Chromium ปิดเสียงกัน data leak)
  // ถ้า element ฟ้อง error ตอนขอ CORS → ถอยไปเล่นตรงๆ ไม่ผ่าน Web Audio ดีกว่าเงียบสนิท
  function loadStream(rec) {
    return new Promise(function (resolve) {
      attempt(true);
      function attempt(cors) {
        var el = document.createElement('audio');
        if (cors) el.crossOrigin = 'anonymous';
        el.preload = 'auto';
        el.loop = !!padOf(rec).loop;
        el.src = rec.url;
        var done = false, timer = setTimeout(function () { bad(new Error('หมดเวลารอไฟล์')); }, LOAD_TIMEOUT_MS);
        function off() {
          clearTimeout(timer);
          el.removeEventListener('loadedmetadata', good);
          el.removeEventListener('canplay', good);
          el.removeEventListener('error', bad);
        }
        function good() {
          if (done) return;
          done = true; off();
          if (!alive(rec)) { dropEl(el); resolve(true); return; }
          rec.el = el;
          rec.kind = 'element';
          if (cors) {
            try {
              rec.node = ctx.createMediaElementSource(el);
              rec.gain = ctx.createGain();
              rec.gain.gain.value = padVol(rec);
              rec.node.connect(rec.gain);
              rec.gain.connect(master);
              rec.kind = 'stream';
            } catch (e) {
              rec.node = null; rec.gain = null;    // ต่อไม่ติดก็เล่นจาก element ตรงๆ
            }
          }
          if (rec.kind === 'element') applySinkTo(rec.el);
          ready(rec);
          resolve(true);
        }
        function bad(e) {
          if (done) return;
          done = true; off(); dropEl(el);
          if (cors && alive(rec)) { attempt(false); return; }
          if (alive(rec)) fail(rec, (el.error && el.error.message) || e || new Error('เล่นไฟล์นี้ไม่ได้'));
          resolve(false);
        }
        el.addEventListener('loadedmetadata', good);
        el.addEventListener('canplay', good);
        el.addEventListener('error', bad);
        try { el.load(); } catch (_) {}
      }
    });
  }

  // ปล่อย <audio> ให้หมดจด — แค่ทิ้งตัวแปรไม่พอ Chromium ยังกันบัฟเฟอร์ที่โหลดไว้จนกว่าจะล้าง src
  function dropEl(el) {
    if (!el) return;
    try { el.pause(); } catch (_) {}
    try { el.removeAttribute('src'); el.load(); } catch (_) {}
  }

  function disposeRec(rec) {
    if (!rec) return;
    rec.wantAt = 0;
    var v = voices[rec.key];
    if (v && v.rec === rec) { delete voices[rec.key]; killVoice(v); }
    for (var i = dying.length - 1; i >= 0; i--) if (dying[i].rec === rec) killVoice(dying[i]);
    try { if (rec.node) rec.node.disconnect(); } catch (_) {}
    try { if (rec.gain) rec.gain.disconnect(); } catch (_) {}
    dropEl(rec.el);
    rec.node = null; rec.gain = null; rec.el = null; rec.buffer = null;
  }

  // ---------- gain / fade ----------
  function rampIn(param, target, sec) {
    var now = ctx.currentTime;
    try {
      param.cancelScheduledValues(now);
      if (sec > 0) { param.setValueAtTime(0.0001, now); param.linearRampToValueAtTime(target, now + sec); }
      else param.setValueAtTime(target, now);
    } catch (_) { try { param.value = target; } catch (__) {} }
  }
  function rampOut(param, sec) {
    var now = ctx.currentTime;
    try {
      var cur = param.value;
      param.cancelScheduledValues(now);
      param.setValueAtTime(cur, now);
      param.linearRampToValueAtTime(0, now + Math.max(sec, CLICK_GUARD));
    } catch (_) {}
  }
  // โหมด element ไม่มี AudioParam ให้ ramp — ไล่ el.volume เองทีละ step (หยาบกว่าแต่ยังนุ่มพอ)
  // ปลายทางรับเป็นฟังก์ชันได้ เพราะระหว่างเฟดเข้าผู้ใช้อาจลากสไลเดอร์เสียงรวม ถ้าล็อกค่าไว้ตั้งแต่ต้น
  // เสียงจะวิ่งไปจบที่ระดับเก่า (setMaster ไม่มีผลกับเสียงที่กำลังเฟดเข้า)
  function elRamp(v, to, sec, done) {
    if (v.rampTimer) { clearInterval(v.rampTimer); v.rampTimer = null; }
    var el = v.el, from = Number(el.volume) || 0;
    var get = (typeof to === 'function') ? to : function () { return to; };
    if (!(sec > 0)) { setElVol(el, get()); if (done) done(); return; }
    var steps = Math.max(1, Math.round(sec * 1000 / 40)), i = 0;
    v.rampTimer = setInterval(function () {
      i++;
      setElVol(el, from + (get() - from) * (i / steps));
      if (i >= steps) { clearInterval(v.rampTimer); v.rampTimer = null; if (done) done(); }
    }, 40);
  }
  function setElVol(el, v) { try { el.volume = clamp01(v); } catch (_) {} }
  // element ไม่ได้ผ่าน master gain จึงต้องคูณ master เองที่ระดับ element
  function elTarget(rec) { return clamp01(padVol(rec) * masterVol); }

  // ---------- voice ----------
  // stream/element ใช้ <audio> ตัวเดียวร่วมกันทั้งปุ่ม เสียงเก่าที่กำลังเฟดออกจึงยัง "ไล่ el.volume ลง 0" อยู่
  // ถ้ากดปุ่มเดิมซ้ำระหว่างนั้นแล้วปล่อยไว้ ตัวใหม่จะโดนหรี่ตามไปจนเงียบสนิททั้งที่ไฟปุ่มติดว่ากำลังเล่น
  // → ตัวเก่าต้องถูกปลดทิ้งทันที (ไม่แตะ element เพราะตัวใหม่กำลังใช้อยู่)
  function detachDying(rec) {
    for (var i = dying.length - 1; i >= 0; i--) {
      var d = dying[i];
      if (d.rec !== rec) continue;
      if (d.timer) { clearTimeout(d.timer); d.timer = null; }
      if (d.rampTimer) { clearInterval(d.rampTimer); d.rampTimer = null; }
      dying.splice(i, 1);
      if (voices[d.key] === d) delete voices[d.key];
    }
  }

  function startVoice(rec) {
    var fi = fadeInOf(rec), vol = padVol(rec), loop = !!padOf(rec).loop;
    var v = {
      key: rec.key, rec: rec, kind: rec.kind, loop: loop, seq: ++voiceSeq,
      gain: null, src: null, el: null, timer: null, rampTimer: null, t0: 0
    };

    if (rec.kind === 'buffer') {
      try {
        var g = ctx.createGain();
        g.connect(master);
        var s = ctx.createBufferSource();
        s.buffer = rec.buffer;
        s.loop = loop;
        s.connect(g);
        rampIn(g.gain, vol, fi);
        s.onended = function () {
          try { g.disconnect(); } catch (_) {}
          var i = dying.indexOf(v); if (i >= 0) dying.splice(i, 1);
          if (voices[v.key] === v) { delete voices[v.key]; emitState(); pump(); }
        };
        s.start();
        v.gain = g; v.src = s; v.t0 = ctx.currentTime;
      } catch (e) { warn('ปุ่ม ' + rec.key + ' เริ่มเสียงไม่ได้: ' + ((e && e.message) || e), 'start:' + rec.key); return null; }
    } else if (rec.kind === 'stream' || rec.kind === 'element') {
      var el = rec.el;
      if (!el) return null;
      detachDying(rec);                                   // ตัวเก่าที่ยังเฟดอยู่ต้องเลิกยุ่งกับ element ก่อน
      el.loop = loop;
      try { el.currentTime = 0; } catch (_) {}            // กดซ้ำ = เริ่มใหม่จากต้น
      v.el = el;
      if (rec.kind === 'stream') {
        v.gain = rec.gain;
        setElVol(el, 1);                                  // ระดับเสียงคุมที่ gain node ปล่อย element ไว้เต็ม
        rampIn(rec.gain.gain, vol, fi);
      } else {
        setElVol(el, fi > 0 ? 0 : elTarget(rec));
        if (fi > 0) elRamp(v, function () { return elTarget(rec); }, fi);
      }
      el.onended = function () {
        if (voices[v.key] === v) { delete voices[v.key]; emitState(); pump(); }
      };
      try {
        var pr = el.play();
        if (pr && pr.catch) pr.catch(function (e) {
          warn('ปุ่ม ' + rec.key + ' เล่นไม่สำเร็จ: ' + ((e && e.message) || e), 'play:' + rec.key);
          if (voices[v.key] === v) { delete voices[v.key]; emitState(); pump(); }
        });
      } catch (e) { warn('ปุ่ม ' + rec.key + ' เล่นไม่สำเร็จ: ' + ((e && e.message) || e), 'play:' + rec.key); return null; }
    } else return null;

    voices[rec.key] = v;
    return v;
  }

  // จบเสียงเดี๋ยวนี้ ไม่เฟด (ใช้ตอนกดซ้ำ/stopAll)
  function killVoice(v) {
    if (!v) return;
    if (v.timer) { clearTimeout(v.timer); v.timer = null; }
    if (v.rampTimer) { clearInterval(v.rampTimer); v.rampTimer = null; }
    if (v.kind === 'buffer') {
      try { if (v.src) { v.src.onended = null; v.src.stop(); } } catch (_) {}
      try { if (v.gain) v.gain.disconnect(); } catch (_) {}
    } else if (v.el) {
      // ถ้ามีเสียงตัวใหม่ของ pad เดิมเริ่มไปแล้ว (กดซ้ำระหว่างตัวเก่ายังเฟดออก) ห้ามไปหยุด
      // — ไม่งั้นเสียงที่เพิ่งกดจะดับเองตอนตัวเก่าหมดเวลาเฟด (detachDying ตัดเคสนี้ไปแล้วส่วนใหญ่ นี่คือกันพลาดชั้นสอง)
      var cur = voices[v.key];
      if (!(cur && cur !== v && cur.rec === v.rec)) {
        try { v.el.onended = null; v.el.pause(); v.el.currentTime = 0; } catch (_) {}
        if (v.gain) { try { v.gain.gain.cancelScheduledValues(ctx.currentTime); v.gain.gain.value = padVol(v.rec); } catch (_) {} }
      }
    }
    if (voices[v.key] === v) delete voices[v.key];
    var i = dying.indexOf(v); if (i >= 0) dying.splice(i, 1);
  }

  function fadeKill(v, sec) {
    if (!v) return;
    sec = Math.max(0, Number(sec) || 0);
    // buffer มี node เป็นของตัวเอง เฟดค้างไว้ระหว่างที่ปุ่มเดิมเริ่มเสียงใหม่ได้ ไม่ชนกัน
    // ส่วน stream/element ใช้ <audio> ตัวเดียวร่วมกัน ถ้าไม่มี fadeOut ต้องหยุดทันที ไม่งั้นไปดับตัวที่เพิ่งเริ่มใหม่
    if (sec <= 0 && v.kind !== 'buffer') { killVoice(v); return; }
    if (dying.indexOf(v) < 0) dying.push(v);
    if (v.kind === 'buffer' || v.kind === 'stream') rampOut(v.gain.gain, sec);
    else elRamp(v, 0, Math.max(sec, CLICK_GUARD));
    v.timer = setTimeout(function () { killVoice(v); }, Math.max(sec, CLICK_GUARD) * 1000 + 40);
  }

  function stopKey(key, sec) {
    var v = voices[key];
    if (!v) return false;
    delete voices[key];        // ปลดจากรายการ "กำลังเล่น" ทันที ปุ่มจะได้กดซ้ำได้ระหว่างยังเฟดออก
    fadeKill(v, sec);
    return true;
  }

  // choke group: ปุ่มกลุ่มเดียวกันห้ามดังพร้อมกัน (เช่นทุกเพลงอยู่กลุ่ม music)
  // หยุดด้วย fadeOut ของปุ่มนั้นเอง เพลงจะได้เปลี่ยนแบบครอสเฟดไม่ใช่ตัดดิบ
  // ใช้เฉพาะโหมด overlap — โหมด queue ดังทีละเสียงอยู่แล้ว ไม่มีอะไรให้ตัด
  function chokeOthers(group, exceptKey) {
    if (!group) return;
    Object.keys(voices).forEach(function (k) {
      if (k === exceptKey) return;
      var r = pads[k];
      if (r && padOf(r).choke === group) stopKey(k, fadeOutOf(r));
    });
  }

  // โหมด 'cut' — กดเสียงใหม่แล้วเสียงที่ดังอยู่ทุกตัวต้องหยุดทันที
  // ตัดดิบๆ ที่ 0 วินาทีจะได้เสียง "ป๊อก" จากคลื่นที่ถูกหั่นกลางคัน จึงเฟดสั้นมากแทน
  // (สั้นจนหูฟังว่าตัดทันทีอยู่ดี แต่ไม่มีเสียงแตก)
  var CUT_FADE = 0.04;
  function cutOthers(exceptKey) {
    Object.keys(voices).forEach(function (k) {
      if (k !== exceptKey) stopKey(k, CUT_FADE);
    });
  }

  // ---------- คิวเสียง ----------
  function findQueued(key) {
    for (var i = 0; i < queue.length; i++) if (queue[i].key === key) return i;
    return -1;
  }
  // เอาทุกรายการของปุ่มนี้ออกจากคิว (กดซ้ำ/ปล่อยปุ่ม/ไฟล์เสีย) — คืน true ถ้ามีอะไรถูกเอาออกจริง
  function dropQueued(key) {
    var hit = false;
    for (var i = queue.length - 1; i >= 0; i--) if (queue[i].key === key) { queue.splice(i, 1); hit = true; }
    return hit;
  }

  // เดินคิว: เริ่มเสียงถัดไปเมื่อไม่มีอะไรดังอยู่แล้ว
  // เสียงที่กำลังเฟดออก (อยู่ใน dying) ไม่นับว่าดังอยู่ → ข้ามเพลงแล้วตัวถัดไปเข้าทันทีแบบครอสเฟดสั้นๆ
  function pump() {
    if (playMode !== 'queue' || pumping) return;
    pumping = true;
    try {
      while (!hasVoice() && queue.length) {
        var it = queue[0], rec = pads[it.key];
        if (!rec || rec.kind === 'empty' || rec.kind === 'error') { queue.shift(); continue; }
        if (rec.kind === 'loading') { stallOnLoad(it, rec); break; }
        queue.shift();
        if (startVoice(rec)) { emitState(); break; }     // เริ่มไม่ขึ้น = ข้ามไปตัวถัดไป อย่าให้คิวค้าง
      }
    } finally { pumping = false; }
    emitQueue();
  }

  // หัวแถวยังโหลดไม่เสร็จ — คิวรอไฟล์ตัวนี้ก่อน (ready() จะมาปลุก pump ให้)
  // แต่ต้องมีทางออก: ถ้าไฟล์ไม่มาสักทีจนเกินเวลารอโหลด ให้ตัดทิ้งไม่งั้นคิวทั้งแถวค้างตาม
  function stallOnLoad(it, rec) {
    rec.wantAt = Date.now();
    if (it.waitAt) return;
    it.waitAt = Date.now();
    setTimeout(function () {
      var head = pads[it.key];
      if (queue[0] !== it || !head || head.kind !== 'loading') return;
      queue.shift();
      head.wantAt = 0;
      emitQueue();
      pump();
    }, LOAD_TIMEOUT_MS + 2000);
  }

  function nameOf(key, fallback) {
    var rec = pads[key], n = rec && padOf(rec).name;
    return n || fallback || key;
  }
  function durOf(rec) {
    if (!rec) return 0;
    if (rec.kind === 'buffer' && rec.buffer) { var b = Number(rec.buffer.duration); return isFinite(b) && b > 0 ? b : 0; }
    if (rec.el) { var d = Number(rec.el.duration); return isFinite(d) && d > 0 ? d : 0; }
    return 0;
  }
  // buffer ไม่มี currentTime ให้อ่าน ต้องนับจากนาฬิกาของ AudioContext เอง (ลูปแล้ววนกลับต้น)
  function posOf(v) {
    try {
      if (v.kind !== 'buffer') return v.el ? (Number(v.el.currentTime) || 0) : 0;
      var d = durOf(v.rec), el = ctx ? Math.max(0, ctx.currentTime - v.t0) : 0;
      if (!(d > 0)) return el;
      return v.loop ? (el % d) : Math.min(el, d);
    } catch (_) { return 0; }
  }
  function newestVoice() {
    var best = null;
    Object.keys(voices).forEach(function (k) { var v = voices[k]; if (v && (!best || v.seq > best.seq)) best = v; });
    return best;
  }

  // โหมดซ้อนกันมีหลายเสียงดังพร้อมกันได้ แต่ current บอกได้แค่ตัวล่าสุด
  // แผงคิวจึงต้องได้รายชื่อทุกเสียงที่ยังเล่นอยู่ ไม่งั้นผู้ใช้ไม่รู้ว่าค้างอะไรไว้บ้างและหยุดทีละตัวไม่ได้
  function playingList() {
    var out = [];
    Object.keys(voices).forEach(function (k) {
      var v = voices[k];
      if (v) out.push({ key: v.key, name: nameOf(v.key), pos: posOf(v), dur: durOf(v.rec), seq: v.seq || 0 });
    });
    out.sort(function (a, b) { return b.seq - a.seq; });   // ล่าสุดอยู่บน ตรงกับ current
    return out;
  }

  function queueSnapshot() {
    var cur = newestVoice();
    return {
      mode: playMode,
      playing: playingList(),
      current: cur ? { key: cur.key, name: nameOf(cur.key), pos: posOf(cur), dur: durOf(cur.rec) } : null,
      waiting: queue.map(function (it) {
        return { id: it.id, key: it.key, name: nameOf(it.key, it.name), dur: durOf(pads[it.key]) };
      })
    };
  }

  // ปัดตำแหน่งเป็นทศนิยมหนึ่งตำแหน่งก่อนทำลายเซ็น — ตอนไม่มีอะไรเล่น ลายเซ็นจะนิ่งแล้วหยุดยิง callback เอง
  function qSig(s) {
    var c = s.current ? (s.current.key + '@' + Math.round(s.current.pos * 10) + '/' + Math.round(s.current.dur * 10)) : '-';
    // รายชื่อเสียงที่เล่นอยู่ต้องอยู่ในลายเซ็นด้วย ไม่งั้นโหมดซ้อนกันเพิ่ม/ลดเสียงแล้วแผงไม่ขยับ
    var pl = s.playing.map(function (x) { return x.key + '@' + Math.round(x.pos * 10); }).join(',');
    return s.mode + '|' + c + '|' + pl + '|' + s.waiting.map(function (x) { return x.id; }).join(',');
  }

  function emitQueue(force) {
    var s = queueSnapshot();
    var sig = qSig(s);
    if (!force && sig === lastQSig) { syncTicker(); return; }
    lastQSig = sig;
    qCbs.forEach(function (fn) { try { fn(s); } catch (_) {} });
    syncTicker();
  }

  // ตัวจับเวลาเดินเฉพาะตอนมีเสียงหรือมีคิวจริงๆ และมีคนฟังอยู่ — ปล่อยให้เดินตลอดคือกิน CPU ฟรีทั้งวัน
  function syncTicker() {
    var need = qCbs.length > 0 && (queue.length > 0 || hasVoice());
    if (need && !qTimer) qTimer = setInterval(function () { emitQueue(); }, QUEUE_TICK_MS);
    else if (!need && qTimer) { clearInterval(qTimer); qTimer = null; }
  }

  function onQueue(cb) {
    if (typeof cb !== 'function') return noop;
    qCbs.push(cb);
    try { cb(queueSnapshot()); } catch (_) {}   // ให้ UI วาดแผงคิวได้ทันทีโดยไม่ต้องรอเหตุการณ์ถัดไป
    syncTicker();
    return function () { var i = qCbs.indexOf(cb); if (i >= 0) qCbs.splice(i, 1); syncTicker(); };
  }

  function setPlayMode(mode) {
    var next = (mode === 'overlap' || mode === 'cut') ? mode : 'queue';
    if (next === playMode) return playMode;
    playMode = next;
    // โหมดที่ไม่ใช่คิวไม่มีใครเดินคิว ของที่รออยู่จะค้างตลอดกาล → ล้างทิ้งตอนสลับ
    // และต้องล้าง wantAt ด้วย ไม่งั้นปุ่มที่คิวสั่งรอไฟล์ไว้จะไปดังเองตอนโหลดเสร็จทั้งที่คิวถูกล้างแล้ว
    if (playMode !== 'queue') {
      queue.length = 0;
      Object.keys(pads).forEach(function (k) { pads[k].wantAt = 0; });
    }
    emitQueue(true);
    if (playMode === 'queue') pump();
    return playMode;
  }

  function skip() {
    // ข้ามตัวที่แผงคิวโชว์ว่ากำลังเล่น แล้วให้ pump() ดันตัวถัดไปเข้ามาแทนทันที
    var cur = newestVoice();
    if (cur) {
      var rec = pads[cur.key];
      if (rec) rec.wantAt = 0;
      if (stopKey(cur.key, rec ? fadeOutOf(rec) : 0)) emitState();
    }
    pump();
    emitQueue();
  }

  function dequeue(id) {
    if (!id) return false;
    for (var i = 0; i < queue.length; i++) {
      if (queue[i].id !== id) continue;
      queue.splice(i, 1);
      emitQueue();
      return true;
    }
    return false;
  }

  // ล้างเฉพาะที่รออยู่ ไม่แตะเสียงที่กำลังเล่น (ปุ่ม "ล้างคิว" ในแผงคิว — คนละเรื่องกับ stopAll)
  function clearQueue() {
    if (!queue.length) return false;
    queue.length = 0;
    emitQueue();
    return true;
  }

  // ---------- API ----------
  function setPads(map) {
    init();
    map = map || {};
    // keep ใช้ Object.create(null) เพราะถูกเช็คด้วย keep[key] ตรงๆ — ชื่อปุ่มที่บังเอิญชนสมบัติของ Object.prototype จะได้ไม่หลอกว่า "เก็บไว้"
    var next = {}, fresh = [], keep = Object.create(null);
    Object.keys(map).forEach(function (k) {
      var pad = map[k] || {};
      var url = resolveUrl(pad.url);
      var old = pads[k];
      // ไฟล์เดิม — ใช้ของที่โหลดไว้ต่อ อัปเดตแค่ค่าตั้งค่า (โวลุ่ม/โหมด/เฟด) ไม่ต้องโหลดใหม่
      // รวมถึงปุ่มว่างและปุ่มที่เพิ่งโหลดพัง เพราะ UI เรียก setPads ทุกครั้งที่แก้ค่า ถ้าไล่โหลดใหม่ทั้งชุด
      // ทุกรอบจะยิง fetch รัวไปทั้ง bank — ปุ่มที่พังค่อยลองใหม่เมื่อพ้น RETRY_FAILED_MS (เผื่อเซิร์ฟเวอร์เพิ่งขึ้น)
      if (old && old.url === url && (old.kind !== 'error' || Date.now() - old.failedAt < RETRY_FAILED_MS)) {
        old.pad = pad;
        next[k] = old;
        keep[k] = 1;
        delete pads[k];
        return;
      }
      var rec = newRec(k, pad);
      next[k] = rec;
      fresh.push(rec);
    });
    // ที่เหลือใน pads = ปุ่มที่ถูกถอด/เปลี่ยนไฟล์ ต้องคืนของทิ้ง ไม่งั้นสลับ bank บ่อยๆ แล้ว AudioBuffer/element ค้างสะสม
    Object.keys(pads).forEach(function (k) { disposeRec(pads[k]); });
    pads = next;
    warned = {};
    // ปุ่มที่หายไปหรือเปลี่ยนไฟล์ ต้องหลุดจากคิวด้วย ไม่งั้นแผงคิวโชว์เสียงที่ไม่มีอยู่จริงแล้ว
    var cut = false;
    for (var i = queue.length - 1; i >= 0; i--) if (!keep[queue[i].key]) { queue.splice(i, 1); cut = true; }
    fresh.forEach(load);       // เริ่มโหลดหลัง pads ชี้ของใหม่แล้ว เพื่อให้ alive() เทียบได้ถูกตัว
    emitState();
    if (cut) emitQueue();
    pump();
  }

  function play(key) {
    var rec = pads[key];
    if (!rec) return;
    init();
    resume();
    if (rec.kind === 'empty') return;      // ปุ่มยังไม่ได้ใส่ไฟล์ = ไม่ใช่ความผิดพลาด เงียบไว้
    if (rec.kind === 'error') { warn('ปุ่ม ' + key + ' ใช้ไม่ได้ (ไฟล์เสียหรือโหลดไม่ขึ้น)', 'bad:' + key); return; }
    var mode = padOf(rec).mode || 'oneshot';
    if (playMode === 'queue') playQueued(key, rec, mode);
    else playNow(key, rec, mode);
  }

  // โหมดซ้อน — พฤติกรรมเดิมทุกอย่าง
  function playNow(key, rec, mode) {
    if (rec.kind === 'loading') { rec.wantAt = Date.now(); return; }   // ยังโหลดไม่เสร็จ — เล่นให้เมื่อพร้อม
    if (mode === 'toggle' && voices[key]) { stopKey(key, fadeOutOf(rec)); emitState(); return; }
    // โหมดกดค้าง: globalShortcut ยิง keydown ซ้ำตามอัตรา auto-repeat ของ OS ระหว่างที่นิ้วยังกดอยู่
    // ถ้าปล่อยให้ไปเข้าทาง "กดซ้ำ = เริ่มใหม่" เสียงจะกระตุกรัวๆ ทั้งที่ผู้ใช้กดค้างเฉยๆ
    if (mode === 'hold' && voices[key]) return;
    if (playMode === 'cut') cutOthers(key);   // ตัดของเก่าตอน "จะเล่นจริง" เท่านั้น ไม่ใช่ตอนกด
    chokeOthers(padOf(rec).choke, key);
    var cur = voices[key];
    if (cur) { delete voices[key]; fadeKill(cur, 0); }   // กดซ้ำ = เริ่มใหม่จากต้น เสียงเดิมตัดทิ้ง (ไม่ใช้ fadeOut)
    startVoice(rec);
    emitState();
  }

  // โหมดคิว — กดแล้วต่อท้ายเสมอ ยกเว้นเคสที่การกดซ้ำแปลว่า "ยกเลิก"
  function playQueued(key, rec, mode) {
    if (mode === 'toggle') {
      if (voices[key]) { stopKey(key, fadeOutOf(rec)); rec.wantAt = 0; emitState(); pump(); return; }
      if (dropQueued(key)) { emitQueue(); return; }      // กดซ้ำระหว่างรอคิว = เอาออกจากคิว
    }
    // กดค้างจะถูกยิงซ้ำได้ทั้งจาก auto-repeat และจาก keyHook — ปุ่มเดียวห้ามกองในคิวหลายใบ
    if (mode === 'hold' && (voices[key] || findQueued(key) >= 0)) return;
    queue.push({ id: 'q' + (++qSeq), key: key, mode: mode, name: padOf(rec).name || '', waitAt: 0 });
    emitQueue();
    pump();
  }

  // ปุ่มถูกปล่อย — มีผลเฉพาะโหมดกดค้าง (โหมดอื่นปล่อยแล้วต้องดังต่อ)
  function release(key) {
    var rec = pads[key];
    if (!rec || padOf(rec).mode !== 'hold') return;
    rec.wantAt = 0;                       // ปล่อยก่อนไฟล์โหลดเสร็จ = ยกเลิกจริง ไม่ใช่ไปดังทีหลังแบบลูปค้างตลอดกาล
    var cut = dropQueued(key);            // ปล่อยก่อนถึงคิว = เอาออกจากคิว อย่าเล่นทีหลัง
    if (stopKey(key, fadeOutOf(rec))) { emitState(); pump(); }
    else if (cut) { emitQueue(); pump(); }
  }

  function stop(key) {
    var rec = pads[key];
    if (rec) rec.wantAt = 0;              // สั่งหยุดตอนยังโหลดไม่เสร็จ ต้องยกเลิกคำสั่งเล่นที่ค้างอยู่ด้วย
    var cut = dropQueued(key);
    if (stopKey(key, rec ? fadeOutOf(rec) : 0)) { emitState(); pump(); }
    else if (cut) { emitQueue(); pump(); }
  }

  function stopAll() {
    queue.length = 0;                     // "หยุดทุกเสียง" = ล้างคิวด้วย ไม่งั้นเงียบไปแป๊บเดียวแล้วดังต่อ
    Object.keys(pads).forEach(function (k) { pads[k].wantAt = 0; });
    Object.keys(voices).forEach(function (k) { killVoice(voices[k]); });
    voices = {};
    while (dying.length) killVoice(dying[0]);
    emitState();
    emitQueue();
  }

  function setMaster(v) {
    masterVol = clamp01(v);
    if (master && ctx) {
      try {
        var now = ctx.currentTime;
        master.gain.cancelScheduledValues(now);
        master.gain.setValueAtTime(master.gain.value, now);
        master.gain.linearRampToValueAtTime(masterVol, now + 0.05);   // เลื่อนสไลเดอร์แล้วไม่ให้เสียงกระตุก
      } catch (_) { try { master.gain.value = masterVol; } catch (__) {} }
    }
    // เสียงโหมด element ไม่ได้ผ่าน master ต้องตามไปปรับที่ element เอง
    // ตัวที่กำลังเฟดเข้าไม่ต้องแตะ — elRamp อ่านปลายทางจาก elTarget() ทุก step อยู่แล้ว จึงวิ่งไปจบที่ค่าใหม่เอง
    Object.keys(voices).forEach(function (k) {
      var v = voices[k];
      if (v && v.kind === 'element' && !v.rampTimer) setElVol(v.el, elTarget(v.rec));
    });
  }

  // AudioContext.setSinkId มีใน Chromium 110+ (Electron 33 = Chromium 130) แต่ถ้าเครื่องไหนไม่มีก็ปล่อยผ่านเงียบๆ
  // '' = อุปกรณ์เริ่มต้นของระบบ
  function setOutput(deviceId) {
    deviceId = deviceId || '';
    init();                      // ต้องมี ctx ก่อน ถึงจะสั่ง setSinkId ได้ (เรียกก่อน init ก็ยังทำงาน)
    // UI เรียกซ้ำทุกครั้งที่บันทึกค่า — สลับ sink ทั้งที่อุปกรณ์เดิมทำให้เสียงสะดุดฟรีๆ กลางไลฟ์
    if (sinkDone && deviceId === outputId) return Promise.resolve(true);
    outputId = deviceId;
    return applySink();
  }
  function applySink() {
    var jobs = [];
    if (ctx && typeof ctx.setSinkId === 'function') {
      jobs.push(new Promise(function (resolve) {
        function nope(e) { warn('สลับอุปกรณ์เสียงไม่ได้: ' + ((e && e.message) || e), 'sink'); resolve(false); }
        try { Promise.resolve(ctx.setSinkId(outputId)).then(function () { resolve(true); }, nope); }
        catch (e) { nope(e); }
      }));
    }
    Object.keys(pads).forEach(function (k) {
      if (pads[k].kind === 'element' && pads[k].el) jobs.push(applySinkTo(pads[k].el));
    });
    // ไม่มีทางสลับได้เลยบนเครื่องนี้: ขอ "ค่าเริ่มต้น" ถือว่าสำเร็จ (ไม่ต้องทำอะไรก็ถูกอยู่แล้ว)
    // แต่ถ้าขออุปกรณ์เจาะจงแล้วทำไม่ได้ ต้องคืน false ให้ UI เตือนผู้ใช้ ไม่ใช่หลอกว่าสำเร็จ
    if (!jobs.length) { sinkDone = !outputId; return Promise.resolve(sinkDone); }
    return Promise.all(jobs).then(function (rs) {
      sinkDone = rs.every(Boolean);
      return sinkDone;
    });
  }
  function applySinkTo(el) {
    if (!el) return Promise.resolve(true);
    if (typeof el.setSinkId !== 'function') return Promise.resolve(!outputId);
    return new Promise(function (resolve) {
      try { Promise.resolve(el.setSinkId(outputId)).then(function () { resolve(true); }, function () { resolve(false); }); }
      catch (_) { resolve(false); }
    });
  }

  // Chromium ซ่อน deviceId/label ของอุปกรณ์เสียงจนกว่าหน้านี้จะเคยได้สิทธิ์สื่อสักครั้ง
  // ถ้าไม่เคยขอ enumerateDevices จะคืนรายการเดียว deviceId ว่าง = ตัวเลือก "อุปกรณ์เสียงออก" ใช้ไม่ได้จริง
  // จึงขอ getUserMedia({audio:true}) แล้วปิด track ทิ้งทันที (แค่ปลดล็อกรายชื่อ ไม่ได้อัดเสียงอะไร)
  var mediaAsked = false, mediaOk = false;
  function requestDeviceAccess() {
    if (mediaOk) return Promise.resolve(true);
    if (mediaAsked) return Promise.resolve(false);   // ถูกปฏิเสธไปแล้ว อย่าเด้งขอซ้ำทุกครั้งที่เปิดหน้า
    mediaAsked = true;
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return Promise.resolve(false);
      return navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
        try { (stream.getTracks() || []).forEach(function (t) { try { t.stop(); } catch (_) {} }); } catch (_) {}
        mediaOk = true;
        return true;
      }).catch(function (e) {
        warn('ขอสิทธิ์สื่อเพื่อดูรายชื่ออุปกรณ์ไม่สำเร็จ: ' + ((e && e.message) || e), 'perm');
        return false;
      });
    } catch (e) { return Promise.resolve(false); }
  }

  function rawOutputs() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return Promise.resolve([]);
      return navigator.mediaDevices.enumerateDevices().then(function (list) {
        return (list || []).filter(function (d) { return d && d.kind === 'audiooutput'; });
      }).catch(function (e) {
        warn('อ่านรายชื่ออุปกรณ์เสียงไม่ได้: ' + ((e && e.message) || e), 'dev');
        return [];
      });
    } catch (e) { return Promise.resolve([]); }
  }
  // ยังไม่ได้สิทธิ์ = ไม่มีตัวไหนมี label เลย (Chromium ปกปิดชื่อไว้ทั้งหมด)
  function devLocked(list) { return !list.length || !list.some(function (d) { return d.label; }); }
  function labelDevs(list) {
    var n = 0;
    return list.map(function (d) { n++; return { deviceId: d.deviceId || '', label: d.label || fallbackLabel(n) }; });
  }
  // opts.ask === false = อ่านเท่าที่มีสิทธิ์อยู่ตอนนี้ (ให้ UI ทำปุ่ม "อนุญาตเพื่อดูรายชื่ออุปกรณ์" เองได้)
  function devices(opts) {
    var ask = !(opts && opts.ask === false);
    return rawOutputs().then(function (list) {
      if (!ask || !devLocked(list)) return labelDevs(list);
      return requestDeviceAccess().then(function (ok) {
        if (!ok) return labelDevs(list);
        return rawOutputs().then(labelDevs);
      });
    });
  }
  function fallbackLabel(n) {
    var t = window.Tk && window.Tk.t;
    return t ? t('อุปกรณ์ {n}', { n: n }) : 'อุปกรณ์ ' + n;
  }

  function onState(cb) {
    if (typeof cb !== 'function') return noop;
    stateCbs.push(cb);
    try { cb(snapshot()); } catch (_) {}      // ให้ UI ตั้งไฟเริ่มต้นได้ทันทีโดยไม่ต้องรอเหตุการณ์ถัดไป
    return function () { var i = stateCbs.indexOf(cb); if (i >= 0) stateCbs.splice(i, 1); };
  }

  function snapshot() {
    var errs = [];
    Object.keys(pads).forEach(function (k) { if (pads[k].kind === 'error') errs.push(k); });
    var qk = [];
    queue.forEach(function (it) { if (qk.indexOf(it.key) < 0) qk.push(it.key); });
    return { playing: Object.keys(voices), errors: errs, queued: qk };
  }

  function emitState() {
    var s = snapshot();
    var sig = s.playing.join(',') + '|' + s.errors.join(',') + '|' + s.queued.join(',');
    if (sig !== lastSig) {                    // ไฟกระพริบไม่ต้องรู้เรื่องที่ไม่ได้เปลี่ยน
      lastSig = sig;
      stateCbs.forEach(function (fn) { try { fn(s); } catch (_) {} });
    }
    emitQueue();                              // อะไรที่ทำให้สถานะปุ่มเปลี่ยน แผงคิวก็ต้องเปลี่ยนตามเสมอ
  }

  // เสียงติ๊ดตอนสลับโหมด — ใช้ OscillatorNode ไม่ต้องแนบไฟล์เสียงมากับแอป
  // เปิด = โทนสูง / ปิด = โทนต่ำ ผู้ใช้ที่กำลังเล่นเกมเต็มจอจะได้รู้ว่าโหมดแพดอยู่สถานะไหน
  function cue(on) {
    init();
    if (!ctx) return;
    resume();
    try {
      var t0 = ctx.currentTime + 0.01;
      var osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(on ? 1320 : 660, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.012);   // ขึ้น/ลงแบบ exponential กันเสียง "ป๊อก" หัวท้าย
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.13);
      osc.connect(g);
      g.connect(cueBus);
      osc.onended = function () { try { g.disconnect(); } catch (_) {} };
      osc.start(t0);
      osc.stop(t0 + 0.15);
    } catch (e) { warn('เล่นเสียงติ๊ดไม่ได้: ' + ((e && e.message) || e), 'cue'); }
  }

  window.TkPad = {
    init: init,
    setPads: setPads,
    play: play,
    release: release,
    stop: stop,
    stopAll: stopAll,
    setMaster: setMaster,
    setOutput: setOutput,
    devices: devices,
    requestDeviceAccess: requestDeviceAccess,   // ให้ UI ทำปุ่ม "อนุญาตเพื่อดูรายชื่ออุปกรณ์" ได้เอง
    onState: onState,
    cue: cue,
    setPlayMode: setPlayMode,
    onQueue: onQueue,
    skip: skip,
    dequeue: dequeue,
    clearQueue: clearQueue,   // ล้างเฉพาะที่รออยู่ (ปุ่ม "ล้างคิว") ไม่หยุดเสียงที่กำลังเล่น
    state: snapshot,          // เผื่อ UI อยากอ่านสถานะตรงๆ โดยไม่ต้อง subscribe
    queue: queueSnapshot
  };
})();
