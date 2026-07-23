'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { Plus, Edit3, Trash2, Tag, RefreshCw, Layers } from 'lucide-react';
import { VariantEditor } from './VariantEditor';
import { VariantMatrix } from './VariantMatrix';

interface ProductVariantsProps {
  productId: string;
}

export function ProductVariants({ productId }: ProductVariantsProps) {
  const [variants, setVariants] = useState<any[]>([]);
  const [productImages, setProductImages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeEditorVariant, setActiveEditorVariant] = useState<any | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showMatrix, setShowMatrix] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const product = await apiFetch(`/products/${productId}`);
      setVariants(product.variants ?? []);
      setProductImages(product.images ?? []);
    } catch (err: any) {
      console.error('Failed to load variants data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [productId]);

  const handleDeleteVariant = async (variantId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المتغير نهائياً؟')) return;
    try {
      await apiFetch(`/products/${productId}/variants/${variantId}`, {
        method: 'DELETE'
      });
      alert('تم حذف المتغير بنجاح');
      loadData();
    } catch (err: any) {
      alert(err.message || 'فشل حذف المتغير');
    }
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Actions Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setActiveEditorVariant(null);
              setShowEditor(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة متغير يدوي</span>
          </button>
          <button
            onClick={() => setShowMatrix(!showMatrix)}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-200"
          >
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            <span>توليد مصفوفة ذكية</span>
          </button>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 transition-all cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Smart Matrix Generator Section */}
      {showMatrix && (
        <VariantMatrix productId={productId} onGenerated={() => {
          setShowMatrix(false);
          loadData();
        }} />
      )}

      {/* Variants Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs">جاري تحميل المتغيرات...</div>
        ) : variants.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">لا توجد متغيرات للمنتج حالياً. أضف متغيراً أو ولد مصفوفة للبدء.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-3 pr-4">رمز SKU / الخصائص</th>
                  <th className="py-3">الباركود</th>
                  <th className="py-3">السعر / التكلفة</th>
                  <th className="py-3">المخزون المتوفر</th>
                  <th className="py-3">الصور المرتبطة</th>
                  <th className="py-3 pl-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {variants.map((v) => {
                  // Compute available stock: quantityPhysical - quantityReserved
                  const physical = v.stockLevels?.reduce((acc: number, sl: any) => acc + (sl.quantityPhysical || 0), 0) || 0;
                  const reserved = v.stockLevels?.reduce((acc: number, sl: any) => acc + (sl.quantityReserved || 0), 0) || 0;
                  const available = physical - reserved;

                  // Get assigned images
                  const assignedImages = productImages.filter(img => img.variantId === v.id);

                  return (
                    <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 pr-4">
                        <div>
                          <span className="font-bold text-slate-950 block">{v.sku}</span>
                          {/* Attribute Badges */}
                          {v.attributes && Object.keys(v.attributes).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {Object.entries(v.attributes).map(([k, val]: any) => (
                                <span
                                  key={k}
                                  className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-xxs font-bold border border-indigo-200/30"
                                >
                                  {k}: {val}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 text-slate-600 font-normal">
                        {v.barcode || '—'}
                      </td>
                      <td className="py-3">
                        <div className="text-slate-900 font-bold">{Number(v.price).toFixed(2)} ر.س</div>
                        {v.costPrice && (
                          <div className="text-xxs text-slate-400 font-normal">التكلفة: {Number(v.costPrice).toFixed(2)} ر.س</div>
                        )}
                      </td>
                      <td className="py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xxs font-bold ${
                          available > 0 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/40' 
                            : 'bg-rose-50 text-rose-700 border border-rose-200/40'
                        }`}>
                          {available > 0 ? `متوفر (${available})` : 'نفذت الكمية'}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex gap-1">
                          {assignedImages.length === 0 ? (
                            <span className="text-xxs text-slate-400 font-normal">بدون صورة</span>
                          ) : (
                            assignedImages.map(img => (
                              <div key={img.id} className="w-8 h-8 rounded-lg overflow-hidden border border-slate-200 shrink-0">
                                <img src={img.url} className="w-full h-full object-cover" />
                              </div>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="py-3 pl-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => {
                              setActiveEditorVariant(v);
                              setShowEditor(true);
                            }}
                            className="p-1.5 hover:bg-indigo-50 text-indigo-600 rounded-lg"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteVariant(v.id)}
                            className="p-1.5 hover:bg-rose-50 text-rose-500 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* Manual Add/Edit Variant Modal */}
      {showEditor && (
        <VariantEditor
          productId={productId}
          variant={activeEditorVariant}
          productImages={productImages}
          onClose={() => {
            setShowEditor(false);
            setActiveEditorVariant(null);
          }}
          onSaved={() => {
            setShowEditor(false);
            setActiveEditorVariant(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}
