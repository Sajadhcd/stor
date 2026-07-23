'use client';

import { useState } from 'react';
import { Image as ImageIcon, Plus, Trash2, Star } from 'lucide-react';

export interface ImageItem {
  url: string;
  isPrimary?: boolean;
  altText?: string;
}

interface ProductImagesProps {
  images: ImageItem[];
  onChange: (images: ImageItem[]) => void;
}

export function ProductImages({ images, onChange }: ProductImagesProps) {
  const [newUrl, setNewUrl] = useState('');

  const handleAddImage = () => {
    if (!newUrl.trim()) return;
    const isFirst = images.length === 0;
    const updated = [...images, { url: newUrl.trim(), isPrimary: isFirst }];
    onChange(updated);
    setNewUrl('');
  };

  const handleSetPrimary = (index: number) => {
    const updated = images.map((img, i) => ({
      ...img,
      isPrimary: i === index,
    }));
    onChange(updated);
  };

  const handleRemoveImage = (index: number) => {
    const updated = images.filter((_, i) => i !== index);
    if (updated.length > 0 && !updated.some((img) => img.isPrimary)) {
      updated[0].isPrimary = true;
    }
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
        <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
        <span>صور المنتج (Image URLs)</span>
      </label>

      {/* Input row */}
      <div className="flex gap-2">
        <input
          type="url"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          placeholder="https://example.com/product-image.jpg"
          className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dir-ltr text-right"
        />
        <button
          type="button"
          onClick={handleAddImage}
          className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>إضافة</span>
        </button>
      </div>

      {/* Images Preview List */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2.5 pt-2">
          {images.map((img, idx) => (
            <div
              key={idx}
              className={`relative rounded-xl border p-1.5 flex flex-col items-center gap-1 bg-white ${
                img.isPrimary ? 'border-amber-400 ring-2 ring-amber-400/20' : 'border-slate-200'
              }`}
            >
              {/* Image thumbnail */}
              <div className="w-full aspect-square rounded-lg bg-slate-100 overflow-hidden relative">
                <img
                  src={img.url}
                  alt={`Product Image ${idx + 1}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between w-full px-1 pt-1">
                <button
                  type="button"
                  onClick={() => handleSetPrimary(idx)}
                  className={`text-[10px] font-bold flex items-center gap-0.5 px-1.5 py-0.5 rounded-md ${
                    img.isPrimary
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-100 text-slate-500 hover:bg-amber-50 hover:text-amber-600'
                  }`}
                  title={img.isPrimary ? 'الصورة الرئيسية' : 'تعيين كصورة رئيسية'}
                >
                  <Star className="w-3 h-3 fill-current" />
                  <span>{img.isPrimary ? 'الرئيسية' : 'تعيين'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleRemoveImage(idx)}
                  className="text-rose-500 hover:text-rose-700 p-1 rounded-md hover:bg-rose-50"
                  title="حذف"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
