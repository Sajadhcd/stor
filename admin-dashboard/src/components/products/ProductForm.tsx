'use client';

import { useState, useEffect } from 'react';
import { X, Layers, Settings2 } from 'lucide-react';
import { BrandSelector } from './BrandSelector';
import { ProductImages, ImageItem } from './ProductImages';
import { ProductSEO } from './ProductSEO';
import { ProductVariants } from './ProductVariants';
import { apiFetch } from '@/lib/api';

export interface ProductFormData {
  titleAr: string;
  titleEn: string;
  brandId: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  images: ImageItem[];
  isPublished: boolean;
  categoryIds: string[];
  attributes: Record<string, any>;
}

interface ProductFormProps {
  isOpen: boolean;
  onClose: () => void;
  product?: any | null;
  onSubmit: (data: ProductFormData) => Promise<void>;
  submitting: boolean;
}

export function ProductForm({ isOpen, onClose, product, onSubmit, submitting }: ProductFormProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'variants'>('details');
  const [titleAr, setTitleAr] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [brandId, setBrandId] = useState('');
  const [slug, setSlug] = useState('');
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [images, setImages] = useState<ImageItem[]>([]);
  const [isPublished, setIsPublished] = useState(true);

  // Category & Specification States
  const [categories, setCategories] = useState<any[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [specDefs, setSpecDefs] = useState<any[]>([]);
  const [specValues, setSpecValues] = useState<Record<string, any>>({});
  const [errorMsg, setErrorMsg] = useState('');

  // 1. Fetch Categories tree and flatten on mount
  useEffect(() => {
    async function loadCategories() {
      try {
        const data = await apiFetch<any[]>('/categories');
        const flat: any[] = [];
        const flatten = (nodes: any[], depth = 0) => {
          nodes.forEach((node) => {
            flat.push({
              id: node.id,
              nameAr: node.nameTranslations?.ar || node.nameTranslations?.en || '',
              nameEn: node.nameTranslations?.en || '',
              depth,
            });
            if (node.children && node.children.length > 0) {
              flatten(node.children, depth + 1);
            }
          });
        };
        flatten(data || []);
        setCategories(flat);
      } catch (err) {
        console.error('Failed to load categories:', err);
      }
    }
    loadCategories();
  }, []);

  // 2. Fetch and filter specification definitions (isVariantAxis === false) when categoryIds changes
  useEffect(() => {
    async function loadDefinitions() {
      try {
        const allDefs = await apiFetch<any[]>('/attribute-definitions');
        const applicable = allDefs.filter(
          (def) =>
            (def.categoryId === null || categoryIds.includes(def.categoryId)) &&
            def.isVariantAxis === false,
        );
        setSpecDefs(applicable);
      } catch (err) {
        console.error('Failed to load attribute definitions:', err);
      }
    }
    loadDefinitions();
  }, [categoryIds]);

  // 3. Initialize fields on edit or open
  useEffect(() => {
    if (product) {
      setTitleAr(product.titleTranslations?.ar || '');
      setTitleEn(product.titleTranslations?.en || '');
      setBrandId(product.brandId || '');
      setSlug(product.slug || '');
      setMetaTitle(product.metaTitle || '');
      setMetaDescription(product.metaDescription || '');
      setImages(product.images || []);
      setIsPublished(product.isPublished ?? true);
      setCategoryIds(
        product.categories
          ? product.categories.map((c: any) => c.categoryId || c.category?.id).filter(Boolean)
          : [],
      );
      setSpecValues(product.attributes || {});
      setErrorMsg('');
      setActiveTab('details');
    } else {
      setTitleAr('');
      setTitleEn('');
      setBrandId('');
      setSlug('');
      setMetaTitle('');
      setMetaDescription('');
      setImages([]);
      setIsPublished(true);
      setCategoryIds([]);
      setSpecValues({});
      setErrorMsg('');
      setActiveTab('details');
    }
  }, [product, isOpen]);

  if (!isOpen) return null;

  const handleSpecChange = (name: string, val: any) => {
    setSpecValues((prev) => ({
      ...prev,
      [name]: val,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // Required Specification validation
    for (const def of specDefs) {
      if (def.isRequired) {
        const val = specValues[def.name];
        if (val === undefined || val === null || val === '') {
          const label = def.labelTranslations?.ar || def.labelTranslations?.en || def.name;
          setErrorMsg(`الحقل "${label}" مطلوب ويجب تعبئته.`);
          return;
        }
      }
    }

    await onSubmit({
      titleAr,
      titleEn,
      brandId,
      slug,
      metaTitle,
      metaDescription,
      images,
      isPublished,
      categoryIds,
      attributes: specValues,
    });
  };

  const renderSpecField = (def: any) => {
    const val = specValues[def.name];
    const label = def.labelTranslations?.ar || def.labelTranslations?.en || def.name;
    const isRequired = def.isRequired;

    switch (def.type) {
      case 'select': {
        const options = def.options || [];
        return (
          <div key={def.name} className="space-y-1 text-right">
            <label className="block text-xs font-bold text-slate-700">
              {label} {isRequired && <span className="text-red-500">*</span>}
            </label>
            <select
              value={val || ''}
              onChange={(e) => handleSpecChange(def.name, e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-hidden"
            >
              <option value="">-- اختر قيمة --</option>
              {options.map((opt: any) => (
                <option key={opt.value} value={opt.value}>
                  {opt.labelTranslations?.ar || opt.labelTranslations?.en || opt.value}
                </option>
              ))}
            </select>
          </div>
        );
      }

      case 'color': {
        const options = def.options || [];
        return (
          <div key={def.name} className="space-y-1 text-right">
            <label className="block text-xs font-bold text-slate-700">
              {label} {isRequired && <span className="text-red-500">*</span>}
            </label>
            <div className="flex flex-wrap gap-2 items-center">
              {options.map((opt: any) => {
                const isSelected = String(val).toLowerCase() === String(opt.value).toLowerCase();
                const isHex = opt.value.startsWith('#');
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSpecChange(def.name, opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {isHex && (
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0"
                          style={{ backgroundColor: opt.value }}
                        />
                      )}
                      <span>{opt.labelTranslations?.ar || opt.labelTranslations?.en || opt.value}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      }

      case 'boolean': {
        return (
          <div key={def.name} className="flex items-center gap-2.5 pt-2 text-right">
            <input
              type="checkbox"
              id={`spec-${def.name}`}
              checked={!!val}
              onChange={(e) => handleSpecChange(def.name, e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded-md focus:ring-indigo-500 cursor-pointer"
            />
            <label htmlFor={`spec-${def.name}`} className="text-xs font-bold text-slate-700 cursor-pointer">
              {label} {isRequired && <span className="text-red-500">*</span>}
            </label>
          </div>
        );
      }

      case 'number': {
        return (
          <div key={def.name} className="space-y-1 text-right">
            <label className="block text-xs font-bold text-slate-700">
              {label} {isRequired && <span className="text-red-500">*</span>}
            </label>
            <input
              type="number"
              value={val === undefined || val === null ? '' : val}
              onChange={(e) => {
                const numeric = e.target.value === '' ? '' : Number(e.target.value);
                handleSpecChange(def.name, numeric);
              }}
              placeholder="أدخل قيمة رقمية"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-hidden"
            />
          </div>
        );
      }

      case 'text':
      default: {
        return (
          <div key={def.name} className="space-y-1 text-right">
            <label className="block text-xs font-bold text-slate-700">
              {label} {isRequired && <span className="text-red-500">*</span>}
            </label>
            <input
              type="text"
              value={val || ''}
              onChange={(e) => handleSpecChange(def.name, e.target.value)}
              placeholder="أدخل نص المواصفة"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-hidden"
            />
          </div>
        );
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-3xl p-6 w-full max-w-2xl shadow-2xl border border-slate-200 text-right my-8" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
          <h3 className="text-lg font-bold text-slate-900">
            {product ? `تعديل منتج: ${product.titleTranslations?.ar || 'بدون اسم'}` : 'إضافة منتج جديد للكتالوج'}
          </h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher for existing products */}
        {product && (
          <div className="flex gap-4 border-b border-slate-100 mb-4 pb-2">
            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={`flex items-center gap-1.5 pb-1 text-xs font-bold transition-all border-b-2 ${
                activeTab === 'details' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'
              }`}
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>تفاصيل المنتج الأساسية</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('variants')}
              className={`flex items-center gap-1.5 pb-1 text-xs font-bold transition-all border-b-2 ${
                activeTab === 'variants' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>المتغيرات والمخزون</span>
            </button>
          </div>
        )}

        {activeTab === 'details' ? (
          <form onSubmit={handleSubmit} className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            {/* Multi-language Title */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم المنتج بالعربية</label>
                <input
                  type="text"
                  required
                  value={titleAr}
                  onChange={(e) => setTitleAr(e.target.value)}
                  placeholder="مثال: حذاء الجري الرياضي"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Title (English)</label>
                <input
                  type="text"
                  required
                  value={titleEn}
                  onChange={(e) => setTitleEn(e.target.value)}
                  placeholder="e.g. Pro Runner Sneaker"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 text-right dir-rtl"
                />
              </div>
            </div>

            {/* Brand Selector */}
            <BrandSelector value={brandId} onChange={setBrandId} />

            {/* Category Multi-select */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
              <label className="block text-xs font-bold text-slate-700 mb-2">التصنيفات المرتبطة بالمنتج (Categories)</label>
              <div className="max-h-40 overflow-y-auto border border-slate-100 rounded-xl bg-white p-2 space-y-1.5">
                {categories.length === 0 ? (
                  <div className="text-xs text-slate-400 py-4 text-center">لا توجد تصنيفات معرفة بعد</div>
                ) : (
                  categories.map((cat) => {
                    const isChecked = categoryIds.includes(cat.id);
                    return (
                      <label key={cat.id} className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 hover:text-slate-900">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCategoryIds([...categoryIds, cat.id]);
                            } else {
                              setCategoryIds(categoryIds.filter((id) => id !== cat.id));
                            }
                          }}
                          className="w-3.5 h-3.5 text-indigo-600 rounded-sm focus:ring-indigo-500"
                        />
                        <span style={{ paddingRight: `${cat.depth * 12}px` }}>
                          {cat.depth > 0 ? '— ' : ''}{cat.nameAr}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            {/* Product Images */}
            <ProductImages images={images} onChange={setImages} />

            {/* Product SEO */}
            <ProductSEO
              slug={slug}
              metaTitle={metaTitle}
              metaDescription={metaDescription}
              onSlugChange={setSlug}
              onMetaTitleChange={setMetaTitle}
              onMetaDescriptionChange={setMetaDescription}
            />

            {/* Product Specifications Section */}
            {specDefs.length > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3.5">
                <h4 className="text-xs font-black text-slate-900 border-b border-slate-200 pb-2">مواصفات المنتج (Specifications)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {specDefs.map((def) => renderSpecField(def))}
                </div>
              </div>
            )}

            {/* Error Message Alert */}
            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs font-bold">
                {errorMsg}
              </div>
            )}

            {/* Publish Checkbox */}
            <div className="flex items-center gap-3 pt-2">
              <input
                type="checkbox"
                id="published"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded-md focus:ring-indigo-500"
              />
              <label htmlFor="published" className="text-xs font-bold text-slate-700 cursor-pointer">
                نشر المنتج فوراً في المتجر
              </label>
            </div>

            {/* Form Actions */}
            <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-colors shadow-lg shadow-indigo-600/30 disabled:opacity-50"
              >
                {submitting ? 'جاري الحفظ...' : 'حفظ تفاصيل المنتج'}
              </button>
            </div>
          </form>
        ) : (
          <div className="max-h-[65vh] overflow-y-auto pr-1">
            <ProductVariants productId={product.id} />
          </div>
        )}
      </div>
    </div>
  );
}
