import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/auth-provider";
import { rpc, unwrap } from "@/lib/rpc";

export default function SetPasswordPage() {
  const { logout } = useAuth();
  const [token] = useState(() => window.location.hash.slice(1));
  useEffect(() => {
    window.history.replaceState(null, "", window.location.pathname);
  }, []);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirm) { setError("Passwords must match."); return; }
    setBusy(true); setError("");
    try {
      await unwrap(rpc.auth["set-password"].$post({ json: { token, password } }), "Could not save password");
      logout(); setSaved(true); setPassword(""); setConfirm("");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save password"); }
    finally { setBusy(false); }
  }
  return <main className="min-h-dvh flex items-center justify-center bg-background px-6 py-12">
    <div className="w-full max-w-sm space-y-6">
      <Link to="/" className="inline-flex items-center gap-1.5"><BrandMark size={22} />OhShift</Link>
      <h1 className="text-[1.75rem] font-bold tracking-tight">{saved ? "Password saved" : "Set your password"}</h1>
      {saved ? <><p className="text-sm text-muted-foreground">Sign in with your new password.</p><Link to="/login" className="text-brand underline">Go to sign in</Link></> : !token ? <><p className="text-sm text-muted-foreground">This link is missing or expired. Request a new password link from the sign-in page.</p><Link to="/login" className="text-brand underline">Go to sign in</Link></> : <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-muted-foreground">Choose a password between 12 and 128 characters.</p>
        <div className="space-y-2"><Label htmlFor="password">New password</Label><Input id="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={password} onChange={e => setPassword(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="confirm">Confirm password</Label><Input id="confirm" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={confirm} onChange={e => setConfirm(e.target.value)} /></div>
        {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={busy} tooltip="Save your new password" className="w-full">{busy ? "Saving…" : "Save password"}</Button>
      </form>}
    </div>
  </main>;
}
