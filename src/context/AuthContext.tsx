import React, { createContext, useContext, useState, useEffect } from 'react';
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

export const SAMPLE_ACCOUNTS: AuthUser[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'tyler.agent@msreg.com',
    fullName: 'Tyler Miller',
    role: 'agent',
    active: true,
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'sophia.agent@msreg.com',
    fullName: 'Sophia Montgomery',
    role: 'agent',
    active: true,
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    email: 'sarah.tc@msreg.com',
    fullName: 'Sarah Jenkins',
    role: 'tc',
    active: true,
  },
  {
    id: '55555555-5555-5555-5555-555555555555',
    email: 'michael.lc@msreg.com',
    fullName: 'Michael Chang',
    role: 'listing_coordinator',
    active: true,
  },
  {
    id: '66666666-6666-6666-6666-666666666666',
    email: 'admin@msreg.com',
    fullName: 'David Admin',
    role: 'admin',
    active: true,
  },
];

interface AuthContextType {
  currentUser: AuthUser;
  setCurrentUser: (user: AuthUser) => void;
  role: AppRole;
  setRole: (role: AppRole) => void;
  isAgent: boolean;
  isOps: boolean;
  isAdmin: boolean;
  isTc: boolean;
  isListingCoordinator: boolean;
  switchAccount: (email: string) => void;
  isLoading: boolean;
  authError: string | null;
  clearAuthError: () => void;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const STORAGE_AUTH_KEY = 'msreg_auth_simulated_user_v1';
const GOOGLE_WORKSPACE_DOMAIN = import.meta.env.VITE_GOOGLE_WORKSPACE_DOMAIN || 'msreg.com';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUserState] = useState<AuthUser>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_AUTH_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // fallback
    }
    return SAMPLE_ACCOUNTS[0]; // default: Tyler Miller (Agent)
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_AUTH_KEY, JSON.stringify(currentUser));
    } catch {
      // ignore
    }
  }, [currentUser]);

  // Listen to live Supabase Auth session & perform Authorization Allowlist Check
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setIsLoading(true);
        setAuthError(null);
        const userEmail = (session.user.email || '').toLowerCase();

        try {
          // Query profiles table for an authorized active row matching email
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', userEmail)
            .maybeSingle();

          if (error) {
            console.error('Error verifying user profile in allowlist:', error);
          }

          const p = profile as unknown as DbProfile | null;

          // Authorization verification:
          // If no matching profile row exists OR active is false -> Deny Session immediately
          if (!p || p.active === false) {
            console.warn(`[Access Denied] ${userEmail} is not active in profiles allowlist.`);
            await supabase.auth.signOut();
            setAuthError("Your account hasn't been set up yet — contact an admin.");
            return;
          }

          // Successful Authorization
          setCurrentUserState({
            id: p.id,
            email: p.email,
            fullName: p.name || p.full_name || p.email.split('@')[0],
            role: p.role,
            agent_id: p.agent_id,
            ops_user_id: p.ops_user_id,
            active: p.active,
          });
          setAuthError(null);
        } catch (err: any) {
          console.error('Error during authorization check:', err);
          await supabase.auth.signOut();
          setAuthError("Your account hasn't been set up yet — contact an admin.");
        } finally {
          setIsLoading(false);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Google Workspace OAuth Sign-in with Hosted Domain restriction
  const signInWithGoogle = async () => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          queryParams: {
            hd: GOOGLE_WORKSPACE_DOMAIN, // Restricts sign-in to company Google Workspace domain
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
      console.error('Google OAuth sign-in error:', err);
      setAuthError(err.message || 'Failed to initialize Google Workspace login.');
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Supabase sign out warning:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const clearAuthError = () => {
    setAuthError(null);
  };

  const setCurrentUser = (user: AuthUser) => {
    setCurrentUserState(user);
  };

  const setRole = (role: AppRole) => {
    setCurrentUserState((prev) => ({ ...prev, role }));
  };

  const switchAccount = (email: string) => {
    const found = SAMPLE_ACCOUNTS.find((a) => a.email === email);
    if (found) {
      setCurrentUserState(found);
      setAuthError(null);
    }
  };

  const role = currentUser.role;
  const isAgent = role === 'agent';
  const isOps = role === 'tc' || role === 'listing_coordinator' || role === 'admin';
  const isAdmin = role === 'admin';
  const isTc = role === 'tc';
  const isListingCoordinator = role === 'listing_coordinator';

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        role,
        setRole,
        isAgent,
        isOps,
        isAdmin,
        isTc,
        isListingCoordinator,
        switchAccount,
        isLoading,
        authError,
        clearAuthError,
        signInWithGoogle,
        signOut,
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
