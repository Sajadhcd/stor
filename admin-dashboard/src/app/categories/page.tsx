'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { apiFetch } from '@/lib/api';
import {
  FolderTree,
  Plus,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  X,
  Check,
  AlertTriangle,
  ImageIcon,
  Globe,
  Eye,
  EyeOff,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CategoryNode {
  id: string;
  parentId: string | null;
  nameTranslations: Record<string, string>;
  descriptionTranslations: Record<string, string> | null;
  slug: string;
  imageUrl: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  isActive: boolean;
  position: number;
  productCount: number;
  children: CategoryNode[];
}

interface CategoryFormData {
  nameAr: string;
  nameEn: string;
  slug: string;
  parentId: string;
  imageUrl: string;
  metaTitle: string;
  metaDescription: string;
  isActive: boolean;
  position: number;
}

const EMPTY_FORM: CategoryFormData = {
  nameAr: '',
  nameEn: '',
  slug: '',
  parentId: '',
  imageUrl: '',
  metaTitle: '',
  metaDescription: '',
  isActive: true,
  position: 0,
};

// ─── Category Row (recursive tree) ───────────────────────────────────────────

function CategoryRow({
  cat,
  depth,
  allCategories,
  onEdit,
  onDelete,
}: {
  cat: CategoryNode;
  depth: number;
  allCategories: CategoryNode[];
  onEdit: (c: CategoryNode) => void;
  onDelete: (c: CategoryNode) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const nameAr = cat.nameTranslations?.ar || cat.nameTranslations?.en || cat.slug;

  return (
    <>
      <tr className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
        {/* Name + expand */}
        <td className="py-3 px-4">
          <div className="flex items-center gap-2" style={{ paddingRight: `${depth * 24}px` }}>
            {cat.children.length > 0 ? (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="p-0.5 text-slate-400 hover:text-slate-700 transition-colors shrink-0"
              >
                {expanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
            ) : (
              <span className="w-5 shrink-0" />
            )}
            <div className="flex items-center gap-2.5 min-w-0">
              {cat.imageUrl ? (
                <img
                  src={cat.imageUrl}
                  alt={nameAr}
                  className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                  <FolderTree className="w-4 h-4 text-slate-400" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">{nameAr}</p>
                <p className="text-xxs text-slate-400 truncate">{cat.slug}</p>
              </div>
            </div>
          </div>
        </td>

        {/* Product count */}
        <td className="py-3 px-4 text-center">
          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700">
            {cat.productCount}
          </span>
        </td>

        {/* Status */}
        <td className="py-3 px-4 text-center">
          {cat.isActive ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700">
              <Eye className="w-3 h-3" /> مرئي
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-500">
              <EyeOff className="w-3 h-3" /> مخفي
            </span>
          )}
        </td>

        {/* Position */}
        <td className="py-3 px-4 text-center text-xs text-slate-500 font-bold">{cat.position}</td>

        {/* Actions */}
        <td className="py-3 px-4">
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => onEdit(cat)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
              title="تعديل"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(cat)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
              title="حذف"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </td>
      </tr>

      {/* Recursive children */}
      {expanded &&
        cat.children.map((child) => (
          <CategoryRow
            key={child.id}
            cat={child}
            depth={depth + 1}
            allCategories={allCategories}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
    </>
  );
}

// ─── Category Form Modal ──────────────────────────────────────────────────────

function CategoryFormModal({
  isOpen,
  onClose,
  editingCategory,
  allCategories,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  editingCategory: CategoryNode | null;
  allCategories: CategoryNode[];
  onSuccess: () => void;
}) {
  const [form, setForm] = useState<CategoryFormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (editingCategory) {
      setForm({
        nameAr: editingCategory.nameTranslations?.ar || '',
        nameEn: editingCategory.nameTranslations?.en || '',
        slug: editingCategory.slug,
        parentId: editingCategory.parentId || '',
        imageUrl: editingCategory.imageUrl || '',
        metaTitle: editingCategory.metaTitle || '',
        metaDescription: editingCategory.metaDescription || '',
        isActive: editingCategory.isActive,
        position: editingCategory.position,
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setError('');
  }, [editingCategory, isOpen]);

  const autoSlug = (name: string) =>
    name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const handleNameArChange = (val: string) => {
    setForm((prev) => ({
      ...prev,
      nameAr: val,
      slug: prev.slug || autoSlug(val),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const payload = {
        nameTranslations: {
          ar: form.nameAr,
          ...(form.nameEn ? { en: form.nameEn } : {}),
        },
        slug: form.slug,
        ...(form.parentId ? { parentId: form.parentId } : {}),
        ...(form.imageUrl ? { imageUrl: form.imageUrl } : {}),
        ...(form.metaTitle ? { metaTitle: form.metaTitle } : {}),
        ...(form.metaDescription ? { metaDescription: form.metaDescription } : {}),
        isActive: form.isActive,
        position: form.position,
      };

      if (editingCategory) {
        await apiFetch(`/categories/${editingCategory.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/categories', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء الحفظ');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Flatten categories for parent selector, excluding current category and its descendants
  const flatAll: CategoryNode[] = [];
  const flattenAll = (nodes: CategoryNode[]) => {
    for (const n of nodes) {
      flatAll.push(n);
      if (n.children?.length) flattenAll(n.children);
    }
  };
  flattenAll(allCategories);
  const parentOptions = editingCategory
    ? flatAll.filter((c) => c.id !== editingCategory.id)
    : flatAll;

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl p-6 w-full max-w-xl shadow-2xl border border-slate-200 my-8 text-right" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
          <h3 className="text-base font-black text-slate-900">
            {editingCategory ? `تعديل تصنيف: ${editingCategory.nameTranslations?.ar || ''}` : 'إضافة تصنيف جديد'}
          </h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-bold">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* Names */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">اسم التصنيف (عربي) *</label>
              <input
                type="text"
                required
                value={form.nameAr}
                onChange={(e) => handleNameArChange(e.target.value)}
                placeholder="مثال: ملابس رياضية"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">Category Name (English)</label>
              <input
                type="text"
                value={form.nameEn}
                onChange={(e) => setForm((p) => ({ ...p, nameEn: e.target.value }))}
                placeholder="e.g. Sportswear"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
              />
            </div>
          </div>

          {/* Slug */}
          <div>
            <label className="block text-xs font-black text-slate-700 mb-1">Slug (URL) *</label>
            <input
              type="text"
              required
              value={form.slug}
              onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
              placeholder="e.g. sportswear"
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 text-left"
              dir="ltr"
            />
          </div>

          {/* Parent Category */}
          <div>
            <label className="block text-xs font-black text-slate-700 mb-1">التصنيف الرئيسي (اختياري)</label>
            <select
              value={form.parentId}
              onChange={(e) => setForm((p) => ({ ...p, parentId: e.target.value }))}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
            >
              <option value="">تصنيف رئيسي (بدون أب)</option>
              {parentOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameTranslations?.ar || c.nameTranslations?.en || c.slug}
                </option>
              ))}
            </select>
          </div>

          {/* Image URL */}
          <div>
            <label className="block text-xs font-black text-slate-700 mb-1">
              <span className="flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5" />
                <span>رابط صورة التصنيف (اختياري)</span>
              </span>
            </label>
            <input
              type="url"
              value={form.imageUrl}
              onChange={(e) => setForm((p) => ({ ...p, imageUrl: e.target.value }))}
              placeholder="https://..."
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 text-slate-800 text-left"
              dir="ltr"
            />
          </div>

          {/* SEO Section */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <span className="flex items-center gap-1.5 text-xxs font-black text-slate-400 uppercase tracking-wider">
              <Globe className="w-3.5 h-3.5" />
              <span>SEO (تحسين محركات البحث)</span>
            </span>
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">Meta Title</label>
              <input
                type="text"
                maxLength={255}
                value={form.metaTitle}
                onChange={(e) => setForm((p) => ({ ...p, metaTitle: e.target.value }))}
                placeholder="عنوان SEO..."
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">Meta Description</label>
              <textarea
                maxLength={500}
                rows={2}
                value={form.metaDescription}
                onChange={(e) => setForm((p) => ({ ...p, metaDescription: e.target.value }))}
                placeholder="وصف SEO (حتى 500 حرف)..."
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 text-slate-800 resize-none"
              />
            </div>
          </div>

          {/* Position & Status */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">ترتيب العرض</label>
              <input
                type="number"
                min="0"
                value={form.position}
                onChange={(e) => setForm((p) => ({ ...p, position: parseInt(e.target.value, 10) || 0 }))}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 text-slate-800 text-center"
              />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                  className="w-4 h-4 text-indigo-600 rounded-md focus:ring-indigo-500"
                />
                <span className="text-xs font-black text-slate-700">مرئي في المتجر</span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-xl text-xs transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl text-xs transition-colors shadow-lg shadow-indigo-600/30 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>جاري الحفظ...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{editingCategory ? 'حفظ التعديلات' : 'إنشاء التصنيف'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Confirmation Modal ────────────────────────────────────────────────

function DeleteConfirmModal({
  category,
  onConfirm,
  onCancel,
  deleting,
}: {
  category: CategoryNode | null;
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}) {
  if (!category) return null;
  const name = category.nameTranslations?.ar || category.nameTranslations?.en || category.slug;
  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-200 text-right" dir="rtl">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100 mb-4">
          <div className="p-2 bg-rose-100 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
          </div>
          <h3 className="text-sm font-black text-slate-900">تأكيد حذف التصنيف</h3>
        </div>
        <p className="text-xs text-slate-600 mb-2">
          هل أنت متأكد من حذف تصنيف{' '}
          <span className="font-black text-slate-900">&ldquo;{name}&rdquo;</span>؟
        </p>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200/60 rounded-lg px-3 py-2 mb-5">
          سيتم نقل التصنيفات الفرعية إلى المستوى الرئيسي. لن يتأثر مخزون المنتجات.
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-xl text-xs transition-colors"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {deleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            <span>{deleting ? 'جاري الحذف...' : 'حذف التصنيف'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryNode | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<CategoryNode | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState('');

  const loadCategories = async () => {
    setLoading(true);
    try {
      const result = await apiFetch('/categories?includeInactive=true');
      setCategories(result || []);
    } catch (err) {
      console.error('Failed to load categories:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handleEdit = (cat: CategoryNode) => {
    setEditingCategory(cat);
    setFormOpen(true);
  };

  const handleNew = () => {
    setEditingCategory(null);
    setFormOpen(true);
  };

  const handleFormSuccess = () => {
    loadCategories();
    showToast(editingCategory ? 'تم تعديل التصنيف بنجاح ✓' : 'تم إنشاء التصنيف بنجاح ✓');
  };

  const handleDelete = async () => {
    if (!deletingCategory) return;
    setDeleting(true);
    try {
      await apiFetch(`/categories/${deletingCategory.id}`, { method: 'DELETE' });
      setDeletingCategory(null);
      loadCategories();
      showToast('تم حذف التصنيف بنجاح ✓');
    } catch (err: any) {
      showToast(`خطأ: ${err.message || 'فشل الحذف'}`);
    } finally {
      setDeleting(false);
    }
  };

  // Flatten for parent selector
  const flatAll: CategoryNode[] = [];
  const flattenAll = (nodes: CategoryNode[]) => {
    for (const n of nodes) {
      flatAll.push(n);
      if (n.children?.length) flattenAll(n.children);
    }
  };
  flattenAll(categories);

  return (
    <DashboardLayout>
      <div className="space-y-6 text-right" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-slate-900 flex items-center gap-2.5">
              <div className="p-2 bg-indigo-100 rounded-xl">
                <FolderTree className="w-5 h-5 text-indigo-600" />
              </div>
              إدارة التصنيفات
            </h1>
            <p className="text-xs text-slate-500 mt-1 mr-10">
              أنشئ وعدّل تصنيفات المنتجات الهرمية مع دعم الـ SEO
            </p>
          </div>
          <button
            type="button"
            onClick={handleNew}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl text-xs transition-colors shadow-lg shadow-indigo-600/30"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة تصنيف</span>
          </button>
        </div>

        {/* Toast notification */}
        {toast && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 bg-slate-900 text-white text-xs font-bold rounded-2xl shadow-2xl flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            {toast}
          </div>
        )}

        {/* Category Tree Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {loading ? (
            <div className="py-24 flex items-center justify-center gap-2 text-slate-400 text-sm">
              <RefreshCw className="w-5 h-5 animate-spin text-indigo-600" />
              <span>جاري تحميل التصنيفات...</span>
            </div>
          ) : categories.length === 0 ? (
            <div className="py-24 text-center text-slate-400 text-sm space-y-3">
              <FolderTree className="w-10 h-10 text-slate-300 mx-auto" />
              <p>لا توجد تصنيفات بعد.</p>
              <button
                type="button"
                onClick={handleNew}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black hover:bg-indigo-500 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                أنشئ أول تصنيف
              </button>
            </div>
          ) : (
            <table className="w-full text-right">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="py-3 px-4 text-xxs font-black text-slate-500 uppercase tracking-wider">التصنيف</th>
                  <th className="py-3 px-4 text-xxs font-black text-slate-500 uppercase tracking-wider text-center">المنتجات</th>
                  <th className="py-3 px-4 text-xxs font-black text-slate-500 uppercase tracking-wider text-center">الحالة</th>
                  <th className="py-3 px-4 text-xxs font-black text-slate-500 uppercase tracking-wider text-center">الترتيب</th>
                  <th className="py-3 px-4 text-xxs font-black text-slate-500 uppercase tracking-wider text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => (
                  <CategoryRow
                    key={cat.id}
                    cat={cat}
                    depth={0}
                    allCategories={flatAll}
                    onEdit={handleEdit}
                    onDelete={(c) => setDeletingCategory(c)}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Category Form Modal */}
      <CategoryFormModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        editingCategory={editingCategory}
        allCategories={categories}
        onSuccess={handleFormSuccess}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        category={deletingCategory}
        onConfirm={handleDelete}
        onCancel={() => setDeletingCategory(null)}
        deleting={deleting}
      />
    </DashboardLayout>
  );
}
