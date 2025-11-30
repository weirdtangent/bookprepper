import { Amplify } from "aws-amplify";
import { fetchAuthSession, signInWithRedirect, signOut, updateUserAttributes } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { amplifyConfig } from "./amplify";
import { debugLog, isDebugEnabled } from "./debug";

Amplify.configure(amplifyConfig);

type AuthContextValue = {
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  user: {
    name?: string | null;
    email?: string | null;
  } | null;
  signIn: () => void;
  signOut: () => void;
  requireAuth: () => boolean;
  updateNickname: (nickname: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  isAuthenticated: false,
  isLoading: true,
  token: null,
  user: null,
  signIn: () => undefined,
  signOut: () => undefined,
  requireAuth: () => false,
  updateNickname: async () => undefined
});

type Props = {
  children: React.ReactNode;
};

export function AuthProvider({ children }: Props) {
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<{ name?: string | null; email?: string | null } | null>(null);

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
        username: payload["cognito:username"]
      });
      const name =
        (payload.nickname as string | undefined) ??
        (payload.preferred_username as string | undefined) ??
        (payload.name as string | undefined) ??
        (payload["cognito:username"] as string | undefined);
      setUser({
        name,
        email: payload.email as string | undefined
      });
      setToken(session.tokens?.idToken?.toString() ?? null);
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
      await updateUserAttributes({
        userAttributes: {
          nickname
        }
      });
      debugLog("AuthProvider: nickname updated, rehydrating session");
      await hydrateSession();
    },
    [hydrateSession]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: Boolean(token),
      isLoading,
      token,
      user,
      signIn: handleSignIn,
      signOut: handleSignOut,
      requireAuth,
      updateNickname
    }),
    [token, isLoading, user, handleSignIn, handleSignOut, requireAuth, updateNickname]
  );

  useEffect(() => {
    if (isDebugEnabled()) {
      window.bookprepperAuthState = {
        isAuthenticated: Boolean(token),
        isLoading,
        user
      };
      debugLog("AuthProvider: state snapshot", {
        isAuthenticated: Boolean(token),
        isLoading,
        hasUser: Boolean(user),
        userName: user?.name,
        userEmail: user?.email
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

