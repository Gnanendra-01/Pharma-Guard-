'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7FAFC]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-3 border-[#0F766E] border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium text-[#475569]">Loading PharmaGuard...</span>
      </div>
    </div>
  );
}
