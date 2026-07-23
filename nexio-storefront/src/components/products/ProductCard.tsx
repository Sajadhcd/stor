'use client';

import Link from 'next/link';
import { formatIQD } from '@/lib/currency';
import { ShoppingBag, Star, ShieldCheck } from 'lucide-react';

export function ProductCard({ product }: { product: any }) {
  const title = typeof product.titleTranslations === 'object'
    ? product.titleTranslations.ar || product.titleTranslations.en || 'منتج متميز'
    : 'منتج متميز';

  const price = product.variants && product.variants.length > 0
    ? Number(product.variants[0].priceOverride || product.variants[0].price || 75000)
    : 75000;

  const primaryImage = product.images?.find((img: any) => img.isPrimary)?.url || product.images?.[0]?.url;
  const brandName = product.brand?.name;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const variantId = product.variants?.[0]?.id;
    if (!variantId) {
      alert('هذا المنتج غير متاح للبيع حاليًا.');
      return;
    }

    const saved = localStorage.getItem('nexio_cart');
    const cart = saved ? JSON.parse(saved) : [];
    
    const existingIndex = cart.findIndex((item: any) => item.id === product.id);
    if (existingIndex > -1) {
      cart[existingIndex].quantity += 1;
    } else {
      cart.push({
        id: product.id,
        title,
        price,
        variantId,
        quantity: 1,
      });
    }

    localStorage.setItem('nexio_cart', JSON.stringify(cart));
    window.dispatchEvent(new Event('storage'));
    alert(`تمت إضافة "${title}" إلى السلة بنجاح!`);
  };

  return (
    <Link
      href={`/products/${product.id}`}
      className="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col group cursor-pointer relative"
    >
      {/* Product Image Container */}
      <div className="aspect-square bg-slate-100 relative overflow-hidden flex items-center justify-center">
        {primaryImage ? (
          <img
            src={primaryImage}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-2xl group-hover:scale-110 transition-transform">
            🛍️
          </div>
        )}
        <span className="absolute top-3 right-3 px-2.5 py-1 bg-slate-900/80 backdrop-blur-xs text-white rounded-lg text-[10px] font-bold">
          توصيل لكافة المحافظات
        </span>
      </div>

      {/* Product Information */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div>
          {brandName && (
            <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md inline-block mb-1.5 border border-emerald-200/50">
              {brandName}
            </span>
          )}
          <h3 className="font-bold text-slate-900 text-sm group-hover:text-emerald-600 transition-colors line-clamp-2">
            {title}
          </h3>
          <p className="text-xs text-slate-400 mt-1 line-clamp-1">متوفر بحالة ممتازة وشحن مباشر</p>
        </div>

        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 block font-medium">السعر بالدينار:</span>
            <span className="text-base font-black text-emerald-600 block">{formatIQD(price)}</span>
          </div>

          <button
            onClick={handleAddToCart}
            className="p-2.5 bg-slate-900 hover:bg-emerald-600 text-white hover:text-slate-950 rounded-xl transition-all shadow-md group-hover:scale-105"
            title="إضافة للسلة"
          >
            <ShoppingBag className="w-4 h-4" />
          </button>
        </div>
      </div>
    </Link>
  );
}
