// Tikkies Tools Dashboard — main controller
(function () {
  var Tk = window.Tk;
  var $ = Tk.$, $$ = Tk.$$, el = Tk.el, invoke = Tk.invoke, toast = Tk.toast;
  var fmt = Tk.formatNumber;

  // สถานะรวมของหน้า
  var S = {
    settings: null,   // settingsFull
    serverPort: 21213,
    connection: { status: 'disconnected' },
    goals: null,
    timer: null,
    version: '',
    auth: null       // สถานะบัญชี/สมาชิกล่าสุด (มาจาก event authState)
  };

  // ---------- Init ----------
  async function init() {
    injectIcons();
    initTheme();
    setupTabs();
    setupStaticHandlers();
    Tk.onEvent(onBusEvent);

    try {
      var st = await invoke('state:get');
      S.settings = st.settingsFull;
      S.osLocale = st.osLocale || 'en';
      // เลือกภาษาก่อน render — ทาคำแปลลง static HTML และให้ส่วน dynamic เรียก Tk.t() ได้ถูกภาษา
      Tk.i18n.setLocale((S.settings && S.settings.language) || 'auto', S.osLocale);
      initLangToggle();
      S.serverPort = st.serverPort || (st.settingsFull && st.settingsFull.serverPort) || 21213;
      S.connection = st.connection || S.connection;
      S.version = st.version || '';
      applyConnectionState(S.connection);
      applyStats(st.stats);
      applyGoals(st.goals);
      applyLeaderboard(st.leaderboard);
      applyTimer(st.timer);
      renderTemplates();
      renderActions();
      renderProfileBar();
      renderWidgets();
      applyWidgetsLive(st.widgetsLive);   // รู้ตั้งแต่เปิดโปรแกรม ไม่ต้องรอ event ตอนมีคนเปิด/ปิดแหล่งภาพ
      bindWidgetDetail();
      // โหลดรูปของขวัญแล้ว render การ์ด/โหนดใหม่ให้เห็นรูป + คืนมุมมองที่เลือกไว้
      loadGiftCatalog().then(function () { renderActions(); });
      setActionsView(localStorage.getItem('tk.actionsView') || 'list');
      bindWheelTab();
      bindRandomWheelTab();
      bindCarouselTab();
      bindWinCounterTab();
      renderOnAir();
      bindSettingsForms();
      // Soundpad ต้องพร้อมตั้งแต่เปิดแอป ไม่ใช่ตอนเปิดแท็บ — ผู้ใช้กดแพดตอนอยู่ในเกม
      // ถ้ารอวาดแท็บก่อนถึงจะโหลดไฟล์เสียง ปุ่มแรกที่กดจะเงียบ
      try { if (window.SoundpadUI) window.SoundpadUI.mount({ port: S.serverPort }); } catch (e) {}
      applyObsStatus(st.obs || {});
      $('#versionLabel').textContent = 'v' + S.version;
      $('#aboutVersion').textContent = 'v' + S.version;
      $('#updateStatusText').textContent = Tk.t('เวอร์ชันปัจจุบัน') + ' v' + S.version;
      $('#serverStatus').textContent = Tk.t('เซิร์ฟเวอร์') + ': :' + S.serverPort;
    } catch (e) {
      // state:get พังทั้งหน้าจะเหลือแอปครึ่งใบ (ฟอร์มว่าง ปุ่มกดแล้ว throw) — ขึ้นหน้าจอ error ทับไว้ กดลองใหม่ได้
      showInitError(e);
    }
  }

  function showInitError(e) {
    var old = document.getElementById('initErrorScreen');
    if (old) old.remove();
    var retry = el('button', { class: 'btn btn-primary', text: Tk.t('ลองใหม่') });
    retry.addEventListener('click', function () { window.location.reload(); }); // reload = เริ่มใหม่ทั้งหมด ไม่ผูก listener ซ้ำ
    var screen = el('div', { id: 'initErrorScreen', class: 'init-error' }, [
      el('div', { class: 'init-error-box' }, [
        el('h2', { text: Tk.t('เปิดโปรแกรมไม่สำเร็จ') }),
        el('p', { text: Tk.t('โหลดข้อมูลตั้งต้นไม่ได้ — อาจเกิดจากไฟล์ตั้งค่าเสียหาย ข้อมูลของคุณยังอยู่') }),
        el('p', { class: 'muted small', text: String((e && e.message) || e) }),
        retry
      ])
    ]);
    document.body.appendChild(screen);
  }

  // ---------- Icons & Theme ----------
  function injectIcons() {
    $$('[data-icon]').forEach(function (elm) {
      if (elm.querySelector(':scope > .icon')) return;
      elm.insertBefore(window.Icon.el(elm.dataset.icon), elm.firstChild);
    });
  }
  function applyTheme(theme) {
    theme = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    var btn = $('#themeToggle');
    if (btn) { btn.innerHTML = ''; btn.appendChild(window.Icon.el(theme === 'dark' ? 'sun' : 'moon', 16)); }
    localStorage.setItem('tk.theme', theme);
  }
  function initTheme() {
    applyTheme(localStorage.getItem('tk.theme') || 'dark');
    var btn = $('#themeToggle');
    if (btn) btn.addEventListener('click', function () {
      applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });
  }

  // ปุ่มสลับภาษาเร็วข้างปุ่มธีม — สลับไทย↔อังกฤษแล้วบันทึกเป็นค่าบังคับ (ไม่ใช่ auto)
  function updateLangToggle() {
    var b = $('#langToggle');
    if (b) b.textContent = Tk.i18n.current() === 'th' ? 'TH' : 'EN';
  }
  function initLangToggle() {
    updateLangToggle();
    var b = $('#langToggle');
    if (!b) return;
    b.addEventListener('click', function () {
      var next = Tk.i18n.current() === 'th' ? 'en' : 'th';
      Tk.i18n.setLocale(next, S.osLocale);   // ทา static HTML ให้เอง
      updateLangToggle();
      rerenderForLocale();
      // ให้ตัวเลือกในหน้าตั้งค่าตรงกัน แล้วบันทึกลง settings
      var sel = $('#langSelect'); if (sel) sel.value = next;
      saveSettings({ language: next }, true);
    });
  }

  // ---------- Tabs ----------
  function setupTabs() {
    var last = localStorage.getItem('tk.tab') || 'overview';
    function show(name) {
      $$('.nav-item').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === name); });
      $$('#main .tab').forEach(function (s) { s.hidden = s.dataset.tab !== name; });
      localStorage.setItem('tk.tab', name);
      // preview widget สดโหลดเฉพาะตอนดูแท็บ Widgets
      if (name === 'widgets') activateWidgetPreviews();
      else { deactivateWidgetPreviews(); if (typeof closeWidgetDetail === 'function' && !$('#widgetDetail').hidden) closeWidgetDetail(); }
      if (name === 'overview') flushFeedPending();   // วาดเหตุการณ์ที่เกิดตอนอยู่แท็บอื่น
      if (name === 'history') renderSessions(); // เดิม render ตอนคลิกเท่านั้น → เปิดแอปค้างแท็บนี้จะว่าง
      if (name === 'presets') renderPresets();
      // แท็บ Sound วาดด้วย JS ทั้งใบ — วาดตอนเปิดแท็บ (เอนจินเสียงทำงานอยู่แล้วตั้งแต่ init ไม่เกี่ยวกับแท็บ)
      if (window.SoundpadUI) { if (name === 'soundpad') window.SoundpadUI.show(); else window.SoundpadUI.hide(); }
      // หน้าซื้อเป็นเว็บที่ main วางทับกรอบไว้ — ต้องบอกให้ซ่อน/โผล่ตามแท็บเอง
      if (name === 'billing') renderBilling(); else hideBillingView();
    }
    $$('.nav-item').forEach(function (b) {
      b.addEventListener('click', function () { show(b.dataset.tab); });
    });
    show(last);
  }

  // ---------- Static handlers ----------
  function setupStaticHandlers() {
    // เชื่อมต่อ / ตัดการเชื่อมต่อ
    $('#connectBtn').addEventListener('click', toggleConnect);
    $('#usernameInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') toggleConnect(); });
    // จำชื่อไว้ตั้งแต่ตอนพิมพ์ ไม่ต้องรอให้กดเชื่อมต่อหรือติ๊ก auto-connect ก่อน
    // (เดิมบันทึกตอนสั่งเชื่อมเท่านั้น พิมพ์ชื่อไว้แล้วปิดโปรแกรม = หายหมด ต้องพิมพ์ใหม่ทุกครั้ง)
    $('#usernameInput').addEventListener('input', debounce(function () {
      var u = $('#usernameInput').value.trim().replace(/^@/, '');
      if (u !== (S.settings && S.settings.username)) saveSettings({ username: u });
    }, 400));
    $('#autoConnectChk').addEventListener('change', function () {
      saveSettings({ autoConnect: $('#autoConnectChk').checked });
    });

    // ปุ่มทดสอบ event
    $$('[data-sim]').forEach(function (b) {
      b.addEventListener('click', function () { invoke('simulate', { type: b.dataset.sim }); });
    });

    // เหตุการณ์สด
    bindFeedControls(); // ตัวกรอง + ปุ่มล้าง อยู่บนหัวฟีดหน้าภาพรวมแล้ว

    // ประวัติไลฟ์
    $('#exportSessionsBtn').addEventListener('click', function () {
      invoke('sessions:exportCsv', { kind: 'sessions' }).then(function (r) {
        if (r && r.ok) toast(Tk.t('ส่งออกประวัติไลฟ์แล้ว'), 'ok');
      });
    });
    $('#exportGiftersBtn').addEventListener('click', function () {
      invoke('sessions:exportCsv', { kind: 'gifters' }).then(function (r) {
        if (r && r.ok) toast(Tk.t('ส่งออกรายชื่อผู้สนับสนุนแล้ว'), 'ok');
      });
    });
    // โหลดรายการใหม่ทุกครั้งที่เข้าแท็บ (มี session ใหม่จบระหว่างเปิดแอปได้)
    $$('.nav-item').forEach(function (b) {
      if (b.dataset.tab === 'history') b.addEventListener('click', renderSessions);
    });

    // Actions — โปรไฟล์ / ส่งออก / นำเข้า
    $('#profileSelect').addEventListener('change', function () { switchProfile(this.value); });
    $('#profileManageBtn').addEventListener('click', openProfileManager);
    $('#exportActionsBtn').addEventListener('click', exportActions);
    $('#bulkToggleBtn').addEventListener('click', bulkToggle);
    wireGiftDiag();
    $('#importActionsBtn').addEventListener('click', importActions);
    $('#presetsRefreshBtn').addEventListener('click', function () { renderPresets(true); });
    $('#billingReloadBtn').addEventListener('click', function () { renderBilling(true); });
    $('#billingCloseBtn').addEventListener('click', closePayModal);
    $('#billingCancelBtn').addEventListener('click', closePayModal);
    // คลิกพื้นหลังนอกกล่อง = ปิด (เหมือน modal อื่นในแอป)
    $('#billingModal').addEventListener('mousedown', function (e) {
      if (e.target === e.currentTarget) closePayModal();
    });

    // Actions
    $('#newActionBtn').addEventListener('click', createNewAction);

    // Actions — สลับมุมมอง รายการ/โหนด
    $('#viewListBtn').addEventListener('click', function () { setActionsView('list'); });
    $('#viewNodeBtn').addEventListener('click', function () { setActionsView('node'); });

    // Actions — ค้นหา (debounce เบาๆ กันวาดลิสต์ยาวทุกตัวอักษร)
    (function () {
      var inp = $('#actionsSearch'), clr = $('#actionsSearchClear'), t = null;
      if (!inp) return;
      inp.addEventListener('input', function () {
        var v = inp.value.trim().toLowerCase();
        if (clr) clr.hidden = !inp.value;
        clearTimeout(t);
        t = setTimeout(function () { actView.q = v; renderActions(); }, 120);
      });
      // Esc ในช่องค้น = ล้างคำค้น (ไม่ปิด modal เพราะไม่มี modal เปิดอยู่)
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && inp.value) { e.stopPropagation(); inp.value = ''; actView.q = ''; if (clr) clr.hidden = true; renderActions(); }
      });
      if (clr) clr.addEventListener('click', function () { inp.value = ''; actView.q = ''; clr.hidden = true; inp.focus(); renderActions(); });
    })();

    // Actions — ปุ่มตัวกรอง เปิด/ปิดกล่อง
    (function () {
      var btn = $('#actionsFilterBtn'), pop = $('#actionsFilterPop');
      if (!btn || !pop) return;
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var show = pop.hidden;
        if (show) buildActFilterPop();
        pop.hidden = !show;
        btn.setAttribute('aria-expanded', show ? 'true' : 'false');
      });
      // คลิกที่อื่น = ปิดกล่อง
      document.addEventListener('click', function (e) {
        if (pop.hidden) return;
        // ชิปในกล่องถูกวาดใหม่ทันทีที่กด — ตอน event มาถึงตรงนี้ target หลุดจาก DOM แล้ว
        // ถ้าไม่เช็ค กล่องจะปิดเองทุกครั้งที่เลือก ทำให้เลือกเหตุการณ์+การกระทำคู่กันไม่ได้
        if (!document.contains(e.target)) return;
        if (!pop.contains(e.target) && e.target !== btn && !btn.contains(e.target)) closeActFilter();
      });
    })();

    // Actions — ปุ่มเพิ่มด้านล่างลิสต์ = เปิด popup เลือกเหตุการณ์ + การกระทำ (เหมือนปุ่มบน)
    var addBottom = $('#addActionBottomBtn');
    if (addBottom) addBottom.addEventListener('click', createNewAction);

    // อัปเดตโปรแกรม
    $('#updateInstallBtn').addEventListener('click', function () { invoke('update:install'); });
    $('#checkUpdateBtn').addEventListener('click', function () {
      invoke('update:check').then(function (r) {
        if (r && r.dev) toast(Tk.t('เช็คอัปเดตได้เฉพาะตัวที่ติดตั้งแล้ว (โหมด dev ข้าม)'), '');
        else if (r && r.unavailable) toast(Tk.t('ระบบอัปเดตใช้ไม่ได้บนเครื่องนี้'), 'err');
      });
    });

    // TTS
    bindTtsForm();
    $('#ttsTestBtn').addEventListener('click', function () {
      invoke('tts:test', { text: $('#ttsTestText').value || Tk.t('ทดสอบเสียง') });
    });

    // Timer controls
    $$('[data-timer-cmd]').forEach(function (b) {
      b.addEventListener('click', function () {
        var cmd = b.dataset.timerCmd;
        var payload = b.dataset.add ? { seconds: Number(b.dataset.add) } : {};
        invoke('timer:control', { cmd: cmd, payload: payload });
      });
    });

    // OBS
    $('#obsConnectBtn').addEventListener('click', async function () {
      try { await invoke('obs:connect'); toast(Tk.t('กำลังเชื่อมต่อ OBS...')); refreshScenes(); }
      catch (e) {}
    });
    $('#obsDisconnectBtn').addEventListener('click', function () { invoke('obs:disconnect'); });

    // ปุ่มทดสอบการเชื่อมต่อ Minecraft — บอกผลตรงนั้นเลย ไม่ใช่ให้ไปเดาจาก Action ที่ยิงไม่ออก
    var mcBtn = $('#mcTestBtn'), mcStatus = $('#mcStatus');
    if (mcBtn && mcStatus) {
      mcBtn.addEventListener('click', async function () {
        mcBtn.disabled = true;
        mcStatus.textContent = Tk.t('กำลังทดสอบ...');
        mcStatus.className = 'obs-status';
        try {
          var r = await invoke('minecraft:test', {}, { toast: false });
          var okNow = !!(r && r.ok);
          mcStatus.textContent = (okNow ? '✓ ' : '✗ ') + ((r && r.detail) || '');
          mcStatus.className = 'obs-status ' + (okNow ? 'ok' : 'err');
        } catch (e) {
          mcStatus.textContent = '✗ ' + ((e && e.message) || e);
          mcStatus.className = 'obs-status err';
        } finally {
          mcBtn.disabled = false;
        }
      });
    }
  }

  // ---------- Connection ----------
  var BUSY = ['connecting', 'waiting', 'retrying'];
  function isBusy(s) { return BUSY.indexOf(s) >= 0; }

  // ข้อความบอกสาเหตุที่เชื่อมไม่ได้ — แปลจาก "ชนิดของปัญหา" (errorKind) ที่ฝั่งโปรแกรมจำแนกไว้แล้ว
  // ไม่ใช่เอาข้อความดิบมาโชว์ เพราะข้อความจากฝั่งโปรแกรมเป็นไทยเสมอ ตั้งโปรแกรมเป็นอังกฤษก็ยังเห็นไทย
  var CONN_ERR = {
    offline: 'ยังไม่ได้เปิดไลฟ์ — จะรอให้อัตโนมัติ พอเปิดไลฟ์แล้วจะเชื่อมให้เอง',
    notfound: 'ไม่พบผู้ใช้นี้ — ตรวจสอบ @username อีกครั้ง',
    ratelimit: 'โควตาเชื่อมต่อฟรีหมดชั่วคราว — รอสัก 10–30 นาที หรือใส่ Sign API key ฟรีจาก eulerstream.com ในหน้าตั้งค่า',
    premium: 'ต้องใช้ Sign API key — สมัครฟรีที่ eulerstream.com แล้วใส่ในหน้าตั้งค่า',
    sign: 'เชื่อมไม่สำเร็จ — บริการเชื่อมต่อฟรีสะดุด รอ 1–2 นาทีแล้วลองใหม่ (อย่ากดรัว)',
    network: 'เชื่อมต่ออินเทอร์เน็ตไม่ได้ — ตรวจสอบเน็ตแล้วลองใหม่',
    roomid: 'ดึงข้อมูลห้องไลฟ์ไม่ได้ — ตรวจสอบ @username และว่ากำลังไลฟ์อยู่จริง'
  };
  // Electron ห่อ error ของฝั่งโปรแกรมด้วย "Error invoking remote method 'cmd': Error: ..." เสมอ
  // ปล่อยไปตามนั้นผู้ใช้จะเห็นชื่อ method ภายในโปรแกรมโผล่กลางหน้าจอ
  function cleanErr(e) {
    return String((e && e.message) || e || '')
      .replace(/^Error invoking remote method\s+'[^']*':\s*/, '')
      .replace(/^(Error|TypeError):\s*/, '')
      .trim();
  }
  function connErrText(kind, fallback) {
    return CONN_ERR[kind] ? Tk.t(CONN_ERR[kind]) : (fallback || Tk.t('เชื่อมไม่สำเร็จ'));
  }

  async function doConnect(username, waitForLive) {
    // โหมดรอไลฟ์: คงคำอธิบายว่ากำลังรออะไรอยู่ไว้ ไม่ต้องล้างทิ้ง ผู้ใช้จะได้รู้ว่าไม่ได้ค้าง
    $('#connectError').textContent = waitForLive ? connErrText('offline') : '';
    applyConnectionState({ status: waitForLive ? 'waiting' : 'connecting', username: username });
    try {
      await invoke('tiktok:connect', { username: username, waitForLive: waitForLive }, { toast: false });
    } catch (e) {
      // error สุดท้าย (หลัง retry หมด) — สถานะจริงมาทาง event connectionState แล้ว
      // ถ้า state จำแนกชนิดของปัญหาไว้แล้ว ให้ applyConnectionState เป็นคนโชว์ (ข้อความแปลตามภาษา)
      // ตรงนี้รับเฉพาะกรณีที่ไม่รู้ชนิด จะได้ไม่เอาข้อความดิบไปทับข้อความที่แปลไว้แล้ว
      if (!S.connection.errorKind && !$('#connectError').textContent) $('#connectError').textContent = cleanErr(e);
    }
  }

  // ผู้ใช้กดยกเลิกเอง = ห้ามไปเริ่ม "รอจนไลฟ์" ให้อัตโนมัติ ไม่งั้นกดยกเลิกแล้วมันวนกลับมารอเองอีก
  var userStopped = false;
  var lastAutoWait = 0;

  async function toggleConnect() {
    var status = S.connection.status;
    if (status === 'connected' || isBusy(status)) {
      userStopped = true;
      await invoke('tiktok:disconnect'); // ยกเลิก/ตัดการเชื่อม (ยกเลิกการรอด้วย)
      return;
    }
    var username = $('#usernameInput').value.trim().replace(/^@/, '');
    if (!username) { $('#connectError').textContent = Tk.t('กรุณาใส่ชื่อผู้ใช้ TikTok'); return; }
    userStopped = false;
    doConnect(username, false);
  }

  var retryCountdown = null;
  function applyConnectionState(c) {
    S.connection = c || {};
    var status = S.connection.status || 'disconnected';
    var dot = $('#connDot'), text = $('#connText'), meta = $('#connMeta');
    dot.className = 'dot ' + status;
    var labels = {
      disconnected: Tk.t('ยังไม่เชื่อมต่อ'), connecting: Tk.t('กำลังเชื่อมต่อ...'),
      waiting: Tk.t('กำลังรอไลฟ์...'), retrying: Tk.t('กำลังลองใหม่...'), connected: Tk.t('เชื่อมต่อแล้ว')
    };
    text.textContent = labels[status] || status;

    var uname = S.connection.username ? '@' + S.connection.username : '';
    var extra = '';
    if (status === 'connected' && S.connection.roomId) extra = '  ·  LIVE';
    else if (status === 'retrying' && S.connection.attempt) extra = '  •  ' + Tk.t('ครั้งที่ {n}', { n: S.connection.attempt });
    meta.textContent = uname + extra;

    var btn = $('#connectBtn');
    btn.textContent = (status === 'connected') ? Tk.t('ตัดการเชื่อมต่อ')
      : isBusy(status) ? Tk.t('ยกเลิก') : Tk.t('เชื่อมต่อ');

    if (S.connection.username && !$('#usernameInput').value) $('#usernameInput').value = S.connection.username;
    // สถานะ waiting = กำลังรอไลฟ์อยู่ ต้องคงคำอธิบายไว้ให้เห็นว่ารออะไร ไม่ใช่ล้างจนดูเหมือนค้าง
    if (status === 'connected' || status === 'connecting') $('#connectError').textContent = '';

    // นับถอยเวลา retry ให้เห็นในกล่องเชื่อมต่อ
    clearInterval(retryCountdown);
    if (status === 'retrying' && S.connection.nextRetryMs > 0) {
      var remain = Math.ceil(S.connection.nextRetryMs / 1000);
      var elc = $('#connectError');
      var render = function () { elc.textContent = connErrText(S.connection.errorKind, S.connection.error) + ' — ' + Tk.t('ลองใหม่ใน {n} วิ', { n: remain }); };
      render();
      retryCountdown = setInterval(function () {
        remain -= 1;
        if (remain <= 0 || S.connection.status !== 'retrying') { clearInterval(retryCountdown); return; }
        render();
      }, 1000);
    }

    // ยังไม่ได้เปิดไลฟ์ = ไม่ใช่ความผิดพลาดที่ผู้ใช้ต้องมากดอะไรต่อ — รอให้เองเลย
    // (เดิมโชว์ปุ่ม "รอจนกว่าจะไลฟ์" ให้กด ซึ่งแทบทุกครั้งก็ต้องกดอยู่ดี)
    // เงื่อนไขกันวนซ้ำ: ต้องไม่ใช่การกดยกเลิกเอง และเว้นจากรอบก่อนอย่างน้อย 5 วิ
    if (status === 'disconnected' && S.connection.errorKind === 'offline') {
      $('#connectError').textContent = connErrText('offline');
      var who = S.connection.username || $('#usernameInput').value.trim().replace(/^@/, '');
      if (who && !userStopped && Date.now() - lastAutoWait > 5000) {
        lastAutoWait = Date.now();
        doConnect(who, true);
      }
    }
  }

  // ---------- Stats ----------
  function applyStats(s) {
    if (!s) return;
    $$('[data-stat]').forEach(function (elm) {
      var v = fmt(s[elm.dataset.stat] || 0);
      if (elm.textContent === v) return;      // ค่าเท่าเดิม — ไม่ต้องกระพริบ
      elm.textContent = v;
      elm.classList.remove('tick');
      void elm.offsetWidth;                    // บังคับให้ animation เริ่มใหม่
      elm.classList.add('tick');
    });
  }

  // ---------- Leaderboard (mini) ----------
  function applyLeaderboard(lb) {
    var host = $('#miniLeaderboard');
    var top = (lb && lb.top) || [];
    if (!top.length) { host.innerHTML = '<div class="muted">' + Tk.t('ยังไม่มีข้อมูล') + '</div>'; return; }
    host.innerHTML = '';
    top.slice(0, 3).forEach(function (u, i) {
      var row = el('div', { class: 'lb-row' }, [
        el('div', { class: 'rank', text: String(i + 1) }),
        Tk.avatar('av', u),
        el('div', { class: 'nm', text: u.nickname || u.uniqueId }),
        el('div', { class: 'dm' }, [window.Icon.el('diamond', 13), el('span', { text: fmt(u.diamonds) })])
      ]);
      host.appendChild(row);
    });
  }

  // ---------- แผงคุมระหว่างออกอากาศ ----------
  // รวมปุ่มที่ต้องกด "ตอนไลฟ์จริง" ไว้ในหน้าเดียว (เดิมกระจายอยู่คนละแท็บ ต้องสลับไปมา)
  // แสดงเฉพาะฟีเจอร์ที่เปิดใช้งานอยู่ — ไม่เปิดอะไรเลยก็ซ่อนทั้งการ์ด
  function renderOnAir() {
    var host = $('#onAirCard');
    if (!host) return;
    var s = S.settings || {};
    var timerOn = !!(s.timer && s.timer.enabled);
    var wcOn = !!(s.winCounter && s.winCounter.enabled);
    var wheelOn = !!(s.wheel && (s.wheel.segments || []).length);
    var rwOn = !!(s.randomWheel && (s.randomWheel.segments || []).length);

    host.innerHTML = '';
    if (!timerOn && !wcOn && !wheelOn && !rwOn) { host.hidden = true; return; }
    host.hidden = false;
    host.appendChild(el('div', { class: 'card-title' }, [
      window.Icon.el('zap', 14), el('span', { text: Tk.t('ระหว่างออกอากาศ') })
    ]));

    function group(label, valueEl, buttons) {
      var head = el('div', { class: 'onair-head' }, [el('span', { class: 'onair-label', text: label })]);
      if (valueEl) head.appendChild(valueEl);
      return el('div', { class: 'onair-row' }, [head, el('div', { class: 'onair-btns' }, buttons)]);
    }
    function btn(label, icon, onClick, cls) {
      var b = el('button', { class: 'btn btn-sm ' + (cls || ''), type: 'button' });
      if (icon) b.appendChild(window.Icon.el(icon, 13));
      b.appendChild(el('span', { text: label }));
      b.addEventListener('click', onClick);
      return b;
    }

    if (wcOn) {
      var wcVal = el('span', { class: 'onair-val', id: 'onAirWin', text: String((s.winCounter && s.winCounter.count) || 0) });
      host.appendChild(group(Tk.t('ตัวนับชัยชนะ'), wcVal, [
        btn('+1', 'plus', function () { wcCtrl('win'); }, 'btn-primary'),
        btn('−1', null, function () { wcCtrl('undo'); }),
        btn(Tk.t('รีเซ็ต'), 'reset', function () { wcCtrl('reset'); }, 'btn-ghost')
      ]));
    }
    if (timerOn) {
      var tVal = el('span', { class: 'onair-val', id: 'onAirTimer', text: $('#timerDisplay') ? $('#timerDisplay').textContent : '00:00' });
      host.appendChild(group('Subathon Timer', tVal, [
        btn(Tk.t('เริ่ม'), 'play', function () { invoke('timer:control', { cmd: 'start' }, { toast: false }); }),
        btn(Tk.t('พัก'), 'pause', function () { invoke('timer:control', { cmd: 'pause' }, { toast: false }); }),
        btn(Tk.t('+1 นาที'), 'plus', function () { invoke('timer:control', { cmd: 'add', payload: { seconds: 60 } }, { toast: false }); })
      ]));
    }
    if (wheelOn) {
      host.appendChild(group(Tk.t('สุ่มรางวัล (Roulette)'), null, [
        btn(Tk.t('สุ่มเลย'), 'sparkles', function () {
          invoke('wheel:spin', {}, { toast: false }).then(function (r) {
            if (r && r.label) toast(Tk.t('สุ่มได้: {label}', { label: r.label }), 'ok');
          });
        }, 'btn-primary')
      ]));
    }
    if (rwOn) {
      host.appendChild(group('Random Wheel', null, [
        btn(Tk.t('หมุนเลย'), 'sparkles', function () {
          invoke('randomWheel:spin', {}, { toast: false }).then(function (r) {
            if (r && r.label) toast(Tk.t('หมุนได้: {label}', { label: r.label }), 'ok');
          });
        }, 'btn-primary')
      ]));
    }
  }
  function wcCtrl(cmd) {
    invoke('winCounter:control', { cmd: cmd }, { toast: false }).then(function (st) { applyWinCounter(st); });
  }

  // ---------- ฟีดกิจกรรมสด (หน้าเดียวจบ — เดิมแยกเป็นแท็บ "เหตุการณ์สด" ที่ซ้ำกับภาพรวม) ----------
  // ค่าเริ่มต้น: ปิดไลค์ไว้ เพราะไลค์ยิงถี่มากจนของขวัญ/ผู้ติดตามหลุดจอภายในไม่กี่วินาที
  var FEED_TYPES = ['chat', 'gift', 'like', 'follow', 'share', 'subscribe', 'member'];
  var feedFilters = { chat: 1, gift: 1, like: 0, follow: 1, share: 1, subscribe: 1, member: 1 };
  try {
    var savedF = JSON.parse(localStorage.getItem('tk.feedFilters') || 'null');
    if (savedF) FEED_TYPES.forEach(function (t) { if (savedF[t] != null) feedFilters[t] = savedF[t] ? 1 : 0; });
  } catch (e) {}

  // ซ่อน/แสดงด้วยคลาสบนตัวฟีด → มีผลกับแถวที่แสดงอยู่แล้วทันที (เดิมกรองเฉพาะของใหม่)
  function applyFeedFilters() {
    var feed = $('#overviewFeed');
    if (!feed) return;
    FEED_TYPES.forEach(function (t) { feed.classList.toggle('hide-' + t, !feedFilters[t]); });
    try { localStorage.setItem('tk.feedFilters', JSON.stringify(feedFilters)); } catch (e) {}
    updateFeedEmpty();
  }

  // สถานะว่าง — บอกวิธีทำให้มีข้อมูล ไม่ใช่กล่องเปล่า
  // throttle ด้วย rAF: ตอนไลฟ์คึกคัก event เข้าหลายสิบครั้ง/วิ ถ้าอัปเดตทุกครั้งจะกิน CPU แย่งกับโปรแกรมไลฟ์
  var feedEmptyRaf = 0;
  function updateFeedEmpty() {
    if (feedEmptyRaf) return;
    feedEmptyRaf = requestAnimationFrame(function () { feedEmptyRaf = 0; doUpdateFeedEmpty(); });
  }
  function doUpdateFeedEmpty() {
    var feed = $('#overviewFeed'), hint = $('#ovFeedHint');
    if (!feed || !hint) return;
    // นับจากคลาสแทนการอ่าน offsetParent ของทุกแถว (offsetParent บังคับ layout reflow ทั้งฟีดทุกครั้ง)
    var total = feed.getElementsByClassName('ev').length;
    var shown = 0;
    FEED_TYPES.forEach(function (t) { if (feedFilters[t]) shown += feed.getElementsByClassName('ev ' + t).length; });
    if (total === 0) {
      hint.textContent = S.connection && S.connection.status === 'connected'
        ? Tk.t('เชื่อมต่อแล้ว — รอเหตุการณ์แรกจากไลฟ์')
        : Tk.t('ยังไม่มีเหตุการณ์ — เชื่อมต่อไลฟ์ หรือกดปุ่มทดสอบด้านขวา');
      hint.style.display = '';
    } else if (shown === 0) {
      hint.textContent = Tk.t('ตัวกรองซ่อนทุกเหตุการณ์อยู่ — เปิดชนิดที่ต้องการดู');
      hint.style.display = '';
    } else {
      hint.style.display = 'none';
    }
  }

  // วาดชิปตัวกรองฟีดใหม่ทั้งชุด (เรียกซ้ำได้ เช่นตอนสลับภาษา) — ล้างก่อนเสมอกันซ้อน
  function renderFeedFilters() {
    var host = $('#feedFilters');
    if (!host) return;
    host.innerHTML = '';
    FEED_TYPES.forEach(function (t) {
      var cb = el('input', { type: 'checkbox', value: t });
      cb.checked = !!feedFilters[t];
      cb.addEventListener('change', function () { feedFilters[t] = cb.checked ? 1 : 0; applyFeedFilters(); });
      host.appendChild(el('label', { class: 'feed-chip', title: Tk.t('แสดง/ซ่อน{name}', { name: Tk.t(FEED_LABEL[t]) }) }, [
        cb, el('span', { html: window.Icon.svg(EV_ICON[t] || 'info', 12) }), el('span', { text: Tk.t(FEED_LABEL[t]) })
      ]));
    });
    applyFeedFilters();
  }

  function bindFeedControls() {
    renderFeedFilters();
    var clr = $('#clearFeed');
    if (clr) clr.addEventListener('click', function () {
      $('#overviewFeed').innerHTML = '';
      updateFeedEmpty();
    });
  }
  var FEED_LABEL = { chat: 'แชท', gift: 'ของขวัญ', like: 'ไลค์', follow: 'ติดตาม', share: 'แชร์', subscribe: 'สมาชิก', member: 'เข้าห้อง' };

  var EV_ICON = { chat: 'chat', gift: 'gift', like: 'heart', follow: 'follow', share: 'share', subscribe: 'star', member: 'member' };
  function evDesc(type, d) {
    if (type === 'chat') return d.comment;
    if (type === 'gift') return Tk.t('ส่ง {gift} ×{n} · {d} เพชร', { gift: d.giftName || Tk.t('ของขวัญ'), n: d.repeatCount || 1, d: d.diamondTotal || 0 });
    if (type === 'like') return Tk.t('+{n} ไลค์', { n: d.likeCount || 0 });
    if (type === 'follow') return Tk.t('กดติดตาม');
    if (type === 'share') return Tk.t('แชร์ไลฟ์');
    if (type === 'subscribe') return Tk.t('สมัครสมาชิก');
    if (type === 'member') return Tk.t('เข้าห้อง');
    return '';
  }
  function buildEvRow(type, d, at) {
    var desc = evDesc(type, d);
    var children = [
      // แถวที่ถูกพักไว้ตอนไม่ได้เปิดแท็บ ต้องแสดงเวลาที่ "เกิดจริง" ไม่ใช่เวลาที่เพิ่งวาด
      el('span', { class: 'time', text: at || Tk.timeStr() }),
      el('span', { class: 'ico', html: window.Icon.svg(EV_ICON[type] || 'info', 12) })
    ];
    if (type !== 'like') children.push(Tk.avatar('av', d));
    children.push(el('span', { class: 'nm', text: d.nickname || d.uniqueId || '' }));
    if (type === 'gift' && d.giftPictureUrl) {
      var wrap = el('span', { class: 'desc' });
      wrap.appendChild(el('img', { class: 'gimg', src: d.giftPictureUrl }));
      wrap.appendChild(document.createTextNode(' ' + desc));
      children.push(wrap);
    } else {
      children.push(el('span', { class: 'desc', text: desc }));
    }
    return el('div', { class: 'ev ' + type }, children);
  }

  // ---------- ฟีดหน้าแรก ----------
  // เดิมสร้าง DOM ทุก event ไม่ว่าผู้ใช้จะเปิดแท็บไหนอยู่ — ไลฟ์ที่คนเยอะจะสร้างแถวใหม่
  // หลายสิบครั้งต่อวินาทีทิ้งลงกล่องที่ display:none อยู่ แล้วตัดทิ้งเมื่อเกิน 200 แถว
  // ตอนนี้พัก "ข้อมูล" ไว้เฉยๆ (ถูกกว่าสร้าง element มาก) แล้วค่อยวาดตอนเปิดแท็บ
  var feedPending = [];
  var FEED_MAX = 200;   // เท่ากับจำนวนแถวสูงสุดบนจอ เก็บมากกว่านี้ก็ถูกตัดทิ้งอยู่ดี

  function overviewOpen() {
    var t = $('#main .tab[data-tab="overview"]');
    return !!t && !t.hidden;
  }

  // เปิดแท็บกลับมา = วาดของที่พักไว้ทีเดียว แล้วล้างคิว
  function flushFeedPending() {
    if (!feedPending.length) return;
    var feed = $('#overviewFeed');
    if (!feed) { feedPending.length = 0; return; }
    var list = feedPending.slice(-FEED_MAX);
    feedPending.length = 0;
    var frag = document.createDocumentFragment();
    list.forEach(function (e) { frag.appendChild(buildEvRow(e.type, e.d, e.at)); });
    feed.appendChild(frag);
    while (feed.childNodes.length > FEED_MAX) feed.removeChild(feed.firstChild);
    feed.scrollTop = feed.scrollHeight;
    updateFeedEmpty();
  }

  function pushEvent(type, d) {
    if (type === 'chat' && !String(d.comment || '').trim()) return; // ข้ามแชทว่าง (สติกเกอร์/emote)
    if (!overviewOpen()) {
      feedPending.push({ type: type, d: d, at: Tk.timeStr() });
      if (feedPending.length > FEED_MAX) feedPending.splice(0, feedPending.length - FEED_MAX);
      return;
    }
    var feed = $('#overviewFeed');
    if (!feed) return;

    // ใหม่สุดอยู่ล่าง + เลื่อนตามให้เมื่อผู้ใช้ดูท้ายฟีดอยู่ (แบบเดียวกับหน้าต่างแชททั่วไป)
    // ถ้าผู้ใช้เลื่อนขึ้นไปอ่านย้อนหลัง จะไม่กระชากจอ
    var atBottom = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 48;
    feed.appendChild(buildEvRow(type, d));
    while (feed.childNodes.length > 200) feed.removeChild(feed.firstChild);
    if (atBottom) feed.scrollTop = feed.scrollHeight;
    updateFeedEmpty();
  }

  // ---------- โปรไฟล์ Actions (สลับชุดตามเกม) ----------
  // ชุดที่ใช้อยู่ = S.settings.actions (engine อ่านที่เดียว); ชุดอื่นเก็บใน actionProfiles[i].actions
  function activeProfile() {
    var list = S.settings.actionProfiles || [];
    return list.filter(function (p) { return p.id === S.settings.activeProfile; })[0] || list[0];
  }

  function renderProfileBar() {
    var sel = $('#profileSelect');
    var list = S.settings.actionProfiles || [];
    sel.innerHTML = '';
    list.forEach(function (p) {
      sel.appendChild(el('option', { value: p.id, text: p.name, selected: p.id === S.settings.activeProfile ? 'selected' : null }));
    });
  }

  function switchProfile(id) {
    if (id === S.settings.activeProfile) return;
    var list = S.settings.actionProfiles || [];
    var target = list.filter(function (p) { return p.id === id; })[0];
    if (!target) return;
    // เก็บชุดปัจจุบันกลับเข้าโปรไฟล์เดิม แล้วดึงชุดใหม่ขึ้นมาใช้
    var cur = activeProfile();
    if (cur) cur.actions = S.settings.actions || [];
    S.settings.actions = target.actions || [];
    delete target.actions; // ชุด active ไม่เก็บซ้ำในโปรไฟล์ (กันข้อมูลเบิ้ล)
    S.settings.activeProfile = id;
    saveSettings({ actionProfiles: list, activeProfile: id, actions: S.settings.actions }, true);
    renderActions();
    renderProfileBar();
    toast(Tk.t('สลับเป็นชุด "{name}" ({n} actions)', { name: target.name, n: (S.settings.actions || []).length }), 'ok');
  }

  function openProfileManager() {
    var list = S.settings.actionProfiles || [];
    var m;
    var host = el('div', {});

    function persistProfiles(extra) {
      saveSettings(Object.assign({ actionProfiles: list, activeProfile: S.settings.activeProfile }, extra || {}), true);
      renderProfileBar();
      renderRows();
    }

    function renderRows() {
      host.innerHTML = '';
      list.forEach(function (p, idx) {
        var isActive = p.id === S.settings.activeProfile;
        var count = isActive ? (S.settings.actions || []).length : (p.actions || []).length;
        var nameInp = el('input', { type: 'text', value: p.name });
        nameInp.addEventListener('change', function () {
          p.name = nameInp.value.trim() || Tk.t('ชุดไม่มีชื่อ');
          persistProfiles();
        });
        host.appendChild(el('div', { class: 'profile-row' + (isActive ? ' active' : '') }, [
          el('span', { class: 'profile-badge', text: isActive ? Tk.t('ใช้อยู่') : '' }),
          nameInp,
          el('span', { class: 'profile-count', text: count + ' actions' }),
          el('button', { class: 'btn btn-ghost btn-sm', text: Tk.t('ใช้ชุดนี้'), disabled: isActive ? 'disabled' : null, onclick: function () {
            m.close(); switchProfile(p.id);
          } }),
          el('button', { class: 'btn btn-danger btn-sm icon-btn', title: Tk.t('ลบชุดนี้'), disabled: list.length <= 1 ? 'disabled' : null, onclick: async function () {
            if (!(await Tk.confirmDialog(Tk.t('ลบชุด "{name}" ({n} actions) ?', { name: p.name, n: count }), Tk.t('ลบ')))) return;
            // อ้างด้วย id — index อาจเลื่อนถ้าเพิ่ม/ลบชุดอื่นระหว่างกล่องยืนยันเปิดค้าง
            var di = list.indexOf(p);
            if (di < 0) return;
            list.splice(di, 1);
            if (isActive) {
              // ลบชุดที่ใช้อยู่ → สลับไปชุดแรกที่เหลือ
              var nx = list[0];
              S.settings.actions = nx.actions || [];
              delete nx.actions;
              S.settings.activeProfile = nx.id;
              persistProfiles({ actions: S.settings.actions });
              renderActions();
            } else {
              persistProfiles();
            }
          } }, [window.Icon.el('trash', 13)])
        ]));
      });
    }

    function addProfile(copyCurrent) {
      // ชื่อที่บันทึกลงข้อมูลผู้ใช้ตั้งเป็นอังกฤษเสมอ ไม่ผ่าน Tk.t()
      // ถ้าแปลตามภาษาหน้าจอ ข้อมูลของคนคนเดียวจะปนสองภาษาเมื่อสลับภาษา
      // และตลาดหลักเป็นอังกฤษ — คนไทยเปลี่ยนชื่อเองได้ในช่องแก้ไข
      var p = { id: 'p_' + Date.now().toString(36), name: copyCurrent ? activeProfile().name + ' (copy)' : 'New set ' + (list.length + 1) };
      p.actions = copyCurrent
        ? JSON.parse(JSON.stringify(S.settings.actions || [])).map(function (a) { a.id = 'a_' + Math.random().toString(36).slice(2, 9); return a; })
        : [];
      list.push(p);
      persistProfiles();
    }

    renderRows();
    var body = el('div', {}, [
      el('h2', { text: Tk.t('จัดการชุด Actions') }),
      el('p', { class: 'muted small', text: Tk.t('แยกชุด Action ตามเกม/สถานการณ์ แล้วสลับได้จาก dropdown — เช่น "เกม A" กดปุ่มชุดหนึ่ง "คุยเฉยๆ" อีกชุดหนึ่ง') }),
      host,
      el('div', { class: 'profile-add-row' }, [
        el('button', { class: 'btn btn-ghost btn-sm', text: Tk.t('+ ชุดเปล่า'), onclick: function () { addProfile(false); } }),
        el('button', { class: 'btn btn-ghost btn-sm', text: Tk.t('+ คัดลอกจากชุดปัจจุบัน'), onclick: function () { addProfile(true); } })
      ]),
      el('div', { class: 'modal-foot' }, [
        el('button', { class: 'btn btn-primary', text: Tk.t('เสร็จสิ้น'), onclick: function () { m.close(); } })
      ])
    ]);
    m = Tk.modal(body);
  }

  // ---------- Actions ----------
  function persistActions() {
    invoke('settings:set', { patch: { actions: S.settings.actions } })
      .then(function () { renderActions(); toast(Tk.t('บันทึกแล้ว'), 'ok'); });
  }

  // อ้าง Action ด้วย id เสมอ — index ที่จับตอน render อาจเลื่อน/ถูกแทนที่ระหว่างรอผู้ใช้ยืนยัน (นำเข้า/สลับชุด)
  // แล้วจะลบ/บันทึกผิดตัว
  function indexOfActionId(id) {
    var list = (S.settings && S.settings.actions) || [];
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].id === id) return i;
    return -1;
  }
  // เปิดกล่องสร้าง Action ใหม่ — ใช้ร่วมกันทั้งปุ่มหัวหน้า ปุ่มใต้ลิสต์ และปุ่มใน empty state
  function createNewAction() {
    window.ActionsEditor.open(null, function (action) {
      S.settings.actions = S.settings.actions || [];
      S.settings.actions.push(action);
      persistActions();
    });
  }
  function deleteActionById(id) {
    var i = indexOfActionId(id);
    if (i < 0) { toast(Tk.t('รายการเปลี่ยนไปแล้ว — ไม่พบ Action ที่จะลบ'), 'warn'); renderActions(); return; }
    S.settings.actions.splice(i, 1);
    persistActions();
  }
  function saveActionById(id, updated) {
    var i = indexOfActionId(id);
    if (i < 0) (S.settings.actions = S.settings.actions || []).push(updated); // ถูกลบไประหว่างแก้ → เพิ่มกลับเป็นตัวใหม่
    else S.settings.actions[i] = updated;
    persistActions();
  }

  // ---------- Export / Import Actions ----------
  function exportActions() {
    if (!(S.settings.actions || []).length) { toast(Tk.t('ยังไม่มี Action ให้ส่งออก'), 'err'); return; }
    invoke('actions:export').then(function (r) {
      if (r && r.ok) toast(Tk.t('ส่งออก {n} Actions เป็นไฟล์แล้ว', { n: r.count }), 'ok', 3200);
    }).catch(function () {});
  }
  function importActions() {
    invoke('actions:import').then(function (r) {
      if (!r || !r.ok) return; // ผู้ใช้ยกเลิก
      var incoming = r.actions || [];
      if (!incoming.length) return;
      applyImportedActions(incoming, r.name);
    }).catch(function () {});
  }

  // ไฟล์ .tikkies แชร์กันในกลุ่มสตรีมเมอร์ = เนื้อหาที่ไม่น่าเชื่อถือ (ยิง webhook/กดปุ่มเข้าเครื่องได้)
  // ต้องกรองชนิดที่รู้จักเท่านั้น + บังคับ webhook เป็น http(s) ก่อนเขียนลง settings
  var VALID_TRIGGER = ['gift', 'chat', 'like', 'follow', 'share', 'subscribe', 'member', 'hotkey', 'wheelResult', 'randomWheelResult'];
  var VALID_RESP = ['alert', 'tts', 'sound', 'keypress', 'obs', 'webhook', 'wheel', 'randomWheel', 'timer', 'winCounter'];
  function sanitizeImportedResponses(list) {
    return (Array.isArray(list) ? list : []).map(function (r) {
      if (!r || VALID_RESP.indexOf(r.type) < 0) return null; // ตัด response ชนิดแปลกที่ไม่รู้จักทิ้ง
      if (r.type === 'webhook') {
        var u = String(r.url || '').trim();
        if (u && !/^https?:\/\//i.test(u)) return null; // ยิงได้เฉพาะ http(s) — กัน file:/javascript: หลุดเข้ามา
      }
      if (Array.isArray(r.branches)) { // กิ่งของวงล้อมี responses ซ้อน ต้องกรองลงไปด้วย
        r.branches = r.branches.map(function (b) {
          if (!b) return null;
          b.responses = sanitizeImportedResponses(b.responses);
          return b;
        }).filter(Boolean);
      }
      return r;
    }).filter(Boolean);
  }
  function respHasRisk(resps) {
    return (resps || []).some(function (r) {
      if (!r) return false;
      if (r.type === 'webhook' || r.type === 'keypress') return true;
      return Array.isArray(r.branches) && r.branches.some(function (b) { return b && respHasRisk(b.responses); });
    });
  }

  // ใช้ร่วมกันระหว่างนำเข้าจากไฟล์กับนำเข้าจากพรีเซ็ต — ถามโหมดแล้วเขียนลง settings
  // ชื่อชุดใหม่ = ชื่อพรีเซ็ต/ไฟล์ที่นำเข้า ถ้าซ้ำก็ต่อเลขให้
  // เป็นอังกฤษเสมอเมื่อไม่มีชื่อมาให้ (ดูเหตุผลที่ addProfile)
  function newSetName(base, profiles) {
    var name = String(base || '').trim().slice(0, 60) || 'Imported set';
    var taken = {};
    (profiles || []).forEach(function (p) { if (p && p.name) taken[p.name] = true; });
    if (!taken[name]) return name;
    for (var i = 2; i < 200; i++) { if (!taken[name + ' ' + i]) return name + ' ' + i; }
    return name + ' ' + Date.now().toString(36);
  }

  function applyImportedActions(incoming, fallbackName) {
    var clean = (incoming || []).map(function (a) {
      if (!a || !a.trigger || VALID_TRIGGER.indexOf(a.trigger.type) < 0) return null;
      var responses = sanitizeImportedResponses(a.responses);
      if (!responses.length) return null; // ไม่เหลือการกระทำที่ใช้ได้ → ข้าม
      return { name: a.name, enabled: a.enabled, cooldownSec: a.cooldownSec, trigger: a.trigger, responses: responses };
    }).filter(Boolean);
    if (!clean.length) { toast(Tk.t('ไฟล์นี้ไม่มี Action ที่ปลอดภัยให้นำเข้า'), 'err'); return; }
    var riskCount = clean.filter(function (a) { return respHasRisk(a.responses); }).length;
    askImportMode(clean.length, riskCount, function (mode) {
      if (!mode) return;
      var prepared = clean.map(function (a) {
        var risky = respHasRisk(a.responses);
        return {
          id: 'a_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          name: a.name || fallbackName || 'Imported action',
          // Action ที่ยิง webhook/กดปุ่ม ปิดไว้ก่อนโดยปริยาย ให้ผู้ใช้ตรวจแล้วเปิดเอง (กันไฟล์ที่แชร์มาทำงานทันที)
          enabled: risky ? false : (a.enabled !== false),
          cooldownSec: Number(a.cooldownSec) || 0,
          trigger: a.trigger,
          responses: a.responses
        };
      });
      var note = riskCount ? Tk.t(' ({n} รายการที่ยิง webhook/กดปุ่ม ถูกปิดไว้ก่อน — เปิดเองหลังตรวจ)', { n: riskCount }) : '';

      if (mode === 'newset') {
        // เก็บชุดที่ใช้อยู่กลับเข้าโปรไฟล์เดิมก่อน ไม่งั้นของเดิมหายตอนสลับ
        // (เดินตามขั้นตอนเดียวกับ switchProfile — ชุดที่ active จะไม่เก็บ actions ซ้ำในโปรไฟล์)
        var profiles = S.settings.actionProfiles || [];
        if (!Array.isArray(S.settings.actionProfiles)) S.settings.actionProfiles = profiles;
        var cur = activeProfile();
        // ไม่มีโปรไฟล์ให้เก็บของเดิม = ของเดิมจะหายทันทีที่ทับด้วยชุดใหม่
        // แกนรับประกันไว้แล้วว่ามีเสมอ (settings.js) แต่ถ้าหลุดมาถึงตรงนี้ต้องสร้างที่เก็บให้ก่อน
        // ยอมมีโปรไฟล์เกินมาหนึ่งอัน ดีกว่าทำ Actions ของผู้ใช้หายโดยไม่มีใครรู้
        if (!cur) {
          cur = { id: 'p_' + Date.now().toString(36) + 'x', name: 'Main' };
          profiles.push(cur);
        }
        cur.actions = S.settings.actions || [];
        var newName = newSetName(fallbackName, profiles);
        var np = { id: 'p_' + Date.now().toString(36), name: newName };
        profiles.push(np);
        S.settings.actions = prepared;
        S.settings.activeProfile = np.id;
        saveSettings({ actionProfiles: profiles, activeProfile: np.id, actions: prepared }, true);
        renderActions();
        renderProfileBar();
        toast(Tk.t('สร้างชุด "{name}" แล้ว ({n} Actions) — ชุดเดิมยังอยู่ครบ', { name: newName, n: prepared.length }) + note, 'ok', 4600);
        return;
      }

      S.settings.actions = (mode === 'replace') ? prepared : (S.settings.actions || []).concat(prepared);
      persistActions();
      toast((mode === 'replace' ? Tk.t('แทนที่ด้วย {n} Actions แล้ว', { n: prepared.length }) : Tk.t('เพิ่ม {n} Actions แล้ว', { n: prepared.length })) + note, 'ok', 4200);
    });
  }
  function askImportMode(count, riskCount, cb) {
    var m;
    var kids = [
      el('h2', { text: Tk.t('นำเข้า Actions') }),
      el('p', { class: 'muted', text: Tk.t('พบ {n} Action ในไฟล์ — ต้องการทำแบบไหน?', { n: count }) }),
      el('p', { class: 'muted small', style: 'margin-top:2px',
        text: Tk.t('สร้างเป็นชุดใหม่ = ของเดิมอยู่ครบ แล้วสลับไปมาได้จากรายการชุดด้านบน') })
    ];
    // เตือนชัดเจนเมื่อไฟล์มี Action ที่ยิงออกนอกเครื่อง/กดปุ่มเข้าเครื่อง — เป็นช่องทางโจมตีจากไฟล์ที่แชร์มา
    if (riskCount) kids.push(el('p', { class: 'auth-msg err', style: 'margin-top:0',
      text: Tk.t('⚠ {n} รายการมีการยิง webhook (ส่งข้อมูลออกนอกเครื่อง) หรือกดปุ่มเข้าเครื่อง — จะถูกปิดไว้ก่อน ตรวจให้แน่ใจก่อนเปิดใช้งาน', { n: riskCount }) }));
    var body = el('div', {}, kids.concat([
      el('div', { class: 'modal-foot' }, [
        el('button', { class: 'btn btn-ghost', text: Tk.t('ยกเลิก'), onclick: function () { m.close(); cb(null); } }),
        el('button', { class: 'btn', text: Tk.t('แทนที่ทั้งหมด'), onclick: function () { m.close(); cb('replace'); } }),
        el('button', { class: 'btn', text: Tk.t('เพิ่มต่อท้าย'), onclick: function () { m.close(); cb('append'); } }),
        // ทางที่ปลอดภัยที่สุด จึงเป็นปุ่มหลัก — ของเดิมไม่ถูกแตะเลย ไม่ชอบก็แค่ลบชุดทิ้ง
        el('button', { class: 'btn btn-primary', text: Tk.t('สร้างเป็นชุดใหม่'), onclick: function () { m.close(); cb('newset'); } })
      ])
    ]));
    m = Tk.modal(body);
  }

  // ---------- แท็บซื้อ/ต่ออายุ ----------
  // หน้าเลือกแพ็กเกจวาดด้วยหน้าตาของโปรแกรมเอง — ไม่ยัดหน้าเว็บเข้ามา
  // จะเปิดหน้าเว็บก็เฉพาะตอนกดจ่ายจริง ซึ่งเป็นหน้าของ Stripe (เลี่ยงไม่ได้ และควรเป็นหน้าจ่ายเงินจริงๆ)
  var plansCache = null;
  var billingRo = null;

  function billingRect() {
    var modal = $('#billingModal');
    var host = $('#billingHost');
    if (!modal || modal.hidden || !host) return null;
    var r = host.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return null;
    return { x: r.left, y: r.top, width: r.width, height: r.height };
  }

  // บอกด้วยว่ากำลังคุยกับเซิร์ฟเวอร์ไหน — เวลาสลับระหว่างเครื่องทดสอบกับของจริงจะได้รู้ทันทีว่ายิงผิดตัว
  function apiLabel() {
    var b = (S.auth && S.auth.apiBase) || '';
    return b ? Tk.t(' (เซิร์ฟเวอร์: {b})', { b: b }) : '';
  }

  function billingError(code) {
    if (code === 'not_logged_in') return Tk.t('ต้องเข้าสู่ระบบก่อนถึงจะซื้อได้');
    if (code === 'offline') return Tk.t('ต่อเซิร์ฟเวอร์ไม่ได้ — เช็คอินเทอร์เน็ตแล้วกดโหลดใหม่') + apiLabel();
    if (code === 'not_supported') return Tk.t('เซิร์ฟเวอร์ยังไม่รองรับการซื้อในโปรแกรม — ต้องอัปเดตเซิร์ฟเวอร์ก่อน') + apiLabel();
    if (code === 'site_not_configured') return Tk.t('ผู้ดูแลยังไม่ได้ตั้งที่อยู่เว็บชำระเงิน (SITE_URL)') + apiLabel();
    return Tk.t('เปิดหน้าชำระเงินไม่สำเร็จ — ลองกดโหลดใหม่') + apiLabel();
  }

  // ---- หน้าเลือกแพ็กเกจ ----
  function renderBilling(force) {
    showPlanPanel();
    // ดึงสถานะบัญชีล่าสุดก่อนวาด เผื่อเพิ่งซื้อจากที่อื่น
    invoke('auth:state', {}, { toast: false })
      .then(function (st) { S.auth = st; renderBillingStatus(); })
      .catch(function () {});
    renderBillingStatus();
    var grid = $('#planGrid');
    if (!grid) return;
    if (plansCache && !force) { paintPlans(plansCache); return; }

    grid.innerHTML = '';
    grid.appendChild(el('p', { class: 'muted', text: Tk.t('กำลังโหลดแพ็กเกจ…') }));
    invoke('billing:plans', {}, { toast: false }).then(function (r) {
      if (!r || !r.ok) {
        grid.innerHTML = '';
        grid.appendChild(el('p', { class: 'empty-state', text: billingError(r && r.error) }));
        return;
      }
      plansCache = r.plans || [];
      paintPlans(plansCache);
    }).catch(function () {
      grid.innerHTML = '';
      grid.appendChild(el('p', { class: 'empty-state', text: billingError() }));
    });
  }

  function renderBillingStatus() {
    var box = $('#billingStatus');
    if (!box) return;
    var sub = (S.auth && S.auth.subscription) || {};
    var left = sub.currentPeriodEnd
      ? Math.max(0, Math.ceil((new Date(sub.currentPeriodEnd).getTime() - Date.now()) / 86400000))
      : null;
    box.className = 'lic-lite' + (sub.active ? (left !== null && left <= 7 ? ' is-warn' : ' is-active') : '');
    box.innerHTML = '';
    if (sub.active && left !== null) {
      box.appendChild(el('b', { text: left <= 7 ? Tk.t('ใกล้หมดอายุ — เหลือ {n} วัน', { n: left }) : Tk.t('สมาชิกใช้งานได้ — เหลือ {n} วัน', { n: left }) }));
      box.appendChild(el('span', { class: 'sub', text: Tk.t('ถึง {date} · ซื้อเพิ่มแล้ววันจะทบให้', { date: fmtDay(sub.currentPeriodEnd) }) }));
    } else {
      box.appendChild(el('b', { text: Tk.t('ยังไม่มีสมาชิก') }));
      box.appendChild(el('span', { class: 'sub', text: Tk.t('เลือกแพ็กเกจด้านล่างเพื่อเริ่มใช้งาน') }));
    }
  }

  // locale ของวันที่/ตัวเลข ต้องตามภาษาที่ผู้ใช้เลือกในโปรแกรม ไม่ใช่ล็อกไทยตายตัว
  // (ไทยแสดงปี พ.ศ. อังกฤษแสดง ค.ศ. — ตั้งอังกฤษแล้วเห็น "6 ก.ย. 70" คืออ่านไม่ออกทั้งเดือนและปี)
  function billLocale() { return (Tk.i18n && Tk.i18n.current && Tk.i18n.current() === 'en') ? 'en-GB' : 'th-TH'; }
  function fmtDay(d) {
    try { return new Date(d).toLocaleDateString(billLocale(), { day: 'numeric', month: 'short', year: '2-digit' }); }
    catch (e) { return '—'; }
  }
  function fmtBaht(n) { return Number(n).toLocaleString(billLocale()); }

  // ชื่อแพ็กเกจ: เซิร์ฟเวอร์เก็บเป็นภาษาไทยชุดเดียว ("30 วัน", "1 ปี") ถ้าเอามาโชว์ตรงๆ
  // ตั้งโปรแกรมเป็นอังกฤษแล้วการ์ดจะยังเป็นไทย — สร้างชื่อเองจากจำนวนวันที่เซิร์ฟเวอร์ส่งมาแทน
  // จะได้แปลได้ทุกภาษาโดยไม่ต้องแก้ข้อมูลฝั่งเซิร์ฟเวอร์ (ไม่มี days ค่อยใช้ชื่อจากเซิร์ฟเวอร์)
  function planName(p) {
    var d = Number(p && p.days) || 0;
    if (!d) return (p && p.name) || '';
    if (d % 365 === 0) {
      var y = d / 365;
      return y === 1 ? Tk.t('1 ปี') : Tk.t('{n} ปี', { n: y });
    }
    return Tk.t('{n} วัน', { n: d });
  }

  function paintPlans(plans) {
    var grid = $('#planGrid');
    grid.innerHTML = '';
    if (!plans.length) {
      grid.appendChild(el('p', { class: 'empty-state', text: Tk.t('ยังไม่มีแพ็กเกจให้เลือกตอนนี้') }));
      return;
    }
    // ฐานเทียบ = แพ็กเกจที่แพงที่สุดต่อวัน เพื่อบอกว่าตัวยาวประหยัดกว่ากี่ %
    var base = 0;
    plans.forEach(function (p) { base = Math.max(base, p.priceTHB / p.days); });

    plans.forEach(function (p) {
      var perDay = p.priceTHB / p.days;
      var save = base > 0 ? Math.round((1 - perDay / base) * 100) : 0;
      var featured = p.badge === 'นิยมที่สุด';

      var card = el('div', { class: 'plan-card' + (featured ? ' is-featured' : '') });
      // ป้ายก็มาจากเซิร์ฟเวอร์เป็นไทย — ส่งผ่าน Tk.t ก่อน (ไม่มีคำแปลก็คืนข้อความเดิม ป้ายใหม่ๆ จึงไม่พัง)
      if (p.badge) card.appendChild(el('span', { class: 'plan-badge', text: Tk.t(p.badge) }));
      card.appendChild(el('div', { class: 'plan-name', text: planName(p) }));
      card.appendChild(el('div', { class: 'plan-price' }, [
        el('b', { text: fmtBaht(p.priceTHB) }),
        el('span', { text: Tk.t('บาท') })
      ]));
      var meta = el('div', { class: 'plan-meta', text: Tk.t('วันละ {n} บาท', { n: perDay.toFixed(1) }) });
      if (save > 0) meta.appendChild(el('span', { class: 'save', text: Tk.t('ประหยัด {n}%', { n: save }) }));
      card.appendChild(meta);
      card.appendChild(el('button', {
        class: 'btn ' + (featured ? 'btn-primary' : ''),
        text: Tk.t('เลือกแพ็กเกจนี้'),
        onclick: function () { startPayment(p); }
      }));
      grid.appendChild(card);
    });
  }

  // ---- ขั้นจ่ายเงิน: เปิดหน้า Stripe ในกรอบ ----
  var payOpening = false; // กันดับเบิลคลิกปุ่มแพ็กเกจ — เปิดหน้าชำระซ้อนกันจะรีเซ็ตข้อมูลที่กรอกและสร้าง checkout session ค้าง
  function startPayment(plan) {
    if (payOpening) return;
    payOpening = true;
    payLoading();
    $('#payTitle').textContent = planName(plan);
    $('#paySubtitle').textContent =
      fmtBaht(plan.priceTHB) + Tk.t(' บาท · ใช้ได้ {n} วัน (ทบต่อจากวันที่เหลือ)', { n: plan.days });
    $('#billingModal').hidden = false;
    lastFocus = document.activeElement;
    document.addEventListener('keydown', payKeydown);
    $('#billingCloseBtn').focus();

    var bounds = billingRect();
    invoke('billing:show', {
      bounds: bounds,
      next: '/billing/pay?plan=' + encodeURIComponent(plan.code),
      reload: true
    }, { toast: false }).then(function (r) {
      payOpening = false; // หน้าเปิดแล้ว ปลดล็อกให้เปิดแพ็กเกจอื่นได้
      if (r && r.ok) { watchBillingBounds(); return; }
      payMsg(billingError(r && r.error));
    }).catch(function () {
      payOpening = false;
      payMsg(billingError());
    });
  }

  // main ดักตอนกลับจาก Stripe แล้วสั่งมา — ผู้ใช้ไม่เห็นหน้าเว็บเลย เห็นแต่หน้าของโปรแกรม
  function onBillingDone(d) {
    showPlanPanel();
    renderBillingStatus();
    if (d && d.canceled) { toast(Tk.t('ยกเลิกการชำระเงินแล้ว — ยังไม่มีการตัดเงิน'), 'warn', 4000); return; }
    // Stripe redirect กลับมา = "รับคำสั่งแล้ว" ยังไม่ใช่ "เงินเข้าแล้ว" โดยเฉพาะ PromptPay ที่ยืนยันช้า/อาจล้มเหลว
    // อย่าประกาศว่าจ่ายสำเร็จจนกว่าจะเห็น subscription.active จริงจาก auth:me
    toast(Tk.t('กำลังตรวจสอบสถานะการชำระเงิน…'), '', 4000);
    var tries = 0;
    (function poll() {
      invoke('auth:me', {}, { toast: false }).then(function (r) {
        renderBillingStatus();
        if (r && r.subscription && r.subscription.active) { toast(Tk.t('ชำระเงินสำเร็จ — อัปเดตวันคงเหลือแล้ว'), 'ok', 4000); return; }
        if (++tries < 5) { setTimeout(poll, tries < 2 ? 2500 : 6000); return; }
        // ยังไม่ active หลังรอพอสมควร — PromptPay อาจใช้เวลา หรืออาจไม่สำเร็จ (แยกกรณีชัด ๆ ต้องถาม order.status จากเซิร์ฟเวอร์)
        toast(Tk.t('ยังไม่พบการชำระเงินเข้า — ถ้าจ่ายผ่าน PromptPay อาจใช้เวลาสักครู่ วันจะเข้าอัตโนมัติเมื่อยืนยันแล้ว กด "ตรวจสอบสถานะ" ในแท็บบัญชีได้'), 'warn', 9000);
      }).catch(function () { if (++tries < 5) setTimeout(poll, 3000); });
    })();
  }

  // เว็บของเราตอบ error ระหว่างจ่ายเงิน — ปิด modal แล้วบอกสาเหตุที่ทำอะไรต่อได้
  function onBillingFailed(d) {
    closePayModal();
    var status = (d && d.status) || 0;
    var host = '';
    try { host = new URL(d.url).origin; } catch (e) {}
    var msg = status === 404
      ? Tk.t('หน้าชำระเงินไม่มีอยู่ที่ {host} — ที่อยู่เว็บ (SITE_URL) ชี้ผิดเว็บ หรือเว็บยังไม่ได้อัปเดต', { host: host })
      : Tk.t('หน้าชำระเงินตอบกลับผิดพลาด ({status}) ที่ {host}', { status: status, host: host });
    toast(msg, 'err', 8000);
    logStatus({ level: 'error', msg: msg });
  }

  var lastFocus = null;

  // Esc ปิด · Tab วนอยู่แค่ปุ่มในกล่อง (หน้า Stripe เป็นอีก process โฟกัสข้ามกันไม่ได้อยู่แล้ว)
  function payLoading() {
    var box = $('#billingMsg');
    if (!box) return;
    box.innerHTML = '';
    box.appendChild(el('span', { class: 'pay-spinner', 'aria-hidden': 'true' }));
    box.appendChild(document.createTextNode(Tk.t('กำลังเปิดหน้าชำระเงิน…')));
  }

  // เขียนข้อความในกรอบ (ลบสปินเนอร์ทิ้งเมื่อไม่ได้กำลังโหลดแล้ว)
  function payMsg(text) {
    var box = $('#billingMsg');
    if (box) { box.innerHTML = ''; box.appendChild(document.createTextNode(text)); }
  }

  function payKeydown(e) {
    if (e.key === 'Escape') { closePayModal(); return; }
    if (e.key !== 'Tab') return;
    var items = [$('#billingCloseBtn'), $('#billingCancelBtn')];
    var i = items.indexOf(document.activeElement);
    e.preventDefault();
    items[(i + (e.shiftKey ? items.length - 1 : 1) + items.length) % items.length].focus();
  }

  // ปิด modal — ต้องซ่อนหน้าเว็บก่อน ไม่งั้นมันลอยค้างอยู่บนหน้าจอ (WebContentsView อยู่เหนือ DOM เสมอ)
  function closePayModal() {
    payOpening = false; // ปิดแล้วต้องเปิดแพ็กเกจใหม่ได้เสมอ แม้ billing:show ค้างไม่ตอบกลับ
    document.removeEventListener('keydown', payKeydown);
    if (billingRo) { billingRo.disconnect(); billingRo = null; }
    invoke('billing:hide', {}, { toast: false }).catch(function () {});
    var m = $('#billingModal');
    if (m) m.hidden = true;
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
    lastFocus = null;
  }

  function showPlanPanel() {
    closePayModal();
    var panel = $('#billingPanel');
    if (panel) panel.hidden = false;
  }

  function hideBillingView() { closePayModal(); }

  // ย่อ/ขยายหน้าต่างแล้วกรอบขยับ ต้องส่งขนาดใหม่ให้ main ไม่งั้นหน้าเว็บจะไม่ตามกรอบ
  function watchBillingBounds() {
    if (billingRo) return;
    var host = $('#billingHost');
    if (!host || typeof ResizeObserver === 'undefined') return;
    var push = function () {
      var b = billingRect();
      if (b) invoke('billing:bounds', { bounds: b }, { toast: false }).catch(function () {});
    };
    billingRo = new ResizeObserver(push);
    billingRo.observe(host);
    window.addEventListener('resize', push);
  }

  // ---------- พรีเซ็ตสำเร็จรูป (ทางร้านทำไว้บนเว็บ) ----------
  var presetsCache = null; // โหลดครั้งเดียวต่อการเปิดแอป กดโหลดใหม่ได้

  function renderPresets(force) {
    var grid = $('#presetsGrid');
    if (!grid) return;
    if (presetsCache && !force) { paintPresets(presetsCache); return; }

    grid.innerHTML = '';
    grid.appendChild(el('p', { class: 'muted', text: Tk.t('กำลังโหลดพรีเซ็ต…') }));
    invoke('presets:list', {}, { toast: false }).then(function (r) {
      if (!r || !r.ok) { paintPresetsError(r && r.error); return; }
      presetsCache = r.presets || [];
      paintPresets(presetsCache);
    }).catch(function () { paintPresetsError('server_error'); });
  }

  function paintPresetsError(code) {
    var msg = code === 'not_logged_in' ? Tk.t('ต้องเข้าสู่ระบบก่อนถึงจะเห็นพรีเซ็ต')
      : code === 'offline' ? Tk.t('ต่อเซิร์ฟเวอร์ไม่ได้ — เช็คอินเทอร์เน็ตแล้วกดโหลดใหม่')
      : code === 'not_supported' ? Tk.t('เซิร์ฟเวอร์ยังไม่รองรับพรีเซ็ต — ต้องอัปเดตเซิร์ฟเวอร์ก่อน')
      : Tk.t('โหลดพรีเซ็ตไม่สำเร็จ ลองกดโหลดใหม่อีกครั้ง');
    var grid = $('#presetsGrid');
    grid.innerHTML = '';
    grid.appendChild(el('p', { class: 'empty-state', text: msg }));
  }

  function paintPresets(list) {
    var grid = $('#presetsGrid');
    grid.innerHTML = '';
    if (!list.length) {
      grid.appendChild(el('p', { class: 'empty-state', text: Tk.t('ยังไม่มีพรีเซ็ตให้เลือกตอนนี้ — เดี๋ยวเราทยอยเพิ่มให้ครับ') }));
      return;
    }
    list.forEach(function (p) {
      var cover = p.imageUrl
        ? el('img', { class: 'preset-cover', src: p.imageUrl, alt: '', loading: 'lazy' })
        : el('div', { class: 'preset-cover preset-cover-empty', html: window.Icon.svg('sparkles', 26) });

      var head = el('div', { class: 'preset-head' }, [
        el('span', { class: 'preset-name', text: p.name })
      ]);
      if (p.badge) head.appendChild(el('span', { class: 'preset-badge', text: p.badge }));

      grid.appendChild(el('div', { class: 'preset-card' }, [
        cover,
        el('div', { class: 'preset-body' }, [
          head,
          el('p', { class: 'preset-desc', text: p.description || (p.gameName || '') }),
          el('div', { class: 'preset-foot' }, [
            el('span', { class: 'preset-count', text: Tk.t('{n} กฎ', { n: p.actionCount }) }),
            el('button', {
              class: 'btn btn-sm btn-primary', text: Tk.t('นำเข้า'),
              onclick: function (e) { importPreset(p, e.currentTarget); }
            })
          ])
        ])
      ]));
    });
  }

  function importPreset(p, btn) {
    btn.disabled = true;
    btn.textContent = Tk.t('กำลังโหลด…');
    invoke('presets:get', { id: p.id }, { toast: false }).then(function (r) {
      btn.disabled = false;
      btn.textContent = Tk.t('นำเข้า');
      if (!r || !r.ok) {
        toast(r && r.error === 'offline' ? Tk.t('ต่อเซิร์ฟเวอร์ไม่ได้') : Tk.t('โหลดพรีเซ็ตนี้ไม่สำเร็จ'), 'err');
        return;
      }
      var incoming = (r.actions || []).filter(function (a) {
        return a && a.trigger && a.trigger.type && Array.isArray(a.responses);
      });
      if (!incoming.length) { toast(Tk.t('พรีเซ็ตนี้ไม่มี Action ที่ใช้งานได้'), 'err'); return; }
      applyImportedActions(incoming, p.name);
    }).catch(function () {
      btn.disabled = false;
      btn.textContent = Tk.t('นำเข้า');
      toast(Tk.t('โหลดพรีเซ็ตนี้ไม่สำเร็จ'), 'err');
    });
  }

  // เทมเพลตยอดฮิต — กดเดียวเพิ่ม action แล้วแก้ต่อได้
  // label = ป้ายบนปุ่ม (แปลตามภาษาหน้าจอได้)
  // ส่วนที่ make() คืนออกมาคือ "ข้อมูลที่จะถูกบันทึก" จึงเป็นอังกฤษเสมอ ไม่ผ่าน Tk.t()
  var ACTION_TEMPLATES = [
    { icon: 'gift', label: 'ได้ Rose → เสียง + แจ้งเตือน',
      make: function () { return { name: 'Thank Rose senders', trigger: { type: 'gift', giftName: 'Rose', minDiamonds: 0 }, responses: [{ type: 'alert', text: '{nickname} sent a Rose!', durationSec: 6 }, { type: 'sound', url: '', volume: 1 }] }; } },
    { icon: 'heart', label: 'ครบทุก 1,000 ไลค์ → แจ้งเตือน',
      make: function () { return { name: 'Celebrate every 1,000 likes', trigger: { type: 'like', likeThreshold: 1000 }, responses: [{ type: 'alert', text: '{likeCount} likes reached!', durationSec: 6 }] }; } },
    { icon: 'follow', label: 'ผู้ติดตามใหม่ → อ่านชื่อ',
      make: function () { return { name: 'Welcome new followers', trigger: { type: 'follow' }, responses: [{ type: 'tts', text: 'Thanks for following, {nickname}' }] }; } },
    { icon: 'keyboard', label: 'แชท !jump → กด Space ในเกม',
      make: function () { return { name: 'Jump in game', trigger: { type: 'chat', keyword: '!jump' }, responses: [{ type: 'keypress', key: 'space', modifiers: [], holdMs: 0 }] }; } },
    { icon: 'gift', label: 'ของขวัญใหญ่ (≥100 เพชร) → แจ้งเตือน',
      make: function () { return { name: 'Big gift', trigger: { type: 'gift', giftName: '', minDiamonds: 100 }, responses: [{ type: 'alert', text: '{nickname} sent {giftName} — {diamondTotal} diamonds!', durationSec: 8 }, { type: 'sound', url: '', volume: 1 }] }; } },
    { icon: 'share', label: 'มีคนแชร์ไลฟ์ → ขอบคุณ',
      make: function () { return { name: 'Thank people who share', trigger: { type: 'share' }, responses: [{ type: 'tts', text: 'Thanks for sharing, {nickname}' }] }; } }
  ];
  function renderTemplates() {
    var host = $('#actionTemplates');
    if (!host) return;
    host.innerHTML = '';
    ACTION_TEMPLATES.forEach(function (tpl) {
      var chip = el('button', { class: 'template-chip' }, [window.Icon.el(tpl.icon, 15), el('span', { text: Tk.t(tpl.label) })]);
      chip.addEventListener('click', function () {
        var a = tpl.make();
        a.id = 'a_' + Date.now().toString(36);
        a.enabled = true;
        a.cooldownSec = a.cooldownSec || 0;
        S.settings.actions = S.settings.actions || [];
        S.settings.actions.push(a);
        persistActions();
        toast(Tk.t('เพิ่ม "{name}" แล้ว — กดแก้ไขเพื่อปรับ', { name: a.name }), 'ok', 3200);
      });
      host.appendChild(chip);
    });
  }

  function triggerSummary(a) {
    var t = a.trigger || {};
    switch (t.type) {
      case 'gift': return (t.giftName ? (Tk.t('เมื่อได้รับ {gift}', { gift: t.giftName }) + (t.minDiamonds ? Tk.t(' (≥{n}💎)', { n: t.minDiamonds }) : '')) : Tk.t('เมื่อได้รับของขวัญใดๆ') + (t.minDiamonds ? Tk.t(' (≥{n}💎)', { n: t.minDiamonds }) : ''))
        + (t.minRepeat > 1 ? Tk.t(' · คอมโบ x{n}+', { n: t.minRepeat }) : '');
      case 'topChange': return Tk.t('เมื่อมีคนแซงขึ้น Top 1');
      case 'goalReached': return t.goal ? Tk.t('เมื่อเป้า{goal}ถึงเป้า', { goal: Tk.t(GOAL_LABEL[t.goal] || t.goal) }) : Tk.t('เมื่อเป้าหมายใดก็ได้ถึงเป้า');
      case 'chat': return t.keyword ? Tk.t('เมื่อแชทมี "{kw}"', { kw: t.keyword }) : Tk.t('เมื่อมีข้อความแชท');
      case 'like': return t.likeMode === 'perUser'
        ? Tk.t('เมื่อผู้ชมคนหนึ่งกดครบทุกๆ {n} ไลค์', { n: t.likeThreshold || 0 })
        : Tk.t('เมื่อยอดไลค์รวมครบทุกๆ {n} ไลค์', { n: t.likeThreshold || 0 });
      case 'follow': return Tk.t('เมื่อมีผู้ติดตามใหม่');
      case 'share': return Tk.t('เมื่อมีคนแชร์');
      case 'subscribe': return Tk.t('เมื่อมีสมาชิกใหม่');
      case 'member': return Tk.t('เมื่อมีคนเข้าห้อง');
      case 'hotkey': return Tk.t('เมื่อกดคีย์ {key}', { key: t.accelerator ? accelLabelApp(t.accelerator) : Tk.t('(ยังไม่ตั้ง)') });
      case 'wheelResult': return t.prize ? Tk.t('เมื่อ Roulette ออก "{prize}"', { prize: t.prize }) : Tk.t('เมื่อ Roulette สุ่มออก (ทุกช่อง)');
      case 'randomWheelResult': return t.prize ? Tk.t('เมื่อ Random Wheel ออก "{prize}"', { prize: t.prize }) : Tk.t('เมื่อ Random Wheel หมุนออก (ทุกช่อง)');
      default: return t.type || '';
    }
  }
  var RESP_ICON = { alert: 'bell', tts: 'tts', sound: 'music', keypress: 'keyboard', obs: 'video', webhook: 'webhook', wheel: 'sparkles', randomWheel: 'sparkles', timer: 'timer', winCounter: 'trophy' };

  // ---- meta สำหรับแสดงผลการ์ด/โหนด ----
  var GOAL_LABEL = { likes: 'ไลก์', diamonds: 'เพชร', followers: 'ผู้ติดตาม' };
  var TRIG_META = {
    gift: { icon: 'gift', label: 'ของขวัญ', color: '#fe2c55' },
    chat: { icon: 'chat', label: 'แชท', color: '#25c1c9' },
    like: { icon: 'heart', label: 'ไลค์', color: '#f0466a' },
    follow: { icon: 'follow', label: 'ติดตาม', color: '#3ecf8e' },
    share: { icon: 'share', label: 'แชร์', color: '#5b93cc' },
    subscribe: { icon: 'star', label: 'สมาชิก', color: '#f0c060' },
    member: { icon: 'member', label: 'เข้าห้อง', color: '#7b5bd6' },
    hotkey: { icon: 'keyboard', label: 'คีย์ลัด', color: '#e0904a' },
    wheelResult: { icon: 'sparkles', label: 'Roulette ออกผล', color: '#c9a6ff' },
    randomWheelResult: { icon: 'sparkles', label: 'Random Wheel ออกผล', color: '#7fd4ff' },
    topChange: { icon: 'crown', label: 'Top 1 เปลี่ยนคน', color: '#e8b04a' },
    goalReached: { icon: 'goals', label: 'ถึงเป้าหมาย', color: '#4ab4fa' }
  };
  var RESP_META = {
    alert: { icon: 'bell', label: 'แจ้งเตือน' }, tts: { icon: 'tts', label: 'อ่านออกเสียง' },
    sound: { icon: 'music', label: 'เล่นเสียง' }, keypress: { icon: 'keyboard', label: 'กดปุ่ม' },
    obs: { icon: 'video', label: 'สั่ง OBS' }, webhook: { icon: 'webhook', label: 'Webhook' },
    wheel: { icon: 'sparkles', label: 'สุ่มรางวัล (Roulette)' },
    randomWheel: { icon: 'sparkles', label: 'หมุน Random Wheel' },
    timer: { icon: 'timer', label: 'Timer' },
    winCounter: { icon: 'trophy', label: 'ตัวนับชัยชนะ' },
    minecraft: { icon: 'server', label: 'สั่งคำสั่ง Minecraft' },
    video: { icon: 'video', label: 'เล่นวิดีโอ' },
    delay: { icon: 'clock', label: 'หน่วงเวลา' },
    random: { icon: 'share', label: 'สุ่มทาง' },
    if: { icon: 'filter', label: 'ถ้า…' }
  };

  // แคตตาล็อกของขวัญ (ชื่อ→{image,coins}) — โหลดครั้งเดียว ใช้โชว์รูปบนการ์ด/โหนด
  var giftCatalog = null;
  var giftById = {};
  function loadGiftCatalog() {
    // โหลดครั้งเดียวพอ — แคตตาล็อกมี ~8,800 ชิ้น ดึงผ่าน IPC ซ้ำทุกครั้งที่เปิดตัวเลือกของขวัญจะทำ UI สะดุด
    if (giftCatalog) return Promise.resolve();
    return invoke('gifts:list', {}, { toast: false }).then(function (list) {
      giftCatalog = {};
      giftById = {};
      // ชื่อซ้ำกันได้หลายตัว (Hand Heart 3 id, Cat 13 id) และแต่ละตัวรูปไม่เหมือนกัน
      // map ตามชื่อจึงเก็บได้แค่ตัวสุดท้าย — ใช้เป็นทางสำรองเท่านั้น ของหลักคือ map ตาม id
      (list || []).forEach(function (g) {
        giftCatalog[g.name.toLowerCase()] = g;
        if (g.id != null) giftById[g.id] = g;
      });
    }).catch(function () { giftCatalog = {}; giftById = {}; });
  }
  // หาด้วย id ก่อนเสมอ ค่อยตกไปที่ชื่อ — Action เก่าที่บันทึกไว้ก่อนมี giftId จะไม่มี id
  // ต้องยังหารูปได้อยู่ ไม่งั้นของเดิมของผู้ใช้จะกลายเป็นไอคอนเปล่าหมด
  function giftInfo(name, id) {
    if (!giftCatalog) return null;
    if (id && giftById[id]) return giftById[id];
    return name ? (giftCatalog[String(name).toLowerCase()] || null) : null;
  }

  // Action ที่ยังตั้งค่าไม่ครบ = ทำงานจริงไม่ได้ (เสียงไม่มีไฟล์/กดปุ่มไม่มีคีย์ ฯลฯ) — ติดป้ายเตือนบนการ์ด
  function actionIncomplete(a) {
    function bad(resps) {
      return (resps || []).some(function (r) {
        if (!r) return false;
        if (r.type === 'sound' && !String(r.url || '').trim()) return true;
        if (r.type === 'keypress' && !r.key) return true;
        if (r.type === 'webhook' && !String(r.url || '').trim()) return true;
        return Array.isArray(r.branches) && r.branches.some(function (b) { return b && bad(b.responses); });
      });
    }
    if (a && a.trigger && a.trigger.type === 'hotkey' && !a.trigger.accelerator) return true;
    return bad(a && a.responses);
  }

  // แสดงเป็นคำแบบ Windows (Ctrl/Alt/Shift/Win) ไม่ใช่สัญลักษณ์ Mac
  var KEY_SYM = { cmd: 'Win', ctrl: 'Ctrl', alt: 'Alt', shift: 'Shift' };
  function accelLabelApp(acc) {
    var W = { Super: 'Win', Command: 'Win', CommandOrControl: 'Ctrl', Control: 'Ctrl', Alt: 'Alt', Option: 'Alt', Shift: 'Shift' };
    return String(acc).split('+').map(function (p) { return W[p] || p; }).join('+');
  }
  function respLabel(r) {
    if (r.type === 'keypress') {
      if (!r.key) return Tk.t('กดปุ่ม (ยังไม่ตั้ง)');
      var mods = (r.modifiers || []).map(function (m) { return KEY_SYM[m] || m; });
      return Tk.t('กด {keys}', { keys: mods.concat([r.key.toUpperCase()]).join('+') });
    }
    if (r.type === 'wheel' || r.type === 'randomWheel') {
      var base = r.type === 'wheel' ? Tk.t('สุ่มรางวัล') : Tk.t('หมุน Random Wheel');
      var nb = (r.branches || []).filter(function (b) { return b && (b.responses || []).length; }).length;
      return nb ? Tk.t('{base} ({n} กิ่ง)', { base: base, n: nb }) : base;
    }
    if (r.type === 'winCounter') {
      if (r.wcCmd === 'reset') return Tk.t('ตัวนับ: รีเซ็ต');
      if (r.wcCmd === 'set') return Tk.t('ตัวนับ = {n}', { n: (r.wcAmount != null ? r.wcAmount : 0) });
      var n = Number(r.wcAmount != null ? r.wcAmount : 1);
      return Tk.t('ตัวนับ {v}', { v: (n >= 0 ? '+' : '') + n });
    }
    if (r.type === 'timer') {
      if ((r.timerCmd || 'add') === 'add') return Tk.t('เวลา {v} วิ', { v: ((r.seconds >= 0 ? '+' : '') + (r.seconds != null ? r.seconds : 60)) });
      return 'Timer: ' + ({ start: Tk.t('เริ่ม'), pause: Tk.t('พัก'), reset: Tk.t('รีเซ็ต') }[r.timerCmd] || r.timerCmd);
    }
    if (r.type === 'obs') return r.obsAction === 'toggleSource' ? Tk.t('OBS: ซ่อน/แสดง') : Tk.t('OBS: เปลี่ยนซีน');
    if (r.type === 'delay') return Tk.t('รอ {n} วิ', { n: Math.round((Number(r.ms) || 0) / 100) / 10 });
    if (r.type === 'random') return Tk.t('สุ่ม {n} ทาง', { n: (r.branches || []).length });
    if (r.type === 'if') return Tk.t('ถ้า') + ' ' + window.ActionsEditor.condLabel(r.cond);
    return Tk.t((RESP_META[r.type] || { label: r.type }).label);
  }

  // โหนดเหตุการณ์ (icon สี + รูปของขวัญถ้ามี + ข้อความสรุป)
  function triggerNodeEl(a) {
    var t = a.trigger || {};
    var meta = TRIG_META[t.type] || { icon: 'info', label: t.type, color: 'var(--accent)' };
    var kids = [el('span', { class: 'tn-ico', style: 'color:' + meta.color }, [window.Icon.el(meta.icon, 15)])];
    if (t.type === 'gift' && t.giftName) {
      var g = giftInfo(t.giftName, t.giftId);
      if (g && g.image) kids.push(el('img', { class: 'tn-img', src: g.image, alt: '', loading: 'lazy' }));
    }
    kids.push(el('span', { class: 'tn-label', text: triggerSummary(a) }));
    return el('div', { class: 'trig-node', style: '--tc:' + meta.color }, kids);
  }
  // แถวชิปยาวเกิน 3 อันดันการ์ดสูงจนลิสต์ยาวมองไม่เห็นภาพรวม
  // โชว์ 3 อันแรกพอ ที่เหลือยุบเป็น "+N" — กดแล้วกางในที่เดิม ไม่ต้องเปิดหน้าแก้ไข
  var CHIP_LIMIT = 3;
  function respChip(r) {
    var m = RESP_META[r.type] || { icon: 'info' };
    return el('span', { class: 'resp-chip' }, [window.Icon.el(m.icon, 12), el('span', { text: respLabel(r) })]);
  }
  function respChipsEl(a) {
    var rs = a.responses || [];
    if (!rs.length) return el('div', { class: 'resp-chips' }, [el('span', { class: 'resp-chip empty', text: Tk.t('ยังไม่มีการกระทำ') })]);
    var box = el('div', { class: 'resp-chips' }, rs.slice(0, CHIP_LIMIT).map(respChip));
    var rest = rs.length - CHIP_LIMIT;
    if (rest > 0) {
      var more = el('button', {
        class: 'resp-chip more', type: 'button',
        title: Tk.t('ดูการกระทำที่เหลือ'), 'data-i18n-title': 'ดูการกระทำที่เหลือ',
        text: Tk.t('+ อีก {n}', { n: rest })
      });
      more.addEventListener('click', function (e) {
        e.stopPropagation();
        box.removeChild(more);
        rs.slice(CHIP_LIMIT).forEach(function (r) { box.appendChild(respChip(r)); });
      });
      box.appendChild(more);
    }
    return box;
  }

  // ---------- ลูกโซ่ระหว่าง Action ----------
  // ในแอปมีการต่อกันแบบเดียว: action ที่ "สั่งสุ่มรางวัล" → action ที่ trigger เป็น "เมื่อสุ่มรางวัลออก"
  // เดิมสองอันนี้ถูกวาดเป็นเกาะแยกกัน ผู้ใช้จึงมองไม่ออกว่ามันต่อกันอยู่
  // Roulette กับ Random Wheel เป็นคนละสาย — สั่ง Roulette แล้วต้องไปเข้า trigger ของ Roulette เท่านั้น
  var WHEEL_RESULT_OF = { wheel: 'wheelResult', randomWheel: 'randomWheelResult' };
  // ชนิดวงล้อที่ action นี้สั่งหมุน (คืนเป็นลิสต์ — action เดียวสั่งได้ทั้งสองวง)
  function spunKinds(a) {
    var kinds = [];
    (a.responses || []).forEach(function (r) {
      if (r && WHEEL_RESULT_OF[r.type] && kinds.indexOf(r.type) < 0) kinds.push(r.type);
    });
    return kinds;
  }
  function spinsWheel(a) { return spunKinds(a).length > 0; }
  function catchesPrize(a, prize) {
    var t = a.trigger || {};
    if (t.type !== 'wheelResult' && t.type !== 'randomWheelResult') return false;
    return !t.prize || !prize || t.prize === prize;
  }
  // action ที่ "เกิดต่อจาก" a
  function nextInChain(a, all) {
    var kinds = spunKinds(a);
    if (!kinds.length) return [];
    var wants = kinds.map(function (k) { return WHEEL_RESULT_OF[k]; });
    return all.filter(function (b) { return b !== a && b.trigger && wants.indexOf(b.trigger.type) >= 0; });
  }
  // action ที่ "ทำให้ a เกิด"
  function prevInChain(a, all) {
    var t = a.trigger || {};
    var kind = t.type === 'wheelResult' ? 'wheel' : (t.type === 'randomWheelResult' ? 'randomWheel' : null);
    if (!kind) return [];
    return all.filter(function (b) { return b !== a && spunKinds(b).indexOf(kind) >= 0; });
  }

  function chainRow(a, all) {
    var prev = prevInChain(a, all), next = nextInChain(a, all);
    if (!prev.length && !next.length) return null;
    var row = el('div', { class: 'chain-row' });
    function part(dir, list, label) {
      var names = list.map(function (x) { return actionTitle(x); }).join(', ');
      row.appendChild(el('span', { class: 'chain-tag ' + dir }, [
        window.Icon.el(dir === 'in' ? 'download' : 'share', 11),
        el('span', { text: label + ' ' + names })
      ]));
    }
    if (prev.length) part('in', prev, Tk.t('ต่อจาก'));
    if (next.length) part('out', next, Tk.t('ทำให้เกิด'));
    return row;
  }

  // ชื่อที่อ่านรู้เรื่องเสมอ — ถ้าผู้ใช้ไม่ตั้งชื่อ ให้สรุปจากกฎแทน "Action ไม่มีชื่อ"
  function actionTitle(a) {
    if (a.name && a.name.trim() && a.name !== 'Action ไม่มีชื่อ') return a.name;
    var t = a.trigger || {};
    var lead = Tk.t((TRIG_META[t.type] && TRIG_META[t.type].label) || 'เหตุการณ์');
    if (t.type === 'gift' && t.giftName) lead = t.giftName;
    if ((t.type === 'wheelResult' || t.type === 'randomWheelResult') && t.prize) lead = Tk.t('สุ่มได้ "{prize}"', { prize: t.prize });
    if (t.type === 'hotkey' && t.accelerator) lead = Tk.t('คีย์ {key}', { key: accelLabelApp(t.accelerator) });
    var rs = (a.responses || []).map(function (r) {
      return Tk.t((RESP_META[r.type] && RESP_META[r.type].label) || r.type);
    });
    if (!rs.length) return lead + ' → ' + Tk.t('(ยังไม่ได้ตั้งการกระทำ)');
    return lead + ' → ' + rs.slice(0, 2).join(' + ') + (rs.length > 2 ? ' +' + (rs.length - 2) : '');
  }

  // ---------- ตรวจระบบของขวัญ ----------
  // อาการ "ของขวัญออกเยอะเกินไป/ออกซ้ำ" ทำซ้ำบนเครื่องพัฒนาไม่ได้เพราะต้องต่อไลฟ์จริง
  // ปุ่มนี้ให้ผู้ใช้เก็บของจริงจากเครื่องตัวเองแล้วส่งมาให้ดู
  function wireGiftDiag() {
    var btn = $('#giftDiagBtn'), out = $('#giftDiagOut'),
        st = $('#giftDiagStatus'), copyBtn = $('#giftDiagCopyBtn');
    if (!btn) return;
    var text = '';
    btn.addEventListener('click', function () {
      btn.disabled = true;
      invoke('gift:diag', {}, { toast: false }).then(function (d) {
        text = JSON.stringify(d, null, 2);
        out.textContent = text;
        out.hidden = false;
        copyBtn.hidden = false;
        var สรุป = d && d['สรุป'] ? d['สรุป'] : '';
        st.textContent = สรุป;
        // ย้อมสีตามผล ให้เห็นตั้งแต่ยังไม่อ่านรายละเอียด
        st.className = 'obs-status' + (/พบปัญหา/.test(สรุป) ? ' err' : (/ปกติ/.test(สรุป) ? ' ok' : ''));
      }).catch(function (e) {
        out.textContent = Tk.t('ตรวจไม่สำเร็จ: ') + ((e && e.message) || e);
        out.hidden = false;
      }).finally(function () { btn.disabled = false; });
    });
    copyBtn.addEventListener('click', function () {
      try { navigator.clipboard.writeText(text); toast(Tk.t('คัดลอกแล้ว'), 'ok'); } catch (_) {}
    });
  }

  // ---------- เปิด/ปิด Action ทั้งชุดในปุ่มเดียว ----------
  // ใช้ตอนสลับสถานการณ์ เช่น "เลิกเล่นเกม มานั่งคุยเฉยๆ" ไม่ต้องไล่ปิดทีละอัน
  //
  // เคยลองทำให้จำว่า "ก่อนปิดยกชุดเปิดอันไหนไว้" แล้วให้กดเปิดกลับได้ตรงชุดเดิม — ถอดออกแล้ว
  // เพราะมันทำให้บางสถานะเข้าไม่ถึง: ถ้าเปิดอยู่ 1 จาก 6 แล้วกดปิดยกชุด ปุ่มจะกลายเป็น
  // "เปิดกลับ (1)" ตลอด ไม่มีทางกดให้เปิดครบ 6 ได้เลย ปุ่มที่เดาใจแล้วปิดทางเลือกแย่กว่า
  // ปุ่มที่ทำตรงๆ ตามชื่อ — ถ้าอยากได้เลิกทำจริงๆ ต้องทำเป็นปุ่มแยก ไม่ใช่สลับความหมายปุ่มเดิม
  function bulkCounts() {
    var list = (S.settings && S.settings.actions) || [];
    return { total: list.length, on: list.filter(function (a) { return a && a.enabled !== false; }).length };
  }

  function renderBulkToggle() {
    var btn = $('#bulkToggleBtn');
    if (!btn) return;
    var c = bulkCounts();
    btn.hidden = c.total === 0;      // ยังไม่มี Action ก็ไม่ต้องมีปุ่มนี้
    if (!c.total) return;
    // ป้ายบอกสิ่งที่จะเกิดขึ้นเมื่อกด ไม่ใช่สถานะปัจจุบัน — ปุ่มที่บอกสถานะทำให้คนกดผิดทาง
    btn.textContent = c.on > 0
      ? Tk.t('ปิดทั้งหมด ({n})', { n: c.on })
      : Tk.t('เปิดทั้งหมด ({n})', { n: c.total });
    btn.title = c.on > 0 ? Tk.t('ปิด Action ที่เปิดอยู่ทั้งหมด') : Tk.t('เปิด Action ทุกอัน');
  }

  function bulkToggle() {
    var list = (S.settings && S.settings.actions) || [];
    if (!list.length) return;
    var c = bulkCounts();
    var turnOn = c.on === 0;
    list.forEach(function (a) { a.enabled = turnOn; });
    invoke('settings:set', { patch: { actions: S.settings.actions } }, { toast: false })
      .then(function () {
        toast(turnOn ? Tk.t('เปิดแล้วทั้งหมด {n} Action', { n: c.total })
                     : Tk.t('ปิดแล้วทั้งหมด {n} Action', { n: c.on }), 'ok', 3000);
      })
      .catch(function (e) { toast(Tk.t('บันทึกไม่สำเร็จ: {err}', { err: (e && e.message) || e }), 'err'); });
    renderActions();
    renderNodes();
    renderBulkToggle();
  }

  // ---------- ค้นหา / กรอง / สถานะ ของหน้า Actions ----------
  // เก็บไว้ในตัวแปรโมดูล ไม่ลง settings — เป็นมุมมองชั่วคราว ไม่ใช่ค่าตั้งของผู้ใช้
  var actView = { q: '', status: 'all', trigger: '', resp: '' };

  // ข้อความที่ใช้ค้นหาต่อหนึ่ง Action — รวมชื่อ, สรุป trigger, ป้ายการกระทำ และค่าที่กรอกไว้จริง
  // (ค่าที่กรอกสำคัญ: ผู้ใช้มักจำ "ปุ่ม L" หรือชื่อไฟล์เสียงได้ แต่จำชื่อ Action ไม่ได้)
  function actionSearchText(a) {
    var parts = [a.name || '', actionTitle(a), triggerSummary(a)];
    var t = a.trigger || {};
    ['giftName', 'keyword', 'prize', 'accelerator'].forEach(function (k) { if (t[k]) parts.push(String(t[k])); });
    (function walk(list) {
      (list || []).forEach(function (r) {
        if (!r) return;
        parts.push(respLabel(r), Tk.t((RESP_META[r.type] && RESP_META[r.type].label) || r.type));
        ['text', 'url', 'key', 'command', 'scene', 'source'].forEach(function (k) { if (r[k]) parts.push(String(r[k])); });
        (r.branches || []).forEach(function (b) { if (b) { if (b.prize) parts.push(String(b.prize)); walk(b.responses); } });
      });
    })(a.responses);
    return parts.join(' \u0000 ').toLowerCase();
  }
  function actionHasResp(a, type) {
    var found = false;
    (function walk(list) {
      (list || []).forEach(function (r) {
        if (!r || found) return;
        if (r.type === type) { found = true; return; }
        (r.branches || []).forEach(function (b) { if (b) walk(b.responses); });
      });
    })(a.responses);
    return found;
  }
  function actionMatches(a) {
    if (actView.status === 'on' && a.enabled === false) return false;
    if (actView.status === 'off' && a.enabled !== false) return false;
    if (actView.trigger && (a.trigger || {}).type !== actView.trigger) return false;
    if (actView.resp && !actionHasResp(a, actView.resp)) return false;
    if (!actView.q) return true;
    var hay = actionSearchText(a);
    // ทุกคำต้องเจอ (ไม่ต้องเรียงกัน) — พิมพ์ "กุหลาบ เสียง" แล้วได้เฉพาะอันที่มีทั้งสองอย่าง
    return actView.q.split(/\s+/).every(function (w) { return !w || hay.indexOf(w) >= 0; });
  }
  function actFilterCount() { return (actView.trigger ? 1 : 0) + (actView.resp ? 1 : 0); }

  // แถบสถานะ ทั้งหมด / เปิด / ปิด พร้อมจำนวนจริง
  function renderActStatus(all) {
    var host = $('#actionsStatus');
    if (!host) return;
    var on = all.filter(function (a) { return a.enabled !== false; }).length;
    var tabs = [
      { v: 'all', label: Tk.t('ทั้งหมด'), n: all.length },
      { v: 'on', label: Tk.t('เปิดอยู่'), n: on },
      { v: 'off', label: Tk.t('ปิดอยู่'), n: all.length - on }
    ];
    host.innerHTML = '';
    tabs.forEach(function (t) {
      var active = actView.status === t.v;
      var b = el('button', {
        class: 'act-seg' + (active ? ' active' : ''), type: 'button',
        role: 'tab', 'aria-selected': active ? 'true' : 'false'
      }, [
        el('span', { text: t.label }),
        el('span', { class: 'act-seg-n', text: String(t.n) })
      ]);
      b.addEventListener('click', function () {
        if (actView.status === t.v) return;
        actView.status = t.v;
        renderActions();
      });
      host.appendChild(b);
    });
  }

  // กล่องตัวกรอง — เหตุการณ์ที่จุดชนวน และชนิดการกระทำ
  function buildActFilterPop() {
    var pop = $('#actionsFilterPop');
    if (!pop) return;
    var all = (S.settings && S.settings.actions) || [];
    pop.innerHTML = '';
    function group(title, meta, keyOf, cur, set) {
      // โชว์เฉพาะชนิดที่มีใช้จริง — ลิสต์ตัวเลือกที่กดแล้วได้ 0 รายการเสมอไม่ช่วยใคร
      var used = {};
      all.forEach(function (a) { var k = keyOf(a); (k || []).forEach(function (x) { used[x] = (used[x] || 0) + 1; }); });
      var keys = Object.keys(meta).filter(function (k) { return used[k]; });
      if (!keys.length) return;
      pop.appendChild(el('div', { class: 'act-filter-title', text: title }));
      var row = el('div', { class: 'act-filter-row' });
      keys.forEach(function (k) {
        var m = meta[k];
        var on = cur() === k;
        var b = el('button', { class: 'act-fchip' + (on ? ' active' : ''), type: 'button' }, [
          window.Icon.el(m.icon, 12),
          el('span', { text: Tk.t(m.label) }),
          el('span', { class: 'act-fchip-n', text: String(used[k]) })
        ]);
        b.addEventListener('click', function () { set(on ? '' : k); renderActions(); buildActFilterPop(); });
        row.appendChild(b);
      });
      pop.appendChild(row);
    }
    group(Tk.t('เมื่อเกิดเหตุการณ์'), TRIG_META,
      function (a) { return [(a.trigger || {}).type]; },
      function () { return actView.trigger; },
      function (v) { actView.trigger = v; });
    group(Tk.t('ให้ทำอะไร'), RESP_META,
      function (a) { return Object.keys(RESP_META).filter(function (t) { return actionHasResp(a, t); }); },
      function () { return actView.resp; },
      function (v) { actView.resp = v; });
    if (!pop.children.length) {
      pop.appendChild(el('p', { class: 'muted small', style: 'margin:0', text: Tk.t('ยังไม่มี Action ให้กรอง') }));
    } else if (actFilterCount()) {
      pop.appendChild(el('button', {
        class: 'btn btn-ghost btn-sm act-filter-clear', type: 'button', text: Tk.t('ล้างตัวกรอง'),
        onclick: function () { actView.trigger = ''; actView.resp = ''; renderActions(); buildActFilterPop(); }
      }));
    }
  }
  function closeActFilter() {
    var pop = $('#actionsFilterPop'), btn = $('#actionsFilterBtn');
    if (pop) pop.hidden = true;
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  // ทำสำเนา Action — วางต่อท้ายตัวต้นฉบับ ไม่ใช่ท้ายลิสต์ จะได้เห็นคู่กันแล้วแก้ต่อได้เลย
  function duplicateAction(a) {
    var list = (S.settings && S.settings.actions) || [];
    var i = indexOfActionId(a.id);
    var copy = JSON.parse(JSON.stringify(a));
    copy.id = 'a_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    copy.name = Tk.t('{name} (สำเนา)', { name: actionTitle(a) });
    list.splice(i < 0 ? list.length : i + 1, 0, copy);
    S.settings.actions = list;
    persistActions();
  }

  // โชว์/ซ่อนแถบเครื่องมือ (ค้นหา/กรอง/สถานะ) และปุ่มเพิ่มด้านล่าง ตามว่ามี Action หรือยัง
  // ยังไม่มีสักอัน = ไม่ต้องมีอะไรให้ค้น ให้หน้าโล่งๆ พร้อมเทมเพลต
  function syncActToolbar(has) {
    var tb = $('.actions-toolbar'), addRow = $('#actionsAddRow');
    var nodes = $('#actionsNodes');
    var nodeView = !!(nodes && !nodes.hidden);   // มุมมองโหนดไม่กรองตามนี้ ซ่อนไว้ไม่ให้กดแล้วไม่เกิดอะไร
    if (tb) tb.hidden = !has || nodeView;
    if (addRow) addRow.hidden = !has || nodeView;
    var fb = $('#actionsFilterBtn');
    if (fb) {
      var n = actFilterCount();
      fb.classList.toggle('has-filter', n > 0);
      var badge = fb.querySelector('.act-filter-badge');
      if (n > 0) {
        if (!badge) { badge = el('span', { class: 'act-filter-badge' }); fb.appendChild(badge); }
        badge.textContent = String(n);
      } else if (badge) { fb.removeChild(badge); }
    }
  }
  function resetActView() {
    actView.q = ''; actView.status = 'all'; actView.trigger = ''; actView.resp = '';
    var inp = $('#actionsSearch'); if (inp) inp.value = '';
    var clr = $('#actionsSearchClear'); if (clr) clr.hidden = true;
    closeActFilter();
    renderActions();
  }

  // ---------- จัดลำดับ Action ----------
  // ลำดับใน S.settings.actions คือลำดับที่แสดง และเป็นลำดับที่ engine ไล่ตรวจเวลามี event เข้ามาด้วย
  // (event เดียวเข้าเงื่อนไขหลาย action ได้ — ตัวที่อยู่บนกว่าทำงานก่อน)
  function moveActionTo(from, to) {
    var next = Tk.moveItem(S.settings.actions, from, to);
    if (next === S.settings.actions) return;          // ขยับไม่ได้จริง ไม่ต้องเขียนดิสก์
    S.settings.actions = next;
    invoke('settings:set', { patch: { actions: next } });
    renderActions();
  }

  // เรียงได้ต่อเมื่อ "เห็นครบทั้งชุด" เท่านั้น — ถ้ากำลังกรอง/ค้นอยู่ ใบข้างบนบนจอ
  // อาจไม่ใช่ใบข้างบนในลิสต์จริง กดแล้วการ์ดจะสลับกับใบที่มองไม่เห็น = งงกว่าเดิม
  function canReorder() {
    return !actView.q && !actFilterCount() && actView.status === 'all';
  }

  // ปุ่มจับลาก + ระบบลากสลับลำดับ
  // ใช้ HTML5 drag-and-drop (Chromium ทำงานเต็มรูปแบบใน Electron) และย้าย DOM ตามเมาส์ระหว่างลาก
  // เพื่อให้เห็นตำแหน่งใหม่สดๆ ไม่ต้องเดา · พอปล่อยแล้วค่อยอ่านลำดับ id จาก DOM แมปกลับเป็นข้อมูลทีเดียว
  var dragging = null;

  function gripEl() {
    var g = el('button', {
      class: 'action-grip', type: 'button',
      title: Tk.t('ลากเพื่อจัดลำดับ (หรือกดลูกศรขึ้น/ลง)'),
      'aria-label': Tk.t('ลากเพื่อจัดลำดับ (หรือกดลูกศรขึ้น/ลง)')
    }, [window.Icon.el('grip', 16)]);
    if (!canReorder()) {
      g.disabled = true;
      g.title = Tk.t('ล้างการค้นหา/ตัวกรองก่อน ถึงจะจัดลำดับได้');
    }
    return g;
  }

  // การ์ดใบไหนควรอยู่ "หลัง" ตำแหน่งเมาส์ตอนนี้ — เทียบกับกึ่งกลางของแต่ละใบ
  function cardAfter(list, y) {
    var cards = $$('.action-card:not(.dragging)', list);
    for (var i = 0; i < cards.length; i++) {
      var r = cards[i].getBoundingClientRect();
      if (y < r.top + r.height / 2) return cards[i];
    }
    return null;
  }

  // ย้ายการ์ดที่ลากอยู่ไปยังตำแหน่งตามเมาส์ พร้อมอนิเมชันให้ใบอื่นเลื่อนหลบ
  //
  // สองอย่างที่ทำให้เดิมกระตุก:
  //   1. สั่ง insertBefore ทุกครั้งที่ dragover แม้ผลลัพธ์จะเป็นตำแหน่งเดิม — การย้าย DOM
  //      บังคับให้เบราว์เซอร์จัด layout ใหม่ทั้งลิสต์ทุกครั้ง ทั้งที่ภาพไม่ได้เปลี่ยน
  //   2. ใบอื่นกระโดดเปลี่ยนที่ทันที ตาเห็นเป็นการกระตุกแม้เฟรมจะไม่ตก
  // แก้ด้วยการข้ามการย้ายที่ไม่มีผล และใช้ FLIP (จำตำแหน่งก่อนย้าย แล้วให้วิ่งจากที่เดิมมาที่ใหม่)
  function placeDragging(list, y) {
    if (!dragging) return;
    var after = cardAfter(list, y);
    if (after === dragging || after === dragging.nextElementSibling) return;   // อยู่ที่เดิมอยู่แล้ว
    if (!after && dragging === list.lastElementChild) return;

    var cards = $$('.action-card', list);
    var before = cards.map(function (c) { return c.getBoundingClientRect().top; });
    if (after) list.insertBefore(dragging, after);
    else list.appendChild(dragging);
    cards.forEach(function (c, i) {
      if (c === dragging) return;                       // ใบที่ลากอยู่ติดมือเมาส์ ไม่ต้องอนิเมต
      var dy = before[i] - c.getBoundingClientRect().top;
      if (!dy) return;
      c.style.transition = 'none';
      c.style.transform = 'translateY(' + dy + 'px)';
      requestAnimationFrame(function () {
        c.style.transition = 'transform .18s cubic-bezier(.2,.7,.3,1)';
        c.style.transform = '';
      });
    });
  }

  function clearFlip(list) {
    $$('.action-card', list).forEach(function (c) { c.style.transition = ''; c.style.transform = ''; });
  }

  // อ่านลำดับที่เห็นอยู่จริงบนจอ แล้วเขียนกลับเข้า settings (ครั้งเดียวตอนปล่อยเมาส์)
  function commitOrderFromDom(list) {
    var ids = $$('.action-card', list).map(function (c) { return c.dataset.actId; });
    var next = Tk.reorderByIds(S.settings.actions, ids);
    if (next === S.settings.actions) return;      // ลำดับเท่าเดิม หรือแมปไม่ได้ → ไม่แตะข้อมูล
    S.settings.actions = next;
    invoke('settings:set', { patch: { actions: next } });
    renderActions();
  }

  function wireDrag(card, grip, a, list) {
    if (!canReorder()) return;
    // ตั้ง draggable เฉพาะตอนกดที่ปุ่มจับ — ไม่งั้นลากตรงไหนของการ์ดก็ลากได้ ชนกับการเลือกข้อความ
    grip.addEventListener('mousedown', function () { card.draggable = true; });
    grip.addEventListener('mouseup', function () { card.draggable = false; });
    card.addEventListener('dragstart', function (e) {
      dragging = card;
      card.classList.add('dragging');
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', a.id); } catch (_) { /* บาง engine ไม่ให้ตั้ง */ }
      }
    });
    card.addEventListener('dragend', function () {
      card.draggable = false;
      card.classList.remove('dragging');
      dragging = null;
      clearFlip(list);        // ล้าง transform ที่ค้างจากอนิเมชัน ก่อนอ่านลำดับจริงจาก DOM
      commitOrderFromDom(list);
    });
    // คีย์บอร์ด: โฟกัสที่ปุ่มจับแล้วกดลูกศรขึ้น/ลง — เมาส์ไม่ใช่ทางเดียวที่จัดลำดับได้
    grip.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowUp' ? -1 : (e.key === 'ArrowDown' ? 1 : 0);
      if (!d) return;
      e.preventDefault();
      var from = S.settings.actions.indexOf(a);
      if (from < 0) return;
      moveActionTo(from, from + d);
      // วาดใหม่แล้วโฟกัสหลุด — โฟกัสกลับที่ปุ่มจับของใบเดิม จะได้กดรัวต่อได้
      var again = $('.action-card[data-act-id="' + a.id + '"] .action-grip');
      if (again) again.focus();
    });
  }

  function bindListDrag(list) {
    if (list.__dragBound) return;   // list element ตัวเดิมถูกใช้ซ้ำทุกครั้งที่ render — ผูกครั้งเดียวพอ
    list.__dragBound = true;
    // dragover ยิงถี่กว่าอัตราเฟรมมาก ถ้าคิดตำแหน่งใหม่ทุกครั้งจะอ่าน getBoundingClientRect รัวๆ
    // ซึ่งบังคับให้เบราว์เซอร์คำนวณ layout ใหม่ทุกครั้ง (layout thrashing) — คิดแค่เฟรมละครั้งพอ
    var raf = 0, lastY = 0;
    list.addEventListener('dragover', function (e) {
      if (!dragging) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      lastY = e.clientY;
      if (raf) return;
      raf = requestAnimationFrame(function () { raf = 0; placeDragging(list, lastY); });
    });
    list.addEventListener('drop', function (e) { e.preventDefault(); });
  }

  function renderActions() {
    // ผืนโหนดวาดตามหน้ารายการเสมอ — ทุกทางที่เปลี่ยนชุด Action (สลับ/ลบ/นำเข้าชุด) เรียก renderActions อยู่แล้ว
    if (!$('#actionsNodes').hidden) renderNodes();
    var list = $('#actionsList');
    var all = (S.settings && S.settings.actions) || [];
    renderBulkToggle();
    renderActStatus(all);
    syncActToolbar(all.length);
    list.innerHTML = '';
    if (!all.length) {
      var empty = el('div', { class: 'empty-state', html:
        Tk.t('ยังไม่มี Action — เริ่มได้ใน 3 ขั้น') + '<br>' +
        '<span class="empty-steps">' + Tk.t('1. กดเทมเพลตด้านบน หรือปุ่มด้านล่าง  ·  2. กด "ทดสอบ" ดูผลทันที  ·  3. เปิดไลฟ์แล้วทำงานอัตโนมัติ') + '</span>' });
      var cta = el('button', { class: 'btn btn-primary empty-cta', type: 'button', onclick: createNewAction }, [
        window.Icon.el('plus', 15), el('span', { text: Tk.t('สร้าง Action') })
      ]);
      empty.appendChild(cta);
      list.appendChild(empty);
      return;
    }
    // กรองตามคำค้น/สถานะ/ตัวกรอง — ลิสต์ที่วาดจริงคือ actions
    var actions = all.filter(actionMatches);
    if (!actions.length) {
      list.appendChild(el('div', { class: 'empty-state', html:
        Tk.t('ไม่พบ Action ที่ตรงกับที่ค้น') + '<br>' +
        '<span class="empty-steps">' + Tk.t('ลองแก้คำค้น หรือล้างตัวกรอง') + '</span>' }));
      list.appendChild(el('div', { style: 'text-align:center;margin-top:10px' }, [
        el('button', { class: 'btn btn-ghost btn-sm', text: Tk.t('ล้างการค้นหาและตัวกรอง'), onclick: resetActView })
      ]));
      return;
    }
    actions.forEach(function (a) {
      var toggle = el('label', { class: 'toggle' }, [
        el('input', { type: 'checkbox', 'aria-label': Tk.t('เปิด/ปิด Action: {name}', { name: actionTitle(a) }) }),
        el('span', { class: 'track' })
      ]);
      var cb = toggle.querySelector('input');
      cb.checked = a.enabled !== false;
      cb.addEventListener('change', function () {
        a.enabled = cb.checked;
        invoke('settings:set', { patch: { actions: S.settings.actions } });
        card.classList.toggle('disabled', !cb.checked);
        renderBulkToggle();
      });
      var flow = el('div', { class: 'action-flow' }, [
        triggerNodeEl(a),
        el('span', { class: 'flow-arrow' }, [window.Icon.el('chevronRight', 15)]),
        respChipsEl(a)
      ]);
      var chain = chainRow(a, all); // ป้ายบอกว่า action นี้ต่อจาก/ทำให้เกิดอันไหน — ดูจากทั้งชุด ไม่ใช่แค่ที่กรองเหลือ
      var grip = gripEl();
      var card = el('div', { class: 'action-card' + (a.enabled === false ? ' disabled' : '') + (chain ? ' chained' : '') }, [
        grip,
        toggle,
        el('div', { class: 'action-main' }, [
          el('div', { class: 'action-name' }, [
            el('span', { text: actionTitle(a) }),
            actionIncomplete(a) ? el('span', { class: 'action-warn', title: Tk.t('บาง action ยังตั้งค่าไม่ครบ เช่น เสียงยังไม่ได้เลือกไฟล์'), text: Tk.t('ยังตั้งค่าไม่ครบ') }) : null
          ]),
          flow,
          chain
        ]),
        el('div', { class: 'action-btns' }, [
          (function () {
            // ปุ่มทดสอบ: นับถอยหลัง 5 วิ ก่อนรันจริง — ให้มีเวลาสลับไปหน้าเกม/แอปเป้าหมาย
            // (จำเป็นกับ keypress ที่ส่งปุ่มไปหน้าต่างที่โฟกัสอยู่) · กดซ้ำระหว่างนับ = ยกเลิก
            // ปุ่มเป็นไอคอน — ตอนนับถอยหลังสลับไอคอนเป็นตัวเลขวินาที (ปุ่มไม่ขยับความกว้าง)
            var testIco = window.Icon.el('play', 15);
            var testCnt = el('span', { class: 'test-cnt' });
            testCnt.hidden = true;
            var testBtn = el('button', {
              class: 'btn btn-ghost btn-sm btn-icon', title: Tk.t('ทดสอบ'), 'data-i18n-title': 'ทดสอบ',
              'aria-label': Tk.t('ทดสอบ Action')
            }, [testIco, testCnt]);
            var countdown = null, left = 0;
            function showCount(n) {
              testCnt.textContent = String(n);
              testBtn.title = Tk.t('รันใน {n}...', { n: n });
            }
            function resetBtn() {
              clearInterval(countdown); countdown = null;
              testIco.hidden = false; testCnt.hidden = true;
              testBtn.title = Tk.t('ทดสอบ');
              testBtn.classList.remove('counting');
            }
            testBtn.addEventListener('click', function () {
              if (countdown) { resetBtn(); toast(Tk.t('ยกเลิกการทดสอบ'), ''); return; }
              left = 5;
              testIco.hidden = true; testCnt.hidden = false; showCount(left);
              testBtn.classList.add('counting');
              countdown = setInterval(function () {
                left -= 1;
                if (left > 0) { showCount(left); return; }
                resetBtn();
                invoke('actions:test', { id: a.id }).then(function () { toast(Tk.t('ทดสอบ "{name}" แล้ว', { name: a.name || '' }), 'ok'); });
              }, 1000);
            });
            return testBtn;
          })(),
          el('button', {
            class: 'btn btn-ghost btn-sm btn-icon', title: Tk.t('ทำสำเนา'), 'data-i18n-title': 'ทำสำเนา',
            'aria-label': Tk.t('ทำสำเนา Action'), onclick: function () { duplicateAction(a); }
          }, [window.Icon.el('copy', 15)]),
          el('button', {
            class: 'btn btn-ghost btn-sm btn-icon', title: Tk.t('แก้ไข'), 'data-i18n-title': 'แก้ไข',
            'aria-label': Tk.t('แก้ไข Action'), onclick: function () {
              window.ActionsEditor.open(a, function (updated) {
                saveActionById(a.id, updated);
              });
            }
          }, [window.Icon.el('edit', 15)]),
          el('button', {
            class: 'btn btn-danger btn-sm btn-icon', title: Tk.t('ลบ'), 'data-i18n-title': 'ลบ',
            'aria-label': Tk.t('ลบ Action'), onclick: async function () {
              if (await Tk.confirmDialog(Tk.t('ลบ Action "{name}" ?', { name: a.name || '' }), Tk.t('ลบ'))) {
                deleteActionById(a.id);
              }
            }
          }, [window.Icon.el('trash', 15)])
        ])
      ]);
      card.dataset.actId = a.id;
      wireDrag(card, grip, a, list);
      list.appendChild(card);
    });
    bindListDrag(list);
  }

  // ---------- มุมมองโหนด: ผืนผ้าใบลากต่อ ----------
  // action หนึ่งอัน = ต้นไม้หนึ่งต้น: เหตุการณ์ → ขั้นทั้งหมดในลิสต์ (สายแยกจากจุดเดียวกัน = เริ่มทำพร้อมกัน ไม่รอกัน)
  // โหนดที่มีขาออก: หน่วงเวลา (ของที่ต่อจากมันรอครบก่อน) · สุ่มทาง/ถ้า…/วงล้อ (แต่ละทางคือลิสต์อีกชุด) — โหนดอื่นทำจบในตัว
  // ทุกโหนดมีตำแหน่งของตัวเอง (เหตุการณ์ = action._x/_y · ขั้น = _nx/_ny) ลากวางอิสระแบบ n8n
  var NC_W = 184, NC_GX = 58, NC_GY = 30;
  var NC_BRANCHY = { wheel: 1, randomWheel: 1, random: 1, if: 1, delay: 1 };
  var NC_WRAP = { delay: 1, random: 1, if: 1 };   // วางบนสายแล้วคั่นกลางได้ (มีทางให้ของเดิมไปอยู่ใต้มัน)
  var nc = { pan: { x: 40, y: 40 }, z: 1, sel: null, selWire: null, geo: {}, live: {}, heat: null, stage: null, fitted: false };
  try {
    var ncSaved = JSON.parse(localStorage.getItem('tk.nc.view') || 'null');
    if (ncSaved && isFinite(ncSaved.z) && ncSaved.pan) { nc.pan = ncSaved.pan; nc.z = ncSaved.z; nc.fitted = true; }
  } catch (e) { /* ไม่มีมุมมองเดิมก็ใช้ค่าเริ่มต้น */ }

  function ncActions() { return (S.settings && S.settings.actions) || []; }
  function ncProfKey() { return (S.settings && S.settings.activeProfile) || 'default'; }
  // ร่าง = โหนดที่วางบนผืนแต่ยังไม่ต่อกับเหตุการณ์ไหน (ลากมาวางก่อน ค่อยต่อสายทีหลังแบบ n8n)
  // เก็บแยกตามชุด Action สลับชุดแล้วเห็นร่างของชุดนั้น · ตัวรัน Action ไม่เห็นร่างเลย (ไม่อยู่ใน actions)
  function ncDrafts() {
    var m = S.settings.nodeDrafts || (S.settings.nodeDrafts = {});
    return m[ncProfKey()] || (m[ncProfKey()] = []);
  }
  function ncById(id) {
    return ncActions().filter(function (a) { return a && a.id === id; })[0] ||
      ncDrafts().filter(function (d) { return d && d.id === id; })[0] || null;
  }
  // path เช่น '2/1/0' = ขั้นที่ 0 ในทางที่ 1 ของขั้นที่ 2 → คืนลิสต์ที่ขั้นนั้นอยู่ + ตำแหน่งในลิสต์
  function ncHolder(a, path) {
    var parts = String(path).split('/').map(Number), list = a.responses || (a.responses = []);
    for (var i = 0; i + 2 < parts.length; i += 2) {
      var r = list[parts[i]];
      if (!r || !r.branches || !r.branches[parts[i + 1]]) return null;
      var b = r.branches[parts[i + 1]];
      list = b.responses || (b.responses = []);
    }
    return { list: list, index: parts[parts.length - 1] };
  }
  function ncStepAt(o, path) { var h = ncHolder(o, path); return h ? h.list[h.index] : null; }
  function ncNewId(p) { return p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function ncRespColor(t) { return ((window.ActionsEditor && window.ActionsEditor.RESP_COLOR) || {})[t] || 'var(--accent)'; }
  function ncBranchLabel(r, b, i) {
    if (r.type === 'if') return Tk.t(i === 0 ? 'ใช่' : 'ไม่ใช่');
    if (r.type === 'random') return Tk.t('ทาง {n}', { n: i + 1 });
    return b.prize ? Tk.t('ได้ "{prize}"', { prize: b.prize }) : Tk.t('ผลใดก็ได้');
  }
  function ncSaveQuiet() {
    ncPrune();
    invoke('settings:set', { patch: { actions: S.settings.actions, nodeDrafts: S.settings.nodeDrafts || {} } }, { toast: false });
  }
  // ร่างที่ว่างแล้ว (ต่อเข้ากฎหมด/ลบหมด) ทิ้งไป ไม่ให้ค้างในไฟล์ตั้งค่า
  function ncPrune() {
    var m = S.settings.nodeDrafts, k = ncProfKey();
    if (m && m[k]) m[k] = m[k].filter(function (d) { return d && (d.responses || []).length; });
  }
  function ncModalOpen() { var mh = $('#modalHost'); return !!(mh && mh.children.length); }

  // สลับภาษา → สร้างแผง/แถบเครื่องมือใหม่ (ประกอบข้อความตอนสร้าง applyDom ทาให้ไม่ได้) แล้ว renderActions วาดผืนต่อ
  function ncRemount() { if (!nc.stage) return; nc.stage = null; nc.heat = null; nc.menu = null; }
  function ncPersist() { ncSaveQuiet(); renderActions(); }
  function ncMount() {
    var host = $('#actionsNodes');
    if (!host || nc.stage) return host;
    host.innerHTML = '';
    nc.palette = el('div', { class: 'nc-palette' });
    nc.stage = el('div', { class: 'nc-stage' });
    nc.world = el('div', { class: 'nc-world' });
    nc.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    nc.svg.setAttribute('class', 'nc-wires');
    nc.layer = el('div', {});
    nc.world.appendChild(nc.svg);
    nc.world.appendChild(nc.layer);
    nc.stage.appendChild(nc.world);
    nc.zoomLbl = el('span', { class: 'nc-zoom' });
    nc.heatBtn = el('button', { class: 'nc-tb-btn', type: 'button', title: Tk.t('ยอดทำงาน — ดูว่าแต่ละกฎทำงานไปกี่ครั้งและได้เพชรเท่าไหร่ ในไลฟ์นี้หรือไลฟ์ก่อนๆ (เส้นยิ่งหนา = ทางนั้นถูกใช้บ่อย)') },
      [window.Icon.el('trophy', 14), el('span', { text: Tk.t('ยอดทำงาน') })]);
    nc.heatSel = el('select', { class: 'nc-heat-sel', 'aria-label': Tk.t('ดูข้อมูลของไลฟ์ไหน') });
    // แถบบอกว่ากำลังดูอะไร (โผล่ตอนเปิดยอดทำงาน) — แยกจากแถบเครื่องมือ ช่องเลือกไลฟ์จะได้ไม่เบียดปุ่มจนตัวหนังสือขาด
    nc.statBar = el('div', { class: 'nc-statbar' }, [el('span', { text: Tk.t('แต่ละกฎทำงานกี่ครั้ง ได้เพชรเท่าไหร่ · ดู') }), nc.heatSel]);
    nc.statBar.hidden = true;
    nc.stage.appendChild(el('div', { class: 'nc-toolbar' }, [
      el('button', { class: 'nc-tb-btn', type: 'button', title: Tk.t('ซูมออก'), text: '−', onclick: function () { ncZoomAt(nc.z / 1.2); } }),
      nc.zoomLbl,
      el('button', { class: 'nc-tb-btn', type: 'button', title: Tk.t('ซูมเข้า'), text: '+', onclick: function () { ncZoomAt(nc.z * 1.2); } }),
      el('button', { class: 'nc-tb-btn', type: 'button', title: Tk.t('ให้ทุกอย่างพอดีจอ'), onclick: function () { ncFit(); } },
        [window.Icon.el('overview', 14), el('span', { text: Tk.t('พอดีจอ') })]),
      el('button', { class: 'nc-tb-btn', type: 'button', title: Tk.t('จัดเรียงโหนดทั้งหมดใหม่ให้อัตโนมัติ'), onclick: function () { ncTidy(); } },
        [window.Icon.el('sparkles', 14), el('span', { text: Tk.t('จัดเรียง') })]),
      nc.heatBtn
    ]));
    nc.stage.appendChild(nc.statBar);
    nc.stage.appendChild(el('div', { class: 'nc-hint', text: Tk.t('ลาก/คลิกของในแผงซ้ายเพื่อวาง · ลากจากวงกลมไปโหนดอื่นเพื่อต่อ (ต่อจากจุดเดียวกัน = ทำพร้อมกัน) · คลิกสาย + Delete = ตัด · ดับเบิลคลิก = ตั้งค่า') }));
    nc.empty = el('div', { class: 'nc-empty' }, [
      el('b', { text: Tk.t('ผืนผ้าใบว่าง') }),
      el('span', { text: Tk.t('ลากเหตุการณ์หรือของขวัญจากแผงซ้ายมาวางตรงนี้เพื่อเริ่มกฎใหม่') })
    ]);
    nc.stage.appendChild(nc.empty);
    host.appendChild(nc.palette);
    host.appendChild(nc.stage);
    ncBindStage();
    ncBuildPalette();
    ncBindFiles();
    ncBindHeat();
    return host;
  }

  function renderNodes() {
    var host = ncMount();
    if (!host || host.hidden) return;   // มองไม่เห็นก็ไม่ต้องวาด (วัดขนาดจริงไม่ได้ด้วย)
    var list = ncActions(), drafts = ncDrafts();
    var ids = list.map(function (a) { return a && a.id; });
    // สลับเป็นชุดอื่นทั้งชุด = ผืนใหม่ทั้งผืน → จัดให้พอดีจอใหม่ ไม่ค้างมุมมองของชุดเดิม
    if (nc.lastIds && ids.length && !ids.some(function (id) { return nc.lastIds.indexOf(id) >= 0; })) nc.fitted = false;
    nc.lastIds = ids;
    nc.layer.innerHTML = '';
    nc.geo = {};
    nc.empty.hidden = list.length + drafts.length > 0;
    var els = [];
    function walk(o, rs, prefix) {
      (rs || []).forEach(function (r, i) {
        if (!r) return;
        var path = prefix + i, n = ncStepNode(o, r, path);
        nc.layer.appendChild(n); els.push(n);
        if (NC_BRANCHY[r.type]) (r.branches || []).forEach(function (b, bi) { walk(o, b && b.responses, path + '/' + bi + '/'); });
      });
    }
    list.forEach(function (a) { if (!a) return; var t = ncTrigNode(a); nc.layer.appendChild(t); els.push(t); walk(a, a.responses, ''); });
    drafts.forEach(function (d) { if (d) walk(d, d.responses, ''); });
    // อ่านความสูงจริงรวดเดียวหลัง append ครบ (บังคับ layout รอบเดียว)
    var H = {};
    els.forEach(function (n) { H[n.dataset.key] = n.offsetHeight || 70; });
    // ตำแหน่ง = ที่ผู้ใช้วางไว้ · โหนดเก่าที่ยังไม่เคยมีตำแหน่ง วางต่อจากโหนดก่อนหน้าให้แล้วจำไว้ในข้อมูล
    var nextY = 20, dirty = false;
    list.forEach(function (a) {
      if (!a) return;
      if (a._x == null || a._y == null) { a._x = 20; a._y = nextY; dirty = true; }
      var r = ncAutoPos(a, a._x, a._y, H);
      dirty = dirty || r.dirty;
      nextY = Math.max(nextY, r.bottom + 50);
    });
    drafts.forEach(function (d) {
      var f = d && d.responses && d.responses[0];
      if (!f) return;
      if (f._nx == null || f._ny == null) { f._nx = 20; f._ny = nextY; dirty = true; }
      var r = ncAutoPos(d, f._nx - NC_W - NC_GX, f._ny, H);
      dirty = dirty || r.dirty;
      nextY = Math.max(nextY, r.bottom + 50);
    });
    els.forEach(function (n) {
      var g = nc.geo[n.dataset.key];
      if (!g) return;
      g.h = H[n.dataset.key]; g.el = n;
      n.style.left = g.x + 'px'; n.style.top = g.y + 'px';
    });
    ncDrawWires();
    ncApplyView();
    if (dirty) ncSaveQuiet();
    if (!nc.fitted && els.length) { nc.fitted = true; ncFit(); }
    if (nc.heat) ncPaintHeat();
  }

  // เติมตำแหน่งให้โหนดที่ยังไม่มี: ลูกของจุดเดียวกัน (เหตุการณ์/หน่วงเวลา/ทาง) เรียงเป็นคอลัมน์ทางขวาของมัน ต่อใต้ของที่มีอยู่
  // โหนดที่ผู้ใช้ลากไว้แล้วไม่แตะ — จัดให้แค่ครั้งแรก (กฎเก่า/กดจัดเรียง) หลังจากนั้นเป็นของผู้ใช้
  function ncAutoPos(o, x0, y0, H) {
    var dirty = false;
    function col(list, px, py, prefix) {
      var low = py, bottom = py;
      (list || []).forEach(function (r, i) {
        if (r && r._nx != null && r._ny != null) low = Math.max(low, r._ny + (H[o.id + ':' + prefix + i] || 70) + NC_GY);
      });
      (list || []).forEach(function (r, i) {
        if (!r) return;
        var key = o.id + ':' + prefix + i, h = H[key] || 70;
        if (r._nx == null || r._ny == null) { r._nx = Math.round(px + NC_W + NC_GX); r._ny = Math.round(low); dirty = true; }
        nc.geo[key] = { x: r._nx, y: r._ny, a: o.id, path: prefix + i, draft: !o.trigger };
        var sub = r._ny + h;
        if (NC_BRANCHY[r.type]) {
          var by = r._ny;
          (r.branches || []).forEach(function (b, bi) {
            if (!b || !(b.responses || []).length) return;
            var bb = col(b.responses, r._nx, by, prefix + i + '/' + bi + '/');
            sub = Math.max(sub, bb); by = bb + NC_GY;
          });
        }
        low = Math.max(low, sub + NC_GY);
        bottom = Math.max(bottom, sub);
      });
      return bottom;
    }
    if (o.trigger) nc.geo[o.id + ':t'] = { x: o._x, y: o._y, a: o.id, path: 't' };
    return { dirty: dirty, bottom: Math.max(col(o.responses, x0, y0, ''), y0 + (o.trigger ? (H[o.id + ':t'] || 90) : 0)) };
  }

  // จุดออก: 'out' = วงกลมขวาของโหนด · เลขทาง = แถวทางนั้น (โหนดที่ไม่มีแถว เช่นหน่วงเวลา ใช้วงกลมขวาแทน)
  function ncPort(key, which) {
    var g = nc.geo[key];
    if (!g || !g.el) return null;
    var row = which === 'out' ? null : g.el.querySelector('.nc-brow[data-b="' + which + '"]');
    return row ? { x: g.x + NC_W + 1, y: g.y + row.offsetTop + 10 } : { x: g.x + NC_W + 1, y: g.y + 25 };
  }
  function ncIn(key) { var g = nc.geo[key]; return g ? { x: g.x - 1, y: g.y + 25 } : null; }
  function ncCurve(p, q) {
    var dx = Math.max(40, Math.abs(q.x - p.x) * 0.5);
    return 'M ' + p.x + ' ' + p.y + ' C ' + (p.x + dx) + ' ' + p.y + ', ' + (q.x - dx) + ' ' + q.y + ', ' + q.x + ' ' + q.y;
  }
  // สายเส้นประสีตามโหนดปลายทาง แยกจากจุดต่อไปหาลูกทุกตัว (ลูกของจุดเดียวกันเริ่มพร้อมกัน)
  // data-a/data-to ไว้ให้ไฟวิ่ง ตัดสาย และวางโหนดคั่นกลางสาย
  function ncDrawWires() {
    var out = '';
    function draw(o) {
      function link(fromKey, which, toPath, cls) {
        var p = ncPort(fromKey, which), q = ncIn(o.id + ':' + toPath), tg = nc.geo[o.id + ':' + toPath];
        if (!p || !q) return;
        var col = tg && tg.el ? tg.el.style.getPropertyValue('--nc') : '';
        var sel = nc.selWire && nc.selWire.a === o.id && nc.selWire.to === toPath ? ' sel' : '';
        var d = ncCurve(p, q), at = ' data-a="' + o.id + '" data-to="' + toPath + '"';
        out += '<path class="nc-wire ' + cls + sel + '"' + at + (col ? ' style="--wc:' + col + '"' : '') + ' d="' + d + '"/>' +
               '<path class="nc-wire-hit"' + at + ' d="' + d + '"/>';
      }
      (function walk(rs, prefix, fromKey, which, cls) {
        (rs || []).forEach(function (r, i) {
          if (!r) return;
          var path = prefix + i;
          if (fromKey) link(fromKey, which, path, cls);
          if (NC_BRANCHY[r.type]) (r.branches || []).forEach(function (b, bi) {
            walk(b && b.responses, path + '/' + bi + '/', o.id + ':' + path, bi, r.type === 'delay' ? '' : 'branch');
          });
        });
      })(o.responses, '', o.trigger ? o.id + ':t' : null, 'out', '');
    }
    ncActions().forEach(function (a) { if (a) draw(a); });
    ncDrafts().forEach(function (d) { if (d) draw(d); });
    nc.svg.innerHTML = out;
    ncPaintCut();
  }
  // ปุ่มตัดกลางสายที่เลือกอยู่ (อยู่ในพิกัดผืน ซูม/เลื่อนตามไปด้วย)
  function ncPaintCut() {
    if (nc.cutBtn) { nc.cutBtn.remove(); nc.cutBtn = null; }
    var s = nc.selWire, w = s && nc.svg.querySelector('.nc-wire[data-a="' + s.a + '"][data-to="' + s.to + '"]');
    if (!w) { nc.selWire = null; return; }
    var p = w.getPointAtLength(w.getTotalLength() / 2);
    nc.cutBtn = el('button', { class: 'nc-cut', type: 'button', title: Tk.t('ตัดสาย'), 'aria-label': Tk.t('ตัดสาย'), style: 'left:' + p.x + 'px;top:' + p.y + 'px' }, [window.Icon.el('x', 11)]);
    nc.cutBtn.addEventListener('click', function (e) { e.stopPropagation(); ncCut(s.a, s.to); });
    nc.world.appendChild(nc.cutBtn);
  }

  function ncShell(a, key, color, cls) {
    var n = el('div', { class: 'nc-node ' + cls + (a.enabled === false ? ' disabled' : '') + (nc.sel === key ? ' selected' : ''), style: '--nc:' + color });
    n.dataset.key = key;
    n.appendChild(el('button', { class: 'nc-del', type: 'button', title: Tk.t('ลบ'), 'aria-label': Tk.t('ลบ') }, [window.Icon.el('x', 11)]));
    return n;
  }
  function ncTrigNode(a) {
    var t = a.trigger || {}, m = TRIG_META[t.type] || { icon: 'info', label: t.type, color: 'var(--accent)' };
    var n = ncShell(a, a.id + ':t', m.color, 'trig');
    var head = [el('span', { class: 'nc-ico' }, [window.Icon.el(m.icon, 14)])];
    var g = t.type === 'gift' ? giftInfo(t.giftName, t.giftId) : null;
    if (g && g.image) head.push(el('img', { class: 'nc-img', src: g.image, alt: '' }));
    head.push(el('span', { class: 'nc-title', text: actionTitle(a) }));
    n.appendChild(el('div', { class: 'nc-head' }, head));
    n.appendChild(el('div', { class: 'nc-sub', text: triggerSummary(a) }));
    var tg = el('label', { class: 'toggle sm', title: Tk.t('เปิด/ปิด') }, [
      el('input', { type: 'checkbox', 'aria-label': Tk.t('เปิด/ปิด Action: {name}', { name: actionTitle(a) }) }), el('span', { class: 'track' })]);
    var cb = tg.querySelector('input');
    cb.checked = a.enabled !== false;
    cb.addEventListener('change', function () { a.enabled = cb.checked; n.classList.toggle('disabled', !cb.checked); ncSaveQuiet(); renderActions(); renderBulkToggle(); });
    n.appendChild(el('div', { class: 'nc-ctl' }, [tg, ncTestBtn(a), el('span', { class: 'nc-count' })]));
    n.appendChild(el('span', { class: 'nc-port', title: Tk.t('ลากเพื่อต่อการกระทำ') }));
    ncPaintCount(n, a.id);
    return n;
  }
  // โหนดที่ยังตั้งค่าไม่ครบ (เพิ่งลากมาจากแผง) — บอกบนโหนดเลย ไม่ต้องรอไปเจอตอนกดบันทึก
  function ncMissing(r) {
    if ((r.type === 'sound' || r.type === 'video') && !String(r.url || '').trim()) return Tk.t('ยังไม่ได้เลือกไฟล์ — ดับเบิลคลิกเพื่อตั้งค่า');
    if (r.type === 'keypress' && !r.key) return Tk.t('ยังไม่ได้ตั้งปุ่ม — ดับเบิลคลิกเพื่อตั้งค่า');
    if ((r.type === 'webhook' && !String(r.url || '').trim()) || (r.type === 'minecraft' && !String(r.command || '').trim())) return Tk.t('ยังตั้งค่าไม่ครบ — ดับเบิลคลิกเพื่อตั้งค่า');
    return '';
  }
  function ncStepNode(o, r, path) {
    var m = RESP_META[r.type] || { icon: 'info', label: r.type };
    var n = ncShell(o, o.id + ':' + path, ncRespColor(r.type), o.trigger ? '' : 'draft');
    n.appendChild(el('span', { class: 'nc-port in', title: Tk.t('ลากสายจากโหนดอื่นมาต่อที่นี่') }));
    var head = [el('span', { class: 'nc-ico' }, [window.Icon.el(m.icon, 13)]), el('span', { class: 'nc-title', text: Tk.t(m.label) })];
    if (!o.trigger && path.indexOf('/') < 0) head.push(el('span', { class: 'nc-tag', text: Tk.t('ยังไม่ได้ต่อ'), title: Tk.t('โหนดนี้ยังไม่ทำงาน — ลากสายจากเหตุการณ์หรือโหนดอื่นมาต่อ') }));
    n.appendChild(el('div', { class: 'nc-head' }, head));
    var miss = ncMissing(r);
    n.appendChild(el('div', { class: 'nc-sub' + (miss ? ' warn' : ''), text: miss || respLabel(r) }));
    if (r.type !== 'delay' && NC_BRANCHY[r.type] && (r.branches || []).length) {
      var box = el('div', { class: 'nc-branches' });
      r.branches.forEach(function (b, i) {
        var row = el('div', { class: 'nc-brow', text: ncBranchLabel(r, b || {}, i) });
        row.dataset.b = i;
        row.appendChild(el('span', { class: 'nc-port', title: Tk.t('ลากเพื่อต่อทางนี้') }));
        box.appendChild(row);
      });
      n.appendChild(box);
    }
    // ขาออกมีเฉพาะ "หน่วงเวลา" (ของที่ต่อจากมันรอครบก่อน) — โหนดอื่นทำจบในตัว ไม่มีอะไรต้องรอต่อ
    if (r.type === 'delay') n.appendChild(el('span', { class: 'nc-port', title: Tk.t('ลากไปต่อสิ่งที่จะทำหลังรอครบ') }));
    return n;
  }

  // ข้อมูลทดสอบให้ตรงกับเงื่อนไขของกฎนั้นเอง — ไม่งั้นกฎ "Galaxy" ถูกทดสอบด้วยกุหลาบ 1 เพชรแล้วเงื่อนไข "ถ้า…" เพี้ยน
  function ncTestOverrides(a) {
    var t = a.trigger || {};
    if (t.type === 'gift') {
      var g = giftInfo(t.giftName, t.giftId) || {}, rep = Math.max(1, Number(t.minRepeat) || 1), c = Number(g.coins) || 1;
      return { giftName: t.giftName || g.name || 'Rose', giftId: t.giftId || g.id || 5655, giftPictureUrl: g.image || '',
        diamondCount: c, repeatCount: rep, diamondTotal: Math.max(c * rep, Number(t.minDiamonds) || 0) };
    }
    if (t.type === 'chat' && t.keyword) return { comment: t.keyword };
    if (t.type === 'goalReached') return { goal: t.goal || 'likes', target: 1000 };
    if ((t.type === 'wheelResult' || t.type === 'randomWheelResult') && t.prize) return { prize: t.prize, label: t.prize };
    return {};
  }
  // ปุ่มทดสอบบนโหนด — นับถอยหลัง 5 วิเหมือนหน้ารายการ (ให้สลับไปหน้าเกมทันก่อนกดปุ่มจริง) กดซ้ำ = ยกเลิก
  function ncTestBtn(a) {
    var lbl = el('span', { text: Tk.t('ทดสอบ') });
    var btn = el('button', { class: 'nc-test', type: 'button', title: Tk.t('ทดสอบ — นับถอยหลัง 5 วิให้สลับไปหน้าเกมก่อน · กดซ้ำเพื่อยกเลิก') }, [window.Icon.el('play', 12), lbl]);
    var timer = null, left = 0;
    function done() { clearInterval(timer); timer = null; btn.classList.remove('counting'); lbl.textContent = Tk.t('ทดสอบ'); }
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (timer) { done(); toast(Tk.t('ยกเลิกการทดสอบ'), ''); return; }
      left = 5; btn.classList.add('counting'); lbl.textContent = String(left);
      timer = setInterval(function () {
        left -= 1;
        if (left > 0) { lbl.textContent = String(left); return; }
        done();
        invoke('actions:test', { id: a.id, overrides: ncTestOverrides(a) })
          .then(function () { toast(Tk.t('ทดสอบ "{name}" แล้ว', { name: actionTitle(a) }), 'ok'); });
      }, 1000);
    });
    return btn;
  }
  function ncPaintCount(n, id) {
    var c = n.querySelector('.nc-count');
    if (!c) return;
    var s = nc.live[id];
    c.textContent = s && s.n ? Tk.t('{n} ครั้ง', { n: s.n }) + (s.d ? ' · ' + fmt(s.d) + '💎' : '') : '';
    c.classList.toggle('hot', !!(s && s.n));
  }

  function ncApplyView() {
    nc.world.style.transform = 'translate(' + nc.pan.x + 'px,' + nc.pan.y + 'px) scale(' + nc.z + ')';
    nc.stage.style.setProperty('--gx', nc.pan.x + 'px');
    nc.stage.style.setProperty('--gy', nc.pan.y + 'px');
    nc.stage.style.setProperty('--gs', (22 * nc.z) + 'px');
    nc.zoomLbl.textContent = Math.round(nc.z * 100) + '%';
    clearTimeout(nc.saveT);
    nc.saveT = setTimeout(function () { try { localStorage.setItem('tk.nc.view', JSON.stringify({ pan: nc.pan, z: nc.z })); } catch (e) { /* เก็บไม่ได้ก็ไม่เป็นไร */ } }, 300);
  }
  function ncZoomAt(z, cx, cy) {
    var r = nc.stage.getBoundingClientRect();
    if (cx == null) { cx = r.width / 2; cy = r.height / 2; }
    z = Math.min(1.6, Math.max(0.3, z));
    var wx = (cx - nc.pan.x) / nc.z, wy = (cy - nc.pan.y) / nc.z;
    nc.z = z; nc.pan.x = cx - wx * z; nc.pan.y = cy - wy * z;
    ncApplyView();
  }
  function ncFit() {
    var keys = Object.keys(nc.geo), r = nc.stage.getBoundingClientRect();
    if (!keys.length || !r.width) return;
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    keys.forEach(function (k) { var g = nc.geo[k]; x0 = Math.min(x0, g.x); y0 = Math.min(y0, g.y); x1 = Math.max(x1, g.x + NC_W); y1 = Math.max(y1, g.y + (g.h || 70)); });
    var z = Math.min(1.1, Math.max(0.3, Math.min((r.width - 80) / (x1 - x0), (r.height - 110) / (y1 - y0))));
    nc.z = z;
    nc.pan.x = (r.width - (x1 - x0) * z) / 2 - x0 * z;
    nc.pan.y = 56 + ((r.height - 110) - (y1 - y0) * z) / 2 - y0 * z;
    ncApplyView();
  }
  // จัดเรียงใหม่ทั้งผืน: ล้างตำแหน่งทุกโหนดแล้วให้ ncAutoPos วางใหม่ (กฎเรียงลงมาทีละกฎ ลูกเรียงเป็นคอลัมน์ทางขวา)
  async function ncTidy() {
    if (!(await Tk.confirmDialog(Tk.t('จัดเรียงโหนดทั้งผืนใหม่? ตำแหน่งที่ลากจัดไว้จะถูกแทนที่'), Tk.t('จัดเรียง')))) return;
    function clear(rs) { (rs || []).forEach(function (r) { if (!r) return; delete r._nx; delete r._ny; (r.branches || []).forEach(function (b) { clear(b && b.responses); }); }); }
    ncActions().forEach(function (a) { if (!a) return; delete a._x; delete a._y; clear(a.responses); });
    ncDrafts().forEach(function (d) { if (d) clear(d.responses); });
    nc.fitted = false;
    renderNodes();
  }
  function ncToWorld(cx, cy) {
    var r = nc.stage.getBoundingClientRect();
    return { x: (cx - r.left - nc.pan.x) / nc.z, y: (cy - r.top - nc.pan.y) / nc.z };
  }

  function ncBindStage() {
    var st = nc.stage;
    // ล้อเมาส์ = เลื่อนผืน · Ctrl/⌘ + ล้อ (หรือบีบนิ้วบนทัชแพด) = ซูมรอบตำแหน่งเมาส์
    st.addEventListener('wheel', function (e) {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        var r = st.getBoundingClientRect();
        ncZoomAt(nc.z * Math.pow(1.0015, -e.deltaY), e.clientX - r.left, e.clientY - r.top);
      } else { nc.pan.x -= e.deltaX; nc.pan.y -= e.deltaY; ncApplyView(); }
    }, { passive: false });
    st.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      if (e.target.closest('.nc-toolbar, .nc-menu, .nc-test, .nc-del, .nc-cut, .toggle')) return;
      ncCloseMenu();
      var node = e.target.closest('.nc-node');
      if (e.target.classList.contains('nc-port') && node) { ncStartWire(e, node, e.target); return; }
      if (node) { ncNodeDown(e, node); return; }
      // คลิกสาย = เลือกสาย (กด Delete หรือปุ่มกลางสายเพื่อตัด)
      if (e.target.classList.contains('nc-wire-hit')) { ncSelect(null, { a: e.target.getAttribute('data-a'), to: e.target.getAttribute('data-to') }); return; }
      // พื้นว่าง = ลากเลื่อนผืน · คลิกเฉยๆ = เลิกเลือก
      var sx = e.clientX, sy = e.clientY, px = nc.pan.x, py = nc.pan.y, moved = false;
      st.classList.add('panning');
      function mm(ev) {
        moved = moved || Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 3;
        nc.pan.x = px + ev.clientX - sx; nc.pan.y = py + ev.clientY - sy; ncApplyView();
      }
      function mu() {
        document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu);
        st.classList.remove('panning');
        if (!moved) ncSelect(null);
      }
      document.addEventListener('mousemove', mm); document.addEventListener('mouseup', mu);
    });
    st.addEventListener('dblclick', function (e) {
      var node = e.target.closest('.nc-node'), g = node && nc.geo[node.dataset.key], o = g && ncById(g.a);
      if (!o) return;
      if (!o.trigger) { ncEditDraft(o); return; }
      window.ActionsEditor.open(o, function (u) { saveActionById(o.id, u); });
    });
    st.addEventListener('click', function (e) {
      var del = e.target.closest('.nc-del');
      if (del) { e.stopPropagation(); ncDelete(del.closest('.nc-node').dataset.key); }
    });
    // ผูกกับ document ครั้งเดียว — ผืนถูกสร้างใหม่ทุกครั้งที่สลับภาษา ผูกซ้ำแล้วกด Delete ทีเดียวจะลบหลายรอบ
    if (nc.keyBound) return;
    nc.keyBound = true;
    document.addEventListener('keydown', function (e) {
      if ((!nc.sel && !nc.selWire) || $('#actionsNodes').hidden || ncModalOpen()) return;
      if (/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (nc.selWire) ncCut(nc.selWire.a, nc.selWire.to); else ncDelete(nc.sel);
      } else if (e.key === 'Escape') { ncSelect(null); ncCloseMenu(); }
    });
  }

  // เลือกได้ทีละอย่าง: โหนด (key) หรือสาย (wire = {a, to})
  function ncSelect(key, wire) {
    nc.sel = key;
    $$('.nc-node.selected', nc.layer).forEach(function (n) { n.classList.remove('selected'); });
    if (key && nc.geo[key] && nc.geo[key].el) nc.geo[key].el.classList.add('selected');
    if (!nc.selWire && !wire) return;
    nc.selWire = wire || null;
    ncDrawWires();
    if (nc.heat) ncPaintHeat();
  }
  // ดับเบิลคลิกโหนดที่ยังไม่ได้ต่อ = ตั้งค่าได้เลย ไม่ต้องต่อกับเหตุการณ์ก่อน
  function ncEditDraft(d) {
    window.ActionsEditor.open(d, function (u) {
      var cur = ncById(d.id);
      if (cur) { cur.responses = u.responses; ncPersist(); }
    }, { stepsOnly: true });
  }
  // กดโหนดแล้วลาก = ย้ายตำแหน่งเฉยๆ สายไม่เปลี่ยน · ลากเหตุการณ์ = ทั้งกฎตามไปด้วย (กด Alt ค้าง = ย้ายแค่เหตุการณ์)
  function ncNodeDown(e, node) {
    var key = node.dataset.key, g = nc.geo[key], o = g && ncById(g.a);
    if (!o) return;
    ncSelect(key);
    var whole = g.path === 't' && !e.altKey;
    var group = Object.keys(nc.geo).filter(function (k) { return k === key || (whole && nc.geo[k].a === o.id); })
      .map(function (k) { return { k: k, x: nc.geo[k].x, y: nc.geo[k].y }; });
    var sx = e.clientX, sy = e.clientY, moved = false;
    function mm(ev) {
      var dx = (ev.clientX - sx) / nc.z, dy = (ev.clientY - sy) / nc.z;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 4) return;
      if (!moved) { moved = true; node.classList.add('moving'); }
      group.forEach(function (b) {
        var gg = nc.geo[b.k];
        gg.x = Math.round(b.x + dx); gg.y = Math.round(b.y + dy);
        gg.el.style.left = gg.x + 'px'; gg.el.style.top = gg.y + 'px';
      });
      ncDrawWires();
      if (nc.heat) ncPaintHeat();
    }
    function mu() {
      document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu);
      node.classList.remove('moving');
      if (!moved) return;
      group.forEach(function (b) {
        var gg = nc.geo[b.k];
        if (gg.path === 't') { o._x = gg.x; o._y = gg.y; return; }
        var r = ncStepAt(o, gg.path);
        if (r) { r._nx = gg.x; r._ny = gg.y; }
      });
      ncSaveQuiet();
    }
    document.addEventListener('mousemove', mm); document.addEventListener('mouseup', mu);
  }
  async function ncDelete(key) {
    var g = nc.geo[key], a = g && ncById(g.a);
    if (!a) return;
    if (g.path === 't') {
      if (await Tk.confirmDialog(Tk.t('ลบ Action "{name}" ทั้งชุด?', { name: actionTitle(a) }), Tk.t('ลบ'))) deleteActionById(a.id);
      return;
    }
    var h = ncHolder(a, g.path), r = h && h.list[h.index];
    if (!r) return;
    var kids = (r.branches || []).some(function (b) { return b && (b.responses || []).length; });
    if (kids && !(await Tk.confirmDialog(Tk.t('ขั้นนี้มีทางย่อยอยู่ — ลบพร้อมทุกอย่างในทางย่อย?'), Tk.t('ลบ')))) return;
    h.list.splice(h.index, 1);   // ขั้นก่อนหน้าต่อกับขั้นถัดไปเองโดยอัตโนมัติ (ลำดับในลิสต์)
    nc.sel = null;
    ncPersist();
  }

  // ---------- แผงซ้าย: หยิบเหตุการณ์ / การกระทำ / ของขวัญ ลากลงผืน ----------
  // เหตุการณ์ยอดฮิตของไลฟ์ TikTok — ลากทีเดียวได้กฎที่ตั้งค่ามาให้แล้ว ไม่ต้องเข้าไปตั้งเอง
  var NC_TRIG_PRESETS = [
    { g: 'ของขวัญ', t: { type: 'gift', repeatCombo: true }, label: 'ของขวัญ (ทุกชิ้น)', desc: 'มีคนส่งของขวัญ' },
    { g: 'ของขวัญ', t: { type: 'gift', minRepeat: 10 }, label: 'คอมโบ x10 ขึ้นไป', desc: 'ส่งของขวัญมาทีเดียว x10+' },
    { g: 'จากผู้ชม', t: { type: 'like', likeMode: 'total', likeThreshold: 1000 }, label: 'ครบทุก 1,000 ไลก์', desc: 'ยอดไลก์รวมทั้งห้อง' },
    { g: 'จากผู้ชม', t: { type: 'like', likeMode: 'perUser', likeThreshold: 100 }, label: 'คนเดียวกดครบ 100 ไลก์', desc: 'นับรายคน' },
    { g: 'จากผู้ชม', t: { type: 'chat', keyword: '' }, label: 'แชท', desc: 'มีข้อความ (ใส่คำสั่งทีหลังได้)' },
    { g: 'จากผู้ชม', t: { type: 'follow' }, label: 'ติดตาม', desc: 'มีผู้ติดตามใหม่' },
    { g: 'จากผู้ชม', t: { type: 'share' }, label: 'แชร์', desc: 'มีคนแชร์ไลฟ์' },
    { g: 'จากผู้ชม', t: { type: 'subscribe' }, label: 'สมาชิก', desc: 'มีสมาชิกใหม่' },
    { g: 'จากผู้ชม', t: { type: 'member' }, label: 'เข้าห้อง', desc: 'มีคนเข้าห้อง' },
    { g: 'จากสถิติไลฟ์', t: { type: 'topChange' }, label: 'Top 1 เปลี่ยนคน', desc: 'มีคนแซงขึ้นอันดับ 1' },
    { g: 'จากสถิติไลฟ์', t: { type: 'goalReached' }, label: 'ถึงเป้าหมาย', desc: 'ไลก์/เพชร/ผู้ติดตามถึงเป้า' },
    { g: 'จากในโปรแกรม', t: { type: 'hotkey' }, label: 'คีย์ลัด', desc: 'กดคีย์จากคีย์บอร์ด' },
    { g: 'จากในโปรแกรม', t: { type: 'wheelResult' }, label: 'Roulette ออกผล', desc: 'Roulette สุ่มได้รางวัล' },
    { g: 'จากในโปรแกรม', t: { type: 'randomWheelResult' }, label: 'Random Wheel ออกผล', desc: 'วงล้อกลมหมุนได้รางวัล' }
  ];
  var ncGiftsP = null;
  function ncGiftList() {
    return ncGiftsP || (ncGiftsP = invoke('gifts:list', {}, { toast: false })
      .then(function (l) { return Array.isArray(l) ? l : []; }).catch(function () { ncGiftsP = null; return []; }));
  }
  function ncBuildPalette() {
    var q = el('input', { type: 'search', class: 'nc-pal-search', placeholder: Tk.t('ค้นหา…'), 'aria-label': Tk.t('ค้นหาในแผง') });
    var tabs = el('div', { class: 'nc-pal-tabs', role: 'tablist' });
    var list = el('div', { class: 'nc-pal-list' });
    nc.palTab = nc.palTab || 'trig';
    [['trig', 'เหตุการณ์'], ['resp', 'การกระทำ'], ['gift', 'ของขวัญ']].forEach(function (t) {
      var b = el('button', { class: 'nc-pal-tab', type: 'button', role: 'tab', text: Tk.t(t[1]) });
      b.dataset.tab = t[0];
      b.addEventListener('click', function () { nc.palTab = t[0]; draw(); });
      tabs.appendChild(b);
    });
    function item(icon, color, name, desc, payload) {
      var it = el('div', { class: 'nc-pal-item', style: '--nc:' + color, title: Tk.t(desc || name) }, [
        el('span', { class: 'nc-ico' }, [window.Icon.el(icon, 14)]),
        el('div', { class: 'nc-pal-text' }, [el('div', { class: 'nc-pal-name', text: Tk.t(name) }),
          desc ? el('div', { class: 'nc-pal-desc', text: Tk.t(desc) }) : null])
      ]);
      it.addEventListener('mousedown', function (e) { ncPalDrag(e, payload); });
      return it;
    }
    function draw() {
      $$('.nc-pal-tab', tabs).forEach(function (b) { b.classList.toggle('active', b.dataset.tab === nc.palTab); });
      list.innerHTML = '';
      var needle = q.value.trim().toLowerCase();
      function hit(s) { return !needle || String(Tk.t(s || '')).toLowerCase().indexOf(needle) >= 0 || String(s || '').toLowerCase().indexOf(needle) >= 0; }
      if (nc.palTab === 'trig') {
        var lastG = null;
        NC_TRIG_PRESETS.forEach(function (p) {
          if (!hit(p.label) && !hit(p.desc)) return;
          var m = TRIG_META[p.t.type] || { icon: 'info', color: 'var(--accent)' };
          if (p.g !== lastG) { lastG = p.g; list.appendChild(el('div', { class: 'nc-pal-group', style: '--gc:' + m.color, text: Tk.t(p.g) })); }
          list.appendChild(item(m.icon, m.color, p.label, p.desc, { kind: 'trig', trigger: p.t, label: p.label, icon: m.icon }));
        });
      } else if (nc.palTab === 'resp') {
        var AE = window.ActionsEditor;
        AE.RESP_GROUPS.forEach(function (g) {
          var metas = g.items.map(function (v) { return AE.RESP_TYPES.filter(function (x) { return x.v === v; })[0]; })
            .filter(function (m) { return m && (hit(m.t) || hit(m.desc)); });
          if (!metas.length) return;
          list.appendChild(el('div', { class: 'nc-pal-group', style: '--gc:' + ncRespColor(g.items[0]), text: Tk.t(g.label) }));
          metas.forEach(function (m) { list.appendChild(item(m.icon, ncRespColor(m.v), m.t, m.desc, { kind: 'resp', type: m.v, label: m.t, icon: m.icon })); });
        });
      } else {
        ncGiftList().then(function (all) {
          if (nc.palTab !== 'gift') return;
          // ของขวัญกลาง (แผงมาตรฐานของ TikTok) เป็นหลัก — ของคัสตอมของครีเอเตอร์มีเป็นหมื่นชิ้น เปิดดูเมื่อต้องการ
          function official(g) { return g.source ? g.source === 1 : (g.id || 0) < 20000; }
          function match(g) { return !needle || g.name.toLowerCase().indexOf(needle) >= 0 ||
            (g.aliases || []).some(function (x) { return String(x).toLowerCase().indexOf(needle) >= 0; }); }
          var main = all.filter(function (g) { return official(g) && match(g); });
          var custom = (needle || nc.palCustom) ? all.filter(function (g) { return !official(g) && match(g); }) : [];
          function section(title, rows, cap) {
            if (!rows.length) return;
            list.appendChild(el('div', { class: 'nc-pal-group', style: '--gc:' + ((TRIG_META.gift || {}).color || 'var(--accent)'), text: title }));
            var grid = el('div', { class: 'nc-gift-grid' });
            rows.slice(0, cap).forEach(function (g) {
              var c = el('div', { class: 'nc-gift', title: g.name + ' · ' + g.coins + '💎' }, [
                g.image ? el('img', { src: g.image, alt: '', loading: 'lazy' }) : el('span', { class: 'nc-gift-emo', text: '🎁' }),
                el('span', { class: 'nc-gift-name', text: g.name }), el('small', { text: fmt(g.coins) + '💎' })]);
              c.addEventListener('mousedown', function (e) { ncPalDrag(e, { kind: 'gift', gift: g, label: g.name, image: g.image }); });
              grid.appendChild(c);
            });
            list.appendChild(grid);
            if (rows.length > cap) list.appendChild(el('div', { class: 'nc-pal-more', text: Tk.t('แสดง {a} จาก {n} ชิ้น — พิมพ์ค้นหาเพื่อหาชิ้นอื่น', { a: cap, n: rows.length }) }));
          }
          section(Tk.t('ของขวัญกลาง'), main, needle ? 60 : 240);
          section(Tk.t('ของขวัญคัสตอม'), custom, 60);
          if (!needle) list.appendChild(el('button', { class: 'nc-pal-toggle', type: 'button',
            text: nc.palCustom ? Tk.t('ซ่อนของขวัญคัสตอม') : Tk.t('แสดงของขวัญคัสตอมด้วย'),
            onclick: function () { nc.palCustom = !nc.palCustom; draw(); } }));
          if (!main.length && !custom.length) list.appendChild(el('div', { class: 'nc-pal-more', text: Tk.t('ไม่พบของขวัญ') }));
        });
      }
    }
    q.addEventListener('input', debounce(draw, 120));
    nc.palette.appendChild(el('div', { class: 'nc-pal-top' }, [q, tabs]));
    nc.palette.appendChild(list);
    nc.palette.appendChild(el('div', { class: 'nc-pal-foot', text: Tk.t('คลิกหรือลากลงผืน · ลากของขวัญไปวางบนเหตุการณ์ = ส่งของขวัญจำลองดูผลทันที · ลากไฟล์เสียง/วิดีโอจากเครื่องมาวางได้เลย') }));
    draw();
  }

  // ลากจากแผง: เงาตามเมาส์ + ไฮไลต์จุดที่จะวาง (ใช้เมาส์เอง ไม่ใช้ HTML5 drag — คุมเงา/การซูมได้ละเอียดกว่า)
  function ncPalDrag(e, payload) {
    if (e.button !== 0) return;
    e.preventDefault();
    var sx = e.clientX, sy = e.clientY, ghost = null;
    function mm(ev) {
      if (!ghost && Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < 4) return;
      if (!ghost) {
        ghost = el('div', { class: 'nc-ghost' }, [payload.image ? el('img', { src: payload.image, alt: '' }) : window.Icon.el(payload.icon || 'plus', 14),
          el('span', { text: Tk.t(payload.label) })]);
        document.body.appendChild(ghost);
      }
      ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px';
      ncHover(ev.clientX, ev.clientY);
    }
    function mu(ev) {
      document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu);
      ncHover(null);
      if (!ghost) { ncQuickAdd(payload); return; }   // คลิกเฉยๆ = วางให้เลย
      ghost.remove();
      ncDrop(payload, ncTargetAt(ev.clientX, ev.clientY), ev.clientX, ev.clientY);
    }
    document.addEventListener('mousemove', mm); document.addEventListener('mouseup', mu);
  }
  // ใต้เมาส์คืออะไร: โหนด (+ จุดต่อทางไหน) / สาย / พื้นว่าง / null = นอกผืน
  function ncTargetAt(cx, cy) {
    var r = nc.stage.getBoundingClientRect();
    if (cx < r.left || cx > r.right || cy < r.top || cy > r.bottom) return null;
    var hit = document.elementFromPoint(cx, cy);
    if (!hit || !nc.stage.contains(hit) || hit.closest('.nc-toolbar, .nc-menu')) return null;
    var node = hit.closest('.nc-node');
    if (node) { var brow = hit.closest('.nc-brow'); return { node: node.dataset.key, branch: brow ? Number(brow.dataset.b) : null }; }
    if (hit.classList && hit.classList.contains('nc-wire-hit')) return { wireA: hit.getAttribute('data-a'), wireTo: hit.getAttribute('data-to') };
    return { empty: true };
  }
  function ncHover(cx, cy) {
    $$('.nc-node.drop-ok', nc.layer).forEach(function (n) { n.classList.remove('drop-ok'); });
    $$('.nc-wire.hover', nc.svg).forEach(function (w) { w.classList.remove('hover'); });
    if (cx == null) return null;
    var t = ncTargetAt(cx, cy);
    if (t && t.node && nc.geo[t.node] && nc.geo[t.node].el) nc.geo[t.node].el.classList.add('drop-ok');
    if (t && t.wireA) { var w = nc.svg.querySelector('.nc-wire[data-a="' + t.wireA + '"][data-to="' + t.wireTo + '"]'); if (w) w.classList.add('hover'); }
    return t;
  }
  function ncNewStep(type) { return window.ActionsEditor.newResponse(type); }
  // จุดที่ของใหม่จะไปต่อเมื่อวาง/ลากสายมาที่ t
  // เหตุการณ์ · หน่วงเวลา · แถวทางของสุ่มทาง/ถ้า/วงล้อ = เป็นลูกของมัน (hub) — ลูกทุกตัวของจุดเดียวกันทำพร้อมกัน
  // โหนดอื่น = ทำพร้อมโหนดนั้น (อยู่ลิสต์เดียวกัน ถัดจากมัน) (sib)
  function ncHubList(t) {
    var g = nc.geo[t.node], o = g && ncById(g.a);
    if (!o) return null;
    if (g.path === 't') { o.responses = o.responses || []; return { a: o, list: o.responses, index: o.responses.length, hub: t.node }; }
    var h = ncHolder(o, g.path), r = h && h.list[h.index];
    if (!r) return null;
    var bi = t.branch != null ? t.branch : (r.type === 'delay' ? 0 : null);
    if (bi != null && NC_BRANCHY[r.type]) {
      r.branches = r.branches || [];
      var b = r.branches[bi] || (r.branches[bi] = { responses: [] });
      b.responses = b.responses || [];
      return { a: o, list: b.responses, index: b.responses.length, hub: t.node };
    }
    return { a: o, list: h.list, index: h.index + 1, sib: t.node };
  }
  // วางบนสาย จุดต่อ → X: หน่วงเวลา/สุ่มทาง/ถ้า = คั่นกลาง (X ย้ายไปอยู่ใต้มัน) · อย่างอื่น = ทำพร้อม X
  function ncDropOnWire(step, aId, path) {
    var o = ncById(aId), h = o && ncHolder(o, path), x = h && h.list[h.index];
    if (!x) return;
    if (NC_WRAP[step.type] && step.branches && step.branches[0]) {
      step._nx = x._nx; step._ny = x._ny;
      ncShiftTree(x, NC_W + NC_GX);
      step.branches[0].responses = [x];
      h.list[h.index] = step;
    } else {
      ncAppendPos({ list: h.list, sib: aId + ':' + path }, step);
      h.list.splice(h.index + 1, 0, step);
    }
    ncPersist();
    ncSelect(ncKeyOf(step));
  }
  function ncShiftTree(r, dx) {
    if (!r) return;
    if (r._nx != null) r._nx += dx;
    (r.branches || []).forEach(function (b) { ((b && b.responses) || []).forEach(function (c) { ncShiftTree(c, dx); }); });
  }
  function ncDrop(p, t, cx, cy, pos) {   // pos = มุมซ้ายบนบนผืนที่หาไว้ให้แล้ว (คลิกในแผง)
    if (!t) return;
    var tg = t.node && nc.geo[t.node], to = tg && ncById(tg.a), w = ncToWorld(cx, cy);
    if (p.kind === 'gift' && tg && tg.path === 't') {
      // โยนของขวัญใส่เหตุการณ์ = ส่งของขวัญจำลองเข้าระบบจริง ทุกกฎที่ตรงเงื่อนไขทำงานพร้อมไฟวิ่งให้ดู
      var g = p.gift;
      invoke('simulate', { type: 'gift', overrides: { giftName: g.name, giftId: g.id, diamondCount: g.coins, giftPictureUrl: g.image || '', repeatCount: 1 } })
        .then(function () { toast(Tk.t('ส่ง {gift} จำลองแล้ว — กฎที่ตรงเงื่อนไขจะเรืองแสง', { gift: g.name }), 'ok'); });
      return;
    }
    if (p.kind === 'trig' || p.kind === 'gift') {
      // พื้นว่าง = กฎใหม่ตรงนั้น · บนโหนดที่ยังไม่ได้ต่อ = กฎใหม่ที่ทำโหนดนั้น (เหตุการณ์ไปอยู่ทางซ้ายของมัน)
      var tail = [], x = pos ? pos.x : Math.round(w.x - 30), y = pos ? pos.y : Math.round(w.y - 24);
      if (to && !to.trigger) {
        var h = ncHolder(to, tg.path);
        tail = h ? h.list.splice(h.index, 1) : [];
        if (tail[0] && tail[0]._nx != null) { var fs = ncFreeSpot(tail[0]._nx - NC_W - NC_GX, tail[0]._ny); x = fs.x; y = fs.y; }
      } else if (!t.empty) { toast(Tk.t('วางเหตุการณ์บนพื้นว่าง หรือบนโหนดที่ยังไม่ได้ต่อ เพื่อสร้างกฎใหม่'), ''); return; }
      var trig = p.kind === 'gift'
        ? { type: 'gift', giftName: p.gift.name, giftId: p.gift.id, minDiamonds: 0, repeatCombo: true }
        : JSON.parse(JSON.stringify(p.trigger));
      var a = { id: ncNewId('a'), name: '', enabled: true, cooldownSec: 0, trigger: trig, responses: tail, _x: x, _y: y };
      S.settings.actions = ncActions();
      S.settings.actions.push(a);
      nc.sel = a.id + ':t';
      ncPersist();
      if (trig.type === 'hotkey') setTimeout(function () { window.ActionsEditor.open(a, function (u) { saveActionById(a.id, u); }); }, 60);
      return;
    }
    var step = p.step || ncNewStep(p.type);
    if (t.empty) {
      // วางลอยไว้ก่อน (ยังไม่ทำงาน) แล้วค่อยลากสายจากเหตุการณ์/โหนดอื่นมาต่อ
      step._nx = pos ? pos.x : Math.round(w.x - 20); step._ny = pos ? pos.y : Math.round(w.y - 25);
      var d = { id: ncNewId('d'), responses: [step] };
      ncDrafts().push(d);
      nc.sel = d.id + ':0';
      ncPersist();
      return;
    }
    if (t.wireA) { ncDropOnWire(step, t.wireA, t.wireTo); return; }
    var ins = ncHubList(t);
    if (!ins) return;
    ncAppendPos(ins, step);
    ins.list.splice(ins.index, 0, step);
    ncPersist();
    ncSelect(ncKeyOf(step));   // โหนดใหม่ถูกเลือก → คลิกของในแผงต่อได้เรื่อยๆ
  }
  // คลิกของในแผง (ไม่ลาก) = วางให้เลย: การกระทำต่อจากโหนดที่เลือกอยู่ · ไม่ได้เลือกอะไร = จุดว่างใกล้กลางจอที่สุด
  function ncQuickAdd(p) {
    var r = nc.stage.getBoundingClientRect(), c = ncToWorld(r.left + r.width / 2, r.top + r.height / 2);
    var t = (p.kind === 'resp' || p.kind === 'file') && nc.sel && nc.geo[nc.sel] ? { node: nc.sel, branch: null } : { empty: true };
    ncDrop(p, t, 0, 0, ncFreeSpot(Math.round(c.x - NC_W / 2), Math.round(c.y - 40)));
  }
  // จุดว่างที่ใกล้ (x, y) ที่สุด (ไล่จากใกล้ไปไกล ตารางละ 60×40) — ไม่ให้โหนดใหม่ไปทับโหนดที่มีอยู่
  function ncFreeSpot(x, y) {
    var cand = [], keys = Object.keys(nc.geo);
    for (var i = -12; i <= 12; i++) for (var j = -12; j <= 12; j++) cand.push([i * 60, j * 40]);
    // ถอยไปทางซ้ายแพงกว่า — แถวที่ต่อกันจะได้ไหลไปทางขวา/ลงล่าง ไม่ย้อนกลับไปทับฝั่งต้นทาง
    function cost(c) { return (c[0] < 0 ? 4 : 1) * c[0] * c[0] + c[1] * c[1]; }
    cand.sort(function (a, b) { return cost(a) - cost(b); });
    for (var k = 0; k < cand.length; k++) {
      var px = x + cand[k][0], py = y + cand[k][1];
      if (!keys.some(function (key) {
        var g = nc.geo[key];
        return px < g.x + NC_W + 16 && px + NC_W + 16 > g.x && py < g.y + (g.h || 70) + 16 && py + 86 > g.y;
      })) return { x: px, y: py };
    }
    return { x: x, y: y };
  }
  // ตำแหน่งโหนดใหม่: ลูกของจุดต่อ = คอลัมน์ทางขวาของมัน ต่อใต้ลูกที่มีอยู่ · ทำพร้อมโหนดไหน = ใต้โหนดนั้น — ทับของเดิมก็หาที่ว่างใกล้ๆ
  function ncAppendPos(ins, step) {
    var g = nc.geo[ins.hub || ins.sib];
    if (!g) return;
    var x = g.x, y = g.y + (g.h || 70) + NC_GY;
    if (ins.hub) {
      x = g.x + NC_W + NC_GX; y = g.y;
      ins.list.forEach(function (r) { var k = r && ncKeyOf(r), rg = k && nc.geo[k]; if (rg) y = Math.max(y, rg.y + (rg.h || 70) + NC_GY); });
    }
    var p = ncFreeSpot(x, y);
    step._nx = p.x; step._ny = p.y;
  }
  // key ของขั้น obj บนผืนตอนนี้ (หาจากตัววัตถุ เพราะ path เปลี่ยนทุกครั้งที่แทรก/ย้าย)
  function ncKeyOf(obj) {
    return Object.keys(nc.geo).filter(function (k) { var g = nc.geo[k], o = ncById(g.a); return g.path !== 't' && o && ncStepAt(o, g.path) === obj; })[0] || null;
  }
  // ลากไฟล์เสียง/วิดีโอจากเครื่องมาวางบนโหนด — คัดลอกเข้าคลังของโปรแกรมก่อน แล้วสร้างขั้นเล่นไฟล์นั้น
  function ncBindFiles() {
    var st = nc.stage;
    function hasFiles(e) { return e.dataTransfer && [].indexOf.call(e.dataTransfer.types || [], 'Files') >= 0; }
    st.addEventListener('dragover', function (e) { if (!hasFiles(e)) return; e.preventDefault(); st.classList.add('file-over'); ncHover(e.clientX, e.clientY); });
    st.addEventListener('dragleave', function (e) { if (!st.contains(e.relatedTarget)) { st.classList.remove('file-over'); ncHover(null); } });
    st.addEventListener('drop', function (e) {
      if (!hasFiles(e)) return;
      e.preventDefault(); st.classList.remove('file-over'); ncHover(null);
      var f = e.dataTransfer.files[0], ext = (String(f && f.name).split('.').pop() || '').toLowerCase();
      var kind = /^(mp3|wav|ogg|m4a)$/.test(ext) ? 'sound' : (/^(mp4|webm|mov|m4v)$/.test(ext) ? 'video' : null);
      if (!kind) { toast(Tk.t('รองรับเฉพาะไฟล์เสียง (mp3/wav/ogg/m4a) หรือวิดีโอ (mp4/webm/mov)'), 'err'); return; }
      var t = ncTargetAt(e.clientX, e.clientY);
      if (!t) return;
      var path = window.tikkies && window.tikkies.pathForFile ? window.tikkies.pathForFile(f) : '';
      if (!path) { toast(Tk.t('อ่านตำแหน่งไฟล์ไม่ได้'), 'err'); return; }
      invoke('media:importPath', { path: path }).then(function (url) {
        if (!url) { toast(Tk.t('นำเข้าไฟล์ไม่สำเร็จ'), 'err'); return; }
        var step = ncNewStep(kind);
        step.url = url;
        ncDrop({ kind: 'file', step: step }, t, e.clientX, e.clientY);
      });
    });
  }

  // ---------- ลากสาย ----------
  // จากวงกลมขวา (ขาออก) ไปปล่อยบนโหนดไหน = โหนดนั้น (กับขั้นที่ตามหลังมัน) มาทำงานต่อจากตรงนี้
  // ปล่อยบนพื้นว่าง = เมนูเลือกการกระทำใหม่ วางตรงที่ปล่อย · ลากจากวงกลมซ้าย (ขาเข้า) ย้อนไปหาโหนดต้นทางก็ได้
  function ncStartWire(e, node, port) {
    e.preventDefault(); e.stopPropagation();
    var key = node.dataset.key, rev = port.classList.contains('in'), brow = port.closest('.nc-brow');
    var src = { node: key, branch: brow ? Number(brow.dataset.b) : null };
    var p = rev ? ncIn(key) : ncPort(key, src.branch == null ? 'out' : src.branch);
    if (!p) return;
    ncSelect(null);
    port.classList.add('active');
    var temp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    temp.setAttribute('class', 'nc-wire temp');
    nc.svg.appendChild(temp);
    function mm(ev) {
      var q = ncToWorld(ev.clientX, ev.clientY);
      temp.setAttribute('d', rev ? ncCurve(q, p) : ncCurve(p, q));
      ncHover(ev.clientX, ev.clientY);
    }
    function mu(ev) {
      document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu);
      port.classList.remove('active'); temp.remove(); ncHover(null);
      var t = ncTargetAt(ev.clientX, ev.clientY);
      if (!t || !nc.geo[key]) return;
      if (t.node && t.node !== key) {
        if (rev) ncConnect({ node: t.node, branch: t.branch }, key);
        else ncConnect(src, t.node);
      } else if (t.empty && !rev) ncOpenMenu(ev.clientX, ev.clientY, src);
    }
    document.addEventListener('mousemove', mm); document.addEventListener('mouseup', mu);
  }
  // ต่อสาย src → โหนด toKey: โหนดนั้น (พร้อมทุกอย่างที่อยู่ใต้มัน) ย้ายมาเป็นลูกของจุดต่อ src — ทำพร้อมลูกตัวอื่นของจุดเดียวกัน
  function ncConnect(src, toKey) {
    var tg = nc.geo[toKey], to = tg && ncById(tg.a);
    if (!to) return;
    if (tg.path === 't') { toast(Tk.t('ต่อสายเข้าเหตุการณ์ไม่ได้ — เหตุการณ์เป็นจุดเริ่มของกฎ'), ''); return; }
    var ins = ncHubList(src), from = ncHolder(to, tg.path), node = from && from.list[from.index];
    if (!ins || !node) return;
    if (!ins.hub) { toast(Tk.t('ต่อสายได้จากเหตุการณ์ "หน่วงเวลา" หรือทางของสุ่มทาง/ถ้า เท่านั้น'), ''); return; }
    if (from.list === ins.list) return;   // ต่ออยู่แล้ว
    // จุดต่อต้องไม่อยู่ใต้โหนดที่จะย้าย ไม่งั้นกลายเป็นวงวนเข้าหาตัวเอง
    if (ncChainObjs(src.node).indexOf(node) >= 0) { toast(Tk.t('ต่อวนกลับเข้าหาตัวเองไม่ได้'), 'err'); return; }
    from.list.splice(from.index, 1);
    ins.list.push(node);
    ncPersist();
  }
  // ขั้นทั้งหมดบนทางจากรากถึงโหนด key (รวมตัวมันเอง) — เหตุการณ์ไม่มี
  function ncChainObjs(key) {
    var g = nc.geo[key], o = g && ncById(g.a), out = [];
    if (!o || g.path === 't') return out;
    var parts = String(g.path).split('/').map(Number), list = o.responses || [];
    for (var i = 0; i < parts.length; i += 2) {
      var r = list[parts[i]];
      if (!r) break;
      out.push(r);
      var b = r.branches && r.branches[parts[i + 1]];
      list = (b && b.responses) || [];
    }
    return out;
  }
  // ตัดสายที่พุ่งเข้า path: โหนดนั้น (พร้อมทุกอย่างที่อยู่ใต้มัน) หลุดเป็นโหนดลอยอยู่ที่เดิม (ไม่ทำงานจนกว่าจะต่อใหม่)
  function ncCut(aId, path) {
    var o = ncById(aId), h = o && ncHolder(o, path);
    if (!h || !h.list[h.index]) return;
    ncDrafts().push({ id: ncNewId('d'), responses: h.list.splice(h.index, 1) });
    nc.selWire = null;
    ncPersist();
    toast(Tk.t('ตัดสายแล้ว — โหนดที่หลุดจะไม่ทำงานจนกว่าจะต่อสายใหม่'), '');
  }
  function ncOpenMenu(cx, cy, src) {
    ncCloseMenu();
    var r = nc.stage.getBoundingClientRect(), AE = window.ActionsEditor, w = ncToWorld(cx, cy);
    var m = el('div', { class: 'nc-menu', role: 'menu' });
    AE.RESP_GROUPS.forEach(function (g) {
      m.appendChild(el('div', { class: 'nc-menu-h', text: Tk.t(g.label) }));
      g.items.forEach(function (v) {
        var meta = AE.RESP_TYPES.filter(function (x) { return x.v === v; })[0];
        if (!meta) return;
        var b = el('button', { class: 'nc-menu-item', type: 'button', role: 'menuitem', style: '--nc:' + ncRespColor(v) },
          [el('span', { class: 'nc-ico' }, [window.Icon.el(meta.icon, 13)]), el('span', { text: Tk.t(meta.t) })]);
        b.addEventListener('click', function () {
          ncCloseMenu();
          var ins = ncHubList(src);
          if (!ins) return;
          // โหนดใหม่ไปอยู่ตรงที่ปล่อยสาย ขาเข้าตรงปลายสายพอดี
          var step = ncNewStep(v);
          step._nx = Math.round(w.x + 8); step._ny = Math.round(w.y - 25);
          ins.list.splice(ins.index, 0, step);
          ncPersist();
          ncSelect(ncKeyOf(step));
        });
        m.appendChild(b);
      });
    });
    m.style.left = Math.max(8, Math.min(cx - r.left, r.width - 232)) + 'px';
    m.style.top = Math.max(8, Math.min(cy - r.top, r.height - 340)) + 'px';
    nc.stage.appendChild(m);
    nc.menu = m;
    var first = m.querySelector('.nc-menu-item');
    if (first) first.focus();
  }
  function ncCloseMenu() { if (nc.menu) { nc.menu.remove(); nc.menu = null; } }

  // ---------- ไฟวิ่งตามสายตอนไลฟ์จริง ----------
  function ncFlash(elm) { if (!elm) return; elm.classList.remove('pulse'); void elm.offsetWidth; elm.classList.add('pulse'); }
  function ncLive(id) { return nc.live[id] || (nc.live[id] = { n: 0, d: 0, steps: {} }); }
  function ncOnAction(d) {
    if (!d || !d.actionId) return;
    if (!d.sim) { var s = ncLive(d.actionId); s.n += 1; s.d += Number(d.diamonds) || 0; }
    var g = nc.geo[d.actionId + ':t'];
    if (!g || !g.el) return;
    ncPaintCount(g.el, d.actionId);
    ncFlash(g.el);
    if (nc.heat && nc.heat.live) ncPaintHeat();
  }
  function ncOnStep(d) {
    if (!d || !d.actionId || d.path == null || !nc.svg) return;
    if (!d.sim) { var s = ncLive(d.actionId); s.steps[d.path] = (s.steps[d.path] || 0) + 1; }
    var w = nc.svg.querySelector('.nc-wire[data-a="' + d.actionId + '"][data-to="' + d.path + '"]');
    if (w) {
      w.classList.remove('flow'); void w.getBoundingClientRect(); w.classList.add('flow');
      setTimeout(function () { w.classList.remove('flow'); }, 1300);
    }
    var g = nc.geo[d.actionId + ':' + d.path];
    if (g) ncFlash(g.el);
  }

  // ---------- ยอดทำงาน: แต่ละกฎทำงานกี่ครั้ง/ได้เพชรเท่าไหร่ (ไลฟ์นี้ หรือไลฟ์ย้อนหลังจากบันทึก) ----------
  function ncBindHeat() {
    nc.heatBtn.addEventListener('click', function () {
      if (nc.heat) { nc.heat = null; nc.heatBtn.classList.remove('active'); nc.statBar.hidden = true; ncClearHeat(); return; }
      nc.heatBtn.classList.add('active');
      nc.statBar.hidden = false;
      nc.heat = { live: true };
      invoke('sessions:list', {}, { toast: false }).then(function (list) {
        nc.sessions = (list || []).filter(function (s) { return s && s.actions; }).slice(0, 20);
        nc.heatSel.innerHTML = '';
        nc.heatSel.appendChild(el('option', { value: 'live', text: Tk.t('ไลฟ์นี้ (สด)') }));
        var loc = Tk.i18n && Tk.i18n.current && Tk.i18n.current() === 'en' ? 'en-GB' : 'th-TH';
        nc.sessions.forEach(function (s) {
          var d = new Date(s.startedAt);
          nc.heatSel.appendChild(el('option', { value: s.id, text: d.toLocaleDateString(loc, { day: 'numeric', month: 'short' }) + ' ' +
            d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' }) + ' · ' + fmt(s.totalDiamonds || 0) + '💎' }));
        });
        // ไลฟ์นี้ยังไม่มีอะไรแต่มีไลฟ์ก่อนหน้า → เปิดมาที่ไลฟ์ล่าสุดเลย ไม่ใช่ผืนเงียบๆ
        nc.heatSel.value = Object.keys(nc.live).length || !nc.sessions.length ? 'live' : nc.sessions[0].id;
        ncPickHeat();
      }).catch(function () { ncPickHeat(); });
    });
    nc.heatSel.addEventListener('change', ncPickHeat);
  }
  function ncPickHeat() {
    var v = nc.heatSel.value || 'live';
    if (v === 'live') nc.heat = { live: true };
    else { var s = (nc.sessions || []).filter(function (x) { return x.id === v; })[0]; nc.heat = { live: false, data: (s && s.actions) || {} }; }
    ncPaintHeat();
  }
  function ncClearHeat() {
    $$('.nc-hb', nc.layer).forEach(function (b) { b.remove(); });
    $$('.nc-wire', nc.svg).forEach(function (w) { w.style.strokeWidth = ''; w.style.stroke = ''; });
  }
  function ncPaintHeat() {
    ncClearHeat();
    if (!nc.heat) return;
    var data = nc.heat.live ? nc.live : (nc.heat.data || {}), max = 1;
    Object.keys(data).forEach(function (id) {
      var s = data[id] || {};
      Object.keys(s.steps || {}).forEach(function (p) { max = Math.max(max, s.steps[p]); });
    });
    $$('.nc-wire', nc.svg).forEach(function (w) {
      var s = data[w.getAttribute('data-a')], n = s && s.steps ? (s.steps[w.getAttribute('data-to')] || 0) : 0;
      if (!n) { w.style.stroke = 'color-mix(in srgb, var(--line-strong) 40%, transparent)'; return; }
      var k = n / max;
      w.style.strokeWidth = (2 + k * 7).toFixed(1);
      w.style.stroke = 'color-mix(in srgb, var(--gold) ' + Math.round(35 + k * 65) + '%, var(--accent))';
    });
    Object.keys(nc.geo).forEach(function (key) {
      var g = nc.geo[key];
      if (g.path !== 't' || !g.el) return;
      var s = data[g.a];
      g.el.appendChild(el('span', { class: 'nc-hb', text: s && s.n ? Tk.t('{n} ครั้ง', { n: s.n }) + (s.d ? ' · ' + fmt(s.d) + '💎' : '') : Tk.t('{n} ครั้ง', { n: 0 }) }));
    });
  }

  function setActionsView(v) {
    var isNode = v === 'node';
    $('#viewListBtn').classList.toggle('active', !isNode);
    $('#viewNodeBtn').classList.toggle('active', isNode);
    $('#actionsList').hidden = isNode;
    $('#actionsNodes').hidden = !isNode;
    $('#templatesWrap').hidden = isNode;
    localStorage.setItem('tk.actionsView', v);
    syncActToolbar(((S.settings && S.settings.actions) || []).length > 0);
    if (isNode) renderNodes();
  }

  // ---------- Widgets ----------
  // opts = ตัวเลือกในหน้าแต่งธีม (type: color | bool | number | select | text) — ใส่ลง URL เฉพาะค่าที่ต่างจาก def
  var WIDGETS = [
    { file: 'alerts', icon: 'bell', name: 'Alert Box', desc: 'แจ้งเตือนของขวัญ/ติดตาม/สมาชิก กลางจอ', size: '500 x 300', params: '?gifts=1&follows=1&subs=1 (เปิด/ปิดแต่ละชนิด), ?titlecolor=ff0055 สีข้อความหลัก, ?subcolor=ffffff สีข้อความรอง, ?sound=0 ปิดเสียง, ?debug=1 ปุ่มทดสอบ',
      opts: [
        { k: 'gifts', label: 'แจ้งเตือนของขวัญ', type: 'bool', def: true },
        { k: 'follows', label: 'แจ้งเตือนผู้ติดตาม', type: 'bool', def: true },
        { k: 'subs', label: 'แจ้งเตือนสมาชิก', type: 'bool', def: true },
        { k: 'shares', label: 'แจ้งเตือนแชร์', type: 'bool', def: false },
        { k: 'sound', label: 'เปิดเสียง', type: 'bool', def: true },
        { k: 'duration', label: 'แสดงใบละ (วินาที)', type: 'number', def: 6, min: 3, max: 30 },
        { k: 'mindiamonds', label: 'เพชรขั้นต่ำที่แจ้งเตือน', type: 'number', def: 0, min: 0, max: 99999 },
        { k: 'maxwidth', label: 'ความกว้างสูงสุดของการ์ด (px)', type: 'number', def: '', min: 200, max: 1600 },
        { k: 'mediasize', label: 'ขนาดรูปของขวัญ/โปรไฟล์ (px, 0 = ไม่แสดง)', type: 'number', def: '', min: 0, max: 400 },
        { k: 'titlesize', label: 'ขนาดข้อความหลัก (px)', type: 'number', def: '', min: 10, max: 120 },
        { k: 'subsize', label: 'ขนาดข้อความรอง (px)', type: 'number', def: '', min: 8, max: 60 },
        { k: 'confetti', label: 'เอฟเฟกต์กระดาษโปรย', type: 'bool', def: true },
        { k: 'shine', label: 'แสงกวาดผ่านการ์ด', type: 'bool', def: true },
        { g: 'ข้อความ', k: 'titlecolor', label: 'สีข้อความหลัก', type: 'color', def: '', clearable: true,
          hint: 'ไม่ตั้ง = ไล่เฉดตามสีหลักของธีม · ตั้งแล้วได้สีเดียวล้วนตามที่เลือก' },
        { g: 'ข้อความ', k: 'subcolor', label: 'สีข้อความรอง', type: 'color', def: '', clearable: true },
        { g: 'ข้อความ', k: 'gifttext', label: 'ข้อความตอนได้ของขวัญ', type: 'text', def: '{nickname} ส่ง {gift}',
          hint: 'ตัวแปรที่ใช้ได้: {nickname} ชื่อผู้ชม · {handle} @ชื่อ · {gift} ชื่อของขวัญ · {diamonds} เพชร — จำนวน xN ต่อท้ายให้อัตโนมัติ' },
        { g: 'ข้อความ', k: 'followtext', label: 'ข้อความตอนมีคนติดตาม', type: 'text', def: '{nickname} กดติดตาม ✨',
          hint: 'ตัวแปรที่ใช้ได้: {nickname} ชื่อผู้ชม · {handle} @ชื่อ' },
        { g: 'ข้อความ', k: 'subtext', label: 'ข้อความตอนมีคนสมัครสมาชิก', type: 'text', def: '{nickname} สมัครสมาชิก 🌟',
          hint: 'ตัวแปรที่ใช้ได้: {nickname} ชื่อผู้ชม · {handle} @ชื่อ · {month} เดือนที่' },
        { g: 'ข้อความ', k: 'sharetext', label: 'ข้อความตอนมีคนแชร์', type: 'text', def: '{nickname} แชร์ไลฟ์ 📣',
          hint: 'ตัวแปรที่ใช้ได้: {nickname} ชื่อผู้ชม · {handle} @ชื่อ' }
      ] },
    { file: 'video', icon: 'video', name: 'วิดีโอ', desc: 'เล่นคลิปสั้นกลางฉากเมื่อ Action ทำงาน', size: '1920 x 1080', params: '?maxsec=10 ยาวสุดต่อคลิป, ?width=60 ความกว้าง %, ?pos=center|top|bottom, ?queue=0 ไม่ต่อคิว, ?debug=1 ปุ่มทดสอบ',
      opts: [
        { k: 'maxsec', label: 'เล่นคลิปละไม่เกิน (วินาที)', type: 'number', def: 10, min: 1, max: 60,
          hint: 'เพดานของฉาก — Action ตั้งสั้นกว่านี้ได้ แต่ตั้งยาวกว่าไม่ได้' },
        { k: 'width', label: 'ความกว้างคลิป (% ของกรอบ)', type: 'number', def: 60, min: 10, max: 100 },
        { k: 'volume', label: 'ระดับเสียงเริ่มต้น (0-100)', type: 'number', def: 100, min: 0, max: 100 },
        { k: 'pos', label: 'ตำแหน่ง', type: 'select', def: '', options: [
          { v: '', t: 'กลางจอ' }, { v: 'top', t: 'บน' }, { v: 'bottom', t: 'ล่าง' },
          { v: 'left', t: 'ซ้าย' }, { v: 'right', t: 'ขวา' } ] },
        { k: 'queue', label: 'คลิปที่มาระหว่างเล่นอยู่ให้ต่อคิว', type: 'bool', def: true,
          hint: 'ปิด = กำลังเล่นอยู่ก็ข้ามคลิปใหม่ไปเลย เหมาะกับตอนของขวัญเข้ารัว' },
        { k: 'maxqueue', label: 'คิวยาวสุด (คลิป)', type: 'number', def: 5, min: 1, max: 20 },
        { k: 'loopfit', label: 'วนคลิปสั้นให้ครบเวลา', type: 'bool', def: false }
      ] },
    { file: 'biggifts', icon: 'gift', name: 'ของขวัญใหญ่', desc: 'กระดานโชว์ของขวัญชิ้นใหญ่ + ชื่อและรูปคนส่ง ค้างไว้ทั้งไลฟ์', size: '900 x 260', params: '?min=100 เหรียญขั้นต่ำต่อชิ้น, ?max=10 เก็บกี่ใบ, ?layout=list เรียงแนวตั้ง, ?debug=1 ปุ่มทดสอบ',
      opts: [
        { k: 'min', label: 'เหรียญขั้นต่ำต่อชิ้น', type: 'number', def: 100, min: 0, max: 999999,
          hint: 'ดูที่ราคาของขวัญ 1 ชิ้น — ส่งกุหลาบ 1 เหรียญรัว 100 ครั้งจะไม่ขึ้น' },
        { k: 'mintotal', label: 'เหรียญรวมขั้นต่ำของคอมโบ (0 = ไม่ใช้)', type: 'number', def: 0, min: 0, max: 9999999,
          hint: 'ใช้คู่กับด้านบนได้ เช่นตั้ง 0/500 = ของถูกแต่ส่งรัวจนรวมเกิน 500 ก็ขึ้น' },
        { k: 'max', label: 'เก็บบนจอกี่ใบ', type: 'number', def: 10, min: 1, max: 60 },
        { k: 'layout', label: 'รูปแบบการวาง', type: 'select', def: 'grid', options: [
          { v: 'grid', t: 'กริด — เรียงต่อกันแล้วขึ้นบรรทัดใหม่' },
          { v: 'list', t: 'แนวตั้ง — รายการเรียงลงล่าง' },
          { v: 'row', t: 'แนวนอน — แถวเดียวยาว' },
          { v: 'strip', t: 'แนวนอนเล็ก — แถบบางๆ วางขอบจอ' } ],
          hint: 'แนวนอนเล็กจะย่อรูปให้เองไม่เกิน 44px (ปรับเล็กกว่านี้ได้ที่ขนาดรูป)' },
        { k: 'sort', label: 'เรียงลำดับ', type: 'select', def: 'new', options: [
          { v: 'new', t: 'ใหม่สุดขึ้นก่อน' }, { v: 'value', t: 'เหรียญเยอะขึ้นก่อน' } ] },
        { k: 'size', label: 'ขนาดรูปของขวัญ (px)', type: 'number', def: 96, min: 24, max: 400 },
        { k: 'gap', label: 'ระยะห่างระหว่างใบ (px)', type: 'number', def: 10, min: 0, max: 60 },
        { k: 'name', label: 'แสดงชื่อคนส่ง', type: 'bool', def: true },
        { k: 'avatar', label: 'แสดงรูปโปรไฟล์คนส่ง', type: 'bool', def: true },
        { k: 'period', label: 'ช่วงเวลาที่นับ', type: 'select', def: 'session', options: [
          { v: 'session', t: 'ไลฟ์นี้ (สด)' }, { v: 'today', t: 'วันนี้' },
          { v: 'week', t: 'สัปดาห์นี้' }, { v: 'month', t: 'เดือนนี้' },
          { v: 'days:7', t: '7 วันล่าสุด' }, { v: 'days:30', t: '30 วันล่าสุด' },
          { v: 'all', t: 'ตลอดกาล' } ],
          hint: 'ย้อนหลังใช้ประวัติที่เก็บในเครื่อง — เก็บเฉพาะของขวัญที่ราคาถึงเกณฑ์ในแท็บตั้งค่า (เริ่มต้น 50 เหรียญ)' },
        { k: 'coins', label: 'แสดงยอดเหรียญ', type: 'bool', def: true },
        { k: 'xn', label: 'แสดงป้ายจำนวน xN', type: 'bool', def: true },
        { k: 'giftname', label: 'แสดงชื่อของขวัญ', type: 'bool', def: false,
          hint: 'แบบแนวตั้งเปิดให้อยู่แล้ว' },
        { k: 'keep', label: 'จำไว้เมื่อโปรแกรมไลฟ์รีเฟรชแหล่งภาพ', type: 'bool', def: true,
          hint: 'ปิด = รีเฟรชแล้วกระดานว่าง' },
        { k: 'reset', label: 'ล้างกระดานเมื่อเริ่มไลฟ์ใหม่', type: 'bool', def: true }
      ] },
    { file: 'chat', icon: 'chat', name: 'Chat Overlay', desc: 'แชทสดพร้อม badge Mod/Sub/Follow', size: '380 x 600', params: '?avatars=0 ซ่อนรูป, ?hidecmd=1 ซ่อนคำสั่ง, ?size=16 ฟอนต์, ?fade=30 จางใน 30 วิ',
      opts: [
        { k: 'size', label: 'ขนาดฟอนต์ (px)', type: 'number', def: 16, min: 10, max: 40 },
        { k: 'avatars', label: 'แสดงรูปโปรไฟล์', type: 'bool', def: true },
        { k: 'hidecmd', label: 'ซ่อนข้อความคำสั่ง (!...)', type: 'bool', def: false },
        { k: 'fade', label: 'จางหายใน (วินาที, 0 = ไม่จาง)', type: 'number', def: 0, min: 0, max: 300 },
        { k: 'align', label: 'ข้อความใหม่อยู่', type: 'select', def: '', options: [{ v: '', t: 'ล่างสุด (ไหลขึ้น)' }, { v: 'top', t: 'บนสุด (ไหลลง)' }] },
        { k: 'maxrows', label: 'จำนวนแถวสูงสุดบนจอ', type: 'number', def: 50, min: 1, max: 200 },
        { k: 'gap', label: 'ระยะห่างระหว่างแถว (px)', type: 'number', def: '', min: 0, max: 40 },
        { k: 'side', label: 'ชิดด้าน', type: 'select', def: '', options: [{ v: '', t: 'ซ้าย' }, { v: 'right', t: 'ขวา' }] },
        { k: 'namecolor', label: 'สีชื่อผู้ชม', type: 'color', def: '', clearable: true },
        { k: 'msgcolor', label: 'สีข้อความ', type: 'color', def: '', clearable: true },
        { k: 'gifts', label: 'แสดงแถวของขวัญในแชท', type: 'bool', def: true },
        { k: 'social', label: 'แสดงแถวติดตาม/แชร์/สมาชิก', type: 'bool', def: true },
        { k: 'joins', label: 'แสดงแถวคนเข้าห้อง', type: 'bool', def: false },
        { g: 'ข้อความ', k: 'gifttext', label: 'ข้อความแถวของขวัญ', type: 'text', def: 'ส่ง {gift} x{count} 💎{diamonds}',
          hint: 'ตัวแปรที่ใช้ได้: {nickname} ชื่อผู้ชม · {handle} @ชื่อ · {gift} ชื่อของขวัญ · {count} จำนวน · {diamonds} เพชร (ชื่อผู้ชมขึ้นให้อยู่แล้วด้านหน้า)' },
        { g: 'ข้อความ', k: 'followtext', label: 'ข้อความแถวติดตาม', type: 'text', def: 'กดติดตามแล้ว ❤️', hint: 'ตัวแปรที่ใช้ได้: {nickname} ชื่อผู้ชม · {handle} @ชื่อ' },
        { g: 'ข้อความ', k: 'sharetext', label: 'ข้อความแถวแชร์', type: 'text', def: 'แชร์ไลฟ์นี้ 📤', hint: 'ตัวแปรที่ใช้ได้: {nickname} ชื่อผู้ชม · {handle} @ชื่อ' },
        { g: 'ข้อความ', k: 'subtext', label: 'ข้อความแถวสมาชิก', type: 'text', def: 'สมัครสมาชิกแล้ว ⭐ (เดือนที่ {month})',
          hint: 'ตัวแปรที่ใช้ได้: {nickname} ชื่อผู้ชม · {handle} @ชื่อ · {month} เดือนที่' },
        { g: 'ข้อความ', k: 'jointext', label: 'ข้อความแถวคนเข้าห้อง', type: 'text', def: 'เข้ามาในไลฟ์ 👋', hint: 'ตัวแปรที่ใช้ได้: {nickname} ชื่อผู้ชม · {handle} @ชื่อ' }
      ] },
    { file: 'goal', icon: 'goals', name: 'Goal Bar', desc: 'หลอดเป้าหมาย หัวใจ/เพชร/ผู้ติดตาม', size: '460 x 260', params: '?goal=likes|diamonds|followers แสดงตัวเดียว',
      opts: [
        { k: 'goal', label: 'แสดงเป้าหมาย', type: 'select', def: '', options: [{ v: '', t: 'ทั้งหมดที่เปิดไว้' }, { v: 'likes', t: 'หัวใจ' }, { v: 'diamonds', t: 'เพชร' }, { v: 'followers', t: 'ผู้ติดตาม' }] },
        { k: 'barheight', label: 'ความสูงหลอด (px)', type: 'number', def: '', min: 6, max: 120 },
        { k: 'gap', label: 'ระยะห่างระหว่างหลอด (px)', type: 'number', def: '', min: 0, max: 60 },
        { k: 'percent', label: 'แสดงเป็น % แทน 683/1000', type: 'bool', def: false },
        { k: 'value', label: 'แสดงตัวเลขความคืบหน้า', type: 'bool', def: true },
        { k: 'periodlabel', label: 'แสดงป้ายช่วงเวลา (สัปดาห์นี้/เดือนนี้)', type: 'bool', def: true,
          hint: 'โผล่เฉพาะเป้าหมายที่ตั้งให้นับข้ามไลฟ์ — ตั้งช่วงได้ที่แท็บ "เป้าหมาย & Timer"' }
      ] },
    { file: 'leaderboard', icon: 'trophy', name: 'Leaderboard', desc: 'อันดับผู้ให้ของขวัญสูงสุด', size: '340 x 400', params: '?top=5 จำนวนอันดับ, ?title=0 ซ่อนหัวข้อ',
      opts: [
        { k: 'top', label: 'จำนวนอันดับ', type: 'number', def: 5, min: 1, max: 20 },
        { k: 'title', label: 'หัวข้อ (ใส่ 0 = ซ่อน)', type: 'text', def: '' },
        { k: 'avatars', label: 'แสดงรูปโปรไฟล์', type: 'bool', def: true },
        { g: 'รูปแบบอันดับ', k: 'layout', label: 'รูปแบบ', type: 'select', def: '', options: [
          { v: '', t: 'รายการ (แบบเดิม)' }, { v: 'podium', t: 'โพเดียม 3 อันดับแรก' } ],
          hint: 'โพเดียม = อันดับ 1-3 เป็นการ์ดมีมงกุฎ อันดับ 4 ลงไปเป็นแถวเหมือนเดิม' },
        { g: 'รูปแบบอันดับ', k: 'rank1', label: 'สีการ์ดอันดับ 1', type: 'color', def: '', clearable: true },
        { g: 'รูปแบบอันดับ', k: 'rank2', label: 'สีการ์ดอันดับ 2', type: 'color', def: '', clearable: true },
        { g: 'รูปแบบอันดับ', k: 'rank3', label: 'สีการ์ดอันดับ 3', type: 'color', def: '', clearable: true },
        { g: 'รูปแบบอันดับ', k: 'crown', label: 'แสดงมงกุฎเหนือการ์ด', type: 'bool', def: true },
        { g: 'รูปแบบอันดับ', k: 'podav', label: 'ขนาดรูปบนการ์ด (px)', type: 'number', def: '', min: 28, max: 160 },
        { k: 'period', label: 'ช่วงเวลาที่นับ', type: 'select', def: 'session', options: [
          { v: 'session', t: 'ไลฟ์นี้ (สด)' }, { v: 'today', t: 'วันนี้' },
          { v: 'week', t: 'สัปดาห์นี้' }, { v: 'month', t: 'เดือนนี้' },
          { v: 'days:7', t: '7 วันล่าสุด' }, { v: 'days:30', t: '30 วันล่าสุด' },
          { v: 'all', t: 'ตลอดกาล' } ],
          hint: 'ไม่ใช่ "ไลฟ์นี้" = ใช้สถิติสะสมที่เก็บไว้ในเครื่อง อัปเดตทุก 20 วิ' },
        { k: 'avatarsize', label: 'ขนาดรูปโปรไฟล์ (px)', type: 'number', def: '', min: 0, max: 120 },
        { k: 'rowgap', label: 'ระยะห่างระหว่างแถว (px)', type: 'number', def: '', min: 0, max: 40 },
        { k: 'valuecolor', label: 'สีตัวเลขท้ายแถว', type: 'color', def: '', clearable: true }
      ] },
    { file: 'likers', icon: 'heart', name: 'อันดับคนกดหัวใจ', desc: 'ใครกดหัวใจเยอะที่สุด — นับเฉพาะหลังเชื่อมต่อแล้ว', size: '340 x 400', params: '?top=5 จำนวนอันดับ, ?total=1 โชว์ยอดรวมห้อง, ?bar=0 ซ่อนแถบสัดส่วน',
      opts: [
        { k: 'top', label: 'จำนวนอันดับ', type: 'number', def: 5, min: 1, max: 20 },
        { k: 'title', label: 'หัวข้อ (ใส่ 0 = ซ่อน)', type: 'text', def: '' },
        { k: 'avatars', label: 'แสดงรูปโปรไฟล์', type: 'bool', def: true },
        { g: 'รูปแบบอันดับ', k: 'layout', label: 'รูปแบบ', type: 'select', def: '', options: [
          { v: '', t: 'รายการ (แบบเดิม)' }, { v: 'podium', t: 'โพเดียม 3 อันดับแรก' } ],
          hint: 'โพเดียม = อันดับ 1-3 เป็นการ์ดมีมงกุฎ อันดับ 4 ลงไปเป็นแถวเหมือนเดิม' },
        { g: 'รูปแบบอันดับ', k: 'rank1', label: 'สีการ์ดอันดับ 1', type: 'color', def: '', clearable: true },
        { g: 'รูปแบบอันดับ', k: 'rank2', label: 'สีการ์ดอันดับ 2', type: 'color', def: '', clearable: true },
        { g: 'รูปแบบอันดับ', k: 'rank3', label: 'สีการ์ดอันดับ 3', type: 'color', def: '', clearable: true },
        { g: 'รูปแบบอันดับ', k: 'crown', label: 'แสดงมงกุฎเหนือการ์ด', type: 'bool', def: true },
        { g: 'รูปแบบอันดับ', k: 'podav', label: 'ขนาดรูปบนการ์ด (px)', type: 'number', def: '', min: 28, max: 160 },
        { k: 'period', label: 'ช่วงเวลาที่นับ', type: 'select', def: 'session', options: [
          { v: 'session', t: 'ไลฟ์นี้ (สด)' }, { v: 'today', t: 'วันนี้' },
          { v: 'week', t: 'สัปดาห์นี้' }, { v: 'month', t: 'เดือนนี้' },
          { v: 'days:7', t: '7 วันล่าสุด' }, { v: 'days:30', t: '30 วันล่าสุด' },
          { v: 'all', t: 'ตลอดกาล' } ],
          hint: 'ไม่ใช่ "ไลฟ์นี้" = ใช้สถิติสะสมที่เก็บไว้ในเครื่อง อัปเดตทุก 20 วิ' },
        { k: 'bar', label: 'แสดงแถบสัดส่วน', type: 'bool', def: true },
        { k: 'total', label: 'แสดงยอดหัวใจรวมของห้อง', type: 'bool', def: false },
        { k: 'avatarsize', label: 'ขนาดรูปโปรไฟล์ (px)', type: 'number', def: '', min: 0, max: 120 },
        { k: 'rowgap', label: 'ระยะห่างระหว่างแถว (px)', type: 'number', def: '', min: 0, max: 40 },
        { k: 'valuecolor', label: 'สีตัวเลขท้ายแถว', type: 'color', def: '', clearable: true }
      ] },
    { file: 'timer', icon: 'timer', name: 'Subathon Timer', desc: 'นาฬิกาถอยหลังบวกเวลาตามของขวัญ', size: '360 x 140', params: '?size=72 ขนาดตัวเลข',
      opts: [
        { k: 'size', label: 'ขนาดตัวเลข (px)', type: 'number', def: 72, min: 24, max: 200 },
        { k: 'label', label: 'หัวข้อ (ใส่ 0 = ซ่อน)', type: 'text', def: '' },
        { k: 'format', label: 'รูปแบบเวลา', type: 'select', def: 'auto', options: [
          { v: 'auto', t: 'อัตโนมัติ (มีชั่วโมงค่อยโชว์)' }, { v: 'hms', t: 'ชม:นาที:วินาที เสมอ' },
          { v: 'ms', t: 'นาที:วินาที (นาทีสะสม)' }, { v: 'h', t: 'ชั่วโมง:นาที' } ] },
        { k: 'dangersec', label: 'เตือนเมื่อเหลือ (วินาที, 0 = ไม่เตือน)', type: 'number', def: 60, min: 0, max: 3600 },
        { k: 'dangercolor', label: 'สีตอนใกล้หมดเวลา', type: 'color', def: '', clearable: true }
      ] },
    { file: 'tts', icon: 'tts', name: 'TTS Caption', desc: 'คำบรรยายข้อความที่กำลังอ่าน', size: '600 x 120', params: '?caption=0 ปิดคำบรรยาย',
      opts: [
        { k: 'caption', label: 'แสดงคำบรรยาย', type: 'bool', def: true }
      ] },
    { file: 'wheel', icon: 'sparkles', name: 'Roulette สุ่มรางวัล', desc: 'แถบสุ่มรางวัลแนวนอน (สไตล์เปิดกล่อง) — ตั้งค่าในแท็บ "สุ่มรางวัล"', size: '900 x 260', params: '?idlehide=1 ซ่อนตอนไม่หมุน, ?card=120 ขนาดการ์ด, ?debug=1 ปุ่มทดสอบ',
      opts: [
        { k: 'card', label: 'ขนาดการ์ด (px)', type: 'number', def: 120, min: 70, max: 220 },
        { k: 'idlehide', label: 'ซ่อนตอนไม่ได้สุ่ม', type: 'bool', def: false },
        { k: 'title', label: 'หัวข้อ (ใส่ 0 = ซ่อน)', type: 'text', def: '' },
        { k: 'cardgap', label: 'ระยะห่างระหว่างการ์ด (px)', type: 'number', def: '', min: 0, max: 80 }
      ] },
    { file: 'wheelspin', icon: 'sparkles', name: 'Random Wheel (วงล้อกลม)', desc: 'วงล้อหมุนแบบวงกลม — คนละตัวกับ Roulette มีรายการรางวัล/Action ของตัวเอง ตั้งรางวัลในแท็บ "Random Wheel"', size: '420 x 480', params: '?size=320 ขนาดวง, ?palette=tiktok|console|candy|gold|mono, ?colors=#a,#b สีเอง, ?debug=1 ปุ่มทดสอบ',
      opts: [
        { k: 'size', label: 'ขนาดวงล้อ (px)', type: 'number', def: 320, min: 120, max: 900 },
        { k: 'palette', label: 'ชุดสี', type: 'select', def: 'tiktok', options: [
          { v: 'tiktok', t: 'TikTok (ชมพู-ฟ้า)' }, { v: 'console', t: 'น้ำเงินเข้ม (ตามโปรแกรม)' },
          { v: 'candy', t: 'สดใส' }, { v: 'gold', t: 'ทอง-ดำ' }, { v: 'mono', t: 'เทาโทนเดียว' } ] },
        { k: 'colors', label: 'สีเอง (คั่นด้วย , เช่น #ff2d55,#25f4ee)', type: 'text', def: '' },
        { k: 'needle', label: 'สีเข็มชี้', type: 'color', def: '#ffbe46' },
        { k: 'rimcolor', label: 'สีขอบวง', type: 'color', def: '#ffffff' },
        { k: 'rim', label: 'ความหนาขอบ (px)', type: 'number', def: 6, min: 0, max: 30 },
        { k: 'textcolor', label: 'สีตัวอักษรในช่อง', type: 'color', def: '#ffffff' },
        { k: 'labelsize', label: 'ขนาดตัวอักษรในช่อง (px)', type: 'number', def: 15, min: 8, max: 48 },
        { k: 'labels', label: 'แสดงข้อความในช่อง', type: 'bool', def: true },
        { k: 'hub', label: 'ขนาดดุมกลาง (% ของวง)', type: 'number', def: 28, min: 0, max: 60 },
        { k: 'hublabel', label: 'ข้อความบนดุม (0 = ว่าง)', type: 'text', def: 'SPIN' },
        { k: 'hubbg', label: 'สีดุมกลาง', type: 'color', def: '#101820' },
        { k: 'hubtext', label: 'สีตัวอักษรบนดุม', type: 'color', def: '#ffffff' },
        { k: 'spins', label: 'จำนวนรอบก่อนหยุด', type: 'number', def: 6, min: 1, max: 30 },
        { k: 'result', label: 'แสดงป้ายผลรางวัล', type: 'bool', def: true },
        { k: 'title', label: 'หัวข้อ (ใส่ 0 = ซ่อน)', type: 'text', def: '' },
        { k: 'titlecolor', label: 'สีหัวข้อ', type: 'color', def: '#ffffff' },
        { k: 'idlehide', label: 'ซ่อนตอนไม่ได้หมุน', type: 'bool', def: false }
      ] },
    { file: 'carousel', icon: 'megaphone', name: 'ตัวเลื่อน (Slider)', desc: 'แถบเลื่อนโชว์ของขวัญ+ข้อความ วนไปเรื่อยๆ — ตั้งรายการในแท็บ "ตัวเลื่อน"', size: '900 x 220', params: '?speed=90 ความเร็ว(มาก=เร็ว), ?size=120 ขนาดการ์ด',
      opts: [
        { k: 'speed', label: 'ความเร็ว (มาก=เร็ว)', type: 'number', def: 90, min: 10, max: 800 },
        { k: 'size', label: 'ขนาดการ์ด (px)', type: 'number', def: 120, min: 50, max: 300 },
        { k: 'gap', label: 'ระยะห่างระหว่างชิ้น (px)', type: 'number', def: '', min: 0, max: 120 },
        { k: 'dir', label: 'ทิศทางการเลื่อน', type: 'select', def: '', options: [{ v: '', t: 'ไปทางซ้าย' }, { v: 'right', t: 'ไปทางขวา' }] }
      ] },
    { file: 'wincount', icon: 'trophy', name: 'ตัวนับชัยชนะ', desc: 'นับแพ้/ชนะ กดด้วยคีย์ลัดขณะอยู่ในเกม', size: '420 x 160', params: '?size=80 ขนาดตัวอักษร, ?max=0 ซ่อนเป้า, ?label=0 ซ่อนข้อความ, ?bg=0 พื้นหลังโปร่ง',
      opts: [
      ] },
    { file: 'jar', icon: 'gift', name: 'เหยือกของขวัญ', desc: 'ของขวัญที่ผู้ชมส่งจะตกลงในเหยือก สะสมจนเต็ม', size: '320 x 440', params: '?capacity=80 ความจุ (0 = ไม่จำกัด), ?sizebydiamonds=0 ปิดโหมดแพงชิ้นใหญ่, ?sizegap=70 ความต่างของขนาด (%), ?mindiamonds=N นับเฉพาะ ≥N เพชร, ?reset=1 ล้างทุกไลฟ์, ?debug=1 ปุ่มทดสอบ',
      opts: [
        { k: 'capacity', label: 'ความจุ (เต็มที่กี่ชิ้น)', type: 'number', def: 60, min: 0, max: 999,
          hint: 'ใส่ 0 = ไม่จำกัด เต็มเหยือกแล้วล้นกองจนเต็มพื้นที่ widget' },
        { k: 'sizebydiamonds', label: 'ของขวัญแพงชิ้นใหญ่กว่า', type: 'bool', def: true,
          hint: 'คิดจากราคาต่อชิ้น — กุหลาบ 1 เพชรเล็กสุด ของแพงใหญ่ขึ้นตามราคา' },
        { k: 'sizegap', label: 'ความต่างของขนาดตามราคา (%)', type: 'number', def: 70, min: 0, max: 250,
          hint: 'ยิ่งมากยิ่งทิ้งห่าง — ที่ 70: 1 เพชร = เล็กสุด · 50 เพชรใหญ่ขึ้น 2.2 เท่า · 1,000 เพชร 3.1 เท่า (เพดาน 4.5 เท่า)' },
        { k: 'mindiamonds', label: 'เพชรขั้นต่ำที่นับ', type: 'number', def: 0, min: 0, max: 99999 },
        { k: 'reset', label: 'ล้างเหยือกทุกไลฟ์ใหม่', type: 'bool', def: false },
        { k: 'size', label: 'ขนาดเหยือก (px)', type: 'number', def: 300, min: 160, max: 600 },
        { k: 'count', label: 'แสดงป้ายนับจำนวน', type: 'bool', def: true }
      ] },
    { file: 'padstate', icon: 'keyboard', name: 'สถานะโหมดแพด', desc: 'ป้ายบอกว่าโหมดแพด (Soundpad) เปิดอยู่ — ไว้ดูตอนเล่นเกมเต็มจอว่าตอนนี้ปุ่มถูกจองอยู่ไหม', size: '260 x 90', params: '?hideoff=0 โชว์ตอนโหมดปิดด้วย, ?label=ข้อความ, ?bank=1 โชว์ชื่อชุดปุ่ม, ?count=1 โชว์จำนวนปุ่ม',
      opts: [
        { k: 'label', label: 'ข้อความตอนโหมดเปิด', type: 'text', def: 'PAD ON' },
        { k: 'offlabel', label: 'ข้อความตอนโหมดปิด', type: 'text', def: 'PAD OFF' },
        { k: 'hideoff', label: 'ซ่อนตอนโหมดปิด', type: 'bool', def: true,
          hint: 'ปิด = ป้ายค้างอยู่ทั้งไลฟ์ เห็นทั้งตอนเปิดและปิด' },
        { k: 'dot', label: 'แสดงจุดสถานะ', type: 'bool', def: true },
        { k: 'bank', label: 'แสดงชื่อชุดปุ่ม', type: 'bool', def: false },
        { k: 'count', label: 'แสดงจำนวนปุ่มที่ตั้งเสียงไว้', type: 'bool', def: false },
        { k: 'align', label: 'ชิดด้าน', type: 'select', def: '', options: [
          { v: '', t: 'ซ้าย' }, { v: 'center', t: 'กึ่งกลาง' }, { v: 'right', t: 'ขวา' } ] }
      ] }
  ];
  // preview scale ต่อ widget (widget กว้างๆ ย่อมากหน่อยให้เห็นครบในการ์ด)
  var WIDGET_PV = { alerts: 55, biggifts: 34, chat: 62, goal: 60, leaderboard: 70, likers: 70, timer: 62, tts: 60, wheel: 34, wheelspin: 42, jar: 25, carousel: 40, wincount: 45, padstate: 70 };

  // widget ไหนมีฟอร์มตั้งค่าเต็มรูปแบบอยู่แล้ว (ย้ายมาจากแท็บเดิม)
  var WCFG_PANEL = { goal: 'goal', timer: 'timer', wheel: 'wheel', wheelspin: 'randomWheel', carousel: 'carousel', wincount: 'wincount' };

  function renderWidgets() {
    var list = $('#widgetsList');
    // สร้างการ์ดใหม่ทั้งหมด = ตัวที่เฝ้าดูอยู่กลายเป็นของเก่าที่ถูกทิ้ง ต้องเลิกเฝ้าก่อน
    // ไม่งั้น observer ถือ element ที่หลุดจาก DOM ไปแล้วไว้ทุกครั้งที่ render
    if (pvObserver) pvObserver.disconnect();
    list.innerHTML = '';
    WIDGETS.forEach(function (w) {
      var frame = el('iframe', { class: 'wpv-frame', 'data-src': widgetUrl(w, true), scrolling: 'no' });
      // ป้ายนี้เคยขึ้นทุกใบเป็นของประดับ ซึ่งไม่ได้บอกอะไรเลย — ตอนนี้ขึ้นเฉพาะตัวที่
      // ต่ออยู่จริงในโปรแกรมไลฟ์ (เซิร์ฟเวอร์รู้จาก socket ที่ widget บอกชื่อตัวเองมา)
      var live = el('span', { class: 'wpv-live', text: Tk.t('● กำลังใช้งาน') });
      var preview = el('div', { class: 'wpv-box' }, [frame, live]);

      var card = el('button', { class: 'wcard', type: 'button', 'data-file': w.file,
        title: Tk.t('ตั้งค่า {name}', { name: Tk.t(w.name) }) }, [
        el('div', { class: 'wcard-head' }, [
          el('span', { class: 'w-ico' }, [window.Icon.el(w.icon, 15)]),
          el('span', { class: 'w-name', text: Tk.t(w.name) }),
          el('span', { class: 'w-size', text: w.size })
        ]),
        preview,
        el('div', { class: 'wcard-foot' }, [
          el('span', { class: 'wcard-desc', text: w.desc ? Tk.t(w.desc) : '' }),
          el('span', { class: 'wcard-go' }, [el('span', { text: Tk.t('ตั้งค่า') }), window.Icon.el('chevronRight', 13)])
        ])
      ]);
      card.addEventListener('click', function () { openWidgetDetail(w); });
      list.appendChild(card);
    });
    // setupTabs() คืนแท็บล่าสุดตั้งแต่ก่อน state:get กลับมา — ตอนนั้นการ์ดยังไม่มีในหน้า
    // เปิดโปรแกรมค้างไว้ที่แท็บ Widgets จึงเห็นการ์ดว่างเปล่าทั้งหน้าจนกว่าจะสลับแท็บไปกลับ
    paintWidgetsLive();   // การ์ดถูกสร้างใหม่ ต้องทาสถานะ "กำลังใช้งาน" กลับเข้าไป
    if (!$('#main .tab[data-tab="widgets"]').hidden) activateWidgetPreviews();
  }

  // ---------- ตัวปรับ "ละเอียด" ที่ทุก widget ได้เหมือนกัน ----------
  // ทำงานผ่าน CSS variable กลาง (src/widgets/common/look.js + templates.css)
  // ค่าว่าง = ใช้ตามธีมที่เลือก — ตั้งเมื่อไหร่ถึงจะทับ
  var FONT_OPTS = [
    { v: '', t: 'ตามธีม' },
    { v: 'system', t: 'ระบบ (อ่านง่าย เป็นกลาง)' },
    { v: 'sans', t: 'Prompt / Noto Sans Thai' },
    { v: 'round', t: 'มน ๆ เป็นกันเอง' },
    { v: 'condensed', t: 'ผอมสูง (ประหยัดที่)' },
    { v: 'serif', t: 'มีเชิง (ทางการ)' },
    { v: 'mono', t: 'monospace (สายเทค/เกม)' },
    { v: 'impact', t: 'หนาหนัก (พาดหัว)' }
  ];
  var LOOK_OPTS = [
    { g: 'สี', k: 'accent', label: 'สีเน้นหลัก', type: 'color', def: '', clearable: true, hint: 'ใช้กับแถบ/ขอบ/ตัวเลขเด่นของ widget' },
    { g: 'สี', k: 'accent2', label: 'สีเน้นรอง (ปลายไล่เฉด)', type: 'color', def: '', clearable: true },

    { g: 'ตัวอักษร', k: 'font', label: 'ฟอนต์', type: 'select', def: '', options: FONT_OPTS },
    { g: 'ตัวอักษร', k: 'textcolor', label: 'สีตัวอักษรหลัก', type: 'color', def: '', clearable: true },
    { g: 'ตัวอักษร', k: 'dimcolor', label: 'สีตัวอักษรรอง (คำอธิบาย/@ชื่อ)', type: 'color', def: '', clearable: true },
    { g: 'ตัวอักษร', k: 'weight', label: 'ความหนา', type: 'select', def: '', options: [
      { v: '', t: 'ตามธีม' }, { v: '300', t: '300 บาง' }, { v: '400', t: '400 ปกติ' }, { v: '500', t: '500' },
      { v: '600', t: '600 กึ่งหนา' }, { v: '700', t: '700 หนา' }, { v: '800', t: '800 หนามาก' }, { v: '900', t: '900 หนาสุด' } ] },
    { g: 'ตัวอักษร', k: 'track', label: 'ระยะห่างตัวอักษร (%)', type: 'number', def: '', min: -10, max: 50, hint: 'บวก = ห่างขึ้น เหมาะกับหัวข้อตัวพิมพ์ใหญ่' },
    { g: 'ตัวอักษร', k: 'caps', label: 'หัวข้อเป็นตัวพิมพ์ใหญ่ (A-Z)', type: 'bool', def: false },
    { g: 'ตัวอักษร', k: 'textshadow', label: 'เงาตัวอักษร (0-100)', type: 'number', def: '', min: 0, max: 100, hint: '0 = ไม่มีเงา ภาพสะอาด · มาก = อ่านง่ายบนวิดีโอลายเยอะ' },
    { g: 'ตัวอักษร', k: 'shadowcolor', label: 'สีเงาตัวอักษร', type: 'color', def: '', clearable: true },
    { g: 'ตัวอักษร', k: 'stroke', label: 'ขอบตัวอักษร (px)', type: 'number', def: '', min: 0, max: 8, hint: 'ช่วยให้อ่านออกบนพื้นหลังสว่างหรือลายจัด' },
    { g: 'ตัวอักษร', k: 'strokecolor', label: 'สีขอบตัวอักษร', type: 'color', def: '', clearable: true },

    // ค่าเริ่มต้น 450 ไม่ใช่ว่าง — ปล่อยเต็มพื้นที่แล้วแถวยาวพาดจอจนอ่านยากบนไลฟ์จริง
    // สำคัญ: ค่าที่ "เท่ากับ def" จะไม่ถูกใส่ลง URL (ดูบรรทัดสร้าง qs) widget จึงต้องมี
    // ค่าสำรองใน CSS เป็น 450px ให้ตรงกัน ไม่งั้นหน้าตั้งค่าบอก 450 แต่ของจริงเต็มจอ
    { g: 'กล่อง/พื้นหลัง', k: 'width', label: 'ความกว้างสูงสุด (px)', type: 'number', def: 450, min: 120, max: 1600, hint: 'จำกัดความกว้างของแถว/กล่อง — ต่างจากย่อ/ขยาย ตัวอักษรเท่าเดิม · ค่าเริ่มต้น 450 · ใส่เลขมากๆ (เช่น 1600) = เต็มพื้นที่' },
    { g: 'กล่อง/พื้นหลัง', k: 'bg', label: 'สีพื้นกล่อง', type: 'color', def: '', clearable: true },
    { g: 'กล่อง/พื้นหลัง', k: 'bgopacity', label: 'ความทึบพื้นกล่อง (%)', type: 'number', def: '', min: 0, max: 100, hint: '0 = ใสสนิท ไม่มีกล่อง · 100 = ทึบสนิท' },
    { g: 'กล่อง/พื้นหลัง', k: 'radius', label: 'ความมนมุม (px)', type: 'number', def: '', min: 0, max: 80 },
    { g: 'กล่อง/พื้นหลัง', k: 'border', label: 'ความหนาขอบ (px)', type: 'number', def: '', min: 0, max: 12 },
    { g: 'กล่อง/พื้นหลัง', k: 'bordercolor', label: 'สีขอบ', type: 'color', def: '', clearable: true },
    { g: 'กล่อง/พื้นหลัง', k: 'boxshadow', label: 'เงากล่อง (0-100)', type: 'number', def: '', min: 0, max: 100 },
    { g: 'กล่อง/พื้นหลัง', k: 'padx', label: 'ระยะขอบใน ซ้าย-ขวา (px)', type: 'number', def: '', min: 0, max: 80 },
    { g: 'กล่อง/พื้นหลัง', k: 'pady', label: 'ระยะขอบใน บน-ล่าง (px)', type: 'number', def: '', min: 0, max: 80 },

    { g: 'ทั่วไป', k: 'scale', label: 'ย่อ/ขยายทั้งชุด (%)', type: 'number', def: '', min: 10, max: 400 },
    { g: 'ทั่วไป', k: 'anim', label: 'เปิดอนิเมชัน', type: 'bool', def: true, hint: 'ปิด = overlay นิ่งสนิท ไม่ดึงสายตาคนดู' }
  ];
  // ตัวเลือกกลางที่ "แต่ละ widget ใช้ได้จริง" — ไม่ใช่ยัดชุดเดียวกันให้ทุกตัว
  // ตัวเลือกกลางทำงานผ่าน CSS variable ถ้า widget ไหนไม่ได้ใช้ตัวแปรนั้น ตัวเลือกจะโผล่มาแบบกดแล้วไม่มีอะไรเกิดขึ้น
  // ลิสต์นี้สร้างจากของจริงในไฟล์ widget — ตรวจ/สร้างใหม่ด้วย `node scripts/check-widget-options.js`
  var LOOK_FOR = {
    alerts: ['font', 'stroke', 'strokecolor', 'bg', 'bgopacity', 'radius', 'scale', 'anim'],
    biggifts: ['accent', 'font', 'textcolor', 'dimcolor', 'textshadow', 'shadowcolor', 'stroke', 'strokecolor', 'bg', 'bgopacity', 'radius', 'border', 'bordercolor', 'boxshadow', 'padx', 'pady', 'scale', 'anim'],
    carousel: ['font', 'stroke', 'strokecolor', 'scale'],
    chat: ['accent', 'font', 'textcolor', 'track', 'caps', 'textshadow', 'shadowcolor', 'stroke', 'strokecolor', 'bg', 'bgopacity', 'radius', 'border', 'bordercolor', 'boxshadow', 'width', 'scale', 'anim'],
    goal: ['accent', 'accent2', 'font', 'textcolor', 'dimcolor', 'weight', 'track', 'caps', 'textshadow', 'shadowcolor', 'stroke', 'strokecolor', 'bg', 'bgopacity', 'radius', 'border', 'bordercolor', 'boxshadow', 'padx', 'pady', 'width', 'scale', 'anim'],
    jar: ['accent', 'font', 'textcolor', 'stroke', 'strokecolor', 'bg', 'bgopacity', 'radius', 'border', 'bordercolor', 'scale', 'anim'],
    leaderboard: ['accent', 'font', 'textcolor', 'stroke', 'strokecolor', 'bg', 'bgopacity', 'radius', 'border', 'bordercolor', 'boxshadow', 'padx', 'pady', 'width', 'scale', 'anim'],
    likers: ['accent', 'font', 'textcolor', 'stroke', 'strokecolor', 'bg', 'bgopacity', 'radius', 'border', 'bordercolor', 'boxshadow', 'padx', 'pady', 'width', 'scale', 'anim'],
    padstate: ['accent', 'accent2', 'font', 'textcolor', 'dimcolor', 'weight', 'track', 'caps', 'textshadow', 'shadowcolor', 'stroke', 'strokecolor', 'bg', 'bgopacity', 'radius', 'border', 'bordercolor', 'boxshadow', 'padx', 'pady', 'width', 'scale', 'anim'],
    timer: ['accent', 'font', 'textcolor', 'dimcolor', 'weight', 'track', 'caps', 'textshadow', 'shadowcolor', 'stroke', 'strokecolor', 'bg', 'bgopacity', 'radius', 'border', 'bordercolor', 'scale', 'anim'],
    tts: ['accent', 'font', 'textcolor', 'stroke', 'strokecolor', 'bg', 'bgopacity', 'radius', 'border', 'bordercolor', 'boxshadow', 'scale', 'anim'],
    wheel: ['accent', 'font', 'stroke', 'strokecolor', 'bg', 'bgopacity', 'radius', 'border', 'bordercolor', 'boxshadow', 'scale'],
    video: ['stroke', 'strokecolor', 'bg', 'bgopacity', 'radius', 'border', 'bordercolor', 'boxshadow', 'scale', 'anim'],
    wheelspin: ['font', 'scale'],
    wincount: ['scale']
  };

  function optsOf(w) {
    var own = (w.opts || []).map(function (o) {
      return o.g ? o : Object.assign({ g: Tk.t('เฉพาะ') + ' ' + Tk.t(w.name) }, o);
    });
    var allow = LOOK_FOR[w.file] || [];
    var shared = LOOK_OPTS.filter(function (o) { return allow.indexOf(o.k) >= 0; });
    return own.concat(shared);
  }

  // ---------- ธีม (template) ของ widget ----------
  // แต่ละ widget เลือกธีมของตัวเองได้อิสระ — เก็บใน settings.widgetOpts[file].template
  // แล้วส่งออกเป็น ?template= ใน URL (ดู src/widgets/common/templates.css)
  var TEMPLATES = [
    { v: 'default', t: 'ดั้งเดิม', desc: 'โทน TikTok มืดโปร่ง มุมมน อ่านง่าย เป็นกลางกับทุกฉาก' },
    { v: 'neon', t: 'นีออน', desc: 'ขอบเรืองแสงสีเน้น ตัวอักษรมี glow เข้ากับสายเกม/ไซเบอร์' },
    { v: 'glass', t: 'กระจกฝ้า', desc: 'เบลอพื้นหลัง ขาวโปร่ง มุมมนมาก ดูสะอาดพรีเมียม' },
    { v: 'arcade', t: 'เกมพิกเซล', desc: 'ขอบหนาทึบ เงาแข็ง ฟอนต์ monospace อารมณ์เกมตู้' },
    { v: 'plain', t: 'เรียบ', desc: 'ไม่มีพื้นหลัง ไม่มีกรอบ เหลือแค่ตัวอักษรกับรูป ไม่บังฉาก' }
  ];
  // wincount ไม่มีธีม — มีหน้าตั้งค่าฟอนต์/สี/ขอบของตัวเองครบแล้ว ธีมจะไปทับค่าที่ผู้ใช้ตั้งเอง
  // jar ไม่มีธีม — ตัวโหลเป็นรูปถ่าย (assets/jar.png) ธีมทับรูปไม่ได้ เลือกไปก็ไม่มีอะไรเปลี่ยน
  var NO_TEMPLATE = { wincount: true, jar: true };
  function widgetTemplate(file) {
    var v = (widgetOpts(file) || {}).template;
    return TEMPLATES.some(function (t) { return t.v === v; }) ? v : 'default';
  }

  // URL ของ widget — สร้างจากค่าที่บันทึกไว้เสมอ (แหล่งความจริงเดียว)
  function widgetOpts(file) {
    var all = (S.settings && S.settings.widgetOpts) || {};
    return all[file] || {};
  }
  function widgetUrl(w, forPreview) {
    var saved = widgetOpts(w.file);
    var qs = [];
    optsOf(w).forEach(function (o) {
      var v = saved[o.k];
      if (v === undefined || v === null || v === '') return;
      if (o.type === 'bool') { if (!!v !== !!o.def) qs.push(o.k + '=' + (v ? '1' : '0')); }
      else if (o.type === 'color') { if (String(v).toLowerCase() !== String(o.def).toLowerCase()) qs.push(o.k + '=' + String(v).replace('#', '')); }
      else if (String(v) !== String(o.def)) qs.push(o.k + '=' + encodeURIComponent(v));
    });
    if (!NO_TEMPLATE[w.file]) {
      var tpl = widgetTemplate(w.file);
      if (tpl !== 'default') qs.push('template=' + tpl);
    }
    // บอกภาษาที่ผู้ใช้ตั้งไว้ ให้ข้อความ "ค่าเริ่มต้น" ของ widget ตามไปด้วย
    // (ข้อความที่ผู้ใช้ตั้งเองยังใช้ของเขาเสมอ ไม่ว่าจะตั้งภาษาอะไร)
    // ไม่ใส่ตอนเป็นไทย เพราะไทยเป็นค่าเริ่มต้นอยู่แล้ว URL จะได้ไม่รกโดยไม่จำเป็น
    if (Tk.i18n.current() === 'en') qs.push('lang=en');
    if (forPreview) {
      // กรอบตัวอย่างต้องใช้ scale ของกรอบเอง — ถ้าผู้ใช้ตั้ง scale ไว้ ต้องแทนที่ ไม่ใช่ต่อท้าย
      // (URLSearchParams.get คืนตัวแรก ของเดิมเลยได้ scale ของผู้ใช้แล้วล้นออกนอกการ์ด)
      qs = qs.filter(function (kv) { return kv.indexOf('scale=') !== 0; });
      qs.push('preview=1'); if (window.__TK_DEMO_BASE) qs.push('live=0');
      qs.push('scale=' + (WIDGET_PV[w.file] || 60));
    }
    return (window.__TK_DEMO_BASE || ('http://localhost:' + S.serverPort)) + '/widgets/' + w.file + '.html' + (qs.length ? '?' + qs.join('&') : '');
  }

  // ---- หน้ารายละเอียด widget: ฟอร์ม + ตัวอย่างสด + URL ในหน้าเดียว ----
  var wdCurrent = null;
  var wdTimer = null;

  function openWidgetDetail(w) {
    wdCurrent = w;
    // อยู่หน้ารายละเอียดแล้ว = ไม่เห็นการ์ดในรายการอีก ไม่มีเหตุผลให้ 14 หน้านั้นรันต่อ
    deactivateWidgetPreviews();
    $('#widgetsHome').hidden = true;
    $('#widgetDetail').hidden = false;
    $('#wdName').textContent = Tk.t(w.name);
    $('#wdSize').textContent = w.size;
    $('#wdSizeHint').textContent = Tk.t('ขนาดที่แนะนำ: {size} px', { size: w.size }) + (w.params ? ' · ' + Tk.t(w.params) : '');

    // ฟอร์ม: ใช้แผงเต็มรูปแบบถ้ามี ไม่มีก็สร้างจากตัวเลือกรูปลักษณ์
    $$('#wcfgHost .wcfg').forEach(function (pnl) { pnl.hidden = true; });
    var form = $('#wdForm');
    form.innerHTML = '';
    var key = WCFG_PANEL[w.file];
    if (key) {
      var pnl = $('#wcfgHost .wcfg[data-cfg="' + key + '"]');
      if (pnl) { pnl.hidden = false; form.appendChild(pnl); }
    }
    if (!NO_TEMPLATE[w.file]) form.appendChild(buildTemplateCard(w));
    if (optsOf(w).length) form.appendChild(buildOptsCard(w));
    if (!form.children.length) {
      form.appendChild(el('div', { class: 'card' }, [
        el('p', { class: 'muted small', text: Tk.t('widget นี้ไม่มีค่าให้ตั้ง — คัดลอก URL ไปวางในโปรแกรมไลฟ์ได้เลย') })
      ]));
    }
    buildOptSearch(form);
    wdRefresh();
    $('#main').scrollTop = 0;
  }

  function closeWidgetDetail() {
    // คืนแผงตั้งค่ากลับที่เก็บ เพื่อให้ id ยังอยู่ในเอกสาร (ฟังก์ชัน bind เดิมใช้ id)
    $$('#wdForm .wcfg').forEach(function (pnl) { pnl.hidden = true; $('#wcfgHost').appendChild(pnl); });
    // ตัวอย่างของหน้ารายละเอียดไม่เคยถูกหยุด — ปิดหน้าไปแล้วหน้าเว็บนั้นยังรันอยู่เบื้องหลัง
    // ทั้ง WebSocket ทั้งอนิเมชัน/ฟิสิกส์ ค้างกินเครื่องไปจนกว่าจะปิดโปรแกรม
    var pv = $('#wdPreview');
    if (pv && pv.src) pv.removeAttribute('src');
    wdCurrent = null;
    $('#widgetDetail').hidden = true;
    $('#widgetsHome').hidden = false;
    refreshWidgetPreviews();
    activateWidgetPreviews();
  }

  function wdRefresh() {
    if (!wdCurrent) return;
    var url = widgetUrl(wdCurrent, false);
    $('#wdUrl').value = url;
    clearTimeout(wdTimer);
    wdTimer = setTimeout(function () {
      if (wdCurrent) $('#wdPreview').src = widgetUrl(wdCurrent, true);
    }, 300); // หน่วงตอนลากแถบสี/ตัวเลข
  }

  // การ์ดเลือกธีม — แยกทีละ widget เป็นหลัก (widget แต่ละตัวมี URL ของตัวเอง ตั้งคนละธีมได้)
  // ปุ่ม "ใช้กับทุก widget" ไว้เผื่ออยากจัดชุดเดียวกันทั้งหน้าจอทีเดียว
  function buildTemplateCard(w) {
    var card = el('div', { class: 'card' }, [
      el('div', { class: 'card-title' }, [window.Icon.el('sparkles', 14), el('span', { text: Tk.t('ธีม') })]),
      el('div', { class: 'hint', style: 'margin-bottom:10px' , text: Tk.t('เลือกแยกได้ทีละ widget — ตัวอย่างด้านขวาจะเปลี่ยนตามทันที') })
    ]);
    var cur = widgetTemplate(w.file);
    var descEl = el('div', { class: 'hint', style: 'margin-top:10px' });

    function setTpl(v) {
      var all = Object.assign({}, (S.settings && S.settings.widgetOpts) || {});
      all[w.file] = Object.assign({}, all[w.file], { template: v });
      S.settings.widgetOpts = all;
      saveSettings({ widgetOpts: all }, true);
      cur = v;
      paint();
      wdRefresh();
      refreshWidgetPreviews();
    }

    var row = el('div', { class: 'tpl-row' });
    function paint() {
      row.innerHTML = '';
      TEMPLATES.forEach(function (t) {
        var b = el('button', {
          class: 'tpl-chip' + (t.v === cur ? ' on' : ''),
          type: 'button', title: Tk.t(t.desc),
          onclick: function () { setTpl(t.v); }
        }, [
          el('span', { class: 'tpl-swatch tpl-' + t.v }),
          el('span', { text: Tk.t(t.t) })
        ]);
        row.appendChild(b);
      });
      var meta = TEMPLATES.filter(function (t) { return t.v === cur; })[0];
      descEl.textContent = meta ? Tk.t(meta.desc) : '';
    }
    paint();
    card.appendChild(row);
    card.appendChild(descEl);

    card.appendChild(el('button', {
      class: 'btn btn-ghost btn-sm', type: 'button', style: 'margin-top:12px',
      onclick: function () {
        var v = cur;
        var all = Object.assign({}, (S.settings && S.settings.widgetOpts) || {});
        WIDGETS.forEach(function (d) {
          if (NO_TEMPLATE[d.file]) return;
          all[d.file] = Object.assign({}, all[d.file], { template: v });
        });
        S.settings.widgetOpts = all;
        saveSettings({ widgetOpts: all }, true);
        wdRefresh();
        refreshWidgetPreviews();
        toast(Tk.t('ตั้งธีม "{name}" ให้ทุก widget แล้ว', { name: Tk.t((TEMPLATES.filter(function (t) { return t.v === v; })[0] || {}).t) }), 'ok');
      }
    }, [window.Icon.el('sparkles', 13), el('span', { text: Tk.t('ใช้ธีมนี้กับทุก widget') })]));

    return card;
  }

  // ---------- ช่องค้นหาการตั้งค่าของ widget ----------
  //
  // ตัวเลือกของ widget บางตัวมีเกือบ 30 อย่าง กระจายอยู่ใน 5-6 กลุ่มที่พับไว้
  // ผู้ใช้ที่จำได้ว่า "มีตัวปรับความหนาตัวอักษรอยู่นะ" ต้องไล่กางทีละกลุ่มจนเจอ
  //
  // ค้นทั้ง "ชื่อตัวเลือก" และ "คำอธิบายใต้ชื่อ" เพราะคนมักค้นด้วยสิ่งที่อยากได้
  // ไม่ใช่ชื่อที่เราตั้ง (พิมพ์ "อ่านง่ายบนพื้นสว่าง" แล้วต้องเจอ "ขอบตัวอักษร")
  // และค้นชื่อกลุ่มด้วย — พิมพ์ชื่อกลุ่มแล้วเห็นทุกตัวเลือกในกลุ่มนั้น
  //
  // แถวของ widget ที่มีแผงตั้งค่าเฉพาะตัว (เป้าหมาย/Timer/วงล้อ) ใช้โครงคนละแบบกับ
  // ตัวเลือกที่สร้างอัตโนมัติ จึงต้องระบุคลาสของทั้งสองฝั่ง ไม่ใช่ตัวเดียว
  var OPT_ROW_SEL = '.opt-row, .field, .switch-row, .check-inline, .goal-row';

  function buildOptSearch(form) {
    if ($$(OPT_ROW_SEL, form).length < 8) return;   // ตัวเลือกน้อย กวาดตาเจอเร็วกว่าพิมพ์ค้นหา

    var input = el('input', { type: 'search', class: 'opt-search-inp',
      placeholder: Tk.t('ค้นหาการตั้งค่า เช่น สี ฟอนต์ ขนาด...') });
    var count = el('span', { class: 'opt-search-count' });
    var box = el('div', { class: 'opt-search' }, [window.Icon.el('search', 14), input, count]);
    form.insertBefore(box, form.firstChild);

    // จำสถานะกางของแต่ละกลุ่มไว้ก่อน — ล้างคำค้นแล้วต้องกลับไปเหมือนเดิม
    // ไม่ใช่กางค้างทุกกลุ่มเพราะตอนค้นเราไปสั่งกางไว้
    // ผูกกับตัว element (WeakMap) ไม่ใช่ลำดับในอาร์เรย์ เผื่อฟอร์มมีของงอกทีหลัง
    var openWas = new WeakMap();
    $$('details', form).forEach(function (d) { openWas.set(d, d.open); });

    // ค้นทุกครั้งด้วยรายการสดจาก DOM ไม่ใช่รายการที่เก็บไว้ตอนสร้างช่องค้นหา
    // เพราะบางแผง (เช่นฟอร์มเป้าหมาย) สร้างแถวเพิ่มทีหลังเมื่อข้อมูลมาถึง
    // ถ้าใช้รายการเก่า แถวที่งอกใหม่จะค้นไม่เจอ และจะไม่ถูกซ่อนตอนค้นคำอื่นด้วย
    function allRows() { return $$(OPT_ROW_SEL, form); }
    function allDetails() { return $$('details', form); }

    function reset() {
      allRows().forEach(function (r) { r.classList.remove('opt-hide'); });
      allDetails().forEach(function (d) {
        d.classList.remove('opt-hide');
        if (openWas.has(d)) d.open = openWas.get(d);
      });
      $$('.card, .wcfg', form).forEach(function (c) { c.classList.remove('opt-hide'); });
      count.textContent = '';
      count.classList.remove('none');
    }

    function run() {
      var q = String(input.value || '').trim().toLowerCase();
      if (!q) { reset(); return; }
      var rows = allRows(), details = allDetails();
      // กลุ่มที่งอกมาทีหลังต้องจำสถานะกางเดิมไว้ด้วย ก่อนที่เราจะไปสั่งกาง
      details.forEach(function (d) { if (!openWas.has(d)) openWas.set(d, d.open); });
      var hits = 0;
      // กลุ่มที่ "ชื่อกลุ่มตรงคำค้น" ให้โชว์ทุกแถวในกลุ่มนั้น
      var openGroups = [];
      details.forEach(function (d) {
        var sm = d.querySelector('summary');
        if (sm && sm.textContent.toLowerCase().indexOf(q) >= 0) openGroups.push(d);
      });
      rows.forEach(function (r) {
        var inNamedGroup = openGroups.some(function (d) { return d.contains(r); });
        var hit = inNamedGroup || (r.textContent || '').toLowerCase().indexOf(q) >= 0;
        r.classList.toggle('opt-hide', !hit);
        if (hit) hits++;
      });
      // กลุ่ม/การ์ดที่ไม่เหลือแถวที่ตรงเลย ซ่อนทั้งก้อน ไม่งั้นเหลือหัวข้อลอยเต็มจอ
      details.forEach(function (d) {
        var any = $$(OPT_ROW_SEL, d).some(function (r) { return !r.classList.contains('opt-hide'); });
        d.classList.toggle('opt-hide', !any);
        if (any) d.open = true;
      });
      $$('.card, .wcfg', form).forEach(function (c) {
        if (c.contains(box)) return;   // การ์ดที่มีช่องค้นหาอยู่ ห้ามซ่อนตัวเอง
        var any = $$(OPT_ROW_SEL, c).some(function (r) { return !r.classList.contains('opt-hide'); });
        c.classList.toggle('opt-hide', !any && $$(OPT_ROW_SEL, c).length > 0);
      });
      count.textContent = hits ? Tk.t('เจอ {n} รายการ', { n: hits }) : Tk.t('ไม่เจอ');
      count.classList.toggle('none', !hits);
    }

    input.addEventListener('input', debounce(run, 120));
    // Esc = ล้างคำค้นกลับไปเห็นทุกอย่าง (นิสัยเดียวกับช่องค้นหาทั่วไป)
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { input.value = ''; run(); e.stopPropagation(); }
    });
  }

  // ฟอร์มรูปลักษณ์ (บันทึกลง settings.widgetOpts — เดิมอยู่แค่ใน URL แล้วรีเซ็ตทุกครั้งที่เปิด)
  function buildOptsCard(w) {
    var saved = widgetOpts(w.file);
    var card = el('div', { class: 'card' }, [
      el('div', { class: 'card-title' }, [window.Icon.el('sparkles', 14), el('span', { text: Tk.t('รูปลักษณ์') })])
    ]);

    // ฝั่ง main เขียน settings.json ทั้งไฟล์แบบซิงโครนัสทุกครั้งที่บันทึก
    // ลากแถบสีหนึ่งครั้งยิง event 'input' เป็นร้อยครั้ง = main ถูกบล็อกจนอีเวนต์ TikTok/overlay สะดุด
    // จึงแยกเป็น "อัปเดตในหน้าทันที" กับ "เขียนลงดิสก์ทีหลัง" เฉพาะตัวควบคุมแบบลาก
    function persistOpts() { saveSettings({ widgetOpts: S.settings.widgetOpts }, true); }
    var persistOptsSoon = debounce(persistOpts, 300);
    function save(k, v, dragging) {
      var all = Object.assign({}, (S.settings && S.settings.widgetOpts) || {});
      var one = Object.assign({}, all[w.file]);
      if (v === '' || v === undefined || v === null) delete one[k];   // ล้างค่า = กลับไปใช้ค่าเริ่มต้นของ widget
      else one[k] = v;
      all[w.file] = one;
      S.settings.widgetOpts = all;
      if (dragging) persistOptsSoon();
      else { persistOptsSoon.cancel(); persistOpts(); }  // กดล้างค่า/เลือกจากลิสต์ = บันทึกทันที และทิ้งงานลากที่ค้างอยู่
      wdRefresh();          // ตัวอย่างสดหน่วง 300 ms ในตัวอยู่แล้ว
      refreshWidgetPreviews();
    }

    // แต่ละกลุ่มเป็นกล่องพับได้ กลุ่มแรกเปิดไว้ — ไม่งั้นรายการยาวจนหาไม่เจอ
    var groups = {}, first = true;
    function hostFor(name) {
      if (groups[name]) return groups[name];
      var body = el('div', { class: 'optgrp-body' });
      var det = el('details', { class: 'optgrp' }, [el('summary', { text: Tk.t(name) }), body]);
      det.open = first; first = false;
      card.appendChild(det);
      groups[name] = body;
      return body;
    }

    // แถวเดียว: ป้ายซ้าย ตัวควบคุมขวา
    function row(o, ctrl) {
      var label = el('div', { class: 'opt-label' }, [el('span', { text: Tk.t(o.label) })]);
      if (o.hint) label.appendChild(el('span', { class: 'opt-hint', text: Tk.t(o.hint) }));
      return el('div', { class: 'opt-row' }, [label, el('div', { class: 'opt-ctrl' }, ctrl)]);
    }

    optsOf(w).forEach(function (o) {
      var host = hostFor(o.g || 'ทั่วไป');
      var isSet = saved[o.k] !== undefined && saved[o.k] !== '';
      var cur = isSet ? saved[o.k] : o.def;

      if (o.type === 'bool') {
        var chk = el('input', { type: 'checkbox' });
        chk.checked = !!cur;
        chk.addEventListener('change', function () { save(o.k, chk.checked); });
        host.appendChild(row(o, [chk]));
        return;
      }

      if (o.type === 'color') {
        // สวอตช์เล็ก + ปุ่มล้าง (โผล่เฉพาะตอนตั้งค่าไว้แล้ว) — ไม่ใช่แถบสียาวเต็มบรรทัด
        var sw = el('input', { type: 'color', class: 'opt-color' + (isSet ? '' : ' unset'),
                               value: isSet ? cur : (o.def || '#ffffff'),
                               title: isSet ? cur : Tk.t('ยังไม่ได้ตั้ง — ใช้สีเดิมของ widget') });
        var clr = el('button', { class: 'opt-clear', type: 'button', title: Tk.t('ล้างค่า'), text: '×' });
        clr.hidden = !isSet;
        sw.addEventListener('input', function () {
          sw.classList.remove('unset'); clr.hidden = false; sw.title = sw.value;
          save(o.k, sw.value, true);   // ยังลากอยู่ — เขียนลงดิสก์ทีเดียวตอนหยุดลาก
        });
        clr.addEventListener('click', function () {
          sw.classList.add('unset'); clr.hidden = true;
          sw.value = o.def || '#ffffff'; sw.title = Tk.t('ยังไม่ได้ตั้ง — ใช้สีเดิมของ widget');
          save(o.k, '');
        });
        host.appendChild(row(o, [sw, clr]));
        return;
      }

      var inp;
      if (o.type === 'select') {
        inp = el('select', {}, (o.options || []).map(function (x) {
          return el('option', { value: x.v, text: Tk.t(x.t), selected: String(x.v) === String(cur) ? 'selected' : null });
        }));
        inp.addEventListener('change', function () { save(o.k, inp.value); });
      } else if (o.type === 'number') {
        inp = el('input', { type: 'number', value: isSet ? cur : '',
          min: o.min != null ? String(o.min) : null, max: o.max != null ? String(o.max) : null,
          placeholder: o.def === '' || o.def == null ? Tk.t('อัตโนมัติ') : String(o.def) });
        inp.addEventListener('change', function () {
          var raw = inp.value.trim();
          save(o.k, raw === '' ? '' : Number(raw));   // เว้นว่าง = กลับไปใช้ค่าเริ่มต้น
        });
      } else if (o.type === 'text') {
        // ช่องข้อความที่ผู้ใช้ตั้งเอง — placeholder เป็นประโยคเดิมของ widget
        // ให้เห็นว่าตอนนี้เขียนว่าอะไร และจะเอาไปดัดแปลงยังไง เว้นว่าง = ใช้ประโยคเดิม
        inp = el('input', { type: 'text', value: cur || '',
          // แปลด้วย — ไม่งั้นตั้งโปรแกรมเป็นอังกฤษแล้ว placeholder โชว์ไทย
          // ทั้งที่ widget จะพ่นอังกฤษออกไปจริง (คนละเรื่องกันจนสับสน)
          placeholder: o.def ? Tk.t(String(o.def)) : Tk.t('ค่าเริ่มต้น') });
        inp.addEventListener('change', function () { save(o.k, inp.value); });
      } else {
        inp = el('input', { type: 'text', value: cur || '', placeholder: Tk.t('ค่าเริ่มต้น') });
        inp.addEventListener('change', function () { save(o.k, inp.value); });
      }
      host.appendChild(row(o, [inp]));
    });
    return card;
  }

  function bindWidgetDetail() {
    $('#wdBack').addEventListener('click', closeWidgetDetail);
    $('#wdCopy').addEventListener('click', function () {
      var u = $('#wdUrl').value;
      navigator.clipboard.writeText(u)
        .then(function () { toast(Tk.t('คัดลอก URL แล้ว — วางในโปรแกรมไลฟ์ได้เลย'), 'ok'); })
        .catch(function () { toast(Tk.t('คัดลอกไม่สำเร็จ — คลิกในช่อง URL แล้วกด Ctrl+C'), 'err'); });
    });
    $('#wdOpen').addEventListener('click', function () {
      invoke('app:openExternal', { url: $('#wdUrl').value }, { toast: false });
    });
    $('#wdUrl').addEventListener('click', function (e) { e.target.select(); });
  }

  // ---------- widget ตัวไหนถูกเปิดใช้อยู่จริง ----------
  // ตัวที่ยังไม่ได้เอาไปใช้จะจางลง ให้ตัวที่ใช้อยู่เด่นขึ้นในรายการ 15 ใบ
  // ไม่ใช่ปุ่มให้กดเปิด/ปิด เพราะ widget อยู่ในโปรแกรมไลฟ์ ไม่ใช่ในแอปเรา
  // (ปุ่มปิดที่บล็อกจริงจะทำให้คนที่ลืมว่าปิดไว้เจอแหล่งภาพว่างกลางไลฟ์)
  var liveWidgets = [];
  function applyWidgetsLive(list) {
    liveWidgets = Array.isArray(list) ? list : [];
    paintWidgetsLive();
  }
  function paintWidgetsLive() {
    $$('#widgetsList .wcard').forEach(function (card) {
      var on = liveWidgets.indexOf(card.dataset.file) >= 0;
      card.classList.toggle('w-idle', !on);
      var b = card.querySelector('.wpv-live');
      if (b) b.hidden = !on;
    });
  }

  // โหลด/หยุด iframe preview เมื่อเข้า-ออกแท็บ Widgets (กันกิน CPU ตอนไม่ได้ดู)
  //
  // ตัวอย่างแต่ละอันเป็น "หน้าเว็บเต็มใบ" — มี WebSocket ของตัวเอง รับทุก event ที่เข้ามา
  // และตัวที่มีอนิเมชัน/ฟิสิกส์ (เหยือก วงล้อ แถบเลื่อน) ก็วาดทุกเฟรมตลอดเวลา
  // เปิดพร้อมกันทั้ง 14 อันคือเปิดเบราว์เซอร์ 14 แท็บค้างไว้ ทั้งที่ผู้ใช้เห็นทีละ 4-6 อัน
  // ยิ่งไลฟ์ยาว event ยิ่งเยอะ ทุกอันก็แกะ JSON ทุกใบเท่ากันหมด — นี่คือที่มาของอาการอืด
  //
  // โหลดเฉพาะการ์ดที่อยู่ในสายตาจริง เผื่อระยะไว้หนึ่งหน้าจอให้เลื่อนแล้วทันเห็น
  var pvObserver = null;
  var pvUnloadTimers = new WeakMap();

  function ensurePvObserver() {
    if (pvObserver || typeof IntersectionObserver !== 'function') return pvObserver;
    pvObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var f = en.target.querySelector('.wpv-frame');
        if (!f) return;
        var t = pvUnloadTimers.get(f);
        if (t) { clearTimeout(t); pvUnloadTimers.delete(f); }
        if (en.isIntersecting) {
          if (!f.src && f.dataset.src) f.src = f.dataset.src;
        } else if (f.src) {
          // หน่วงก่อนปิด — เลื่อนผ่านไปมาเร็วๆ ไม่ควรโหลดใหม่ทุกครั้ง
          pvUnloadTimers.set(f, setTimeout(function () {
            pvUnloadTimers.delete(f);
            if (f.src) f.removeAttribute('src');
          }, 1500));
        }
      });
    }, { root: null, rootMargin: '100% 0px', threshold: 0 });
    return pvObserver;
  }

  function activateWidgetPreviews() {
    var obs = ensurePvObserver();
    if (!obs) {   // เบราว์เซอร์เก่าไม่มี IntersectionObserver — ถอยไปโหลดทั้งหมดแบบเดิม
      $$('#widgetsList .wpv-frame').forEach(function (f) {
        if (!f.src && f.dataset.src) f.src = f.dataset.src;
      });
      return;
    }
    $$('#widgetsList .wpv-box').forEach(function (box) { obs.observe(box); });
  }
  // ตั้งค่า/ธีมเปลี่ยน → การ์ดหน้ารายการต้องโหลดใหม่ด้วย
  // (เดิม activateWidgetPreviews ตั้ง src เฉพาะตอนที่ยังไม่มี src การ์ดเลยค้างเป็นธีมเก่า)
  function refreshWidgetPreviews() {
    var frames = $$('#widgetsList .wpv-frame');
    WIDGETS.forEach(function (w, i) {
      var f = frames[i];
      if (!f) return;
      var url = widgetUrl(w, true);
      if (f.dataset.src === url) return;
      f.dataset.src = url;
      if (f.src) f.src = url;   // กำลังโชว์อยู่ → เปลี่ยนให้เห็นทันที
    });
  }
  function deactivateWidgetPreviews() {
    if (pvObserver) pvObserver.disconnect();
    $$('#widgetsList .wpv-frame').forEach(function (f) {
      var t = pvUnloadTimers.get(f);
      if (t) { clearTimeout(t); pvUnloadTimers.delete(f); }
      if (f.src) f.removeAttribute('src');
    });
  }

  // ---------- หน้าแต่งธีม widget: ปรับค่า → เห็นตัวอย่างสด → คัดลอก URL ที่ฝังค่าแล้ว ----------

  // ---------- TTS form ----------
  function bindTtsForm() {
    $$('[data-tts]').forEach(function (inp) {
      var key = inp.dataset.tts;
      inp.addEventListener(inp.type === 'checkbox' ? 'change' : 'input', debounce(function () {
        var val;
        if (inp.type === 'checkbox') val = inp.checked;
        else if (inp.type === 'range' || inp.type === 'number') val = Number(inp.value);
        else if (key === 'bannedWords') val = inp.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
        else val = inp.value;
        var patch = { tts: {} };
        patch.tts[key] = val;
        saveSettings(patch, true);
        if (inp.type === 'range') { var b = $('[data-slider-val="' + key + '"]'); if (b) b.textContent = Number(inp.value).toFixed(1); }
      }, 400));
    });

    // ตัวกรอง "ใครให้อ่านได้บ้าง" เก็บซ้อนอยู่ใน tts.allow จึงผูกแยกจาก [data-tts]
    // ที่เขียนได้แค่คีย์ชั้นเดียว
    $$('[data-tts-allow]').forEach(function (inp) {
      var key = inp.dataset.ttsAllow;
      inp.addEventListener(inp.type === 'checkbox' ? 'change' : 'input', debounce(function () {
        var cur = ((S.settings && S.settings.tts) || {}).allow || {};
        var val = inp.type === 'checkbox' ? inp.checked : Math.max(1, Math.min(50, Number(inp.value) || 1));
        var next = Object.assign({}, cur);
        next[key] = val;
        saveSettings({ tts: { allow: next } }, true);
        paintAllowState();
      }, 400));
    });
  }

  // ติ๊ก "ทุกคน" แล้วข้ออื่นไม่มีผล — หรี่ลงให้เห็นทันที ไม่ใช่ปล่อยให้กดแล้วงง
  function paintAllowState() {
    var host = $('#ttsAllowList');
    if (!host) return;
    var all = host.querySelector('[data-tts-allow="all"]');
    host.classList.toggle('all-on', !!(all && all.checked));
  }

  function fillTtsForm() {
    var t = (S.settings && S.settings.tts) || {};
    $$('[data-tts]').forEach(function (inp) {
      var key = inp.dataset.tts, v = t[key];
      if (inp.type === 'checkbox') inp.checked = !!v;
      else if (key === 'bannedWords') inp.value = (v || []).join('\n');
      else inp.value = v != null ? v : '';
      if (inp.type === 'range') { var b = $('[data-slider-val="' + key + '"]'); if (b) b.textContent = Number(v || 1).toFixed(1); }
    });
    // ค่าเริ่มต้นต้องตรงกับ settings.js — คนที่ยังไม่เคยตั้งจะได้เห็น "ทุกคน" ติ๊กอยู่
    var a = t.allow || { all: true, teamMinLevel: 1, topGiftersN: 3 };
    $$('[data-tts-allow]').forEach(function (inp) {
      var k = inp.dataset.ttsAllow, v = a[k];
      if (inp.type === 'checkbox') inp.checked = k === 'all' ? v !== false : !!v;
      else inp.value = v != null ? v : (k === 'topGiftersN' ? 3 : 1);
    });
    paintAllowState();
  }
  // ---------- TTS ผ่านเว็บ (Google TTS → เสียงเหมือนกันทุกเครื่อง) ----------
  var ttsQueue = [], ttsBusy = false, ttsAudio = null;
  // ภาษาเสียงอ่าน — ตรรกะอยู่ใน Tk.ttsLang (มีเทสต์คุม) ที่นี่แค่บอกว่าโปรแกรมตั้งภาษาอะไรไว้
  // ใช้เป็นตัวตัดสินตอนข้อความไม่มีตัวอักษรของภาษาไหนเลย (ตัวเลข/สัญลักษณ์ล้วน)
  function ttsLang(text) {
    var app = (Tk.i18n && Tk.i18n.current) ? Tk.i18n.current() : 'th';
    return Tk.ttsLang(text, app);
  }
  function ttsEnqueue(d) {
    if (!d || !d.text) return;
    if (ttsQueue.length > 12) ttsQueue.shift(); // กันคิวยาวตอนสตรีมคึกคัก
    ttsQueue.push(d);
    ttsPump();
  }
  function ttsPump() {
    if (ttsBusy || !ttsQueue.length) return;
    ttsBusy = true;
    var item = ttsQueue.shift();
    var s = (S.settings && S.settings.tts) || {};
    var text = String(item.text || '').slice(0, 190).trim();
    if (!text) { ttsBusy = false; return ttsPump(); }
    invoke('tts:fetch', { text: text, lang: ttsLang(text) }, { toast: false }).then(function (dataUrl) {
      if (!dataUrl) { ttsBusy = false; return ttsPump(); }
      var a = new Audio(dataUrl); ttsAudio = a;
      var voice = item.voice || s.voice || 'female';
      var rate = Number(item.rate != null ? item.rate : s.rate) || 1;
      // ชาย = เสียงทุ้ม (ลด pitch ผ่าน playbackRate); หญิง = เสียงเว็บปกติ
      a.playbackRate = voice === 'male' ? Math.max(0.5, rate * 0.8) : rate;
      a.volume = Math.max(0, Math.min(1, Number(item.volume != null ? item.volume : s.volume) || 1));
      // ปล่อยคิวได้ครั้งเดียวไม่ว่าจบเองหรือ watchdog ตัด — กันคิว TTS ค้างถาวรถ้า Audio ไม่ยิง onended/onerror
      // (data URL เสีย, อุปกรณ์เสียงหลุดกลางทาง) ซึ่งเคยทำให้เสียงอ่านหยุดทั้งไลฟ์จนต้องรีสตาร์ต
      var settled = false;
      function done(cut) {
        if (settled) return;
        settled = true;
        clearTimeout(wd);
        if (cut) { try { a.pause(); } catch (e) {} } // watchdog ตัด: หยุดชิ้นที่ค้างก่อนไปชิ้นถัดไป
        ttsAudio = null; ttsBusy = false; ttsPump();
      }
      var wd = setTimeout(function () { done(true); }, text.length * 120 + 15000);
      a.onended = a.onerror = function () { done(false); };
      a.play().catch(function () { done(false); });
    }).catch(function () { ttsBusy = false; ttsPump(); });
  }

  // ---------- Goals & Timer forms ----------
  var GOAL_PERIODS = [
    { v: 'session', t: 'ไลฟ์นี้' }, { v: 'today', t: 'วันนี้' },
    { v: 'week', t: 'สัปดาห์นี้' }, { v: 'month', t: 'เดือนนี้' },
    { v: 'days:7', t: '7 วันล่าสุด' }, { v: 'days:30', t: '30 วันล่าสุด' },
    { v: 'all', t: 'ตลอดกาล' }
  ];
  function renderGoalsForm() {
    var host = $('#goalsForm');
    var goals = (S.settings && S.settings.goals) || {};
    var defs = [['likes', 'หัวใจ', 'heart'], ['diamonds', 'เพชร', 'diamond'], ['followers', 'ผู้ติดตามใหม่', 'follow']];
    host.innerHTML = '';
    defs.forEach(function (d) {
      var key = d[0], g = goals[key] || {};
      var enable = el('input', { type: 'checkbox' }); enable.checked = !!g.enabled;
      var target = el('input', { type: 'number', min: '0', value: g.target || 0 });
      var label = el('input', { type: 'text', value: g.label || '' });
      // ช่วงที่นับ — ไม่ใช่ "ไลฟ์นี้" จะอ่านจากสถิติสะสมรายวันที่เก็บไว้ในเครื่อง
      var period = el('select', {}, GOAL_PERIODS.map(function (x) {
        return el('option', { value: x.v, text: Tk.t(x.t), selected: x.v === (g.period || 'session') ? 'selected' : null });
      }));
      function save() {
        var patch = { goals: {} };
        patch.goals[key] = {
          enabled: enable.checked, target: Number(target.value) || 0,
          label: label.value, period: period.value
        };
        saveSettings(patch, true);
      }
      enable.addEventListener('change', save);
      target.addEventListener('input', debounce(save, 400));
      label.addEventListener('input', debounce(save, 400));
      period.addEventListener('change', save);
      host.appendChild(el('div', { class: 'goal-cfg' }, [
        el('div', { class: 'goal-head' }, [el('b', { class: 'card-title', style: 'margin:0' }, [window.Icon.el(d[2], 15), el('span', { text: Tk.t(d[1]) })]), el('label', { class: 'check-inline' }, [enable, ' ' + Tk.t('เปิดใช้')])]),
        el('div', { class: 'grid2' }, [
          el('div', { class: 'field' }, [el('label', { text: Tk.t('เป้าหมาย') }), target]),
          el('div', { class: 'field' }, [el('label', { text: Tk.t('ป้ายกำกับ') }), label])
        ]),
        el('div', { class: 'field' }, [
          el('label', { text: Tk.t('นับจาก') }), period,
          el('div', { class: 'hint', text: Tk.t('ไม่ใช่ "ไลฟ์นี้" = นับสะสมข้ามไลฟ์จากข้อมูลที่เก็บไว้ในเครื่อง (เฉพาะช่วงที่โปรแกรมเปิดและเชื่อมต่ออยู่)') })
        ])
      ]));
    });
  }
  function bindTimerForm() {
    $$('[data-timer]').forEach(function (inp) {
      var key = inp.dataset.timer;
      inp.addEventListener(inp.type === 'checkbox' ? 'change' : 'input', debounce(function () {
        var val = inp.type === 'checkbox' ? inp.checked : (inp.type === 'number' ? Number(inp.value) : inp.value);
        var patch = { timer: {} }; patch.timer[key] = val;
        saveSettings(patch, true);
      }, 400));
    });
  }
  function fillTimerForm() {
    var t = (S.settings && S.settings.timer) || {};
    $$('[data-timer]').forEach(function (inp) {
      var v = t[inp.dataset.timer];
      if (inp.type === 'checkbox') inp.checked = !!v; else inp.value = v != null ? v : '';
    });
  }
  function applyGoals(g) {
    if (!g) return;
    S.goals = g;
    var host = $('#goalPreview');
    host.innerHTML = '';
    ['likes', 'diamonds', 'followers'].forEach(function (k) {
      var gg = g[k];
      if (!gg || !gg.enabled) return;
      var pct = gg.target > 0 ? Math.min(100, (gg.current / gg.target) * 100) : 0;
      host.appendChild(el('div', {}, [
        el('div', { class: 'gp-label' }, [el('span', { text: gg.label || k }), el('span', { text: fmt(gg.current || 0) + ' / ' + fmt(gg.target || 0) })]),
        el('div', { class: 'gp-bar' }, [el('div', { class: 'gp-fill', style: 'width:' + pct + '%' })])
      ]));
    });
  }
  function syncOnAirTimer() {
    var a = $('#onAirTimer'), d = $('#timerDisplay');
    if (a && d) a.textContent = d.textContent;
  }

  function applyTimer(t) {
    if (!t) return;
    S.timer = t;
    var sec = Math.max(0, Math.floor(t.remainingSec || 0));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    function p(n) { return (n < 10 ? '0' : '') + n; }
    $('#timerDisplay').textContent = (h > 0 ? p(h) + ':' : '') + p(m) + ':' + p(s);
    syncOnAirTimer();
  }

  // ---------- Settings forms ----------
  function bindSettingsForms() {
    fillTtsForm();
    renderGoalsForm();
    bindTimerForm();
    fillTimerForm();
    $('#autoConnectChk').checked = !!(S.settings && S.settings.autoConnect);
    // ชื่อ TikTok ที่บันทึกไว้ต้องกลับมาอยู่ในช่องตอนเปิดโปรแกรมใหม่ด้วย
    // เดิมช่องนี้ถูกเติมจาก "สถานะการเชื่อมต่อ" เท่านั้น ซึ่งตอนเพิ่งเปิดโปรแกรมยังว่างอยู่
    // ค่าจึงถูกบันทึกลงดิสก์จริง (ขึ้น "บันทึกแล้ว" ถูกต้อง) แต่ไม่มีใครอ่านกลับมาแสดง
    // — เห็นเป็นช่องว่างเปล่าเหมือนไม่ได้เซฟ ยกเว้นตอนเปิด auto-connect ไว้ซึ่งจะเชื่อมให้เองแล้วชื่อโผล่มาเอง
    var uInput = $('#usernameInput');
    if (uInput && !uInput.value && S.settings && S.settings.username) uInput.value = S.settings.username;

    $$('[data-setting]').forEach(function (inp) {
      var path = inp.dataset.setting;
      // เติมค่าเริ่มต้น
      var v = getPath(S.settings, path);
      if (inp.type === 'checkbox') inp.checked = !!v; else inp.value = v != null ? v : '';
      inp.addEventListener(inp.type === 'checkbox' ? 'change' : 'input', debounce(function () {
        var val;
        if (inp.type === 'checkbox') { val = inp.checked; }
        else if (inp.type === 'number') {
          // ช่องตัวเลข: ค่าว่าง/นอกช่วง min–max อย่าบันทึกทับ ไม่งั้นลบค่าเพื่อพิมพ์ใหม่แล้วปิดแอปจะได้ 0
          // (พอร์ตเซิร์ฟเวอร์ = 0 → overlay ไปอยู่พอร์ตอื่น URL ที่วางไว้ในโปรแกรมไลฟ์พังหมดโดยไม่รู้สาเหตุ)
          if (inp.value === '') return;
          val = Number(inp.value);
          var lo = inp.min !== '' ? Number(inp.min) : -Infinity;
          var hi = inp.max !== '' ? Number(inp.max) : Infinity;
          if (!isFinite(val) || val < lo || val > hi) {
            if (inp.min !== '' || inp.max !== '') toast(Tk.t('ค่าต้องอยู่ระหว่าง {lo}–{hi}', { lo: lo, hi: hi }), 'warn', 3000);
            return;
          }
        } else { val = inp.value; }
        saveSettings(setPath({}, path, val), true);
        // เปลี่ยนภาษา = มีผลทันที ไม่ต้องรีสตาร์ท: เซ็ต locale ใหม่ (ทา static HTML ให้เอง)
        // แล้ว re-render ส่วน dynamic ที่ประกอบข้อความจาก JS
        if (path === 'language') {
          Tk.i18n.setLocale(val, S.osLocale);
          updateLangToggle();
          rerenderForLocale();
        }
      }, 500));
    });
  }

  // วาดส่วน dynamic ใหม่หลังสลับภาษา — ส่วน static ถูก Tk.i18n.applyDom ทาให้แล้ว
  // (ส่วนที่ผูกกับ event สด เช่น สถานะเชื่อมต่อ/สถิติ จะอัปเดตเองรอบ event ถัดไป)
  function rerenderForLocale() {
    var soundpad = function () { if (window.SoundpadUI) window.SoundpadUI.rerender(); }; // แท็บ Sound วาดด้วย JS ทั้งใบ applyDom ทาให้ไม่ได้
    [ncRemount, renderTemplates, renderActions, renderProfileBar, renderWidgets, renderOnAir, renderFeedFilters, soundpad].forEach(function (fn) {
      try { fn(); } catch (e) { /* ส่วนไหนยังไม่พร้อมก็ข้าม ไม่ให้สลับภาษาแล้วพัง */ }
    });
    try {
      $('#updateStatusText').textContent = Tk.t('เวอร์ชันปัจจุบัน') + ' v' + S.version;
      $('#serverStatus').textContent = Tk.t('เซิร์ฟเวอร์') + ': :' + S.serverPort;
    } catch (e) {}
  }

  // ---------- OBS ----------
  function applyObsStatus(o) {
    var connected = !!o.connected;
    var elS = $('#obsStatus');
    elS.innerHTML = '';
    elS.appendChild(el('span', { class: 'dot ' + (connected ? 'connected' : 'disconnected'), style: 'display:inline-block;margin-right:7px' }));
    elS.appendChild(document.createTextNode(connected ? Tk.t('เชื่อมต่อแล้ว') : (o.error ? o.error : Tk.t('ยังไม่เชื่อมต่อ'))));
    $('#obsBar').textContent = 'OBS: ' + (connected ? Tk.t('เชื่อมต่อ') : '—');
    if (connected) refreshScenes();
    else $('#obsScenes').innerHTML = '';
  }
  async function refreshScenes() {
    try {
      var scenes = await invoke('obs:scenes', {}, { toast: false });
      var host = $('#obsScenes');
      host.innerHTML = '';
      (scenes || []).forEach(function (s) { host.appendChild(el('span', { class: 'scene-chip', text: s })); });
    } catch (e) { /* ยังไม่เชื่อม */ }
  }

  // ---------- Sound playback ----------
  // TTS เล่นที่ main process ด้วย macOS say (ttsPlayer) — renderer ไม่ต้องทำ
  // /media/... = ไฟล์ในคลัง เสิร์ฟผ่าน overlay server — Dashboard (file://) ต้องต่อ origin เต็ม
  function resolveMediaUrl(url) {
    if (!url) return url;
    if (/^(https?:|file:|data:)/i.test(url)) return url;
    if (url.charAt(0) === '/') return (window.__TK_DEMO_BASE || ('http://localhost:' + (S.serverPort || 21213))) + url;
    return url;
  }

  function playSound(url, volume) {
    url = resolveMediaUrl(url);
    if (!url) return;
    try {
      var a = new Audio(url);
      a.volume = (volume != null && isFinite(volume)) ? Math.max(0, Math.min(1, volume)) : 1;
      a.play().catch(function (e) { logStatus({ level: 'warn', msg: Tk.t('เล่นเสียงไม่สำเร็จ: {err}', { err: (e && e.message) || e }) }); });
    } catch (e) { logStatus({ level: 'warn', msg: Tk.t('เล่นเสียงไม่สำเร็จ: {err}', { err: e.message }) }); }
  }

  // ---------- Statusbar ----------
  // ข้อความจากฝั่งโปรแกรม (main/core) เขียนเป็นภาษาไทยทั้งหมด แล้วเดินทางมาถึงหน้าจอ
  // เป็นสตริงสำเร็จรูป — ถ้าเอามาโชว์ดิบๆ ผู้ใช้ที่ตั้งอังกฤษจะเจอไทยโผล่ทุกครั้งที่มี error
  //
  // ส่งผ่าน Tk.t() ก่อนเสมอ: ข้อความที่มีคำแปลจะถูกแปลให้ ที่ยังไม่มีก็ตกเป็นไทยเหมือนเดิม
  // (ไม่ได้แย่ลงกว่าเดิม) และเพิ่มคำแปลทีหลังได้โดยไม่ต้องแก้ฝั่งโปรแกรมเลย
  function logStatus(l) {
    var s = $('#statusLog');
    s.textContent = Tk.t(l.msg);
    s.className = 'status-log' + (l.level === 'error' ? ' err' : l.level === 'warn' ? ' warn' : '');
  }

  // ---------- Bus event router ----------
  function onBusEvent(msg) {
    var event = msg.event, data = msg.data;
    switch (event) {
      case 'chat': case 'gift': case 'like': case 'follow':
      case 'share': case 'subscribe': case 'member':
        pushEvent(event, data); break;
      case 'stats': applyStats(data); break;
      case 'goals': applyGoals(data); if ($('#goalsForm').children.length === 0) renderGoalsForm(); break;
      case 'leaderboard': applyLeaderboard(data); break;
      case 'timer': applyTimer(data); break;
      case 'connectionState': applyConnectionState(data); break;
      case 'connected': nc.live = {}; applyConnectionState({ status: 'connected', username: data.username, roomId: data.roomId }); toast(Tk.t('เชื่อมต่อ @{user} แล้ว 🟢', { user: data.username }), 'ok'); break;
      case 'disconnected':
        applyConnectionState({ status: 'disconnected', username: data.username });
        // หลุดโดยไม่ได้กดตัดเอง → เสียงเตือนดังๆ (ตั้งปิดได้ในแท็บตั้งค่า)
        if (data && data.unexpected && S.settings && S.settings.disconnectAlarm !== false) {
          playDisconnectAlarm();
          toast(Tk.t('⚠️ หลุดจากไลฟ์! กำลังเชื่อมต่อใหม่...'), 'err', 6000);
        }
        break;
      case 'streamEnd': toast(Tk.t('ไลฟ์จบแล้ว'), 'warn'); break;
      case 'sound': playSound(data.url, data.volume); break;
      case 'tts': ttsEnqueue(data); break; // เล่นเสียงเว็บ TTS ที่ renderer
      case 'obsState': applyObsStatus(data); break;
      case 'action': logStatus({ level: 'info', msg: Tk.t('{name} ทำงาน', { name: data.name || 'Action' }) }); ncOnAction(data); break;
      case 'actionStep': ncOnStep(data); break;   // ไฟวิ่งตามสายในมุมมองโหนด
      case 'log': logStatus(data); if (data.level === 'error') toast(Tk.t(data.msg), 'err', 4000); break;
      case 'updateStatus': applyUpdateStatus(data); break;
      case 'winCounter': applyWinCounter(data); break;
      case 'widgetsLive': applyWidgetsLive(data && data.widgets); break;
      // รายการของขวัญของห้องจริงมาถึง → ทิ้งแคชเดิม โหลดใหม่ แล้ววาดการ์ด/โหนดให้รูปและ id ตรงกับของจริง
      case 'giftsUpdated':
        giftCatalog = null;
        ncGiftsP = null;
        loadGiftCatalog().then(function () { renderActions(); });
        if (window.ActionsEditor && window.ActionsEditor.invalidateGifts) window.ActionsEditor.invalidateGifts();
        break;
      // แพดต้องตอบสนองแม้ผู้ใช้ไม่ได้เปิดแท็บอยู่ (กดจากในเกม) — ส่งต่อให้โมดูลจัดการเอง
      // soundpadCmd = คำสั่งรวมจาก main (ปุ่มลัดหยุดทุกเสียง / ปิดระบบ) main เล่นหรือหยุดเสียงเองไม่ได้
      case 'soundpadState': case 'soundpadKey': case 'soundpadCmd':
        if (window.SoundpadUI) window.SoundpadUI.onEvent(event, data);
        break;
      case 'authState':
        S.auth = data;
        // เจาะจง .tab เพราะ [data-tab="billing"] เฉย ๆ คว้าปุ่มเมนู (อยู่ก่อนใน DOM) ที่ไม่เคยถูกซ่อน เงื่อนไขเลยจริงเสมอ
        if (!$('.tab[data-tab="billing"]').hidden) renderBillingStatus();
        break;
      case 'billingDone': onBillingDone(data); break;
      case 'billingFailed': onBillingFailed(data); break;
    }
  }

  // ---------- อัปเดตโปรแกรม ----------
  // ---------- กล่องแจ้งอัปเดตแบบใหญ่ (เฉพาะตอนเพิ่งเปิดโปรแกรม) ----------
  // เจออัปเดตตอนเปิดแอป = ผู้ใช้ยังไม่ได้เริ่มทำอะไร เด้งกล่องกลางจอได้ไม่รบกวน และเห็นแน่นอน
  // เจอระหว่างใช้งาน (วนเช็คทุก 4 ชม. / กดเช็คเอง) = อาจกำลังไลฟ์อยู่ ใช้แถบเล็กด้านบนเหมือนเดิม
  var updModal = null;      // { close, bar, pct, note, installBtn } ของกล่องที่เปิดอยู่
  var updModalShown = false; // เปิดแล้วครั้งหนึ่งต่อการเปิดแอปหนึ่งครั้ง — ปิดแล้วอย่าเด้งซ้ำ

  function openUpdateModal(s) {
    if (updModal || updModalShown) return;
    updModalShown = true;
    var bar = el('span', { class: 'upd-bar-fill' });
    var pct = el('span', { class: 'upd-pct' });
    var note = el('p', { class: 'upd-note' });
    var installBtn = el('button', { class: 'btn btn-primary', type: 'button' }, [
      window.Icon.el('refresh', 14), el('span', { text: Tk.t('ติดตั้งแล้วเปิดใหม่') })
    ]);
    installBtn.disabled = true;
    installBtn.addEventListener('click', function () { invoke('update:install'); });
    var laterBtn = el('button', { class: 'btn btn-ghost', type: 'button', text: Tk.t('ไว้ทีหลัง') });
    laterBtn.addEventListener('click', function () { closeUpdateModal(); });

    var body = el('div', { class: 'upd-modal' }, [
      el('div', { class: 'upd-ico' }, [window.Icon.el('download', 26)]),
      el('h2', { text: Tk.t('มีเวอร์ชันใหม่ v{v}', { v: s.version || '' }) }),
      el('p', { class: 'upd-sub', text: Tk.t('โปรแกรมกำลังดาวน์โหลดให้อัตโนมัติ — ติดตั้งได้เลยเมื่อโหลดเสร็จ หรือกด "ไว้ทีหลัง" แล้วค่อยติดตั้งตอนปิดโปรแกรม') }),
      el('div', { class: 'upd-bar' }, [bar]),
      pct,
      note,
      el('div', { class: 'modal-foot' }, [laterBtn, installBtn])
    ]);
    var m = Tk.modal(body, { dismissible: false });
    updModal = { m: m, bar: bar, pct: pct, note: note, installBtn: installBtn };
    paintUpdateModal(s);
  }

  function closeUpdateModal() {
    if (!updModal) return;
    try { updModal.m.close(); } catch (_) {}
    updModal = null;
  }

  function paintUpdateModal(s) {
    if (!updModal) return;
    if (s.state === 'downloading') {
      var p = Math.max(0, Math.min(100, Number(s.percent) || 0));
      updModal.bar.style.width = p + '%';
      updModal.pct.textContent = Tk.t('กำลังดาวน์โหลด... {n}%', { n: p });
      updModal.installBtn.disabled = true;
    } else if (s.state === 'downloaded') {
      updModal.bar.style.width = '100%';
      updModal.pct.textContent = Tk.t('ดาวน์โหลดเสร็จแล้ว');
      updModal.note.textContent = Tk.t('กดติดตั้งแล้วโปรแกรมจะปิดและเปิดขึ้นมาใหม่เอง');
      updModal.installBtn.disabled = false;
    } else if (s.state === 'error') {
      updModal.pct.textContent = Tk.t('ดาวน์โหลดไม่สำเร็จ');
      updModal.note.textContent = String(s.message || '');
    }
  }

  function applyUpdateStatus(s) {
    var banner = $('#updateBanner');
    var txt = $('#updateBannerText');
    var installBtn = $('#updateInstallBtn');
    var statusText = $('#updateStatusText');
    var cur = 'v' + (S.version || '');
    if (!s || !s.state) return;

    // แถบบนหัว — โชว์เฉพาะตอนกำลังโหลด/พร้อมติดตั้ง
    if (s.state === 'downloading') {
      banner.hidden = false; banner.classList.remove('ready');
      txt.textContent = Tk.t('🎉 มีอัปเดต v{v} — กำลังดาวน์โหลด...', { v: s.version || '' }) + (s.percent ? ' (' + s.percent + '%)' : '');
      installBtn.hidden = true;
    } else if (s.state === 'downloaded') {
      banner.hidden = false; banner.classList.add('ready');
      txt.textContent = Tk.t('✅ อัปเดต v{v} พร้อมติดตั้งแล้ว', { v: s.version || '' });
      installBtn.hidden = false;
    } else {
      banner.hidden = true;
    }

    // กล่องใหญ่ — เฉพาะรอบเช็คแรกตอนเปิดโปรแกรม (main เป็นคนบอกผ่านธง first)
    if (s.first && (s.state === 'downloading' || s.state === 'downloaded')) openUpdateModal(s);
    paintUpdateModal(s);

    // ข้อความในแท็บตั้งค่า
    switch (s.state) {
      case 'checking': statusText.textContent = Tk.t('กำลังเช็คอัปเดต...'); break;
      case 'downloading': statusText.textContent = Tk.t('กำลังดาวน์โหลด v{v}', { v: s.version || '' }) + (s.percent ? ' (' + s.percent + '%)' : '') + '...'; break;
      case 'downloaded': statusText.textContent = Tk.t('อัปเดต v{v} พร้อมติดตั้ง — กดรีสตาร์ทด้านบน', { v: s.version || '' }); break;
      case 'none': statusText.textContent = Tk.t('✓ เป็นเวอร์ชันล่าสุดแล้ว ({v})', { v: cur }); break;
      case 'error': statusText.textContent = Tk.t('เช็คอัปเดตไม่สำเร็จ: {msg}', { msg: s.message || '' }); break;
    }
  }

  // ---------- ตัวเลื่อน (Interaction Slider) ----------
  // gift picker แบบ modal (ใช้ giftCatalog cache) — คืนของขวัญที่เลือก {name, image}
  function openGiftPickerApp(currentName, onPick) {
    var overlay = el('div', { class: 'gift-pick-overlay' });
    var box = el('div', { class: 'gift-pick-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': Tk.t('เลือกของขวัญ') });
    var prevFocus = document.activeElement; // คืนโฟกัสให้ปุ่มที่กดเปิดตอนปิด
    function close() {
      window.removeEventListener('keydown', onKey, true);
      overlay.remove();
      try { if (prevFocus && prevFocus.focus) prevFocus.focus(); } catch (_) {}
    }
    // Esc = ปิด · Tab = ขังโฟกัสไว้ในกล่อง ไม่ให้หลุดไปโดนของที่อยู่ข้างหลัง
    function onKey(e) {
      if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
      if (e.key !== 'Tab') return;
      var f = Array.prototype.slice.call(box.querySelectorAll(
        'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
      )).filter(function (n) { return n.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    window.addEventListener('keydown', onKey, true);
    overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) close(); });
    var search = el('input', { type: 'text', placeholder: Tk.t('ค้นหาของขวัญ... เช่น rose'), autocomplete: 'off' });
    var grid = el('div', { class: 'gift-grid' });
    var count = el('span', { class: 'gift-pick-count' });
    function pick(g) { close(); onPick(g); }
    var RENDER_CAP = 300;
    function renderGrid() {
      var q = search.value.trim().toLowerCase();
      var all = Object.keys(giftCatalog || {}).map(function (k) { return giftCatalog[k]; })
        .filter(function (g) { return !q || g.name.toLowerCase().indexOf(q) >= 0; })
        .sort(function (a, b) { return (b.id || 0) - (a.id || 0); }); // ใหม่สุดก่อน
      var gifts = all.slice(0, RENDER_CAP);
      var hidden = all.length - gifts.length;
      grid.innerHTML = '';
      count.textContent = hidden > 0 ? Tk.t('แสดง {a} จาก {b} ชิ้น — พิมพ์เพื่อค้นหา', { a: gifts.length, b: all.length }) : Tk.t('{n} ชิ้น', { n: all.length });
      var frag = document.createDocumentFragment();
      if (!q) {
        var none = el('button', { type: 'button', class: 'gift-cell' + (!currentName ? ' active' : '') }, [
          el('div', { class: 'gift-cell-img' }, [el('span', { class: 'gift-ico' }, [window.Icon.el('gift', 24)])]),
          el('div', { class: 'gift-cell-name', text: Tk.t('ไม่มีรูป') }), el('div', { class: 'gift-cell-coins', text: Tk.t('ข้อความอย่างเดียว') })]);
        none.addEventListener('click', function () { pick({ name: '', image: '' }); });
        frag.appendChild(none);
      }
      gifts.forEach(function (g) {
        var cell = el('button', { type: 'button', class: 'gift-cell' + (g.name === currentName ? ' active' : '') }, [
          g.image ? el('img', { class: 'gift-cell-img', src: g.image, alt: '', loading: 'lazy' })
                  : el('div', { class: 'gift-cell-img' }, [el('span', { class: 'gift-ico' }, [window.Icon.el('gift', 24)])]),
          el('div', { class: 'gift-cell-name', text: g.name }), el('div', { class: 'gift-cell-coins', text: g.coins + ' 💎' })]);
        cell.addEventListener('click', function () { pick(g); });
        frag.appendChild(cell);
      });
      if (hidden > 0) frag.appendChild(el('div', { class: 'gift-grid-more', text: Tk.t('ยังมีอีก {n} ชิ้น — พิมพ์ชื่อของขวัญเพื่อค้นหา', { n: hidden }) }));
      grid.appendChild(frag);
    }
    var searchTimer = null;
    search.addEventListener('input', function () { if (searchTimer) clearTimeout(searchTimer); searchTimer = setTimeout(renderGrid, 120); });
    [
      el('div', { class: 'gift-pick-head' }, [el('h2', { text: Tk.t('เลือกของขวัญ') }), count, el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: Tk.t('✕ ปิด'), onclick: close })]),
      search, grid
    ].forEach(function (n) { box.appendChild(n); });
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    search.focus();
    loadGiftCatalog().then(renderGrid);
  }

  function bindCarouselTab() {
    var c = (S.settings && S.settings.carousel) || {};
    $$('[data-carousel]').forEach(function (inp) {
      var key = inp.dataset.carousel;
      inp.value = c[key] != null ? c[key] : '';
      inp.addEventListener('change', function () {
        S.settings.carousel = Object.assign({}, S.settings.carousel);
        S.settings.carousel[key] = Number(inp.value) || 0;
        persistCarousel();
      });
    });
    renderCarouselItems();
    $('#addCarouselItemBtn').addEventListener('click', function () {
      S.settings.carousel = S.settings.carousel || {}; S.settings.carousel.items = S.settings.carousel.items || [];
      S.settings.carousel.items.push({ image: '', text: '', color: '#ffffff' });
      persistCarousel(); // บันทึกทันที ไม่งั้นปิดแอปก่อน blur ช่องแรก ช่องที่เพิ่งเพิ่มหายทั้งใบ
      renderCarouselItems();
    });
  }
  function persistCarousel() { saveSettings({ carousel: S.settings.carousel }, true); }
  function renderCarouselItems() {
    var host = $('#carouselItems');
    if (!host) return;
    var items = (S.settings.carousel && S.settings.carousel.items) || [];
    host.innerHTML = '';
    if (!items.length) host.appendChild(el('div', { class: 'resp-empty', text: Tk.t('ยังไม่มีช่อง — กดเพิ่มด้านล่าง') }));
    items.forEach(function (it, idx) {
      var giftBtn = el('button', { class: 'carousel-gift', type: 'button', title: Tk.t('เลือกรูปของขวัญ') });
      function refreshGift() { giftBtn.innerHTML = ''; if (it.image) giftBtn.appendChild(el('img', { src: it.image, alt: '' })); else giftBtn.appendChild(el('span', { class: 'gift-ico' }, [window.Icon.el('gift', 18)])); }
      refreshGift();
      giftBtn.addEventListener('click', function () {
        openGiftPickerApp(it.giftName || '', function (g) { it.image = g.image || ''; it.giftName = g.name || ''; refreshGift(); persistCarousel(); });
      });
      var textInp = el('input', { type: 'text', class: 'seg-label', value: it.text || '', placeholder: Tk.t('ข้อความ เช่น +2000 (ASTA)') });
      // 'input' + debounce แทน 'change' — บันทึกระหว่างพิมพ์ ไม่ต้องรอ blur (ปิดแอปทันทีก็ไม่หาย)
      textInp.addEventListener('input', debounce(function () { it.text = textInp.value; persistCarousel(); }, 400));
      var colorInp = el('input', { type: 'color', class: 'seg-color', value: it.color || '#ffffff', title: Tk.t('สีข้อความ') });
      colorInp.addEventListener('change', function () { it.color = colorInp.value; persistCarousel(); });
      host.appendChild(el('div', { class: 'seg-row' }, [giftBtn, textInp, colorInp,
        el('button', { class: 'btn btn-danger btn-sm icon-btn', title: Tk.t('ลบช่องนี้'), onclick: function () { items.splice(idx, 1); persistCarousel(); renderCarouselItems(); } }, [window.Icon.el('trash', 13)])]));
    });
  }

  // ---------- กงล้อเสี่ยงโชค ----------
  // ---------- ตัวนับชัยชนะ (Win Counter) ----------
  // คีย์ลัดที่ตั้งได้ + ค่าที่บวก/ลบ (custom ปรับค่าได้เอง)
  var WC_KEYS = [
    { k: 'win', label: 'ชนะ (+1)', fixed: 1 },
    { k: 'undo', label: 'ย้อนกลับ (−1)', fixed: -1 },
    { k: 'reset', label: 'รีเซ็ตเป็น 0', fixed: 0 }
  ];

  function wcConf() { return (S.settings && S.settings.winCounter) || {}; }

  // dragging = ค่ามาจากการลากแถบสี/สไลเดอร์ ซึ่งยิง event รัวเป็นร้อยครั้งต่อการลากหนึ่งที
  // ฝั่ง main เขียน settings.json ทั้งไฟล์แบบซิงโครนัสทุกครั้ง — ต้องรวบเขียนทีเดียวตอนหยุดลาก
  function persistWc() { saveSettings({ winCounter: S.settings.winCounter }, true); }
  var persistWcSoon = debounce(persistWc, 300);
  function saveWc(patch, dragging) {
    S.settings.winCounter = Object.assign({}, S.settings.winCounter, patch);
    if (dragging) persistWcSoon();
    else { persistWcSoon.cancel(); persistWc(); }
  }

  // แปลง accelerator ของ Electron → คำอ่านง่ายแบบ Windows
  function wcKeyLabel(acc) {
    if (!acc) return Tk.t('ยังไม่ได้ตั้ง');
    var NUM = { nummult: 'Numpad *', numdiv: 'Numpad /', numadd: 'Numpad +', numsub: 'Numpad −', numdec: 'Numpad .' };
    return String(acc).split('+').map(function (p) {
      if (NUM[p]) return NUM[p];
      if (/^num\d$/.test(p)) return 'Numpad ' + p.slice(3);
      if (p === 'Super' || p === 'Command') return 'Win';
      if (p === 'Control') return 'Ctrl';
      return p;
    }).join(' + ');
  }

  // จับปุ่มที่ผู้ใช้กด → accelerator (รองรับ Numpad ซึ่งใช้บ่อยกับตัวนับ)
  function wcEventToAccel(e) {
    var mods = [];
    if (e.ctrlKey) mods.push('Control');
    if (e.altKey) mods.push('Alt');
    if (e.shiftKey) mods.push('Shift');
    if (e.metaKey) mods.push(/Mac/i.test(navigator.platform || '') ? 'Command' : 'Super');
    var code = e.code || '', key = null, m;
    if ((m = /^Numpad(\d)$/.exec(code))) key = 'num' + m[1];
    else if (code === 'NumpadMultiply') key = 'nummult';
    else if (code === 'NumpadDivide') key = 'numdiv';
    else if (code === 'NumpadAdd') key = 'numadd';
    else if (code === 'NumpadSubtract') key = 'numsub';
    else if (code === 'NumpadDecimal') key = 'numdec';
    else if ((m = /^Key([A-Z])$/.exec(code))) key = m[1];
    else if ((m = /^Digit(\d)$/.exec(code))) key = m[1];
    else if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) key = code;
    else {
      var MAP = { ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
        Space: 'Space', Enter: 'Enter', Tab: 'Tab', Backspace: 'Backspace', Delete: 'Delete',
        Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown', Insert: 'Insert' };
      key = MAP[code] || null;
    }
    if (!key) return null;
    return mods.concat([key]).join('+');
  }

  // ช่องกดบันทึกคีย์
  function wcKeyField(getAcc, setAcc) {
    var btn = el('button', { type: 'button', class: 'btn keycap wc-key', text: wcKeyLabel(getAcc()) });
    var capturing = false;
    function stop() {
      capturing = false;
      btn.classList.remove('capturing');
      btn.textContent = wcKeyLabel(getAcc());
      window.removeEventListener('keydown', onKey, true);
      // ต้องถอดตัวจับ "คลิกที่อื่น/สลับหน้าต่าง" ด้วย ไม่งั้นค้างจับปุ่มต่อไปทั้งที่เลิกแล้ว
      document.removeEventListener('mousedown', onOutside, true);
      window.removeEventListener('blur', stop);
    }
    function onKey(e) {
      if (!capturing) return;
      e.preventDefault(); e.stopPropagation();
      if (e.key === 'Escape') return stop();
      if (['Shift', 'Control', 'Alt', 'Meta'].indexOf(e.key) >= 0) return;
      var acc = wcEventToAccel(e);
      if (!acc) return;
      setAcc(acc);
      stop();
    }
    // คลิกที่อื่นโดยไม่กดปุ่ม = เลิกจับ ไม่งั้นตัวจับ keydown capture ค้างอยู่แล้วกลืนปุ่มถัดไป
    // (เคสนี้เจ็บกับตัวนับชัยชนะเป็นพิเศษ เพราะผู้ใช้มักคลิกสลับช่องไปมา) เหมือน keyCaptureField/acceleratorField
    function onOutside(e) {
      if (e.target !== btn) stop();
    }
    btn.addEventListener('click', function () {
      if (capturing) return;
      capturing = true;
      btn.classList.add('capturing');
      btn.textContent = Tk.t('กดปุ่มที่ต้องการ... (Esc = ยกเลิก)');
      window.addEventListener('keydown', onKey, true);
      document.addEventListener('mousedown', onOutside, true);
      window.addEventListener('blur', stop);
    });
    return btn;
  }

  function renderWcKeys() {
    var host = $('#wcKeys');
    if (!host) return;
    host.innerHTML = '';
    var c = wcConf();
    var keys = Object.assign({ custom: [] }, c.keys);

    WC_KEYS.forEach(function (def) {
      host.appendChild(el('div', { class: 'wc-key-row' }, [
        el('span', { class: 'wc-key-name', text: Tk.t(def.label) }),
        wcKeyField(
          function () { return (wcConf().keys || {})[def.k]; },
          function (acc) {
            var k = Object.assign({ custom: [] }, wcConf().keys); k[def.k] = acc;
            saveWc({ keys: k });
          }
        )
      ]));
    });

    (keys.custom || []).forEach(function (item, i) {
      var row = el('div', { class: 'wc-key-row' }, [
        el('span', { class: 'wc-key-name', text: Tk.t('กำหนดเอง {n}', { n: i + 1 }) }),
        wcKeyField(
          function () { return ((wcConf().keys || {}).custom || [])[i] ? ((wcConf().keys || {}).custom || [])[i].acc : ''; },
          function (acc) {
            var k = Object.assign({}, wcConf().keys);
            k.custom = (k.custom || []).slice();
            k.custom[i] = Object.assign({}, k.custom[i], { acc: acc });
            saveWc({ keys: k });
          }
        )
      ]);
      var delta = el('input', { type: 'number', class: 'wc-delta', value: item.delta != null ? item.delta : 0, title: Tk.t('ค่าที่บวก/ลบเมื่อกดปุ่มนี้') });
      delta.addEventListener('change', function () {
        var k = Object.assign({}, wcConf().keys);
        k.custom = (k.custom || []).slice();
        k.custom[i] = Object.assign({}, k.custom[i], { delta: Number(delta.value) || 0 });
        saveWc({ keys: k });
      });
      row.appendChild(delta);
      host.appendChild(row);
    });
  }

  function applyWinCounter(c) {
    // event อาจมาถึงก่อน state:get เสร็จ (S.settings ยังเป็น null) — กัน TypeError กลางการเปิดแอป
    if (!c || !S.settings) return;
    var wasOn = !!(S.settings.winCounter && S.settings.winCounter.enabled);
    // ระหว่างลากสไลเดอร์/แถบสี ค่าท้องถิ่นยังเดินทางไม่ถึง main (debounce 300ms ค้างอยู่)
    // ถ้าเอาคอนฟิกทั้งก้อนจาก main มาทับตอนนั้น ค่าที่เพิ่งลากจะถูกของเก่าทับ
    // แล้ว persistWcSoon ที่ค้างอยู่ก็จะเขียนของเก่านั้นลงดิสก์ซ้ำอีกที
    // → ช่วงที่มีงานค้าง รับจาก main เฉพาะ count ซึ่ง renderer ไม่ใช่เจ้าของค่า
    if (persistWcSoon.pending()) {
      if (c.count != null) S.settings.winCounter = Object.assign({}, S.settings.winCounter, { count: c.count });
    } else {
      S.settings.winCounter = Object.assign({}, S.settings.winCounter, c);
    }
    var cur = $('#wcCurrent');
    if (cur) cur.textContent = Number(c.count) || 0;
    var onAir = $('#onAirWin');
    if (onAir) onAir.textContent = Number(c.count) || 0;
    // เปิด/ปิดฟีเจอร์ → แผงคุมต้องเพิ่ม/ตัดส่วนนั้นทันที
    if (wasOn !== !!c.enabled || !onAir) renderOnAir();
  }

  function bindWinCounterTab() {
    var c = wcConf();

    $$('[data-wc]').forEach(function (inp) {
      var key = inp.dataset.wc;
      if (inp.type === 'checkbox') {
        inp.checked = !!c[key];
        inp.addEventListener('change', function () { saveWc(pair(key, inp.checked)); });
      } else {
        inp.value = c[key] != null ? c[key] : '';
        var ev = (inp.type === 'range' || inp.type === 'color') ? 'input' : 'change';
        inp.addEventListener(ev, function () {
          var v = inp.type === 'number' || inp.type === 'range' ? (Number(inp.value) || 0) : inp.value;
          var lbl = $('[data-wc-val="' + key + '"]');
          if (lbl) lbl.textContent = v;   // ป้ายตัวเลขต้องขยับตามมือทันที ส่วนการเขียนลงดิสก์รอหยุดลากก่อน
          saveWc(pair(key, v), ev === 'input');
        });
      }
      var lbl0 = $('[data-wc-val="' + key + '"]');
      if (lbl0 && c[key] != null) lbl0.textContent = c[key];
    });
    function pair(k, v) { var o = {}; o[k] = v; return o; }

    // ปุ่มเลือกแนวการวาง
    function syncLayout() {
      $$('[data-wc-layout]').forEach(function (b) {
        b.classList.toggle('active', b.dataset.wcLayout === (wcConf().layout || 'horizontal'));
      });
    }
    $$('[data-wc-layout]').forEach(function (b) {
      b.addEventListener('click', function () { saveWc({ layout: b.dataset.wcLayout }); syncLayout(); });
    });
    syncLayout();

    // แผงควบคุมสด
    function ctrl(cmd, payload) {
      invoke('winCounter:control', { cmd: cmd, payload: payload || {} }, { toast: false })
        .then(function (st) { applyWinCounter(st); });
    }
    $('#wcWinBtn').addEventListener('click', function () { ctrl('win'); });
    $('#wcUndoBtn').addEventListener('click', function () { ctrl('undo'); });
    $('#wcResetBtn').addEventListener('click', function () { ctrl('reset'); });

    renderWcKeys();
    applyWinCounter(c);
  }

  function bindWheelTab() {
    var w = (S.settings && S.settings.wheel) || {};

    // ฟิลด์ทั่วไป — bind ผ่าน [data-wheel]
    $$('[data-wheel]').forEach(function (inp) {
      var key = inp.dataset.wheel;
      if (inp.type === 'checkbox') {
        inp.checked = w[key] !== false;
        inp.addEventListener('change', function () { saveWheel(key, inp.checked); });
      } else {
        inp.value = w[key] != null ? w[key] : '';
        inp.addEventListener('change', function () {
          saveWheel(key, inp.type === 'number' ? (Number(inp.value) || 0) : inp.value);
        });
      }
    });

    function saveWheel(key, val) {
      var patch = {}; patch[key] = val;
      S.settings.wheel = Object.assign({}, S.settings.wheel, patch);
      saveSettings({ wheel: S.settings.wheel }, true);
    }

    renderWheelSegments();
    $('#addSegmentBtn').addEventListener('click', function () {
      S.settings.wheel.segments = S.settings.wheel.segments || [];
      S.settings.wheel.segments.push({ label: '', weight: 1 });
      persistWheelSegments(); // บันทึกทันที ไม่งั้นปิดแอปก่อน blur ช่องแรก ช่องที่เพิ่งเพิ่มหายทั้งใบ
      renderWheelSegments();
      // โฟกัสช่องใหม่ทันที
      var inputs = $$('#wheelSegments .seg-label');
      if (inputs.length) inputs[inputs.length - 1].focus();
    });
    $('#wheelSpinBtn').addEventListener('click', function () {
      invoke('wheel:spin').then(function (r) {
        if (r && r.busy) { toast(Tk.t('กำลังสุ่มอยู่ รอให้จบก่อน'), ''); return; }
        if (r && r.ok) toast(Tk.t('สุ่มแล้ว! ดูผลบน widget Roulette'), 'ok');
      });
    });
  }

  function persistWheelSegments() {
    saveSettings({ wheel: S.settings.wheel }, true);
  }

  function renderWheelSegments() {
    var host = $('#wheelSegments');
    var segs = (S.settings.wheel && S.settings.wheel.segments) || [];
    host.innerHTML = '';
    if (!segs.length) {
      host.appendChild(el('div', { class: 'resp-empty', text: Tk.t('ยังไม่มีช่องรางวัล — กดเพิ่มด้านล่าง (ต้องมีอย่างน้อย 2 ช่อง)') }));
    }
    segs.forEach(function (seg, idx) {
      var labelInp = el('input', { type: 'text', class: 'seg-label', value: seg.label || '', placeholder: Tk.t('ชื่อรางวัล เช่น ร้องเพลง 1 เพลง') });
      // 'input' + debounce แทน 'change' — บันทึกระหว่างพิมพ์ ไม่ต้องรอ blur (ปิดแอปทันทีก็ไม่หาย)
      labelInp.addEventListener('input', debounce(function () { seg.label = labelInp.value; persistWheelSegments(); }, 400));
      var weightInp = el('input', { type: 'number', class: 'seg-weight', min: '1', value: seg.weight || 1, title: Tk.t('น้ำหนักโอกาสออก') });
      weightInp.addEventListener('change', function () { seg.weight = Number(weightInp.value) || 1; persistWheelSegments(); });
      // สีของช่อง — default ตาม palette; ผู้ใช้เปลี่ยนเองได้
      var colorInp = el('input', { type: 'color', class: 'seg-color', value: seg.color || WHEEL_COLORS[idx % WHEEL_COLORS.length], title: Tk.t('สีของช่องนี้บน widget') });
      colorInp.addEventListener('change', function () { seg.color = colorInp.value; persistWheelSegments(); });
      // รูปของช่อง — อัพโหลดเข้าคลังแอป (/media) แล้วโชว์บนการ์ดแทนตัวอักษร
      var imgBtn;
      function imgBtnContent() {
        imgBtn.innerHTML = '';
        if (seg.image) {
          imgBtn.appendChild(el('img', { class: 'seg-thumb', src: (window.__TK_DEMO_BASE || ('http://localhost:' + S.serverPort)) + seg.image, alt: '' }));
          imgBtn.title = Tk.t('คลิกเพื่อเปลี่ยนรูป · คลิกขวาเพื่อลบรูป');
        } else {
          imgBtn.appendChild(window.Icon.el('upload', 13));
          imgBtn.title = Tk.t('อัพโหลดรูปของช่องนี้ (โชว์บนการ์ดแทนตัวอักษร)');
        }
      }
      imgBtn = el('button', { class: 'btn btn-ghost btn-sm icon-btn seg-img-btn', onclick: async function () {
        var url = await invoke('media:import', {});
        if (url) { seg.image = url; imgBtnContent(); persistWheelSegments(); }
      } });
      imgBtn.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        if (seg.image) { delete seg.image; imgBtnContent(); persistWheelSegments(); }
      });
      imgBtnContent();
      host.appendChild(el('div', { class: 'seg-row' }, [
        colorInp,
        imgBtn,
        labelInp,
        weightInp,
        el('button', { class: 'btn btn-danger btn-sm icon-btn', title: Tk.t('ลบช่องนี้'), onclick: function () {
          segs.splice(idx, 1);
          persistWheelSegments();
          renderWheelSegments();
        } }, [window.Icon.el('trash', 13)])
      ]));
    });
  }
  var WHEEL_COLORS = ['#fe2c55', '#25c1c9', '#f0c060', '#7b5bd6', '#3ecf8e', '#e0904a', '#5b93cc', '#e0685f'];

  // ---------- Random Wheel (วงล้อกลม) ----------
  // แยกขาดจาก Roulette: settings.randomWheel คนละชุด และรายการรางวัลมีแค่ "ชื่อ + น้ำหนัก"
  // ไม่มีสี/รูปรายช่อง เพราะวงล้อกลมไล่สีเองตาม palette ที่ตั้งใน URL ของ widget
  function bindRandomWheelTab() {
    var w = (S.settings && S.settings.randomWheel) || {};

    $$('[data-rwheel]').forEach(function (inp) {
      var key = inp.dataset.rwheel;
      if (inp.type === 'checkbox') {
        inp.checked = w[key] !== false;
        inp.addEventListener('change', function () { saveRw(key, inp.checked); });
      } else {
        inp.value = w[key] != null ? w[key] : '';
        inp.addEventListener('change', function () {
          saveRw(key, inp.type === 'number' ? (Number(inp.value) || 0) : inp.value);
        });
      }
    });

    function saveRw(key, val) {
      var patch = {}; patch[key] = val;
      S.settings.randomWheel = Object.assign({}, S.settings.randomWheel, patch);
      saveSettings({ randomWheel: S.settings.randomWheel }, true);
    }

    renderRwSegments();
    $('#addRwSegmentBtn').addEventListener('click', function () {
      S.settings.randomWheel = S.settings.randomWheel || {};
      S.settings.randomWheel.segments = S.settings.randomWheel.segments || [];
      S.settings.randomWheel.segments.push({ label: '', weight: 1 });
      persistRwSegments(); // บันทึกทันที ไม่งั้นปิดแอปก่อน blur ช่องแรก ช่องที่เพิ่งเพิ่มหายทั้งใบ
      renderRwSegments();
      var inputs = $$('#rwSegments .seg-label');
      if (inputs.length) inputs[inputs.length - 1].focus();
    });
    $('#rwSpinBtn').addEventListener('click', function () {
      invoke('randomWheel:spin').then(function (r) {
        if (r && r.busy) { toast(Tk.t('กำลังหมุนอยู่ รอให้จบก่อน'), ''); return; }
        if (r && r.ok) toast(Tk.t('หมุนแล้ว! ดูผลบน widget Random Wheel'), 'ok');
      });
    });
  }

  function persistRwSegments() {
    saveSettings({ randomWheel: S.settings.randomWheel }, true);
  }

  function renderRwSegments() {
    var host = $('#rwSegments');
    var segs = (S.settings.randomWheel && S.settings.randomWheel.segments) || [];
    host.innerHTML = '';
    if (!segs.length) {
      host.appendChild(el('div', { class: 'resp-empty', text: Tk.t('ยังไม่มีช่องรางวัล — กดเพิ่มด้านล่าง (ต้องมีอย่างน้อย 2 ช่อง)') }));
    }
    segs.forEach(function (seg, idx) {
      var labelInp = el('input', { type: 'text', class: 'seg-label', value: seg.label || '', placeholder: Tk.t('ชื่อรางวัล เช่น รางวัลใหญ่!') });
      // 'input' + debounce แทน 'change' — บันทึกระหว่างพิมพ์ ไม่ต้องรอ blur (ปิดแอปทันทีก็ไม่หาย)
      labelInp.addEventListener('input', debounce(function () { seg.label = labelInp.value; persistRwSegments(); }, 400));
      var weightInp = el('input', { type: 'number', class: 'seg-weight', min: '1', value: seg.weight || 1, title: Tk.t('น้ำหนักโอกาสออก') });
      weightInp.addEventListener('change', function () { seg.weight = Number(weightInp.value) || 1; persistRwSegments(); });
      host.appendChild(el('div', { class: 'seg-row' }, [
        labelInp,
        weightInp,
        el('button', { class: 'btn btn-danger btn-sm icon-btn', title: Tk.t('ลบช่องนี้'), onclick: function () {
          segs.splice(idx, 1);
          persistRwSegments();
          renderRwSegments();
        } }, [window.Icon.el('trash', 13)])
      ]));
    });
  }

  // ---------- ประวัติไลฟ์ (Session Report) ----------
  function fmtDur(sec) {
    sec = Number(sec) || 0;
    var h = Math.floor(sec / 3600), mn = Math.floor((sec % 3600) / 60);
    return h > 0 ? Tk.t('{h} ชม. {m} นาที', { h: h, m: mn }) : Tk.t('{m} นาที', { m: mn });
  }

  async function renderSessions() {
    var host = $('#sessionsList');
    host.innerHTML = '';
    host.appendChild(el('div', { class: 'muted small', text: Tk.t('กำลังโหลดประวัติ…') }));
    var list = null;
    try { list = await invoke('sessions:list', {}, { toast: false }) || []; } catch (e) {}
    host.innerHTML = '';
    // แยก "โหลดพลาด" ออกจาก "ยังไม่มีประวัติ" — เดิมพลาดแล้วโชว์ empty state ทำให้ผู้ใช้นึกว่าข้อมูลหายจริง
    if (list === null) {
      var errBox = el('div', { class: 'empty-state', html:
        Tk.t('โหลดประวัติไม่สำเร็จ') + '<br><span class="empty-steps">' + Tk.t('ไฟล์ประวัติอาจอ่านไม่ได้ชั่วคราว — ข้อมูลไม่ได้หาย ลองใหม่อีกครั้ง') + '</span>' });
      var retry = el('button', { class: 'btn btn-sm', style: 'margin-top:10px', text: Tk.t('ลองใหม่') });
      retry.addEventListener('click', function () { renderSessions(); });
      errBox.appendChild(retry);
      host.appendChild(errBox);
      return;
    }
    if (!list.length) {
      host.appendChild(el('div', { class: 'empty-state', html:
        Tk.t('ยังไม่มีประวัติ') + '<br><span class="empty-steps">' + Tk.t('เชื่อมต่อไลฟ์แล้วระบบจะบันทึกสถิติให้อัตโนมัติเมื่อจบไลฟ์') + '</span>' }));
      return;
    }
    list.forEach(function (s) {
      var d = new Date(s.startedAt);
      var dateStr = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) + ' ' +
        d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
      var statsRow = el('div', { class: 'sess-stats' }, [
        el('span', { text: '💎 ' + (s.totalDiamonds || 0).toLocaleString() }),
        el('span', { text: '❤️ ' + (s.sessionLikes || 0).toLocaleString() }),
        el('span', { text: '➕ ' + Tk.t('{n} ติดตาม', { n: s.follows || 0 }) }),
        el('span', { text: '💬 ' + (s.totalChats || 0).toLocaleString() }),
        el('span', { text: '👀 ' + Tk.t('สูงสุด {n}', { n: (s.peakViewers || 0).toLocaleString() }) })
      ]);
      var detail = el('div', { class: 'sess-detail', hidden: 'hidden' });
      // role/tabindex/aria + keydown เพื่อให้คีย์บอร์ด/screen reader กางดูท็อปผู้ให้ของได้ ไม่ต้องพึ่งเมาส์
      var card = el('div', { class: 'action-card sess-card', role: 'button', tabindex: '0', 'aria-expanded': 'false' }, [
        el('div', { class: 'action-main' }, [
          el('div', { class: 'action-name', text: dateStr + ' · @' + (s.username || '') + ' · ' + fmtDur(s.durationSec) }),
          statsRow,
          detail
        ]),
        el('div', { class: 'action-btns' }, [
          el('button', { class: 'btn btn-danger btn-sm icon-btn', title: Tk.t('ลบประวัตินี้'), onclick: async function (e) {
            e.stopPropagation();
            if (await Tk.confirmDialog(Tk.t('ลบประวัติไลฟ์วันที่ {date} ?', { date: dateStr }), Tk.t('ลบ'))) {
              await invoke('sessions:delete', { id: s.id });
              renderSessions();
            }
          } }, [window.Icon.el('trash', 13)])
        ])
      ]);
      // คลิก/กด Enter-Space ที่แถว → กางท็อปผู้ให้ของไลฟ์นั้น
      function toggleDetail() {
        if (!detail.hidden) { detail.hidden = true; card.setAttribute('aria-expanded', 'false'); return; }
        detail.innerHTML = '';
        var top = s.topGifters || [];
        if (!top.length) {
          detail.appendChild(el('div', { class: 'muted small', text: Tk.t('ไลฟ์นี้ไม่มีของขวัญ') }));
        } else {
          top.slice(0, 10).forEach(function (g, i) {
            detail.appendChild(el('div', { class: 'sess-gifter' }, [
              el('span', { class: 'rank', text: (i + 1) + '.' }),
              el('span', { class: 'nm', text: g.nickname + ' (@' + g.uniqueId + ')' }),
              el('span', { class: 'dm', text: '💎 ' + (g.diamonds || 0).toLocaleString() + ' · ' + Tk.t('{n} ชิ้น', { n: g.gifts || 0 }) })
            ]));
          });
        }
        detail.hidden = false;
        card.setAttribute('aria-expanded', 'true');
      }
      card.addEventListener('click', toggleDetail);
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleDetail(); }
      });
      host.appendChild(card);
    });
  }

  // ---------- เสียงเตือนหลุดไลฟ์ (ไซเรนสั้นๆ 3 รอบ ดังพอได้ยินขณะเล่นเกม) ----------
  var alarmCtx = null;
  function playDisconnectAlarm() {
    try {
      alarmCtx = alarmCtx || new (window.AudioContext || window.webkitAudioContext)();
      var c = alarmCtx;
      for (var i = 0; i < 3; i++) {
        var t0 = c.currentTime + i * 0.55;
        var o = c.createOscillator();
        var g = c.createGain();
        o.type = 'square';
        o.frequency.setValueAtTime(880, t0);
        o.frequency.exponentialRampToValueAtTime(440, t0 + 0.4);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.5, t0 + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45);
        o.connect(g); g.connect(c.destination);
        o.start(t0); o.stop(t0 + 0.5);
      }
    } catch (e) { /* ไม่มีเสียงก็ยังมี toast + notification */ }
  }

  // ---------- Settings save helper ----------
  function saveSettings(patch, silent) {
    // อัปเดต local ทันที (optimistic) แล้วส่งไป main
    S.settings = deepMerge(S.settings || {}, patch);
    invoke('settings:set', { patch: patch }, { toast: false })
      .then(function () { if (!silent) toast(Tk.t('บันทึกแล้ว'), 'ok'); else quietSaved(); })
      .catch(function (e) { toast(Tk.t('บันทึกไม่สำเร็จ: {err}', { err: e.message }), 'err'); });
  }
  var savedTimer = null;
  function quietSaved() {
    clearTimeout(savedTimer);
    var s = $('#statusLog');
    s.textContent = Tk.t('✓ บันทึกแล้ว');
    s.className = 'status-log';
    savedTimer = setTimeout(function () { s.textContent = Tk.t('พร้อมใช้งาน'); }, 1500);
  }

  // ---------- utils ----------
  // งาน debounce ที่ยังไม่ถึงเวลายิง — เก็บรวมไว้เพื่อ "ยิงทิ้งท้าย" ตอนปิดหน้าต่าง
  // ไม่งั้นพิมพ์ค่าเสร็จแล้วปิดโปรแกรมภายในครึ่งวินาที ค่าล่าสุดหายเงียบโดยไม่มีคำเตือน
  var pendingSaves = [];
  function debounce(fn, ms) {
    var t = null, args = null, ctx = null;
    function run() {
      var a = args, c = ctx;
      t = null; args = null; ctx = null;
      var i = pendingSaves.indexOf(flush);
      if (i >= 0) pendingSaves.splice(i, 1);
      fn.apply(c, a);
    }
    function flush() { if (t) { clearTimeout(t); run(); } }        // ยิงงานที่ค้างทันที
    function cancel() {                                            // ทิ้งงานที่ค้าง (มีคนสั่งบันทึกทับไปแล้ว)
      if (!t) return;
      clearTimeout(t); t = null; args = null; ctx = null;
      var i = pendingSaves.indexOf(flush);
      if (i >= 0) pendingSaves.splice(i, 1);
    }
    var wrapped = function () {
      args = arguments; ctx = this;
      if (!t) pendingSaves.push(flush); else clearTimeout(t);
      t = setTimeout(run, ms);
    };
    wrapped.flush = flush; wrapped.cancel = cancel;
    wrapped.pending = function () { return t != null; };           // มีงานค้างที่ยังไม่ถึงเวลายิงไหม
    return wrapped;
  }
  function flushPendingSaves() {
    // slice ก่อน เพราะ flush() ถอดตัวเองออกจาก pendingSaves ระหว่างวน
    pendingSaves.slice().forEach(function (f) { try { f(); } catch (_) {} });
  }
  // ปิดหน้าต่าง/Cmd+Q ระหว่างที่ยังพิมพ์ค้างอยู่ → ต้องส่งค่าล่าสุดไป main ให้ทันก่อนตาย
  // blur ช่องที่โฟกัสอยู่ด้วย เพื่อบีบให้ช่องที่ผูกไว้กับ event 'change' (ชื่อรางวัลวงล้อ/ข้อความตัวเลื่อน)
  // ยิง handler ของตัวเองออกมาแบบซิงโครนัส — เดิมปิดโดยไม่ออกจากช่องคือค่าหาย
  function flushBeforeExit() {
    try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (_) {}
    flushPendingSaves();
  }
  window.addEventListener('beforeunload', flushBeforeExit);
  window.addEventListener('pagehide', flushBeforeExit);
  // ย่อหน้าต่าง/สลับไปโปรแกรมอื่น = จังหวะปลอดภัยที่จะเขียนลงดิสก์ (ไม่ blur เพราะผู้ใช้ยังพิมพ์ต่อ)
  document.addEventListener('visibilitychange', function () { if (document.hidden) flushPendingSaves(); });
  function deepMerge(base, patch) {
    if (Array.isArray(patch) || typeof patch !== 'object' || patch === null) return patch;
    var out = Array.isArray(base) ? [] : Object.assign({}, base || {});
    Object.keys(patch).forEach(function (k) { out[k] = deepMerge(base ? base[k] : undefined, patch[k]); });
    return out;
  }
  function getPath(obj, path) {
    return path.split('.').reduce(function (o, k) { return o ? o[k] : undefined; }, obj);
  }
  function setPath(obj, path, val) {
    var parts = path.split('.'), cur = obj;
    for (var i = 0; i < parts.length - 1; i++) { cur[parts[i]] = cur[parts[i]] || {}; cur = cur[parts[i]]; }
    cur[parts[parts.length - 1]] = val;
    return obj;
  }

  document.addEventListener('DOMContentLoaded', init);
})();
