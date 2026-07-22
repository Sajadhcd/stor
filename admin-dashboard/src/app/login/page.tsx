'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Store, Lock, Mail, AlertCircle, ArrowLeft, ShieldCheck } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { saveSession } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@veloactivewear.com');
  const [password, setPassword] = useState('Admin@123');
  const [subdomain, setSubdomain] = useState(process.env.NEXT_PUBLIC_DEFAULT_TENANT_SUBDOMAIN || 'velo');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, subdomain }),
      });

      saveSession(data.access_token, data.refresh_token, data.user);
      router.push('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'فشل تسجيل الدخول. تحقق من اسم المستخدم وكلمة المرور.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('Admin@123');
    setSubdomain(
      demoEmail === 'admin@scribble.com'
        ? 'scribble'
        : demoEmail === 'platform@nexio.iq'
          ? 'platform'
          : 'velo',
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white dir-rtl font-sans relative overflow-hidden">
      {/* Dynamic Background Glow Effect */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10">
        {/* Brand Logo */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="p-3.5 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-2xl shadow-xl shadow-indigo-500/30 mb-4">
            <Store className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">Nexio Commerce</h1>
          <p className="text-sm text-slate-400 mt-1">تسجيل الدخول إلى لوحة إدارة التاجر</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-3 text-rose-400 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2">معرّف المتجر</label>
            <input
              type="text"
              required
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value.trim().toLowerCase())}
              placeholder="velo"
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all dir-ltr"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2">البريد الإلكتروني</label>
            <div className="relative">
              <Mail className="w-5 h-5 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@veloactivewear.com"
                className="w-full pr-11 pl-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all dir-ltr text-right"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2">كلمة المرور</label>
            <div className="relative">
              <Lock className="w-5 h-5 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pr-11 pl-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all dir-ltr text-right"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>جاري التحقق...</span>
              </>
            ) : (
              <>
                <span>الدخول إلى لوحة التحكم</span>
                <ArrowLeft className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Demo Quick-Fill Accounts */}
        <div className="mt-8 pt-6 border-t border-slate-800">
          <p className="text-xs text-slate-400 mb-3 text-center font-medium">حسابات التجار التجريبية (بيانات حقيقية):</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleQuickFill('admin@veloactivewear.com')}
              className="p-2.5 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 rounded-xl text-xs text-slate-300 transition-colors text-center"
            >
              <div className="font-bold text-white">Velo Activewear</div>
              <div className="text-[10px] text-slate-400 truncate">admin@veloactivewear.com</div>
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('admin@scribble.com')}
              className="p-2.5 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 rounded-xl text-xs text-slate-300 transition-colors text-center"
            >
              <div className="font-bold text-white">Scribble Books</div>
              <div className="text-[10px] text-slate-400 truncate">admin@scribble.com</div>
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('platform@nexio.iq')}
              className="p-2.5 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 rounded-xl text-xs text-slate-300 transition-colors text-center"
            >
              <div className="font-bold text-white">Nexio Platform</div>
              <div className="text-[10px] text-slate-400 truncate">platform@nexio.iq</div>
            </button>
          </div>
        </div>

        {/* Security Badge */}
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-emerald-400 font-medium">
          <ShieldCheck className="w-4 h-4" />
          <span>محمي بتقنية Row-Level Security (RLS)</span>
        </div>
      </div>
    </div>
  );
}
