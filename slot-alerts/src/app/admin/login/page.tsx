import { redirect } from "next/navigation";
import { adminEnabled, login } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  async function doLogin(form: FormData) {
    "use server";
    // Small fixed delay slows down password guessing.
    await new Promise((r) => setTimeout(r, 500));
    if (await login(String(form.get("password") ?? ""))) redirect("/admin");
    redirect("/admin/login?error=1");
  }

  if (!adminEnabled()) return <p>Set ADMIN_PASSWORD to enable the admin page.</p>;
  return (
    <>
      <h1>Admin</h1>
      <form action={doLogin} className="card">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required autoFocus />
        <div style={{ marginTop: 16 }}>
          <button type="submit">Log in</button>
        </div>
        {error && <p className="error">Wrong password.</p>}
      </form>
    </>
  );
}
