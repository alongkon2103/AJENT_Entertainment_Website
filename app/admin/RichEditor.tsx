"use client";

import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import Youtube from "@tiptap/extension-youtube";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Code,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  LoaderCircle,
  Minus,
  Quote,
  Redo2,
  SquareCode,
  SquarePlay,
  Strikethrough,
  TextAlignCenter,
  TextAlignEnd,
  TextAlignStart,
  Underline,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { useState, type ChangeEvent } from "react";
import { uploadImage } from "./components";

type Tool = { label: string; icon: LucideIcon; run: (e: Editor) => void; active?: (e: Editor) => boolean; disabled?: (e: Editor) => boolean } | "|" | "image";

function promptLink(editor: Editor) {
  const current = editor.getAttributes("link").href as string | undefined;
  const href = window.prompt("ลิงก์ (เว้นว่างเพื่อเอาลิงก์ออก)", current ?? "https://");
  if (href === null) return;
  const chain = editor.chain().focus().extendMarkRange("link");
  if (href.trim() === "" || href === "https://") chain.unsetLink().run();
  else chain.setLink({ href: href.trim() }).run();
}

function promptYoutube(editor: Editor) {
  const src = window.prompt("ลิงก์วิดีโอ YouTube");
  if (src && !editor.chain().focus().setYoutubeVideo({ src: src.trim() }).run()) window.alert("ลิงก์ YouTube ไม่ถูกต้อง");
}

/** Tiptap editor that writes sanitized-on-save HTML into a hidden input named `name`. */
export default function RichEditor({ name, defaultValue = "", placeholder = "เริ่มพิมพ์รายละเอียด..." }: { name: string; defaultValue?: string; placeholder?: string }) {
  const [html, setHtml] = useState(defaultValue);
  const [uploading, setUploading] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] }, link: { openOnClick: false, autolink: true, defaultProtocol: "https" } }),
      Image,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Youtube.configure({ nocookie: true }),
      Placeholder.configure({ placeholder }),
    ],
    content: defaultValue,
    editorProps: { attributes: { class: "rich adm-editor-body" } },
    onUpdate: ({ editor }) => setHtml(editor.isEmpty ? "" : editor.getHTML()),
  });

  // Re-render the toolbar when the selection or marks change.
  useEditorState({ editor, selector: ({ editor }) => editor?.state.selection.toJSON() ?? null });

  const tools: Tool[] = [
    { label: "ตัวหนา", icon: Bold, run: (e) => e.chain().focus().toggleBold().run(), active: (e) => e.isActive("bold") },
    { label: "ตัวเอียง", icon: Italic, run: (e) => e.chain().focus().toggleItalic().run(), active: (e) => e.isActive("italic") },
    { label: "ขีดเส้นใต้", icon: Underline, run: (e) => e.chain().focus().toggleUnderline().run(), active: (e) => e.isActive("underline") },
    { label: "ขีดฆ่า", icon: Strikethrough, run: (e) => e.chain().focus().toggleStrike().run(), active: (e) => e.isActive("strike") },
    { label: "โค้ด", icon: Code, run: (e) => e.chain().focus().toggleCode().run(), active: (e) => e.isActive("code") },
    "|",
    { label: "หัวข้อใหญ่", icon: Heading2, run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(), active: (e) => e.isActive("heading", { level: 2 }) },
    { label: "หัวข้อย่อย", icon: Heading3, run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(), active: (e) => e.isActive("heading", { level: 3 }) },
    { label: "รายการแบบจุด", icon: List, run: (e) => e.chain().focus().toggleBulletList().run(), active: (e) => e.isActive("bulletList") },
    { label: "รายการแบบตัวเลข", icon: ListOrdered, run: (e) => e.chain().focus().toggleOrderedList().run(), active: (e) => e.isActive("orderedList") },
    { label: "ข้อความอ้างอิง", icon: Quote, run: (e) => e.chain().focus().toggleBlockquote().run(), active: (e) => e.isActive("blockquote") },
    { label: "กล่องโค้ด", icon: SquareCode, run: (e) => e.chain().focus().toggleCodeBlock().run(), active: (e) => e.isActive("codeBlock") },
    { label: "เส้นคั่น", icon: Minus, run: (e) => e.chain().focus().setHorizontalRule().run() },
    "|",
    { label: "ชิดซ้าย", icon: TextAlignStart, run: (e) => e.chain().focus().setTextAlign("left").run(), active: (e) => e.isActive({ textAlign: "left" }) },
    { label: "กึ่งกลาง", icon: TextAlignCenter, run: (e) => e.chain().focus().setTextAlign("center").run(), active: (e) => e.isActive({ textAlign: "center" }) },
    { label: "ชิดขวา", icon: TextAlignEnd, run: (e) => e.chain().focus().setTextAlign("right").run(), active: (e) => e.isActive({ textAlign: "right" }) },
    "|",
    { label: "ลิงก์", icon: Link2, run: promptLink, active: (e) => e.isActive("link") },
    "image",
    { label: "แทรกวิดีโอ YouTube", icon: SquarePlay, run: promptYoutube },
    "|",
    { label: "ย้อนกลับ", icon: Undo2, run: (e) => e.chain().focus().undo().run(), disabled: (e) => !e.can().undo() },
    { label: "ทำซ้ำ", icon: Redo2, run: (e) => e.chain().focus().redo().run(), disabled: (e) => !e.can().redo() },
  ];

  async function insertImage(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again
    if (!file || !editor) return;
    setUploading(true);
    try {
      editor.chain().focus().setImage({ src: await uploadImage(file) }).run();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="adm-editor">
      <input type="hidden" name={name} value={html} />
      <div className="adm-toolbar" role="toolbar" aria-label="เครื่องมือจัดรูปแบบ">
        {tools.map((tool, i) =>
          tool === "|" ? (
            <span key={i} className="adm-toolbar-sep" />
          ) : tool === "image" ? (
            <label key="image" className={`adm-tool${uploading ? " active" : ""}`} title="แทรกรูป" aria-label="แทรกรูป">
              {uploading ? <LoaderCircle size={17} className="adm-spin" /> : <ImagePlus size={17} />}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden disabled={!editor || uploading} onChange={insertImage} />
            </label>
          ) : (
            <button
              key={tool.label}
              type="button"
              className={`adm-tool${editor && tool.active?.(editor) ? " active" : ""}`}
              title={tool.label}
              aria-label={tool.label}
              disabled={!editor || tool.disabled?.(editor)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor && tool.run(editor)}
            >
              <tool.icon size={17} />
            </button>
          ),
        )}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
