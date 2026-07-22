'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { ProductCard } from '@/components/products/ProductCard';
import { ShieldCheck, Truck, CreditCard, ShoppingBag, ArrowLeft, Star, Boxes, Sparkles } from 'lucide-react';
import Link from 'next/link';

export default function StorefrontHomePage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProducts() {
      try {
        const result = await apiFetch('/products');

        console.log('Products API Response:', result);

        // الـ API يرجع { data: [...], meta: {...} }
        setProducts(result.data ?? []);
      } catch (err) {
        console.error('Failed to load products:', err);
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, []);

  return (
    <div className="space-y-12">
      {/* Hero Banner Section */}
      <section className="bg-gradient-to-tr from-slate-900 via-slate-850 to-emerald-950 text-white rounded-3xl p-8 md:p-12 shadow-2xl relative overflow-hidden border border-slate-800">
        <div className="max-w-2xl space-y-6 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-bold border border-emerald-500/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>المتجر الرسمي العراقي - الأسعار بالدينار العراقي (د.ع)</span>
          </div>

          <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-tight">
            تسوق أفضل المنتجات مع الشحن المباشر لكافة محافظات العراق
          </h1>

          <p className="text-sm md:text-base text-slate-300 leading-relaxed font-medium">
            نوفر لكم تجربة تسوق آمنة وسريعة مع إمكانية الدفع عند الاستلام أو عبر المحافظ الإلكترونية زين كاش وكي كارد وآسيا حوالة.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Link
              href="/products"
              className="px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-sm shadow-xl shadow-emerald-500/20 transition-all flex items-center gap-2"
            >
              <span>استعرض كافة المنتجات</span>
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 text-sm">توصيل لـ 18 محافظة</h4>
            <p className="text-xs text-slate-500 mt-0.5">بغداد، البصرة، أربيل، النجف وكل العراق</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 text-sm">دفع عند الاستلام أو إلكتروني</h4>
            <p className="text-xs text-slate-500 mt-0.5">زين كاش، كي كارد، آسيا حوالة</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-violet-50 text-violet-600 rounded-xl">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 text-sm">ضمان استرجاع حقيقي</h4>
            <p className="text-xs text-slate-500 mt-0.5">فحص المنتجات قبل الاستلام</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 text-sm">بيع بالأقساط المباشرة</h4>
            <p className="text-xs text-slate-500 mt-0.5">أقساط ميسرة حتى 6 أشهر</p>
          </div>
        </div>
      </section>

      {/* Featured Products Section */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">المنتجات المميزة في الكتالوج</h2>
            <p className="text-sm text-slate-500 mt-1">تصفح أحدث المنتجات المتاحة للشحن السوري والمباشر بالدينار العراقي.</p>
          </div>
          <Link href="/products" className="text-sm font-bold text-emerald-600 hover:text-emerald-500 flex items-center gap-1">
            <span>عرض الكل</span>
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">جاري جلب قائمة المنتجات...</div>
        ) : products.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">لا توجد منتجات مسجلة حالياً في المتجر.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
