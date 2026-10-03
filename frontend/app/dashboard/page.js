'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import AppLayout from '@/components/AppLayout';
import StatusBadge, { getDaysRemaining } from '@/components/StatusBadge';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import {
  LayoutDashboard,
  Pill,
  AlertTriangle,
  Clock,
  AlertCircle,
  Plus,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  Bell,
  Sliders,
  ShieldAlert,
  Sparkles,
  CheckCircle2
} from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    total: 0,
    expiringSoon: 0,
    expired: 0,
    lowStock: 0,
    thresholds: { lowStockThreshold: 100, expiryWarningDays: 30 }
  });
  const [attentionItems, setAttentionItems] = useState([]);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get('/dashboard/summary');
      if (data) {
        setSummary(data.summary || {
          total: 0,
          expiringSoon: 0,
          expired: 0,
          lowStock: 0,
          thresholds: { lowStockThreshold: 100, expiryWarningDays: 30 }
        });
        setAttentionItems(data.attentionItems || []);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to load dashboard summary.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Top Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0F172A] flex items-center gap-2.5">
              <LayoutDashboard className="w-6 h-6 text-[#0F766E]" />
              Pharmacy Safety Dashboard
            </h1>
            <p className="text-xs text-[#475569] mt-1">
              Welcome back, <strong className="text-[#0F172A]">{user?.name || 'Pharmacist'}</strong>.
              Here is the current status of your medicine stock and batch expiries.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={loadDashboard}
              className="p-2.5 bg-white border border-[#E2E8F0] hover:bg-slate-50 text-slate-600 rounded-xl transition shadow-xs"
              title="Refresh dashboard"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <Link
              href="/medicines/new"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0F766E] hover:bg-[#115E59] text-white text-xs font-semibold rounded-xl shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              Add Medicine Batch
            </Link>
          </div>
        </div>

        {/* Critical Alert Warning Banner (Only shown if expired items exist) */}
        {!loading && summary.expired > 0 && (
          <div className="p-4 bg-red-50 border-2 border-red-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-red-800 animate-[fadeIn_0.2s_ease-out]">
            <div className="flex items-start sm:items-center gap-3">
              <div className="p-2 bg-red-100 text-red-700 rounded-xl flex-shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold">
                  URGENT COMPLIANCE NOTICE: {summary.expired} Expired Medicine Batch{summary.expired > 1 ? 'es' : ''}!
                </h4>
                <p className="text-xs text-red-700 mt-0.5">
                  Expired medicines must be pulled from the dispensing shelves immediately to avoid patient risk and regulatory non-compliance.
                </p>
              </div>
            </div>
            <Link
              href="/medicines"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl transition flex-shrink-0 shadow-xs"
            >
              View Expired Batches
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {/* 4 Summary Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Total Batches */}
          <Link
            href="/medicines"
            className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-xs hover:border-[#0F766E]/40 hover:shadow-sm transition group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total Batches
              </span>
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center group-hover:bg-[#E6F4F1] group-hover:text-[#0F766E] transition">
                <Pill className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-extrabold text-[#0F172A] font-mono">
              {loading ? '—' : summary.total}
            </div>
            <div className="mt-2 text-xs text-slate-500 flex items-center gap-1">
              Active inventory batches in SQLite
            </div>
          </Link>

          {/* 2. Low Stock */}
          <Link
            href="/medicines"
            className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-xs hover:border-orange-300 hover:shadow-sm transition group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-orange-600">
                Low Stock
              </span>
              <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-extrabold text-orange-600 font-mono">
              {loading ? '—' : summary.lowStock}
            </div>
            <div className="mt-2 text-xs text-slate-500 flex items-center gap-1">
              Below threshold (≤ {summary.thresholds?.lowStockThreshold || 100} units)
            </div>
          </Link>

          {/* 3. Expiring Soon */}
          <Link
            href="/medicines"
            className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-xs hover:border-amber-300 hover:shadow-sm transition group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-600">
                Expiring Soon
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-extrabold text-amber-600 font-mono">
              {loading ? '—' : summary.expiringSoon}
            </div>
            <div className="mt-2 text-xs text-slate-500 flex items-center gap-1">
              Within warning window (≤ {summary.thresholds?.expiryWarningDays || 30} days)
            </div>
          </Link>

          {/* 4. Expired */}
          <Link
            href="/medicines"
            className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-xs hover:border-red-300 hover:shadow-sm transition group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-red-600">
                Expired Batches
              </span>
              <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                <AlertCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-extrabold text-red-600 font-mono">
              {loading ? '—' : summary.expired}
            </div>
            <div className="mt-2 text-xs text-slate-500 flex items-center gap-1">
              Pull from shelf immediately
            </div>
          </Link>
        </div>

        {/* Urgent Attention Items Section */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
            <div>
              <h2 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-[#0F766E]" />
                Batches Requiring Immediate Attention
              </h2>
              <p className="text-xs text-[#475569] mt-0.5">
                Prioritized by safety severity: Expired batches first, followed by earliest expiries and low stock.
              </p>
            </div>
            <Link
              href="/medicines"
              className="text-xs font-semibold text-[#0F766E] hover:text-[#115E59] flex items-center gap-1"
            >
              View Full Inventory
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">
              <div className="w-8 h-8 border-3 border-[#0F766E] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              Analyzing inventory attention items...
            </div>
          ) : attentionItems.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
              <div className="font-bold text-sm text-[#0F172A]">All Stock In Safe Parameters</div>
              <p className="max-w-md mx-auto text-slate-400">
                None of your batches are expired, expiring within {summary.thresholds?.expiryWarningDays || 30} days,
                or below {summary.thresholds?.lowStockThreshold || 100} units.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-2.5 px-3">Medicine Name</th>
                    <th className="py-2.5 px-3">Batch ID</th>
                    <th className="py-2.5 px-3 text-right">In Stock</th>
                    <th className="py-2.5 px-3">Expiry Date</th>
                    <th className="py-2.5 px-3">Issue Reason</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attentionItems.map((med) => {
                    return (
                      <tr key={med.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3 px-3 font-semibold text-[#0F172A] text-sm">
                          {med.name}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-500">
                          {med.batch_id}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-sm">
                          <span
                            className={
                              med.is_low_stock
                                ? 'text-orange-600 bg-orange-50 px-2 py-0.5 rounded'
                                : 'text-slate-700'
                            }
                          >
                            {med.quantity}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          <div>{med.expiry_date}</div>
                          <div className="text-[10px] text-slate-400">
                            {med.days_left < 0
                              ? `${Math.abs(med.days_left)} days overdue`
                              : `${med.days_left} days remaining`}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <StatusBadge
                            expiryDate={med.expiry_date}
                            quantity={med.quantity}
                            lowStockThreshold={summary.thresholds?.lowStockThreshold || 100}
                            expiryWarningDays={summary.thresholds?.expiryWarningDays || 30}
                            compact
                          />
                        </td>
                        <td className="py-3 px-3 text-right">
                          <Link
                            href="/medicines"
                            className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 hover:bg-[#E6F4F1] hover:text-[#0F766E] text-slate-700 font-semibold rounded-lg transition"
                          >
                            Manage
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick Demo Shortcuts Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/alerts"
            className="p-4 bg-white border border-[#E2E8F0] rounded-2xl shadow-xs hover:border-[#0F766E]/40 hover:shadow-sm transition flex items-start gap-3"
          >
            <div className="p-2.5 bg-[#E6F4F1] text-[#0F766E] rounded-xl">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#0F172A]">Run Alert Check</h3>
              <p className="text-xs text-[#475569] mt-0.5 leading-relaxed">
                Test the alert engine on demand with a simulated future date.
              </p>
            </div>
          </Link>

          <Link
            href="/medicines"
            className="p-4 bg-white border border-[#E2E8F0] rounded-2xl shadow-xs hover:border-[#0F766E]/40 hover:shadow-sm transition flex items-start gap-3"
          >
            <div className="p-2.5 bg-[#E6F4F1] text-[#0F766E] rounded-xl">
              <Pill className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#0F172A]">Sell / Restock</h3>
              <p className="text-xs text-[#475569] mt-0.5 leading-relaxed">
                Dispense medicine or restock inventory with audit history logging.
              </p>
            </div>
          </Link>

          <Link
            href="/settings"
            className="p-4 bg-white border border-[#E2E8F0] rounded-2xl shadow-xs hover:border-[#0F766E]/40 hover:shadow-sm transition flex items-start gap-3"
          >
            <div className="p-2.5 bg-[#E6F4F1] text-[#0F766E] rounded-xl">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#0F172A]">Configure Settings</h3>
              <p className="text-xs text-[#475569] mt-0.5 leading-relaxed">
                Adjust stock thresholds, warning days, and alert recipient email.
              </p>
            </div>
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}
