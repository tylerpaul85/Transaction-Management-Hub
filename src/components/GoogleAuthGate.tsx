import React from 'react';
import { useAuth } from '../context/AuthContext';
import { AlertTriangle, Lock, Loader2 } from 'lucide-react';

export const GoogleAuthGate: React.FC = () => {
  const { signInWithGoogle, isLoading, authError, clearAuthError } = useAuth();
  const workspaceDomain = import.meta.env.VITE_GOOGLE_WORKSPACE_DOMAIN || 'msreg.com';

  return (
    <div className="min-h-screen bg-[#0f172a] text-[#f8fafc] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background gradient accents */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gradient-to-b from-[#d97706]/5 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-gradient-to-tl from-sky-500/3 to-transparent rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md bg-[#1e293b] border border-[#334155] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center">

        {/* Brand Logo & Title */}
        <div className="space-y-2">
          <div className="h-16 w-16 mx-auto rounded-2xl bg-[#131826] border border-[#334155] p-2 flex items-center justify-center shadow-inner overflow-hidden">
            <img
              src="/msreg-logo.png"
              alt="MSREG Logo"
              className="h-full w-auto object-contain"
              onError={(e) => {
                // Hide img tag on error, show fallback text
                (e.target as HTMLElement).style.display = 'none';
                const parent = (e.target as HTMLElement).parentElement;
                if (parent) {
                  const fallback = document.createElement('span');
                  fallback.className = 'text-[#d97706] font-bold text-lg';
                  fallback.textContent = 'MS';
                  parent.appendChild(fallback);
                }
              }}
            />
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#d97706]">
              MSREG Marketing Hub
            </span>
            <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-[#f8fafc]">
              Transaction Management
            </h1>
            <p className="text-xs text-[#94a3b8]">
              Authorized Google Workspace Access Only
            </p>
          </div>
        </div>

        {/* Access Denied / Authorization Error Callout */}
        {authError && (
          <div className="p-4 bg-rose-500/15 border border-rose-500/40 rounded-2xl text-left space-y-1.5">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>Access Denied</span>
            </div>
            <p className="text-xs text-rose-200 leading-relaxed">
              {authError}
            </p>
          </div>
        )}

        {/* Domain Notice Card */}
        <div className="p-3.5 bg-[#131826] rounded-2xl border border-[#334155] text-xs text-[#94a3b8] text-left space-y-1.5">
          <div className="flex items-center gap-2 text-[#f8fafc] font-semibold">
            <Lock className="h-3.5 w-3.5 text-[#d97706]" />
            <span>Single Sign-On (SSO) Enforced</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            Public sign-up is disabled. Access is strictly restricted to active team members allowlisted on the <strong>@{workspaceDomain}</strong> domain.
          </p>
        </div>

        {/* Sole Sign-In Action: Google OAuth */}
        <div className="space-y-3">
          <button
            onClick={() => signInWithGoogle()}
            disabled={isLoading}
            className="w-full inline-flex items-center justify-center gap-3 px-6 py-3.5 bg-[#f8fafc] hover:bg-white text-[#0f172a] font-bold rounded-2xl shadow-xl hover:shadow-2xl transition-all active:scale-[0.98] disabled:opacity-50 min-h-[48px]"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-[#0f172a]" />
                <span>Authorizing with Google…</span>
              </>
            ) : (
              <>
                {/* Official Google 'G' Icon */}
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span className="text-sm font-bold">Sign in with Google</span>
              </>
            )}
          </button>
        </div>

        {/* Footer info */}
        <p className="text-[11px] text-[#94a3b8]/70">
          Need an account provisioned? Contact your transaction coordinator or system administrator.
        </p>
      </div>
    </div>
  );
};
