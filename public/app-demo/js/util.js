// Tikkies Tools Dashboard — utilities (โหลดก่อน app.js)
// เปิดผ่าน file:// จึงใช้ตัวแปร global แทน ES modules
window.Tk = (function () {
  var tikkies = window.tikkies; // จาก preload.js

  // เรียกคำสั่งไปยัง main process พร้อมจัดการ error เป็น toast อัตโนมัติ
  async function invoke(cmd, payload, opts) {
    try {
      return await tikkies.invoke(cmd, payload);
    } catch (err) {
      var msg = (err && err.message) ? err.message : String(err);
      if (!opts || opts.toast !== false) toast(msg, 'err');
      throw err;
    }
  }

  function onEvent(cb) { return tikkies.onEvent(cb); }

  // ---- DOM helpers ----
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (k.indexOf('on') === 0 && typeof attrs[k] === 'function') e.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
      // textarea ไม่มี attribute 'value' — setAttribute จึงเงียบหายไป ช่องโผล่มาว่างทั้งที่มีค่าเก็บไว้จริง
      // (เจอกับช่อง Body ของ webhook: ตั้งไว้แล้วกลับมาแก้ไข เห็นว่าง เลยพิมพ์ใหม่ซ้ำ)
      else if (k === 'value' && e.tagName === 'TEXTAREA') e.value = attrs[k] == null ? '' : attrs[k];
      else if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function formatNumber(n) {
    n = Number(n) || 0;
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(n);
  }

  function fillTemplate(tpl, data) {
    return String(tpl || '').replace(/\{(\w+)\}/g, function (_, k) { return data && data[k] != null ? data[k] : ''; });
  }

  // สีวงกลม fallback จาก id (ใช้ตอนไม่มีรูปโปรไฟล์)
  function colorFor(id) {
    var h = 0, s = String(id || '?');
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
    return 'hsl(' + h + ', 55%, 45%)';
  }

  // สร้าง element avatar (รูป หรือ วงกลมสี+อักษรแรก)
  function avatar(cls, user) {
    var a = el('div', { class: cls });
    if (user && user.profilePictureUrl) {
      a.style.backgroundImage = 'url(' + JSON.stringify(user.profilePictureUrl) + ')';
    } else {
      a.style.backgroundColor = colorFor(user && user.uniqueId);
      a.textContent = ((user && (user.nickname || user.uniqueId) || '?').trim().charAt(0) || '?');
    }
    return a;
  }

  function timeStr(ts) {
    var d = ts ? new Date(ts) : new Date();
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  // ---- Toast ----
  function toast(msg, kind, ms) {
    var host = $('#toastHost');
    var t = el('div', { class: 'toast ' + (kind || ''), text: msg });
    host.appendChild(t);
    setTimeout(function () {
      t.style.transition = 'opacity 0.3s';
      t.style.opacity = '0';
      setTimeout(function () { t.remove(); }, 300);
    }, ms || 2600);
  }

  // ---- Modal ----
  // opts.onClose = เรียกเมื่อปิดด้วยวิธีใดก็ตาม (Esc / คลิกพื้นหลัง / ปุ่มปิด)
  // opts.dismissible = false → ห้ามปิดด้วย Esc/คลิกฉากหลัง (ใช้กับฟอร์มที่แก้ค้างอยู่ กันเผลอทิ้งงาน)
  // modalStack = กล่องที่เปิดซ้อนกันอยู่ ตัวท้ายสุด = ตัวบนสุดที่ผู้ใช้กำลังใช้งาน
  // เดิมล้าง host ทิ้งทุกครั้งที่เปิด กล่องที่เปิดค้างอยู่จึงหลุดจอไปเงียบๆ โดยไม่ได้ close() ตัวเอง
  // ผล: onClose ไม่ทำงาน + keydown listener ค้างถาวรทีละตัว (Esc ครั้งหลังไปปิด modal ที่ไม่เกี่ยวข้อง)
  // เห็นชัดตอนกดลบชุด Actions — กล่องยืนยันเปิดทับ แล้วหน้า "จัดการชุด" หายไปทั้งใบ
  var modalStack = [];
  function modal(node, opts) {
    var host = $('#modalHost');
    var prevFocus = document.activeElement; // ไว้คืนโฟกัสให้ปุ่มที่กดเปิด
    var below = modalStack[modalStack.length - 1];
    if (below) below.box.hidden = true;  // ซ่อนตัวล่างไว้ก่อน แต่ไม่ทำลาย — ปิดตัวบนแล้วต้องได้กลับมาเหมือนเดิม
    else { host.innerHTML = ''; host.classList.remove('has-iframe'); } // กันคลาส/เศษ DOM จากหน้าแต่งธีมค้างมาถึง modal ปกติ
    var box = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', tabindex: '-1' });
    box.appendChild(node);
    host.appendChild(box);
    host.hidden = false;
    var inst = { close: close, box: box };
    modalStack.push(inst);
    function isTop() { return modalStack[modalStack.length - 1] === inst; }

    var SEL = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),' +
      'textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
    function focusables() {
      return $$(SEL, box).filter(function (e) { return e.offsetParent !== null; });
    }

    var dismissible = !(opts && opts.dismissible === false);
    function onKey(e) {
      if (!isTop()) return; // มีกล่องซ้อนอยู่ข้างบน — ปล่อยให้ตัวบนสุดจัดการคีย์แทน
      if (e.key === 'Escape') { if (dismissible) { e.stopPropagation(); close(); } return; }
      if (e.key !== 'Tab') return;
      // ขังโฟกัสไว้ใน modal — ไม่ให้ Tab หลุดไปโดนของที่อยู่หลังฉากบัง
      var f = focusables();
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    function onBg(e) { if (dismissible && e.target === host && isTop()) close(); }
    host.addEventListener('mousedown', onBg);
    document.addEventListener('keydown', onKey, true);
    setTimeout(function () { var f = focusables(); (f[0] || box).focus(); }, 0);

    var closed = false;
    function close() {
      if (closed) return;
      closed = true;
      var i = modalStack.indexOf(inst);
      if (i >= 0) modalStack.splice(i, 1);
      box.remove();  // ลบเฉพาะกล่องของตัวเอง — ตัวที่ซ้อนอยู่ข้างล่างต้องรอด
      host.removeEventListener('mousedown', onBg);
      document.removeEventListener('keydown', onKey, true);
      var back = modalStack[modalStack.length - 1];
      if (back) back.box.hidden = false;
      else { host.hidden = true; host.innerHTML = ''; }
      try { if (prevFocus && prevFocus.focus) prevFocus.focus(); } catch (_) {}
      if (opts && opts.onClose) opts.onClose();
    }
    return inst;
  }

  // confirm แบบ custom (แทน window.confirm ที่ Electron ไม่แนะนำ)
  // opts.danger = true → ปุ่มยืนยันเป็นสีอันตราย (ใช้กับการลบ/ถอนสิทธิ์)
  function confirmDialog(message, okText, opts) {
    return new Promise(function (resolve) {
      var m, done = false;
      function finish(v) { if (done) return; done = true; resolve(v); }
      var body = el('div', {}, [
        el('h2', { text: (opts && opts.title) || 'ยืนยัน' }),
        el('p', { class: 'muted', text: message }),
        el('div', { class: 'modal-foot' }, [
          el('button', { class: 'btn btn-ghost', text: 'ยกเลิก', onclick: function () { m.close(); } }),
          el('button', {
            class: 'btn ' + (opts && opts.danger ? 'btn-danger-solid' : 'btn-primary'),
            text: okText || 'ตกลง',
            onclick: function () { finish(true); m.close(); }
          })
        ])
      ]);
      // ปิดด้วย Esc / คลิกพื้นหลัง = ยกเลิก (เดิมค้างเป็น promise ที่ไม่มีวัน resolve)
      m = modal(body, { onClose: function () { finish(false); } });
    });
  }

  // ย้ายสมาชิกใน array ไปตำแหน่งใหม่ — คืน array ใหม่เสมอ ไม่แก้ของเดิม
  // ย้ายไม่ได้ (index เพี้ยน/ที่เดิม) คืน "ตัวเดิม" กลับไป คนเรียกจึงเช็คด้วย !== ได้ว่ามีอะไรเปลี่ยนจริงไหม
  // ก่อนจะไปเขียนลงดิสก์
  function moveItem(list, from, to) {
    var arr = Array.isArray(list) ? list : [];
    from = Number(from); to = Number(to);
    if (!(from >= 0 && from < arr.length) || !(to >= 0 && to < arr.length) || from === to) return list;
    var out = arr.slice();
    out.splice(to, 0, out.splice(from, 1)[0]);
    return out;
  }

  // เรียง array ใหม่ตามลำดับ id ที่ส่งมา (ใช้ตอนลากสลับการ์ดเสร็จ — อ่านลำดับจริงจาก DOM แล้วแมปกลับเป็นข้อมูล)
  // เงื่อนไขเข้ม: ids ต้องครบทุกตัวและไม่ซ้ำ ไม่งั้นคืนตัวเดิม — กันเขียนทับรายการทิ้งเพราะ DOM ไม่ตรง
  function reorderByIds(list, ids, key) {
    var arr = Array.isArray(list) ? list : [];
    key = key || 'id';
    if (!Array.isArray(ids) || ids.length !== arr.length) return list;
    var byId = {}, i;
    for (i = 0; i < arr.length; i++) {
      var k = arr[i] && String(arr[i][key]);
      if (!k || Object.prototype.hasOwnProperty.call(byId, k)) return list;   // ไม่มี id หรือ id ซ้ำ = แมปไม่ได้
      byId[k] = arr[i];
    }
    var out = [], seen = {};
    for (i = 0; i < ids.length; i++) {
      var id = String(ids[i]);
      if (!Object.prototype.hasOwnProperty.call(byId, id) || seen[id]) return list;
      seen[id] = 1;
      out.push(byId[id]);
    }
    for (i = 0; i < out.length; i++) if (out[i] !== arr[i]) return out;
    return list;   // ลำดับเหมือนเดิม — คืนตัวเดิมเพื่อไม่ให้คนเรียกเขียนดิสก์ฟรีๆ
  }

  // เลือกภาษาของเสียงอ่านจาก "ตัวอักษรที่อยู่ในข้อความ" จริงๆ
  //   1. มีอักษรไทย → ไทย (ปนอังกฤษด้วยก็ยังไทย — ประโยคไทยที่แทรกศัพท์อังกฤษ อ่านด้วยเสียงไทยฟังรู้เรื่องกว่า)
  //   2. ไม่มีไทย แต่มีอักษรละติน → อังกฤษ
  //   3. ไม่มีทั้งคู่ (ตัวเลข/สัญลักษณ์ล้วน เช่น "5555" "!!!" "^^") → ใช้ภาษาที่ผู้ใช้ตั้งไว้ในโปรแกรม
  // ข้อ 3 คือจุดที่เคยเป็นบั๊ก: เดิมข้อความที่ไม่มีอักษรไทยถูกส่งเป็นอังกฤษหมด
  // "5555" จึงอ่านเป็นอังกฤษ แต่ "ใช่ 5555" อ่านเป็นไทย — เลขชุดเดียวกันออกเสียงคนละภาษา
  // แล้วแต่ว่าบังเอิญมีคำไทยอยู่ในประโยคด้วยไหม
  function ttsLang(text, appLang) {
    var t = String(text == null ? '' : text);
    if (/[\u0E00-\u0E7F]/.test(t)) return 'th';
    if (/[A-Za-z]/.test(t)) return 'en';
    return appLang === 'en' ? 'en' : 'th';
  }

  return {
    invoke: invoke, onEvent: onEvent, moveItem: moveItem, reorderByIds: reorderByIds, ttsLang: ttsLang,
    $: $, $$: $$, el: el, escapeHtml: escapeHtml, formatNumber: formatNumber,
    fillTemplate: fillTemplate, colorFor: colorFor, avatar: avatar, timeStr: timeStr,
    toast: toast, modal: modal, confirmDialog: confirmDialog
  };
})();
