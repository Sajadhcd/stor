'use client';

import { useState, useEffect } from 'react';
import { Plus, X, Sparkles, SlidersHorizontal, CheckSquare, Square, Tags, RefreshCw } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface VariantMatrixProps {
  productId: string;
  attributeDefinitions?: any[];
  onGenerated: () => void;
}

export function VariantMatrix({ productId, attributeDefinitions = [], onGenerated }: VariantMatrixProps) {
  const [baseSku, setBaseSku] = useState('');
  const [basePrice, setBasePrice] = useState<number | string>('');
  const [generating, setGenerating] = useState(false);
  const [options, setOptions] = useState<{ key: string; values: string[] }[]>([]);

  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState<Record<number, string>>({});

  // Populate default matrix axes from schema attribute definitions where isVariantAxis = true
  useEffect(() => {
    const axes = attributeDefinitions.filter((d: any) => d.isVariantAxis !== false);
    if (axes.length > 0) {
      const initialOptions = axes.map((def: any) => {
        const defaultValues = def.options && Array.isArray(def.options) 
          ? def.options.map((o: any) => o.value)
          : [];
        return {
          key: def.name,
          values: defaultValues.slice(0, 4) // default to first 4 predefined option values
        };
      });
      setOptions(initialOptions);
    } else {
      // Fallback defaults if no schema attributes defined yet
      setOptions([
        { key: 'color', values: ['Red', 'Blue', 'Black'] },
        { key: 'size', values: ['S', 'M', 'L', 'XL'] }
      ]);
    }
  }, [attributeDefinitions]);

  const handleTogglePresetValue = (optIndex: number, val: string) => {
    const updated = [...options];
    const currentVals = updated[optIndex].values;
    if (currentVals.includes(val)) {
      updated[optIndex].values = currentVals.filter(v => v !== val);
    } else {
      updated[optIndex].values.push(val);
    }
    setOptions(updated);
  };

  const handleSelectAllPresetValues = (optIndex: number, allVals: string[]) => {
    const updated = [...options];
    const isAllSelected = allVals.length === updated[optIndex].values.length;
    if (isAllSelected) {
      updated[optIndex].values = [];
    } else {
      updated[optIndex].values = [...allVals];
    }
    setOptions(updated);
  };

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

  const handleAddOptionKey = (customKey?: string) => {
    const key = (customKey || newKey).trim().toLowerCase();
    if (!key) return;
    if (!options.some(opt => opt.key === key)) {
      // Check if there are default values from schema
      const def = attributeDefinitions.find((d: any) => d.name === key);
      const defaultVals = def?.options ? def.options.map((o: any) => o.value) : [];
      setOptions([...options, { key, values: defaultVals }]);
    }
    if (!customKey) setNewKey('');
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
    if (Number(basePrice) <= 0) {
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
      alert('الرجاء اختيار أو إضافة قيمة واحدة على الأقل من الخيارات لتوليد المصفوفة');
      return;
    }

    // Calculate combination count
    const count = Object.values(validOptions).reduce((acc, curr) => acc * curr.length, 1);
    if (count > 200 && !confirm(`أنت على وشك توليد ${count} تركيبة SKUs دفعة واحدة. هل أنت متأكد؟`)) {
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
      alert(`تم توليد مصفوفة المتغيرات (${count} SKUs) بنجاح`);
      onGenerated();
    } catch (err: any) {
      alert(err.message || 'فشل توليد مصفوفة المتغيرات');
    } finally {
      setGenerating(false);
    }
  };

  // Find unadded attribute definitions to suggest to merchant
  const unaddedAxes = attributeDefinitions.filter(
    (def: any) => !options.some(opt => opt.key === def.name)
  );

  // Compute live estimated SKU count
  const estimatedSkus = options.reduce((acc, curr) => {
    return curr.values.length > 0 ? acc * curr.values.length : acc;
  }, options.some(o => o.values.length > 0) ? 1 : 0);

  return (
    <div className="bg-gradient-to-br from-indigo-950/5 via-slate-900/5 to-indigo-900/10 border-2 border-indigo-500/20 rounded-3xl p-6 space-y-6 text-right shadow-md" dir="rtl">
      <div className="flex items-center justify-between pb-4 border-b border-indigo-200/60">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-md shadow-indigo-600/25">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-md font-black text-slate-900">توليد مصفوفة المتغيرات الذكية (Smart Matrix Generator)</h4>
            <p className="text-xxs text-slate-500 font-medium mt-0.5">
              اختر محاور المتغيرات (مثل اللون، المقاس) وبنقرة واحدة سيتم إنشاء كافة توافقات وتركيبات SKUs في جدول المخزون.
            </p>
          </div>
        </div>

        <div className="bg-indigo-900 text-indigo-50 px-4 py-2 rounded-2xl flex items-center gap-2 shadow-sm border border-indigo-800">
          <span className="text-xs font-medium text-indigo-200">التوليد المتوقع:</span>
          <span className="text-sm font-black text-amber-300 font-mono">{estimatedSkus}</span>
          <span className="text-xs font-bold">SKUs</span>
        </div>
      </div>

      <form onSubmit={handleGenerate} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div>
            <label className="block text-xxs font-extrabold text-slate-700 mb-1 text-right">
              بادئة SKU الأساسية (Base SKU Prefix) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="مثال: NEX-IPH or VELO-TEE"
              value={baseSku}
              onChange={e => setBaseSku(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-extrabold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-indigo-950 text-left dir-ltr"
            />
            <p className="text-[10px] text-slate-400 mt-1">سيتم إلحاق رموز الخيارات تلقائياً (مثال: NEX-IPH-RED-XL).</p>
          </div>

          <div>
            <label className="block text-xxs font-extrabold text-slate-700 mb-1 text-right">
              السعر الأساسي للمتغيرات (ر.س) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              required
              step="0.01"
              min="0"
              placeholder="0.00"
              value={basePrice || ''}
              onChange={e => setBasePrice(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
            <p className="text-[10px] text-slate-400 mt-1">يمكنك لاحقاً تعديل أسعار فردية لكل SKU بعد إنتاجه في الجدول.</p>
          </div>
        </div>

        {/* Options Builder */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black text-slate-800 flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
              <span>محاور وخيارات التوليد النشطة (Active Matrix Axes)</span>
            </label>
          </div>

          <div className="space-y-3.5">
            {options.map((opt, optIndex) => {
              const def = attributeDefinitions.find((d: any) => d.name === opt.key);
              const attrLabel = def?.labelTranslations?.ar || def?.labelTranslations?.en || opt.key;
              const presetOptions = def?.options && Array.isArray(def.options) ? def.options : [];
              const allPresetVals: string[] = presetOptions.map((o: any) => o.value);

              return (
                <div key={opt.key} className="bg-white border border-indigo-100 p-4 rounded-2xl space-y-3.5 shadow-xs">
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-black">
                        {attrLabel}
                      </span>
                      <span className="text-xs font-mono text-slate-400">({opt.key})</span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {presetOptions.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleSelectAllPresetValues(optIndex, allPresetVals)}
                          className="text-xxs font-extrabold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded-lg cursor-pointer"
                        >
                          {allPresetVals.length === opt.values.length ? (
                            <>
                              <Square className="w-3 h-3" />
                              <span>إلغاء تحديد الكل</span>
                            </>
                          ) : (
                            <>
                              <CheckSquare className="w-3 h-3" />
                              <span>تحديد جميع الخيارات المعتمدة ({presetOptions.length})</span>
                            </>
                          )}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleRemoveOptionKey(optIndex)}
                        className="text-xxs text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded-lg font-bold transition-colors cursor-pointer"
                      >
                        حذف المحور
                      </button>
                    </div>
                  </div>

                  {/* Preset Option Pills from Schema */}
                  {presetOptions.length > 0 && (
                    <div className="space-y-1.5 bg-slate-50/80 p-3 rounded-xl border border-slate-200/60">
                      <span className="text-[11px] font-bold text-slate-500 block">انقر على الخيارات المعتمدة لتفعيلها في المصفوفة:</span>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {presetOptions.map((preset: any, idx: number) => {
                          const isSelected = opt.values.includes(preset.value);
                          const presetLabel = preset.labelTranslations?.ar || preset.labelTranslations?.en || preset.value;
                          const isColor = def?.type === 'color';

                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleTogglePresetValue(optIndex, preset.value)}
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20 scale-[1.03]'
                                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              {isColor && (
                                <span className="w-4 h-4 rounded-full border border-slate-300 shadow-2xs shrink-0" style={{ backgroundColor: preset.value }} />
                              )}
                              <span>{presetLabel}</span>
                              <span className={`text-[10px] font-mono ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>({preset.value})</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Selected Option Values & Manual Input */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-slate-500 block">القيم التي سيتم تركيبها في المصفوفة ({opt.values.length}):</span>
                    <div className="flex flex-wrap gap-1.5 items-center">
                      {opt.values.map((val, valIndex) => {
                        const matchedPreset = presetOptions.find((o: any) => o.value === val);
                        const label = matchedPreset ? (matchedPreset.labelTranslations?.ar || matchedPreset.value) : val;
                        return (
                          <span
                            key={valIndex}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-900 rounded-xl text-xs font-extrabold border border-indigo-200/70 shadow-2xs"
                          >
                            {def?.type === 'color' && matchedPreset && (
                              <span className="w-3 h-3 rounded-full border border-slate-300 shrink-0" style={{ backgroundColor: matchedPreset.value }} />
                            )}
                            <span>{label}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveOptionValue(optIndex, valIndex)}
                              className="text-indigo-400 hover:text-rose-600 hover:bg-rose-100 p-0.5 rounded-md transition-colors cursor-pointer"
                              title="إزالة"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        );
                      })}

                      {opt.values.length === 0 && (
                        <span className="text-xxs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">
                          ⚠️ لم يتم اختيار أي قيم لهذا المحور بعد
                        </span>
                      )}

                      {/* Manual Add Custom Value */}
                      <div className="flex items-center gap-1.5 mr-auto bg-slate-50 p-1 rounded-xl border border-slate-200">
                        <input
                          type="text"
                          placeholder="إضافة قيمة مخصصة..."
                          value={newValue[optIndex] || ''}
                          onChange={e => setNewValue({ ...newValue, [optIndex]: e.target.value })}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddOptionValue(optIndex);
                            }
                          }}
                          className="w-32 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden focus:border-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddOptionValue(optIndex)}
                          className="p-1.5 bg-indigo-600 text-white hover:bg-indigo-500 rounded-lg shadow-2xs cursor-pointer"
                          title="إضافة"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add Option Key / Suggestions */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
            <span className="text-xs font-extrabold text-slate-800 block">إضافة محاور أخرى للمصفوفة:</span>
            
            {/* Suggested Schema Axes */}
            {unaddedAxes.length > 0 && (
              <div className="flex flex-wrap gap-2 pb-2 border-b border-slate-100">
                <span className="text-xxs text-slate-400 font-bold self-center">قوالب متاحة للإضافة السريعة:</span>
                {unaddedAxes.map((axis: any) => (
                  <button
                    key={axis.id}
                    type="button"
                    onClick={() => handleAddOptionKey(axis.name)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-200/60 transition-colors cursor-pointer"
                  >
                    <Tags className="w-3.5 h-3.5 text-indigo-600" />
                    <span>+ إضافة محور: {axis.labelTranslations?.ar || axis.name}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="اسم خيار أو محور مخصص (مثال: storage أو material)"
                value={newKey}
                onChange={e => setNewKey(e.target.value)}
                className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-hidden"
              />
              <button
                type="button"
                onClick={() => handleAddOptionKey()}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-extrabold transition-colors cursor-pointer"
              >
                إضافة ميزة مخصصة
              </button>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={generating || estimatedSkus === 0}
          className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-extrabold rounded-2xl text-sm transition-all shadow-xl shadow-indigo-600/30 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 hover:scale-[1.01]"
        >
          {generating ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>جاري توليد المصفوفة وحفظ SKUs في قاعدة البيانات...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 text-amber-300" />
              <span>توليد مصفوفة المتغيرات ({estimatedSkus} SKUs) الآن</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
