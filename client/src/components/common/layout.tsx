import { Sparkles } from "lucide-react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { Button } from "../ui/button";
import { useAuth } from "@/context/auth";

export default function CommonLayout() {
  const navigate = useNavigate();
  const { loading, logout, user } = useAuth();

  async function onlogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="fixed inset-0">
        <div className="absolute -top-28 left-1/2 h-72 w-208 -translate-x-1/2 rounded-full bg-linear-to-r from-indigo-200/35 via-sky-200/30 to-emerald-200/25 blur-3xl" />
      </div>
      <header className="sticky top-0 z-20 border-b border-slate-300 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <Link to="/">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-linear-to-r from-indigo-500 to-sky-600 text-white shadow-sm">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <div className="text-md font-semibold tracking-tight text-slate-900">
                  Support Planner
                </div>
              </div>
            </div>
          </Link>

          <div className="ml-auto flex items-center gap-2">
            {!loading && user ? (
              <Button onClick={onlogout}>Logout</Button>
            ) : null}
          </div>
        </div>
      </header>
      <main className="relative mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
