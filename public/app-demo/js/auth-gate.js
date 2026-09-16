// Tikkies Tools — บัญชีและสมาชิก
//  1) ด่านเข้าใช้งาน (overlay): เข้าสู่ระบบ → ตรวจสิทธิ์สมาชิก → ปล่อยเข้าแอป
//  2) แท็บ "บัญชี": สถานะสมาชิก · บัญชีที่ใช้ · เครื่องที่ผูกไว้
// ภาษาออกแบบ: เดียวกับแผงควบคุมของแอป — เส้นบาง ป้ายกำกับตัวเล็ก สถานะอ่านออกทันที
(function () {
  var Tk = window.Tk;
  var el = Tk.el, invoke = Tk.invoke;

  // ที่อยู่เว็บขายมาจาก server (publicState().siteUrl) — ไม่มีค่าสำรอง เพราะเดาผิดแล้วพาไปผิดเว็บ
  function billingUrl() {
    var base = current && current.siteUrl;
    return base ? base + '/billing' : null;
  }

  // ตราสัญลักษณ์จริงของผู้ให้บริการ (ไม่ใช้อิโมจิ) — inline SVG ตามสีแบรนด์
  var MARK = {
    google:
      '<svg class="auth-provider-mark" viewBox="0 0 48 48" aria-hidden="true">' +
      '<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>' +
      '<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>' +
      '<path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>' +
      '<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>',
    discord:
      '<svg class="auth-provider-mark" viewBox="0 0 127.14 96.36" aria-hidden="true">' +
      '<path fill="#5865F2" d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.37 0 0 0 45.64 0a105.89 105.89 0 0 0-26.25 8.09C2.79 32.65-1.71 56.6.54 80.21a105.73 105.73 0 0 0 32.17 16.15 77.7 77.7 0 0 0 6.89-11.11 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2a75.57 75.57 0 0 0 64.32 0c.87.71 1.76 1.39 2.66 2a68.68 68.68 0 0 1-10.87 5.19 77 77 0 0 0 6.89 11.1 105.25 105.25 0 0 0 32.19-16.14c2.64-27.38-4.51-51.11-18.9-72.15zM42.45 65.69C36.18 65.69 31 60 31 53s5-12.74 11.43-12.74S54 46 53.89 53s-5.05 12.69-11.44 12.69zm42.24 0C78.41 65.69 73.25 60 73.25 53s5-12.74 11.44-12.74S96.23 46 96.12 53s-5.04 12.69-11.43 12.69z"/></svg>'
  };

  var overlay = null;     // ชั้นบังหน้าจอ
  var current = null;     // สถานะบัญชีล่าสุด
  var overlayMode = null, lastLogin = null;   // แผงที่โชว์อยู่ ('login' | 'busy' | 'wall') ไว้วาดใหม่ตอนสลับภาษา
  var busy = false;
  var pendingLimit = null; // ข้อมูลตอนเกินโควตาเครื่อง

  function icon(name, size) { return window.Icon ? window.Icon.el(name, size || 16) : el('span'); }

  // ---------- ตัวช่วยจัดรูปข้อมูล ----------
  // locale สำหรับวันที่/ตัวเลข ตามภาษาที่ผู้ใช้ตั้ง (ไทย = พ.ศ. + ชื่อเดือนไทย, อังกฤษ = ค.ศ.)
  function loc() { return (Tk.i18n && Tk.i18n.current && Tk.i18n.current() === 'en') ? 'en-GB' : 'th-TH'; }
  function fmtDate(d) {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString(loc(), { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch (e) { return '—'; }
  }
  function fmtDateTime(d) {
    if (!d) return '—';
    try { return new Date(d).toLocaleString(loc(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return '—'; }
  }
  function daysLeft(sub) {
    if (!sub || !sub.currentPeriodEnd) return null;
    var ms = new Date(sub.currentPeriodEnd).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / 86400000));
  }
  var PLATFORM_LABEL = { win32: 'Windows', darwin: 'macOS', linux: 'Linux' };
  function platformName(p) { return PLATFORM_LABEL[p] || p || Tk.t('ไม่ทราบระบบ'); }

  // แปลงสถานะสมาชิกเป็นคำ + โทนสี (ใช้ร่วมกันทั้งกำแพงและแท็บ)
  function licMeta(sub) {
    var s = sub || {};
    var left = daysLeft(s);
    if (s.active) {
      if (left !== null && left <= 7) return { cls: 'is-warn', state: Tk.t('ใกล้หมดอายุ'), dot: '' };
      return { cls: 'is-active', state: Tk.t('สมาชิกใช้งานได้'), dot: 'connected' };
    }
    if (s.status === 'expired') return { cls: 'is-warn', state: Tk.t('หมดอายุแล้ว'), dot: '' };
    if (s.status === 'canceled') return { cls: 'is-warn', state: Tk.t('ยกเลิกแล้ว'), dot: '' };
    return { cls: 'is-off', state: Tk.t('ยังไม่ได้สมัคร'), dot: 'disconnected' };
  }

  // สาเหตุที่ถูกกั้น — main process เป็นคนตัดสิน (auth.js entitlement())
  // ต้องแยกให้ชัดว่า "ยังไม่ได้จ่าย" กับ "จ่ายแล้วแต่ต้องต่อเน็ตให้ระบบตรวจ" คนละเรื่องกัน
  // ไม่งั้นคนที่จ่ายเงินมาแล้วเน็ตล่มจะเห็นคำว่า "สมัครสมาชิก" แล้วนึกว่าเงินหาย
  var BLOCK_NOTE = {
    stale: 'ยังไม่ได้เชื่อมต่อกับระบบมานานเกิน 7 วัน — ต่ออินเทอร์เน็ตแล้วกด "ตรวจสอบสถานะอีกครั้ง" เพื่อใช้งานต่อ',
    clock: 'นาฬิกาของเครื่องไม่ตรงกับความจริง — ตั้งวันที่/เวลาให้ถูกต้อง แล้วกด "ตรวจสอบสถานะอีกครั้ง"',
    expired: 'สมาชิกหมดอายุแล้ว — ต่ออายุเพื่อใช้งานต่อ',
    never_verified: 'ยังตรวจสอบสิทธิ์กับระบบไม่สำเร็จ — ต่ออินเทอร์เน็ตแล้วลองอีกครั้ง'
  };
  // BLOCK_NOTE ข้างบนเก็บ "คีย์ไทย" ไว้ ตอนนำไปแสดงค่อยแปลผ่าน Tk.t()

  // แถบสถานะสมาชิก — ใช้ซ้ำได้ทั้งในกำแพงและในแท็บ
  function licenseStrip(sub) {
    var s = sub || {};
    var m = licMeta(s);
    var left = daysLeft(s);
    var box = el('div', { class: 'lic ' + m.cls });

    box.appendChild(el('div', { class: 'lic-top' }, [
      el('div', { class: 'lic-state', text: m.state }),
      el('div', { class: 'lic-plan', text: s.plan || (s.active ? Tk.t('สมาชิก') : Tk.t('ไม่มีแพ็กเกจ')) })
    ]));

    // มิเตอร์วันคงเหลือ (แสดงเฉพาะตอนมีรอบสมาชิกจริง)
    if (s.active && left !== null) {
      var pct = Math.max(3, Math.min(100, Math.round((left / 30) * 100)));
      var meter = el('div', { class: 'lic-meter' });
      meter.appendChild(el('span', { style: 'width:' + pct + '%' }));
      box.appendChild(meter);
    }

    var rows = el('dl', { class: 'lic-rows' });
    function row(k, v) {
      rows.appendChild(el('div', { class: 'lic-row' }, [
        el('dt', { text: k }), el('dd', { text: v })
      ]));
    }
    if (s.active) {
      if (s.currentPeriodEnd) row(Tk.t('ใช้ได้ถึง'), fmtDate(s.currentPeriodEnd));
      if (left !== null) row(Tk.t('คงเหลือ'), Tk.t('{n} วัน', { n: left.toLocaleString(loc()) }));
    } else if (s.currentPeriodEnd) {
      // หมดอายุ/ยกเลิก — บอกวันที่สิ้นสุดจริง (มีประโยชน์กว่าย้ำคำสถานะ)
      row(Tk.t('สิ้นสุดเมื่อ'), fmtDate(s.currentPeriodEnd));
    }
    if (rows.children.length) box.appendChild(rows);
    return box;
  }

  // ---------- โครงแผง (overlay) ----------
  function ensureOverlay() {
    if (!overlay) {
      overlay = el('div', { class: 'auth-overlay', id: 'authOverlay' });
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = '';
    overlay.classList.remove('hidden');
    return overlay;
  }
  function hideOverlay() { overlayMode = null; if (overlay) overlay.classList.add('hidden'); }

  // หัวแผงแบบอัตลักษณ์ผลิตภัณฑ์ (ตอนยังไม่รู้ว่าใคร)
  function headProduct(stateText, dotCls) {
    return el('div', { class: 'auth-head' }, [
      el('div', { class: 'auth-head-mark' }, [icon('gift', 16)]),
      el('div', { class: 'auth-head-id' }, [
        el('div', { class: 'auth-head-name', text: 'Tikkies Tools' }),
        el('div', { class: 'auth-head-sub', text: Tk.t('เครื่องมือโต้ตอบ TikTok LIVE') })
      ]),
      el('div', { class: 'auth-head-state' }, [
        el('span', { class: 'dot ' + (dotCls || '') }),
        el('span', { text: stateText || '' })
      ])
    ]);
  }

  // หัวแผงแบบระบุตัวผู้ใช้ (หลังเข้าสู่ระบบแล้ว)
  function headUser(user, stateText, dotCls) {
    var u = user || {};
    return el('div', { class: 'auth-head' }, [
      avatarEl(u, 30),
      el('div', { class: 'auth-head-id' }, [
        el('div', { class: 'auth-head-name', text: u.displayName || Tk.t('บัญชีของฉัน') }),
        el('div', { class: 'auth-head-sub', text: u.email || '' })
      ]),
      el('div', { class: 'auth-head-state' }, [
        el('span', { class: 'dot ' + (dotCls || '') }),
        el('span', { text: stateText || '' })
      ])
    ]);
  }

  function avatarEl(u, size) {
    var px = size || 42;
    if (u && u.avatarUrl) {
      return el('img', { class: 'acct-avatar', src: u.avatarUrl, alt: '', style: 'width:' + px + 'px;height:' + px + 'px' });
    }
    var letter = ((u && (u.displayName || u.email)) || 'U').slice(0, 1).toUpperCase();
    return el('div', {
      class: 'acct-avatar acct-avatar-ph',
      text: letter,
      style: 'width:' + px + 'px;height:' + px + 'px;font-size:' + Math.round(px * 0.38) + 'px'
    });
  }

  // ---------- หน้าจอ: เข้าสู่ระบบ ----------
  function showLogin(msg, isErr) {
    overlayMode = 'login'; lastLogin = [msg, isErr];
    var o = ensureOverlay();
    var body = el('div', { class: 'auth-body' });
    body.appendChild(el('div', { class: 'auth-label', text: Tk.t('เข้าสู่ระบบด้วยบัญชี') }));

    [
      { id: 'google', name: 'Google' },
      { id: 'discord', name: 'Discord' }
    ].forEach(function (p) {
      var btn = el('button', { type: 'button', class: 'auth-provider' }, [
        el('span', { class: 'auth-provider-markwrap', html: MARK[p.id] }),
        el('span', { text: Tk.t('ดำเนินการต่อด้วย {provider}', { provider: p.name }) }),
        el('span', { class: 'auth-provider-cta' }, [icon('external', 14)])
      ]);
      btn.addEventListener('click', function () { doLogin(p.id); });
      body.appendChild(btn);
    });

    if (msg) body.appendChild(el('div', { class: 'auth-msg' + (isErr ? ' err' : ''), text: msg }));

    o.appendChild(el('div', { class: 'auth-panel' }, [
      headProduct(Tk.t('ยังไม่ได้เข้าสู่ระบบ'), 'disconnected'),
      body,
      el('div', { class: 'auth-foot' }, [
        el('div', {
          class: 'auth-foot-note',
          text: Tk.t('ระบบจะเปิดเบราว์เซอร์เพื่อยืนยันตัวตน แล้วกลับมาที่แอปอัตโนมัติ — โปรแกรมไม่เห็นรหัสผ่านของคุณ')
        })
      ])
    ]));
  }

  // ---------- หน้าจอ: กำลังดำเนินการ ----------
  function showBusy(text) {
    overlayMode = 'busy';
    var o = ensureOverlay();
    o.appendChild(el('div', { class: 'auth-panel' }, [
      headProduct(Tk.t('กำลังดำเนินการ'), ''),
      el('div', { class: 'auth-body' }, [
        el('div', { class: 'auth-wait' }, [
          el('div', { class: 'auth-spinner' }),
          el('div', { class: 'auth-wait-text', text: text || Tk.t('กรุณารอสักครู่') })
        ])
      ])
    ]));
  }

  // ---------- หน้าจอ: ยังไม่ได้เป็นสมาชิก ----------
  function showWall(st) {
    overlayMode = 'wall';
    var s = st || {};
    var sub = s.subscription || {};
    var m = licMeta(sub);
    var o = ensureOverlay();

    var body = el('div', { class: 'auth-body' });
    body.appendChild(el('div', { class: 'auth-label', text: Tk.t('สถานะสมาชิก') }));
    body.appendChild(licenseStrip(sub));

    var note = BLOCK_NOTE[(s.entitlement && s.entitlement.reason) || ''];
    if (note) body.appendChild(el('p', { class: 'auth-msg', style: 'margin-top:0', text: Tk.t(note) }));

    var actions = el('div', { class: 'acct-actions' });
    var payBtn = el('button', { type: 'button', class: 'btn btn-primary' }, [
      icon('external', 14),
      el('span', { text: sub.status === 'none' ? Tk.t('สมัครสมาชิก') : Tk.t('ต่ออายุสมาชิก') })
    ]);
    payBtn.addEventListener('click', function () { openBilling(); });

    var recheck = el('button', { type: 'button', class: 'btn' }, [
      icon('refresh', 14), el('span', { text: Tk.t('ตรวจสอบสถานะอีกครั้ง') })
    ]);
    var recheckMsg = el('p', { class: 'auth-msg err', style: 'margin:8px 0 0' });
    recheckMsg.hidden = true;
    recheck.addEventListener('click', function () {
      recheck.disabled = true;
      recheckMsg.hidden = true;
      refreshFromServer().then(function (res) {
        recheck.disabled = false;
        if (res.active) return; // ผ่านแล้ว — gate() ซ่อนกำแพงให้เอง
        recheckMsg.textContent = Tk.t(RECHECK_MSG[res.reason] || 'ตรวจสอบสถานะไม่สำเร็จ — ลองอีกครั้ง');
        recheckMsg.hidden = false;
      });
    });
    actions.appendChild(payBtn);
    actions.appendChild(recheck);
    body.appendChild(actions);
    body.appendChild(recheckMsg);

    var out = el('button', { type: 'button', class: 'auth-linkbtn', text: Tk.t('ออกจากระบบ') });
    out.addEventListener('click', doLogout);

    o.appendChild(el('div', { class: 'auth-panel' }, [
      headUser(s.user, m.state, m.dot),
      body,
      el('div', { class: 'auth-foot' }, [
        el('div', { class: 'auth-foot-note', text: Tk.t('ชำระเงินบนเว็บแล้วกด "ตรวจสอบสถานะอีกครั้ง" เพื่อเริ่มใช้งานได้ทันที') }),
        el('div', { style: 'margin-top:7px' }, [out])
      ])
    ]));
  }

  // ---------- หน้าจอ: เครื่องเกินโควตา ----------
  function showDeviceLimit(data) {
    pendingLimit = data;
    var o = ensureOverlay();
    var body = el('div', { class: 'auth-body' });
    body.appendChild(el('div', { class: 'auth-label', text: Tk.t('เลือกเครื่องที่จะออกจากระบบ') }));
    body.appendChild(el('p', {
      class: 'auth-msg',
      style: 'margin-top:0',
      text: Tk.t('บัญชีนี้ใช้ได้สูงสุด {max} เครื่อง — ปลดเครื่องเดิมออกหนึ่งเครื่องเพื่อใช้เครื่องนี้แทน', { max: data.max || '—' })
    }));
    body.appendChild(deviceList(data.devices || [], {
      actionLabel: Tk.t('ปลดเครื่องนี้'),
      onAction: function (d, btn) {
        btn.disabled = true;
        showBusy(Tk.t('กำลังสลับเครื่อง...'));
        invoke('auth:replaceDevice', { deviceId: d.id }, { toast: false })
          .then(handleResult)
          .catch(function () { showLogin(Tk.t('สลับเครื่องไม่สำเร็จ ลองใหม่อีกครั้ง'), true); });
      }
    }));

    var back = el('button', { type: 'button', class: 'auth-linkbtn', text: Tk.t('ยกเลิก แล้วกลับไปหน้าเข้าสู่ระบบ') });
    back.addEventListener('click', function () { pendingLimit = null; showLogin(); });

    o.appendChild(el('div', { class: 'auth-panel auth-panel-wide' }, [
      headProduct(Tk.t('เกินจำนวนเครื่อง'), ''),
      body,
      el('div', { class: 'auth-foot' }, [back])
    ]));
  }

  // ---------- รายการเครื่อง (ใช้ทั้งใน overlay และแท็บ) ----------
  function deviceList(devices, opts) {
    var o = opts || {};
    var wrap = el('div', { class: 'dev-list' });
    if (!devices.length) {
      wrap.appendChild(el('div', { class: 'dev-empty', text: Tk.t('ยังไม่มีเครื่องที่ผูกกับบัญชีนี้') }));
      return wrap;
    }
    devices.forEach(function (d) {
      var name = el('div', { class: 'dev-name' }, [el('span', { text: d.name || Tk.t('ไม่ทราบชื่อเครื่อง') })]);
      if (d.current) name.appendChild(el('span', { class: 'dev-tag', text: Tk.t('เครื่องนี้') }));

      var right;
      if (d.current) {
        right = el('span', { class: 'dev-count', text: Tk.t('กำลังใช้งาน') });
      } else {
        right = el('button', { type: 'button', class: 'btn btn-sm btn-danger', text: o.actionLabel || Tk.t('ปลดออก') });
        right.addEventListener('click', function () { o.onAction(d, right); });
      }

      wrap.appendChild(el('div', { class: 'dev-row' + (d.current ? ' is-current' : '') }, [
        el('span', { class: 'dev-ic' }, [icon('widgets', 16)]), // จอภาพ = เครื่องที่ติดตั้งแอป
        el('div', { class: 'dev-main' }, [
          name,
          el('div', { class: 'dev-meta', text: platformName(d.platform) + ' · ' + Tk.t('ใช้ล่าสุด {time}', { time: fmtDateTime(d.lastSeenAt) }) })
        ]),
        right
      ]));
    });
    return wrap;
  }

  // ---------- แท็บบัญชี ----------
  function renderAccount() {
    var root = document.getElementById('accountRoot');
    if (!root) return;
    root.innerHTML = '';

    if (!current || !current.loggedIn) {
      root.appendChild(el('div', { class: 'card' }, [
        el('p', { class: 'muted small', text: Tk.t('ยังไม่ได้เข้าสู่ระบบ') })
      ]));
      return;
    }

    var u = current.user || {};
    var sub = current.subscription || {};
    var devices = current.devices || (current.device ? [Object.assign({ current: true }, current.device)] : []);

    // --- คอลัมน์ซ้าย: สมาชิก + บัญชี ---
    var licCard = el('div', { class: 'card' }, [
      el('div', { class: 'card-title' }, [icon('crown', 14), el('span', { text: Tk.t('สถานะสมาชิก') })]),
      licenseStrip(sub)
    ]);
    var licActions = el('div', { class: 'acct-actions' });
    var payBtn = el('button', { type: 'button', class: 'btn btn-sm' + (sub.active ? '' : ' btn-primary') }, [
      icon('external', 14), el('span', { text: sub.active ? Tk.t('จัดการการชำระเงิน') : Tk.t('สมัคร / ต่ออายุ') })
    ]);
    payBtn.addEventListener('click', function () { openBilling(); });
    var refBtn = el('button', { type: 'button', class: 'btn btn-sm' }, [
      icon('refresh', 14), el('span', { text: Tk.t('ตรวจสอบสถานะ') })
    ]);
    refBtn.addEventListener('click', function () {
      refBtn.disabled = true;
      refreshFromServer().then(function (res) {
        refBtn.disabled = false;
        if (res.active) Tk.toast(Tk.t('อัปเดตสถานะสมาชิกแล้ว'), 'ok');
        else Tk.toast(Tk.t(RECHECK_MSG[res.reason] || 'ตรวจสอบสถานะไม่สำเร็จ'), res.reason === 'inactive' ? 'warn' : 'err');
      });
    });
    licActions.appendChild(payBtn);
    licActions.appendChild(refBtn);
    licCard.appendChild(licActions);

    var idCard = el('div', { class: 'card' }, [
      el('div', { class: 'card-title' }, [icon('follow', 14), el('span', { text: Tk.t('บัญชีที่ใช้งาน') })]),
      el('div', { class: 'acct-id' }, [
        avatarEl(u, 42),
        el('div', { class: 'acct-id-main' }, [
          el('div', { class: 'acct-id-name', text: u.displayName || Tk.t('บัญชีของฉัน') }),
          el('div', { class: 'acct-id-mail', text: u.email || Tk.t('ไม่มีอีเมล') })
        ])
      ])
    ]);
    var outBtn = el('button', { type: 'button', class: 'btn btn-sm btn-danger', text: Tk.t('ออกจากระบบ') });
    outBtn.addEventListener('click', doLogout);
    idCard.appendChild(el('div', { class: 'acct-actions' }, [outBtn]));

    // --- คอลัมน์ขวา: เครื่อง ---
    var devCard = el('div', { class: 'card' });
    devCard.appendChild(el('div', { class: 'row-between' }, [
      el('div', { class: 'card-title', style: 'margin-bottom:0' }, [icon('users', 14), el('span', { text: Tk.t('เครื่องที่ผูกกับบัญชี') })]),
      el('span', { class: 'dev-count', text: Tk.t('{n} เครื่อง', { n: devices.length + (current.maxDevices ? ' / ' + current.maxDevices : '') }) })
    ]));
    devCard.appendChild(el('p', {
      class: 'muted small',
      style: 'margin:8px 0 10px',
      text: Tk.t('บัญชีเดียวใช้ได้จำกัดจำนวนเครื่อง — ปลดเครื่องที่ไม่ได้ใช้ออกเพื่อเพิ่มเครื่องใหม่')
    }));
    devCard.appendChild(deviceList(devices, {
      actionLabel: Tk.t('ปลดออก'),
      onAction: function (d, btn) {
        // ยืนยันก่อนเสมอ — คลิกพลาดครั้งเดียวอาจเตะเครื่องที่กำลังไลฟ์อยู่อีกห้องออก แล้วย้อนไม่ได้
        Tk.confirmDialog(Tk.t('ปลดเครื่อง "{name}" ออกจากบัญชี? เครื่องนั้นจะต้องเข้าสู่ระบบใหม่', { name: d.name || Tk.t('ไม่ทราบชื่อเครื่อง') }), Tk.t('ปลดออก'), { danger: true })
          .then(function (yes) {
            if (!yes) return;
            btn.disabled = true;
            btn.textContent = Tk.t('กำลังปลด...');
            invoke('auth:kickDevice', { deviceId: d.id }, { toast: false })
              .then(function () { return refreshFromServer(); })
              .catch(function () { btn.disabled = false; btn.textContent = Tk.t('ปลดออก'); });
          });
      }
    }));

    var grid = el('div', { class: 'acct-grid' }, [
      el('div', {}, [licCard, idCard]),
      el('div', {}, [devCard])
    ]);
    root.appendChild(grid);
  }

  // ---------- การทำงาน ----------
  // ปุ่มต่ออายุทุกจุด → สลับไปแท็บ "ซื้อ / ต่ออายุ" ในโปรแกรม (แท็บนั้นจัดการโหลดหน้าเว็บเอง)
  // ถ้ากำแพงยังบังอยู่ (ยังไม่มีสิทธิ์) สลับแท็บไม่ได้ ก็เปิดเบราว์เซอร์ให้แทน
  function openBilling() {
    var btn = document.querySelector('.nav-item[data-tab="billing"]');
    var ov = document.getElementById('authOverlay');
    var blocked = ov && !ov.classList.contains('hidden'); // กำแพงบังอยู่ = คลิกแท็บไม่ถึง
    if (btn && !blocked) { btn.click(); return; }
    invoke('billing:external', {}, { toast: false }).then(function (r) {
      if (r && r.ok) return;
      var url = billingUrl();
      if (url) invoke('app:openExternal', { url: url }, { toast: false });
      else Tk.toast(Tk.t('ยังตั้งค่าที่อยู่เว็บไม่เสร็จ — ติดต่อผู้ดูแล'), 'err');
    }).catch(function () { Tk.toast(Tk.t('เปิดหน้าซื้อไม่สำเร็จ'), 'err'); });
  }

  // แถบเตือนใกล้หมดอายุ — โผล่เหนือทุกแท็บ ผู้ใช้จะได้ไม่ไลฟ์ไปแล้วโดนตัดกลางคัน
  function renderSubBanner(st) {
    var bar = document.getElementById('subBanner');
    if (!bar) return;
    var sub = (st && st.subscription) || {};
    var ent = (st && st.entitlement) || {};
    var left = daysLeft(sub);

    // ออฟไลน์นานจนใกล้ครบ grace — เตือนก่อนโดนตัดกลางไลฟ์ สำคัญกว่าเรื่องวันหมดอายุ
    if (sub.active && ent.offlineDaysLeft != null && ent.offlineDaysLeft <= 2) {
      bar.innerHTML = '';
      bar.appendChild(el('span', {
        text: Tk.t('ยังไม่ได้เชื่อมต่อกับระบบมาหลายวัน — ต่ออินเทอร์เน็ตภายใน {n} วัน ไม่งั้นโปรแกรมจะหยุดทำงาน', { n: ent.offlineDaysLeft })
      }));
      bar.appendChild(el('button', {
        class: 'btn btn-sm', text: Tk.t('ตรวจสอบเดี๋ยวนี้'),
        onclick: function () { refreshFromServer(); }
      }));
      bar.hidden = false;
      return;
    }

    // เตือนเฉพาะตอนยังใช้งานได้แต่เหลือน้อย — หมดอายุจริงมีกำแพงกั้นอยู่แล้ว
    if (!sub.active || left === null || left > 7) { bar.hidden = true; return; }
    bar.innerHTML = '';
    bar.appendChild(el('span', {
      text: left <= 1 ? Tk.t('สมาชิกหมดอายุวันนี้ — ต่ออายุเพื่อใช้งานต่อ')
                      : Tk.t('สมาชิกเหลืออีก {n} วัน — ต่ออายุไว้ก่อนได้เลย', { n: left })
    }));
    bar.appendChild(el('button', {
      class: 'btn btn-sm', text: Tk.t('ต่ออายุ'),
      onclick: function () { openBilling(); }
    }));
    bar.hidden = false;
  }

  function doLogin(provider) {
    if (busy) return;
    busy = true;
    showBusy(Tk.t('เปิดเบราว์เซอร์เพื่อยืนยันตัวตนแล้ว\nยืนยันเสร็จให้กลับมาที่แอปนี้'));
    invoke('auth:login', { provider: provider }, { toast: false })
      .then(function (r) { busy = false; handleResult(r); })
      .catch(function (e) { busy = false; showLogin(Tk.t('เข้าสู่ระบบไม่สำเร็จ: {msg}', { msg: (e && e.message) || e }), true); });
  }

  function doLogout() {
    Tk.confirmDialog(Tk.t('ออกจากระบบบัญชีนี้? ต้องเข้าสู่ระบบใหม่เพื่อใช้งานโปรแกรม'), Tk.t('ออกจากระบบ'), { danger: true })
      .then(function (yes) { if (yes) reallyLogout(); });
  }
  function reallyLogout() {
    invoke('auth:logout', {}, { toast: false }).then(function () {
      current = null;
      renderAccount();
      showLogin(Tk.t('ออกจากระบบแล้ว'));
    });
  }

  // ข้อความผลการตรวจสอบสถานะ — แยกให้ผู้ใช้รู้ว่าติดเพราะเน็ต/ยังไม่จ่าย/เซสชันหมด
  // เดิมปุ่ม "ตรวจสอบสถานะอีกครั้ง" ล้มเหลวเงียบสนิท คนจ่ายเงินแล้วเน็ตมีปัญหาจะงงว่าจ่ายแล้วไม่ปลดล็อก
  var RECHECK_MSG = {
    offline: 'เชื่อมต่ออินเทอร์เน็ตไม่ได้ — ตรวจสอบเน็ตแล้วลองอีกครั้ง',
    no_session: 'เซสชันหมดอายุ — กรุณาเข้าสู่ระบบใหม่',
    inactive: 'ยังไม่พบการชำระเงิน — ถ้าเพิ่งจ่าย รอสักครู่แล้วลองอีกครั้ง'
  };

  // ดึงสถานะล่าสุดจากเซิร์ฟเวอร์ (subscription + รายการเครื่อง)
  // คืน { ok, active, reason } เพื่อให้ปุ่มที่กดแยกข้อความบอกสาเหตุได้ (เดิมคืน false เฉย ๆ)
  function refreshFromServer() {
    return invoke('auth:me', {}, { toast: false }).then(function (r) {
      if (!r) return { ok: false, active: false, reason: 'offline' };
      // token หมดอายุ/ถูกเพิกถอน → เด้งกลับหน้าเข้าสู่ระบบ (main จะยิง authState ตามมาด้วย)
      if (r.error === 'not_logged_in') { gate({ loggedIn: false }); return { ok: false, active: false, reason: 'no_session' }; }
      if (!r.ok) return { ok: false, active: false, reason: 'offline' };
      current = Object.assign({}, current, {
        loggedIn: true,
        user: r.user,
        subscription: r.subscription,
        maxDevices: r.maxDevices,
        devices: r.devices || []
      });
      renderAccount();
      gate(current);
      var active = !!(r.subscription && r.subscription.active);
      return { ok: true, active: active, reason: active ? 'active' : 'inactive' };
    }).catch(function () { return { ok: false, active: false, reason: 'offline' }; });
  }

  function handleResult(r) {
    if (!r) return showLogin(Tk.t('ไม่มีการตอบกลับจากเซิร์ฟเวอร์ — ตรวจสอบการเชื่อมต่อ'), true);
    if (r.ok) { pendingLimit = null; gate(r); refreshFromServer(); return; }
    if (r.error === 'device_limit') return showDeviceLimit(r);
    var known = ({
      timeout: 'หมดเวลารอการยืนยัน — ลองใหม่อีกครั้ง',
      bad_state: 'การยืนยันไม่ถูกต้อง — ลองใหม่อีกครั้ง',
      exchange_failed: 'เข้าสู่ระบบไม่สำเร็จ',
      loopback_failed: 'เปิดพอร์ตรับข้อมูลไม่ได้ — ปิดโปรแกรมที่ใช้พอร์ตชนกันแล้วลองใหม่',
      no_pending: 'เซสชันหมดอายุ — เริ่มเข้าสู่ระบบใหม่',
      network: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — ตรวจสอบอินเทอร์เน็ต'
    })[r.error];
    var msg = known ? Tk.t(known)
                    : Tk.t('เข้าสู่ระบบไม่สำเร็จ ({err})', { err: r.error || Tk.t('ไม่ทราบสาเหตุ') });
    showLogin(msg, true);
  }

  function isActive(st) { return !!(st && st.subscription && st.subscription.active); }

  // ตัวตัดสินว่าจะแสดงอะไร: ยังไม่เข้าระบบ → หน้าเข้าสู่ระบบ · ไม่มีสิทธิ์ → กำแพง · ครบ → เข้าแอป
  function gate(st) {
    current = Object.assign({}, current, st || {});
    if (!st || !st.loggedIn) { current = null; renderAccount(); renderSubBanner(null); showLogin(); return; }
    renderAccount();
    renderSubBanner(current);
    if (isActive(st)) hideOverlay();
    else showWall(current);
  }

  // ---------- เชื่อมสัญญาณ ----------
  Tk.onEvent(function (msg) {
    if (!msg || msg.event !== 'authState') return;
    gate(msg.data);
  });
  // หน้าบัญชี/แบนเนอร์วาดด้วย JS — ทาคำแปลผ่าน data-i18n ไม่ถึง ต้องวาดใหม่เมื่อภาษาเปลี่ยน
  // ครอบทั้งตอนเปิดแอป (auth:state มักกลับมาก่อน state:get ที่เป็นคนตั้งภาษา) และตอนกดสลับภาษา
  if (Tk.i18n && Tk.i18n.onChange) Tk.i18n.onChange(function () {
    renderAccount();
    renderSubBanner(current);
    if (overlayMode === 'login') showLogin(lastLogin && lastLogin[0], lastLogin && lastLogin[1]);
    else if (overlayMode === 'wall') showWall(current);
  });

  document.addEventListener('DOMContentLoaded', function () {
    showBusy(Tk.t('กำลังตรวจสอบสิทธิ์การใช้งาน'));
    invoke('auth:state', {}, { toast: false })
      .then(function (st) {
        gate(st);
        if (st && st.loggedIn) refreshFromServer();
      })
      .catch(function () { showLogin(Tk.t('เชื่อมต่อเซิร์ฟเวอร์ยืนยันตัวตนไม่ได้ — ตรวจสอบการเชื่อมต่อ'), true); });
  });
})();
