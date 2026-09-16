// Helper กลางของทุก widget — เชื่อม WebSocket กลับไปหา Tikkies Tools พร้อม auto-reconnect
// ใช้งาน:
//   TikkiesWidget.connect({
//     onEvent(event, data) {},      // ทุก event: chat, gift, like, ..., snapshot
//     onOpen() {}, onClose() {}
//   });
(function () {
  const params = new URLSearchParams(location.search);

  function wsUrl() {
    // widget ถูกเสิร์ฟจากเซิร์ฟเวอร์เดียวกับ WS; รองรับ ?host= / ?port= เผื่อเปิดจากไฟล์ตรงๆ
    const host = params.get('host') || location.hostname || 'localhost';
    const port = params.get('port') || location.port || 21213;
    // บอกเซิร์ฟเวอร์ว่าเราเป็น widget ตัวไหน เพื่อให้หน้าตั้งค่ารู้ว่าตอนนี้ตัวไหนถูกเปิดใช้จริง
    // ส่งตอนต่อเลย ไม่ใช่ส่งเป็นข้อความตามหลัง — จะได้ไม่มีช่วงที่เซิร์ฟเวอร์เห็น socket
    // แต่ยังไม่รู้ว่าเป็นใคร (แล้วป้าย "กำลังใช้งาน" กะพริบตอนเปิดโปรแกรมไลฟ์)
    const name = String(location.pathname || '').split('/').pop().replace(/\.html?$/i, '') || 'unknown';
    // ตัวอย่างในแอปก็ต่อ WS เหมือนกัน ต้องบอกให้ชัดว่าไม่ใช่การใช้งานจริง
    // ไม่งั้นแค่เปิดแท็บ Widgets ดู ทุกตัวจะขึ้นว่า "กำลังใช้งานอยู่" หมด
    const prev = params.get('preview') === '1' ? '&preview=1' : '';
    return `ws://${host}:${port}/?w=${encodeURIComponent(name)}${prev}`;
  }

  // ---- โหมดตัวอย่าง (?preview=1) — หน้าแต่งธีมในแอปใช้ และหน้าเว็บขายฝังโชว์เป็น iframe ----
  // ป้อน event จำลองให้ widget ตัวเองแบบ local ล้วนๆ (ไม่ยิงผ่าน server → ไม่เด้งบน OBS จริง)
  //
  // ข้อความตัวอย่างต้องผ่าน T() ให้หมด ไม่ใช่ไทยตายตัว — เว็บขายฝังกรอบพวกนี้ในหน้าอังกฤษด้วย
  // ถ้าเป็นไทยล้วน คนอ่านอังกฤษจะเห็นชื่อคนดู/หัวตารางเป็นไทยทั้งที่ทั้งหน้าเป็นอังกฤษ
  function startPreview(onEvent) {
    var AV = ''; // ไม่มีรูป — widget จะ fallback เป็นตัวอักษร/อิโมจิเอง
    var seedEvents = [
      ['goals', {
        likes: { enabled: true, target: 1000, label: T('เป้าหมายหัวใจ', 'Likes goal'), current: 683, period: 'session' },
        // ตัวอย่างเป้าหมายที่นับข้ามไลฟ์ — ให้เห็นป้ายช่วงเวลาในกรอบตัวอย่างด้วย
        diamonds: { enabled: true, target: 500, label: T('เป้าหมายเพชร', 'Diamonds goal'), current: 214, period: 'week' },
        followers: { enabled: false, target: 50, label: T('ผู้ติดตามใหม่', 'New followers'), current: 12, period: 'session' }
      }],
      ['likeboard', { totalLikes: 128400, top: [
        { uniqueId: 'fanclub', nickname: T('แฟนคลับตัวจริง', 'True Fan'), profilePictureUrl: AV, likes: 4820 },
        { uniqueId: 'vip1', nickname: T('สายเปย์ตัวจริง', 'Top Gifter'), profilePictureUrl: AV, likes: 3110 },
        { uniqueId: 'gamer1', nickname: T('เกมเมอร์', 'Gamer'), profilePictureUrl: AV, likes: 1750 },
        { uniqueId: 'viewer1', nickname: T('ผู้ชมขาประจำ', 'Regular'), profilePictureUrl: AV, likes: 940 },
        { uniqueId: 'newbie', nickname: T('มือใหม่', 'Newcomer'), profilePictureUrl: AV, likes: 260 }
      ] }],
      ['leaderboard', { top: [
        { uniqueId: 'vip1', nickname: T('สายเปย์ตัวจริง', 'Top Gifter'), profilePictureUrl: AV, diamonds: 899, gifts: 25 },
        { uniqueId: 'vip2', nickname: 'NoBoss', profilePictureUrl: AV, diamonds: 350, gifts: 12 },
        { uniqueId: 'vip3', nickname: T('ไข่มุก', 'Pearl'), profilePictureUrl: AV, diamonds: 120, gifts: 6 }
      ] }],
      ['timer', { running: true, remainingSec: 5025, totalAddedSec: 340, label: 'Subathon Timer', enabled: true }],
      ['roomStats', { viewerCount: 156, topViewers: [] }],
      ['winCounter', {
        count: 7, maxWins: 13, label: 'WIN', showMax: true, showLabel: false, allowNegative: false,
        fontFamily: 'Times New Roman', fontSize: 80, bold: true,
        colorWin: '#5fd75f', colorLose: '#ef6a6a', colorLabel: '#ffffff', colorNeg: '#ef4444',
        outline: true, outlineColor: '#000000', outlineSize: 8,
        layout: 'horizontal', bgOpacity: 100, bgColor: '#000000', bgColor2: '#101820', bgGradient: false
      }]
    ];
    // จัดลำดับให้ "event ที่ทำให้ Alert Box มีการ์ด" (gift/follow/subscribe/share) มาถี่ๆ
    // สลับกับแชท — การ์ด alert แสดงใบละ ~6 วิ พอยิงทุก ~2.5 วิ กรอบ preview จะมีของโชว์เกือบตลอด
    var gRose = { nickname: T('สายเปย์ตัวจริง', 'Top Gifter'), uniqueId: 'vip1', profilePictureUrl: AV, giftName: 'Rose', giftPictureUrl: '', repeatCount: 3, diamondCount: 1, diamondTotal: 3, repeatEnd: true, streakable: true };
    var gGalaxy = { nickname: 'NoBoss', uniqueId: 'vip2', profilePictureUrl: AV, giftName: 'Galaxy', giftPictureUrl: '', repeatCount: 1, diamondCount: 1000, diamondTotal: 1000, repeatEnd: true, streakable: false };
    var loop = [
      ['gift', gRose],
      ['chat', { nickname: T('สมชายใจดี', 'Somchai'), uniqueId: 'user_somchai', profilePictureUrl: AV, comment: T('สวัสดีครับ ทดสอบธีมอยู่ 🎉', 'Hey! just testing the theme 🎉'), followRole: 1, isModerator: false, isSubscriber: false }],
      ['follow', { nickname: T('แฟนคลับ', 'Fan'), uniqueId: 'fan01', profilePictureUrl: AV }],
      ['gift', gGalaxy],
      ['chat', { nickname: T('แฟนคลับ', 'Fan'), uniqueId: 'fan01', profilePictureUrl: AV, comment: T('สีสวยมากก 😍', 'Love these colours 😍'), followRole: 0, isModerator: false, isSubscriber: false }],
      ['tts', { id: 'p1', text: T('ขอบคุณสมชายใจดีสำหรับกุหลาบครับ', 'Thanks Somchai for the rose') }],
      ['subscribe', { nickname: T('สมาชิกใหม่', 'New member'), uniqueId: 'sub01', profilePictureUrl: AV, subMonth: 1 }],
      ['like', { nickname: T('ผู้ชม', 'Viewer'), uniqueId: 'viewer1', likeCount: 15, totalLikeCount: 683 }],
      ['chat', { nickname: T('เกมเมอร์', 'Gamer'), uniqueId: 'gamer1', profilePictureUrl: AV, comment: T('สู้ๆ นะครับ 🔥', 'You got this 🔥'), followRole: 2, isModerator: true, isSubscriber: false }],
      ['share', { nickname: T('ผู้ชม', 'Viewer'), uniqueId: 'viewer2', profilePictureUrl: AV }]
    ];
    var wheelSample = ['wheelSpin', {
      spinId: 'pv', winnerIndex: 1, label: T('รางวัลใหญ่!', 'Jackpot!'), durationSec: 5, resultHoldSec: 3,
      title: T('สุ่มรางวัล', 'Prize draw'), segments: [{ label: '+5' }, { label: T('รางวัลใหญ่!', 'Jackpot!') }, { label: '-5' }, { label: T('หมุนอีกครั้ง', 'Spin again') }]
    }];
    // Random Wheel เป็นคนละตัวกับ Roulette — คนละ event คนละรายการรางวัล
    var randomWheelSample = ['randomWheelSpin', {
      spinId: 'pv', winnerIndex: 3, label: T('รางวัลใหญ่!', 'Jackpot!'), durationSec: 5, resultHoldSec: 3,
      title: T('วงล้อเสี่ยงโชค', 'Random wheel'),
      segments: [{ label: 'รางวัลที่ 1' }, { label: 'เสียใจด้วย' }, { label: 'รางวัลที่ 2' },
                 { label: T('รางวัลใหญ่!', 'Jackpot!') }, { label: T('หมุนอีกครั้ง', 'Spin again') }, { label: T('รางวัลที่ 3', 'Third prize') }]
    }];
    function fire(ev) { try { onEvent(ev[0], JSON.parse(JSON.stringify(ev[1]))); } catch (_) {} }
    setTimeout(function () {
      seedEvents.forEach(fire);
      fire(['gift', gRose]);   // ยิงของขวัญทันที — กรอบ preview ไม่ว่างตั้งแต่แรก
      fire(wheelSample);
      fire(randomWheelSample); // วงล้อกลมก็ต้องมีช่องให้เห็นตั้งแต่แรก — เดิมเป็นวงว่างรอรอบแรก 12 วิ
      fire(randomWheelSample);
      var i = 0;
      setInterval(function () { fire(loop[i % loop.length]); i += 1; }, 2500);
      setInterval(function () { fire(wheelSample); fire(randomWheelSample); }, 12000);
    }, 500);
  }

  function connect(handlers) {
    let retry = 0;
    let ws;
    // โหมดสาธิต: เล่นข้อมูลตัวอย่างในตัว
    if (params.get('preview') === '1' && handlers.onEvent) startPreview(handlers.onEvent);
    // live=0 = ไม่ต้องต่อ WebSocket เลย (ใช้บนหน้าเว็บขาย ซึ่งไม่มีเซิร์ฟเวอร์ให้ต่อ)
    // ในแอปไม่ส่งพารามิเตอร์นี้ preview จึงยังได้ธีม/ค่าตั้งจริงของผู้ใช้เหมือนเดิม
    if (params.get('live') === '0') return { send() {} };
    function open() {
      ws = new WebSocket(wsUrl());
      ws.onopen = () => {
        retry = 0;
        handlers.onOpen && handlers.onOpen();
      };
      ws.onmessage = e => {
        // try ครอบเฉพาะ JSON.parse — ถ้าครอบ handler ด้วย บั๊กใน widget (เช่น render พัง)
        // จะเงียบหายจนกระดานค้างโดยไม่มีร่องรอยใน console เลย
        let msg;
        try {
          msg = JSON.parse(e.data);
        } catch (_) { return; /* ข้าม frame ที่ไม่ใช่ JSON */ }
        try {
          handlers.onEvent && handlers.onEvent(msg.event, msg.data);
        } catch (err) { console.error('widget onEvent error:', err); }
      };
      ws.onclose = () => {
        handlers.onClose && handlers.onClose();
        retry += 1;
        setTimeout(open, Math.min(10000, 500 * retry));
      };
      ws.onerror = () => ws.close();
    }
    open();
    return {
      send(obj) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); }
    };
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // URL ที่จะเอาไปวางใน CSS url(...) ต้องผ่านตัวนี้ก่อน — escapeHtml กันแค่ & < > " '
  // ไม่แตะ ) ; : ซึ่งเป็นตัวปิด url() และตัวคั่น declaration ใน CSS ผู้ชมจึงตั้งรูปโปรไฟล์
  // เป็นค่าที่แหกออกจาก url() แล้วแปะ CSS ของตัวเองทับทั้งจอ overlay ได้
  // URL รูปจริงจาก TikTok ไม่มีอักขระพวกนี้อยู่แล้ว ค่าที่ผิดรูปคืน '' ให้ผู้เรียก fallback เอง
  function safeUrl(u) {
    var s = String(u == null ? '' : u).trim();
    return /^(?:https?:\/\/|\/)[^\s"'()\\<>;]*$/i.test(s) ? s : '';
  }

  function formatNumber(n) {
    n = Number(n) || 0;
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(n);
  }

  // template อย่างง่าย: แทนที่ {key} ด้วยค่าใน data
  function fillTemplate(tpl, data) {
    return String(tpl || '').replace(/\{(\w+)\}/g, (_, k) => (data && data[k] != null ? data[k] : ''));
  }

  // ---------- ภาษาของ widget ----------
  // widget เป็นหน้าเว็บแยก ไม่มีระบบแปลของหน้า Dashboard ให้ใช้ ข้อความที่มันพ่นออกจอสตรีม
  // (เช่น "ยังไม่มีผู้ให้ของขวัญ") จึงเป็นภาษาไทยเสมอ แม้ผู้ใช้จะตั้งโปรแกรมเป็นอังกฤษ
  //
  // ไม่ทำเป็นพจนานุกรมแยกไฟล์ เพราะจะเกิดปัญหา "คีย์ขาดแล้วหลุดเป็นไทยเงียบๆ" ซ้ำอีก
  // เขียนอังกฤษไว้ข้างๆ ไทยตรงจุดที่ใช้เลย — คีย์ขาดไม่ได้เพราะไม่มีคีย์
  //
  // ค่านี้ใช้กับ "ค่าเริ่มต้น" เท่านั้น ถ้าผู้ใช้ตั้งข้อความเองไว้ จะใช้ของเขาเสมอไม่ว่าภาษาไหน
  var LANG = String(params.get('lang') || '').toLowerCase() === 'en' ? 'en' : 'th';
  function T(th, en) { return LANG === 'en' && en != null ? en : th; }

  // ---------- ข้อความที่ผู้ใช้ตั้งเองได้ ----------
  // widget หลายตัวมีประโยคสำเร็จรูปเป็นภาษาไทย เช่น "<ชื่อ> ส่ง <ของขวัญ> x3"
  // สตรีมเมอร์ที่เล่นกับคนดูต่างชาติ หรืออยากได้สำนวนของตัวเอง แก้เองไม่ได้เลย
  // ตอนนี้ตั้งผ่าน ?<key>= ได้ โดยใช้ตัวแปรในวงเล็บปีกกา เช่น "คุณ {nickname} send {gift}"
  //
  // ไม่ตั้ง (หรือตั้งเป็นค่าว่าง) = ใช้ประโยคเดิมของ widget นั้น
  // widget ส่งค่าที่อ่านจาก params ของตัวเองเข้ามา (tpl) ไม่ใช่ให้ตัวช่วยไปอ่านเอง
  // เคยทำแบบให้อ่านเอง แล้วเทสต์ที่รัน widget คนละ sandbox ส่ง param เข้าไปไม่ได้เลย
  // (ฟังก์ชันปิดทับ params ของ sandbox ที่มันถูกสร้าง) = เส้นทางนี้จะไม่มีใครทดสอบได้
  function phrase(tpl, fallback, data) {
    return fillTemplate(tpl === null || tpl === undefined || tpl === '' ? fallback : tpl, data);
  }

  // เวอร์ชันสำหรับข้อความที่จะถูกใส่ลง innerHTML
  //
  // ต้อง escape สองชั้นคนละเหตุผล:
  //   ค่าที่แทนลงไป (ชื่อผู้ชม/ชื่อของขวัญ) มาจากผู้ชม — เป็นทางที่ฝัง HTML เข้ามาได้จริง
  //   ตัวข้อความเอง ผู้ใช้พิมพ์เอง แต่พิมพ์ < > ในประโยคแล้วหน้าจอต้องไม่พัง
  // escape ตัวข้อความก่อนแล้วค่อยเติมค่า ไม่งั้นจะไป escape ค่าที่ escape มาแล้วซ้ำสอง
  // ({ } ไม่ใช่อักขระพิเศษของ HTML ตัวแปรจึงรอดจากการ escape ไปได้)
  function phraseHtml(tpl, fallback, data) {
    var safe = {};
    if (data) for (var k in data) safe[k] = escapeHtml(String(data[k] == null ? '' : data[k]));
    var t = (tpl === null || tpl === undefined || tpl === '') ? fallback : tpl;
    return fillTemplate(escapeHtml(t), safe);
  }

  // ---------- ผสมสี ----------
  // ทำเฉดอ่อน/เข้มจากสีเดียว เพื่อไล่เฉดให้พื้นผิวดูมีมิติแทนที่จะเป็นสีทึบแบนๆ
  // ทำในจาวาสคริปต์ ไม่ใช้ color-mix() ของ CSS เพราะ browser source ของโปรแกรมไลฟ์
  // ตามเวอร์ชัน Chromium ของตัวเอง ซึ่งเก่ากว่าเบราว์เซอร์บนเครื่องได้หลายปี
  // ถ้าใช้ของใหม่แล้วเครื่องผู้ใช้ไม่รองรับ สีจะหายทั้งการ์ดโดยไม่มีอะไรฟ้อง
  function hexToRgb(hex) {
    var h = String(hex || '').trim().replace(/^#/, '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (!/^[0-9a-f]{6}$/i.test(h)) return null;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  // amt > 0 = ผสมขาว (สว่างขึ้น) · amt < 0 = ผสมดำ (เข้มขึ้น) · ช่วง -1..1
  function shade(hex, amt) {
    var c = hexToRgb(hex);
    if (!c) return hex;
    var t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    return '#' + c.map(function (v) {
      return Math.round(v + (t - v) * p).toString(16).padStart(2, '0');
    }).join('');
  }
  function rgba(hex, a) {
    var c = hexToRgb(hex);
    return c ? 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')' : hex;
  }

  window.TikkiesWidget = { connect, escapeHtml, safeUrl, formatNumber, fillTemplate, phrase, phraseHtml, shade, rgba, T, lang: LANG, params };
})();
