"use client";

import {
  BadgeCheck,
  Check,
  ExternalLink,
  Gamepad2,
  ImagePlus,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Newspaper,
  Shapes,
  Tags,
  Trash,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useOptimistic, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import type { Tag } from "@/lib/generated/prisma/client";
import { TAG_KINDS, tint, type TagKind } from "@/lib/tags";
import { deleteTag, logout, saveTag, setTagActive, type FormState } from "./actions";

// ---------- layout ----------

const nav = [
  { href: "/admin", label: "แดชบอร์ด", icon: LayoutDashboard, exact: true },
  { group: "เกม" },
  { href: "/admin/games", label: "เกมทั้งหมด", icon: Gamepad2 },
  { href: "/admin/tags/game-category", label: "หมวดหมู่เกม", icon: Shapes },
  { href: "/admin/tags/game-badge", label: "Badge เกม", icon: BadgeCheck },
  { group: "ข่าวสาร" },
  { href: "/admin/news", label: "ข่าวสาร & อัปเดต", icon: Newspaper },
  { href: "/admin/tags/news-category", label: "หมวดข่าวสาร", icon: Tags },
] as const;

export function AdminSidebar() {
  const path = usePathname();
  return (
    <aside className="adm-side">
      <Link href="/admin" className="adm-brand">
        <span className="nav-logo-icon">AJ</span>
        <span>
          <b>AJENT</b> Admin
        </span>
      </Link>
      <nav className="adm-nav">
        {nav.map((item) =>
          "group" in item ? (
            <div key={item.group} className="adm-nav-group">
              {item.group}
            </div>
          ) : (
            <Link
              key={item.href}
              href={item.href}
              className={`adm-nav-link${("exact" in item ? path === item.href : path.startsWith(item.href)) ? " active" : ""}`}
            >
              <item.icon size={18} strokeWidth={2} />
              {item.label}
            </Link>
          ),
        )}
      </nav>
      <div className="adm-side-foot">
        <a href="/" target="_blank" className="adm-nav-link">
          <ExternalLink size={18} />
          ดูหน้าเว็บ
        </a>
        <button type="button" className="adm-nav-link" onClick={() => logout()}>
          <LogOut size={18} />
          ออกจากระบบ
        </button>
      </div>
    </aside>
  );
}

// ---------- forms ----------

/**
 * Submits FormData to a server action without React's automatic form reset,
 * so a validation error never wipes what the admin typed.
 */
export function SaveForm({
  action,
  children,
  className,
  submitLabel = "บันทึก",
  footer,
  sticky,
  onSaved,
}: {
  action: (fd: FormData) => Promise<FormState>;
  children: ReactNode;
  className?: string;
  submitLabel?: string;
  footer?: ReactNode;
  sticky?: boolean;
  onSaved?: () => void;
}) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<FormState>(null);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const result = await action(fd);
      setState(result);
      if (result?.ok) onSaved?.();
    });
  }

  return (
    <form onSubmit={onSubmit} className={className} onChange={() => state && setState(null)}>
      {children}
      <div className={sticky ? "adm-savebar" : "adm-formfoot"}>
        <span className={`adm-msg${state?.error ? " err" : state?.ok ? " ok" : ""}`} role="status" aria-live="polite">
          {state?.error ?? state?.ok}
        </span>
        {footer}
        <button type="submit" className="adm-btn primary" disabled={pending}>
          {pending ? <LoaderCircle size={16} className="adm-spin" /> : <Check size={16} />}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

export function Field({ label, hint, children, wide, className = "" }: { label: string; hint?: string; children: ReactNode; wide?: boolean; className?: string }) {
  return (
    <label className={`adm-field${wide ? " wide" : ""} ${className}`}>
      <span className="adm-label">{label}</span>
      {children}
      {hint && <span className="adm-hint">{hint}</span>}
    </label>
  );
}

/** Checkbox styled as a switch; submits "on" with the form. */
export function FormSwitch({ name, defaultChecked, label, hint }: { name: string; defaultChecked?: boolean; label: string; hint?: string }) {
  return (
    <label className="adm-toggle">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} />
      <span className="adm-switch" aria-hidden="true" />
      <span>
        <span className="adm-toggle-label">{label}</span>
        {hint && <span className="adm-hint">{hint}</span>}
      </span>
    </label>
  );
}

/** Instant on/off switch for list rows. Flips immediately, then saves through the bound server action. */
export function ActionSwitch({ on, action, label }: { on: boolean; action: (value: boolean) => Promise<void>; label: string }) {
  const [optimistic, setOptimistic] = useOptimistic(on);
  const [, start] = useTransition();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={optimistic}
      aria-label={label}
      title={label}
      className={`adm-switch-btn${optimistic ? " on" : ""}`}
      onClick={() =>
        start(async () => {
          setOptimistic(!optimistic);
          await action(!optimistic);
        })
      }
    >
      <span className="adm-switch" aria-hidden="true" />
    </button>
  );
}

export function DeleteButton({ action, confirmText, redirectTo, withLabel }: { action: () => Promise<void>; confirmText: string; redirectTo?: string; withLabel?: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      className={withLabel ? "adm-btn danger" : "adm-icon-btn danger"}
      disabled={pending}
      aria-label="ลบ"
      title="ลบ"
      onClick={() => {
        if (!window.confirm(confirmText)) return;
        start(async () => {
          await action();
          if (redirectTo) router.push(redirectTo);
        });
      }}
    >
      {pending ? <LoaderCircle size={16} className="adm-spin" /> : <Trash size={16} />}
      {withLabel && "ลบ"}
    </button>
  );
}

