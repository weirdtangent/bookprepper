import { Amplify } from "aws-amplify";
import { fetchAuthSession, getCurrentUser, signInWithRedirect, signOut } from "aws-amplify/auth";
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
      const [currentUser, session] = await Promise.all([getCurrentUser(), fetchAuthSession()]);
      setUser({
        name: currentUser.username ?? currentUser.signInDetails?.loginId,
        email: session.tokens?.idToken?.payload?.email as string | undefined
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

