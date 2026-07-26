'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { X, Save, Trash2, Plus, Link as LinkIcon, Link2Off, Tags, Palette, SlidersHorizontal, AlertCircle } from 'lucide-react';

interface Variant {
  id?: string;
  sku: string;
  barcode?: string;
  price: number | string;
  costPrice?: number | string;
  priceOverride?: number | string;
  compareAtPrice?: number | string;
  weight?: number | string;
  variantName?: string;
  isActive?: boolean;
  position?: number;
  dimensions?: any;
  attributes?: Record<string, any>;
  stockLevels?: any[];
}

interface ImageItem {
  id: string;
  url: string;
  altText?: string;
  variantId?: string | null;
}

interface VariantEditorProps {
  productId: string;
  variant?: Variant | null; // Null means create new
  productImages: ImageItem[];
  attributeDefinitions?: any[];
  onClose: () => void;
  onSaved: () => void;
}

export function VariantEditor({ productId, variant, productImages, attributeDefinitions = [], onClose, onSaved }: VariantEditorProps) {
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [price, setPrice] = useState<number | string>('');
  const [costPrice, setCostPrice] = useState<number | string>('');
  const [priceOverride, setPriceOverride] = useState<number | string>('');
  const [compareAtPrice, setCompareAtPrice] = useState<number | string>('');
  const [weight, setWeight] = useState<number | string>('');
  const [variantName, setVariantName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [position, setPosition] = useState<number>(0);
  const [dimensions, setDimensions] = useState('');
  
  // Attribute state separated into Defined (Schema-based) and Custom (Ad-hoc)
  const [definedAttrs, setDefinedAttrs] = useState<Record<string, any>>({});
  const [customAttributes, setCustomAttributes] = useState<{ key: string; val: string }[]>([]);
  
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const existingAttrs = variant?.attributes || {};
    const initialDefined: Record<string, any> = {};
    const initialCustom: { key: string; val: string }[] = [];
    const defNames = new Set(attributeDefinitions.map((d: any) => d.name));

    // Populate defined attributes default values or existing values
    attributeDefinitions.forEach((def: any) => {
      if (existingAttrs[def.name] !== undefined && existingAttrs[def.name] !== null) {
        initialDefined[def.name] = existingAttrs[def.name];
      } else if (def.type === 'boolean') {
        initialDefined[def.name] = false;
      } else {
        initialDefined[def.name] = '';
      }
    });

    // Populate existing attributes into defined or custom ad-hoc arrays
    Object.entries(existingAttrs).forEach(([key, val]) => {
      if (defNames.has(key)) {
        initialDefined[key] = val;
      } else {
        initialCustom.push({ key, val: String(val) });
      }
    });

    setDefinedAttrs(initialDefined);
    setCustomAttributes(initialCustom);

    if (variant) {
      setSku(variant.sku || '');
      setBarcode(variant.barcode || '');
      setPrice(variant.price || '');
      setCostPrice(variant.costPrice || '');
      setPriceOverride(variant.priceOverride || '');
      setCompareAtPrice(variant.compareAtPrice || '');
      setWeight(variant.weight || '');
      setVariantName(variant.variantName || '');
      setIsActive(variant.isActive ?? true);
      setPosition(variant.position ?? 0);
      setDimensions(variant.dimensions ? JSON.stringify(variant.dimensions, null, 2) : '');

      const assigned = productImages
        .filter(img => img.variantId === variant.id)
        .map(img => img.id);
      setSelectedImageIds(assigned);
    } else {
      setSku('');
      setBarcode('');
      setPrice('');
      setCostPrice('');
      setPriceOverride('');
      setCompareAtPrice('');
      setWeight('');
      setVariantName('');
      setIsActive(true);
      setPosition(0);
      setDimensions('{\n  "length": 0,\n  "width": 0,\n  "height": 0,\n  "unit": "cm"\n}');
      setSelectedImageIds([]);
    }
  }, [variant, productImages, attributeDefinitions]);

  const handleDefinedAttrChange = (name: string, val: any) => {
    setDefinedAttrs(prev => ({ ...prev, [name]: val }));
  };

  const handleAddCustomAttribute = () => {
    setCustomAttributes([...customAttributes, { key: '', val: '' }]);
  };

  const handleRemoveCustomAttribute = (idx: number) => {
    const updated = [...customAttributes];
    updated.splice(idx, 1);
    setCustomAttributes(updated);
  };

  const handleCustomAttributeChange = (idx: number, field: 'key' | 'val', value: string) => {
    const updated = [...customAttributes];
    updated[idx][field] = value;
    setCustomAttributes(updated);
  };

  const toggleImageSelection = (imageId: string) => {
    if (selectedImageIds.includes(imageId)) {
      setSelectedImageIds(selectedImageIds.filter(id => id !== imageId));
    } else {
      setSelectedImageIds([...selectedImageIds, imageId]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku.trim()) {
      alert('الرجاء إدخال رمز SKU');
      return;
    }
    if (price === '' || Number(price) < 0) {
      alert('الرجاء إدخال سعر بيع صحيح');
      return;
    }

    // Validate Required Defined Attributes
    for (const def of attributeDefinitions) {
      if (def.isRequired) {
        const val = definedAttrs[def.name];
        if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
          alert(`الرجاء إدخال قيمة للخاصية الإلزامية: ${def.labelTranslations?.ar || def.name}`);
          return;
        }
      }
    }

    let parsedDimensions = null;
    if (dimensions.trim()) {
      try {
        parsedDimensions = JSON.parse(dimensions);
      } catch {
        alert('الرجاء إدخال أبعاد صحيحة بصيغة JSON');
        return;
      }
    }

    setSubmitting(true);
    try {
      // Merge defined attributes and custom ad-hoc attributes into JSONB object
      const finalAttributes: Record<string, any> = {};
      
      Object.entries(definedAttrs).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          finalAttributes[k] = v;
        }
      });

      customAttributes.forEach(attr => {
        if (attr.key.trim() && attr.val.trim()) {
          finalAttributes[attr.key.trim().toLowerCase()] = attr.val.trim();
        }
      });

      const body = {
        sku: sku.trim().toUpperCase(),
        barcode: barcode.trim() || undefined,
        price: Number(price),
        costPrice: costPrice !== '' ? Number(costPrice) : undefined,
        priceOverride: priceOverride !== '' ? Number(priceOverride) : null,
        compareAtPrice: compareAtPrice !== '' ? Number(compareAtPrice) : null,
        weight: weight !== '' ? Number(weight) : undefined,
        variantName: variantName.trim() || undefined,
        isActive,
        position: Number(position),
        dimensions: parsedDimensions,
        attributes: finalAttributes
      };

      let savedVariant: any = null;

      if (variant?.id) {
        savedVariant = await apiFetch(`/products/${productId}/variants/${variant.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body)
        });
      } else {
        savedVariant = await apiFetch(`/products/${productId}/variants`, {
          method: 'POST',
          body: JSON.stringify(body)
        });
      }

      const activeVariantId = variant?.id || savedVariant?.id;

      if (activeVariantId) {
        for (const img of productImages) {
          const isCurrentlyAssigned = img.variantId === activeVariantId;
          const shouldBeAssigned = selectedImageIds.includes(img.id);

          if (shouldBeAssigned && !isCurrentlyAssigned) {
            await apiFetch(`/products/${productId}/images/${img.id}`, {
              method: 'PATCH',
              body: JSON.stringify({ variantId: activeVariantId })
            });
          } else if (!shouldBeAssigned && isCurrentlyAssigned) {
            await apiFetch(`/products/${productId}/images/${img.id}`, {
              method: 'PATCH',
              body: JSON.stringify({ variantId: null })
            });
          }
        }
      }

      alert('تم حفظ المتغير بنجاح');
      onSaved();
    } catch (err: any) {
      alert(err.message || 'فشل حفظ المتغير');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-60 overflow-y-auto">
      <div className="bg-white rounded-3xl p-6 w-full max-w-2xl shadow-2xl border border-slate-200 text-right my-8 max-h-[92vh] flex flex-col" dir="rtl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Tags className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-md font-extrabold text-slate-900">
                {variant ? `تعديل متغير: ${variant.sku}` : 'إضافة متغير جديد (Dynamic Variant Editor)'}
              </h3>
              <p className="text-xxs text-slate-400 font-medium">قم بإدارة التسعير والمخزون واختيار مواصفات القوالب المعتمدة في النظام.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-6 pt-4 max-h-[75vh] overflow-y-auto pr-1 flex-1">
          {/* Variant Name & Position */}
          <div className="grid grid-cols-2 gap-3 bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200/60">
            <div>
              <label className="block text-xxs font-extrabold text-slate-700 mb-1">اسم المتغير العرضي (مثال: أحمر / L)</label>
              <input
                type="text"
                value={variantName}
                onChange={e => setVariantName(e.target.value)}
                placeholder="اسم اختياري للعرض للمتسوقين"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xxs font-extrabold text-slate-700 mb-1">ترتيب العرض (Position)</label>
              <input
                type="number"
                min="0"
                value={position}
                onChange={e => setPosition(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
              />
            </div>
          </div>

          {/* SKU & Barcode */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xxs font-extrabold text-slate-700 mb-1">رمز SKU (معرف فريد) <span className="text-rose-500">*</span></label>
              <input
                type="text"
                required
                value={sku}
                onChange={e => setSku(e.target.value)}
                placeholder="مثال: NEX-IPH-256-BLK"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 text-left dir-ltr"
              />
            </div>
            <div>
              <label className="block text-xxs font-extrabold text-slate-700 mb-1">الباركود الدولي (Barcode / EAN)</label>
              <input
                type="text"
                value={barcode}
                onChange={e => setBarcode(e.target.value)}
                placeholder="الرمز الشريطي للمنتج"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 text-left dir-ltr"
              />
            </div>
          </div>

          {/* Pricing & Overrides */}
          <div>
            <h4 className="text-xxs font-black uppercase tracking-wider text-slate-400 mb-2">إدارة التسعير التجاري للمتغير</h4>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-700 mb-1">السعر الأساسي <span className="text-rose-500">*</span></label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-extrabold text-indigo-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-slate-700 mb-1">سعر التخفيض (Override)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={priceOverride}
                  onChange={e => setPriceOverride(e.target.value)}
                  placeholder="اختياري"
                  className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-extrabold text-emerald-600 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-slate-700 mb-1">السعر المشطوب (Compare)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={compareAtPrice}
                  onChange={e => setCompareAtPrice(e.target.value)}
                  placeholder="الأصلي"
                  className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-500 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-slate-700 mb-1">التكلفة الفعلية (Cost)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={costPrice}
                  onChange={e => setCostPrice(e.target.value)}
                  placeholder="التكلفة"
                  className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Weight & Active Checkbox */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xxs font-extrabold text-slate-700 mb-1">الوزن للشحن (كجم)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={weight}
                onChange={e => setWeight(e.target.value)}
                placeholder="الوزن"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
              />
            </div>
            <div className="flex items-end pb-1.5">
              <label className="flex items-center gap-2.5 p-2.5 bg-indigo-50/50 rounded-xl border border-indigo-100/80 w-full cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={e => setIsActive(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded-md focus:ring-indigo-500"
                />
                <span className="text-xs font-black text-indigo-950">المتغير نشط وجاهز للبيع</span>
              </label>
            </div>
          </div>

          {/* ─── DYNAMIC SCHEMA ATTRIBUTES SECTION ─────────────────────────────── */}
          <div className="bg-indigo-50/40 border border-indigo-100 rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-indigo-100 pb-2.5">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
                <h4 className="text-xs font-extrabold text-indigo-950">خصائص ومواصفات النظام المعتمدة (Defined Attributes)</h4>
              </div>
              <span className="text-xxs font-bold px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-md">
                {attributeDefinitions.length} قوالب معرفة
              </span>
            </div>

            {attributeDefinitions.length === 0 ? (
              <div className="py-4 text-center text-slate-400 text-xxs font-medium">
                لم يتم تعريف خصائص للنظام أو لهذا التصنيف بعد. يمكنك التوجه إلى قسم (خصائص ومواصفات المنتجات) لإنشاء الألوان والمواصفات.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {attributeDefinitions.map((def: any) => {
                  const val = definedAttrs[def.name];
                  const label = def.labelTranslations?.ar || def.labelTranslations?.en || def.name;

                  return (
                    <div key={def.id} className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                      <label className="block text-xxs font-extrabold text-slate-800 mb-2 flex items-center justify-between">
                        <span>{label} <span className="font-mono font-normal text-slate-400">({def.name})</span></span>
                        {def.isRequired && (
                          <span className="text-[9px] px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded font-extrabold">
                            إلزامي *
                          </span>
                        )}
                      </label>

                      {/* Select input */}
                      {def.type === 'select' && (
                        <select
                          value={val || ''}
                          onChange={e => handleDefinedAttrChange(def.name, e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                        >
                          <option value="">-- بدون تحديد --</option>
                          {def.options?.map((opt: any, i: number) => (
                            <option key={i} value={opt.value}>
                              {opt.labelTranslations?.ar || opt.value} ({opt.value})
                            </option>
                          ))}
                        </select>
                      )}

                      {/* Color swatch picker */}
                      {def.type === 'color' && (
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-1.5">
                            {def.options?.map((opt: any, i: number) => {
                              const isSel = val === opt.value;
                              const optLabel = opt.labelTranslations?.ar || opt.labelTranslations?.en || opt.value;
                              return (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => handleDefinedAttrChange(def.name, isSel ? '' : opt.value)}
                                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xxs font-extrabold transition-all cursor-pointer ${
                                    isSel
                                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm scale-[1.03]'
                                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                  }`}
                                >
                                  <span className="w-3.5 h-3.5 rounded-full border border-slate-300 shadow-2xs" style={{ backgroundColor: opt.value }} />
                                  <span>{optLabel}</span>
                                </button>
                              );
                            })}
                          </div>
                          {/* Fallback manual hex if option not present */}
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xxs text-slate-400 font-medium">أو لون حر:</span>
                            <input
                              type="text"
                              placeholder="#000000"
                              value={val || ''}
                              onChange={e => handleDefinedAttrChange(def.name, e.target.value)}
                              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-xxs font-mono text-left dir-ltr w-24 font-bold"
                            />
                          </div>
                        </div>
                      )}

                      {/* Number input */}
                      {def.type === 'number' && (
                        <input
                          type="number"
                          value={val || ''}
                          onChange={e => handleDefinedAttrChange(def.name, e.target.value)}
                          placeholder="أدخل رقماً"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
                        />
                      )}

                      {/* Text input */}
                      {def.type === 'text' && (
                        <input
                          type="text"
                          value={val || ''}
                          onChange={e => handleDefinedAttrChange(def.name, e.target.value)}
                          placeholder="أدخل نصاً"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
                        />
                      )}

                      {/* Boolean toggle */}
                      {def.type === 'boolean' && (
                        <label className="flex items-center gap-2 cursor-pointer pt-1">
                          <input
                            type="checkbox"
                            checked={!!val}
                            onChange={e => handleDefinedAttrChange(def.name, e.target.checked)}
                            className="w-4 h-4 text-indigo-600 rounded-md focus:ring-indigo-500"
                          />
                          <span className="text-xs font-bold text-slate-700">{!!val ? 'نعم (Yes)' : 'لا (No)'}</span>
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ─── AD-HOC CUSTOM ATTRIBUTES BUILDER ─────────────────────────────── */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
              <div>
                <span className="block text-xs font-extrabold text-slate-800">خصائص إضافية مخصصة (Ad-hoc Attributes)</span>
                <span className="text-xxs text-slate-400">إضافة أزواج مفتاح وقيمة غير موجودة بقوالب خصائص النظام.</span>
              </div>
              <button
                type="button"
                onClick={handleAddCustomAttribute}
                className="flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xxs font-extrabold shadow-2xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-indigo-600" />
                <span>إضافة خاصية مخصصة</span>
              </button>
            </div>

            {customAttributes.length === 0 ? (
              <div className="py-2 text-center text-slate-400 text-xxs font-medium">
                لا توجد مواصفات مخصصة إضافية لهذا المتغير.
              </div>
            ) : (
              <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                {customAttributes.map((attr, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-2xs">
                    <input
                      type="text"
                      placeholder="اسم المفتاح (e.g. edition)"
                      value={attr.key}
                      onChange={e => handleCustomAttributeChange(idx, 'key', e.target.value)}
                      className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-hidden"
                    />
                    <input
                      type="text"
                      placeholder="القيمة (e.g. Limited Edition)"
                      value={attr.val}
                      onChange={e => handleCustomAttributeChange(idx, 'val', e.target.value)}
                      className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveCustomAttribute(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="حذف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dimensions JSON Editor */}
          <div>
            <label className="block text-xxs font-bold text-slate-500 mb-1">الأبعاد بصيغة JSON (Dimensions)</label>
            <textarea
              rows={3}
              value={dimensions}
              onChange={e => setDimensions(e.target.value)}
              placeholder='{ "length": 0, "width": 0, "height": 0, "unit": "cm" }'
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-left focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
              dir="ltr"
            />
          </div>

          {/* Image Assignment */}
          <div className="space-y-2">
            <label className="block text-xxs font-extrabold text-slate-700">ربط صور المنتج الأساسي بالمتغير</label>
            {productImages.length === 0 ? (
              <p className="text-xxs text-slate-400 bg-slate-50 p-3 rounded-xl border border-slate-200/60">لا توجد صور مرفوعة للمنتج الأساسي حتى الآن.</p>
            ) : (
              <div className="grid grid-cols-5 gap-2.5 border border-slate-200 p-3 rounded-2xl bg-slate-50">
                {productImages.map(img => {
                  const isSelected = selectedImageIds.includes(img.id);
                  return (
                    <div
                      key={img.id}
                      onClick={() => toggleImageSelection(img.id)}
                      className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all shadow-2xs ${
                        isSelected ? 'border-indigo-600 ring-4 ring-indigo-500/20 scale-95' : 'border-white opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={img.url} alt="" className="w-full h-full object-cover" />
                      <div className={`absolute inset-0 flex items-center justify-center transition-all ${
                        isSelected ? 'bg-indigo-950/40 opacity-100' : 'bg-slate-900/10 opacity-0 hover:opacity-100'
                      }`}>
                        {isSelected ? (
                          <span className="px-2 py-0.5 bg-indigo-600 text-white font-extrabold text-xxs rounded-md shadow-sm">مرتبط</span>
                        ) : (
                          <LinkIcon className="w-4 h-4 text-white" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-4 border-t border-slate-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-2xl text-xs transition-colors shadow-lg shadow-indigo-600/30 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{submitting ? 'جاري الحفظ...' : 'حفظ المتغير ومواصفاته في الكتالوج'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
