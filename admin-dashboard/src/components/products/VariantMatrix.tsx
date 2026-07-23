'use client';

import { useState } from 'react';
import { Plus, X, Sparkles } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface VariantMatrixProps {
  productId: string;
  onGenerated: () => void;
}

export function VariantMatrix({ productId, onGenerated }: VariantMatrixProps) {
  const [baseSku, setBaseSku] = useState('');
  const [basePrice, setBasePrice] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [options, setOptions] = useState<{ key: string; values: string[] }[]>([
    { key: 'color', values: ['Red', 'Blue'] },
    { key: 'size', values: ['M', 'L', 'XL'] }
  ]);

  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState<Record<number, string>>({});

  const handleAddOptionValue = (index: number) => {
    const val = newValue[index]?.trim();
    if (!val) return;
    const updated = [...options];
    if (!updated[index].values.includes(val)) {
      updated[index].values.push(val);
      setOptions(updated);
    }
    setNewValue({ ...newValue, [index]: '' });
  };

  const handleRemoveOptionValue = (optIndex: number, valIndex: number) => {
    const updated = [...options];
    updated[optIndex].values.splice(valIndex, 1);
    setOptions(updated);
  };

  const handleAddOptionKey = () => {
    const key = newKey.trim().toLowerCase();
    if (!key) return;
    if (!options.some(opt => opt.key === key)) {
      setOptions([...options, { key, values: [] }]);
    }
    setNewKey('');
  };

  const handleRemoveOptionKey = (index: number) => {
    const updated = [...options];
    updated.splice(index, 1);
    setOptions(updated);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!baseSku.trim()) {
      alert('الرجاء إدخال البادئة الأساسية للـ SKU');
      return;
    }
    if (basePrice <= 0) {
      alert('الرجاء إدخال السعر الأساسي للمصفوفة');
      return;
    }

    const validOptions: Record<string, string[]> = {};
    options.forEach(opt => {
      if (opt.values.length > 0) {
        validOptions[opt.key] = opt.values;
      }
    });

    if (Object.keys(validOptions).length === 0) {
      alert('الرجاء إضافة قيمة واحدة على الأقل للخيارات لتوليد المصفوفة');
      return;
    }

    setGenerating(true);
    try {
      await apiFetch(`/products/${productId}/variants/matrix`, {
        method: 'POST',
        body: JSON.stringify({
          baseSku: baseSku.trim().toUpperCase(),
          basePrice: Number(basePrice),
          options: validOptions
        })
      });
      alert('تم توليد مصفوفة المتغيرات بنجاح');
      onGenerated();
    } catch (err: any) {
      alert(err.message || 'فشل توليد مصفوفة المتغيرات');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-4 text-right" dir="rtl">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
        <Sparkles className="w-4 h-4 text-indigo-600" />
        <h4 className="text-sm font-bold text-slate-800">توليد مصفوفة المتغيرات الذكية</h4>
      </div>

      <form onSubmit={handleGenerate} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xxs font-bold text-slate-500 mb-1 text-right">بادئة SKU الأساسية</label>
            <input
              type="text"
              required
              placeholder="مثال: VELO-TEE"
              value={baseSku}
              onChange={e => setBaseSku(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xxs font-bold text-slate-500 mb-1 text-right">السعر الأساسي للمتغيرات</label>
            <input
              type="number"
              required
              min="0"
              placeholder="السعر"
              value={basePrice || ''}
              onChange={e => setBasePrice(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
            />
          </div>
        </div>

        {/* Options Builder */}
        <div className="space-y-3">
          <label className="block text-xxs font-bold text-slate-500 text-right">مواصفات وخيارات التوليد</label>
          
          <div className="space-y-3">
            {options.map((opt, optIndex) => (
              <div key={opt.key} className="bg-white border border-slate-200/60 p-3 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 capitalize">{opt.key}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveOptionKey(optIndex)}
                    className="text-xxs text-rose-500 hover:text-rose-700 font-bold"
                  >
                    حذف الخيار
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 items-center">
                  {opt.values.map((val, valIndex) => (
                    <span
                      key={val}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded-lg text-xxs font-bold border border-slate-200"
                    >
                      <span>{val}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveOptionValue(optIndex, valIndex)}
                        className="text-slate-400 hover:text-slate-600 rounded-sm"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}

                  <div className="flex items-center gap-1.5 mr-auto">
                    <input
                      type="text"
                      placeholder="إضافة قيمة"
                      value={newValue[optIndex] || ''}
                      onChange={e => setNewValue({ ...newValue, [optIndex]: e.target.value })}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddOptionValue(optIndex);
                        }
                      }}
                      className="w-24 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xxs text-slate-800 focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddOptionValue(optIndex)}
                      className="p-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg border border-indigo-200/50"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Add custom option key */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="text"
              placeholder="اسم خيار مخصص (مثال: material)"
              value={newKey}
              onChange={e => setNewKey(e.target.value)}
              className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800"
            />
            <button
              type="button"
              onClick={handleAddOptionKey}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors"
            >
              إضافة ميزة
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={generating}
          className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors shadow-md shadow-indigo-600/10 disabled:opacity-50"
        >
          {generating ? 'جاري توليد المتغيرات...' : 'توليد المتغيرات تلقائياً'}
        </button>
      </form>
    </div>
  );
}
