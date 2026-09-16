"use client";

import { Lock } from "lucide-react";
import { Field, SaveForm } from "../components";
import { login } from "../actions";

export default function LoginForm() {
  return (
    <div className="adm-card adm-login-card">
      <div className="adm-login-icon">
        <Lock size={26} />
      </div>
      <h1 className="adm-title">AJENT Admin</h1>
      <p className="adm-sub">จัดการเกม ข่าวสาร และหมวดหมู่ของเว็บไซต์</p>
      <SaveForm action={login} submitLabel="เข้าสู่ระบบ" className="adm-stack">
        <Field label="รหัสผ่านผู้ดูแล">
          <input className="adm-input" type="password" name="password" autoComplete="current-password" required autoFocus />
        </Field>
      </SaveForm>
    </div>
  );
}
