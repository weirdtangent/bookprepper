import { Amplify } from "aws-amplify";
import { fetchAuthSession, signInWithRedirect, signOut } from "aws-amplify/auth";
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
};

const AuthContext = createContext<AuthContextValue>({
  isAuthenticated: false,
  isLoading: true,
  token: null,
  user: null,
  signIn: () => undefined,
  signOut: () => undefined,
  requireAuth: () => false
});

type Props = {
  children: React.ReactNode;
};

export function AuthProvider({ children }: Props) {
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<{ name?: string | null; email?: string | null } | null>(null);

  const hydrateSession = useCallback(async () => {
    try {
      const session = await fetchAuthSession();
      const payload = session.tokens?.idToken?.payload;
      if (!payload) {
        throw new Error("Missing ID token payload");
      }
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
    } catch {
      setUser(null);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void hydrateSession();
  }, [hydrateSession]);

  useEffect(() => {
    const unsubscribe = Hub.listen("auth", ({ payload }) => {
      if (payload.event === "signedIn" || payload.event === "tokenRefresh") {
        void hydrateSession();
      }
      if (payload.event === "signedOut") {
        setUser(null);
        setToken(null);
      }
    });
    return unsubscribe;
  }, [hydrateSession]);

  const handleSignIn = useCallback(() => {
    signInWithRedirect();
  }, []);

  const handleSignOut = useCallback(() => {
    signOut({ global: true }).finally(() => {
      setUser(null);
      setToken(null);
      setIsLoading(false);
    });
  }, []);

  const requireAuth = useCallback(() => {
    if (token) {
      return true;
    }
    handleSignIn();
    return false;
  }, [token, handleSignIn]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: Boolean(token),
      isLoading,
      token,
      user,
      signIn: handleSignIn,
      signOut: handleSignOut,
      requireAuth
    }),
    [token, isLoading, user, handleSignIn, handleSignOut, requireAuth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

