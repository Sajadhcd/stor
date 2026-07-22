'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Phone, ShoppingBag, Boxes, MapPin, ArrowLeft, LogOut, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function CustomerAccountIndexPage() {
  const router = useRouter();
  const [customerPhone, setCustomerPhone] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [inputPhone, setInputPhone] = useState('');

  useEffect(() => {
    const savedPhone = localStorage.getItem('nexio_customer_phone');
    if (savedPhone) {
      setCustomerPhone(savedPhone);
      setIsLoggedIn(true);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPhone) return;
    localStorage.setItem('nexio_customer_phone', inputPhone);
    setCustomerPhone(inputPhone);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('nexio_customer_phone');
    setIsLoggedIn(false);
    setCustomerPhone('');
  };

  if (!isLoggedIn) {
    return (
      <div className="max-w-md mx-auto space-y-6 py-12">
        <div className="text-center space-y-2">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl w-fit mx-auto">
            <User className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-slate-900">تسجيل الدخول إلى حساب العميل</h1>
          <p className="text-xs text-slate-500">أدخل رقم هاتفك العراقي لمتابعة الطلبات والأقساط وعناوين الشحن.</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف العراقي</label>
              <input
                type="text"
                required
                value={inputPhone}
                onChange={(e) => setInputPhone(e.target.value)}
                placeholder="0770 123 4567"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dir-ltr text-right"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black rounded-2xl text-sm transition-all shadow-lg shadow-emerald-600/30 cursor-pointer"
            >
              متابعة الحساب
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header Profile Info */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl">
            <User className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">مرحباً بك في حسابك الشخصي</h2>
            <p className="text-xs text-slate-400 font-mono mt-0.5 dir-ltr text-right">{customerPhone}</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded-xl text-xs font-bold transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>خروج</span>
        </button>
      </div>

      {/* Account Management Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          href="/account/orders"
          className="p-6 bg-white rounded-3xl border border-slate-200 shadow-xs hover:border-emerald-500 transition-all group space-y-4"
        >
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl w-fit">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base group-hover:text-emerald-600 transition-colors">طلباتي السابقة</h3>
            <p className="text-xs text-slate-400 mt-1">عرض السجل الكامل لطلباتك وحالتها والتتبع المباشر.</p>
          </div>
        </Link>

        <Link
          href="/account/installments"
          className="p-6 bg-white rounded-3xl border border-slate-200 shadow-xs hover:border-emerald-500 transition-all group space-y-4"
        >
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl w-fit">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base group-hover:text-emerald-600 transition-colors">عقود الأقساط المباشرة</h3>
            <p className="text-xs text-slate-400 mt-1">متابعة الأقساط الشهرية والمتبقي والأقساط المسددة.</p>
          </div>
        </Link>

        <Link
          href="/account/profile"
          className="p-6 bg-white rounded-3xl border border-slate-200 shadow-xs hover:border-emerald-500 transition-all group space-y-4"
        >
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl w-fit">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base group-hover:text-emerald-600 transition-colors">العناوين والمحفظة</h3>
            <p className="text-xs text-slate-400 mt-1">إدارة العناوين المحفوظة والمعلومات الشخصية.</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
