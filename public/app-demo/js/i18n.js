// ระบบ 2 ภาษา (ไทย/อังกฤษ) ของหน้า Dashboard
// -------------------------------------------------------------------
// แนวคิด: "คีย์คือข้อความไทยเดิม" — โค้ดส่วนใหญ่เขียนไทยอยู่แล้ว การแปลจึงเป็น
// การห่อข้อความไทยด้วย Tk.t('...') โดยไม่ต้องคิดคีย์ใหม่ และ dict.en.js เก็บคู่
// ไทย→อังกฤษ ถ้าโหมดเป็นไทย t() คืนคีย์ (ไทย) ตรงๆ ถ้าเป็นอังกฤษก็ค้นในตาราง
//   - ไม่พบคำแปล = คืนไทยไว้ก่อน (ยอมให้มีไทยตกค้างดีกว่าเห็นคีย์ดิบ/ค่าว่าง)
// การเลือกภาษา: settings.language = 'auto' | 'th' | 'en'
//   auto = ดูภาษาเครื่อง (osLocale จาก main) ขึ้นต้น 'th' → ไทย ไม่งั้นอังกฤษ
(function () {
  var EN = window.__I18N_EN || {};        // ตารางไทย→อังกฤษ (มาจาก dict.en.js)
  var locale = 'th';                        // ภาษาที่ใช้จริงตอนนี้ (th | en)
  var listeners = [];

  // แทนค่าตัวแปรในสตริง: t('เหลือ {n} วัน', {n: 3}) → 'เหลือ 3 วัน'
  function interp(s, vars) {
    if (!vars) return s;
    return s.replace(/\{(\w+)\}/g, function (m, k) {
      return Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m;
    });
  }

  // แปลข้อความ — key เป็นข้อความไทย (ต้นฉบับ)
  function t(key, vars) {
    if (key == null) return '';
    var s = key;
    if (locale === 'en') {
      var hit = Object.prototype.hasOwnProperty.call(EN, key) ? EN[key] : null;
      if (hit != null) s = hit;
    }
    return interp(s, vars);
  }

  // ตัดสินภาษาจากค่าตั้งค่า + ภาษาเครื่อง
  function resolve(langSetting, osLocale) {
    if (langSetting === 'th' || langSetting === 'en') return langSetting;
    // auto (หรือค่าที่ไม่รู้จัก) → ตามเครื่อง ไม่ใช่ไทย = อังกฤษ
    return String(osLocale || 'en').toLowerCase().indexOf('th') === 0 ? 'th' : 'en';
  }

  // ตั้งภาษาแล้วทาที่ DOM ทั้งหน้า + แจ้งผู้ที่ subscribe ไว้ (เช่นให้ re-render ส่วน dynamic)
  function setLocale(langSetting, osLocale) {
    var next = resolve(langSetting, osLocale);
    locale = next;
    try { document.documentElement.setAttribute('lang', next); } catch (_) {}
    applyDom(document);
    listeners.forEach(function (fn) { try { fn(next); } catch (_) {} });
    return next;
  }

  // ทาคำแปลลง element ที่ mark ไว้:
  //   data-i18n       → textContent
  //   data-i18n-html  → innerHTML (ใช้เฉพาะข้อความที่เรารู้ว่าปลอดภัย มี markup คงที่)
  //   data-i18n-ph    → placeholder
  //   data-i18n-title → title (tooltip)
  //   data-i18n-aria  → aria-label
  // ตั้งข้อความโดย "ไม่ลบ element ลูก" (เช่นไอคอนที่ถูก inject ไว้เป็น child ตัวแรก)
  // ถ้าใช้ textContent ตรงๆ จะล้างลูกทั้งหมดรวมไอคอน — เมนูเลยไอคอนหายตอนสลับภาษา
  // วิธี: อัปเดตเฉพาะ text node ตัวท้าย (ข้อความอยู่หลังไอคอน) ถ้าไม่มีก็เพิ่มใหม่ต่อท้าย
  function setText(elx, str) {
    var last = null;
    for (var j = elx.childNodes.length - 1; j >= 0; j--) {
      if (elx.childNodes[j].nodeType === 3) { last = elx.childNodes[j]; break; }
    }
    if (last) last.nodeValue = str;
    else elx.appendChild(document.createTextNode(str));
  }

  function applyDom(root) {
    if (!root || !root.querySelectorAll) return;
    var all = root.querySelectorAll('[data-i18n],[data-i18n-html],[data-i18n-ph],[data-i18n-title],[data-i18n-aria]');
    for (var i = 0; i < all.length; i++) {
      var elx = all[i], k;
      if ((k = elx.getAttribute('data-i18n')) != null) setText(elx, t(k));
      if ((k = elx.getAttribute('data-i18n-html')) != null) elx.innerHTML = t(k);
      if ((k = elx.getAttribute('data-i18n-ph')) != null) elx.setAttribute('placeholder', t(k));
      if ((k = elx.getAttribute('data-i18n-title')) != null) elx.setAttribute('title', t(k));
      if ((k = elx.getAttribute('data-i18n-aria')) != null) elx.setAttribute('aria-label', t(k));
    }
  }

  function onChange(fn) { if (typeof fn === 'function') listeners.push(fn); }
  function current() { return locale; }

  window.Tk = window.Tk || {};
  window.Tk.t = t;
  window.Tk.i18n = { setLocale: setLocale, applyDom: applyDom, onChange: onChange, current: current, resolve: resolve };
})();
