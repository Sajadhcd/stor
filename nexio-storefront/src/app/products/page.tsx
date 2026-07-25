'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { ProductCard } from '@/components/products/ProductCard';
import { Search, Filter, RefreshCw, Check } from 'lucide-react';

// ─── Type helpers ─────────────────────────────────────────────────────────────

interface CategoryNode {
  id: string;
  nameTranslations: Record<string, string>;
  slug: string;
  isActive: boolean;
  position: number;
  productCount: number;
  children: CategoryNode[];
}

/** Flatten a nested category tree into a single sorted list for the sidebar. */
function flattenCategories(nodes: CategoryNode[]): CategoryNode[] {
  const result: CategoryNode[] = [];
  const walk = (list: CategoryNode[]) => {
    for (const node of list) {
      result.push(node);
      if (node.children?.length) walk(node.children);
    }
  };
  walk(nodes);
  return result;
}

// ─── Main listing component ──────────────────────────────────────────────────

function ProductsListingContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // URL Query parameters as single source of truth
  const search = searchParams.get('search') || '';
  const selectedBrandSlug = searchParams.get('brandSlug') || '';
  const selectedCategoryId = searchParams.get('categoryId') || '';
  const minPrice = searchParams.get('minPrice') || '';
  const maxPrice = searchParams.get('maxPrice') || '';
  const inStockOnly = searchParams.get('inStockOnly') === 'true';
  const sortBy = searchParams.get('sortBy') || 'created_at';

  // Controlled input states for responsive UI typing
  const [searchInput, setSearchInput] = useState(search);
  const [minPriceInput, setMinPriceInput] = useState(minPrice);
  const [maxPriceInput, setMaxPriceInput] = useState(maxPrice);

  const [products, setProducts] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [loading, setLoading] = useState(true);

  // Sync inputs with URL params on navigation
  useEffect(() => { setSearchInput(search); }, [search]);
  useEffect(() => { setMinPriceInput(minPrice); }, [minPrice]);
  useEffect(() => { setMaxPriceInput(maxPrice); }, [maxPrice]);

  /** Push URL updates without full navigation. */
  const updateUrlParams = (newParams: Record<string, string | null>) => {
    const currentSearch = typeof window !== 'undefined' ? window.location.search : searchParams.toString();
    const params = new URLSearchParams(currentSearch);
    for (const [key, val] of Object.entries(newParams)) {
      if (val === null || val === '') {
        params.delete(key);
      } else {
        params.set(key, val);
      }
    }
    const newUrl = `${pathname}?${params.toString()}`;
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', newUrl);
    }
    router.push(newUrl);
  };

  // Fetch brands
  useEffect(() => {
    apiFetch('/brands')
      .then((result) => setBrands(result || []))
      .catch((err) => console.error('Failed to load brands:', err));
  }, []);

  // Fetch categories dynamically from API
  useEffect(() => {
    setCategoriesLoading(true);
    apiFetch('/categories')
      .then((tree: CategoryNode[]) => setCategories(flattenCategories(tree || [])))
      .catch((err) => {
        console.error('Failed to load categories:', err);
        setCategories([]);
      })
      .finally(() => setCategoriesLoading(false));
  }, []);

  // Fetch products whenever filters change
  useEffect(() => {
    async function loadProducts() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.append('search', search.trim());
        if (selectedBrandSlug) params.append('brandSlug', selectedBrandSlug);
        if (selectedCategoryId) params.append('categoryId', selectedCategoryId);
        if (minPrice) params.append('minPrice', minPrice);
        if (maxPrice) params.append('maxPrice', maxPrice);
        if (inStockOnly) params.append('inStockOnly', 'true');

        if (sortBy === 'price_asc') {
          params.append('sortBy', 'price_asc');
        } else if (sortBy === 'price_desc') {
          params.append('sortBy', 'price_desc');
        } else {
          params.append('sortBy', 'created_at');
          params.append('sortOrder', 'desc');
        }

        const result = await apiFetch(`/products?${params.toString()}`);
        setProducts(result.data ?? []);
      } catch (err) {
        console.error('Failed to load products:', err);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    }
    loadProducts();
  }, [search, selectedBrandSlug, selectedCategoryId, minPrice, maxPrice, inStockOnly, sortBy]);

  const handleResetFilters = () => {
    setSearchInput('');
    setMinPriceInput('');
    setMaxPriceInput('');
    router.push(pathname);
  };

  return (
    <div className="space-y-8 text-right" dir="rtl">
      {/* Header */}
      <div className="bg-slate-900 text-white p-8 rounded-3xl relative overflow-hidden shadow-2xl">
        <div className="absolute inset-0 bg-linear-to-r from-emerald-600/20 to-indigo-600/10 mix-blend-multiply" />
        <div className="relative z-10 space-y-2">
          <h1 className="text-3xl font-black tracking-tight">كتالوج المنتجات والأسعار (IQD)</h1>
          <p className="text-sm text-slate-300 max-w-xl">
            تصفح كتالوج المنتجات الذكي بالدينار العراقي الشامل للتوصيل والضمان لكافة المحافظات العراقية الثمانية عشر.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Filters Sidebar */}
        <div className="space-y-6 lg:col-span-1">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <Filter className="w-4 h-4 text-emerald-600" />
                <span>خيارات التصفية</span>
              </span>
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xxs font-bold text-slate-400 hover:text-emerald-600 transition-colors"
              >
                إعادة ضبط
              </button>
            </div>

            {/* Category Filter — Dynamic from API */}
            <div className="space-y-2">
              <span className="block text-xxs font-black text-slate-400">التصنيفات</span>
              {categoriesLoading ? (
                <div className="flex items-center gap-2 py-2 text-xs text-slate-400">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>جاري تحميل التصنيفات...</span>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => updateUrlParams({ categoryId: '' })}
                    className={`w-full py-2 px-3.5 rounded-xl text-xs font-bold text-right transition-all flex items-center justify-between ${
                      selectedCategoryId === ''
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                        : 'bg-slate-50 text-slate-600 border border-transparent hover:bg-slate-100'
                    }`}
                  >
                    <span>كافة التصنيفات</span>
                    {selectedCategoryId === '' && <Check className="w-3.5 h-3.5" />}
                  </button>

                  {categories.length === 0 ? (
                    <p className="text-xs text-slate-400 px-2 py-1">لا توجد تصنيفات متاحة</p>
                  ) : (
                    categories.map((cat) => {
                      const name = cat.nameTranslations?.ar || cat.nameTranslations?.en || cat.slug;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => updateUrlParams({ categoryId: cat.id })}
                          className={`w-full py-2 px-3.5 rounded-xl text-xs font-bold text-right transition-all flex items-center justify-between ${
                            selectedCategoryId === cat.id
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                              : 'bg-slate-50 text-slate-600 border border-transparent hover:bg-slate-100'
                          }`}
                        >
                          <span>{name}</span>
                          {selectedCategoryId === cat.id && <Check className="w-3.5 h-3.5" />}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Brand Filter */}
            <div className="space-y-2">
              <span className="block text-xxs font-black text-slate-400">العلامة التجارية</span>
              <select
                value={selectedBrandSlug}
                onChange={(e) => updateUrlParams({ brandSlug: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 text-slate-800"
              >
                <option value="">جميع الماركات</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.slug}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Price Range */}
            <div className="space-y-2">
              <span className="block text-xxs font-black text-slate-400">نطاق السعر (بالدولار المعادل)</span>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="من"
                  value={minPriceInput}
                  onChange={(e) => {
                    setMinPriceInput(e.target.value);
                    updateUrlParams({ minPrice: e.target.value });
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 text-slate-800 text-center"
                />
                <input
                  type="number"
                  placeholder="إلى"
                  value={maxPriceInput}
                  onChange={(e) => {
                    setMaxPriceInput(e.target.value);
                    updateUrlParams({ maxPrice: e.target.value });
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 text-slate-800 text-center"
                />
              </div>
            </div>

            {/* In Stock Only */}
            <div className="flex items-center gap-2.5 pt-2 border-t border-slate-100">
              <input
                type="checkbox"
                id="inStockOnly"
                checked={inStockOnly}
                onChange={(e) => updateUrlParams({ inStockOnly: e.target.checked ? 'true' : null })}
                className="w-4 h-4 text-emerald-600 rounded-md focus:ring-emerald-500"
              />
              <label htmlFor="inStockOnly" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                المتوفر في المخزن فقط
              </label>
            </div>
          </div>
        </div>

        {/* Products Grid & Toolbar */}
        <div className="lg:col-span-3 space-y-6">
          {/* Toolbar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:max-w-xs">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  updateUrlParams({ search: e.target.value });
                }}
                placeholder="ابحث عن اسم المنتج، SKU، ماركة..."
                className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <span className="text-xxs font-bold text-slate-400">ترتيب بحسب:</span>
              <select
                value={sortBy}
                onChange={(e) => updateUrlParams({ sortBy: e.target.value })}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 text-slate-800"
              >
                <option value="created_at">الأحدث أولاً</option>
                <option value="price_asc">السعر: من الأقل للأعلى</option>
                <option value="price_desc">السعر: من الأعلى للأقل</option>
              </select>
            </div>
          </div>

          {/* Products List */}
          {loading ? (
            <div className="py-24 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
              <span>جاري تحميل الكتالوج...</span>
            </div>
          ) : products.length === 0 ? (
            <div className="py-24 text-center text-slate-400 text-sm bg-white rounded-2xl border border-slate-200/80 p-8">
              لا توجد منتجات مطابقة لخيارات التصفية الحالية.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProductsListingPage() {
  return (
    <Suspense fallback={<div className="py-24 text-center text-slate-400 text-sm">جاري تحميل كتالوج المنتجات...</div>}>
      <ProductsListingContent />
    </Suspense>
  );
}
