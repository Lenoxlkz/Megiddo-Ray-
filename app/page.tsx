'use client';

import dynamic from 'next/dynamic';

const DashboardClient = dynamic(() => import('@/components/DashboardClient'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-black flex items-center justify-center text-emerald-400">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-mono text-neutral-400">Iniciando Liquid Fast Download...</span>
      </div>
    </div>
  ),
});

export default function Page() {
  return <DashboardClient />;
}

