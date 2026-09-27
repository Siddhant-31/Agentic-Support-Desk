import { apiGet, apiPost } from "@/lib/api";
import { createContext, useContext, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

type User = {
  id: string;
  email: string;
  name?: string;
};

type MeResponse = {
  user: User;
};

type AuthContextVal = {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextVal | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchUser() {
    const res = await apiGet<MeResponse>("/auth/me");

    if (res.ok) {
      setUser(res.data.user);
    } else {
      setUser(null);
    }
  }

  useEffect(() => {
    fetchUser().finally(() => setLoading(false));
  }, []);

  async function logout() {
    await apiPost("/auth/logout");
    setUser(null);
  }

  // Re-checks the session, e.g. right after a password login/signup sets
  // the cookie, so the rest of the app picks up the now-logged-in user.
  async function refresh() {
    await fetchUser();
  }

  return (
    <AuthContext.Provider value={{ user, loading, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const contextVal = useContext(AuthContext);

  if (!contextVal) throw new Error("useauth must be used inside provider");

  return contextVal;
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login", { replace: true, state: { from: location.pathname } });
    }
  }, [loading, navigate, user, location.pathname]);

  if (loading) return <div>Checking session...</div>;
  if (!user) return null;

  return <>{children}</>;
}
