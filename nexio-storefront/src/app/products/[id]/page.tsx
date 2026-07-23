'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { formatIQD } from '@/lib/currency';
import { ShoppingBag, ShieldCheck, Truck, ArrowRight, CheckCircle2, Package } from 'lucide-react';
import Link from 'next/link';

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);

  const [selectedImage, setSelectedImage] = useState<string>('');

  useEffect(() => {
    async function loadProduct() {
      try {
        const data = await apiFetch(`/products/${id}`);
        setProduct(data);
        if (data?.images && data.images.length > 0) {
          const primary = data.images.find((img: any) => img.isPrimary)?.url || data.images[0].url;
          setSelectedImage(primary);
        }
      } catch (err: any) {
        console.error('Failed to load product details:', err);
      } finally {
        setLoading(false);
      }
    }
    if (id) loadProduct();
  }, [id]);

  if (loading) {
    return <div className="py-24 text-center text-slate-400 text-sm">جاري تحميل تفاصيل المنتج...</div>;
  }

  if (!product) {
    return <div className="py-24 text-center text-slate-400 text-sm">المنتج المطلوب غير موجود.</div>;
  }

  const title = typeof product.titleTranslations === 'object'
    ? product.titleTranslations.ar || product.titleTranslations.en || 'منتج متميز'
    : 'منتج متميز';

  const description = typeof product.descriptionTranslations === 'object'
    ? product.descriptionTranslations.ar || product.descriptionTranslations.en || 'منتج أصلي عالي الجودة متوفر بالشحن المباشر'
    : 'منتج أصلي عالي الجودة متوفر بالشحن المباشر';

  const price = product.variants && product.variants.length > 0
    ? Number(product.variants[0].priceOverride || product.variants[0].price || 75000)
    : 75000;

  const images = product.images || [];
  const brand = product.brand;

  const handleAddToCart = () => {
    const variantId = product.variants?.[0]?.id;
    if (!variantId) {
      alert('هذا المنتج غير متاح للبيع حاليًا.');
      return;
    }
    const saved = localStorage.getItem('nexio_cart');
    const cart = saved ? JSON.parse(saved) : [];
    
    const existingIndex = cart.findIndex((item: any) => item.id === product.id);
    if (existingIndex > -1) {
      cart[existingIndex].quantity += quantity;
    } else {
      cart.push({
        id: product.id,
        title,
        price,
        variantId,
        quantity,
      });
    }

    localStorage.setItem('nexio_cart', JSON.stringify(cart));
    window.dispatchEvent(new Event('storage'));
    alert(`تمت إضافة ${quantity} من "${title}" إلى السلة بنجاح!`);
    router.push('/cart');
  };

  return (
    <div className="space-y-8">
      {/* Dynamic SEO Meta Head */}
      {product.metaTitle && <title>{product.metaTitle}</title>}
      {product.metaDescription && <meta name="description" content={product.metaDescription} />}

      {/* Back Button */}
      <Link href="/products" className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-emerald-600">
        <ArrowRight className="w-4 h-4" />
        <span>العودة لكتالوج المنتجات</span>
      </Link>

      {/* Main Details Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 md:p-10 grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* Product Image Gallery */}
        <div className="space-y-4">
          <div className="aspect-square bg-slate-100 rounded-2xl flex items-center justify-center border border-slate-200/60 relative overflow-hidden">
            {selectedImage ? (
              <img src={selectedImage} alt={title} className="w-full h-full object-cover" />
            ) : (
              <div className="text-8xl">🛍️</div>
            )}
            <span className="absolute top-4 right-4 px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold shadow-md">
              شحن شامل لـ 18 محافظة
            </span>
          </div>

          {/* Gallery Thumbnails */}
          {images.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {images.map((img: any, index: number) => (
                <button
                  key={index}
                  onClick={() => setSelectedImage(img.url)}
                  className={`w-16 h-16 rounded-xl border-2 overflow-hidden shrink-0 transition-all ${
                    selectedImage === img.url ? 'border-emerald-600 ring-2 ring-emerald-600/20' : 'border-slate-200 opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Information & Purchase Panel */}
        <div className="space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            {brand && (
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg inline-block border border-emerald-200/60">
                العلامة التجارية: {brand.name}
              </span>
            )}

            <h1 className="text-2xl md:text-3xl font-black text-slate-900 leading-tight">{title}</h1>
            <p className="text-sm text-slate-600 leading-relaxed">{description}</p>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-baseline justify-between">
              <div>
                <span className="text-xs font-medium text-slate-400 block">السعر الإجمالي بالدينار العراقي:</span>
                <span className="text-3xl font-black text-emerald-600 block mt-1">{formatIQD(price * quantity)}</span>
              </div>
              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-200">
                متوفر في المخزن
              </span>
            </div>
          </div>

          {/* Quantity & Add to Cart */}
          <div className="space-y-4 pt-6 border-t border-slate-100">
            <div className="flex items-center gap-4">
              <span className="text-xs font-bold text-slate-700">الكمية:</span>
              <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-200 font-bold"
                >
                  -
                </button>
                <span className="px-4 py-2 text-sm font-bold text-slate-900">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-200 font-bold"
                >
                  +
                </button>
              </div>
            </div>

            <button
              onClick={handleAddToCart}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black rounded-2xl text-sm shadow-xl shadow-emerald-600/30 transition-all flex items-center justify-center gap-3 cursor-pointer"
            >
              <ShoppingBag className="w-5 h-5 text-slate-950" />
              <span>إضافة السلة والمتابعة للشحن</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
