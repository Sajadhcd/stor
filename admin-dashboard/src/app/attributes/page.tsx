'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { apiFetch } from '@/lib/api';
import {
  Tags,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  X,
  Check,
  AlertTriangle,
  Globe,
  Settings2,
  Palette,
  Type,
  Hash,
  ToggleLeft,
  SlidersHorizontal,
  Layers,
  ListFilter,
  Sparkles,
} from 'lucide-react';

// ─── Interfaces & Types ────────────────────────────────────────────────────────

interface AttributeOption {
  value: string;
  labelTranslations: Record<string, string>;
}

interface AttributeDefinition {
  id: string;
  categoryId: string | null;
  name: string;
  labelTranslations: Record<string, string>;
  type: 'select' | 'color' | 'text' | 'number' | 'boolean';
  options: AttributeOption[] | null;
  isRequired: boolean;
  position: number;
  isVariantAxis: boolean;
  category?: {
    id: string;
    nameTranslations: Record<string, string>;
    slug: string;
  };
}

interface CategoryNode {
  id: string;
  nameTranslations: Record<string, string>;
  slug: string;
  children?: CategoryNode[];
}

interface FlattenedCategory {
  id: string;
  name: string;
}

interface OptionFormRow {
  value: string;
  labelAr: string;
  labelEn: string;
}

// ─── Helper Functions ──────────────────────────────────────────────────────────

function flattenCategories(nodes: CategoryNode[], prefix = ''): FlattenedCategory[] {
  const list: FlattenedCategory[] = [];
  for (const node of nodes) {
    const name = node.nameTranslations?.ar || node.nameTranslations?.en || node.slug;
    const fullName = prefix ? `${prefix} > ${name}` : name;
    list.push({ id: node.id, name: fullName });
    if (node.children && node.children.length > 0) {
      list.push(...flattenCategories(node.children, fullName));
    }
  }
  return list;
}

