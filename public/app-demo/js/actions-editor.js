// Tikkies Tools — ตัวแก้ไข Action (modal) — window.ActionsEditor.open(action, onSave)
window.ActionsEditor = (function () {
  var el, invoke, toast, modal;
  // อ้างถึงชิ้นส่วนของ "ขั้น 2" ที่ต้องอัปเดตทุกครั้งที่รายการการกระทำเปลี่ยน
  // (renderResponses ถูกใช้กับกิ่งด้วย จึงต้องเช็คว่าเป็นของระดับบนสุดจริงก่อนแตะ)
  var topHolder = null, countEl = null, topAddLabel = null;

  // color = สีประจำเหตุการณ์ ชุดเดียวกับที่หน้ารายการ Action ใช้อยู่แล้ว (app.js TRIG_META)
  // ใช้เป็นจุดกลมข้างช่องเลือก เพื่อให้สีในกล่องแก้ไขกับสีในรายการเป็นอันเดียวกัน
  var TRIGGER_TYPES = [
    { v: 'gift', t: 'ของขวัญ', icon: 'gift', desc: 'ได้รับของขวัญ', color: '#fe2c55' },
    { v: 'chat', t: 'แชท', icon: 'chat', desc: 'มีข้อความแชท', color: '#25c1c9' },
    { v: 'like', t: 'ไลค์', icon: 'heart', desc: 'ยอดไลค์ถึงเป้า', color: '#f0466a' },
    { v: 'follow', t: 'ติดตาม', icon: 'follow', desc: 'มีผู้ติดตามใหม่', color: '#3ecf8e' },
    { v: 'share', t: 'แชร์', icon: 'share', desc: 'มีคนแชร์ไลฟ์', color: '#5b93cc' },
    { v: 'subscribe', t: 'สมาชิก', icon: 'star', desc: 'มีสมาชิกใหม่', color: '#f0c060' },
    { v: 'member', t: 'เข้าห้อง', icon: 'member', desc: 'มีคนเข้าห้อง', color: '#7b5bd6' },
    { v: 'hotkey', t: 'คีย์ลัด', icon: 'keyboard', desc: 'กดคีย์จากคีย์บอร์ด', color: '#e0904a' },
    { v: 'wheelResult', t: 'Roulette ออกผล', icon: 'sparkles', desc: 'Roulette สุ่มได้รางวัล', color: '#c9a6ff' },
    { v: 'randomWheelResult', t: 'Random Wheel ออกผล', icon: 'sparkles', desc: 'วงล้อกลมหมุนได้รางวัล', color: '#7fd4ff' },
    { v: 'topChange', t: 'Top 1 เปลี่ยนคน', icon: 'crown', desc: 'มีคนแซงขึ้นอันดับ 1 ผู้ให้ของขวัญ', color: '#e8b04a' },
    { v: 'goalReached', t: 'ถึงเป้าหมาย', icon: 'goals', desc: 'ยอดไลก์/เพชร/ผู้ติดตามถึงเป้าที่ตั้งไว้', color: '#4ab4fa' }
  ];
  // จัดกลุ่มในดรอปดาวน์ — 10 ตัวเรียงรวดเดียวอ่านยาก และทำให้สองตัวที่ชื่อคล้ายกัน
  // (Roulette ออกผล / Random Wheel ออกผล) มาอยู่ติดกันจนเทียบชื่อได้
  var TRIG_GROUPS = [
    { label: 'จากผู้ชม', items: ['gift', 'chat', 'like', 'follow', 'share', 'subscribe', 'member'] },
    { label: 'จากสถิติไลฟ์', items: ['topChange', 'goalReached'] },
    { label: 'จากในโปรแกรม', items: ['hotkey', 'wheelResult', 'randomWheelResult'] }
  ];
  function trigMeta(v) {
    for (var i = 0; i < TRIGGER_TYPES.length; i++) if (TRIGGER_TYPES[i].v === v) return TRIGGER_TYPES[i];
    return TRIGGER_TYPES[0];
  }
  var RESP_TYPES = [
    { v: 'alert', t: 'แจ้งเตือน', icon: 'bell', desc: 'ป๊อปอัปบน overlay' },
    { v: 'tts', t: 'อ่านออกเสียง', icon: 'tts', desc: 'TTS พูดข้อความ' },
    { v: 'sound', t: 'เล่นเสียง', icon: 'music', desc: 'เปิดไฟล์เสียง' },
    { v: 'video', t: 'เล่นวิดีโอ', icon: 'video', desc: 'เล่นคลิปสั้นกลางฉาก (ต้องเพิ่ม widget "วิดีโอ")' },
    { v: 'keypress', t: 'กดปุ่ม', icon: 'keyboard', desc: 'ส่งปุ่มเข้าเกม/แอป' },
    { v: 'obs', t: 'สั่ง OBS', icon: 'video', desc: 'เปลี่ยนซีน/ซ่อนแหล่ง' },
    { v: 'webhook', t: 'Webhook', icon: 'webhook', desc: 'ยิง HTTP request' },
    { v: 'wheel', t: 'สุ่มรางวัล (Roulette)', icon: 'sparkles', desc: 'แถบสุ่มแนวนอนบน widget' },
    { v: 'randomWheel', t: 'หมุน Random Wheel', icon: 'sparkles', desc: 'วงล้อกลม — รายการรางวัลคนละชุดกับ Roulette' },
    { v: 'timer', t: 'Subathon Timer', icon: 'timer', desc: 'เพิ่ม/ลดเวลา หรือสั่งจับเวลา' },
    { v: 'winCounter', t: 'ตัวนับชัยชนะ', icon: 'trophy', desc: 'บวก/ลบ หรือรีเซ็ตยอดชนะ' },
    { v: 'minecraft', t: 'สั่งคำสั่ง Minecraft', icon: 'server', desc: 'ส่งคำสั่งเข้าเซิร์ฟเวอร์ผ่าน ServerTap' },
    { v: 'delay', t: 'หน่วงเวลา', icon: 'clock', desc: 'รอแล้วค่อยทำสิ่งที่อยู่ใต้มัน' },
    { v: 'random', t: 'สุ่มทาง', icon: 'share', desc: 'สุ่มเลือกทำทางใดทางหนึ่ง' },
    { v: 'if', t: 'ถ้า…', icon: 'filter', desc: 'แยกทางตามเงื่อนไข เช่น เพชรถึง 100 หรือเป็นผู้ติดตาม' }
  ];
  var RESP_GROUPS = [
    { label: 'บนหน้าจอและเสียง', items: ['alert', 'tts', 'sound', 'video'] },
    { label: 'ส่งไปโปรแกรมอื่น', items: ['keypress', 'obs', 'webhook', 'minecraft'] },
    { label: 'มินิเกมและตัวนับ', items: ['wheel', 'randomWheel', 'timer', 'winCounter'] },
    { label: 'ตรรกะ', items: ['delay', 'random', 'if'] }
  ];
  // อิโมจิ 🎁 หน้าตาไม่เหมือนกันในแต่ละเครื่อง/ฟอนต์ และดูไม่เข้ากับไอคอนเส้นที่ใช้ทั้งแอป
  // ใช้ไอคอนของขวัญชุดเดียวกับที่หน้ารายการ Action ใช้ พร้อมสีประจำเหตุการณ์ "ของขวัญ"
  function giftIcon(size, cls) {
    var w = el('span', { class: 'gift-ico' + (cls ? ' ' + cls : '') }, [window.Icon.el('gift', size || 22)]);
    return w;
  }

  function respMeta(type) {
    return RESP_TYPES.filter(function (x) { return x.v === type; })[0] || { t: type, icon: 'info', desc: '' };
  }
  var KEYS = ['a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z',
    '0','1','2','3','4','5','6','7','8','9','space','enter','tab','escape','delete','up','down','left','right',
    'f1','f2','f3','f4','f5','f6','f7','f8','f9','f10','f11','f12'];
  var MODS = ['cmd', 'ctrl', 'alt', 'shift'];

  // ---- ตัวแปร template แบบชิปคลิกแทรก (แทน hint ยาวๆ ที่ผู้ใช้ต้องพิมพ์เอง) ----
  // each: v = ชื่อตัวแปร, t = ป้ายไทยที่ผู้ใช้เข้าใจ, for = จำกัดเฉพาะเหตุการณ์ (ไม่มี = ใช้ได้ทุกเหตุการณ์)
  var TEMPLATE_VARS = [
    // not = ไม่โชว์กับเหตุการณ์เหล่านี้ (เหตุการณ์ระบบ ไม่มีข้อมูลผู้ชม)
    { v: 'nickname', t: 'ชื่อผู้ชม', not: ['hotkey', 'wheelResult', 'randomWheelResult'] },
    { v: 'uniqueId', t: '@username', not: ['hotkey', 'wheelResult', 'randomWheelResult'] },
    { v: 'comment', t: 'ข้อความแชท', for: ['chat'] },
    { v: 'giftName', t: 'ชื่อของขวัญ', for: ['gift'] },
    { v: 'repeatCount', t: 'จำนวนคอมโบ', for: ['gift'] },
    { v: 'diamondCount', t: 'เพชร/ชิ้น', for: ['gift'] },
    { v: 'diamondTotal', t: 'เพชรรวม', for: ['gift'] },
    { v: 'likeCount', t: 'ไลค์หลักที่ถึง', for: ['like'] },
    { v: 'totalLikes', t: 'ไลค์รวมทั้งห้อง', for: ['like'] },
    { v: 'prize', t: 'รางวัลที่สุ่มได้', for: ['wheelResult', 'randomWheelResult'] }
  ];
  var curTriggerType = ''; // ชนิด trigger ปัจจุบันของ modal ที่เปิดอยู่ — ใช้กรองชิปตัวแปร

  // แถวชิปตัวแปร: คลิก = แทรกที่ตำแหน่ง cursor ของ input แล้วยิง event 'input' ให้ binding อัปเดตเอง
  function varChips(inputEl) {
    var vars = TEMPLATE_VARS.filter(function (x) {
      if (x.not && x.not.indexOf(curTriggerType) >= 0) return false;
      return !x.for || x.for.indexOf(curTriggerType) >= 0;
    });
    if (!vars.length) return el('div', {}); // เหตุการณ์นี้ไม่มีตัวแปรให้แทรก
    var row = el('div', { class: 'var-chips' },
      [el('span', { class: 'var-chips-label', text: window.Tk.t('แทรก:') })].concat(vars.map(function (x) {
        return el('button', { type: 'button', class: 'var-chip', title: '{' + x.v + '} — ' + window.Tk.t(x.t), onclick: function () {
          var token = '{' + x.v + '}';
          var start = inputEl.selectionStart != null ? inputEl.selectionStart : inputEl.value.length;
          var end = inputEl.selectionEnd != null ? inputEl.selectionEnd : start;
          inputEl.value = inputEl.value.slice(0, start) + token + inputEl.value.slice(end);
          var pos = start + token.length;
          inputEl.focus();
          try { inputEl.setSelectionRange(pos, pos); } catch (_) {}
          inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        } }, [el('span', { class: 'var-chip-t', text: window.Tk.t(x.t) })]);
      })));
    return row;
  }

  // field ข้อความ + ชิปตัวแปรใต้ช่อง
  function templateField(label, inputEl) {
    return el('div', { class: 'field' }, [
      el('label', { text: label }),
      inputEl,
      varChips(inputEl)
    ]);
  }

  // ---- แปลง KeyboardEvent → whitelist ของ keypress.js ----
  var KEYCODE_MAP = { Space: 'space', Enter: 'enter', NumpadEnter: 'enter', Tab: 'tab', Backspace: 'delete', Delete: 'delete', ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
  function browserKeyToWhitelist(e) {
    var code = e.code || '';
    var m;
    if ((m = /^Key([A-Z])$/.exec(code))) return m[1].toLowerCase();
    if ((m = /^Digit([0-9])$/.exec(code))) return m[1];
    if ((m = /^Numpad([0-9])$/.exec(code))) return m[1];
    if (/^F([1-9]|1[0-2])$/.test(code)) return code.toLowerCase();
    return KEYCODE_MAP[code] || null;
  }
  function modsFromEvent(e) {
    var m = [];
    if (e.metaKey) m.push('cmd');
    if (e.ctrlKey) m.push('ctrl');
    if (e.altKey) m.push('alt');
    if (e.shiftKey) m.push('shift');
    return m;
  }
  var KEY_LABEL = { space: 'Space', enter: 'Enter', tab: 'Tab', delete: 'Delete', up: 'Up', down: 'Down', left: 'Left', right: 'Right' };
  // แสดงเป็นคำแบบ Windows (โปรแกรมใช้บน Windows เป็นหลัก) ไม่ใช่สัญลักษณ์ Mac
  var MOD_SYM = { cmd: 'Win', ctrl: 'Ctrl', alt: 'Alt', shift: 'Shift' };
  function bindingLabel(key, mods) {
    if (!key) return window.Tk.t('ยังไม่ได้ตั้ง — คลิกแล้วกดปุ่ม');
    var parts = (mods || []).map(function (x) { return MOD_SYM[x] || x; });
    var kl = KEY_LABEL[key] || key.toUpperCase();
    return parts.concat([kl]).join(' + ');
  }

  // ช่องกดบันทึกปุ่มเอง (แทน dropdown)
  function keyCaptureField(r) {
    r.modifiers = Array.isArray(r.modifiers) ? r.modifiers : [];
    var ACCESS_HINT = window.Tk.t('ปุ่มจะถูกส่งไปหน้าต่างที่กำลังโฟกัส — เปิดเกม/แอปให้อยู่หน้าจอก่อน (บน macOS ต้องอนุญาต Accessibility ให้แอปด้วย)');
    var display = el('button', { type: 'button', class: 'btn keycap' });
    var hint = el('div', { class: 'hint', text: ACCESS_HINT });
    var capturing = false;
    function refresh() { display.textContent = bindingLabel(r.key, r.modifiers); }
    function onKey(e) {
      if (!capturing) return;
      e.preventDefault(); e.stopPropagation();
      if (e.key === 'Escape') { stop(); return; }
      if (['Shift', 'Control', 'Alt', 'Meta'].indexOf(e.key) >= 0) return; // ปุ่ม modifier ล้วน → รอปุ่มจริง
      var k = browserKeyToWhitelist(e);
      if (!k) {
        hint.textContent = window.Tk.t('ปุ่มนี้ยังไม่รองรับ — ใช้ได้: a-z, 0-9, Space, Enter, Tab, Delete, ลูกศร, F1-F12');
        hint.style.color = 'var(--err)';
        return;
      }
      r.key = k; r.modifiers = modsFromEvent(e);
      hint.textContent = ACCESS_HINT; hint.style.color = '';
      stop();
    }
    // เผลอคลิกที่อื่น/เปลี่ยนแท็บระหว่างจับปุ่ม = เลิกจับ ไม่งั้น listener ค้าง แล้วกลืนปุ่มถัดไปที่กด
    function onOutside(e) { if (e.target !== display) stop(); }
    function start() {
      if (capturing) return;
      capturing = true;
      display.classList.add('capturing');
      display.textContent = window.Tk.t('กดปุ่มที่ต้องการ...  (Esc = ยกเลิก)');
      window.addEventListener('keydown', onKey, true);
      setTimeout(function () { document.addEventListener('mousedown', onOutside, true); }, 0);
    }
    function stop() {
      capturing = false;
      display.classList.remove('capturing');
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('mousedown', onOutside, true);
      refresh();
    }
    display.addEventListener('click', start);
    refresh();
    var clearBtn = el('button', { type: 'button', class: 'btn btn-sm keycap-clear', title: window.Tk.t('ล้างปุ่มลัดนี้'), onclick: function () { r.key = ''; r.modifiers = []; refresh(); } }, [
      window.Icon.el('x', 12), el('span', { text: window.Tk.t('ล้าง') })
    ]);
    return field(window.Tk.t('ปุ่มที่จะกด'), el('div', {}, [el('div', { class: 'keycap-row' }, [display, clearBtn]), hint]));
  }

  // ---- ช่องจับคีย์ลัด global (Electron accelerator เช่น 'F6', 'Control+Shift+A') ----
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
        Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown',
        Minus: '-', Equal: '=', Comma: ',', Period: '.', Slash: '/', Backquote: '`',
        BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'" };
      key = MAP[code] || null;
    }
    if (!key) return null;
    return mods.concat([key]).join('+');
  }

  // แปลง accelerator ที่เก็บจริง (เช่น 'Super+Shift+F6') → คำแบบ Windows สำหรับแสดงผล
  function accelLabel(acc) {
    if (!acc) return window.Tk.t('คลิกแล้วกดคีย์ที่ต้องการ');
    var W = { Super: 'Win', Command: 'Win', CommandOrControl: 'Ctrl', Control: 'Ctrl', Alt: 'Alt', Option: 'Alt', Shift: 'Shift' };
    return acc.split('+').map(function (p) { return W[p] || p; }).join(' + ');
  }
  function acceleratorField(trigger) {
    var capBtn = el('button', { type: 'button', class: 'btn keycap', text: accelLabel(trigger.accelerator) });
    var capturing = false;
    function onKey(e) {
      if (!capturing) return;
      e.preventDefault(); e.stopPropagation();
      if (e.key === 'Escape') { stop(); return; }
      if (['Shift', 'Control', 'Alt', 'Meta'].indexOf(e.key) >= 0) return; // รอปุ่มจริง
      var acc = eventToAccelerator(e);
      if (!acc) return;
      trigger.accelerator = acc;
      stop();
    }
    function onOutside(e) { if (e.target !== capBtn) stop(); }
    function stop() {
      capturing = false;
      capBtn.classList.remove('capturing');
      capBtn.textContent = accelLabel(trigger.accelerator);
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('mousedown', onOutside, true);
    }
    capBtn.addEventListener('click', function () {
      if (capturing) return;
      capturing = true;
      capBtn.classList.add('capturing');
      capBtn.textContent = window.Tk.t('กดคีย์ที่ต้องการ... (Esc = ยกเลิก)');
      window.addEventListener('keydown', onKey, true);
      // เผลอคลิกที่อื่นระหว่างจับปุ่ม = เลิกจับ ไม่งั้น listener ค้างแล้วกลืนปุ่มถัดไป
      setTimeout(function () { document.addEventListener('mousedown', onOutside, true); }, 0);
    });
    // คำอธิบายเปลี่ยนตามโหมดคีย์ลัด (ตั้งค่า → คีย์ลัด) เพราะข้อควรระวังคนละเรื่องกันคนละโหมด
    var f = field(window.Tk.t('คีย์ลัด (ทำงานแบบ global — กดจากโปรแกรมไหนก็ได้)'), el('div', {}, [capBtn]),
      window.Tk.t('แนะนำ F-key (F6, F7, ...) หรือคีย์ร่วมกับ Ctrl/Alt/Shift'));
    var hintEl = f.querySelector('.hint');
    invoke('settings:get', {}, { toast: false }).then(function (s) {
      if (!hintEl) return;
      hintEl.textContent = (s && s.hotkeyPassThrough !== false)
        ? window.Tk.t('โหมดปล่อยปุ่มผ่านเปิดอยู่ — ปุ่มที่ตั้งไว้ยังใช้กับเกม/โปรแกรมอื่นได้ตามปกติ ตั้งปุ่มธรรมดาอย่าง G ได้เลย')
        : window.Tk.t('โหมดยึดปุ่ม — ปุ่มที่ตั้งไว้จะใช้กับโปรแกรมอื่นไม่ได้ แนะนำ F-key หรือคีย์ร่วมกับ Ctrl/Alt/Shift (เปิดโหมดปล่อยปุ่มผ่านได้ที่แท็บ "ตั้งค่า")');
    });
    return f;
  }

  // ชื่อแท็บที่ใช้ตั้งรางวัลของวงล้อแต่ละตัว — โชว์ใน hint ให้ผู้ใช้ไปตั้งถูกที่
  var WHEEL_TAB = { wheel: 'สุ่มรางวัล (Roulette)', randomWheel: 'Random Wheel' };

  // ---- เลือกรางวัลสำหรับ trigger ผลวงล้อ — dropdown จากรายการรางวัลจริงของวงล้อ "ตัวนั้น" ----
  // kind = 'wheel' (Roulette) หรือ 'randomWheel' (วงล้อกลม) — คนละรายการรางวัลกัน
  function prizeField(trigger, kind) {
    kind = kind || 'wheel';
    var sel = el('select', {}, [el('option', { value: '', text: window.Tk.t('รางวัลอะไรก็ได้ (ทุกช่อง)') })]);
    sel.addEventListener('change', function () { trigger.prize = sel.value; });
    invoke('settings:get', {}, { toast: false }).then(function (s) {
      var segs = (s && s[kind] && s[kind].segments) || [];
      segs.forEach(function (seg) {
        if (!seg || !seg.label) return;
        sel.appendChild(el('option', { value: seg.label, text: seg.label, selected: seg.label === trigger.prize ? 'selected' : null }));
      });
      // รางวัลที่ตั้งไว้แต่ถูกลบออกจากรายการแล้ว — ยังโชว์ให้เห็น
      if (trigger.prize && !segs.some(function (x) { return x && x.label === trigger.prize; })) {
        sel.appendChild(el('option', { value: trigger.prize, text: trigger.prize + window.Tk.t(' (ไม่อยู่ในรายการแล้ว)'), selected: 'selected' }));
      }
    });
    return field(window.Tk.t('เมื่อสุ่มได้รางวัล'), sel, window.Tk.t('ตั้งรายการรางวัลได้ในแท็บ "{tab}" — ใช้ตัวแปร {prize} ในข้อความได้', { tab: window.Tk.t(WHEEL_TAB[kind] || kind) }));
  }

  var giftCache = null;
  var giftSource = null;   // {live, roomCount, updatedAt} — บอกผู้ใช้ว่ารายการมาจากห้องจริงหรือไฟล์สำรอง
  function invalidateGifts() { giftCache = null; giftSource = null; }

  function opt(list, selected) {
    return list.map(function (o) {
      var v = o.v != null ? o.v : o;
      var t = o.t != null ? o.t : o;
      return el('option', { value: v, text: window.Tk.t(t), selected: v === selected ? 'selected' : null });
    });
  }

  function field(labelText, inputEl, hint) {
    return el('div', { class: 'field' }, [
      el('label', { text: labelText }),
      inputEl,
      hint ? el('div', { class: 'hint', text: hint }) : null
    ]);
  }

  // ---- Trigger config UI ตามชนิด ----
  function renderTriggerFields(container, trigger) {
    container.innerHTML = '';
    if (trigger.type === 'gift') {
      container.appendChild(giftAutocomplete(trigger));
      var minD = el('input', { type: 'number', min: '0', value: trigger.minDiamonds || 0 });
      minD.addEventListener('input', function () { trigger.minDiamonds = Number(minD.value) || 0; });
      container.appendChild(field(window.Tk.t('เพชรขั้นต่ำ (diamondTotal)'), minD, window.Tk.t('เช่น 100 = เฉพาะของขวัญที่รวมแล้ว ≥ 100 เพชร')));

      // ของขวัญคอมโบ (กุหลาบ x10) มาเป็น event เดียว ปกติจึงทำงานครั้งเดียว
      // ติ๊กช่องนี้ = ทำซ้ำตามจำนวนที่ส่งจริง
      var rep = el('input', { type: 'checkbox' });
      rep.checked = trigger.repeatCombo === true;
      rep.addEventListener('change', function () { trigger.repeatCombo = rep.checked; });
      container.appendChild(el('div', { class: 'field' }, [
        el('label', { class: 'check-inline' }, [rep, el('span', { text: window.Tk.t('ทำซ้ำตามจำนวนของขวัญที่ส่ง') })]),
        el('div', { class: 'hint', text: window.Tk.t('เช่น กุหลาบ x10 จะทำงาน 10 ครั้ง (เว้นจังหวะให้อัตโนมัติ) — ไม่ติ๊ก = ทำงานครั้งเดียว') })
      ]));
      var mr = el('input', { type: 'number', min: '0', value: trigger.minRepeat || 0 });
      mr.addEventListener('input', function () { trigger.minRepeat = Number(mr.value) || 0; });
      container.appendChild(field(window.Tk.t('คอมโบอย่างน้อย (x)'), mr, window.Tk.t('เช่น 10 = ทำงานเฉพาะตอนส่งมาทีเดียว x10 ขึ้นไป · 0 = ทุกจำนวน')));
    } else if (trigger.type === 'chat') {
      var kw = el('input', { type: 'text', value: trigger.keyword || '', placeholder: window.Tk.t('เช่น !hello (เว้นว่าง = ทุกข้อความ)') });
      kw.addEventListener('input', function () { trigger.keyword = kw.value; });
      container.appendChild(field(window.Tk.t('คำ/คำสั่งในแชท'), kw, window.Tk.t('จับแบบมีคำนี้อยู่ในข้อความ (ไม่สนตัวพิมพ์เล็ก-ใหญ่)')));
    } else if (trigger.type === 'like') {
      trigger.likeMode = trigger.likeMode === 'perUser' ? 'perUser' : 'total';
      var modeSel = el('select', {}, opt([
        { v: 'total', t: 'ยอดไลค์รวมทั้งห้อง (ทุกคนรวมกัน)' },
        { v: 'perUser', t: 'รายคน (ผู้ชมแต่ละคนกดครบเอง)' }
      ], trigger.likeMode));
      modeSel.addEventListener('change', function () {
        trigger.likeMode = modeSel.value;
        renderTriggerFields(container, trigger); // เปลี่ยนโหมด → ฟิลด์/คำอธิบายเปลี่ยนตาม
      });
      container.appendChild(field(window.Tk.t('นับไลค์แบบ'), modeSel));

      // เขียนค่าเริ่มต้นกลับลง object ก่อน ไม่ใช่โชว์แค่ในช่อง
      // เดิมช่องโชว์ 1000 แต่ trigger.likeThreshold ยังเป็น undefined จนกว่าผู้ใช้จะพิมพ์
      // กดบันทึกเลย → ฝั่งรันไทม์อ่านได้ 0 แล้ว "continue" ทิ้ง = Action เงียบทั้งไลฟ์โดยไม่มีอะไรเตือน
      trigger.likeThreshold = Number(trigger.likeThreshold) || (trigger.likeMode === 'perUser' ? 50 : 1000);
      var th = el('input', { type: 'number', min: '1', value: trigger.likeThreshold });
      th.addEventListener('input', function () { trigger.likeThreshold = Number(th.value) || 0; });
      if (trigger.likeMode === 'perUser') {
        container.appendChild(field(window.Tk.t('จำนวนไลค์ต่อคน'), th, window.Tk.t('เช่น 50 = ยิงเมื่อผู้ชม "คนหนึ่ง" กดครบ 50 (และทุกๆ 50 ถัดไปของคนนั้น) — ใช้ {nickname} ในข้อความเพื่อบอกว่าใคร · แต่ละคนมีตัวนับ+คูลดาวน์ของตัวเอง')));
      } else {
        container.appendChild(field(window.Tk.t('ยิงทุกๆ กี่ไลค์ (ยอดรวมทั้งห้อง)'), th, window.Tk.t('เช่น 1000 = ยิงเมื่อยอดรวมแตะ 1000, 2000, 3000 ... (เชื่อมกลางไลฟ์จะเริ่มนับจากหลักปัจจุบัน)')));
      }
    } else if (trigger.type === 'goalReached') {
      var gSel = el('select', {}, opt([
        { v: '', t: 'เป้าหมายใดก็ได้' }, { v: 'likes', t: 'เป้าไลก์' },
        { v: 'diamonds', t: 'เป้าเพชร' }, { v: 'followers', t: 'เป้าผู้ติดตาม' }
      ], trigger.goal || ''));
      gSel.addEventListener('change', function () { trigger.goal = gSel.value; });
      container.appendChild(field(window.Tk.t('เป้าหมาย'), gSel,
        window.Tk.t('ตั้งเป้าได้ในแท็บ "เป้าหมาย & Timer" · ทำงานครั้งเดียวตอนยอดข้ามเส้นเป้า · ใช้ {target} ในข้อความ')));
    } else if (trigger.type === 'topChange') {
      container.appendChild(el('p', { class: 'hint', text: window.Tk.t('ทำงานเมื่อมีคนแซงขึ้นอันดับ 1 ผู้ให้ของขวัญของไลฟ์นี้ · ใช้ {nickname} = คนที่ขึ้นอันดับ 1') }));
    } else if (trigger.type === 'hotkey') {
      container.appendChild(acceleratorField(trigger));
    } else if (trigger.type === 'wheelResult' || trigger.type === 'randomWheelResult') {
      container.appendChild(prizeField(trigger, trigger.type === 'wheelResult' ? 'wheel' : 'randomWheel'));
    } else {
      container.appendChild(el('p', { class: 'hint', text: window.Tk.t('เหตุการณ์นี้จะทำงานทุกครั้งที่เกิดขึ้น') }));
    }
  }

  async function loadGifts() {
    try {
      if (!giftCache) giftCache = await invoke('gifts:list', {}, { toast: false });
    } catch (e) { /* ปล่อยว่าง */ }
    return giftCache || [];
  }

  // ---- ตัวเลือกของขวัญแบบ modal เต็มจอ — ครบทุกชิ้น + ช่องค้นหา กดเลือกได้เลย ----
  // (แยกชั้นจาก Tk.modal เพราะ modalHost มีช่องเดียว เปิดซ้อนจะทับตัว editor)
  function openGiftPicker(currentName, currentId, onPick) {
    currentId = Number(currentId) || 0;
    var overlay = el('div', { class: 'gift-pick-overlay' });
    var box = el('div', { class: 'gift-pick-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': window.Tk.t('เลือกของขวัญ') });
    var prevFocus = document.activeElement; // คืนโฟกัสให้ปุ่มที่กดเปิด ตอนปิดหน้าต่าง
    function close() {
      window.removeEventListener('keydown', onKey, true);
      overlay.remove();
      try { if (prevFocus && prevFocus.focus) prevFocus.focus(); } catch (_) {}
    }
    // Esc = ปิด · Tab = ขังโฟกัสไว้ในกล่อง ไม่ให้หลุดไปโดนฟอร์มที่ถูกบังอยู่ข้างหลัง
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

    var search = el('input', { type: 'text', placeholder: window.Tk.t('ค้นหาของขวัญ... เช่น rose'), autocomplete: 'off' });
    var grid = el('div', { class: 'gift-grid' });
    var count = el('span', { class: 'gift-pick-count' });

    function pick(g) { close(); onPick(g); }

    // แหล่งที่มา — ถ้ามาจากห้องจริง id/รูปตรงกับ event ที่ TikTok จะส่งแน่นอน ผู้ใช้ควรรู้ว่ากำลังเลือกจากอะไร
    if (!giftSource) {
      invoke('gifts:source', {}, { toast: false }).then(function (src) { giftSource = src || {}; renderGrid(); }).catch(function () {});
    }
    function sourceLabel() {
      if (!giftSource) return '';
      return giftSource.live
        ? window.Tk.t('ของขวัญของห้องล่าสุด {n} ชิ้น — id ตรงกับที่ TikTok ส่งจริง', { n: giftSource.roomCount })
        : window.Tk.t('รายการสำรองในเครื่อง — เชื่อมไลฟ์แล้วจะอัปเดตเป็นของห้องจริง');
    }

    // วาดเป็นหน้าละ PAGE ชิ้น เลื่อนถึงท้ายค่อยต่อหน้าถัดไป — แคตตาล็อกมี ~8,900 ชิ้น วาดหมดทีเดียวกระตุกมาก
    // เดิมตัดที่ 300 ชิ้นและซ่อนของคัสตอมไว้จนกว่าจะพิมพ์ค้นหา ตอนนี้เห็นได้ครบทุกชิ้นแค่เลื่อนลงไปเรื่อยๆ
    var PAGE = 60;
    // เส้นแบ่งของขวัญกลางของ TikTok กับของขวัญคัสตอมเฉพาะครีเอเตอร์/เอเจนซี่
    // ดูจากข้อมูลจริงในแคตตาล็อก 8,857 ชิ้น: id ต่ำกว่านี้ = ของกลาง 954 ชิ้น ราคาหลากหลาย
    // id ตั้งแต่นี้ขึ้นไป = 7,903 ชิ้น ชื่อเป็นชื่อคน/ทีม (RappStar Wink, MF AGENCY, Drip Mafia)
    // source มาจาก API ของ TikFinity: 1 = อยู่ในแผงของขวัญมาตรฐาน, 2 = เฉพาะครีเอเตอร์/แคมเปญ
    // ของเก่าที่ยังไม่มีฟิลด์นี้ค่อยเดาจาก id (ของกลางส่วนใหญ่ id ต่ำกว่า 20000)
    var CUSTOM_ID_FROM = 20000;
    function isOfficial(g) { return g.source ? g.source === 1 : (g.id || 0) < CUSTOM_ID_FROM; }
    var queue = [], cursor = 0, shownCount = 0, total = 0, foot = null;

    function cellFor(g) {
      // โชว์ id ด้วย เพราะแคตตาล็อกมีของชื่อซ้ำกันหลายตัว (Hand Heart มี 3 id, Cat มี 13 id)
      // ถ้าไม่มี id ผู้ใช้จะเห็นการ์ดหน้าตาเหมือนกันเป๊ะเรียงกันแล้วไม่รู้ว่าต่างกันตรงไหน
      var cell = el('button', { type: 'button', class: 'gift-cell' + (g.id === currentId ? ' active' : (g.name === currentName && !currentId ? ' active' : '')) }, [
        g.image
          ? el('img', { class: 'gift-cell-img', src: g.image, alt: '', loading: 'lazy' })
          : el('div', { class: 'gift-cell-img' }, [giftIcon(24)]),
        el('div', { class: 'gift-cell-name', text: g.name }),
        el('div', { class: 'gift-cell-coins', text: g.coins + ' 💎' }),
        el('div', { class: 'gift-cell-id', text: 'ID ' + g.id })
      ]);
      cell.addEventListener('click', function () { pick(g); });
      return cell;
    }

    // ป้ายท้ายตาราง: บอกว่าเห็นไปกี่ชิ้นจากทั้งหมด — หายไปเองเมื่อทุกอย่างพอดีหน้าเดียว
    function paintFoot() {
      if (!foot) return;
      if (cursor < queue.length) foot.textContent = window.Tk.t('แสดง {a} จาก {b} ชิ้น — เลื่อนลงเพื่อดูเพิ่ม', { a: shownCount, b: total });
      else foot.textContent = total > PAGE ? window.Tk.t('ครบทั้งหมด {b} ชิ้น', { b: total }) : '';
    }
    function appendPage() {
      if (cursor >= queue.length) return;
      var frag = document.createDocumentFragment();
      var end = Math.min(queue.length, cursor + PAGE);
      for (; cursor < end; cursor++) {
        var item = queue[cursor];
        if (item.sep) frag.appendChild(el('div', { class: 'gift-grid-sep', text: window.Tk.t('ของขวัญเฉพาะของครีเอเตอร์/เอเจนซี่ (ไม่ใช่ของกลาง)') }));
        else { frag.appendChild(cellFor(item)); shownCount++; }
      }
      grid.insertBefore(frag, foot);
      paintFoot();
    }
    // หน้าแรกอาจสั้นกว่าช่องเลื่อน (จอสูง) → ยังไม่มีอะไรให้เลื่อน ต้องเติมจนล้นก่อน ไม่งั้นไม่มีทางโหลดต่อ
    function fill() {
      for (var i = 0; i < 20 && cursor < queue.length && grid.scrollHeight <= grid.clientHeight + 40; i++) appendPage();
    }
    grid.addEventListener('scroll', function () {
      if (grid.scrollTop + grid.clientHeight >= grid.scrollHeight - 260) appendPage();
    });

    function renderGrid() {
      var q = search.value.trim().toLowerCase();
      var hit = (giftCache || []).filter(function (g) {
        if (!q) return true;
        if (g.name.toLowerCase().indexOf(q) >= 0) return true;
        return (g.aliases || []).some(function (a) { return String(a).toLowerCase().indexOf(q) >= 0; });
      });

      // เรียงตามราคาเพชร ถูก→แพง (id ใช้เป็นตัวตัดสินตอนราคาเท่ากัน ลำดับจะได้คงที่ทุกครั้งที่เปิด)
      function byCoins(a, b) {
        return (a.coins || 0) - (b.coins || 0) || (a.id || 0) - (b.id || 0);
      }
      var official = hit.filter(isOfficial).sort(byCoins);
      var custom = hit.filter(function (g) { return !isOfficial(g); }).sort(byCoins);   // ของคัสตอมต่อท้ายเสมอ
      queue = official.slice();
      if (custom.length) { queue.push({ sep: true }); queue = queue.concat(custom); }
      cursor = 0; shownCount = 0; total = official.length + custom.length;

      grid.innerHTML = '';
      grid.scrollTop = 0;
      count.textContent = (q
        ? window.Tk.t('พบ {n} ของกลาง', { n: official.length })
        : window.Tk.t('ของขวัญกลางของ TikTok {n} ชิ้น', { n: official.length }))
        + (custom.length ? window.Tk.t(' · {n} คัสตอม', { n: custom.length }) : '')
        + (!q && sourceLabel() ? ' · ' + sourceLabel() : '');

      // ตัวเลือก "ทุกชนิด" อยู่หัวเสมอ (ตอนไม่ได้ค้นหา)
      if (!q) {
        var anyCell = el('button', { type: 'button', class: 'gift-cell any' + (!currentName ? ' active' : '') }, [
          el('div', { class: 'gift-cell-img' }, [giftIcon(24)]),
          el('div', { class: 'gift-cell-name', text: window.Tk.t('ทุกชนิด') }),
          el('div', { class: 'gift-cell-coins', text: window.Tk.t('ของขวัญอะไรก็ได้') })
        ]);
        anyCell.addEventListener('click', function () { pick({ name: '', id: 0 }); });
        grid.appendChild(anyCell);
      }
      if (q && !total) {
        grid.appendChild(el('div', { class: 'gift-grid-empty', text: window.Tk.t('ไม่พบของขวัญชื่อ "{q}"', { q: q }) }));
      }
      foot = el('div', { class: 'gift-grid-more' });
      grid.appendChild(foot);
      appendPage();
      fill();
    }
    // debounce กันวาดถี่ทุกตัวอักษรที่พิมพ์
    var searchTimer = null;
    search.addEventListener('input', function () {
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(renderGrid, 120);
    });

    [
      el('div', { class: 'gift-pick-head' }, [
        el('h2', { text: window.Tk.t('เลือกของขวัญ') }),
        count,
        el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: window.Tk.t('✕ ปิด'), onclick: close })
      ]),
      search,
      grid
    ].forEach(function (n) { box.appendChild(n); });
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    search.focus();
    loadGifts().then(renderGrid);
  }

  // field ของ trigger gift: โชว์ของขวัญที่เลือกอยู่ + ปุ่มเปิด modal เลือก
  function giftAutocomplete(trigger) {
    var display = el('button', { type: 'button', class: 'gift-select' });
    function refresh() {
      display.innerHTML = '';
      var name = (trigger.giftName || '').trim();
      // หาด้วย id ก่อนเสมอ — ชื่อซ้ำกันได้หลายตัวและแต่ละตัวรูปไม่เหมือนกัน
      // ถ้าหาด้วยชื่ออย่างเดียวจะได้ตัวไหนก็ได้ แล้วรูปตรงนี้กับในหน้ารวมจะคนละใบ
      var g = null;
      if (trigger.giftId) g = (giftCache || []).filter(function (x) { return x.id === trigger.giftId; })[0] || null;
      if (!g && name) g = (giftCache || []).filter(function (x) { return x.name.toLowerCase() === name.toLowerCase(); })[0] || null;
      if (!name) {
        display.appendChild(giftIcon(20, 'gift-select-emoji'));
        display.appendChild(el('span', { class: 'gift-select-name', text: window.Tk.t('ของขวัญทุกชนิด') }));
      } else {
        if (g && g.image) display.appendChild(el('img', { src: g.image, alt: '' }));
        else display.appendChild(giftIcon(20, 'gift-select-emoji'));
        display.appendChild(el('span', { class: 'gift-select-name', text: name }));
        if (g) display.appendChild(el('span', { class: 'gift-select-coins', text: g.coins + ' 💎' }));
        if (trigger.giftId) display.appendChild(el('span', { class: 'gift-select-id', text: 'ID ' + trigger.giftId }));
      }
      display.appendChild(el('span', { class: 'gift-select-cta', text: window.Tk.t('เปลี่ยน') }));
    }
    display.addEventListener('click', function () {
      openGiftPicker((trigger.giftName || '').trim(), trigger.giftId || 0, function (g) {
        trigger.giftName = g.name;
        trigger.giftId = g.id;   // เก็บไว้ให้หน้าจอโชว์รูป/id ตัวที่ผู้ใช้เลือกจริง
        refresh();
      });
    });
    loadGifts().then(refresh);
    refresh();
    return field(window.Tk.t('ของขวัญที่จะจับ'), display, window.Tk.t('กดเพื่อเปิดหน้าเลือกของขวัญ — ของขวัญกลางของ TikTok เรียงตามเพชรถูกไปแพง ส่วนของขวัญเฉพาะของครีเอเตอร์พิมพ์ค้นหาเอา'));
  }

  // ---- Response config UI ตามชนิด ----
  function renderRespFields(container, r) {
    container.innerHTML = '';
    function bind(inp, key, num) {
      inp.addEventListener('input', function () { r[key] = num ? (Number(inp.value) || 0) : inp.value; });
      return inp;
    }
    if (r.type === 'alert') {
      container.appendChild(templateField(window.Tk.t('ข้อความหลัก'), bind(el('input', { type: 'text', value: r.text || '' }), 'text')));
      container.appendChild(templateField(window.Tk.t('ข้อความรอง'), bind(el('input', { type: 'text', value: r.subText || '' }), 'subText')));
      container.appendChild(mediaPicker(window.Tk.t('รูป/GIF (ไม่บังคับ)'), r, 'imageUrl', [{ name: window.Tk.t('รูป'), extensions: ['png','jpg','jpeg','gif','webp'] }]));
      container.appendChild(mediaPicker(window.Tk.t('เสียง (ไม่บังคับ)'), r, 'soundUrl', [{ name: window.Tk.t('เสียง'), extensions: ['mp3','wav','ogg'] }]));
      container.appendChild(field(window.Tk.t('ระยะเวลาแสดง (วินาที)'), bind(el('input', { type: 'number', min: '1', value: r.durationSec || 6 }), 'durationSec', true)));
    } else if (r.type === 'tts') {
      container.appendChild(templateField(window.Tk.t('ข้อความที่จะอ่าน'), bind(el('input', { type: 'text', value: r.text || '' }), 'text')));
    } else if (r.type === 'sound') {
      container.appendChild(mediaPicker(window.Tk.t('ไฟล์เสียง'), r, 'url', [{ name: window.Tk.t('เสียง'), extensions: ['mp3','wav','ogg'] }]));
      container.appendChild(field(window.Tk.t('ความดัง (0-1)'), bind(el('input', { type: 'number', min: '0', max: '1', step: '0.1', value: r.volume != null ? r.volume : 1 }), 'volume', true)));
    } else if (r.type === 'video') {
      container.appendChild(mediaPicker(window.Tk.t('ไฟล์วิดีโอ'), r, 'url',
        [{ name: window.Tk.t('วิดีโอ'), extensions: ['mp4', 'webm', 'mov', 'm4v'] }]));
      container.appendChild(field(window.Tk.t('ความดัง (0-1)'),
        bind(el('input', { type: 'number', min: '0', max: '1', step: '0.1', value: r.volume != null ? r.volume : 1 }), 'volume', true)));
      container.appendChild(field(window.Tk.t('เล่นไม่เกินกี่วินาที'),
        bind(el('input', { type: 'number', min: '1', max: '60', value: r.maxSec != null ? r.maxSec : 10 }), 'maxSec', true),
        window.Tk.t('คลิปที่ยาวกว่านี้จะเล่นแค่ช่วงต้น · widget "วิดีโอ" มีเพดานของฉากทับอีกชั้น')));
    } else if (r.type === 'keypress') {
      container.appendChild(keyCaptureField(r)); // คลิกแล้วกดปุ่มจริงเพื่อบันทึก (พร้อม modifier อัตโนมัติ)
      container.appendChild(field(window.Tk.t('กดค้าง (มิลลิวินาที, 0 = แตะ)'), bind(el('input', { type: 'number', min: '0', value: r.holdMs || 0 }), 'holdMs', true)));
    } else if (r.type === 'obs') {
      var actSel = el('select', {}, opt([{ v: 'setScene', t: 'เปลี่ยน Scene' }, { v: 'toggleSource', t: 'ซ่อน/แสดง Source' }], r.obsAction || 'setScene'));
      r.obsAction = r.obsAction || 'setScene';
      actSel.addEventListener('change', function () { r.obsAction = actSel.value; renderRespFields(container, r); });
      // การกระทำอื่นๆ ใช้กับโปรแกรมไลฟ์ตัวไหนก็ได้ (โอเวอร์เลย์เป็นแค่ลิงก์) แต่ข้อนี้คุยผ่าน
      // obs-websocket ซึ่งมีเฉพาะ OBS/Streamlabs Desktop — ต้องบอกให้ชัด ไม่งั้นคนใช้
      // TikTok LIVE Studio จะตั้งไว้แล้วงงว่าทำไมไม่ทำงาน โดยไม่มีอะไรบอกสาเหตุเลย
      container.appendChild(field(window.Tk.t('คำสั่ง OBS'), actSel,
        window.Tk.t('ใช้ได้เฉพาะ OBS Studio หรือ Streamlabs Desktop (ต้องเชื่อมต่อในหน้าตั้งค่าก่อน) — TikTok LIVE Studio ยังสั่งแบบนี้ไม่ได้')));
      container.appendChild(field(window.Tk.t('ชื่อ Scene'), bind(el('input', { type: 'text', value: r.scene || '' }), 'scene')));
      if (r.obsAction === 'toggleSource') {
        container.appendChild(field(window.Tk.t('ชื่อ Source'), bind(el('input', { type: 'text', value: r.source || '' }), 'source')));
        // ช่องนี้โชว์ "แสดง" ตอนยังไม่เคยแตะ แต่ r.visible เป็น undefined
        // แล้ว obs.toggleSource ทำ !!visible = false → Source ถูก "ซ่อน" ตรงข้ามกับที่ช่องบอก
        // เขียนค่าที่โชว์กลับลง object ก่อน (แบบเดียวกับ likeThreshold)
        r.visible = r.visible !== false;
        var visSel = el('select', {}, opt([{ v: 'true', t: 'แสดง' }, { v: 'false', t: 'ซ่อน' }], String(r.visible)));
        visSel.addEventListener('change', function () { r.visible = visSel.value === 'true'; });
        container.appendChild(field(window.Tk.t('สถานะ'), visSel));
      }
    } else if (r.type === 'wheel' || r.type === 'randomWheel') {
      container.appendChild(branchEditor(r, r.type));
    } else if (r.type === 'delay') {
      var sec = el('input', { type: 'number', min: '0', max: '60', step: '0.5', value: (Number(r.ms) || 0) / 1000 });
      sec.addEventListener('input', function () { r.ms = Math.round(Math.min(60, Math.max(0, Number(sec.value) || 0)) * 1000); });
      container.appendChild(field(window.Tk.t('รอกี่วินาที'), sec, window.Tk.t('สูงสุด 60 วินาที · สิ่งที่อยู่ในกล่องด้านล่างจะรอจนครบเวลา')));
      container.appendChild(delayBranch(r));
    } else if (r.type === 'random' || r.type === 'if') {
      if (r.type === 'if') container.appendChild(condField(r));
      container.appendChild(logicBranches(r));
    } else if (r.type === 'minecraft') {
      // คำสั่งรับตัวแปรได้เหมือนช่องข้อความอื่น + {player} ที่แทนด้วยชื่อผู้เล่นในหน้าตั้งค่า
      container.appendChild(templateField(window.Tk.t('คำสั่ง Minecraft'),
        bind(el('input', { type: 'text', value: r.command || '', placeholder: 'summon zombie ~ ~ ~' }), 'command')));
      container.appendChild(el('p', { class: 'hint', text: window.Tk.t('ไม่ต้องใส่ / นำหน้า (ใส่มาก็ตัดให้) · ใช้ {player} แทนชื่อผู้เล่นที่ตั้งไว้ในตั้งค่า เช่น give {player} diamond 1') }));
      container.appendChild(el('p', { class: 'hint', text: window.Tk.t('ต้องเปิดการเชื่อมต่อ Minecraft ในแท็บ "ตั้งค่า" ก่อน และเซิร์ฟเวอร์ต้องติดตั้งปลั๊กอิน ServerTap') }));
    } else if (r.type === 'winCounter') {
      // ช่องจำนวนโชว์ 1 ตอนยังไม่เคยแตะ แต่ r.wcAmount เป็น undefined
      // แล้ว runtime ทำ Number(undefined) || 0 = บวกศูนย์ → ยอดไม่ขยับเลยทั้งที่การ์ดบอกว่า +1
      r.wcCmd = r.wcCmd || 'add';
      if (r.wcAmount == null) r.wcAmount = 1;
      var wcSel = el('select', {}, opt([
        { v: 'add', t: 'บวก/ลบยอด' },
        { v: 'set', t: 'ตั้งยอดเป็นค่าที่กำหนด' },
        { v: 'reset', t: 'รีเซ็ตเป็น 0' }
      ], r.wcCmd || 'add'));
      r.wcCmd = r.wcCmd || 'add';
      wcSel.addEventListener('change', function () { r.wcCmd = wcSel.value; renderRespFields(container, r); });
      container.appendChild(field(window.Tk.t('คำสั่งตัวนับชัยชนะ'), wcSel, window.Tk.t('ตั้งค่าหน้าตา/คีย์ลัดได้ในแท็บ "ตัวนับชัยชนะ"')));
      if (r.wcCmd !== 'reset') {
        container.appendChild(field(
          r.wcCmd === 'set' ? window.Tk.t('ตั้งยอดเป็น') : window.Tk.t('จำนวน (ติดลบ = ลดยอด)'),
          bind(el('input', { type: 'number', step: '1', value: r.wcAmount }), 'wcAmount', true),
          r.wcCmd === 'set' ? window.Tk.t('เช่น 0 เพื่อเริ่มนับใหม่') : window.Tk.t('เช่น 1 = ชนะเพิ่ม 1 · -1 = ย้อนกลับ')));
      }
    } else if (r.type === 'timer') {
      var tcSel = el('select', {}, opt([
        { v: 'add', t: 'เพิ่ม/ลดเวลา (วินาที)' },
        { v: 'start', t: 'เริ่มจับเวลา' },
        { v: 'pause', t: 'พักจับเวลา' },
        { v: 'reset', t: 'รีเซ็ตกลับเวลาเริ่มต้น' }
      ], r.timerCmd || 'add'));
      r.timerCmd = r.timerCmd || 'add';
      tcSel.addEventListener('change', function () { r.timerCmd = tcSel.value; renderRespFields(container, r); });
      container.appendChild(field(window.Tk.t('คำสั่ง Timer'), tcSel, window.Tk.t('ตั้งค่า Subathon Timer ได้ในแท็บ "เป้าหมาย & Timer"')));
      if ((r.timerCmd || 'add') === 'add') {
        container.appendChild(field(window.Tk.t('วินาที (ติดลบ = หักเวลา)'),
          bind(el('input', { type: 'number', step: '1', value: r.seconds != null ? r.seconds : 60 }), 'seconds', true),
          window.Tk.t('เช่น 30 = +30 วิ · -60 = หัก 1 นาที')));
      }
    } else if (r.type === 'webhook') {
      r.method = r.method || 'GET';
      // เคสส่วนใหญ่: แค่วาง URL (ยิง GET) — ใส่ตัวแปรได้ เช่น ?username={nickname}
      container.appendChild(templateField(window.Tk.t('URL ที่จะยิง'), bind(el('input', { type: 'text', value: r.url || '', placeholder: 'https://...?username={nickname}&key=1' }), 'url')));
      container.appendChild(el('div', { class: 'hint', text: window.Tk.t('พอเหตุการณ์เกิด จะยิง request ไปที่ URL นี้ · ใส่ตัวแปรได้ (แทนค่า+encode ให้เอง) — ปกติแค่นี้ก็พอ') }));

      // ตัวเลือกขั้นสูง (POST/PUT + body) — ส่วนใหญ่ไม่ต้องแตะ
      var methodSel = el('select', {}, opt(['GET', 'POST', 'PUT'], r.method));
      var bodyField = el('div', {});
      function renderBody() {
        bodyField.innerHTML = '';
        if (r.method !== 'GET') bodyField.appendChild(templateField(window.Tk.t('Body (JSON, ไม่บังคับ)'), bind(el('textarea', { rows: '2', value: r.body || '' }), 'body')));
      }
      methodSel.addEventListener('change', function () { r.method = methodSel.value; renderBody(); });
      renderBody();
      var adv = el('details', { class: 'wh-adv' }, [
        el('summary', { text: window.Tk.t('ตัวเลือกขั้นสูง (Method / Body)') }),
        field('Method', methodSel, window.Tk.t('ปกติใช้ GET — เปลี่ยนเป็น POST/PUT เฉพาะเมื่อปลายทางต้องการ')),
        bodyField
      ]);
      container.appendChild(adv);
    }
  }

  function mediaPicker(label, obj, key, filters) {
    var inp = el('input', { type: 'text', value: obj[key] || '', placeholder: window.Tk.t('วาง URL หรือกดเลือกไฟล์') });
    inp.addEventListener('input', function () { obj[key] = inp.value; });
    var btn = el('button', { class: 'btn btn-sm url-row-btn', type: 'button' }, [
      window.Icon.el('upload', 12), el('span', { text: window.Tk.t('เลือกไฟล์') })
    ]);
    btn.addEventListener('click', async function () {
      // คัดลอกไฟล์เข้าคลัง /media แล้วเสิร์ฟผ่าน http → เล่นได้ทั้ง Dashboard และ widget บนโปรแกรมไลฟ์
      // (file:// เล่นในแหล่งภาพชนิดเว็บไม่ได้ + บน Windows ประกอบ URL พังง่าย)
      var url = await invoke('media:import', { filters: filters });
      if (url) { obj[key] = url; inp.value = url; }
    });
    return field(label, el('div', { class: 'url-row' }, [inp, btn]), window.Tk.t('ไฟล์จะถูกคัดลอกเข้าโปรแกรม เล่นได้ทั้งในแอปและบนโอเวอร์เลย์'));
  }

  // app:pickFile คืน file:// URL ที่ถูกต้องมาแล้ว (ผ่านตรงนี้ไปเลย);
  // ฟังก์ชันนี้เหลือไว้เผื่อผู้ใช้ "วาง path เอง" — รองรับทั้ง Windows (C:\..) และ POSIX (/..)
  function toFileUrl(p) {
    p = String(p || '').trim();
    if (/^(https?|file):/i.test(p)) return p;      // เป็น URL อยู่แล้ว
    var s = p.replace(/\\/g, '/');                 // \ → /
    if (/^[a-zA-Z]:\//.test(s)) s = '/' + s;       // C:/x → /C:/x (ให้ได้ file:///C:/x)
    var enc = s.split('/').map(function (seg) {
      return encodeURIComponent(seg).replace(/%3A/gi, ':'); // คง ':' ของ drive letter
    }).join('/');
    return 'file://' + enc;
  }

  // ---- ค่าเริ่มต้นของ response แต่ละชนิดตอนเพิ่มใหม่ ----
  // ข้อความตัวอย่างตามเหตุการณ์ — ให้ default สมเหตุสมผลกับ trigger ที่เลือกอยู่
  function sampleText(kind) {
    switch (curTriggerType) {
      case 'gift': return kind === 'alert' ? window.Tk.t('{nickname} ส่ง {giftName} x{repeatCount}!') : window.Tk.t('ขอบคุณ {nickname} สำหรับ {giftName}');
      case 'chat': return kind === 'alert' ? '{nickname}: {comment}' : window.Tk.t('{nickname} บอกว่า {comment}');
      case 'like': return kind === 'alert' ? window.Tk.t('ไลค์ทะลุ {likeCount} แล้ว!') : window.Tk.t('ไลค์ครบ {likeCount} แล้วจ้า');
      case 'follow': return kind === 'alert' ? window.Tk.t('{nickname} กดติดตามแล้ว!') : window.Tk.t('ขอบคุณ {nickname} ที่ติดตาม');
      case 'share': return kind === 'alert' ? window.Tk.t('{nickname} แชร์ไลฟ์!') : window.Tk.t('ขอบคุณ {nickname} ที่ช่วยแชร์');
      case 'subscribe': return kind === 'alert' ? window.Tk.t('{nickname} สมัครสมาชิก!') : window.Tk.t('ขอบคุณสมาชิกใหม่ {nickname}');
      case 'member': return kind === 'alert' ? window.Tk.t('ต้อนรับ {nickname} เข้าห้อง') : window.Tk.t('สวัสดี {nickname}');
      case 'hotkey': return kind === 'alert' ? window.Tk.t('ทำงานแล้ว!') : window.Tk.t('ทำงานแล้ว');
      case 'wheelResult':
      case 'randomWheelResult': return kind === 'alert' ? window.Tk.t('ได้รางวัล: {prize}!') : window.Tk.t('สุ่มได้ {prize}');
      default: return window.Tk.t('ขอบคุณ {nickname}');
    }
  }

  function newResponse(type) {
    switch (type) {
      case 'alert': return { type: 'alert', text: sampleText('alert'), durationSec: 6 };
      case 'tts': return { type: 'tts', text: sampleText('tts') };
      case 'sound': return { type: 'sound', url: '', volume: 1 };
      case 'video': return { type: 'video', url: '', volume: 1, maxSec: 10 };
      case 'keypress': return { type: 'keypress', key: '', modifiers: [], holdMs: 0 };
      case 'obs': return { type: 'obs', obsAction: 'setScene', scene: '' };
      case 'wheel': return { type: 'wheel' };
      case 'randomWheel': return { type: 'randomWheel' };
      case 'timer': return { type: 'timer', timerCmd: 'add', seconds: 60 };
      case 'winCounter': return { type: 'winCounter', wcCmd: 'add', wcAmount: 1 };
      case 'minecraft': return { type: 'minecraft', command: 'say {nickname} ส่งของขวัญให้!' };
      case 'webhook': return { type: 'webhook', url: '', method: 'GET' };
      case 'delay': return { type: 'delay', ms: 2000, branches: [{ responses: [] }] };
      case 'random': return { type: 'random', branches: [{ responses: [] }, { responses: [] }] };
      case 'if': return { type: 'if', cond: { kind: 'diamonds', value: 100 }, branches: [{ responses: [] }, { responses: [] }] };
      default: return { type: type };
    }
  }

  // ---- เงื่อนไขของโหนด "ถ้า..." (ตรงกับ evalCond ใน core/actions.js) ----
  var COND_KINDS = [
    { v: 'diamonds', t: 'เพชรรวมอย่างน้อย', num: true },
    { v: 'combo', t: 'คอมโบอย่างน้อย (x)', num: true },
    { v: 'follower', t: 'เป็นผู้ติดตาม' },
    { v: 'subscriber', t: 'เป็นสมาชิก' },
    { v: 'moderator', t: 'เป็นผู้ดูแลห้อง' },
    { v: 'chatHas', t: 'แชทมีคำว่า', text: true },
    { v: 'chance', t: 'โอกาส (%)', num: true }
  ];
  function condLabel(c) {
    c = c || {};
    var k = COND_KINDS.filter(function (x) { return x.v === c.kind; })[0];
    if (!k) return '';
    var t = window.Tk.t(k.t);
    if (k.num) return t + ' ' + (Number(c.value) || 0);
    if (k.text) return t + ' "' + (c.text || '') + '"';
    return t;
  }

  // ---- Response list — การ์ดหัวไอคอน+ชื่อชนิด (เลือกชนิดตอนกดเพิ่ม ไม่ใช่ dropdown) ----
  // holder = อะไรก็ได้ที่มี .responses — ใช้ได้ทั้ง action และ "กิ่ง" ของกงล้อ (ซ้อนกันได้)
  // จำว่าการ์ดไหนกางอยู่ — คีย์ด้วยตัว object ของการกระทำ ไม่ใช่ลำดับที่
  // เพราะ renderResponses ถูกเรียก "หลัง" splice เสมอ ถ้าจำตามลำดับ พอลบใบกลาง
  // สถานะกาง/พับจะเลื่อนไปทั้งลิสต์ (ลบใบ 2 แล้วใบ 3 พับเอง)
  // และห้ามเก็บลงใน action เพราะ snapshot() stringify ทั้งก้อนไปเทียบว่าผู้ใช้แก้อะไรหรือยัง
  var expanded = new WeakSet();
  function seedExpanded(list) {
    // พับทุกใบตั้งแต่เปิด — หัวการ์ดบอกค่าที่ตั้งไว้แล้ว (ตั้งเสร็จจากป๊อปอัปตอนเพิ่ม)
    // กดใบไหนค่อยกางใบนั้น ลิสต์จะสั้นเท่ากันไม่ว่ามี 2 หรือ 8 การกระทำ
    // ยังคงฟังก์ชันไว้เป็นจุดเดียวที่คุมนโยบาย "เปิดมาแล้วกางอะไร" เผื่อเปลี่ยนใจทีหลัง
    list = Array.isArray(list) ? list : [];
    list.forEach(function (r) {
      ((r && r.branches) || []).forEach(function (b) { seedExpanded(b && b.responses); });
    });
  }

  // สีประจำชนิดการกระทำ — โทนเดียวกับสีเหตุการณ์บนการ์ด (TRIG_META ใน app.js) ให้กวาดตาแยกชนิดได้เร็ว
  var RESP_COLOR = {
    alert: '#5b93cc', tts: '#25c1c9', sound: '#c9a6ff', video: '#f0466a',
    keypress: '#427ab5', obs: '#7fd4ff', webhook: '#f0c060', minecraft: '#3ecf8e',
    wheel: '#c9a6ff', randomWheel: '#7fd4ff', timer: '#e0904a', winCounter: '#f0c060',
    delay: '#94a3b8', random: '#c9a6ff', if: '#4ab4fa'
  };
  function respIcoStyle(type) {
    var c = RESP_COLOR[type] || 'var(--accent)';
    return '--sc:' + c + ';--sc-weak:color-mix(in srgb, ' + c + ' 18%, transparent)';
  }
  // ค่าบนหัวการ์ด — ว่าง = บอกตรงๆ ว่ายังไม่ตั้ง ดีกว่าเว้นว่างให้เดาว่าตั้งแล้วหรือยัง
  function paintSum(node, r) {
    var v = respSummaryRaw(r);
    node.textContent = v || window.Tk.t('ยังไม่ได้ตั้งค่า');
    node.classList.toggle('empty', !v);
  }

  function renderResponses(listEl, holder) {
    var action = holder;
    action.responses = Array.isArray(action.responses) ? action.responses : [];
    listEl.innerHTML = '';
    if (!action.responses.length && holder !== topHolder) {
      listEl.appendChild(el('div', { class: 'resp-empty', text: window.Tk.t('ยังไม่มีการกระทำ — เลือกจากช่องด้านบนได้เลย') }));
    }
    action.responses.forEach(function (r, idx) {
      var meta = respMeta(r.type);
      var del = el('button', {
        class: 'btn btn-danger btn-sm icon-btn resp-del', type: 'button',
        title: window.Tk.t('ลบการกระทำนี้')
      }, [window.Icon.el('trash', 13)]);
      // อยู่ใน <summary> ที่คลิกแล้วพับ/กาง — ต้องกันไม่ให้การลบไปสลับสถานะการ์ดด้วย
      del.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        action.responses.splice(idx, 1);
        renderResponses(listEl, action);
      });
      // tabindex บน summary จำเป็น — ตัวขังโฟกัสของ modal (util.js) คัดจากรายการ selector
      // ที่ไม่มี summary ถ้าไม่ใส่ พอ Tab มาถึงใบท้ายๆ โฟกัสจะหลุดออกนอกกล่องที่ปิด Esc ไว้
      var sumTxt = el('span', { class: 'resp-sum' });
      paintSum(sumTxt, r);
      var sum = el('summary', { class: 'resp-head', tabindex: '0' }, [
        el('span', { class: 'resp-caret' }, [window.Icon.el('chevronRight', 12)]),
        el('span', { class: 'resp-ord', text: String(idx + 1) }),
        el('span', { class: 'resp-ico', style: respIcoStyle(r.type) }, [window.Icon.el(meta.icon, 14)]),
        el('span', { class: 'resp-name', text: window.Tk.t(meta.t) }),
        sumTxt,
        del
      ]);
      var fieldsWrap = el('div', { class: 'resp-fields' });
      var item = el('details', { class: 'resp-item' }, [sum, fieldsWrap]);
      if (expanded.has(r)) item.open = true;
      // สรุปบนหัวการ์ดต้องตามค่าที่พิมพ์ทันที ไม่งั้นกรอกข้อความเสร็จแล้วพับการ์ด
      // หัวการ์ดยังบอกว่า "ยังไม่ได้ตั้งค่า" ทั้งที่ตั้งไปแล้ว (คำนวณครั้งเดียวตอนสร้าง)
      function syncSum() { paintSum(sumTxt, r); }
      fieldsWrap.addEventListener('input', syncSum);
      fieldsWrap.addEventListener('change', syncSum);
      item.addEventListener('toggle', function () {
        if (item.open) expanded.add(r); else expanded.delete(r);
        syncSum();   // ตอนพับคือจังหวะที่ต้องเห็นค่าล่าสุดที่สุด (ครอบกรณีกิ่งที่เพิ่ม/ลบด้วยปุ่ม)
      });
      renderRespFields(fieldsWrap, r);   // สร้างฟิลด์เสมอแม้พับอยู่ — ค่า default บางตัวถูกเซ็ตตรงนี้
      listEl.appendChild(item);
    });
    if (holder === topHolder && countEl) {
      countEl.textContent = String(action.responses.length);
      countEl.hidden = !action.responses.length;
      if (topAddLabel) topAddLabel.textContent = addLabel(action);
    }
  }

  // แถวปุ่ม "เพิ่มการกระทำ" แยกตามชนิด — เห็นตัวเลือกทั้งหมดในคลิกเดียว
  // ---- กิ่ง: "สุ่มได้อะไร -> ทำอะไรต่อ" อยู่ใน Action เดียวกัน ----
  // เดิมต้องสร้าง Action แยกอีกใบที่ trigger เป็น "เมื่อสุ่มรางวัลออก" แล้วจำเอาเองว่าคู่กับใบไหน
  // kind = 'wheel' | 'randomWheel' — ดึงรายการรางวัลจาก settings ของวงล้อตัวนั้น
  function branchEditor(r, kind) {
    kind = kind || 'wheel';
    r.branches = Array.isArray(r.branches) ? r.branches : [];
    var wrap = el('div', { class: 'branch-wrap' });
    var head = el('div', { class: 'branch-head' }, [
      el('span', { class: 'branch-title' }, [window.Icon.el('share', 13), el('span', { text: window.Tk.t('เมื่อสุ่มได้ผล → ทำอะไรต่อ') })]),
      el('span', { class: 'hint', text: window.Tk.t('ไม่ใส่กิ่ง = หมุนเฉย ๆ · รางวัลจากแท็บ "{tab}"', { tab: window.Tk.t(WHEEL_TAB[kind] || kind) }) })
    ]);
    var listWrap = el('div', { class: 'branch-list' });
    var prizes = [];

    function prizeSelect(b) {
      var sel = el('select', { class: 'branch-prize' }, [el('option', { value: '', text: window.Tk.t('ผลใดก็ได้') })]);
      prizes.forEach(function (p) { sel.appendChild(el('option', { value: p, text: p })); });
      if (b.prize && prizes.indexOf(b.prize) < 0) {
        sel.appendChild(el('option', { value: b.prize, text: b.prize + window.Tk.t(' (ไม่อยู่ในรายการแล้ว)') }));
      }
      sel.value = b.prize || '';
      sel.addEventListener('change', function () { b.prize = sel.value; });
      return sel;
    }

    function draw() {
      listWrap.innerHTML = '';
      if (!r.branches.length) {
        listWrap.appendChild(el('div', { class: 'branch-empty', text: window.Tk.t('ยังไม่มีกิ่ง — กด "เพิ่มกิ่ง" เพื่อกำหนดว่าถ้าสุ่มได้รางวัลไหน แล้วให้ทำอะไรต่อ') }));
      }
      r.branches.forEach(function (b, i) {
        b.responses = Array.isArray(b.responses) ? b.responses : [];
        var subList = el('div', { class: 'resp-list sub' });
        var row = el('div', { class: 'branch-item' }, [
          el('div', { class: 'branch-row' }, [
            el('span', { class: 'branch-when', text: window.Tk.t('ถ้าได้') }),
            prizeSelect(b),
            el('span', { class: 'branch-then', text: window.Tk.t('ให้ทำ') }),
            el('button', { class: 'btn btn-danger btn-sm icon-btn', type: 'button', title: window.Tk.t('ลบกิ่งนี้'), onclick: function () {
              r.branches.splice(i, 1); draw();
            } }, [window.Icon.el('trash', 13)])
          ]),
          addRespSelect(b, subList, true),
          subList
        ]);
        renderResponses(subList, b);
        listWrap.appendChild(row);
      });
    }

    var addBtn = el('button', { class: 'btn btn-sm', type: 'button', onclick: function () {
      r.branches.push({ prize: prizes[0] || '', responses: [] });
      draw();
    } }, [window.Icon.el('plus', 13), el('span', { text: window.Tk.t('เพิ่มกิ่ง') })]);

    wrap.appendChild(head);
    wrap.appendChild(listWrap);
    wrap.appendChild(addBtn);
    draw();

    invoke('settings:get', {}, { toast: false }).then(function (st) {
      prizes = ((st && st[kind] && st[kind].segments) || []).map(function (x) { return x && x.label; }).filter(Boolean);
      draw();
    });
    return wrap;
  }

  // ---- เงื่อนไขของโหนด "ถ้า..." ----
  function condField(r) {
    r.cond = r.cond || { kind: 'diamonds', value: 100 };
    var box = el('div', { class: 'branch-row' });
    function draw() {
      box.innerHTML = '';
      var k = COND_KINDS.filter(function (x) { return x.v === r.cond.kind; })[0] || COND_KINDS[0];
      var sel = el('select', {}, opt(COND_KINDS.map(function (x) { return { v: x.v, t: x.t }; }), k.v));
      sel.addEventListener('change', function () { r.cond = { kind: sel.value, value: r.cond.value, text: r.cond.text }; draw(); });
      box.appendChild(el('span', { class: 'branch-when', text: window.Tk.t('ถ้า') }));
      box.appendChild(sel);
      if (k.num) {
        var n = el('input', { type: 'number', min: '0', value: r.cond.value != null ? r.cond.value : 0, style: 'width:90px' });
        n.addEventListener('input', function () { r.cond.value = Number(n.value) || 0; });
        box.appendChild(n);
      } else if (k.text) {
        var t = el('input', { type: 'text', value: r.cond.text || '', placeholder: '!jump', style: 'width:130px' });
        t.addEventListener('input', function () { r.cond.text = t.value; });
        box.appendChild(t);
      }
    }
    draw();
    return field(window.Tk.t('เงื่อนไข'), box, window.Tk.t('ตรวจกับข้อมูลของเหตุการณ์ที่จุดชนวน เช่นของขวัญชิ้นนั้น/คนที่ส่ง'));
  }

  // ---- ทางของโหนดสุ่มทาง / ถ้า... — แต่ละทางมีรายการการกระทำของตัวเอง ----
  function logicBranches(r) {
    var isIf = r.type === 'if';
    r.branches = Array.isArray(r.branches) ? r.branches : [];
    while (r.branches.length < 2) r.branches.push({ responses: [] });
    if (isIf) r.branches.length = 2;
    var wrap = el('div', { class: 'branch-wrap' });
    var list = el('div', { class: 'branch-list' });
    function draw() {
      list.innerHTML = '';
      r.branches.forEach(function (b, i) {
        b.responses = Array.isArray(b.responses) ? b.responses : [];
        var sub = el('div', { class: 'resp-list sub' });
        var head = [el('span', { class: 'branch-when', text: isIf ? window.Tk.t(i === 0 ? 'ถ้าใช่ ให้ทำ' : 'ถ้าไม่ใช่ ให้ทำ') : window.Tk.t('ทางที่ {n}', { n: i + 1 }) })];
        if (!isIf) {
          var w = el('input', { type: 'number', min: '0', value: b.weight != null ? b.weight : 1, style: 'width:64px', title: window.Tk.t('น้ำหนัก — ยิ่งมากยิ่งถูกสุ่มบ่อย') });
          w.addEventListener('input', function () { b.weight = Math.max(0, Number(w.value) || 0); });
          head.push(el('span', { class: 'branch-then', text: window.Tk.t('น้ำหนัก') }), w);
          if (r.branches.length > 2) head.push(el('button', { class: 'btn btn-danger btn-sm icon-btn', type: 'button', title: window.Tk.t('ลบทางนี้'),
            onclick: function () { r.branches.splice(i, 1); draw(); } }, [window.Icon.el('trash', 13)]));
        }
        list.appendChild(el('div', { class: 'branch-item' }, [el('div', { class: 'branch-row' }, head), addRespSelect(b, sub, true), sub]));
        renderResponses(sub, b);
      });
    }
    wrap.appendChild(list);
    if (!isIf) wrap.appendChild(el('button', { class: 'btn btn-sm', type: 'button', onclick: function () { r.branches.push({ responses: [] }); draw(); } },
      [window.Icon.el('plus', 13), el('span', { text: window.Tk.t('เพิ่มทาง') })]));
    draw();
    return wrap;
  }

  // ---- สิ่งที่ทำหลังหน่วงเวลาครบ (ทางเดียว) — ขั้นอื่นในลิสต์เดียวกันไม่รอ ทำพร้อมกันไปเลย ----
  function delayBranch(r) {
    r.branches = [Array.isArray(r.branches) && r.branches[0] ? r.branches[0] : { responses: [] }];
    var b = r.branches[0];
    b.responses = Array.isArray(b.responses) ? b.responses : [];
    var sub = el('div', { class: 'resp-list sub' });
    var box = el('div', { class: 'branch-wrap' }, [el('div', { class: 'branch-list' }, [el('div', { class: 'branch-item' }, [
      el('div', { class: 'branch-row' }, [el('span', { class: 'branch-when', text: window.Tk.t('รอครบแล้วทำ') })]),
      addRespSelect(b, sub, true), sub])])]);
    renderResponses(sub, b);
    return box;
  }

  // ช่องเพิ่มการกระทำ — เดิมเป็นชิป 10 อันเรียงพันบรรทัด กินความสูงถาวรอีก ~90px
  // แยกเป็น "เลือก" กับ "กด เพิ่ม" สองจังหวะ ไม่เพิ่มทันทีที่ change
  // เพราะบน Windows การกดลูกศรบน select ที่ปิดอยู่จะยิง change ทุกก้าว = เพิ่มผิดชนิดรัวๆ
  function addRespSelect(holder, respList, compact) {
    var sel = el('select', { class: 'ed-add-sel', 'aria-label': window.Tk.t('+ เพิ่มการกระทำ') }, [
      el('option', { value: '', text: window.Tk.t('เลือกการกระทำ...') })
    ]);
    RESP_GROUPS.forEach(function (g) {
      var grp = el('optgroup', { label: window.Tk.t(g.label) });
      g.items.forEach(function (v) {
        var m = respMeta(v);
        grp.appendChild(el('option', { value: v, text: window.Tk.t(m.t), title: window.Tk.t(m.desc) }));
      });
      sel.appendChild(grp);
    });
    var go = el('button', { class: 'btn btn-sm ed-add-go', type: 'button' }, [
      window.Icon.el('plus', 13), el('span', { text: window.Tk.t('เพิ่ม') })
    ]);
    go.disabled = true;
    sel.addEventListener('change', function () {
      go.disabled = !sel.value;
      go.classList.toggle('is-ready', !!sel.value);
    });
    go.addEventListener('click', function () {
      if (!sel.value) return;
      var r = newResponse(sel.value);
      holder.responses.push(r);
      expanded.add(r);            // ที่เพิ่งเพิ่ม = กางไว้เสมอ ผู้ใช้กำลังจะกรอกมันพอดี
      renderResponses(respList, holder);
      sel.value = ''; go.disabled = true; go.classList.remove('is-ready');
      var items = respList.querySelectorAll('.resp-item');
      if (items.length) items[items.length - 1].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
    return el('div', { class: 'ed-add-row' + (compact ? ' compact' : '') }, [sel, go]);
  }

  // ---- Add Action Popup — เลือกชนิดจากตารางขวา ตั้งค่าฝั่งซ้าย แล้วกด "เพิ่ม" ----
  // เดิมช่อง "สิ่งที่จะทำ" เป็น dropdown + ปุ่มเพิ่ม แล้วเด้งการ์ดมากรอกในลิสต์เลย
  // ปัญหา: เห็นแค่ชื่อชนิดตอนเลือก ไม่เห็นว่าแต่ละอันทำอะไร และลิสต์ยาวขึ้นทุกครั้งที่กด
  // ป๊อปอัปนี้โชว์ทุกชนิดพร้อมคำอธิบาย เลือกแล้วตั้งค่าเสร็จในกล่องเดียว ค่อยกด "เพิ่ม"
  function openRespPicker(holder, onAdd) {
    var current = null;   // response ที่กำลังตั้งค่า — สร้างใหม่ทุกครั้งที่เลือกชนิด
    var m;
    var cfgCol = el('div', { class: 'rp-config' });
    var pickerCol = el('div', { class: 'rp-picker' });
    var addBtn = el('button', { class: 'btn btn-primary', type: 'button' }, [
      window.Icon.el('plus', 14), el('span', { text: window.Tk.t('เพิ่ม') })
    ]);
    addBtn.disabled = true;

    function selectType(type, cardEl) {
      current = newResponse(type);
      pickerCol.querySelectorAll('.rp-type.active').forEach(function (e) { e.classList.remove('active'); });
      if (cardEl) cardEl.classList.add('active');
      var meta = respMeta(type);
      cfgCol.innerHTML = '';
      cfgCol.appendChild(el('div', { class: 'rp-cfg-head' }, [
        el('span', { class: 'resp-ico' }, [window.Icon.el(meta.icon, 16)]),
        el('div', { class: 'rp-cfg-text' }, [
          el('div', { class: 'rp-cfg-name', text: window.Tk.t(meta.t) }),
          meta.desc ? el('div', { class: 'rp-cfg-desc muted small', text: window.Tk.t(meta.desc) }) : null
        ])
      ]));
      var fields = el('div', { class: 'resp-fields' });
      cfgCol.appendChild(fields);
      renderRespFields(fields, current);
      addBtn.disabled = false;
      addBtn.focus();
    }

    RESP_GROUPS.forEach(function (g) {
      pickerCol.appendChild(el('div', { class: 'rp-group-label', text: window.Tk.t(g.label) }));
      var grid = el('div', { class: 'rp-grid' });
      g.items.forEach(function (v) {
        var meta = respMeta(v);
        var card = el('button', { class: 'rp-type', type: 'button', title: window.Tk.t(meta.desc || '') }, [
          el('span', { class: 'rp-type-ico' }, [window.Icon.el(meta.icon, 18)]),
          el('span', { class: 'rp-type-name', text: window.Tk.t(meta.t) })
        ]);
        card.addEventListener('click', function () { selectType(v, card); });
        grid.appendChild(card);
      });
      pickerCol.appendChild(grid);
    });

    cfgCol.appendChild(el('div', { class: 'rp-cfg-empty muted' }, [
      window.Icon.el('actions', 26),
      el('p', { text: window.Tk.t('เลือกการกระทำจากด้านขวา แล้วตั้งค่าที่นี่') })
    ]));

    addBtn.addEventListener('click', function () {
      if (!current) return;
      holder.responses = Array.isArray(holder.responses) ? holder.responses : [];
      holder.responses.push(current);
      var added = current;
      m.close();
      if (onAdd) onAdd(added);
    });

    var body = el('div', { class: 'resp-picker' }, [
      el('h2', { text: window.Tk.t('เพิ่มการกระทำ') }),
      el('p', { class: 'muted small rp-sub', text: window.Tk.t('เลือกสิ่งที่จะให้เกิดขึ้น ตั้งค่าให้เรียบร้อย แล้วกด "เพิ่ม"') }),
      el('div', { class: 'rp-cols' }, [cfgCol, pickerCol]),
      el('div', { class: 'modal-foot' }, [
        el('button', { class: 'btn btn-ghost', type: 'button', text: window.Tk.t('ยกเลิก'), onclick: function () { m.close(); } }),
        addBtn
      ])
    ]);
    m = window.Tk.modal(body);
  }

  // ปุ่ม "เพิ่มการกระทำ" ของช่อง "สิ่งที่จะทำ" — เปิด popup แล้วเด้งการ์ดที่เพิ่งเพิ่มให้กางไว้
  function addLabel(holder) {
    return window.Tk.t((holder.responses || []).length ? 'เพิ่มการกระทำอีกอย่าง' : 'เพิ่มการกระทำ');
  }
  function addRespButton(holder, respList) {
    var label = el('span', { text: addLabel(holder) });
    var btn = el('button', { class: 'btn ed-add-btn', type: 'button' }, [window.Icon.el('plus', 15), label]);
    if (holder === topHolder) topAddLabel = label;
    btn.addEventListener('click', function () {
      openRespPicker(holder, function (added) {
        renderResponses(respList, holder);   // ใบใหม่พับเหมือนใบอื่น — ตั้งค่าเสร็จมาจากป๊อปอัปแล้ว
        var items = respList.querySelectorAll('.resp-item');
        if (items.length) items[items.length - 1].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
    });
    return btn;
  }

  // สรุปค่าที่ตั้งไว้จริงของการกระทำหนึ่งอัน — โชว์บนหัวการ์ดตอนพับ
  // ถ้าพับแล้วเห็นแค่ชื่อชนิด ("เล่นเสียง") ผู้ใช้ต้องกางทุกใบเพื่อนึกออกว่าตั้งอะไรไว้
  function respSummaryRaw(r) {
    var v = '';
    if (!r) return '';
    if (r.type === 'alert') v = (r.text || '') + (r.durationSec ? ' · ' + r.durationSec + 's' : '');
    else if (r.type === 'tts') v = r.text || '';
    else if (r.type === 'sound' || r.type === 'video') v = String(r.url || '').split(/[\\/]/).pop();
    else if (r.type === 'keypress') v = r.key ? [].concat(r.modifiers || [], [r.key]).join(' + ') : '';
    else if (r.type === 'obs') v = r.obsAction === 'toggleSource' ? (r.source || '') : (r.scene || '');
    // ยังไม่ใส่ URL = ยังใช้ไม่ได้ อย่าโชว์ "GET" ลอยๆ ให้ดูเหมือนตั้งเสร็จแล้ว
    else if (r.type === 'webhook') v = r.url ? (r.method || 'GET') + ' ' + r.url : '';
    else if (r.type === 'minecraft') v = r.command || '';
    else if (r.type === 'timer') v = (r.timerCmd || 'add') + (r.timerCmd !== 'reset' ? ' ' + (r.seconds != null ? r.seconds : 60) + 's' : '');
    else if (r.type === 'winCounter') v = (r.wcCmd || 'add') + (r.wcCmd !== 'reset' ? ' ' + (r.wcAmount != null ? r.wcAmount : 1) : '');
    else if (r.type === 'wheel' || r.type === 'randomWheel') {
      var n = (r.branches || []).length;
      v = n ? window.Tk.t('{n} กิ่ง', { n: n }) : '';
    }
    else if (r.type === 'delay') v = window.Tk.t('{n} วิ', { n: Math.round((Number(r.ms) || 0) / 100) / 10 });
    else if (r.type === 'random') v = window.Tk.t('{n} ทาง', { n: (r.branches || []).length });
    else if (r.type === 'if') v = condLabel(r.cond);
    v = String(v || '').trim();
    return v.length > 60 ? v.slice(0, 60) + '…' : v;
  }
  // ที่ใช้เดิมยังได้ข้อความสำรองเหมือนก่อน — หัวการ์ดใน editor ใช้ paintSum ซึ่งต้องรู้ว่าว่างจริงเพื่อทำตัวเอียง
  function respSummary(r) {
    return respSummaryRaw(r) || window.Tk.t('ยังไม่ได้ตั้งค่า');
  }

  // ตัวเลือกเหตุการณ์แบบดรอปดาวน์
  // เดิมเป็นการ์ด 10 ใบ 3 แถว กินความสูงถาวร ~200px ทั้งที่เลือกครั้งเดียวแล้วแทบไม่แตะอีก
  // (วัดจริง: กล่องเปิดใหม่สูง 859px แต่ที่มองเห็นได้แค่ 700px = ล้นตั้งแต่ยังไม่ทำอะไร)
  // ใช้ <select> ของระบบ ไม่ใช่ดรอปดาวน์ที่เขียนเอง — ได้คีย์บอร์ด/สกรีนรีดเดอร์/พิมพ์ค้นหาฟรี
  function triggerSelect(action, triggerFields, onPick) {
    var dot = el('span', { class: 'trig-dot' });
    var sel = el('select', { class: 'ed-pick', 'aria-label': window.Tk.t('เมื่อเกิดเหตุการณ์') });
    TRIG_GROUPS.forEach(function (g) {
      sel.appendChild(el('optgroup', { label: window.Tk.t(g.label) },
        opt(g.items.map(trigMeta), action.trigger.type)));
    });
    var descEl = el('p', { class: 'hint ed-pick-desc' });
    function paint() {
      var t = trigMeta(sel.value);
      dot.style.setProperty('--tc', t.color);
      descEl.textContent = window.Tk.t(t.desc);
    }
    sel.value = action.trigger.type;   // เซ็ตด้วย JS ไม่ยิง change
    paint();
    sel.addEventListener('change', function () {
      if (action.trigger.type === sel.value) return;
      action.trigger = { type: sel.value };
      // ทริกเกอร์ของขวัญอันใหม่ให้ติ๊ก "ทำซ้ำตามจำนวน" ไว้เลย เพราะเป็นพฤติกรรมที่คนคาดหวัง
      // (ของขวัญ x10 ควรทำงาน 10 ครั้ง) — ส่วน Action เก่าที่บันทึกไว้แล้วไม่ไปยุ่ง
      // ค่าจะยังเป็น undefined = ปิด เพื่อไม่เปลี่ยนพฤติกรรมของคนที่ตั้งไว้อยู่แล้วโดยไม่รู้ตัว
      if (sel.value === 'gift') action.trigger.repeatCombo = true;
      paint();
      renderTriggerFields(triggerFields, action.trigger);
      if (onPick) onPick(trigMeta(sel.value));
    });
    return el('div', {}, [el('div', { class: 'ed-pick-row' }, [dot, sel]), descEl]);
  }

  // หัวข้อขั้นตอน — extra = ของที่แปะท้ายหัวข้อ (ขั้น 2 ใช้แปะจำนวนการกระทำ)
  function secHead(num, title, hint, extra) {
    return el('div', { class: 'ed-sec-head' }, [
      el('span', { class: 'ed-sec-num', text: num }),
      el('span', { class: 'ed-sec-title', text: title }),
      hint ? el('span', { class: 'ed-sec-hint', text: hint }) : null,
      extra || null
    ]);
  }

  // หา response ที่ยังกรอกฟิลด์จำเป็นไม่ครบ — กัน Action ที่ "พัง" ตั้งแต่แรก (เช่น เสียงไม่มีไฟล์)
  function incompleteResponses(action) {
    var out = [];
    function walk(resps, where) {
      (resps || []).forEach(function (r) {
        if (!r) return;
        if (r.type === 'sound' && !String(r.url || '').trim()) out.push(window.Tk.t('เล่นเสียง') + where + window.Tk.t(' — ยังไม่ได้เลือกไฟล์เสียง'));
        if (r.type === 'video' && !String(r.url || '').trim()) out.push(window.Tk.t('เล่นวิดีโอ') + where + window.Tk.t(' — ยังไม่ได้เลือกไฟล์วิดีโอ'));
        else if (r.type === 'keypress' && !r.key) out.push(window.Tk.t('กดปุ่ม') + where + window.Tk.t(' — ยังไม่ได้ตั้งปุ่ม'));
        else if (r.type === 'webhook' && !String(r.url || '').trim()) out.push('Webhook' + where + window.Tk.t(' — ยังไม่ได้ใส่ URL'));
        else if (r.type === 'minecraft' && !String(r.command || '').trim()) out.push(window.Tk.t('สั่งคำสั่ง Minecraft') + where + window.Tk.t(' — ยังไม่ได้ใส่คำสั่ง'));
        if (Array.isArray(r.branches)) r.branches.forEach(function (b) { walk(b && b.responses, window.Tk.t(' (ในกิ่ง)')); });
      });
    }
    walk(action.responses, '');
    if (action.trigger && action.trigger.type === 'hotkey' && !action.trigger.accelerator) out.push(window.Tk.t('เหตุการณ์คีย์ลัด — ยังไม่ได้ตั้งคีย์'));
    return out;
  }

  function open(existing, onSave, opts) {
    var stepsOnly = !!(opts && opts.stepsOnly);   // โหนดที่ยังไม่ได้ต่อบนผืนโหนด: แก้แค่ขั้น ยังไม่มีเหตุการณ์
    var Tk = window.Tk;
    el = Tk.el; invoke = Tk.invoke; toast = Tk.toast; modal = Tk.modal;

    // clone เพื่อไม่แก้ของเดิมจนกว่าจะกดบันทึก
    var action = existing ? JSON.parse(JSON.stringify(existing)) : {
      id: 'a_' + Date.now().toString(36),
      name: '', enabled: true, cooldownSec: 0,
      trigger: { type: 'gift', giftName: '', minDiamonds: 0, repeatCombo: true },
      responses: [] // เริ่มว่าง — ให้ผู้ใช้เลือกการกระทำเองจากปุ่มด้านบน (ไม่ auto ใส่แจ้งเตือน)
    };
    if (!Array.isArray(action.responses)) action.responses = [];
    curTriggerType = action.trigger ? action.trigger.type : ''; // ให้ชิปตัวแปรกรองตามเหตุการณ์ปัจจุบัน

    topHolder = action;
    expanded = new WeakSet();
    seedExpanded(action.responses);
    countEl = el('span', { class: 'ed-count' });

    var nameInput = el('input', { type: 'text', value: action.name || '', placeholder: window.Tk.t('เช่น ขอบคุณคนให้กุหลาบ') });
    var triggerFields = el('div', { class: 'trig-fields' });
    if (!stepsOnly) renderTriggerFields(triggerFields, action.trigger);

    var cooldown = el('input', { type: 'number', min: '0', value: action.cooldownSec || 0 });
    var respList = el('div', { class: 'resp-list' });
    renderResponses(respList, action);

    var m;
    // snapshot ตอนเปิด — ไว้เทียบว่าผู้ใช้แก้อะไรไปแล้วหรือยัง (กันเผลอทิ้งงานที่ตั้งมาหลายนาที)
    function snapshot() { return JSON.stringify({ a: action, name: nameInput.value, cd: cooldown.value }); }
    var initialSnap;
    // ปิดกล่อง — ถ้ามีการแก้ค้างอยู่ต้องถามยืนยันก่อน (modal ตัวนี้ปิดฉากหลัง/Esc ไว้แล้วด้วย dismissible:false)
    function tryClose() {
      if (snapshot() === initialSnap) { m.close(); return; }
      Tk.confirmDialog(window.Tk.t('ทิ้งการแก้ไข Action นี้? สิ่งที่ตั้งไว้จะไม่ถูกบันทึก'), window.Tk.t('ทิ้งการแก้ไข'), { danger: true })
        .then(function (yes) { if (yes) m.close(); });
    }
    // แจ้งเตือนตรงในกล่อง — toast อยู่มุมจอ ไกลจากปุ่มที่เพิ่งกดจนผู้ใช้มองไม่เห็นว่าติดอะไร
    var edError = el('div', { class: 'ed-error', role: 'alert' });
    edError.hidden = true;
    // ขั้น 1 = สีน้ำเงิน (เงื่อนไข) · ขั้น 2 = สีเขียว (การกระทำ) — แต่ละขั้นเป็นกล่องมีพื้นของตัวเอง
    // เดิมทั้งสองขั้นใช้สีเดียวกันและไม่มีกรอบ ทุกอย่างลอยต่อกันจนแยกไม่ออกว่าอะไรอยู่ขั้นไหน
    var secWhen = stepsOnly ? null : el('section', { class: 'ed-sec sec-when' }, [
      secHead('1', window.Tk.t('เมื่อเกิดเหตุการณ์'), window.Tk.t('เลือกว่าให้ทำงานตอนไหน')),
      el('div', { class: 'ed-sec-body' }, [
        triggerSelect(action, triggerFields, function (t) {
          // ยังไม่ได้ตั้งชื่อเอง → เติมชื่ออัตโนมัติตามเหตุการณ์
          if (!nameInput.value.trim()) nameInput.placeholder = window.Tk.t(t.desc);
          // เปลี่ยนเหตุการณ์ → ชิปตัวแปรที่ใช้ได้เปลี่ยนตาม ต้อง render responses ใหม่
          curTriggerType = t.v;
          renderResponses(respList, action);
        }),
        triggerFields
      ])
    ]);
    var secDo = el('section', { class: 'ed-sec sec-do' }, [
      secHead(stepsOnly ? '1' : '2', window.Tk.t('สิ่งที่จะทำ'), window.Tk.t('ทุกอย่างทำพร้อมกัน · อยากให้ทำทีหลังใส่ "หน่วงเวลา"'), countEl),
      el('div', { class: 'ed-sec-body' }, [
        respList,
        addRespButton(action, respList)
      ])
    ]);

    var scroll = el('div', { class: 'ed-scroll' }, [
      el('div', { class: 'ed-head' }, [
        el('h2', { text: stepsOnly ? window.Tk.t('ตั้งค่าโหนดที่ยังไม่ได้ต่อ') : existing ? window.Tk.t('แก้ไข Action') : window.Tk.t('สร้าง Action ใหม่') }),
        stepsOnly ? null : el('div', { class: 'field ed-name-field' }, [
          el('label', { text: window.Tk.t('ชื่อ Action') }),
          nameInput
        ])
      ]),

      secWhen,
      // ลูกศรเชื่อมสองขั้น — สื่อว่าอ่านจากบนลงล่างเป็นประโยคเดียว "เมื่อ ... → ให้ ..."
      stepsOnly ? null : el('div', { class: 'ed-flow' }, [window.Icon.el('chevronRight', 12)]),
      secDo,

      stepsOnly ? null : el('div', { class: 'ed-options' }, [
        el('span', { class: 'ed-opt-label', text: window.Tk.t('คูลดาวน์') }),
        cooldown,
        el('span', { class: 'ed-opt-unit', text: window.Tk.t('วินาที (0 = ไม่จำกัด) — กันการยิงถี่เกินไป') })
      ]),

    ]);

    // แถบล่างอยู่นอกส่วนที่เลื่อน — ปุ่มบันทึก/ยกเลิกจึงอยู่ในสายตาเสมอ
    // เคยทำเป็น position:sticky อยู่ในกล่องที่เลื่อน แล้วมันไปทับแถวคูลดาวน์กับขอบล่าง
    // ของกล่องขั้น 2 จนดูเหมือน UI พัง (sticky ยึดกับขอบในของ padding ไม่ใช่ขอบกล่อง)
    var body = el('div', { class: 'action-editor' }, [
      scroll,
      el('div', { class: 'ed-foot' }, [
        edError,
        el('div', { class: 'modal-foot' }, [
        el('button', { class: 'btn btn-ghost', text: window.Tk.t('ยกเลิก'), type: 'button', onclick: function () { tryClose(); } }),
        el('button', { class: 'btn btn-primary', text: stepsOnly ? window.Tk.t('บันทึก') : existing ? window.Tk.t('บันทึกการแก้ไข') : window.Tk.t('สร้าง Action'), type: 'button', onclick: function () {
          if (!stepsOnly) {
            action.name = nameInput.value.trim() || window.Tk.t('Action ไม่มีชื่อ');
            action.cooldownSec = Number(cooldown.value) || 0;
          }
          edError.hidden = true;
          if (!action.responses.length) {
            edError.textContent = window.Tk.t('ต้องมีอย่างน้อย 1 การกระทำ — กดปุ่มในหัวข้อ "สิ่งที่จะทำ" ด้านบนเพื่อเพิ่มก่อน');
            edError.hidden = false;
            toast(window.Tk.t('ต้องมีอย่างน้อย 1 การกระทำ — กดปุ่มเพิ่มด้านบนก่อน'), 'err');
            return;
          }
          // ฟิลด์จำเป็นยังไม่ครบ = Action ทำงานไม่ได้จริง (เสียงไม่มีไฟล์/กดปุ่มไม่มีคีย์ ฯลฯ) — บอกให้ชัดก่อนบันทึก
          var missing = incompleteResponses(action);
          if (missing.length) {
            edError.textContent = window.Tk.t('ยังตั้งค่าไม่ครบ: ') + missing.join(' · ');
            edError.hidden = false;
            toast(window.Tk.t('ยังตั้งค่าไม่ครบ — ดูรายละเอียดในกล่อง'), 'err');
            return;
          }
          m.close();
          onSave(action);
        } })
        ])
      ])
    ]);
    // dismissible:false — คลิกฉากหลัง/Esc ไม่ปิดกล่องนี้ ป้องกันเผลอทิ้งงานที่แก้ค้างไว้ (ต้องกดยกเลิก/บันทึก)
    m = modal(body, { dismissible: false });
    m.box.classList.add('modal-ae');   // เฉพาะกล่องนี้ ไม่แตะ modal อื่นที่ใช้คลาส .modal ร่วมกัน
    initialSnap = snapshot();
  }

  return { open: open, invalidateGifts: invalidateGifts, newResponse: newResponse, condLabel: condLabel, COND_KINDS: COND_KINDS,
    RESP_TYPES: RESP_TYPES, RESP_GROUPS: RESP_GROUPS, TRIGGER_TYPES: TRIGGER_TYPES, TRIG_GROUPS: TRIG_GROUPS, RESP_COLOR: RESP_COLOR };
})();
