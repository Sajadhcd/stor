'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { apiFetch } from '@/lib/api';
import { Warehouse, Plus, CheckCircle, X, MapPin } from 'lucide-react';

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);

  const loadWarehouses = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/warehouses');
      setWarehouses(data.data ?? (Array.isArray(data) ? data : []));
    } catch (err: any) {
      console.error('Failed to load warehouses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWarehouses();
  }, []);

  const handleCreateWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch('/warehouses', {
        method: 'POST',
        body: JSON.stringify({
          name,
          isActive,
        }),
      });

      setShowModal(false);
      setName('');
      await loadWarehouses();
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء إضافة المستودع');
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
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">إدارة المستودعات الفيزيائية (Physical Warehouses)</h1>
            <p className="text-sm text-slate-500 mt-1">تكوين المستودعات وتخصيص مواقع الشحن والتخزين المعزولة برقم المستأجر.</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة مستودع جديد</span>
          </button>
        </div>

        {/* Warehouses Grid */}
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">جاري جلب قائمة المستودعات...</div>
        ) : warehouses.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">لا توجد مستودعات مسجلة حالياً.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {warehouses.map((wh) => (
              <div key={wh.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 relative overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                      <Warehouse className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">{wh.name}</h3>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">ID: {wh.id.substring(0, 8)}...</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-lg text-xs font-bold ${
                    wh.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {wh.isActive ? 'نشط' : 'غير نشط'}
                  </span>
                </div>

                <div className="text-xs text-slate-500 font-medium">
                  <span>تاريخ الإنشاء: </span>
                  <span className="text-slate-900 font-bold">{new Date(wh.createdAt).toLocaleDateString('ar-SA')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Warehouse Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <h3 className="text-lg font-bold text-slate-900">إضافة مستودع جديد</h3>
              <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateWarehouse} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم المستودع</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: المستودع اللوجستي المركزي - الدمام"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="active"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded-md focus:ring-indigo-500"
                />
                <label htmlFor="active" className="text-xs font-bold text-slate-700 cursor-pointer">
                  تفعيل المستودع فوراً لعمليات الشحن والتخزين
                </label>
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
                  {submitting ? 'جاري الحفظ...' : 'حفظ المستودع'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
