'use client';

import Link from 'next/link';
import { ShoppingBag, Search, Store, ShieldCheck, Heart, User, Truck } from 'lucide-react';
import { useEffect, useState } from 'react';

export function Header() {
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const updateCount = () => {
      const saved = localStorage.getItem('nexio_cart');
      if (saved) {
        try {
          const items = JSON.parse(saved);
          const count = items.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0);
          setCartCount(count);
        } catch {
          setCartCount(0);
        }
      }
    };
    updateCount();
    window.addEventListener('storage', updateCount);
    return () => window.removeEventListener('storage', updateCount);
  }, []);

  return (
    <header className="bg-slate-900 text-white sticky top-0 z-40 shadow-xl border-b border-slate-800">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-slate-950 font-black text-center py-2 px-4 text-xs flex items-center justify-center gap-2">
        <ShieldCheck className="w-4 h-4 text-slate-950" />
        <span>شحن سريع لجميع محافظات العراق الـ 18 (بغداد، البصرة، أربيل، النجف) - الدفع عند الاستلام أو زين كاش وكي كارد</span>
      </div>

      {/* Main Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-6">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="p-2.5 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-xl shadow-lg shadow-emerald-500/30 group-hover:scale-105 transition-transform">
            <Store className="w-6 h-6 text-slate-950" />
          </div>
          <div>
            <span className="text-xl font-extrabold tracking-tight text-white block">Nexio Store</span>
            <span className="text-[10px] text-emerald-400 font-semibold block -mt-1">المتجر العراقي المباشر</span>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-bold">
          <Link href="/" className="text-slate-200 hover:text-emerald-400 transition-colors">الرئيسية</Link>
          <Link href="/products" className="text-slate-200 hover:text-emerald-400 transition-colors">المنتجات والتصنيفات</Link>
          <Link href="/track-order" className="text-slate-200 hover:text-emerald-400 transition-colors flex items-center gap-1.5">
            <Truck className="w-4 h-4 text-emerald-400" />
            <span>تتبع الطلب</span>
          </Link>
          <Link href="/account" className="text-slate-200 hover:text-emerald-400 transition-colors flex items-center gap-1.5">
            <User className="w-4 h-4 text-indigo-400" />
            <span>حسابي والأقساط</span>
          </Link>
        </nav>

        {/* Action Icons */}
        <div className="flex items-center gap-4">
          <Link
            href="/cart"
            className="flex items-center gap-2.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black rounded-xl text-xs shadow-lg shadow-emerald-600/30 transition-all relative"
          >
            <ShoppingBag className="w-4 h-4 text-slate-950" />
            <span>السلة</span>
            {cartCount > 0 && (
              <span className="w-5 h-5 bg-slate-950 text-emerald-400 font-bold rounded-full flex items-center justify-center text-[10px]">
                {cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
