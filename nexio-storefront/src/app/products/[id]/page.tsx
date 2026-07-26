'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { formatIQD } from '@/lib/currency';
import { addCartItem } from '@/lib/cart';
import { ShoppingBag, ShieldCheck, Truck, ArrowRight, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import Link from 'next/link';

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [product, setProduct] = useState<any>(null);
  const [attributeDefinitions, setAttributeDefinitions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);

  // Variant selector states
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [selectedVariant, setSelectedVariant] = useState<any | null>(null);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [variantImages, setVariantImages] = useState<any[]>([]);

  useEffect(() => {
    async function loadProductAndAttributes() {
      try {
        const data = await apiFetch(`/products/${id}`);
        if (data && data.variants) {
          data.variants = data.variants.filter((v: any) => v.isActive !== false);
        }
        setProduct(data);

        // Fetch attribute definitions (from primary category or global fallback)
        const categoryId = data?.categories?.[0]?.categoryId || data?.categoryId;
        let attrs: any[] = [];
        try {
          if (categoryId) {
            attrs = await apiFetch(`/categories/${categoryId}/attribute-definitions`);
          }
        } catch (err) {
          console.warn('Could not fetch category-specific attributes, falling back to global:', err);
        }

        if (!attrs || attrs.length === 0) {
          try {
            attrs = await apiFetch(`/attribute-definitions`);
          } catch (err) {
            console.warn('Could not fetch global attributes:', err);
            attrs = [];
          }
        }
        setAttributeDefinitions(attrs || []);

        // Set primary image
        if (data?.images && data.images.length > 0) {
          const primary = data.images.find((img: any) => img.isPrimary)?.url || data.images[0].url;
          setSelectedImage(primary);
        }

        // Auto-select only if exactly one variant exists or only one is in stock
        const inStockVariants = data?.variants?.filter((v: any) => (v.availableStock ?? 0) > 0) || [];
        if (data?.variants?.length === 1) {
          const single = data.variants[0];
          setSelectedVariant(single);
          if (single.attributes) {
            setSelectedOptions(single.attributes);
          }
        } else if (inStockVariants.length === 1) {
          const single = inStockVariants[0];
          setSelectedVariant(single);
          if (single.attributes) {
            setSelectedOptions(single.attributes);
          }
        } else {
          // Multiple selectable options - do not pre-select
          setSelectedVariant(null);
          setSelectedOptions({});
        }
      } catch (err) {
        console.error('Failed to load product details:', err);
      } finally {
        setLoading(false);
      }
    }
    if (id) loadProductAndAttributes();
  }, [id]);

  // Update selected variant & image list when selectedOptions changes
  useEffect(() => {
    if (!product || !product.variants || product.variants.length === 0) return;

    // Find variant matching selected options
    const found = product.variants.find((v: any) => {
      if (!v.attributes) return false;
      return Object.entries(selectedOptions).every(([k, val]) => String(v.attributes[k]) === String(val));
    });

    setSelectedVariant(found || null);

    if (found) {
      // Find variant specific images
      const specificImages = product.images?.filter((img: any) => img.variantId === found.id) || [];
      setVariantImages(specificImages);

      if (specificImages.length > 0) {
        setSelectedImage(specificImages[0].url);
      } else {
        // Fallback to product images list
        const primary = product.images?.find((img: any) => img.isPrimary)?.url || product.images?.[0]?.url || '';
        setSelectedImage(primary);
      }
    }
  }, [selectedOptions, product]);

  if (loading) {
    return <div className="py-24 text-center text-slate-400 text-sm font-bold">جاري تحميل تفاصيل المنتج والمواصفات...</div>;
  }

  if (!product) {
    return <div className="py-24 text-center text-slate-400 text-sm font-bold">المنتج المطلوب غير موجود.</div>;
  }

  const title = product.titleTranslations?.ar || product.titleTranslations?.en || 'منتج متميز';
  const description = product.descriptionTranslations?.ar || product.descriptionTranslations?.en || 'منتج أصلي عالي الجودة متوفر بالشحن المباشر';

  // Gather unique options keys and values across all variants
  const optionsMap: Record<string, Set<string>> = {};
  product.variants?.forEach((v: any) => {
    if (v.attributes) {
      Object.entries(v.attributes).forEach(([k, val]: any) => {
        if (val !== undefined && val !== null && val !== '') {
          if (!optionsMap[k]) optionsMap[k] = new Set();
          optionsMap[k].add(String(val));
        }
      });
    }
  });

  // Check if option value is selectable (impossible combination resolution + stock check)
  const isOptionSelectable = (optKey: string, optVal: string) => {
    if (!product || !product.variants) return false;
    const proposed = { ...selectedOptions, [optKey]: optVal };

    return product.variants.some((v: any) => {
      if (!v.attributes) return false;
      const matchesAll = Object.entries(proposed).every(([k, val]) => String(v.attributes[k]) === String(val));
      if (!matchesAll) return false;
      return (v.availableStock ?? 0) > 0;
    });
  };

  // Sort option keys using AttributeDefinition.position
  const sortedOptionKeys = Object.keys(optionsMap).sort((keyA, keyB) => {
    const defA = attributeDefinitions.find(d => d.name.toLowerCase() === keyA.toLowerCase());
    const defB = attributeDefinitions.find(d => d.name.toLowerCase() === keyB.toLowerCase());
    const posA = defA?.position ?? 999;
    const posB = defB?.position ?? 999;
    return posA - posB;
  });

  const isSelectionComplete = sortedOptionKeys.every(k => selectedOptions[k] !== undefined && selectedOptions[k] !== '');

  // Calculate dynamic price based on selected variant
  const currentPrice = selectedVariant
    ? Number(selectedVariant.priceOverride ?? selectedVariant.price)
    : product.variants && product.variants.length > 0
      ? Math.min(...product.variants.map((v: any) => Number(v.priceOverride ?? v.price)))
      : 75000;

  const compareAtPrice = selectedVariant
    ? (selectedVariant.compareAtPrice ? Number(selectedVariant.compareAtPrice) : null)
    : product.variants && product.variants.length > 0
      ? Math.min(...product.variants.filter((v: any) => v.compareAtPrice).map((v: any) => Number(v.compareAtPrice)))
      : null;

  // Calculate variant stock
  const availableStock = selectedVariant ? (selectedVariant.availableStock ?? 0) : 0;

  let stockStatusLabel = '';
  let stockStatusClass = '';
  let buttonText = '';
  let buttonDisabled = false;

  if (sortedOptionKeys.length > 0 && !isSelectionComplete) {
    stockStatusLabel = 'يرجى اختيار المواصفات للتحقق من التوفر';
    stockStatusClass = 'bg-slate-100 text-slate-600 border-slate-200';
    buttonText = 'اختر خيارات المنتج أولاً';
    buttonDisabled = true;
  } else if (sortedOptionKeys.length > 0 && !selectedVariant) {
    stockStatusLabel = 'المواصفات المطلوبة غير متوفرة';
    stockStatusClass = 'bg-rose-50 text-rose-700 border-rose-200';
    buttonText = 'خيارات غير متوفرة';
    buttonDisabled = true;
  } else if (product.variants?.length > 0 && availableStock <= 0) {
    stockStatusLabel = 'نفذت الكمية';
    stockStatusClass = 'bg-rose-50 text-rose-700 border-rose-200';
    buttonText = 'نفذت الكمية';
    buttonDisabled = true;
  } else {
    stockStatusLabel = `متوفر (${product.variants?.length > 0 ? availableStock : 'كمية متاحة'} قطع)`;
    stockStatusClass = 'bg-emerald-50 text-emerald-700 border-emerald-200/60';
    buttonText = 'إضافة للسلة والمتابعة للشحن';
    buttonDisabled = false;
  }

  const handleSelectOption = (key: string, value: string) => {
    setSelectedOptions({ ...selectedOptions, [key]: value });
  };

  const handleAddToCart = async () => {
    if (sortedOptionKeys.length > 0 && (!selectedVariant || buttonDisabled)) {
      alert('الرجاء اختيار خيارات المنتج بشكل صحيح.');
      return;
    }
    if (product.variants?.length > 0 && availableStock <= 0) {
      alert('نعتذر، هذا المتغير غير متوفر في المخزن حالياً.');
      return;
    }

    const titleWithAttrs = sortedOptionKeys.length > 0
      ? `${title} (${Object.values(selectedOptions).join(' - ')})`
      : title;

    await addCartItem(
      selectedVariant ? selectedVariant.id : product.id,
      quantity,
      titleWithAttrs,
      currentPrice,
      product.id
    );
    router.push('/cart');
  };

  return (
    <div className="space-y-8 text-right" dir="rtl">
      {/* Dynamic SEO Meta Head */}
      {product.metaTitle && <title>{product.metaTitle}</title>}
      {product.metaDescription && <meta name="description" content={product.metaDescription} />}

      {/* Back Button */}
      <Link href="/products" className="inline-flex items-center gap-2 text-xs font-extrabold text-slate-500 hover:text-emerald-600 transition-colors">
        <ArrowRight className="w-4 h-4" />
        <span>العودة لكتالوج المنتجات</span>
      </Link>

      {/* Main Product Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 md:p-10 grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* Product Image Gallery */}
        <div className="space-y-4">
          <div className="aspect-square bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-200/60 relative overflow-hidden shadow-2xs">
            {selectedImage ? (
              <img src={selectedImage} alt={title} className="w-full h-full object-cover" />
            ) : (
              <div className="text-8xl">🛍️</div>
            )}
            <span className="absolute top-4 right-4 px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-extrabold shadow-md">
              شحن شامل لـ 18 محافظة
            </span>
          </div>

          {/* Gallery Thumbnails (Switches between variant specific images and main gallery) */}
          {(variantImages.length > 0 ? variantImages : product.images || []).length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {(variantImages.length > 0 ? variantImages : product.images).map((img: any, index: number) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setSelectedImage(img.url)}
                  className={`w-16 h-16 rounded-xl border-2 overflow-hidden shrink-0 transition-all cursor-pointer ${
                    selectedImage === img.url ? 'border-emerald-600 ring-2 ring-emerald-600/20 scale-95' : 'border-slate-200 opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Information Panel */}
        <div className="space-y-6 flex flex-col justify-between">
          <div className="space-y-5">
            {product.brand && (
              <span className="text-[11px] font-extrabold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg inline-block border border-emerald-200/60 shadow-2xs">
                العلامة التجارية: {product.brand.name}
              </span>
            )}

            <h1 className="text-2xl md:text-3xl font-black text-slate-900 leading-tight">{title}</h1>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">{description}</p>

            {/* Dynamic Price & Inventory display */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-baseline justify-between shadow-2xs">
              <div>
                <span className="text-xxs font-extrabold text-slate-400 block">السعر الإجمالي بالدينار العراقي:</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-black text-emerald-600 block">{formatIQD(currentPrice * quantity)}</span>
                  {compareAtPrice && compareAtPrice > currentPrice && (
                    <span className="text-xs font-extrabold text-slate-400 line-through">
                      {formatIQD(compareAtPrice * quantity)}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xxs font-extrabold border shadow-2xs ${stockStatusClass}`}>
                  {buttonDisabled ? (
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>{stockStatusLabel}</span>
                </span>
              </div>
            </div>

            {/* Dynamic Type-Aware Variant Option Selectors */}
            {sortedOptionKeys.length > 0 && (
              <div className="space-y-5 pt-4 border-t border-slate-100">
                {sortedOptionKeys.map((key) => {
                  const vals = optionsMap[key];
                  const def = attributeDefinitions.find(d => d.name.toLowerCase() === key.toLowerCase());
                  const displayLabel = def?.labelTranslations?.ar || def?.labelTranslations?.en || key;
                  const attrType = def?.type || (key.toLowerCase() === 'color' || key.toLowerCase() === 'اللون' ? 'color' : 'select');

                  return (
                    <div key={key} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="block text-xs font-black text-slate-800 flex items-center gap-1.5">
                          <span>{displayLabel}:</span>
                          {selectedOptions[key] && (
                            <span className="text-emerald-600 font-extrabold">({selectedOptions[key]})</span>
                          )}
                        </span>
                      </div>

                      <div className="flex gap-2.5 flex-wrap items-center">
                        {Array.from(vals).map((val) => {
                          const isSelected = selectedOptions[key] === val;
                          const isSelectable = isOptionSelectable(key, val);
                          const matchedOption = def?.options?.find((o: any) => String(o.value) === String(val));
                          const optionLabel = matchedOption?.labelTranslations?.ar || matchedOption?.labelTranslations?.en || val;

                          // 1. Color Swatch Rendering
                          if (attrType === 'color') {
                            const colorValue = matchedOption?.value || val;
                            const isColorHexOrName = colorValue.startsWith('#') || /^[a-zA-Z]+$/.test(colorValue);
                            const styleObj = isColorHexOrName ? { backgroundColor: colorValue } : {};

                            return (
                              <button
                                key={val}
                                type="button"
                                disabled={!isSelectable && !isSelected}
                                onClick={() => handleSelectOption(key, val)}
                                className={`w-9 h-9 rounded-full border-2 transition-all cursor-pointer relative flex items-center justify-center shadow-xs ${
                                  isSelected
                                    ? 'border-emerald-600 ring-4 ring-emerald-600/20 scale-110'
                                    : !isSelectable
                                    ? 'border-slate-200 opacity-30 cursor-not-allowed'
                                    : 'border-slate-300 hover:scale-105'
                                }`}
                                style={styleObj}
                                title={`${optionLabel} ${!isSelectable ? '(غير متوفر)' : ''}`}
                              >
                                <span className="sr-only">{val} {optionLabel}</span>
                                {!isColorHexOrName && (
                                  <span className="text-[9px] font-extrabold bg-white/80 px-1 rounded text-slate-800">
                                    {val}
                                  </span>
                                )}
                                {isSelected && isColorHexOrName && (
                                  <span className="w-2.5 h-2.5 rounded-full bg-white border border-slate-800 shadow-sm" />
                                )}
                              </button>
                            );
                          }

                          // 2. Boolean Badge Rendering
                          if (attrType === 'boolean') {
                            const boolLabel = val === 'true' || val === '1' ? 'نعم (Yes)' : 'لا (No)';
                            return (
                              <button
                                key={val}
                                type="button"
                                disabled={!isSelectable && !isSelected}
                                onClick={() => handleSelectOption(key, val)}
                                className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all border cursor-pointer ${
                                  isSelected
                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20 scale-[1.03]'
                                    : !isSelectable
                                    ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed opacity-50'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-transparent'
                                }`}
                              >
                                {boolLabel}
                              </button>
                            );
                          }

                          // 3. Number Button Rendering
                          if (attrType === 'number') {
                            return (
                              <button
                                key={val}
                                type="button"
                                disabled={!isSelectable && !isSelected}
                                onClick={() => handleSelectOption(key, val)}
                                className={`min-w-12 px-3.5 py-2 rounded-xl text-xs font-mono font-extrabold transition-all border cursor-pointer text-center ${
                                  isSelected
                                    ? 'bg-slate-900 text-white border-slate-900 shadow-lg scale-[1.03]'
                                    : !isSelectable
                                    ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed opacity-50'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
                                }`}
                              >
                                {optionLabel}
                              </button>
                            );
                          }

                          // 4. Default / Select Pill Rendering
                          return (
                            <button
                              key={val}
                              type="button"
                              disabled={!isSelectable && !isSelected}
                              onClick={() => handleSelectOption(key, val)}
                              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all border cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20 scale-[1.02]'
                                  : !isSelectable
                                  ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed opacity-50'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-transparent'
                              }`}
                              aria-pressed={isSelected}
                            >
                              {optionLabel}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quantity & Cart Action */}
          <div className="space-y-4 pt-6 border-t border-slate-100">
            <div className="flex items-center gap-4">
              <span className="text-xs font-extrabold text-slate-700">الكمية المطلوبة:</span>
              <div className="flex items-center border border-slate-200 rounded-2xl overflow-hidden bg-slate-50 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-4 py-2.5 text-slate-600 hover:bg-slate-200 font-black transition-colors cursor-pointer"
                >
                  -
                </button>
                <span className="px-5 py-2.5 text-sm font-black text-slate-900 bg-white border-x border-slate-200">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  className="px-4 py-2.5 text-slate-600 hover:bg-slate-200 font-black transition-colors cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddToCart}
              disabled={buttonDisabled}
              className={`w-full py-4 font-black rounded-2xl text-sm shadow-xl transition-all flex items-center justify-center gap-3 cursor-pointer ${
                buttonDisabled
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-slate-950 shadow-emerald-600/30 hover:scale-[1.01]'
              }`}
            >
              <ShoppingBag className="w-5 h-5 text-slate-950" />
              <span>{buttonText}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
