'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import {
  Settings,
  Mail,
  Sliders,
  Clock,
  Repeat,
  Save,
  Sparkles,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  HelpCircle
} from 'lucide-react';

export default function SettingsPage() {
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingAlert, setTestingAlert] = useState(false);

  // Form Fields
  const [alertEmail, setAlertEmail] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState(100);
  const [expiryWarningDays, setExpiryWarningDays] = useState(30);
  const [alertRepeatDays, setAlertRepeatDays] = useState(10);

  // Load Settings
  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get('/settings');
      if (data?.settings) {
        setAlertEmail(data.settings.alert_email || '');
        setLowStockThreshold(data.settings.low_stock_threshold ?? 100);
        setExpiryWarningDays(data.settings.expiry_warning_days ?? 30);
        setAlertRepeatDays(data.settings.alert_repeat_days ?? 10);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to load configuration settings.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Submit Settings
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!alertEmail || !alertEmail.includes('@')) {
      toast.error('Please enter a valid email address.');
      return;
    }

    const threshold = parseInt(lowStockThreshold, 10);
    const warningDays = parseInt(expiryWarningDays, 10);
    const repeatDays = parseInt(alertRepeatDays, 10);

    if (isNaN(threshold) || threshold < 1) {
      toast.error('Low stock threshold must be at least 1.');
      return;
    }
    if (isNaN(warningDays) || warningDays < 1) {
      toast.error('Expiry warning days must be at least 1.');
      return;
    }
    if (isNaN(repeatDays) || repeatDays < 1 || repeatDays > 15) {
      toast.error('Alert repeat interval must be between 1 and 15 days.');
      return;
    }

    setSaving(true);
    try {
      await api.put('/settings', {
        alert_email: alertEmail.trim(),
        low_stock_threshold: threshold,
        expiry_warning_days: warningDays,
        alert_repeat_days: repeatDays,
      });

      toast.success('Pharmacy alert settings updated successfully!');
      loadSettings();
    } catch (err) {
      toast.error(err.message || 'Failed to update settings.');
    } finally {
      setSaving(false);
    }
  };

  // Test Run
  const handleTestAlertCheck = async () => {
    setTestingAlert(true);
    try {
      const res = await api.post('/alerts/run-check', {});
      toast.success(
        `Alert engine triggered: ${res.summary.digestsSent} digest email(s) dispatched to ${alertEmail}.`
      );
    } catch (err) {
      toast.error(err.message || 'Failed to trigger alert check.');
    } finally {
      setTestingAlert(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A] flex items-center gap-2.5">
            <Settings className="w-6 h-6 text-[#0F766E]" />
            Pharmacy Settings & Alert Parameters
          </h1>
          <p className="text-xs text-[#475569] mt-1">
            Configure threshold triggers for automated email delivery, repeat frequency, and background scheduler settings.
          </p>
        </div>

        {loading ? (
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-12 text-center">
            <div className="w-8 h-8 border-3 border-[#0F766E] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-[#475569]">Loading pharmacy parameters...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Main Settings Form */}
            <form onSubmit={handleSubmit} className="bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
              <h2 className="text-base font-bold text-[#0F172A] pb-3 border-b border-[#E2E8F0]">
                Threshold & Notification Configuration
              </h2>

              {/* Alert Email */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#475569] mb-1.5">
                  Alert Recipient Email Address <span className="text-red-500">*</span>
                </label>
                <div className="relative rounded-xl max-w-md">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={alertEmail}
                    onChange={(e) => setAlertEmail(e.target.value)}
                    placeholder="pharmacy.owner@gmail.com"
                    className="block w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-[#E2E8F0] rounded-xl text-[#0F172A] focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E] outline-none"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Digest emails containing low-stock warnings and expiring batch alerts are sent here.
                </p>
              </div>

              {/* Grid of Thresholds */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-2">
                {/* Low Stock Threshold */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#475569] mb-1.5 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-orange-600" />
                    Low Stock Threshold
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={lowStockThreshold}
                    onChange={(e) => setLowStockThreshold(e.target.value)}
                    className="block w-full px-3.5 py-2.5 text-sm bg-white border border-[#E2E8F0] rounded-xl text-[#0F172A] focus:border-[#0F766E] outline-none"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Triggers warning when batch quantity is &le; this number (default: 100).
                  </p>
                </div>

                {/* Expiry Warning Window */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#475569] mb-1.5 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    Expiry Warning (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={expiryWarningDays}
                    onChange={(e) => setExpiryWarningDays(e.target.value)}
                    className="block w-full px-3.5 py-2.5 text-sm bg-white border border-[#E2E8F0] rounded-xl text-[#0F172A] focus:border-[#0F766E] outline-none"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Alerts when batch expires within this many days (default: 30).
                  </p>
                </div>

                {/* Alert Repeat Interval */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#475569] mb-1.5 flex items-center gap-1.5">
                    <Repeat className="w-3.5 h-3.5 text-[#0F766E]" />
                    Repeat Interval (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="15"
                    step="1"
                    required
                    value={alertRepeatDays}
                    onChange={(e) => setAlertRepeatDays(e.target.value)}
                    className="block w-full px-3.5 py-2.5 text-sm bg-white border border-[#E2E8F0] rounded-xl text-[#0F172A] focus:border-[#0F766E] outline-none"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Minimum days before re-sending alert for same batch (1–15 days).
                  </p>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-4 border-t border-[#E2E8F0] flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0F766E] hover:bg-[#115E59] text-white text-xs font-semibold rounded-xl shadow-xs transition disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving Changes...' : 'Save Settings'}
                </button>
              </div>
            </form>

            {/* Viva & Lab Demo Tools Card */}
            <div className="bg-gradient-to-br from-[#E6F4F1] to-white border border-[#0F766E]/20 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#0F766E]" />
                <h3 className="text-sm font-bold text-[#0F172A]">
                  Software Engineering Lab & Viva Demo Diagnostics
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 bg-white border border-[#E2E8F0] rounded-xl space-y-2">
                  <div className="font-semibold text-[#0F172A] flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-[#0F766E]" />
                    Background node-cron Engine
                  </div>
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    Production runs daily at <strong>08:00 AM</strong> (<code className="font-mono text-[10px] bg-slate-100 px-1 py-0.5 rounded">0 8 * * *</code>).
                    In demo mode (<code className="font-mono text-[10px] bg-slate-100 px-1 py-0.5 rounded">DEMO_MODE=true</code>), runs automatically every <strong>1 minute</strong>.
                  </p>
                </div>

                <div className="p-4 bg-white border border-[#E2E8F0] rounded-xl space-y-2">
                  <div className="font-semibold text-[#0F172A] flex items-center gap-1.5">
                    <Mail className="w-4 h-4 text-[#0F766E]" />
                    Email Delivery Channel
                  </div>
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    Powered by Nodemailer using Gmail SMTP with an App Password. If credentials are unset, it automatically logs formatted HTML digests to the terminal console as a fallback.
                  </p>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="text-[11px] text-slate-500">
                  Click to trigger an instant test check and verify email delivery right now:
                </div>
                <button
                  type="button"
                  disabled={testingAlert}
                  onClick={handleTestAlertCheck}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-white border border-[#0F766E] text-[#0F766E] hover:bg-[#0F766E] hover:text-white rounded-xl text-xs font-semibold transition shadow-2xs disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  {testingAlert ? 'Dispatching Test...' : 'Send Test Alert Check'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
