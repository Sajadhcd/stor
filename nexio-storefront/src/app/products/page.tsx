'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { ProductCard } from '@/components/products/ProductCard';
import { Search, Filter, Package } from 'lucide-react';

export default function ProductsListingPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProducts() {
      try {
        const result = await apiFetch('/products');

        console.log('Products API Response:', result);

        setProducts(result.data ?? []);
      } catch (err: any) {
        console.error('Failed to load products:', err);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, []);

  const filteredProducts = products.filter((p) => {
    const title = typeof p.titleTranslations === 'object'
      ? (p.titleTranslations.ar || p.titleTranslations.en || '')
      : '';
    return title.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-8">
      {/* Header & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">كتالوج المنتجات والأسعار (IQD)</h1>
          <p className="text-sm text-slate-500 mt-1">تصفح كافة المنتجات بالدينار العراقي الشاملة للتوصيل الضامن.</p>
        </div>

        <div className="relative min-w-[280px]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث عن منتج بالاسم..."
            className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
        </div>
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 text-sm">جاري تحميل المنتجات...</div>
      ) : filteredProducts.length === 0 ? (
        <div className="py-20 text-center text-slate-400 text-sm">لم يتم العثور على منتجات مطابقة لـ "{search}".</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
