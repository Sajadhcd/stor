'use client';

import { Globe } from 'lucide-react';

interface ProductSEOProps {
  slug: string;
  metaTitle: string;
  metaDescription: string;
  onSlugChange: (slug: string) => void;
  onMetaTitleChange: (metaTitle: string) => void;
  onMetaDescriptionChange: (metaDescription: string) => void;
}

export function ProductSEO({
  slug,
  metaTitle,
  metaDescription,
  onSlugChange,
  onMetaTitleChange,
  onMetaDescriptionChange,
}: ProductSEOProps) {
  return (
    <div className="space-y-3 pt-2 border-t border-slate-100">
      <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
        <Globe className="w-3.5 h-3.5 text-indigo-600" />
        <span>إعدادات SEO والمحركات البحثية</span>
      </h4>

      <div>
        <label className="block text-[11px] font-bold text-slate-600 mb-1">الرابط المخصص (Slug)</label>
        <input
          type="text"
          value={slug}
          onChange={(e) => onSlugChange(e.target.value)}
          placeholder="e.g. velo-pro-tech-tee"
          className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dir-ltr text-right"
        />
      </div>

      <div>
        <label className="block text-[11px] font-bold text-slate-600 mb-1">عنوان محركات البحث (Meta Title)</label>
        <input
          type="text"
          value={metaTitle}
          onChange={(e) => onMetaTitleChange(e.target.value)}
          placeholder="عنوان الصفحة المخصص في نتائج جوجل..."
          className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
        />
      </div>

      <div>
        <label className="block text-[11px] font-bold text-slate-600 mb-1">وصف محركات البحث (Meta Description)</label>
        <textarea
          rows={2}
          value={metaDescription}
          onChange={(e) => onMetaDescriptionChange(e.target.value)}
          placeholder="وصف مختصر يظهر أسفل عنوان الصفحة في نائج البحث..."
          className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
        />
      </div>
    </div>
  );
}
