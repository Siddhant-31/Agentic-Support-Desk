import { useState } from "react";
import { Button } from "../ui/button";
import { apiPost } from "@/lib/api";

type Mode = "login" | "signup";

type Props = {
  onAuthed: () => void;
};

export default function PasswordAuthForm({ onAuthed }: Props) {
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const path = mode === "login" ? "/auth/login-password" : "/auth/signup";
    const body =
      mode === "login"
        ? { email, password }
        : { name, companyName, email, password };

    const res = await apiPost<{ error?: string }>(path, body);

    setSubmitting(false);

    if (!res.ok) {
      setError(res.data?.error || "Something went wrong. Please try again.");
      return;
    }

    onAuthed();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="flex gap-2 rounded-xl bg-slate-100 p-1 text-sm">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`flex-1 rounded-lg py-1.5 font-medium transition ${
            mode === "login" ? "bg-white shadow-sm text-slate-900" : "text-slate-500"
          }`}
        >
          Log in
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`flex-1 rounded-lg py-1.5 font-medium transition ${
            mode === "signup" ? "bg-white shadow-sm text-slate-900" : "text-slate-500"
          }`}
        >
          Sign up
        </button>
      </div>

      {mode === "signup" ? (
        <>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:ring-4 focus:ring-indigo-100"
              placeholder="Jane Doe"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">
              Company name
            </label>
            <input
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:ring-4 focus:ring-indigo-100"
              placeholder="Acme Corp"
            />
            <p className="text-xs text-slate-400">
              If this company already exists, you'll join it. Otherwise a new
              one is created.
            </p>
          </div>
        </>
      ) : null}

      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-600">Email</label>
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:ring-4 focus:ring-indigo-100"
          placeholder="you@company.com"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-600">Password</label>
        <input
          required
          type="password"
          minLength={mode === "signup" ? 8 : undefined}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:ring-4 focus:ring-indigo-100"
          placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
        />
      </div>

      {error ? (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <Button
        type="submit"
        disabled={submitting}
        className="w-full cursor-pointer"
        data-testid="password-auth-submit"
      >
        {submitting
          ? "Please wait..."
          : mode === "login"
            ? "Log in"
            : "Create account"}
      </Button>
    </form>
  );
}
