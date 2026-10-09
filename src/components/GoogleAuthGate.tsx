import React from 'react';
import { useAuth } from '../context/AuthContext';
import { AlertTriangle, Lock, Loader2 } from 'lucide-react';

export const GoogleAuthGate: React.FC = () => {
  const { signInWithGoogle, isLoading, authError, clearAuthError, devSignInAs } = useAuth();
  const workspaceDomain = import.meta.env.VITE_GOOGLE_WORKSPACE_DOMAIN || 'mattsmithrealestategroup.com';

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex items-center justify-center p-4 relative">
      <div className="relative w-full max-w-md bg-[#111726] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 text-center">

        {/* Brand Logo & Title */}
        <div className="space-y-3">
          <div className="h-16 w-16 mx-auto rounded-2xl bg-[#0d121f] border border-white/10 p-2 flex items-center justify-center shadow-inner overflow-hidden">
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
                  fallback.className = 'text-amber-400 font-bold text-lg';
                  fallback.textContent = 'MS';
                  parent.appendChild(fallback);
                }
              }}
            />
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-widest text-amber-400">
              MSREG Operations
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
              Transaction Hub
            </h1>
            <p className="text-xs text-slate-400">
              Authorized Google Workspace Access Only
            </p>
          </div>
        </div>

        {/* Access Denied / Authorization Error Callout */}
        {authError && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-left space-y-1.5">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>Access Denied</span>
            </div>
            <p className="text-xs text-rose-300 leading-relaxed">
              {authError}
            </p>
          </div>
        )}

        {/* Domain Notice Card */}
        <div className="p-3.5 bg-[#0d121f] rounded-xl border border-white/10 text-xs text-slate-400 text-left space-y-1.5">
          <div className="flex items-center gap-2 text-slate-200 font-semibold">
            <Lock className="h-3.5 w-3.5 text-amber-400" />
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
            className="w-full inline-flex items-center justify-center gap-3 px-6 py-3.5 bg-white hover:bg-slate-100 text-slate-900 font-bold rounded-xl shadow-lg transition-colors active:scale-[0.98] disabled:opacity-50 min-h-[48px]"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-slate-900" />
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

        {/* Development Quick-Access Bypass */}
        {import.meta.env.DEV && (
          <div className="pt-3 border-t border-white/10 space-y-2 text-left">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">
              Development Quick Access
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  if (devSignInAs) {
                    devSignInAs({
                      id: '89f19f53-d2e5-4b9f-a0a3-1cee85b7d03e',
                      email: 'tyler.p@mattsmithrealestategroup.com',
                      fullName: 'Tyler Paul',
                      role: 'admin',
                      active: true,
                    });
                  }
                }}
                className="p-2.5 rounded-xl bg-[#162035] hover:bg-white/10 text-xs font-semibold text-slate-200 border border-white/10 transition-colors text-center"
              >
                Tyler (Admin)
              </button>

              <button
                type="button"
                onClick={() => {
                  if (devSignInAs) {
                    devSignInAs({
                      id: 'dev-agent-shawn',
                      email: 'shawn@mattsmithrealestategroup.com',
                      fullName: 'Shawn McArthur',
                      role: 'agent',
                      active: true,
                    });
                  }
                }}
                className="p-2.5 rounded-xl bg-[#162035] hover:bg-white/10 text-xs font-semibold text-amber-400 border border-white/10 transition-colors text-center"
              >
                Shawn (Agent)
              </button>
            </div>
          </div>
        )}

        {/* Footer info */}
        <p className="text-[11px] text-slate-500">
          Need an account provisioned? Contact your transaction coordinator or system administrator.
        </p>
      </div>
    </div>
  );
};
