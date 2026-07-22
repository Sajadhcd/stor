'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { apiFetch } from '@/lib/api';
import { CreditCard, Plus, CheckCircle2, ShieldCheck, DollarSign, FileText, X } from 'lucide-react';

export default function SubscriptionsPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [price, setPrice] = useState('299');

  const loadData = async () => {
    setLoading(true);
    try {
      const [plansData, subsData, invData] = await Promise.all([
        apiFetch('/platform/plans').catch(() => []),
        apiFetch('/platform/subscriptions').catch(() => []),
        apiFetch('/platform/invoices').catch(() => []),
      ]);
      setPlans(plansData.data ?? (Array.isArray(plansData) ? plansData : []));
      setSubscriptions(subsData.data ?? (Array.isArray(subsData) ? subsData : []));
      setInvoices(invData.data ?? (Array.isArray(invData) ? invData : []));
    } catch (err: any) {
      console.error('Failed to load subscription data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch('/platform/plans', {
        method: 'POST',
        body: JSON.stringify({
          name,
          code: code.toUpperCase(),
          price: Number(price),
        }),
      });

      setShowModal(false);
      setName('');
      setCode('');
      setPrice('299');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء إضافة الخطة');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">إدارة الباقات والاشتراكات الفوترية (SaaS Subscriptions)</h1>
            <p className="text-sm text-slate-500 mt-1">التحكم في خطط الأسعار والاشتراكات النشطة للمؤسسات وسجل الفواتير الصادرة.</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة خطة سعرية جديدة</span>
          </button>
        </div>

        {/* Section 1: Subscription Plans Cards */}
        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-indigo-600" />
            <span>خطط الأسعار المتاحة (Plans)</span>
          </h2>

          {loading ? (
            <div className="py-12 text-center text-slate-400 text-sm">جاري جلب خطط الأسعار...</div>
          ) : plans.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">لا توجد خطط سعرية مضافة حالياً.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map((p) => (
                <div key={p.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs relative">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold font-mono">
                      {p.code}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">{p.billingCycle}</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mt-3">{p.name}</h3>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-3xl font-black text-slate-900">{Number(p.price).toLocaleString()}</span>
                    <span className="text-sm font-bold text-slate-500">{p.currency || 'SAR'} / شهرياً</span>
                  </div>
                  <ul className="mt-6 space-y-2.5 border-t border-slate-100 pt-4 text-xs text-slate-600 font-medium">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span>حتى {p.maxUsers} مستخدمين</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span>حتى {p.maxProducts} منتج في الكتالوج</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span>حتى {p.maxOrders} طلبات شهرياً</span>
                    </li>
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 2: Active Tenant Subscriptions */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900">اشتراكات المستأجرين النشطة (Active Subscriptions)</h2>
          </div>
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-sm">جاري الجلب...</div>
          ) : subscriptions.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">لا توجد اشتراكات نشطة حالياً.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <th className="py-4 pr-6">المؤسسة (Tenant)</th>
                    <th className="py-4">الخطة السعرية</th>
                    <th className="py-4">الحالة</th>
                    <th className="py-4">تاريخ البدء</th>
                    <th className="py-4 pl-6 text-center">تاريخ التجديد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {subscriptions.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 pr-6 font-bold text-slate-900">{s.tenant?.name || 'مؤسسة'}</td>
                      <td className="py-4 font-bold text-indigo-600">{s.plan?.name || 'الخطة'}</td>
                      <td className="py-4">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{s.status}</span>
                        </span>
                      </td>
                      <td className="py-4 text-xs text-slate-500">{new Date(s.startDate).toLocaleDateString('ar-SA')}</td>
                      <td className="py-4 pl-6 text-center text-xs text-slate-500">
                        {s.renewalDate ? new Date(s.renewalDate).toLocaleDateString('ar-SA') : 'تلقائي'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add Plan Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <h3 className="text-lg font-bold text-slate-900">إضافة خطة سعرية جديدة</h3>
              <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePlan} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم الخطة</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: الباقة الاحترافية PRO"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">كود الخطة الفريد (Code)</label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="PRO_MONTHLY"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dir-ltr text-right font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">السعر الشهري (SAR)</label>
                <input
                  type="number"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="499"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
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
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-sm transition-colors shadow-lg shadow-indigo-600/30 disabled:opacity-50"
                >
                  {submitting ? 'جاري الحفظ...' : 'حفظ الخطة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