const TYPE_CONFIG = {
  select: { label: 'قائمة خيارات (Select)', icon: SlidersHorizontal, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  color: { label: 'ألوان بصرية (Color Swatch)', icon: Palette, color: 'text-rose-600 bg-rose-50 border-rose-200' },
  text: { label: 'نص حر (Text)', icon: Type, color: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
  number: { label: 'قيمة رقمية (Number)', icon: Hash, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  boolean: { label: 'مفتاح تشغيل (Boolean)', icon: ToggleLeft, color: 'text-amber-600 bg-amber-50 border-amber-200' },
};

export default function AttributesPage() {
  const [attributes, setAttributes] = useState<AttributeDefinition[]>([]);
  const [categories, setCategories] = useState<FlattenedCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAttr, setEditingAttr] = useState<AttributeDefinition | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [labelAr, setLabelAr] = useState('');
  const [labelEn, setLabelEn] = useState('');
  const [categoryId, setCategoryId] = useState<string>(''); // empty = global
  const [type, setType] = useState<AttributeDefinition['type']>('select');
  const [options, setOptions] = useState<OptionFormRow[]>([]);
  const [isRequired, setIsRequired] = useState(false);
  const [isVariantAxis, setIsVariantAxis] = useState(true);
  const [position, setPosition] = useState<number>(0);
  const [autoSlug, setAutoSlug] = useState(true);

  // ─── Data Loading ──────────────────────────────────────────────────────────

  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [attrsRes, catsRes] = await Promise.all([
        apiFetch('/attribute-definitions'),
        apiFetch('/categories?includeInactive=true').catch(() => []),
      ]);
      setAttributes(Array.isArray(attrsRes) ? attrsRes : []);
      setCategories(flattenCategories(Array.isArray(catsRes) ? catsRes : []));
    } catch (err: any) {
      console.error('Failed to load attribute definitions:', err);
      setErrorMsg(err.message || 'فشل تحميل خصائص ومواصفات المنتجات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // ─── Form Handlers ─────────────────────────────────────────────────────────

  const handleOpenCreate = () => {
    setEditingAttr(null);
    setName('');
    setLabelAr('');
    setLabelEn('');
    setCategoryId('');
    setType('select');
    setOptions([
      { value: 'option_1', labelAr: 'خيار ١', labelEn: 'Option 1' },
      { value: 'option_2', labelAr: 'خيار ٢', labelEn: 'Option 2' },
    ]);
    setIsRequired(false);
    setIsVariantAxis(true);
    setPosition(0);
    setAutoSlug(true);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (attr: AttributeDefinition) => {
    setEditingAttr(attr);
    setName(attr.name);
    setLabelAr(attr.labelTranslations?.ar || '');
    setLabelEn(attr.labelTranslations?.en || '');
    setCategoryId(attr.categoryId || '');
    setType(attr.type);
    
    if (attr.options && (attr.type === 'select' || attr.type === 'color')) {
      const mapped = attr.options.map((o) => ({
        value: o.value,
        labelAr: o.labelTranslations?.ar || o.value,
        labelEn: o.labelTranslations?.en || o.value,
      }));
      setOptions(mapped);
    } else {
      setOptions([]);
    }
    
    setIsRequired(attr.isRequired ?? false);
    setIsVariantAxis(attr.isVariantAxis ?? true);
    setPosition(attr.position ?? 0);
    setAutoSlug(false);
    setIsModalOpen(true);
  };

  const handleTypeChange = (newType: AttributeDefinition['type']) => {
    setType(newType);
    if (newType === 'color' && options.length === 0) {
      setOptions([
        { value: '#FF0000', labelAr: 'أحمر', labelEn: 'Red' },
        { value: '#0000FF', labelAr: 'أزرق', labelEn: 'Blue' },
      ]);
    } else if (newType === 'select' && options.length === 0) {
      setOptions([
        { value: 'S', labelAr: 'صغير (S)', labelEn: 'Small (S)' },
        { value: 'M', labelAr: 'متوسط (M)', labelEn: 'Medium (M)' },
      ]);
    } else if (newType !== 'select' && newType !== 'color') {
      setOptions([]);
    }
  };

  const handleLabelEnChange = (val: string) => {
    setLabelEn(val);
    if (!editingAttr && autoSlug) {
      const slugged = val
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
      setName(slugged);
    }
  };

  const handleAddOption = () => {
    const fallbackVal = type === 'color' ? '#000000' : `opt_${options.length + 1}`;
    setOptions([...options, { value: fallbackVal, labelAr: '', labelEn: '' }]);
  };

  const handleRemoveOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleOptionChange = (index: number, field: keyof OptionFormRow, val: string) => {
    const updated = [...options];
    updated[index][field] = val;
    setOptions(updated);
  };

  const handleDelete = async (attrId: string, attrTitle: string) => {
    if (!confirm(`هل أنت متأكد من حذف خاصية "${attrTitle}" نهائياً من الكتالوج؟`)) return;
    try {
      await apiFetch(`/attribute-definitions/${attrId}`, { method: 'DELETE' });
      alert('تم حذف الخاصية بنجاح');
      loadData();
    } catch (err: any) {
      alert(err.message || 'فشل حذف الخاصية');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('الرجاء إدخال الرمز التقني للخاصية (Machine Name)');
      return;
    }
    if (!labelAr.trim() || !labelEn.trim()) {
      alert('الرجاء إدخال اسم الخاصية باللغتين العربية والإنجليزية');
      return;
    }
    if ((type === 'select' || type === 'color') && options.length === 0) {
      alert('هذا النوع من الخصائص يتطلب إضافة قيمة واحدة على الأقل في قائمة الخيارات');
      return;
    }

    // Build options payload for select/color
    let finalOptions = undefined;
    if (type === 'select' || type === 'color') {
      finalOptions = options
        .filter((o) => o.value.trim() !== '')
        .map((o) => ({
          value: o.value.trim(),
          labelTranslations: {
            ar: o.labelAr.trim() || o.value.trim(),
            en: o.labelEn.trim() || o.value.trim(),
          },
        }));
      if (finalOptions.length === 0) {
        alert('الرجاء التأكد من تعليمة القيم الصحيحة للخيارات');
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload: Record<string, any> = {
        labelTranslations: {
          ar: labelAr.trim(),
          en: labelEn.trim(),
        },
        type,
        isRequired,
        isVariantAxis,
        position: Number(position),
      };

      if (type === 'select' || type === 'color') {
        payload.options = finalOptions;
      }

      if (!editingAttr) {
        payload.name = name.trim().toLowerCase();
        if (categoryId) {
          payload.categoryId = categoryId;
        }
        await apiFetch('/attribute-definitions', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        alert('تم إضافة خاصية المنتج الجديدة بنجاح');
      } else {
        payload.name = name.trim().toLowerCase();
        await apiFetch(`/attribute-definitions/${editingAttr.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        alert('تم حفظ التعديلات بنجاح');
      }

      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'فشل حفظ خاصية المنتج');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Filtering ─────────────────────────────────────────────────────────────

  const filteredAttributes = attributes.filter((attr) => {
    if (!selectedCategoryFilter) return true;
    if (selectedCategoryFilter === 'global') return attr.categoryId === null;
    return attr.categoryId === selectedCategoryFilter;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6 text-right" dir="rtl">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-8 shadow-xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-gradient-to-tr from-indigo-500 to-violet-500 rounded-2xl shadow-lg shadow-indigo-500/30">
              <Tags className="w-8 h-8 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-xxs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 uppercase tracking-wider">
                  SaaS Attribute System
                </span>
              </div>
              <h1 className="text-2xl font-black tracking-tight">إدارة خصائص ومتغيرات المنتجات (Attribute Builder)</h1>
              <p className="text-sm text-slate-300 font-medium mt-1">
                تعريف قوالب الخصائص والمواصفات (مثل اللون، المقاس، السعة) وبناء مصفوفات SKUs الديناميكية لكل تصنيف أو للمنصة بأكملها.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-3 bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 rounded-2xl border border-slate-700 transition-all cursor-pointer shadow-md"
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer hover:scale-[1.02]"
            >
              <Plus className="w-5 h-5" />
              <span>إضافة خاصية جديدة</span>
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-700 font-bold text-sm">
            <ListFilter className="w-4 h-4 text-indigo-600" />
            <span>تصفية حسب نطاق التصنيف:</span>
          </div>
          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="w-full max-w-xs px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
          >
            <option value="">عرض جميع الخصائص ({attributes.length})</option>
            <option value="global">🌐 خصائص عامة لكل الكتالوج (Global)</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                📁 {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Error State */}
        {errorMsg && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Attributes List / Table */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-20 text-center text-slate-400 font-bold text-sm flex flex-col items-center gap-3">
              <RefreshCw className="w-7 h-7 animate-spin text-indigo-600" />
              <span>جاري تحميل قائمة خصائص المنتجات...</span>
            </div>
          ) : filteredAttributes.length === 0 ? (
            <div className="py-20 text-center text-slate-400 font-bold text-sm flex flex-col items-center gap-3">
              <Tags className="w-10 h-10 text-slate-300" />
              <p>لا توجد خصائص معرفة بهذا النطاق حالياً.</p>
              <button
                onClick={handleOpenCreate}
                className="mt-2 px-5 py-2.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-bold rounded-xl text-xs transition-colors"
              >
                إضافة أول خاصية الآن
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="py-4 pr-6">اسم الخاصية (العربية / English)</th>
                    <th className="py-4">الرمز التقني (Key)</th>
                    <th className="py-4">نوع البيانات</th>
                    <th className="py-4">النطاق والربط</th>
                    <th className="py-4">الغرض (محور SKUs)</th>
                    <th className="py-4">الخيارات المعرّفة</th>
                    <th className="py-4 pl-6 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredAttributes.map((attr) => {
                    const typeConf = TYPE_CONFIG[attr.type] || TYPE_CONFIG.select;
                    const TypeIcon = typeConf.icon;
                    const nameAr = attr.labelTranslations?.ar || attr.name;
                    const nameEn = attr.labelTranslations?.en || attr.name;
                    const catName = attr.category
                      ? attr.category.nameTranslations?.ar || attr.category.nameTranslations?.en || attr.category.slug
                      : 'عام لكل المنتجات (Global)';

                    return (
                      <tr key={attr.id} className="hover:bg-slate-50/60 transition-colors group">
                        {/* Name */}
                        <td className="py-4 pr-6">
                          <div>
                            <span className="font-extrabold text-slate-900 text-sm block">{nameAr}</span>
                            <span className="text-slate-400 text-xxs block mt-0.5">{nameEn}</span>
                          </div>
                        </td>

                        {/* Machine Key */}
                        <td className="py-4 font-mono text-xs text-slate-600 font-bold">
                          <span className="px-2 py-1 bg-slate-100 rounded-lg border border-slate-200/60">
                            {attr.name}
                          </span>
                        </td>

                        {/* Type */}
                        <td className="py-4">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xxs font-bold border ${typeConf.color}`}>
                            <TypeIcon className="w-3.5 h-3.5" />
                            <span>{typeConf.label}</span>
                          </span>
                        </td>

                        {/* Scope */}
                        <td className="py-4">
                          {attr.categoryId ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xxs font-bold">
                              <span>📁</span>
                              <span>{catName}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-violet-50 text-violet-700 rounded-lg text-xxs font-bold border border-violet-200/50">
                              <Globe className="w-3 h-3 text-violet-600" />
                              <span>عام (Global Axis)</span>
                            </span>
                          )}
                          {attr.isRequired && (
                            <span className="mr-1.5 px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-md text-[10px] font-extrabold">
                              إلزامي
                            </span>
                          )}
                        </td>

                        {/* Variant Axis vs Product Spec */}
                        <td className="py-4">
                          {attr.isVariantAxis ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-bold text-xxs">
                              <Check className="w-3 h-3" />
                              <span>محور متغيرات SKUs</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md font-medium text-xxs">
                              <span>مواصفة للمنتج</span>
                            </span>
                          )}
                        </td>

                        {/* Options Preview */}
                        <td className="py-4 max-w-xs">
                          {attr.type === 'color' && attr.options ? (
                            <div className="flex flex-wrap items-center gap-1.5">
                              {attr.options.slice(0, 6).map((opt, idx) => (
                                <div
                                  key={idx}
                                  className="w-6 h-6 rounded-full border border-slate-300 shadow-2xs flex items-center justify-center relative group/swatch cursor-help"
                                  style={{ backgroundColor: opt.value }}
                                  title={opt.labelTranslations?.ar || opt.labelTranslations?.en || opt.value}
                                />
                              ))}
                              {attr.options.length > 6 && (
                                <span className="text-xxs font-bold text-slate-400">+{attr.options.length - 6}</span>
                              )}
                            </div>
                          ) : attr.type === 'select' && attr.options ? (
                            <div className="flex flex-wrap gap-1">
                              {attr.options.slice(0, 4).map((opt, idx) => (
                                <span key={idx} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-xxs font-semibold">
                                  {opt.labelTranslations?.ar || opt.value}
                                </span>
                              ))}
                              {attr.options.length > 4 && (
                                <span className="text-xxs font-bold text-slate-400">+{attr.options.length - 4}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xxs">— بدون خيارات (إدخال حر) —</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-4 pl-6 text-center">
                          <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleOpenEdit(attr)}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                              title="تعديل الخاصية والخيارات"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(attr.id, nameAr)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="حذف الخاصية"
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
      </div>

      {/* ─── Create / Edit Attribute Modal ────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl p-7 w-full max-w-3xl shadow-2xl border border-slate-200 text-right my-8 max-h-[90vh] flex flex-col" dir="rtl">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                  {editingAttr ? <Settings2 className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    {editingAttr ? `تعديل خاصية: ${editingAttr.labelTranslations?.ar || editingAttr.name}` : 'إنشاء خاصية منتج جديدة (New Attribute)'}
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">قم بتهيئة المواصفات، الألوان، وأنواع المدخلات المسموحة.</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="space-y-6 pt-4 overflow-y-auto pr-1 flex-1">
              {/* Type Cards Selector */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-2">نوع المدخلات وقالب العرض (Input Type):</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                  {(Object.keys(TYPE_CONFIG) as AttributeDefinition['type'][]).map((t) => {
                    const conf = TYPE_CONFIG[t];
                    const Icon = conf.icon;
                    const isSelected = type === t;
                    return (
                      <button
                        type="button"
                        key={t}
                        onClick={() => handleTypeChange(t)}
                        className={`flex items-center gap-2 p-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer text-right ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/80 text-indigo-700 shadow-sm'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`} />
                        <span className="truncate">{conf.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Title & Machine Name */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50/80 p-4 rounded-2xl border border-slate-200/60">
                <div>
                  <label className="block text-xxs font-extrabold text-slate-600 mb-1">اسم الخاصية (بالعربية) <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: اللون، المقاس، السعة"
                    value={labelAr}
                    onChange={(e) => setLabelAr(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xxs font-extrabold text-slate-600 mb-1">Title (In English) <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Color, Size, Capacity"
                    value={labelEn}
                    onChange={(e) => handleLabelEnChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-left dir-ltr"
                  />
                </div>

                <div>
                  <label className="block text-xxs font-extrabold text-slate-600 mb-1 flex items-center justify-between">
                    <span>الرمز التقني (Machine Key) <span className="text-rose-500">*</span></span>
                    {!editingAttr && (
                      <button
                        type="button"
                        onClick={() => setAutoSlug(!autoSlug)}
                        className="text-[9px] font-bold text-indigo-600 underline"
                      >
                        {autoSlug ? 'إدخال يدوي' : 'توليد تلقائي'}
                      </button>
                    )}
                  </label>
                  <input
                    type="text"
                    required
                    readOnly={!editingAttr && autoSlug}
                    placeholder="color, size, ram"
                    value={name}
                    onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                    className={`w-full px-3.5 py-2.5 font-mono text-xs border border-slate-200 rounded-xl text-left dir-ltr ${
                      !editingAttr && autoSlug ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white font-bold text-indigo-700'
                    }`}
                  />
                </div>
              </div>

              {/* Scope & Ordering */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xxs font-extrabold text-slate-600 mb-1">نطاق تطبيق الخاصية (Category Scope):</label>
                  <select
                    value={categoryId}
                    disabled={!!editingAttr} // Scope is immutable after creation due to unique composite indices
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-100 disabled:text-slate-500 cursor-pointer"
                  >
                    <option value="">🌐 عام (تطبق على كافة الكتالوج والمنتجات)</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        📁 {cat.name}
                      </option>
                    ))}
                  </select>
                  {editingAttr && (
                    <p className="text-[10px] text-amber-600 font-bold mt-1">ملاحظة: لا يمكن تغيير نطاق التصنيف بعد إنشاء الخاصية.</p>
                  )}
                </div>

                <div>
                  <label className="block text-xxs font-extrabold text-slate-600 mb-1">ترتيب العرض في الكتالوج (Position):</label>
                  <input
                    type="number"
                    min="0"
                    value={position}
                    onChange={(e) => setPosition(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Behavior Toggles */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isVariantAxis}
                    onChange={(e) => setIsVariantAxis(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded-md focus:ring-indigo-500 mt-0.5"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">محور لتمييز المتغيرات (Variant Axis)</span>
                    <span className="text-xxs text-slate-500 block leading-relaxed">
                      عند التفعيل، يمكن استخدام هذه الخاصية في توليد مصفوفات SKUs وتحديد أسعار مستقلة لكل خيار (مثل اللون، المقاس).
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isRequired}
                    onChange={(e) => setIsRequired(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded-md focus:ring-indigo-500 mt-0.5"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">إدخال إلزامي للمنتجات (Required)</span>
                    <span className="text-xxs text-slate-500 block leading-relaxed">
                      إلزام التاجر بتحديد قيمة لهذه الخاصية عند إنشاء أو حفظ متغيرات الكتالوج.
                    </span>
                  </div>
                </label>
              </div>

              {/* ─── Options Builder (For select and color types) ─────────────── */}
              {(type === 'select' || type === 'color') && (
                <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                        {type === 'color' ? <Palette className="w-4 h-4 text-rose-500" /> : <SlidersHorizontal className="w-4 h-4 text-indigo-500" />}
                        <span>قائمة الخيارات المسموحة (Options)</span>
                      </h4>
                      <p className="text-xxs text-slate-400 mt-0.5">عرف القيم التي يمكن للتاجر الاختيار منها أو استخدامها في التوليد.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddOption}
                      className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xxs font-extrabold shadow-xs transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إضافة خيار</span>
                    </button>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {options.map((opt, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
                        {/* Swatch Picker if color */}
                        {type === 'color' && (
                          <div className="flex items-center gap-1 shrink-0">
                            <input
                              type="color"
                              value={opt.value.startsWith('#') && opt.value.length === 7 ? opt.value : '#000000'}
                              onChange={(e) => handleOptionChange(idx, 'value', e.target.value)}
                              className="w-8 h-8 rounded-lg cursor-pointer border border-slate-200 shrink-0 p-0"
                              title="اختر درجة اللون"
                            />
                            <input
                              type="text"
                              placeholder="#hex"
                              value={opt.value}
                              onChange={(e) => handleOptionChange(idx, 'value', e.target.value)}
                              className="w-20 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xxs font-mono font-bold text-left dir-ltr"
                            />
                          </div>
                        )}

                        {/* Value if select */}
                        {type === 'select' && (
                          <div className="w-1/4">
                            <input
                              type="text"
                              required
                              placeholder="القيمة (e.g. S, XL, RED)"
                              value={opt.value}
                              onChange={(e) => handleOptionChange(idx, 'value', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800"
                            />
                          </div>
                        )}

                        {/* Label Ar */}
                        <div className="flex-1">
                          <input
                            type="text"
                            required
                            placeholder="الاسم بالعربية"
                            value={opt.labelAr}
                            onChange={(e) => handleOptionChange(idx, 'labelAr', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                          />
                        </div>

                        {/* Label En */}
                        <div className="flex-1">
                          <input
                            type="text"
                            required
                            placeholder="Label (EN)"
                            value={opt.labelEn}
                            onChange={(e) => handleOptionChange(idx, 'labelEn', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 text-left dir-ltr"
                          />
                        </div>

                        {/* Delete option */}
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(idx)}
                          disabled={options.length <= 1}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                          title="حذف الخيار"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}

                    {options.length === 0 && (
                      <div className="py-6 text-center text-slate-400 text-xs font-bold">
                        لم يتم إدراة أي خيارات بعد. انقر فوق &quot;إضافة خيار&quot; أعلاه لبدء إدخال القيم المسموحة.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Form Actions Foot */}
              <div className="flex items-center gap-3 pt-4 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-colors shadow-lg shadow-indigo-600/30 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>جاري الحفظ...</span>
                    </>
                  ) : (
                    <span>{editingAttr ? 'حفظ التعديلات' : 'إنشاء الخاصية وحفظها في الكتالوج'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
