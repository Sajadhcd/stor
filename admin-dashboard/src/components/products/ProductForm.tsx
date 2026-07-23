'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { BrandSelector } from './BrandSelector';
import { ProductImages, ImageItem } from './ProductImages';
import { ProductSEO } from './ProductSEO';

export interface ProductFormData {
  titleAr: string;
  titleEn: string;
  brandId: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  images: ImageItem[];
  isPublished: boolean;
}

interface ProductFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ProductFormData) => Promise<void>;
  submitting: boolean;
}

export function ProductForm({ isOpen, onClose, onSubmit, submitting }: ProductFormProps) {
  const [titleAr, setTitleAr] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [brandId, setBrandId] = useState('');
  const [slug, setSlug] = useState('');
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [images, setImages] = useState<ImageItem[]>([]);
  const [isPublished, setIsPublished] = useState(true);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      titleAr,
      titleEn,
      brandId,
      slug,
      metaTitle,
      metaDescription,
      images,
      isPublished,
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-3xl p-6 w-full max-w-xl shadow-2xl border border-slate-200 my-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
          <h3 className="text-lg font-bold text-slate-900">إضافة منتج جديد للكتالوج الاحترافي</h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
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
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
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
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dir-ltr text-right"
              />
            </div>
          </div>

          {/* Brand Selector */}
          <BrandSelector value={brandId} onChange={setBrandId} />

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
              {submitting ? 'جاري الحفظ...' : 'حفظ المنتج'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
