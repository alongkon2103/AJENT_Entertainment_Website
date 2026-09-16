import { AdminSidebar } from "../components";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="adm">
      <AdminSidebar />
      <main className="adm-main">{children}</main>
    </div>
  );
}
