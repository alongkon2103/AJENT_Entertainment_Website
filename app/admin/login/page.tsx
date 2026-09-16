import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { isValidSession, SESSION_COOKIE } from "@/lib/session";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  if (isValidSession((await cookies()).get(SESSION_COOKIE)?.value)) redirect("/admin");
  return (
    <div className="adm adm-login" style={{ display: "flex" }}>
      <LoginForm />
    </div>
  );
}
