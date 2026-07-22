'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { apiFetch } from '@/lib/api';
import { Store, Plus, Globe, DollarSign, X, CheckCircle } from 'lucide-react';

export default function StoresPage() {
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('SAR');
  const [languageDefault, setLanguageDefault] = useState('ar');

  const loadStores = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/stores');
      setStores(data.data ?? (Array.isArray(data) ? data : []));
    } catch (err: any) {
      console.error('Failed to load stores:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStores();
  }, []);

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch('/stores', {
        method: 'POST',
        body: JSON.stringify({
          name,
          currency,
          languageDefault,
        }),
      });

      setShowModal(false);
      setName('');
      await loadStores();
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء إضافة المتجر');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">إدارة المتاجر الإقليمية (Stores & Currencies)</h1>
            <p className="text-sm text-slate-500 mt-1">تكوين فروع المتاجر الإلكترونية للأسواق المختلفة (الخليجي، الأوروبي، إلخ).</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة متجر جديد</span>
          </button>
        </div>

        {/* Stores Grid */}
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">جاري جلب قائمة المتاجر...</div>
        ) : stores.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">لا توجد متاجر مسجلة حالياً.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stores.map((store) => (
              <div key={store.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 relative overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                      <Store className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">{store.name}</h3>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">ID: {store.id.substring(0, 8)}...</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-xs font-medium text-slate-600">
                  <div className="flex justify-between">
                    <span>العملة الرسمية:</span>
                    <span className="font-bold text-slate-900 font-mono">{store.currency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>اللغة الافتراضية:</span>
                    <span className="font-bold text-slate-900 font-mono">{store.languageDefault}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>تاريخ الإنشاء:</span>
                    <span className="text-slate-500">{new Date(store.createdAt).toLocaleDateString('ar-SA')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Store Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <h3 className="text-lg font-bold text-slate-900">إضافة متجر إقليمي جديد</h3>
              <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStore} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم المتجر</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: متجر Velo السعودية"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">العملة الأساسية</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="SAR">SAR (ريال سعودي)</option>
                  <option value="AED">AED (درهم إماراتي)</option>
                  <option value="EUR">EUR (يورو)</option>
                  <option value="USD">USD (دولار أمريكي)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اللغة الافتراضية</label>
                <select
                  value={languageDefault}
                  onChange={(e) => setLanguageDefault(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="ar">العربية (Arabic)</option>
                  <option value="en">English</option>
                </select>
              </div>

              <div className="flex items-center gap-3 pt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-sm transition-colors shadow-lg shadow-indigo-600/30 disabled:opacity-50"
                >
                  {submitting ? 'جاري الحفظ...' : 'حفظ المتجر'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
