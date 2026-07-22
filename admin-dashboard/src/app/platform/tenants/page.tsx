'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { apiFetch } from '@/lib/api';
import { Layers, Plus, Search, CheckCircle, AlertTriangle, ShieldCheck, X } from 'lucide-react';

export default function TenantsPage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [subdomain, setSubdomain] = useState('');

  const loadTenants = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/platform/tenants');
      setTenants(data.data ?? (Array.isArray(data) ? data : []));
    } catch (err: any) {
      console.error('Failed to load tenants:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTenants();
  }, []);

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch('/platform/tenants', {
        method: 'POST',
        body: JSON.stringify({ name, subdomain: subdomain.toLowerCase() }),
      });

      setShowModal(false);
      setName('');
      setSubdomain('');
      await loadTenants();
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء إضافة المستأجر');
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
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">إدارة المستأجرين والمؤسسات (Tenant Administration)</h1>
            <p className="text-sm text-slate-500 mt-1">التحكم في المتاجر والمؤسسات المسجلة على المنصة وإحصائيات استخدام كل مستأجر.</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة مستأجر جديد</span>
          </button>
        </div>

        {/* Tenants Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-slate-400 text-sm">جاري جلب قائمة المستأجرين...</div>
          ) : tenants.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">لا يوجد مستأجرون مسجلون حالياً.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <th className="py-4 pr-6">اسم المؤسسة (Tenant)</th>
                    <th className="py-4">النطاق الفرعي (Subdomain)</th>
                    <th className="py-4">حالة الحساب</th>
                    <th className="py-4">المستخدمين</th>
                    <th className="py-4">المنتجات</th>
                    <th className="py-4">الطلبات</th>
                    <th className="py-4 pl-6 text-center">إجمالي الإيرادات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {tenants.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 pr-6 font-bold text-slate-900">{t.name}</td>
                      <td className="py-4 font-mono text-xs text-indigo-600 font-bold">{t.subdomain}.nexio.com</td>
                      <td className="py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border ${
                          t.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>{t.status}</span>
                        </span>
                      </td>
                      <td className="py-4 text-slate-600 font-bold">{t.usersCount || 0}</td>
                      <td className="py-4 text-slate-600 font-bold">{t.productsCount || 0}</td>
                      <td className="py-4 text-slate-600 font-bold">{t.ordersCount || 0}</td>
                      <td className="py-4 pl-6 text-center font-bold text-emerald-600">
                        {Number(t.revenue || 0).toLocaleString()} ر.س
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add Tenant Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <h3 className="text-lg font-bold text-slate-900">إضافة مستأجر/مؤسسة جديدة</h3>
              <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTenant} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم المؤسسة/المتجر</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: Scribble Books Store"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">النطاق الفرعي (Subdomain)</label>
                <input
                  type="text"
                  required
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value)}
                  placeholder="scribble"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dir-ltr text-right"
                />
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
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm transition-colors shadow-lg shadow-emerald-600/30 disabled:opacity-50"
                >
                  {submitting ? 'جاري الإنشاء...' : 'إضافة المستأجر'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
