'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  ShieldCheck,
  LayoutDashboard,
  Pill,
  Bell,
  Settings,
  LogOut,
  Menu,
  X,
  User,
  ExternalLink
} from 'lucide-react';

const NAV_ITEMS = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Medicines & Batches', href: '/medicines', icon: Pill },
  { name: 'Alert History', href: '/alerts', icon: Bell },
  { name: 'Settings & Demo Tools', href: '/settings', icon: Settings },
];

export default function AppLayout({ children }) {
  const pathname = usePathname();
  const { user, logout, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F7FAFC] flex flex-col md:flex-row text-[#0F172A]">
      {/* Mobile Top Bar */}
      <header className="md:hidden bg-white border-b border-[#E2E8F0] px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#0F766E] text-white flex items-center justify-center shadow-sm">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <span className="font-bold text-base tracking-tight text-[#0F172A]">PharmaGuard</span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-[#475569] hover:text-[#0F172A] rounded-lg hover:bg-slate-100 transition"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 md:hidden animate-[fadeIn_0.2s_ease-out]"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sliding Drawer */}
      <div
        className={`fixed top-0 bottom-0 left-0 w-72 bg-white z-50 p-5 flex flex-col border-r border-[#E2E8F0] md:hidden transform transition-transform duration-200 ease-in-out ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between pb-5 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0F766E] text-white flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="font-bold text-base tracking-tight text-[#0F172A]">PharmaGuard</span>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="p-1.5 text-slate-400 hover:text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Card */}
        <div className="my-4 p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#E6F4F1] text-[#0F766E] flex items-center justify-center font-bold text-sm">
            {user?.name ? user.name[0].toUpperCase() : 'U'}
          </div>
          <div className="overflow-hidden">
            <div className="text-xs font-semibold text-[#0F172A] truncate">{user?.name || 'Pharmacist'}</div>
            <div className="text-[11px] text-[#475569] truncate">{user?.email || 'Authenticated'}</div>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 space-y-1 py-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                  isActive
                    ? 'bg-[#E6F4F1] text-[#0F766E] font-semibold'
                    : 'text-[#475569] hover:bg-slate-50 hover:text-[#0F172A]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#0F766E]' : 'text-slate-400'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="pt-4 border-t border-[#E2E8F0]">
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              logout();
            }}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-[#E2E8F0] min-h-screen sticky top-0 h-screen p-5 flex-shrink-0">
        {/* Brand */}
        <Link href="/dashboard" className="flex items-center gap-3 px-1 py-2 mb-6">
          <div className="w-9 h-9 rounded-xl bg-[#0F766E] text-white flex items-center justify-center shadow-md shadow-[#0F766E]/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="font-extrabold text-base tracking-tight text-[#0F172A] block leading-tight">
              PharmaGuard
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#0F766E] block">
              Stock & Expiry
            </span>
          </div>
        </Link>

        {/* Navigation items */}
        <nav className="flex-1 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                  isActive
                    ? 'bg-[#E6F4F1] text-[#0F766E] font-semibold shadow-xs'
                    : 'text-[#475569] hover:bg-slate-50 hover:text-[#0F172A]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#0F766E]' : 'text-slate-400'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User Card & Logout */}
        <div className="pt-4 border-t border-[#E2E8F0] space-y-3">
          <div className="p-3 bg-slate-50 border border-[#E2E8F0] rounded-xl flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#E6F4F1] text-[#0F766E] flex items-center justify-center font-bold text-sm">
              {user?.name ? user.name[0].toUpperCase() : 'U'}
            </div>
            <div className="overflow-hidden flex-1">
              <div className="text-xs font-semibold text-[#0F172A] truncate">{user?.name || 'Pharmacist'}</div>
              <div className="text-[11px] text-[#475569] truncate" title={user?.email}>
                {user?.email || 'Logged in'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50 border border-slate-200 hover:border-red-200 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Page Area */}
      <main className="flex-1 overflow-x-hidden min-h-screen">
        {children}
      </main>
    </div>
  );
}
