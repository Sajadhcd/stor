'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { X, Save, Trash2, Plus, Image as ImageIcon, Link as LinkIcon, Link2Off } from 'lucide-react';

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
  onClose: () => void;
  onSaved: () => void;
}

export function VariantEditor({ productId, variant, productImages, onClose, onSaved }: VariantEditorProps) {
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
  const [attributes, setAttributes] = useState<{ key: string; val: string }[]>([]);
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
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
      
      const attrs = Object.entries(variant.attributes || {}).map(([key, val]) => ({
        key,
        val: String(val)
      }));
      setAttributes(attrs);

      // Collect images assigned to this variant
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
      setAttributes([
        { key: 'color', val: '' },
        { key: 'size', val: '' }
      ]);
      setSelectedImageIds([]);
    }
  }, [variant, productImages]);

  const handleAddAttribute = () => {
    setAttributes([...attributes, { key: '', val: '' }]);
  };

  const handleRemoveAttribute = (idx: number) => {
    const updated = [...attributes];
    updated.splice(idx, 1);
    setAttributes(updated);
  };

  const handleAttributeChange = (idx: number, field: 'key' | 'val', value: string) => {
    const updated = [...attributes];
    updated[idx][field] = value;
    setAttributes(updated);
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
      // Build attributes object
      const attrObj: Record<string, any> = {};
      attributes.forEach(attr => {
        if (attr.key.trim() && attr.val.trim()) {
          attrObj[attr.key.trim().toLowerCase()] = attr.val.trim();
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
        attributes: attrObj
      };

      let savedVariant: any = null;

      if (variant?.id) {
        // Update variant
        savedVariant = await apiFetch(`/products/${productId}/variants/${variant.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body)
        });
      } else {
        // Create variant
        savedVariant = await apiFetch(`/products/${productId}/variants`, {
          method: 'POST',
          body: JSON.stringify(body)
        });
      }

      const activeVariantId = variant?.id || savedVariant?.id;

      if (activeVariantId) {
        // Update product images variant assignments
        for (const img of productImages) {
          const isCurrentlyAssigned = img.variantId === activeVariantId;
          const shouldBeAssigned = selectedImageIds.includes(img.id);

          if (shouldBeAssigned && !isCurrentlyAssigned) {
            // Assign to this variant
            await apiFetch(`/products/${productId}/images/${img.id}`, {
              method: 'PATCH',
              body: JSON.stringify({ variantId: activeVariantId })
            });
          } else if (!shouldBeAssigned && isCurrentlyAssigned) {
            // Unassign
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
      <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-slate-200 text-right my-8" dir="rtl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
          <h3 className="text-md font-bold text-slate-900">
            {variant ? 'تعديل متغير المنتج' : 'إضافة متغير جديد'}
          </h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          {/* Variant Name & Position */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xxs font-bold text-slate-500 mb-1">اسم المتغير (مثال: أحمر / XL)</label>
              <input
                type="text"
                value={variantName}
                onChange={e => setVariantName(e.target.value)}
                placeholder="الاسم العرضي للمتغير"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xxs font-bold text-slate-500 mb-1">ترتيب العرض (Position)</label>
              <input
                type="number"
                min="0"
                value={position}
                onChange={e => setPosition(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
              />
            </div>
          </div>

          {/* SKU & Barcode */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xxs font-bold text-slate-500 mb-1">رمز SKU</label>
              <input
                type="text"
                required
                value={sku}
                onChange={e => setSku(e.target.value)}
                placeholder="مثال: VELO-TEE-BLK-S"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xxs font-bold text-slate-500 mb-1">الباركود (Barcode)</label>
              <input
                type="text"
                value={barcode}
                onChange={e => setBarcode(e.target.value)}
                placeholder="الرمز الشريطي للمنتج"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
              />
            </div>
          </div>

          {/* Pricing & Overrides */}
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">سعر البيع الأساسي</label>
              <input
                type="number"
                required
                min="0"
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="السعر"
                className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">سعر التخفيض (Override)</label>
              <input
                type="number"
                min="0"
                value={priceOverride}
                onChange={e => setPriceOverride(e.target.value)}
                placeholder="تخفيض"
                className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">السعر الأصلي (Compare-At)</label>
              <input
                type="number"
                min="0"
                value={compareAtPrice}
                onChange={e => setCompareAtPrice(e.target.value)}
                placeholder="الأصلي"
                className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">التكلفة (Cost)</label>
              <input
                type="number"
                min="0"
                value={costPrice}
                onChange={e => setCostPrice(e.target.value)}
                placeholder="التكلفة"
                className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
              />
            </div>
          </div>

          {/* Weight & Active Checkbox */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xxs font-bold text-slate-500 mb-1">الوزن (كجم)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={weight}
                onChange={e => setWeight(e.target.value)}
                placeholder="الوزن"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={e => setIsActive(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded-md focus:ring-indigo-500"
                />
                <span className="text-xs font-bold text-slate-700">المتغير نشط ومعروض للبيع</span>
              </label>
            </div>
          </div>

          {/* Dimensions JSON Editor */}
          <div>
            <label className="block text-xxs font-bold text-slate-500 mb-1">الأبعاد بصيغة JSON (Dimensions)</label>
            <textarea
              rows={4}
              value={dimensions}
              onChange={e => setDimensions(e.target.value)}
              placeholder='{ "length": 0, "width": 0, "height": 0, "unit": "cm" }'
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-left focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
              dir="ltr"
            />
          </div>

          {/* Attributes Builder */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xxs font-bold text-slate-500">مواصفات المتغير (Attributes)</label>
              <button
                type="button"
                onClick={handleAddAttribute}
                className="flex items-center gap-1 text-xxs text-indigo-600 hover:text-indigo-800 font-bold"
              >
                <Plus className="w-3 h-3" />
                <span>إضافة مواصفة</span>
              </button>
            </div>

            <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
              {attributes.map((attr, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="اسم المواصفة (مثال: size)"
                    value={attr.key}
                    onChange={e => handleAttributeChange(idx, 'key', e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xxs text-slate-800 focus:outline-hidden"
                  />
                  <input
                    type="text"
                    placeholder="القيمة (مثال: XL)"
                    value={attr.val}
                    onChange={e => handleAttributeChange(idx, 'val', e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xxs text-slate-800 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveAttribute(idx)}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Image Assignment */}
          <div className="space-y-2">
            <label className="block text-xxs font-bold text-slate-500">ربط صور المتغير</label>
            {productImages.length === 0 ? (
              <p className="text-xxs text-slate-400">لا توجد صور مرفوعة للمنتج الأساسي حتى الآن.</p>
            ) : (
              <div className="grid grid-cols-4 gap-2 border border-slate-100 p-2 rounded-xl">
                {productImages.map(img => {
                  const isSelected = selectedImageIds.includes(img.id);
                  return (
                    <div
                      key={img.id}
                      onClick={() => toggleImageSelection(img.id)}
                      className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                        isSelected ? 'border-indigo-600 ring-2 ring-indigo-500/10' : 'border-slate-100'
                      }`}
                    >
                      <img src={img.url} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-slate-900/10 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        {isSelected ? (
                          <Link2Off className="w-4 h-4 text-white" />
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
          <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-colors shadow-lg shadow-indigo-600/30 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>حفظ المتغير</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
