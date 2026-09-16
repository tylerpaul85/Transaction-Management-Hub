import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../integrations/supabase/client';
import { AppRole, DbProfile } from '../types/database.types';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: AppRole;
  agent_id?: string | null;
  ops_user_id?: string | null;
  active?: boolean;
}

interface AuthContextType {
  currentUser: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;
  clearAuthError: () => void;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  // Convenience role checks
  role: AppRole | null;
  isAgent: boolean;
  isOps: boolean;
  isAdmin: boolean;
  isTc: boolean;
  isListingCoordinator: boolean;
}

const GOOGLE_WORKSPACE_DOMAIN = import.meta.env.VITE_GOOGLE_WORKSPACE_DOMAIN || 'msreg.com';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Hydrate an AuthUser from the profiles allowlist table.
 * Returns null if the user is not found or is inactive (access denied).
 */
async function hydrateUserFromProfile(email: string): Promise<AuthUser | null> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email.toLowerCase())
    .maybeSingle();

  if (error) {
    console.error('[AuthContext] Error querying profiles:', error);
    return null;
  }

  const p = profile as unknown as DbProfile | null;

  if (!p || p.active === false) {
    return null;
  }

  return {
    id: p.id,
    email: p.email,
    fullName: p.name || p.full_name || p.email.split('@')[0],
    role: p.role,
    agent_id: p.agent_id,
    ops_user_id: p.ops_user_id,
    active: p.active,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true); // start loading until session check completes
  const [authError, setAuthError] = useState<string | null>(null);

  const isAuthenticated = currentUser !== null;

  // ─── Initial session check on mount ───────────────────────────────
  useEffect(() => {
    let mounted = true;

    const checkExistingSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user?.email && mounted) {
          const user = await hydrateUserFromProfile(session.user.email);
          if (user) {
            setCurrentUser(user);
          } else {
            // User exists in Supabase Auth but isn't in profiles allowlist
            await supabase.auth.signOut();
          }
        }
      } catch (err) {
        console.error('[AuthContext] Session check error:', err);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    checkExistingSession();

    return () => {
      mounted = false;
    };
  }, []);

  // ─── Live auth state listener (handles OAuth callback & sign-out) ──
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user?.email) {
        setIsLoading(true);
        setAuthError(null);

        try {
          const user = await hydrateUserFromProfile(session.user.email);

          if (user) {
            setCurrentUser(user);
            setAuthError(null);
          } else {
            console.warn(`[Access Denied] ${session.user.email} is not in the profiles allowlist.`);
            await supabase.auth.signOut();
            setAuthError("Your account hasn't been set up yet — contact an admin.");
          }
        } catch (err: any) {
          console.error('[AuthContext] Authorization check error:', err);
          await supabase.auth.signOut();
          setAuthError("Something went wrong verifying your account. Please try again.");
        } finally {
          setIsLoading(false);
        }
      }

      if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setIsLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // ─── Google Workspace OAuth Sign-in ────────────────────────────────
  const signInWithGoogle = useCallback(async () => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          queryParams: {
            hd: GOOGLE_WORKSPACE_DOMAIN,
            access_type: 'offline',
            prompt: 'select_account',
          },
          redirectTo: window.location.origin,
        },
      });

      if (error) {
        throw error;
      }
    } catch (err: any) {
      console.error('[AuthContext] Google OAuth error:', err);
      setAuthError(err.message || 'Failed to initialize Google Workspace login.');
      setIsLoading(false);
    }
  }, []);

  // ─── Sign Out ──────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    setIsLoading(true);
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('[AuthContext] Sign out warning:', err);
    } finally {
      setCurrentUser(null);
      setIsLoading(false);
    }
  }, []);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  // ─── Derived role helpers ──────────────────────────────────────────
  const role = currentUser?.role ?? null;
  const isAgent = role === 'agent';
  const isOps = role === 'tc' || role === 'listing_coordinator' || role === 'admin';
  const isAdmin = role === 'admin';
  const isTc = role === 'tc';
  const isListingCoordinator = role === 'listing_coordinator';

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated,
        isLoading,
        authError,
        clearAuthError,
        signInWithGoogle,
        signOut,
        role,
        isAgent,
        isOps,
        isAdmin,
        isTc,
        isListingCoordinator,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