// ---------- images ----------

export async function uploadImage(file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body });
  const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !json.url) throw new Error(json.error ?? "อัปโหลดไม่สำเร็จ");
  return json.url;
}

export function ImageField({ name, defaultValue = "", ratio = "16 / 9" }: { name: string; defaultValue?: string; ratio?: string }) {
  const [url, setUrl] = useState(defaultValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function upload(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      setUrl(await uploadImage(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="adm-image">
      <input type="hidden" name={name} value={url} />
      <button
        type="button"
        className={`adm-image-drop${dragging ? " drag" : ""}`}
        style={{ aspectRatio: ratio }}
        onClick={() => fileInput.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          upload(e.dataTransfer.files[0]);
        }}
      >
        {url ? (
          <img src={url} alt="" />
        ) : (
          <span className="adm-image-empty">
            <ImagePlus size={28} strokeWidth={1.6} />
            คลิกหรือลากรูปมาวาง
            <small>PNG, JPG, WEBP, GIF ไม่เกิน 5MB</small>
          </span>
        )}
        {busy && (
          <span className="adm-image-busy">
            <LoaderCircle size={26} className="adm-spin" />
          </span>
        )}
      </button>
      <div className="adm-image-row">
        <input className="adm-input" placeholder="หรือวางลิงก์รูป https://..." value={url} onChange={(e) => setUrl(e.target.value.trim())} />
        {url && (
          <button type="button" className="adm-icon-btn" onClick={() => setUrl("")} aria-label="เอารูปออก" title="เอารูปออก">
            <X size={16} />
          </button>
        )}
      </div>
      {error && <p className="adm-field-err">{error}</p>}
      <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => upload(e.target.files?.[0])} />
    </div>
  );
}

// ---------- tags ----------

/** One editable tag row, or the "add new" row when `tag` is missing (remounts empty after each add). */
export function TagEditor({ kind, tag, usage = 0 }: { kind: TagKind; tag?: Tag; usage?: number }) {
  const [round, setRound] = useState(0);
  return <TagForm key={round} kind={kind} tag={tag} usage={usage} onCreated={tag ? undefined : () => setRound((r) => r + 1)} />;
}

function TagForm({ kind, tag, usage, onCreated }: { kind: TagKind; tag?: Tag; usage: number; onCreated?: () => void }) {
  const [name, setName] = useState(tag?.name ?? "");
  const [color, setColor] = useState(tag?.color ?? "#8b5cf6");
  const [textColor, setTextColor] = useState(tag?.textColor ?? "#ffffff");
  const soft = kind === "news-category";
  const preview = name || TAG_KINDS[kind].item;

  return (
    <SaveForm
      action={saveTag}
      onSaved={onCreated}
      className={`adm-tag-row${tag ? "" : " new"}`}
      submitLabel={tag ? "บันทึก" : "เพิ่ม"}
      footer={
        tag && (
          <DeleteButton
            action={deleteTag.bind(null, tag.id)}
            confirmText={usage ? `"${tag.name}" ถูกใช้อยู่ ${usage} รายการ ลบแล้วรายการเหล่านั้นจะไม่มี${TAG_KINDS[kind].item} ยืนยันลบ?` : `ลบ "${tag.name}"?`}
          />
        )
      }
    >
      <input type="hidden" name="kind" value={kind} />
      {tag && <input type="hidden" name="id" value={tag.id} />}
      <div className="adm-tag-preview">
        {soft ? (
          <span className="news-tag" style={{ background: tint(color, "14"), color, border: `1px solid ${tint(color, "33")}` }}>
            {preview}
          </span>
        ) : (
          <span className="adm-chip" style={{ background: color, color: textColor }}>
            {preview}
          </span>
        )}
        {tag && <span className="adm-hint">{usage} รายการ</span>}
      </div>
      <Field label="ชื่อ">
        <input className="adm-input" name="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} />
      </Field>
      <Field label="Slug">
        <input className="adm-input" name="slug" defaultValue={tag?.slug} placeholder="สร้างจากชื่อ" maxLength={80} />
      </Field>
      <Field label={soft ? "สี" : "สีพื้น"} className="fit-color">
        <ColorInput name="color" value={color} onChange={setColor} />
      </Field>
      {!soft && (
        <Field label="สีตัวอักษร" className="fit-color">
          <ColorInput name="textColor" value={textColor} onChange={setTextColor} />
        </Field>
      )}
      <Field label="ลำดับ" className="fit-num">
        <input className="adm-input" type="number" name="sortOrder" defaultValue={tag?.sortOrder ?? 0} />
      </Field>
      {tag ? (
        <div className="adm-field fit-switch">
          <span className="adm-label">เปิดใช้</span>
          <ActionSwitch on={tag.isActive} action={setTagActive.bind(null, tag.id)} label="เปิด/ปิดการแสดงผล" />
          <input type="hidden" name="isActive" value={tag.isActive ? "on" : ""} />
        </div>
      ) : (
        <input type="hidden" name="isActive" value="on" />
      )}
    </SaveForm>
  );
}

function ColorInput({ name, value, onChange }: { name: string; value: string; onChange: (v: string) => void }) {
  return (
    <span className="adm-color">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label="เลือกสี" />
      <input className="adm-input" name={name} value={value} onChange={(e) => onChange(e.target.value)} pattern="#[0-9a-fA-F]{6}" maxLength={7} />
    </span>
  );
}
