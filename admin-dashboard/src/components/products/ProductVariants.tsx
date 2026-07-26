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
  const [attributeDefs, setAttributeDefs] = useState<any[]>([]);
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

      // Load attribute definitions tailored to product's primary category or global
      let defs: any[] = [];
      if (product.categories && product.categories.length > 0) {
        const catId = product.categories[0].categoryId;
        defs = await apiFetch(`/categories/${catId}/attribute-definitions`).catch(() => []);
      }
      // If no category-specific defs or product has no categories, fetch global definitions
      if (defs.length === 0) {
        defs = await apiFetch('/attribute-definitions').catch(() => []);
      }
      setAttributeDefs(Array.isArray(defs) ? defs : []);
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

  // Helper to resolve localized attribute labels and option swatches
  const renderAttributeBadge = (k: string, val: any) => {
    const def = attributeDefs.find((d: any) => d.name === k);
    const attrName = def?.labelTranslations?.ar || def?.labelTranslations?.en || k;
    let displayVal = String(val);
    let swatchColor = null;

    if (def?.options && Array.isArray(def.options)) {
      const opt = def.options.find((o: any) => o.value === String(val) || o.value.toLowerCase() === String(val).toLowerCase());
      if (opt) {
        displayVal = opt.labelTranslations?.ar || opt.labelTranslations?.en || opt.value;
      }
      if (def.type === 'color') {
        swatchColor = opt ? opt.value : (String(val).startsWith('#') ? String(val) : null);
      }
    } else if (def?.type === 'color' && String(val).startsWith('#')) {
      swatchColor = String(val);
    }

    return (
      <span
        key={k}
        className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-indigo-50/80 text-indigo-700 rounded-lg text-xxs font-bold border border-indigo-200/50 shadow-2xs"
      >
        <span>{attrName}:</span>
        {swatchColor && (
          <span
            className="w-3.5 h-3.5 rounded-full border border-slate-300 shadow-2xs shrink-0 inline-block"
            style={{ backgroundColor: swatchColor }}
          />
        )}
        <span className="font-extrabold text-indigo-900">{displayVal}</span>
      </span>
    );
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
            className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-extrabold transition-all shadow-md shadow-indigo-600/15 cursor-pointer hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة متغير يدوي</span>
          </button>
          <button
            onClick={() => setShowMatrix(!showMatrix)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-slate-800 to-indigo-950 text-white hover:from-slate-700 hover:to-indigo-900 rounded-xl text-xs font-extrabold transition-all shadow-md cursor-pointer hover:scale-[1.02]"
          >
            <Layers className="w-4 h-4 text-indigo-400" />
            <span>توليد مصفوفة SKUs ذكية</span>
          </button>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 transition-all cursor-pointer shadow-2xs"
          title="تحديث قائمة المتغيرات"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
        </button>
      </div>

      {/* Smart Matrix Generator Section */}
      {showMatrix && (
        <VariantMatrix
          productId={productId}
          attributeDefinitions={attributeDefs}
          onGenerated={() => {
            setShowMatrix(false);
            loadData();
          }}
        />
      )}

      {/* Variants Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs font-bold flex flex-col items-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
            <span>جاري تحميل المتغيرات والمخزون...</span>
          </div>
        ) : variants.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs font-bold flex flex-col items-center gap-2">
            <Tag className="w-8 h-8 text-slate-300" />
            <p>لا توجد متغيرات للمنتج حالياً. أضف متغيراً أو ولد مصفوفة للبدء.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-3.5 pr-5">رمز SKU / الخصائص (Attributes)</th>
                  <th className="py-3.5">الباركود</th>
                  <th className="py-3.5">السعر / التكلفة</th>
                  <th className="py-3.5">المخزون المتوفر</th>
                  <th className="py-3.5">الصور المرتبطة</th>
                  <th className="py-3.5 pl-5 text-center">الإجراءات</th>
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
                    <tr key={v.id} className="hover:bg-slate-50/60 transition-colors group">
                      <td className="py-3.5 pr-5">
                        <div>
                          <span className="font-black text-slate-900 text-sm block">
                            {v.variantName ? `${v.variantName} (${v.sku})` : v.sku}
                          </span>
                          {/* Dynamic Attribute Badges */}
                          {v.attributes && Object.keys(v.attributes).length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {Object.entries(v.attributes).map(([k, val]: any) => renderAttributeBadge(k, val))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 text-slate-600 font-mono font-bold">
                        {v.barcode || '—'}
                      </td>
                      <td className="py-3.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {v.priceOverride ? (
                            <>
                              <span className="text-slate-950 font-extrabold text-sm">{Number(v.priceOverride).toFixed(2)} ر.س</span>
                              <span className="text-slate-400 line-through text-xxs font-normal">
                                {Number(v.compareAtPrice || v.price).toFixed(2)} ر.س
                              </span>
                            </>
                          ) : v.compareAtPrice ? (
                            <>
                              <span className="text-slate-950 font-extrabold text-sm">{Number(v.price).toFixed(2)} ر.س</span>
                              <span className="text-slate-400 line-through text-xxs font-normal">
                                {Number(v.compareAtPrice).toFixed(2)} ر.س
                              </span>
                            </>
                          ) : (
                            <span className="text-slate-950 font-extrabold text-sm">{Number(v.price).toFixed(2)} ر.س</span>
                          )}
                        </div>
                        {v.costPrice && (
                          <div className="text-[11px] text-slate-400 font-semibold mt-0.5">التكلفة: {Number(v.costPrice).toFixed(2)} ر.س</div>
                        )}
                      </td>
                      <td className="py-3.5">
                        {!v.isActive ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xxs font-bold bg-slate-100 text-slate-500 border border-slate-200/60">
                            غير نشط
                          </span>
                        ) : (
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xxs font-bold shadow-2xs ${
                            available > 0 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' 
                              : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                          }`}>
                            {available > 0 ? `متوفر (${available})` : 'نفذت الكمية'}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5">
                        <div className="flex gap-1.5">
                          {assignedImages.length === 0 ? (
                            <span className="text-xxs text-slate-400 font-normal">بدون صورة</span>
                          ) : (
                            assignedImages.map(img => (
                              <div key={img.id} className="w-9 h-9 rounded-xl overflow-hidden border border-slate-200 shrink-0 shadow-2xs">
                                <img src={img.url} className="w-full h-full object-cover" alt="Variant" />
                              </div>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 pl-5">
                        <div className="flex items-center justify-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setActiveEditorVariant(v);
                              setShowEditor(true);
                            }}
                            className="p-2 hover:bg-indigo-50 text-indigo-600 rounded-xl transition-colors cursor-pointer"
                            title="تعديل المتغير والخصائص"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteVariant(v.id)}
                            className="p-2 hover:bg-rose-50 text-rose-600 rounded-xl transition-colors cursor-pointer"
                            title="حذف المتغير"
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
          attributeDefinitions={attributeDefs}
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
