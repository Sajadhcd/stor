'use client';

import { useEffect, useState } from 'react';
import { formatIQD } from '@/lib/currency';
import { ShoppingBag, Trash2, ArrowLeft, ShieldCheck, CreditCard } from 'lucide-react';
import Link from 'next/link';

export default function CartPage() {
  const [cart, setCart] = useState<any[]>([]);

  const loadCart = () => {
    const saved = localStorage.getItem('nexio_cart');
    if (saved) {
      try {
        setCart(JSON.parse(saved));
      } catch {
        setCart([]);
      }
    }
  };

  useEffect(() => {
    loadCart();
  }, []);

  const updateQuantity = (id: string, newQty: number) => {
    if (newQty < 1) return;
    const updated = cart.map((item) => (item.id === id ? { ...item, quantity: newQty } : item));
    setCart(updated);
    localStorage.setItem('nexio_cart', JSON.stringify(updated));
    window.dispatchEvent(new Event('storage'));
  };

  const removeItem = (id: string) => {
    const updated = cart.filter((item) => item.id !== id);
    setCart(updated);
    localStorage.setItem('nexio_cart', JSON.stringify(updated));
    window.dispatchEvent(new Event('storage'));
  };

  const subtotal = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">سلة التسوق والمشتريات</h1>
          <p className="text-sm text-slate-500 mt-1">مراجعة المنتجات المضافة وتجهيز التوصيل للمحافظات العراقية.</p>
        </div>
      </div>

      {cart.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs space-y-4">
          <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-lg font-bold text-slate-700">سلة التسوق فارغة حالياً</h3>
          <p className="text-xs text-slate-400">تصفح كتالوج المنتجات واكتشف أفضل العروض بالدينار العراقي.</p>
          <Link
            href="/products"
            className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black rounded-xl text-xs transition-all shadow-lg shadow-emerald-600/30"
          >
            <span>استعرض المنتجات</span>
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items List */}
          <div className="lg:col-span-2 space-y-4">
            {cart.map((item) => (
              <div key={item.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center text-2xl font-bold">
                    🛍️
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{item.title}</h4>
                    <span className="text-xs font-black text-emerald-600 block mt-1">{formatIQD(item.price)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  {/* Quantity Controls */}
                  <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-slate-50 text-xs font-bold">
                    <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="px-2.5 py-1.5 text-slate-600 hover:bg-slate-200">
                      -
                    </button>
                    <span className="px-3 py-1.5 text-slate-900">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="px-2.5 py-1.5 text-slate-600 hover:bg-slate-200">
                      +
                    </button>
                  </div>

                  <button onClick={() => removeItem(item.id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Cart Summary Panel */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">ملخص الفاتورة</h3>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span>المجموع الفرعي:</span>
                  <span className="font-bold text-slate-900">{formatIQD(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>رسوم التوصيل المقدرة:</span>
                  <span className="font-bold text-emerald-600">حسب المحافظة</span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-baseline justify-between">
                <span className="text-xs font-bold text-slate-700">المجموع الكلي:</span>
                <span className="text-2xl font-black text-emerald-600">{formatIQD(subtotal)}</span>
              </div>
            </div>

            <Link
              href="/checkout"
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black rounded-2xl text-sm shadow-xl shadow-emerald-600/30 transition-all flex items-center justify-center gap-2"
            >
              <span>المتابعة لإدخال عنوان التوصيل</span>
              <ArrowLeft className="w-4 h-4 text-slate-950" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
