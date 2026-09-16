// Tikkies Tools — ตัวปรับหน้าตากลางของทุก widget
//
// โหลดใน <head> ของทุก widget (ก่อน CSS ตัวอื่น) เพื่อ:
//   1) เซ็ต data-tpl ให้ธีม (?template=) มีผลตั้งแต่เฟรมแรก ไม่เห็นธีม default แวบก่อนสลับ
//   2) แปลงพารามิเตอร์ "ปรับละเอียด" จาก URL เป็น CSS variable ทับค่าของธีม
//
// ทำไมทับได้: ตัวแปรพวกนี้ประกาศไว้ที่ :root / [data-tpl=...] ใน templates.css
// ส่วนไฟล์นี้เซ็ตเป็น inline style บน <html> ซึ่งชนะ selector ปกติเสมอ
// และเซ็ต "เฉพาะตัวที่ผู้ใช้ระบุมา" — ตัวที่ไม่ระบุจะตกไปใช้ค่าของธีมตามเดิม
//
// พารามิเตอร์ที่ทุก widget รับเหมือนกัน (ทุกตัวไม่บังคับ):
//   ตัวอักษร : font, textcolor, dimcolor, weight, track, caps,
//              textshadow (0-100), shadowcolor, stroke (px), strokecolor
//   กล่อง    : bg, bgopacity (0-100), radius, border, bordercolor,
//              blur (px), boxshadow (0-100), padx, pady
//   อื่นๆ    : accent, accent2, anim (0/1), scale
(function () {
  var P = new URLSearchParams(location.search);
  var root = document.documentElement;
  var S = root.style;

  function raw(k) { var v = P.get(k); return v === null || v === '' ? null : v; }
  function num(k, min, max) {
    // ต้องเช็ค null ก่อน — Number(null) ได้ 0 (ไม่ใช่ NaN) พารามิเตอร์ที่ไม่ได้ส่งมา
    // จะกลายเป็น 0 แล้วไปทับค่าของธีมทั้งที่ผู้ใช้ไม่ได้ตั้ง
    var s = raw(k);
    if (s === null) return null;
    var v = Number(s);
    if (!isFinite(v)) return null;
    if (min != null && v < min) v = min;
    if (max != null && v > max) v = max;
    return v;
  }
  // รับได้ทั้ง "ff2c55" และ "#ff2c55" (URL ของแอปส่งมาแบบไม่มี #)
  function hex(k) {
    var v = raw(k);
    if (!v) return null;
    v = v.replace(/^#/, '');
    return /^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(v) ? '#' + v : null;
  }
  function rgbOf(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  function rgba(h, a) { var c = rgbOf(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function set(k, v) { if (v != null) S.setProperty(k, v); }

  // ---------- ธีม ----------
  root.dataset.tpl = (raw('template') || 'default').replace(/[^a-z0-9]/gi, '').slice(0, 16) || 'default';

  // ---------- สีหลัก ----------
  // ตั้งไว้ครบทุกเฉด เพื่อให้ widget ที่อ้าง --accent-glow / --accent-weak ใช้ได้ทันที
  var acc = hex('accent');
  if (acc) {
    set('--accent', acc);
    set('--accent2', hex('accent2') || acc);
    set('--accent-glow', rgba(acc, 0.55));
    set('--accent-weak', rgba(acc, 0.22));
    set('--accent-ring', rgba(acc, 0.7));
  } else if (hex('accent2')) {
    set('--accent2', hex('accent2'));
  }

  // ---------- ตัวอักษร ----------
  var FONTS = {
    system: "-apple-system, 'Segoe UI', 'Helvetica Neue', 'Thonburi', sans-serif",
    sans: "'Prompt', 'Noto Sans Thai', -apple-system, 'Segoe UI', sans-serif",
    round: "'Mali', 'Comic Sans MS', 'Noto Sans Thai', -apple-system, sans-serif",
    serif: "'Sarabun', Georgia, 'Times New Roman', serif",
    mono: "'Courier New', 'DejaVu Sans Mono', ui-monospace, monospace",
    condensed: "'Arial Narrow', 'Roboto Condensed', 'Noto Sans Thai', sans-serif",
    impact: "Impact, 'Arial Black', 'Noto Sans Thai', sans-serif"
  };
  var f = raw('font');
  if (f) {
    // hasOwnProperty กันคีย์จาก prototype (?font=toString/constructor คืนฟังก์ชันแทน undefined)
    // ไม่อยู่ในลิสต์ = ผู้ใช้พิมพ์ชื่อฟอนต์เอง แต่ต้องเป็นอักขระที่ใช้ในชื่อ font จริงเท่านั้น
    // ใช้ \p{L}\p{N} (ต้องมี flag u) เพื่อรับชื่อฟอนต์ไทย/นอก Latin เช่น ?font=สารบรรณ ด้วย
    // แต่ยังกันอักขระที่พาหลุดออกจากค่า CSS ( ; { } ( ) < > : ) ที่ทำ CSS injection ใน --tpl-font ได้
    var fam = Object.prototype.hasOwnProperty.call(FONTS, f) ? FONTS[f]
      : (/^[\p{L}\p{N}\s,'"-]{1,80}$/u.test(f) ? f : null);
    set('--tpl-font', fam);
  }

  set('--tpl-text', hex('textcolor'));
  set('--tpl-dim', hex('dimcolor'));
  var w = num('weight', 100, 900);
  if (w != null) set('--tpl-weight', String(Math.round(w / 100) * 100));
  var tr = num('track', -10, 50);
  if (tr != null) set('--tpl-track', (tr / 100) + 'em');
  var caps = raw('caps');
  if (caps != null) set('--tpl-caps', caps === '1' || caps === 'true' ? 'uppercase' : 'none');

  // เงาตัวอักษร: 0 = ปิดสนิท (ภาพสะอาดบนพื้นสีเรียบ), มาก = อ่านง่ายบนวิดีโอที่ลายเยอะ
  var ts = num('textshadow', 0, 100);
  if (ts != null) {
    var sc = hex('shadowcolor') || '#000000';
    set('--tpl-shadow', ts === 0 ? 'none'
      : '0 1px ' + (ts / 25).toFixed(2) + 'px ' + rgba(sc, Math.min(1, ts / 100 + 0.15)) +
        ', 0 0 ' + (ts / 10).toFixed(2) + 'px ' + rgba(sc, ts / 200));
  }
  // ขอบตัวอักษร — ช่วยให้อ่านออกบนพื้นหลังสว่าง/ลายจัด
  var stroke = num('stroke', 0, 12);
  if (stroke != null) {
    set('--tpl-stroke', stroke + 'px');
    set('--tpl-stroke-color', hex('strokecolor') || '#000000');
  }

  // ---------- กล่อง/พื้นหลัง ----------
  var bg = hex('bg'), bgop = num('bgopacity', 0, 100);
  if (bg || bgop != null) {
    var base = bg || '#121216';
    var a = bgop == null ? 55 : bgop;
    set('--pan-bg', rgba(base, a / 100));
    set('--pan-bg-strong', rgba(base, Math.min(1, a / 100 + 0.22)));
  }
  var rad = num('radius', 0, 80);
  if (rad != null) {
    set('--pan-radius', rad + 'px');
    set('--row-radius', rad + 'px');   // แชทใช้ตัวแปรของตัวเอง ซึ่งธีมเซ็ตทับไว้ — ตั้งเองต้องชนะธีม
  }
  var bw = num('border', 0, 12);
  if (bw != null) set('--pan-border', bw === 0 ? '0 solid transparent' : bw + 'px solid ' + (hex('bordercolor') || '#ffffff'));
  else if (hex('bordercolor')) set('--pan-border', '1.5px solid ' + hex('bordercolor'));
  // ไม่มี ?blur= ให้ปรับ — OBS Browser Source เป็นเลเยอร์แยก backdrop-filter
  // เบลอวิดีโอที่อยู่คนละเลเยอร์ไม่ได้ (ธีม glass ยังตั้ง --pan-blur ของตัวเองไว้ได้)
  var bs = num('boxshadow', 0, 100);
  if (bs != null) set('--pan-shadow', bs === 0 ? 'none' : '0 ' + (bs / 12).toFixed(1) + 'px ' + (bs / 3).toFixed(1) + 'px rgba(0,0,0,' + (bs / 130).toFixed(2) + ')');
  var px = num('padx', 0, 80), py = num('pady', 0, 80);
  if (px != null || py != null) set('--pan-pad', (py == null ? 10 : py) + 'px ' + (px == null ? 14 : px) + 'px');

  // ---------- อนิเมชัน ----------
  // ปิดไว้สำหรับคนที่อยากได้ overlay นิ่งๆ ไม่ดึงสายตา (หรือเครื่องแรงไม่พอ)
  if (raw('anim') === '0') root.dataset.anim = '0';

  // ---------- ความกว้างสูงสุดของแถว/กล่อง ----------
  // ต่างจาก scale (ย่อทั้งอันจนตัวหนังสือเล็ก) — อันนี้จำกัดความกว้างเฉยๆ ตัวอักษรเท่าเดิม
  // เอาไว้ตอนวางในโปรแกรมไลฟ์ที่แหล่งภาพกว้าง แล้วแถวยืดยาวเกินไป
  var wd = num('width', 120, 1600);
  if (wd != null) set('--tpl-width', wd + 'px');

  // ---------- ย่อ/ขยายทั้งตัว ----------
  // เดิม widget แต่ละตัวมีสคริปต์ zoom ของตัวเอง — ย้ายมาไว้ที่เดียว
  var sc2 = num('scale', 10, 400);
  if (sc2 != null && sc2 !== 100) {
    document.addEventListener('DOMContentLoaded', function () { document.body.style.zoom = sc2 / 100; });
  }
})();
