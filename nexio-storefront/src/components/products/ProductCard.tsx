'use client';

import Link from 'next/link';
import { formatIQD } from '@/lib/currency';
import { ShoppingBag } from 'lucide-react';
import { addCartItem } from '@/lib/cart';

export function ProductCard({ product }: { product: any }) {
  const title = typeof product.titleTranslations === 'object'
    ? product.titleTranslations.ar || product.titleTranslations.en || 'منتج متميز'
    : 'منتج متميز';

  // Filter active variants
  const variants = (product.variants || []).filter((v: any) => v.isActive !== false);

  // Display the lowest valid variant price
  const price = variants.length > 0
    ? Math.min(...variants.map((v: any) => Number(v.priceOverride ?? v.price ?? 0)))
    : 75000;

  const originalPrice = variants.length > 0
    ? Math.max(...variants.filter((v: any) => v.compareAtPrice).map((v: any) => Number(v.compareAtPrice)))
    : 0;

  const primaryImage = product.images?.find((img: any) => img.isPrimary)?.url || product.images?.[0]?.url;
  const brandName = product.brand?.name;

  // Determine variant states
  const totalAvailableStock = variants.reduce((sum: number, v: any) => sum + (v.availableStock || 0), 0);
  const isAllOutOfStock = variants.length === 0 || totalAvailableStock <= 0;
  const hasMultipleVariants = variants.length > 1;

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (variants.length === 0) return;

    const variant = variants[0];
    const itemPrice = Number(variant.priceOverride ?? variant.price ?? 75000);

    await addCartItem(
      variant.id,
      1,
      title,
      itemPrice,
      product.id
    );
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

        {/* Out of Stock Badge */}
        {isAllOutOfStock ? (
          <span className="absolute top-3 left-3 px-2.5 py-1 bg-rose-600 text-white rounded-lg text-[10px] font-bold shadow-md">
            نفذت الكمية
          </span>
        ) : (
          <span className="absolute top-3 right-3 px-2.5 py-1 bg-slate-900/80 backdrop-blur-xs text-white rounded-lg text-[10px] font-bold">
            توصيل لكافة المحافظات
          </span>
        )}
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
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-black text-emerald-600 block">{formatIQD(price)}</span>
              {originalPrice > price && (
                <span className="text-xxs font-bold text-slate-400 line-through">
                  {formatIQD(originalPrice)}
                </span>
              )}
            </div>
          </div>

          {/* Conditional Cart Button / Action */}
          {isAllOutOfStock ? (
            <button
              disabled
              type="button"
              className="p-2.5 bg-slate-100 text-slate-400 rounded-xl cursor-not-allowed border border-slate-200"
              title="نفذت الكمية"
            >
              <ShoppingBag className="w-4 h-4" />
            </button>
          ) : hasMultipleVariants ? (
            <button
              type="button"
              className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xxs font-black transition-all border border-indigo-100"
              title="اختر الخيارات"
            >
              اختر الخيارات
            </button>
          ) : (
            <button
              type="button"
              onClick={handleAddToCart}
              className="p-2.5 bg-slate-900 hover:bg-emerald-600 text-white hover:text-slate-950 rounded-xl transition-all shadow-md group-hover:scale-105"
              title="إضافة للسلة"
            >
              <ShoppingBag className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </Link>
  );
}
