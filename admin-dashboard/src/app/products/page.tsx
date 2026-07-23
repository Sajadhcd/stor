'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { apiFetch } from '@/lib/api';
import { ProductForm, ProductFormData } from '@/components/products/ProductForm';
import { Package, Plus, Search, Filter, CheckCircle, Eye, Tag } from 'lucide-react';

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const result = await apiFetch('/products');
      console.log('Products Response:', result);
      setProducts(result.data ?? []);
    } catch (err: any) {
      console.error('Failed to load products:', err);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleSaveProduct = async (data: ProductFormData) => {
    setSubmitting(true);
    try {
      const payload = {
        titleTranslations: {
          ar: data.titleAr,
          en: data.titleEn,
        },
        brandId: data.brandId || undefined,
        slug: data.slug || undefined,
        metaTitle: data.metaTitle || undefined,
        metaDescription: data.metaDescription || undefined,
        imageUrls: data.images.map((img) => img.url),
        isPublished: data.isPublished,
      };

      if (selectedProduct) {
        // Update product details
        await apiFetch(`/products/${selectedProduct.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        // Create product
        await apiFetch('/products', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      setShowModal(false);
      setSelectedProduct(null);
      await loadProducts();
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء حفظ المنتج');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">إدارة كتالوج المنتجات</h1>
            <p className="text-sm text-slate-500 mt-1">عرض وتخصيص كافة المنتجات والصور والعلامات التجارية لمتجرك.</p>
          </div>
          <button
            onClick={() => {
              setSelectedProduct(null);
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة منتج جديد</span>
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ابحث عن اسم المنتج، الرقم المعرف، أو التصنيف..."
              className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors">
            <Filter className="w-4 h-4" />
            <span>تصفية بحسب الحالة</span>
          </button>
        </div>

        {/* Products Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-slate-400 text-sm">جاري جلب قائمة المنتجات...</div>
          ) : products.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">لا توجد منتجات مسجلة. اضغط على &quot;إضافة منتج جديد&quot; للبدء.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <th className="py-4 pr-6">المنتج</th>
                    <th className="py-4">العلامة التجارية</th>
                    <th className="py-4">حالة النشر</th>
                    <th className="py-4">تاريخ الإنشاء</th>
                    <th className="py-4 pl-6 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {products.map((product) => {
                    const primaryImg = product.images?.find((img: any) => img.isPrimary)?.url || product.images?.[0]?.url;
                    return (
                      <tr key={product.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-4 pr-6">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                              {primaryImg ? (
                                <img src={primaryImg} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <Package className="w-6 h-6 text-indigo-500" />
                              )}
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-900">
                                {product.titleTranslations?.ar || 'منتج غير معنون'}
                              </h4>
                              <p className="text-xs text-slate-400 font-normal">
                                {product.titleTranslations?.en || 'No English Title'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4">
                          {product.brand ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-200/60">
                              <Tag className="w-3 h-3" />
                              <span>{product.brand.name}</span>
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-4">
                          {product.isPublished ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-200/60">
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>منشور</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold">
                              مسودة
                            </span>
                          )}
                        </td>
                        <td className="py-4 text-xs text-slate-500">
                          {new Date(product.createdAt).toLocaleDateString('ar-SA')}
                        </td>
                        <td className="py-4 pl-6">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedProduct(product);
                                setShowModal(true);
                              }}
                              className="p-2 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-colors cursor-pointer"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modular Product Form Modal */}
      <ProductForm
        isOpen={showModal}
        product={selectedProduct}
        onClose={() => {
          setShowModal(false);
          setSelectedProduct(null);
        }}
        onSubmit={handleSaveProduct}
        submitting={submitting}
      />
    </DashboardLayout>
  );
}
