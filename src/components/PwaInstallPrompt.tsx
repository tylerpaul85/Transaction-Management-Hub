import React, { useState, useEffect } from 'react';
import { Download, Share2, PlusSquare, X, Smartphone, Check } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const PwaInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  useEffect(() => {
    // 1. Check if already installed / running in standalone window
    const standaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');

    setIsStandalone(standaloneMode);
    if (standaloneMode) return;

    // 2. Check if user dismissed prompt recently (2 days)
    const dismissedTimestamp = localStorage.getItem('msreg_pwa_dismissed');
    if (dismissedTimestamp) {
      const diffDays = (Date.now() - Number(dismissedTimestamp)) / (1000 * 60 * 60 * 24);
      if (diffDays < 2) {
        setIsDismissed(true);
      }
    }

    // 3. Detect iOS Safari
    const ua = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(ua) && !(window as any).MSStream;
    const isSafari = ua.includes('safari') && !ua.includes('crios') && !ua.includes('fxios');
    if (isAppleDevice && isSafari) {
      setIsIOS(true);
      // Show prompt after a slight delay on iOS if not dismissed
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 3000);
      return () => clearTimeout(timer);
    }

    // 4. Capture native Chromium/Android beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Wait 2.5 seconds after load before sliding up banner
      setTimeout(() => {
        setIsVisible(true);
      }, 2500);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsVisible(false);
      setInstallSuccess(true);
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    // Listen for manual trigger from menu/navbar
    const handleManualShow = () => {
      setIsDismissed(false);
      setIsVisible(true);
    };
    window.addEventListener('msreg-pwa-show-install', handleManualShow);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('msreg-pwa-show-install', handleManualShow);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }

    if (!deferredPrompt) {
      // Fallback for browsers without beforeinstallprompt
      setShowIOSGuide(true);
      return;
    }

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setInstallSuccess(true);
        setTimeout(() => setIsVisible(false), 2000);
      }
      setDeferredPrompt(null);
    } catch (err) {
      console.warn('[PWA] Error launching install prompt:', err);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    localStorage.setItem('msreg_pwa_dismissed', String(Date.now()));
  };

  if (isStandalone || isDismissed || (!isVisible && !showIOSGuide)) {
    return null;
  }

  return (
    <>
      {/* Floating PWA Install Bar */}
      {isVisible && !showIOSGuide && (
        <aside
          aria-label="Install MSREG Hub Application"
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50 bg-[#131b2e]/95 backdrop-blur-xl border border-amber-500/30 rounded-2xl p-4 shadow-2xl shadow-black/60 animate-in fade-in slide-in-from-bottom-4 duration-300"
        >
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-xl bg-[#090d16] border border-amber-500/30 p-2 flex items-center justify-center shrink-0 shadow-inner">
              <img
                src="/msreg-logo.png"
                alt="MSREG Logo"
                className="h-full w-full object-contain drop-shadow"
              />
            </div>

            <div className="flex-1 min-w-0 pr-4">
              <div className="flex items-center gap-1.5">
                <h4 className="text-sm font-bold text-white tracking-tight">Install MSREG Hub</h4>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  App
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 leading-snug">
                Add to your phone or desktop home screen for instant 1-tap access and full-screen experience.
              </p>
            </div>

            <button
              onClick={handleDismiss}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer shrink-0 -mr-1 -mt-1"
              aria-label="Dismiss banner"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/10">
            <button
              onClick={handleDismiss}
              className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              Maybe Later
            </button>
            <button
              onClick={handleInstallClick}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-md shadow-amber-500/20 transition-all cursor-pointer"
            >
              {installSuccess ? (
                <>
                  <Check className="h-4 w-4" />
                  <span>Installed!</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  <span>{isIOS ? 'Add to Home Screen' : 'Install App'}</span>
                </>
              )}
            </button>
          </div>
        </aside>
      )}

      {/* iOS Step-by-Step Instructions Modal */}
      {showIOSGuide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ios-pwa-guide-title"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
        >
          <div className="w-full max-w-sm bg-[#131b2e] border border-white/10 rounded-2xl p-5 shadow-2xl text-left space-y-4">
            <div className="flex items-start justify-between gap-2 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-[#090d16] border border-amber-500/30 p-1.5 flex items-center justify-center">
                  <Smartphone className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <h3 id="ios-pwa-guide-title" className="text-sm font-bold text-white">Add to Home Screen</h3>
                  <p className="text-[11px] text-slate-400">Install MSREG Hub on iPhone / iPad</p>
                </div>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <ol className="space-y-3 text-xs text-slate-200">
              <li className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-300 font-bold text-[11px] border border-amber-500/30">
                  1
                </span>
                <p className="leading-snug">
                  Tap the <strong className="text-white">Share</strong> button <Share2 className="inline h-3.5 w-3.5 mx-0.5 text-sky-400" /> in Safari's bottom toolbar.
                </p>
              </li>

              <li className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-300 font-bold text-[11px] border border-amber-500/30">
                  2
                </span>
                <p className="leading-snug">
                  Scroll down the menu and tap <strong className="text-white">Add to Home Screen</strong> <PlusSquare className="inline h-3.5 w-3.5 mx-0.5 text-amber-400" />.
                </p>
              </li>

              <li className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-300 font-bold text-[11px] border border-amber-500/30">
                  3
                </span>
                <p className="leading-snug">
                  Tap <strong className="text-white">Add</strong> in the top-right corner. The MSREG app icon will now appear on your phone's home screen!
                </p>
              </li>
            </ol>

            <button
              onClick={() => {
                setShowIOSGuide(false);
                setIsVisible(false);
                localStorage.setItem('msreg_pwa_dismissed', String(Date.now()));
              }}
              className="w-full py-2.5 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors cursor-pointer shadow-md shadow-amber-500/20"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
};
