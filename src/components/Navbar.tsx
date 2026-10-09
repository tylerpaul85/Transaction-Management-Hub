import React, { useState, useRef, useEffect } from 'react';
import { useTransactions } from '../context/TransactionContext';
import { useAuth } from '../context/AuthContext';
import {
  Plus,
  Search,
  LogOut,
  ChevronDown,
  Briefcase,
  Layers,
  Bug,
  Compass,
} from 'lucide-react';
import { getStoredAvatar } from '../utils/avatarStorage';

interface NavbarProps {
  onNavigate: (path: string) => void;
  currentPath: string;
}

export const Navbar: React.FC<NavbarProps> = ({ onNavigate, currentPath }) => {
  const {
    searchQuery,
    setSearchQuery,
    setIsNewModalOpen,
  } = useTransactions();

  const { currentUser, signOut, isOps, isAdmin } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const userAvatar = currentUser ? getStoredAvatar(currentUser.id, currentUser.email) : null;

  // Keyboard shortcut '/' to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        if (
          document.activeElement?.tagName !== 'INPUT' &&
          document.activeElement?.tagName !== 'TEXTAREA'
        ) {
          e.preventDefault();
          searchInputRef.current?.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'agent':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      case 'tc':
        return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
      case 'listing_coordinator':
        return 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30';
      case 'admin':
        return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
      default:
        return 'bg-slate-500/15 text-slate-300 border-slate-500/30';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'tc':
        return 'Transaction Coord.';
      case 'listing_coordinator':
        return 'Listing Coord.';
      case 'admin':
        return 'Administrator';
      case 'agent':
        return 'Agent';
      default:
        return role;
    }
  };

  // Build nav items based on role
  const navItems: { label: string; path: string; icon: React.ReactNode; show: boolean }[] = [
    { label: 'Transaction Hub', path: '/hub', icon: <Compass className="h-4 w-4" />, show: isOps || isAdmin },
    { label: 'Escrows', path: '/ops', icon: <Layers className="h-4 w-4" />, show: isOps },
    { label: 'My Deals', path: '/my-deals', icon: <Briefcase className="h-4 w-4" />, show: true },
    { label: 'Sync Debug', path: '/admin/sync-debug', icon: <Bug className="h-4 w-4" />, show: isAdmin },
  ];

  return (
    <header className="sticky top-0 z-30 w-full border-b border-white/[0.08] bg-[#0c121e]/90 backdrop-blur-md">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3 sm:gap-6">
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-6 min-w-max">
            <button
              onClick={() => onNavigate(isOps ? '/ops' : '/my-deals')}
              className="flex items-center gap-3 text-left hover:opacity-90 transition-opacity cursor-pointer group"
            >
              <div className="h-9 w-9 rounded-xl bg-[#131b2e] border border-white/10 p-1.5 flex items-center justify-center shadow-sm group-hover:border-amber-500/40 transition-colors">
                <img
                  src="/msreg-logo.png"
                  alt="MSREG"
                  className="h-full w-auto object-contain"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-sans text-base font-bold tracking-tight text-white">
                  MSREG <span className="text-amber-400">Hub</span>
                </span>
                <span className="hidden xl:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/5 text-slate-300 border border-white/10">
                  Transactions
                </span>
              </div>
            </button>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.filter((item) => item.show).map((item) => {
                const isActive = currentPath === item.path || (item.path === '/hub' && currentPath.startsWith('/hub'));
                return (
                  <button
                    key={item.path}
                    onClick={() => onNavigate(item.path)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#182238] text-white font-semibold border border-white/10 shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    <span className={isActive ? 'text-amber-400' : 'text-slate-400'}>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-md mx-1 sm:mx-2">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search address, client, agent..."
                className="w-full pl-9 pr-14 py-1.5 bg-[#111726] border border-white/[0.1] rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40 transition-all shadow-inner"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {searchQuery ? (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-[11px] text-slate-400 hover:text-white font-medium cursor-pointer"
                  >
                    Clear
                  </button>
                ) : (
                  <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-white/5 border border-white/10 rounded">
                    /
                  </kbd>
                )}
              </div>
            </div>
          </div>

          {/* Right Actions: User Dropdown */}
          <div className="flex items-center gap-2.5 min-w-max">

            {/* Profile Trigger */}
            {currentUser && (
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-white/[0.04] transition-all border border-transparent hover:border-white/10 cursor-pointer"
                >
                  {userAvatar ? (
                    <img
                      src={userAvatar}
                      alt={currentUser.fullName}
                      className="h-8 w-8 rounded-full object-cover border border-amber-500/40 shadow-sm"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 font-bold text-xs shadow-sm">
                      {getInitials(currentUser.fullName)}
                    </div>
                  )}
                  <div className="hidden lg:block text-left">
                    <p className="text-xs font-semibold text-white leading-tight">{currentUser.fullName}</p>
                    <p className="text-[10px] text-slate-400">{getRoleLabel(currentUser.role)}</p>
                  </div>
                  <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {profileOpen && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-[#131b2e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="p-3.5 border-b border-white/10">
                      <p className="text-sm font-semibold text-white">{currentUser.fullName}</p>
                      <p className="text-xs text-slate-400 mt-0.5 truncate">{currentUser.email}</p>
                      <span
                        className={`inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${getRoleBadgeStyle(currentUser.role)}`}
                      >
                        {getRoleLabel(currentUser.role)}
                      </span>
                    </div>

                    <div className="p-1.5">
                      <button
                        onClick={() => {
                          setProfileOpen(false);
                          signOut();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors font-medium cursor-pointer"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Nav Sub-Bar */}
      <div className="md:hidden border-t border-white/[0.06] bg-[#090d16]/80 px-4 py-1.5 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1.5">
          {navItems.filter((item) => item.show).map((item) => {
            const isActive = currentPath === item.path || (item.path === '/hub' && currentPath.startsWith('/hub'));
            return (
              <button
                key={item.path}
                onClick={() => onNavigate(item.path)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-[#182238] text-white font-semibold border border-white/10 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span className={isActive ? 'text-amber-400' : 'text-slate-400'}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
