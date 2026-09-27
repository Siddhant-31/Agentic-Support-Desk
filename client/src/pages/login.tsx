import { Button } from "@/components/ui/button";
import PasswordAuthForm from "@/components/auth/password-auth-form";
import { useAuth } from "@/context/auth";
import { BACKEND_URL } from "@/lib/api";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();
  const { user, loading, refresh } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      navigate("/support", { replace: true });
    }
  }, [loading, user, navigate]);

  function onLogin() {
    window.location.href = `${BACKEND_URL}/auth/login`;
  }

  if (loading) return <div className="text-sm">Checking session...</div>;

  if (user) return null;

  return (
    <div className="min-h-screen bg-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-24 left-1/2 h-72 w-208 -translate-x-1/2 rounded-full bg-linear-to-r from-indigo-200/40 via-sky-200/35 to-emerald-200/30 blur-3xl" />
        <div className="absolute top-48 left-10 h-56 w-56 rounded-full bg-indigo-100/60 blur-3xl" />
        <div className="absolute bottom-16 right-10 h-56 w-56 rounded-full bg-sky-100/60 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.06)_1px,transparent_0)] bg-size-[24px_24px]" />
      </div>
      <div className="relative mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              Agentic Support Desk
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
              Triage tickets. Draft replies.
              <span className="block text-slate-700">
                Save runs for audit and reuse
              </span>
            </h1>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200  bg-white/80 p-4 shadow-sm">
                <div className="text-sm font-semibold text-slate-900">
                  Structured Output
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  Category, reply and next actions
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200  bg-white/80 p-4 shadow-sm">
                <div className="text-sm font-semibold text-slate-900">
                  Get results as fast as possible
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  Call any model you want
                </div>
              </div>
            </div>
          </div>
          <div className="lg:justify-self-end">
            <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white/90 p-6 backdrop-blur shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div className="text-2xl font-semibold text-slate-900">
                  Continue to Agent
                </div>
              </div>
              <div className="mt-6 space-y-4">
                <PasswordAuthForm
                  onAuthed={async () => {
                    await refresh();
                    navigate("/support", { replace: true });
                  }}
                />

                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <div className="h-px flex-1 bg-slate-200" />
                  or
                  <div className="h-px flex-1 bg-slate-200" />
                </div>

                <Button
                  data-testid="login-btn"
                  variant="outline"
                  className="w-full cursor-pointer"
                  onClick={onLogin}
                >
                  Continue with SSO
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
