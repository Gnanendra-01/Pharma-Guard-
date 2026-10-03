'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import {
  Bell,
  Play,
  Calendar,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Mail,
  Clock,
  Sparkles,
  ArrowRight,
  Filter
} from 'lucide-react';

export default function AlertsPage() {
  const toast = useToast();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('ALL');

  // Manual Check & Simulated Date State
  const [simulatedDate, setSimulatedDate] = useState('');
  const [runningCheck, setRunningCheck] = useState(false);
  const [lastCheckResult, setLastCheckResult] = useState(null);

  // Load alert logs
  const loadAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get('/alerts');
      setAlerts(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(err.message || 'Failed to load alert history.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  // Run Alert Check (supports optional simulated date)
  const handleRunCheck = async (dateOverride = null) => {
    const targetDate = dateOverride !== null ? dateOverride : (simulatedDate || null);
    setRunningCheck(true);
    setLastCheckResult(null);

    try {
      const payload = targetDate ? { demoDate: targetDate } : {};
      const res = await api.post('/alerts/run-check', payload);

      setLastCheckResult(res);
      toast.success(
        `Alert check completed for date ${res.simulatedDate}: ${res.summary.digestsSent} email digest(s) sent.`
      );
      loadAlerts();
    } catch (err) {
      toast.error(err.message || 'Failed to execute manual alert check.');
    } finally {
      setRunningCheck(false);
    }
  };

  // Quick simulated date presets
  const setQuickDateOffset = (daysAhead) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const formatted = `${y}-${m}-${day}`;
    setSimulatedDate(formatted);
  };

  // Filtered alerts
  const filteredAlerts = useMemo(() => {
    if (filterType === 'ALL') return alerts;
    return alerts.filter((a) => a.type === filterType);
  }, [alerts, filterType]);

  // Counts
  const counts = useMemo(() => {
    let lowStock = 0;
    let expiring = 0;
    let expired = 0;

    alerts.forEach((a) => {
      if (a.type === 'LOW_STOCK') lowStock++;
      else if (a.type === 'EXPIRY') expiring++;
      else if (a.type === 'EXPIRED') expired++;
    });

    return { all: alerts.length, lowStock, expiring, expired };
  }, [alerts]);

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0F172A] flex items-center gap-2.5">
              <Bell className="w-6 h-6 text-[#0F766E]" />
              Alert History & Delivery Logs
            </h1>
            <p className="text-xs text-[#475569] mt-1">
              Automated notifications dispatched to pharmacy owners when stock is low or batches approach expiry.
            </p>
          </div>
          <button
            type="button"
            onClick={loadAlerts}
            className="self-start sm:self-auto p-2.5 bg-white border border-[#E2E8F0] hover:bg-slate-50 text-slate-600 rounded-xl transition shadow-xs"
            title="Refresh logs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Live Lab Demo Simulator Card */}
        <div className="bg-gradient-to-br from-[#E6F4F1] to-white border border-[#0F766E]/20 rounded-2xl p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <div className="space-y-1.5 max-w-xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-[#0F766E]/10 text-[#0F766E]">
                <Sparkles className="w-3.5 h-3.5" /> Lab Viva & Demonstration Tool
              </div>
              <h2 className="text-base font-bold text-[#0F172A]">
                Manual Alert Engine Trigger & Date Simulation
              </h2>
              <p className="text-xs text-[#475569] leading-relaxed">
                The scheduler runs automatically in the background (daily at 08:00 AM, or every 1 minute in demo mode).
                Use this card to trigger an immediate check or simulate a future date to test expiry notifications in front of evaluators.
              </p>
            </div>

            {/* Controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              {/* Date Input */}
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="date"
                  value={simulatedDate}
                  onChange={(e) => setSimulatedDate(e.target.value)}
                  className="pl-9 pr-3 py-2 text-xs bg-white border border-[#E2E8F0] rounded-xl text-[#0F172A] focus:border-[#0F766E] outline-none shadow-2xs"
                  title="Simulate a specific reference date"
                />
              </div>

              {/* Run Trigger */}
              <button
                type="button"
                disabled={runningCheck}
                onClick={() => handleRunCheck()}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0F766E] hover:bg-[#115E59] text-white text-xs font-semibold rounded-xl shadow-xs transition disabled:opacity-50"
              >
                <Play className={`w-3.5 h-3.5 ${runningCheck ? 'animate-spin' : 'fill-current'}`} />
                {runningCheck ? 'Evaluating Rules...' : 'Run Check Now'}
              </button>
            </div>
          </div>

          {/* Quick Date Simulation Chips */}
          <div className="mt-4 pt-3 border-t border-[#0F766E]/10 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-[11px] font-semibold text-[#115E59]">Fast presets:</span>
            <button
              type="button"
              onClick={() => {
                setSimulatedDate('');
                handleRunCheck('');
              }}
              className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-[#E2E8F0] text-slate-700 rounded-lg text-xs font-medium transition"
            >
              Today (Real Time)
            </button>
            <button
              type="button"
              onClick={() => {
                setQuickDateOffset(7);
                handleRunCheck(null);
              }}
              className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-[#E2E8F0] text-slate-700 rounded-lg text-xs font-medium transition"
            >
              +7 Days (Fast-forward)
            </button>
            <button
              type="button"
              onClick={() => {
                setQuickDateOffset(30);
                handleRunCheck(null);
              }}
              className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-[#E2E8F0] text-slate-700 rounded-lg text-xs font-medium transition"
            >
              +30 Days (Trigger Expiries)
            </button>
            <button
              type="button"
              onClick={() => {
                setQuickDateOffset(90);
                handleRunCheck(null);
              }}
              className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-[#E2E8F0] text-slate-700 rounded-lg text-xs font-medium transition"
            >
              +90 Days (Trigger Expired)
            </button>
          </div>

          {/* Last Run Summary Banner */}
          {lastCheckResult && (
            <div className="mt-4 p-3.5 bg-white border border-emerald-200 rounded-xl flex items-center justify-between text-xs animate-[fadeIn_0.2s_ease-out]">
              <div className="flex items-center gap-2 text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>
                  Check executed for <strong className="font-mono">{lastCheckResult.simulatedDate}</strong>.
                  Evaluated: {lastCheckResult.summary.lowStockCount} low stock, {lastCheckResult.summary.expiringCount} expiring, {lastCheckResult.summary.expiredCount} expired.
                </span>
              </div>
              <span className="font-semibold text-emerald-700 font-mono text-[11px]">
                {lastCheckResult.summary.digestsSent} email digest(s) sent
              </span>
            </div>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'ALL', label: 'All Alerts', count: counts.all },
            { id: 'LOW_STOCK', label: 'Low Stock', count: counts.lowStock, color: 'text-orange-700 bg-orange-100' },
            { id: 'EXPIRY', label: 'Expiring Soon', count: counts.expiring, color: 'text-amber-700 bg-amber-100' },
            { id: 'EXPIRED', label: 'Expired', count: counts.expired, color: 'text-red-700 bg-red-100' },
          ].map((tab) => {
            const active = filterType === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterType(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  active
                    ? 'bg-[#0F766E] text-white shadow-xs'
                    : 'bg-white border border-[#E2E8F0] text-[#475569] hover:bg-slate-50'
                }`}
              >
                {tab.label}
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    active ? 'bg-white/20 text-white' : tab.color || 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Alerts Table / Feed */}
        {loading ? (
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-12 text-center">
            <div className="w-8 h-8 border-3 border-[#0F766E] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-[#475569]">Loading alert history...</p>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Bell className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-[#0F172A]">No alert logs recorded</h3>
            <p className="text-xs text-[#475569] mt-1 max-w-sm mx-auto">
              No alert notifications match this filter. Use the <strong>&quot;Run Check Now&quot;</strong> button above to evaluate your inventory against thresholds.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-xs overflow-hidden">
            <div className="divide-y divide-[#E2E8F0]">
              {filteredAlerts.map((alert) => {
                let badgeClass = 'bg-blue-50 text-blue-700 border-blue-200';
                let Icon = Bell;

                if (alert.type === 'LOW_STOCK') {
                  badgeClass = 'bg-orange-50 text-orange-700 border-orange-200';
                  Icon = AlertTriangle;
                } else if (alert.type === 'EXPIRY') {
                  badgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
                  Icon = Clock;
                } else if (alert.type === 'EXPIRED') {
                  badgeClass = 'bg-red-50 text-red-700 border-red-200';
                  Icon = AlertCircle;
                }

                return (
                  <div
                    key={alert.id}
                    className="p-4 sm:p-5 hover:bg-slate-50/60 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badgeClass}`}>
                          <Icon className="w-3 h-3" />
                          {alert.type}
                        </span>

                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-md">
                          <Mail className="w-3 h-3 text-slate-400" />
                          {alert.channel}
                        </span>

                        <span
                          className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                            alert.status === 'SENT'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {alert.status}
                        </span>

                        {alert.medicine_batch_id && (
                          <span className="font-mono text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                            Batch: {alert.medicine_batch_id}
                          </span>
                        )}
                      </div>

                      <p className="text-sm font-medium text-[#0F172A] leading-relaxed">
                        {alert.message}
                      </p>

                      {alert.medicine_name && (
                        <div className="text-[11px] text-slate-500">
                          Medicine reference:{' '}
                          <span className="font-semibold text-slate-700">{alert.medicine_name}</span>
                        </div>
                      )}
                    </div>

                    <div className="text-left sm:text-right flex-shrink-0 text-slate-400 text-[11px] font-mono">
                      <div>{alert.sent_at}</div>
                      <div className="text-[10px] text-slate-400">Recorded in SQLite</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
