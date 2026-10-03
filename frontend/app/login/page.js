'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { ShieldCheck, Mail, Lock, ArrowRight, Sparkles } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please provide both email and password.');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back to PharmaGuard!');
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
      toast.error(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoCredentials = () => {
    setEmail('demo@pharmaguard.com');
    setPassword('Demo@1234');
    setError('');
    toast.info('Demo credentials populated.');
  };

  return (
    <div className="min-h-screen bg-[#F7FAFC] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Logo & Brand Header */}
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#0F766E] text-white shadow-md shadow-[#0F766E]/20 mb-4">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-[#0F172A]">PharmaGuard</h1>
        <p className="mt-1 text-sm text-[#475569]">
          Pharmacy Expiry & Stock Safety Management
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-sm border border-[#E2E8F0] rounded-2xl sm:px-10">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-[#0F172A]">Sign In</h2>
            <p className="text-xs text-[#475569] mt-1">
              Enter your pharmacy account details to access stock and alerts.
            </p>
          </div>

          {/* Quick Demo Credentials Banner */}
          <div className="mb-6 p-3.5 bg-[#E6F4F1] border border-[#0F766E]/20 rounded-xl flex items-center justify-between gap-3">
            <div className="text-xs text-[#115E59]">
              <span className="font-semibold block flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Lab Demo Account
              </span>
              <span>demo@pharmaguard.com</span>
            </div>
            <button
              type="button"
              onClick={fillDemoCredentials}
              className="text-xs font-semibold px-3 py-1.5 bg-[#0F766E] text-white rounded-lg hover:bg-[#115E59] transition shadow-sm"
            >
              Fill Demo
            </button>
          </div>

          {error && (
            <div className="mb-5 p-3.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl leading-relaxed">
              {error}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-[#475569]">
                Email Address
              </label>
              <div className="mt-1.5 relative rounded-lg">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="pharmacist@store.com"
                  className="block w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-[#E2E8F0] rounded-xl text-[#0F172A] placeholder-slate-400 focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E] outline-none transition"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-[#475569]">
                Password
              </label>
              <div className="mt-1.5 relative rounded-lg">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-[#E2E8F0] rounded-xl text-[#0F172A] placeholder-slate-400 focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E] outline-none transition"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-[#0F766E] hover:bg-[#115E59] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0F766E] disabled:opacity-60 transition"
              >
                {loading ? 'Authenticating...' : 'Sign In to Dashboard'}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
          </form>

          <div className="mt-6 pt-5 border-t border-[#E2E8F0] text-center">
            <p className="text-xs text-[#475569]">
              Don&apos;t have an account?{' '}
              <Link
                href="/register"
                className="font-semibold text-[#0F766E] hover:text-[#115E59] transition"
              >
                Create pharmacy account
              </Link>
            </p>
          </div>
        </div>

        <div className="text-center mt-6 text-xs text-slate-400">
          PharmaGuard • Software Engineering Laboratory Prototype
        </div>
      </div>
    </div>
  );
}
