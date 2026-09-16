// Tikkies Tools — โหมดสาธิตบนหน้าเว็บ
// หน้านี้คือโปรแกรมตัวจริงทั้งหน้า (ไฟล์เดียวกับในแอป — scripts/sync-app.mjs คัดลอกมา) แต่ไม่มี Electron อยู่ข้างหลัง:
// ไฟล์นี้สวม window.tikkies แทน preload.js ตอบทุกคำสั่งด้วยข้อมูลตัวอย่าง และจำลองไลฟ์ให้มีของขวัญ/แชทไหลเข้า
// ไม่มีอะไรออกนอกเครื่อง ไม่มีบัญชีจริง — ตั้งค่าอะไรไปก็อยู่แค่ในแท็บนี้ รีหน้าแล้วกลับเป็นตัวอย่างเดิม
//
// หน้าเว็บที่ฝังคุยกับเดโมผ่าน postMessage (origin เดียวกันเท่านั้น):
//   { tk: 'demo', cmd: 'tab', tab: 'actions', view: 'node' }   สลับหน้า
//   { tk: 'demo', cmd: 'pause' | 'resume' }                    หยุด/เดินไลฟ์จำลอง (เลื่อนพ้นจอแล้วไม่ต้องกิน CPU)
// เดโมตอบกลับ { tk: 'demo', ready: true } เมื่อพร้อม
(function () {
  'use strict';
  var Q = new URLSearchParams(location.search);
  var EN = Q.get('lang') === 'en';
  var DATA = window.__TK_DEMO_DATA || { version: '', defaults: {}, gifts: [] };
  // ใช้แทน http://localhost:<พอร์ต> ที่แอปใช้ต่อ widget/ไฟล์เสียง (ดูการ patch ใน sync-app.mjs)
  window.__TK_DEMO_BASE = location.origin;

  try {
    localStorage.setItem('tk.theme', 'dark');
    localStorage.setItem('tk.actionsView', Q.get('view') === 'list' ? 'list' : 'node');
    // ผืนโหนดเปิดที่ซูมอ่านออก เห็นกฎแรกๆ แยกสายชัดๆ — ปล่อยให้ "พอดีจอ" เองจะย่อ 7 กฎจนตัวหนังสือเล็กเกินอ่าน
    localStorage.setItem('tk.nc.view', JSON.stringify({ pan: { x: 36, y: 28 }, z: 0.86 }));
    if (Q.get('tab')) localStorage.setItem('tk.tab', Q.get('tab'));
  } catch { /* บางเบราว์เซอร์ปิด localStorage — ก็แค่เริ่มที่หน้าแรก */ }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function weighted(list) {   // [[ค่า, น้ำหนัก], ...]
    var total = list.reduce(function (s, x) { return s + x[1]; }, 0), r = Math.random() * total;
    for (var i = 0; i < list.length; i++) { r -= list[i][1]; if (r <= 0) return list[i][0]; }
    return list[0][0];
  }
  // เหมือน settings.set ของแอป: object ผสานลึก · array แทนทั้งก้อน
  function merge(base, patch) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return patch;
    var out = base && typeof base === 'object' && !Array.isArray(base) ? base : {};
    Object.keys(patch).forEach(function (k) { out[k] = merge(out[k], patch[k]); });
    return out;
  }
  var L = function (th, en) { return EN ? en : th; };

  // ---------- ของขวัญ/ผู้ชมตัวอย่าง ----------
  var GIFTS = {};
  (DATA.gifts || []).forEach(function (g) { GIFTS[g.name] = g; });
  function gift(name) { return GIFTS[name] || { id: 0, name: name, coins: 1, image: '' }; }
  // ตัวที่พบบ่อยในไลฟ์จริง — ถูกๆ มาบ่อย แพงๆ นานๆ ที
  var GIFT_POOL = [['Rose', 30], ['TikTok', 12], ['Heart Me', 10], ['Finger Heart', 8], ['GG', 6], ['Ice Cream Cone', 6],
    ['Perfume', 5], ['Doughnut', 4], ['Confetti', 2], ['Corgi', 1.2], ['Money Gun', 0.8], ['Galaxy', 0.6], ['Lion', 0.12]];
  var PEOPLE = EN
    ? ['MintyBear', 'nightowl_', 'GiftKing77', 'luna.plays', 'Kai_TH', 'BobaTime', 'sunnyside', 'pixelpanda', 'Mochi.cat', 'RiceBowl', 'zenith', 'froggo']
    : ['น้องมิ้นท์', 'ต้นกล้า', 'GiftKing77', 'แพรวา.ch', 'Kai_TH', 'ชานมไข่มุก', 'พี่หมีขาว', 'pixelpanda', 'Mochi.cat', 'ข้าวหอม', 'ฟ้าใส', 'Frogger'];
  function user(i) {
    var n = PEOPLE[i % PEOPLE.length];
    return { userId: 'u' + i, uniqueId: n.toLowerCase().replace(/[^a-z0-9_.]/g, '') || 'viewer' + i, nickname: n,
      profilePictureUrl: '', followRole: i % 3 === 0 ? 1 : 0, isModerator: i === 4, isSubscriber: i === 2 };
  }
  var CHATS = EN
    ? ['hiii 👋', "let's gooo", '!jump', 'what game is this?', 'W stream', 'lol 😂', 'spin the wheel!!', 'first time here', '!jump', 'gg', 'love this setup']
    : ['สวัสดีค่าา 👋', 'มาแล้วครับ', '!jump', 'เกมอะไรคะเนี่ย', '555555', 'หมุนวงล้อหน่อยย', 'สู้ๆ นะ', '!jump', 'เพิ่งมาดูครั้งแรก', 'ตั้งค่าสวยมาก', 'gg'];

  // ---------- กฎตัวอย่าง (โชว์ทุกความสามารถ: แยกสายทำพร้อมกัน, หน่วงเวลา, สุ่มทาง) ----------
  function giftTrig(name, extra) { var g = gift(name); return merge({ type: 'gift', giftName: g.name, giftId: g.id, minDiamonds: 0, repeatCombo: true }, extra || {}); }
  var ACTIONS = [
    { id: 'd_rose', name: L('Rose → ปรบมือ + แจ้งเตือน', 'Rose → clap + alert'), enabled: true, cooldownSec: 0, trigger: giftTrig('Rose'),
      responses: [{ type: 'sound', url: '/sfx/clap.m4a', volume: 0.8 },
        { type: 'alert', text: L('{nickname} ส่ง {giftName} x{repeatCount} 🌹', '{nickname} sent {giftName} x{repeatCount} 🌹'), durationSec: 5 }] },
    { id: 'd_galaxy', name: L('Galaxy → หมุนวงล้อ', 'Galaxy → spin the wheel'), enabled: true, cooldownSec: 0, trigger: giftTrig('Galaxy'),
      responses: [{ type: 'wheel' }, { type: 'tts', text: L('ขอบคุณ {nickname} สำหรับกาแล็กซี่!', 'Thank you {nickname} for the Galaxy!') },
        { type: 'delay', ms: 3000, branches: [{ responses: [{ type: 'sound', url: '/sfx/win.m4a' }, { type: 'winCounter', wcCmd: 'add', wcAmount: 1 }] }] }] },
    { id: 'd_likes', name: L('ครบทุก 1,000 ไลก์ → เฉลิมฉลอง', 'Every 1,000 likes → celebrate'), enabled: true, cooldownSec: 0,
      trigger: { type: 'like', likeMode: 'total', likeThreshold: 1000 },
      responses: [{ type: 'alert', text: L('ครบ {likeCount} ไลก์แล้ว! ❤️', '{likeCount} likes! ❤️'), durationSec: 6 }, { type: 'sound', url: '/sfx/drum.m4a' }] },
    { id: 'd_jump', name: L('แชท !jump → กด Space ในเกม', 'Chat !jump → press Space in game'), enabled: true, cooldownSec: 2,
      trigger: { type: 'chat', keyword: '!jump' }, responses: [{ type: 'keypress', key: 'space', modifiers: [], holdMs: 0 }] },
    { id: 'd_follow', name: L('ผู้ติดตามใหม่ → ขอบคุณ', 'New follower → thank you'), enabled: true, cooldownSec: 0, trigger: { type: 'follow' },
      responses: [{ type: 'tts', text: L('ขอบคุณที่ติดตามนะ {nickname}', 'Thanks for the follow, {nickname}') },
        { type: 'alert', text: L('{nickname} ติดตามแล้ว 💙', '{nickname} just followed 💙'), durationSec: 5 }] },
    { id: 'd_combo', name: L('คอมโบ x10 → สุ่มรางวัล', 'Combo x10 → random reward'), enabled: true, cooldownSec: 0,
      trigger: { type: 'gift', giftName: '', minDiamonds: 0, minRepeat: 10, repeatCombo: true },
      responses: [{ type: 'random', branches: [
        { weight: 3, responses: [{ type: 'winCounter', wcCmd: 'add', wcAmount: 1 }] },
        { weight: 1, responses: [{ type: 'timer', timerCmd: 'add', seconds: 60 }, { type: 'sound', url: '/sfx/boing.m4a' }] }] }] },
    { id: 'd_top', name: L('Top 1 เปลี่ยนคน → ประกาศ', 'New Top 1 → announce'), enabled: true, cooldownSec: 0, trigger: { type: 'topChange' },
      responses: [{ type: 'alert', text: L('👑 {nickname} ขึ้นอันดับ 1!', '👑 {nickname} is now #1!'), durationSec: 6 }, { type: 'sound', url: '/sfx/laugh.m4a' }] }
  ];
  var GAME_SET = [
    { id: 'd_g1', name: L('Rose → เร่งเครื่อง (กด W)', 'Rose → boost (press W)'), enabled: true, cooldownSec: 0, trigger: giftTrig('Rose'),
      responses: [{ type: 'keypress', key: 'w', modifiers: [], holdMs: 800 }] },
    { id: 'd_g2', name: L('Perfume → เปลี่ยนรถ (กด 2)', 'Perfume → switch car (press 2)'), enabled: true, cooldownSec: 5, trigger: giftTrig('Perfume'),
      responses: [{ type: 'keypress', key: '2', modifiers: [], holdMs: 0 }, { type: 'sound', url: '/sfx/boing.m4a' }] }
  ];

  function pad(url, name, color) { return { url: url, name: name, volume: 1, mode: 'oneshot', loop: false, fadeIn: 0, fadeOut: 0, choke: '', color: color }; }

  // ---------- ค่าตั้งทั้งหมด = ค่าเริ่มต้นจริงของแอป + ข้อมูลตัวอย่างทับ ----------
  var S = clone(DATA.defaults || {});
  merge(S, {
    language: EN ? 'en' : 'th', username: 'tikkies.demo', autoConnect: true,
    actions: ACTIONS, activeProfile: 'p_default', nodeDrafts: {},
    actionProfiles: [{ id: 'p_default', name: L('ชุดหลัก', 'Main') }, { id: 'p_game', name: L('เกมแข่งรถ', 'Racing game'), actions: GAME_SET }],
    goals: {
      likes: { enabled: true, target: 50000, label: L('เป้าไลก์', 'Likes goal') },
      diamonds: { enabled: true, target: 20000, label: L('เป้าเพชร', 'Diamonds goal') },
      followers: { enabled: true, target: 200, label: L('ผู้ติดตามใหม่', 'New followers') }
    },
    soundpad: {
      enabled: true, activeBank: 'b_demo',
      banks: [{ id: 'b_demo', name: L('เสียงประจำไลฟ์', 'Stream sounds'), keys: {
        Q: pad('/sfx/laugh.m4a', L('หัวเราะ', 'Laugh'), '#f0c060'),
        W: pad('/sfx/fail.m4a', L('พลาด', 'Fail'), '#9d7bea'),
        E: pad('/sfx/clap.m4a', L('ปรบมือ', 'Clap'), '#3ecf8e'),
        F5: pad('/sfx/boing.m4a', 'Boing', '#4ab4fa'),
        num1: pad('/sfx/win.m4a', L('ชนะ', 'Win'), '#ff8a3d'),
        Space: pad('/sfx/drum.m4a', L('กลองรัว', 'Drum roll'), '#fe2c55')
      } }]
    }
  });
  var SFX = ['/sfx/laugh.m4a', '/sfx/clap.m4a', '/sfx/boing.m4a', '/sfx/win.m4a', '/sfx/drum.m4a', '/sfx/fail.m4a'];

  // ---------- สถานะไลฟ์ ----------
  var ST = { viewerCount: 1284, totalLikes: 48210, sessionLikes: 48210, totalDiamonds: 12480, totalChats: 1893, follows: 86,
    shares: 34, joins: 2710, subscribes: 3, giftCount: 734, startedAt: Date.now() - 38 * 60 * 1000 };
  var TOP = [[2, 4200], [0, 3150], [8, 1820], [5, 960], [1, 540]].map(function (x) { return { i: x[0], d: x[1], g: Math.round(x[1] / 9) }; });
  function lb() {
    return { top: TOP.map(function (t) { var u = user(t.i); return { uniqueId: u.uniqueId, nickname: u.nickname, profilePictureUrl: '', diamonds: t.d, gifts: t.g }; }) };
  }
  function goals() {
    var g = S.goals || {};
    function one(k, cur) { var x = g[k] || {}; return { enabled: x.enabled !== false, target: x.target || 0, label: x.label || '', current: cur }; }
    return { likes: one('likes', ST.sessionLikes), diamonds: one('diamonds', ST.totalDiamonds), followers: one('followers', ST.follows) };
  }
  var TIMER = { running: false, remainingSec: 0, totalAddedSec: 0, label: (S.timer && S.timer.label) || '', enabled: false };
  var WINS = { count: 3, target: 10 };
  var CONN = { status: 'connected', username: S.username, roomId: '7418' + rnd(100000, 999999) };
  var SESSIONS = [1, 3, 6].map(function (daysAgo, k) {
    var start = Date.now() - daysAgo * 86400000 - k * 3600000, dur = [7260, 5400, 9120][k];
    var n = [[214, 6, 31, 88, 17, 9, 4], [160, 3, 22, 51, 12, 5, 3], [301, 11, 45, 120, 25, 14, 6]][k];
    var ids = ['d_rose', 'd_galaxy', 'd_likes', 'd_jump', 'd_follow', 'd_combo', 'd_top'], actions = {};
    ids.forEach(function (id, j) {
      var steps = {};
      (ACTIONS[j].responses || []).forEach(function (r, i) { steps[String(i)] = n[j]; });
      actions[id] = { n: n[j], d: id === 'd_rose' ? n[j] : id === 'd_galaxy' ? n[j] * 1000 : 0, steps: steps };
    });
    return { id: 's' + k, username: 'tikkies.demo', startedAt: start, endedAt: start + dur * 1000, durationSec: dur,
      totalDiamonds: [18450, 9320, 26780][k], sessionLikes: [52100, 31800, 77400][k], totalChats: [2390, 1610, 3320][k],
      follows: [132, 74, 188][k], shares: [41, 19, 57][k], peakViewers: [1860, 1210, 2440][k],
      topGifters: lb().top.slice(0, 3), actions: actions };
  });

  // ---------- เหตุการณ์ → หน้าจอ ----------
  var subs = [];
  function emit(event, data) {
    subs.slice().forEach(function (cb) { try { cb({ event: event, data: data }); } catch (e) { console.error(e); } });
  }
  function stats() { emit('stats', clone(ST)); }

  // "กฎทำงาน": ตัวรันจริงอยู่ใน main process ของแอป — ที่นี่แค่ยิง action/actionStep ให้มุมมองโหนดมีไฟวิ่งและยอดทำงานขยับ
  // loud = ผู้ใช้กดเอง (ปุ่มทดสอบ/โยนของขวัญ) ถึงจะเล่นเสียงจริง — ไลฟ์จำลองที่เดินเองต้องเงียบ ไม่งั้นหน้าเว็บส่งเสียงใส่คนอ่าน
  function matches(a, ev, d) {
    var t = a.trigger || {};
    if (a.enabled === false || t.type !== ev) return false;
    if (ev === 'gift') return (!t.giftName || t.giftName === d.giftName) && (!t.minRepeat || (d.repeatCount || 1) >= t.minRepeat);
    if (ev === 'chat') return !t.keyword || String(d.comment || '').toLowerCase().indexOf(String(t.keyword).toLowerCase()) >= 0;
    return true;
  }
  function runRule(a, d, loud) {
    var sim = !!d.simulated;
    emit('action', { actionId: a.id, name: a.name, triggeredBy: (a.trigger || {}).type, diamonds: d.diamondTotal || 0, sim: sim });
    (function walk(list, prefix, wait) {
      (list || []).forEach(function (r, i) {
        if (!r) return;
        var path = prefix + i;
        setTimeout(function () {
          emit('actionStep', { actionId: a.id, path: path, sim: sim });
          if (loud && r.type === 'sound' && r.url) emit('sound', { url: r.url, volume: r.volume == null ? 1 : r.volume });
          if (r.type === 'winCounter') { WINS.count = Math.max(0, WINS.count + (Number(r.wcAmount) || 0)); emit('winCounter', clone(WINS)); }
          var bs = r.branches || [];
          if (r.type === 'delay') walk(bs[0] && bs[0].responses, path + '/0/', Math.min(60000, Number(r.ms) || 0));
          else if ((r.type === 'random' || r.type === 'if') && bs.length) {
            var bi = r.type === 'if' ? (Math.random() < 0.5 ? 0 : 1)
              : weighted(bs.map(function (b, k) { return [k, b && b.weight != null ? Math.max(0, Number(b.weight) || 0) : 1]; }));
            if (bs[bi]) walk(bs[bi].responses, path + '/' + bi + '/', 0);
          }
        }, wait);
      });
    })(a.responses, '', 0);
  }
  function fire(ev, d, loud) { (S.actions || []).forEach(function (a) { if (a && matches(a, ev, d)) runRule(a, d, loud); }); }

  function chat(i, text) {
    var d = merge(user(i == null ? rnd(0, PEOPLE.length - 1) : i), { comment: text || pick(CHATS) });
    ST.totalChats++;
    emit('chat', d); fire('chat', d, false); stats();
  }
  var likeMark = Math.floor(ST.sessionLikes / 1000);
  function like() {
    var n = rnd(3, 25), d = merge(user(rnd(0, PEOPLE.length - 1)), { likeCount: n });
    ST.totalLikes += n; ST.sessionLikes += n; d.totalLikeCount = ST.totalLikes;
    emit('like', d);
    var m = Math.floor(ST.sessionLikes / 1000);
    if (m > likeMark) { likeMark = m; fire('like', merge(clone(d), { likeCount: m * 1000 }), false); }
    emit('goals', goals()); stats();
  }
  function sendGift(name, i, repeat, loud, extra) {
    var g = gift(name || weighted(GIFT_POOL)), who = i == null ? rnd(0, PEOPLE.length - 1) : i;
    var rep = repeat || (g.coins <= 5 && Math.random() < 0.3 ? rnd(2, 14) : 1);
    var d = merge(user(who), { giftId: g.id, giftName: g.name, giftPictureUrl: g.image || '', diamondCount: g.coins, repeatCount: rep,
      streakable: g.coins <= 5, repeatEnd: true, diamondTotal: g.coins * rep });
    if (extra) merge(d, extra);
    ST.totalDiamonds += d.diamondTotal; ST.giftCount += rep;
    var before = TOP[0] && TOP[0].i;
    var row = TOP.filter(function (t) { return t.i === who; })[0];
    if (row) { row.d += d.diamondTotal; row.g += rep; } else TOP.push({ i: who, d: d.diamondTotal, g: rep });
    TOP.sort(function (a, b) { return b.d - a.d; });
    TOP = TOP.slice(0, 10);
    emit('gift', d); fire('gift', d, !!loud);
    emit('leaderboard', lb());
    if (TOP[0].i !== before) fire('topChange', merge(user(TOP[0].i), { diamondTotal: TOP[0].d }), !!loud);
    emit('goals', goals()); stats();
  }
  function follow() { var d = user(rnd(0, PEOPLE.length - 1)); ST.follows++; emit('follow', d); fire('follow', d, false); emit('goals', goals()); stats(); }
  function share() { var d = user(rnd(0, PEOPLE.length - 1)); ST.shares++; emit('share', d); fire('share', d, false); stats(); }
  function join() { var d = user(rnd(0, PEOPLE.length - 1)); ST.joins++; emit('member', d); stats(); }

  // ---------- ไลฟ์จำลอง ----------
  var live = true, paused = false;
  (function tick() {
    setTimeout(tick, rnd(700, 1600));
    if (!live || paused || document.hidden) return;
    var r = Math.random();
    if (r < 0.38) chat(); else if (r < 0.62) like(); else if (r < 0.84) sendGift(); else if (r < 0.92) join();
    else if (r < 0.97) follow(); else share();
    if (Math.random() < 0.35) { ST.viewerCount = Math.max(700, ST.viewerCount + rnd(-12, 15)); stats(); }
    // นานๆ ครั้งให้เห็นคอมโบยาวกับของขวัญใหญ่ — ให้กฎ "คอมโบ x10" กับ "Galaxy" มีโอกาสทำงานบนจอ
    if (Math.random() < 0.05) sendGift(pick(['Rose', 'Heart Me', 'TikTok']), null, rnd(10, 30));
  })();

  function connect(name) {
    CONN = { status: 'connecting', username: String(name || S.username || '').replace(/^@/, '') || 'tikkies.demo' };
    emit('connectionState', clone(CONN));
    setTimeout(function () {
      CONN = { status: 'connected', username: CONN.username, roomId: '7418' + rnd(100000, 999999) };
      emit('connected', { username: CONN.username, roomId: CONN.roomId });
      live = true;
    }, 900);
    return stateGet();
  }
  function disconnect() {
    live = false;
    CONN = { status: 'disconnected', username: CONN.username };
    emit('disconnected', { username: CONN.username });
    return stateGet();
  }

  function stateGet() {
    return { settingsFull: S, osLocale: EN ? 'en-US' : 'th-TH', serverPort: 21213, version: DATA.version || '',
      connection: clone(CONN), stats: clone(ST), goals: goals(), leaderboard: lb(), timer: clone(TIMER),
      widgetsLive: [], obs: { connected: false }, giftSource: {} };
  }
  var AUTH = { loggedIn: true, email: 'demo@tikkies.app', name: 'Demo Streamer',
    subscription: { active: true, status: 'active', plan: 'pro', currentPeriodEnd: Date.now() + 26 * 86400000, expiresAt: Date.now() + 26 * 86400000 },
    devices: [] };
  function onlyInApp() { throw new Error(L('โหมดสาธิต — ใช้ได้ในโปรแกรมจริง', 'Demo mode — available in the real app')); }

  var H = {
    'state:get': stateGet,
    'settings:get': function () { return S; },
    'settings:set': function (p) { merge(S, (p && p.patch) || {}); return S; },
    'gifts:list': function () { return clone(DATA.gifts || []); },
    'gifts:source': function () { return {}; },
    'sessions:list': function () { return clone(SESSIONS); },
    'sessions:delete': function (p) { SESSIONS = SESSIONS.filter(function (s) { return s.id !== (p && p.id); }); return true; },
    'sessions:exportCsv': onlyInApp,
    'presets:list': function () { return []; },
    'tiktok:connect': function (p) { return connect(p && p.username); },
    'tiktok:disconnect': disconnect,
    'simulate': function (p) {
      p = p || {};
      var o = p.overrides || {};
      if (p.type === 'gift') sendGift(o.giftName, null, o.repeatCount || 1, true, { simulated: true });
      else if (p.type === 'chat') chat(null, o.comment);
      else if (p.type === 'follow') follow();
      else if (p.type === 'like') like();
      else if (p.type === 'share') share();
      return { ok: true };
    },
    'actions:test': function (p) {
      var a = (S.actions || []).filter(function (x) { return x && x.id === (p && p.id); })[0];
      if (a) runRule(a, merge({ simulated: true, diamondTotal: 0 }, (p && p.overrides) || {}), true);
      return { ok: true };
    },
    'timer:control': function () { return clone(TIMER); },
    'winCounter:control': function (p) {
      var c = (p && p.cmd) || 'add', v = p && p.payload || {};
      if (c === 'add') WINS.count += Number(v.delta) || 1; else if (c === 'set') WINS.count = Number(v.value) || 0; else if (c === 'reset') WINS.count = 0;
      emit('winCounter', clone(WINS));
      return clone(WINS);
    },
    'wheel:spin': function () { return {}; },
    'randomWheel:spin': function () { return {}; },
    'tts:test': function (p) { emit('tts', { id: Date.now(), text: (p && p.text) || '', rate: 1, pitch: 1, volume: 1 }); return true; },
    'tts:fetch': function () { return null; },
    'media:import': function () { return pick(SFX); },
    'media:importPath': function () { return pick(SFX); },
    'soundpad:get': function () { return merge(clone(S.soundpad || {}), { on: (S.soundpad || {}).enabled !== false, hookOk: true }); },
    'soundpad:set': function (p) { S.soundpad = merge(S.soundpad || {}, (p && p.patch) || {}); padState('set'); return H['soundpad:get'](); },
    'soundpad:toggle': function (p) { S.soundpad.enabled = p && p.on != null ? !!p.on : S.soundpad.enabled === false; padState('toggle'); return H['soundpad:get'](); },
    'soundpad:assign': function (p) {
      var b = (S.soundpad.banks || []).filter(function (x) { return x.id === (p && p.bank); })[0] || (S.soundpad.banks || [])[0];
      if (b && p && p.key) { b.keys = b.keys || {}; if (p.pad) b.keys[p.key] = merge(b.keys[p.key] || {}, p.pad); else delete b.keys[p.key]; }
      padState('assign');
      return H['soundpad:get']();
    },
    'soundpad:import': function () { return pick(SFX); },
    'soundpad:retryHook': function () { return true; },
    'soundpad:diag': function () { return {}; },
    'auth:state': function () { return clone(AUTH); },
    'auth:me': function () { return clone(AUTH); },
    'update:check': function () { return { available: false }; },
    'app:openExternal': function (p) { if (p && /^https?:\/\//.test(p.url || '')) window.open(p.url, '_blank', 'noopener'); return true; },
    'obs:connect': onlyInApp, 'obs:scenes': function () { return []; }, 'minecraft:test': onlyInApp,
    'actions:import': onlyInApp, 'actions:export': onlyInApp, 'billing:plans': function () { return { ok: true, plans: [] }; }
  };
  function padState(reason) {
    var sp = S.soundpad || {}, b = (sp.banks || []).filter(function (x) { return x.id === sp.activeBank; })[0] || (sp.banks || [])[0] || {};
    emit('soundpadState', { on: sp.enabled !== false, bank: { id: b.id || '', name: b.name || '' }, keys: b.keys || {}, hookOk: true, reason: reason });
  }

  window.tikkies = {
    invoke: function (cmd, payload) {
      try {
        var h = H[cmd];
        return Promise.resolve(h ? h(payload || {}) : {});
      } catch (e) {
        return Promise.reject(e);
      }
    },
    onEvent: function (cb) {
      subs.push(cb);
      return function () { subs = subs.filter(function (x) { return x !== cb; }); };
    },
    pathForFile: function () { return ''; }
  };

  // ---------- คุยกับหน้าเว็บที่ฝัง ----------
  function goTab(tab, view) {
    var b = document.querySelector('.nav-item[data-tab="' + tab + '"]');
    if (b) b.click();
    if (tab === 'actions') {
      var vb = document.getElementById(view === 'list' ? 'viewListBtn' : 'viewNodeBtn');
      if (vb) vb.click();
    }
  }
  window.addEventListener('message', function (e) {
    if (e.origin !== location.origin || !e.data || e.data.tk !== 'demo') return;
    if (e.data.cmd === 'tab') goTab(e.data.tab, e.data.view);
    else if (e.data.cmd === 'pause') paused = true;
    else if (e.data.cmd === 'resume') paused = false;
  });

  document.documentElement.classList.add('tk-demo');
  if (Q.get('embed') === '1') document.documentElement.classList.add('tk-demo-embed');
  var css = document.createElement('style');
  // เมนูที่ต้องมีบัญชี/เซิร์ฟเวอร์จริงถึงมีความหมาย — ซ่อนในเดโม
  css.textContent = '.tk-demo .nav-item[data-tab="billing"],.tk-demo .nav-item[data-tab="account"],.tk-demo .nav-item[data-tab="presets"]{display:none!important}';
  document.head.appendChild(css);

  // แป้นเสียง: ในโปรแกรมจริงปุ่มถูกดักจากทั้งเครื่อง (กดในเกมได้) — ในเดโมรับปุ่มเฉพาะตอนเปิดหน้าแป้นเสียงอยู่
  // และไม่แย่งปุ่มตอนพิมพ์ในช่องกรอก · กันปุ่มที่ใส่เสียงไว้ไม่ให้ไปทำงานของเบราว์เซอร์ (เช่น F5 = รีหน้า)
  function padKey(e) {
    var pane = document.querySelector('.tab[data-tab="soundpad"]');
    if (e.repeat || !pane || pane.hidden || /INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '')) return;
    var sp = S.soundpad || {}, b = (sp.banks || []).filter(function (x) { return x.id === sp.activeBank; })[0] || (sp.banks || [])[0] || {};
    var key = String(e.code || '').replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad(\d)$/, 'num$1');
    if (sp.enabled === false || !b.keys || !b.keys[key]) return;
    e.preventDefault();
    emit('soundpadKey', { key: key, down: e.type === 'keydown' });
  }
  document.addEventListener('keydown', padKey);
  document.addEventListener('keyup', padKey);
  // ผู้ใช้กดเมนูในแอปเอง → บอกหน้าเว็บให้แท็บด้านนอกขยับตาม
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('.nav-item[data-tab]');
    if (b && parent !== window) parent.postMessage({ tk: 'demo', tab: b.getAttribute('data-tab') }, location.origin);
  });

  window.addEventListener('load', function () {
    setTimeout(function () {
      if (Q.get('tab')) goTab(Q.get('tab'), Q.get('view'));
      // ฟีดไม่ว่างตั้งแต่เปิด — เหมือนเข้ามาดูกลางไลฟ์
      [function () { chat(3); }, function () { sendGift('Rose', 0, 5); }, function () { chat(6); }, like, function () { sendGift('Perfume', 2); },
        function () { chat(9, '!jump'); }, follow, function () { sendGift('Heart Me', 5, 3); }].forEach(function (f, k) { setTimeout(f, 120 * k); });
      try { if (parent !== window) parent.postMessage({ tk: 'demo', ready: true }, location.origin); } catch { /* ไม่ได้ถูกฝังก็ไม่ต้องบอกใคร */ }
    }, 350);
  });
})();
