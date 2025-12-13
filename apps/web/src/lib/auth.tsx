import { Amplify } from "aws-amplify";
import { fetchAuthSession, signInWithRedirect, signOut } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { amplifyConfig } from "./amplify";
import { api, type UserPreferences } from "./api";
import { config } from "./config";
import { debugLog, isDebugEnabled } from "./debug";

Amplify.configure(amplifyConfig);
const ADMIN_EMAIL = config.adminEmail.trim().toLowerCase();

type AuthUser = {
  name?: string | null;
  email?: string | null;
  preferences?: UserPreferences;
} | null;

type AuthContextValue = {
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  token: string | null;
  user: AuthUser;
  preferences: UserPreferences;
  signIn: () => void;
  signOut: () => void;
  requireAuth: () => boolean;
  updateNickname: (nickname: string) => Promise<void>;
  updatePreferences: (preferences: Partial<UserPreferences>) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  isAuthenticated: false,
  isAdmin: false,
  isLoading: true,
  token: null,
  user: null,
  preferences: {},
  signIn: () => undefined,
  signOut: () => undefined,
  requireAuth: () => false,
  updateNickname: async () => undefined,
  updatePreferences: async () => undefined,
});

type Props = {
  children: React.ReactNode;
};

export function AuthProvider({ children }: Props) {
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser>(null);

  const hydrateSession = useCallback(async () => {
    debugLog("AuthProvider: hydrateSession invoked");
    try {
      const session = await fetchAuthSession();
      const payload = session.tokens?.idToken?.payload;
      if (!payload) {
        throw new Error("Missing ID token payload");
      }
      debugLog("AuthProvider: hydrateSession fetched session", {
        hasIdToken: Boolean(session.tokens?.idToken),
        hasAccessToken: Boolean(session.tokens?.accessToken),
        username: payload["cognito:username"],
      });
      const fallbackName =
        (payload.nickname as string | undefined) ??
        (payload.preferred_username as string | undefined) ??
        (payload.name as string | undefined) ??
        (payload["cognito:username"] as string | undefined);
      const idToken = session.tokens?.idToken?.toString() ?? null;
      let profileName: string | null = null;
      let preferences: UserPreferences = {};
      if (idToken) {
        try {
          const response = await api.getProfile(idToken);
          profileName = response.profile.displayName;
          preferences = response.profile.preferences ?? {};
        } catch (profileError) {
          debugLog("AuthProvider: failed to load profile", profileError);
        }
      }
      setUser({
        name: profileName ?? fallbackName,
        email: payload.email as string | undefined,
        preferences,
      });
      setToken(idToken);
    } catch (error) {
      debugLog("AuthProvider: hydrateSession failed", error);
      setUser(null);
      setToken(null);
    } finally {
      setIsLoading(false);
      debugLog("AuthProvider: hydrateSession finished");
    }
  }, []);

  useEffect(() => {
    debugLog("AuthProvider: initial hydrate session start");
    void hydrateSession();
  }, [hydrateSession]);

  useEffect(() => {
    debugLog("AuthProvider: registering auth Hub listener");
    const unsubscribe = Hub.listen("auth", ({ payload }) => {
      debugLog("AuthProvider: received Hub event", { event: payload.event });
      if (payload.event === "signedIn" || payload.event === "tokenRefresh") {
        debugLog("AuthProvider: refreshing session after Hub event", { event: payload.event });
        void hydrateSession();
      }
      if (payload.event === "signedOut") {
        debugLog("AuthProvider: clearing session after sign out");
        setUser(null);
        setToken(null);
      }
    });
    return () => {
      debugLog("AuthProvider: removing auth Hub listener");
      unsubscribe();
    };
  }, [hydrateSession]);

  const handleSignIn = useCallback(() => {
    debugLog("AuthProvider: signInWithRedirect invoked");
    signInWithRedirect();
  }, []);

  const handleSignOut = useCallback(() => {
    debugLog("AuthProvider: signOut invoked");
    signOut({ global: true }).finally(() => {
      setUser(null);
      setToken(null);
      setIsLoading(false);
      debugLog("AuthProvider: signOut cleanup complete");
    });
  }, []);

  const requireAuth = useCallback(() => {
    if (token) {
      debugLog("AuthProvider: requireAuth satisfied by existing token");
      return true;
    }
    debugLog("AuthProvider: requireAuth triggering sign-in");
    handleSignIn();
    return false;
  }, [token, handleSignIn]);

  const updateNickname = useCallback(
    async (nickname: string) => {
      debugLog("AuthProvider: updateNickname requested", { nickname });
      if (!token) {
        throw new Error("Authentication required");
      }
      const trimmed = nickname.trim();
      if (!trimmed) {
        throw new Error("Nickname cannot be empty");
      }
      await api.updateProfile({ displayName: trimmed, token });
      setUser((current) =>
        current
          ? {
              ...current,
              name: trimmed,
            }
          : current
      );
      debugLog("AuthProvider: nickname updated locally");
    },
    [token]
  );

  const updatePreferences = useCallback(
    async (preferences: Partial<UserPreferences>) => {
      debugLog("AuthProvider: updatePreferences requested", preferences);
      if (!token) {
        throw new Error("Authentication required");
      }
      await api.updateProfile({ preferences, token });
      setUser((current) =>
        current
          ? {
              ...current,
              preferences: {
                ...current.preferences,
                ...preferences,
              },
            }
          : current
      );
      debugLog("AuthProvider: preferences updated locally");
    },
    [token]
  );

  const valueRef = useRef<AuthContextValue>({
    isAuthenticated: false,
    isAdmin: false,
    isLoading: true,
    token: null,
    user: null,
    preferences: {},
    signIn: () => undefined,
    signOut: () => undefined,
    requireAuth: () => false,
    updateNickname: async () => undefined,
    updatePreferences: async () => undefined,
  });

  const isAdmin = Boolean(ADMIN_EMAIL && user?.email && user.email.toLowerCase() === ADMIN_EMAIL);

  const value = useMemo<AuthContextValue>(() => {
    const nextValue: AuthContextValue = {
      isAuthenticated: Boolean(token),
      isAdmin,
      isLoading,
      token,
      user,
      preferences: user?.preferences ?? {},
      signIn: handleSignIn,
      signOut: handleSignOut,
      requireAuth,
      updateNickname,
      updatePreferences,
    };
    valueRef.current = nextValue;
    return nextValue;
  }, [
    token,
    isLoading,
    user,
    handleSignIn,
    handleSignOut,
    requireAuth,
    updateNickname,
    updatePreferences,
    isAdmin,
  ]);

  useEffect(() => {
    if (isDebugEnabled()) {
      window.bookprepperAuthState = {
        isAuthenticated: Boolean(token),
        isLoading,
        user,
      };
      debugLog("AuthProvider: state snapshot", {
        isAuthenticated: Boolean(token),
        isLoading,
        hasUser: Boolean(user),
        userName: user?.name,
        userEmail: user?.email,
      });
    } else if (window.bookprepperAuthState) {
      delete window.bookprepperAuthState;
    }
  }, [token, isLoading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

declare global {
  interface Window {
    bookprepperAuthState?: {
      isAuthenticated: boolean;
      isLoading: boolean;
      user: {
        name?: string | null;
        email?: string | null;
      } | null;
    };
  }
}
