"use client";

import { useState } from "react";
import { tikkies } from "../data";

/** The real Tikkies Tools app running in-page with sample data, switchable by tab. */
export default function AppEmbed() {
  const [tab, setTab] = useState(tikkies.demoTabs[0].id);
  const src = `${tikkies.app.demo}?lang=th&embed=1&tab=${tab}${tab === "actions" ? "&view=node" : ""}`;

  return (
    <div className="reveal">
      <div className="games-filter">
        {tikkies.demoTabs.map((d) => (
          <button key={d.id} type="button" className={`games-filter-btn${tab === d.id ? " active" : ""}`} onClick={() => setTab(d.id)}>
            {d.label}
          </button>
        ))}
      </div>
      <div className="preview-screen demo-screen">
        <div className="preview-screen-bar">
          <div className="preview-dot" style={{ background: "#ff5f57" }} />
          <div className="preview-dot" style={{ background: "#ffbd2e" }} />
          <div className="preview-dot" style={{ background: "#28c840" }} />
          <span className="preview-screen-title">Tikkies Tools</span>
          <a className="demo-open" href={src} target="_blank" rel="noreferrer">เปิดเต็มจอ ↗</a>
        </div>
        <iframe key={src} className="demo-frame" src={src} title="Tikkies Tools" allow="autoplay" />
      </div>
      <p className="demo-hint">ลากโหนดจากแผงซ้าย ลากสายต่อกัน หรือกด &quot;ทดสอบ&quot; แล้วดูไฟวิ่งตามสาย · ถ้าหน้าจอไม่ขึ้น กด &quot;เปิดเต็มจอ&quot; ที่มุมขวาบน</p>
    </div>
  );
}
