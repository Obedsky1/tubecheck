import { create } from "zustand";
import { api, User, Organization } from "@/lib/api";

const USER_CACHE_KEY = "cs_user";
const ORG_CACHE_KEY = "cs_org";
const INIT_TIMEOUT_MS = 5000; // 5s max — never hang forever

function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function clearCache() {
  localStorage.removeItem(USER_CACHE_KEY);
  localStorage.removeItem(ORG_CACHE_KEY);
}

interface AuthState {
  token: string | null;
  user: User | null;
  org: Organization | null;
  loading: boolean;
  initialized: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => void;
  initialize: () => Promise<void>;
  syncSession: () => Promise<void>;
  setSelectedOrg: (org: Organization) => void;
}

export const useAuth = create<AuthState>((set, get) => ({
  token: typeof window !== "undefined" ? localStorage.getItem("cs_token") : null,
  // Hydrate immediately from cache — zero network wait on return visits
  user: typeof window !== "undefined" ? readCache<User>(USER_CACHE_KEY) : null,
  org: typeof window !== "undefined" ? readCache<Organization>(ORG_CACHE_KEY) : null,
  loading: false,
  initialized: false,
  error: null,

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const res = await api.login({ email, password });
      localStorage.setItem("cs_token", res.access_token);
      set({ token: res.access_token });

      const [user, orgs] = await Promise.all([api.getMe(), api.getMyOrgs()]);
      const defaultOrg = orgs.length > 0 ? orgs[0] : null;

      writeCache(USER_CACHE_KEY, user);
      writeCache(ORG_CACHE_KEY, defaultOrg);
      set({ user, org: defaultOrg, loading: false, initialized: true });
    } catch (err: any) {
      set({ error: err.message || "Login failed", loading: false });
      throw err;
    }
  },

  loginWithGoogle: async (credential) => {
    set({ loading: true, error: null });
    try {
      const res = await api.loginWithGoogle({ credential });
      localStorage.setItem("cs_token", res.access_token);
      set({ token: res.access_token });

      const [user, orgs] = await Promise.all([api.getMe(), api.getMyOrgs()]);
      const defaultOrg = orgs.length > 0 ? orgs[0] : null;

      writeCache(USER_CACHE_KEY, user);
      writeCache(ORG_CACHE_KEY, defaultOrg);
      set({ user, org: defaultOrg, loading: false, initialized: true });
    } catch (err: any) {
      set({ error: err.message || "Google Login failed", loading: false });
      throw err;
    }
  },

  register: async (email, password, fullName) => {
    set({ loading: true, error: null });
    try {
      await api.register({ email, password, full_name: fullName });
      const res = await api.login({ email, password });
      localStorage.setItem("cs_token", res.access_token);
      set({ token: res.access_token });

      const [user, orgs] = await Promise.all([api.getMe(), api.getMyOrgs()]);
      const defaultOrg = orgs.length > 0 ? orgs[0] : null;

      writeCache(USER_CACHE_KEY, user);
      writeCache(ORG_CACHE_KEY, defaultOrg);
      set({ user, org: defaultOrg, loading: false, initialized: true });
    } catch (err: any) {
      set({ error: err.message || "Registration failed", loading: false });
      throw err;
    }
  },

  logout: () => {
    localStorage.removeItem("cs_token");
    clearCache();
    set({ token: null, user: null, org: null, error: null, initialized: false });
  },

  initialize: async () => {
    const { token, initialized } = get();
    if (initialized) return;

    if (!token) {
      set({ initialized: true });
      return;
    }

    // If we already have cached user data, mark as initialized immediately
    // so the UI renders without waiting for the network.
    const cachedUser = readCache<User>(USER_CACHE_KEY);
    const cachedOrg = readCache<Organization>(ORG_CACHE_KEY);

    if (cachedUser) {
      set({ user: cachedUser, org: cachedOrg, initialized: true, loading: false });

      // Silently revalidate in the background — update cache but don't block UI
      Promise.race([
        Promise.all([api.getMe(), api.getMyOrgs()]),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), INIT_TIMEOUT_MS)
        ),
      ])
        .then(([freshUser, freshOrgs]) => {
          const freshOrg = freshOrgs.length > 0 ? freshOrgs[0] : null;
          writeCache(USER_CACHE_KEY, freshUser);
          writeCache(ORG_CACHE_KEY, freshOrg);
          set({ user: freshUser, org: freshOrg });
        })
        .catch((err) => {
          if (err.message !== "timeout") {
            // Token likely expired — force logout
            localStorage.removeItem("cs_token");
            clearCache();
            set({ token: null, user: null, org: null, initialized: true });
          }
          // On timeout we keep the cached session alive
        });

      return;
    }

    // No cache — must fetch with timeout protection
    set({ loading: true });
    try {
      const result = await Promise.race([
        Promise.all([api.getMe(), api.getMyOrgs()]),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), INIT_TIMEOUT_MS)
        ),
      ]);

      const [user, orgs] = result;
      const defaultOrg = orgs.length > 0 ? orgs[0] : null;

      writeCache(USER_CACHE_KEY, user);
      writeCache(ORG_CACHE_KEY, defaultOrg);
      set({ user, org: defaultOrg, initialized: true, loading: false });
    } catch (err: any) {
      // Expired token or unreachable backend
      localStorage.removeItem("cs_token");
      clearCache();
      set({ token: null, user: null, org: null, initialized: true, loading: false });
    }
  },

  syncSession: async () => {
    try {
      const [user, orgs] = await Promise.all([api.getMe(), api.getMyOrgs()]);
      const defaultOrg = orgs.length > 0 ? orgs[0] : null;
      writeCache(USER_CACHE_KEY, user);
      writeCache(ORG_CACHE_KEY, defaultOrg);
      set({ user, org: defaultOrg });
    } catch (err) {
      console.error("Failed to sync session:", err);
    }
  },

  setSelectedOrg: (org) => {
    writeCache(ORG_CACHE_KEY, org);
    set({ org });
  },
}));
