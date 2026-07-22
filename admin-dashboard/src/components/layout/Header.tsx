'use client';

import { useEffect, useState } from 'react';
import { Search, Bell, ShieldCheck, User } from 'lucide-react';
import { getSession, UserSession } from '@/lib/auth';

export function Header() {
  const [session, setSession] = useState<UserSession | null>(null);

  useEffect(() => {
    setSession(getSession());
  }, []);

  return (
    <header className="bg-white border-b border-slate-200 h-16 px-8 flex items-center justify-between sticky top-0 z-40 shadow-xs">
      {/* Search Bar */}
      <div className="relative w-96">
        <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="ابحث في المنتجات، الطلبات، والعملاء..."
          className="w-full pl-4 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800"
        />
      </div>

      {/* Actions & User Status */}
      <div className="flex items-center gap-5">
        {/* RLS Status Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-semibold border border-emerald-200/60">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>عزل المستأجر RLS نشط</span>
        </div>

        {/* Notifications */}
        <button className="p-2.5 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 left-2 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white"></span>
        </button>

        {/* User Info */}
        <div className="flex items-center gap-3 pr-4 border-r border-slate-200">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-indigo-500/20">
            {session?.name ? session.name[0] : <User className="w-5 h-5" />}
          </div>
          <div className="text-right">
            <h4 className="text-xs font-bold text-slate-900">{session?.name || 'مستخدم تاجر'}</h4>
            <p className="text-[11px] text-slate-500 font-medium">{session?.email || 'admin@veloactivewear.com'}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
