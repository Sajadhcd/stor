'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { apiFetch } from '@/lib/api';
import { CreditCard, CheckCircle, Clock, AlertCircle, RefreshCw } from 'lucide-react';

export default function PaymentsPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPayments = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/payments');
      setPayments(data.data ?? (Array.isArray(data) ? data : []));
    } catch (err: any) {
      console.error('Failed to load payments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">إدارة المدفوعات والمعاملات المالية</h1>
            <p className="text-sm text-slate-500 mt-1">متابعة سجلات المعاملات عبر البوابات المالية (Stripe, Moyasar, Checkout.com).</p>
          </div>
        </div>

        {/* Payments Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-slate-400 text-sm">جاري جلب سجل المدفوعات...</div>
          ) : payments.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">لا توجد معاملات دفع مسجلة حالياً.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <th className="py-4 pr-6">بوابة الدفع (Provider)</th>
                    <th className="py-4">رقم المعاملة (Transaction ID)</th>
                    <th className="py-4">المبلغ والعملة</th>
                    <th className="py-4">حالة المعاملة</th>
                    <th className="py-4 pl-6 text-center">تاريخ العملية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 pr-6 font-bold text-slate-900">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                            <CreditCard className="w-4 h-4" />
                          </div>
                          <span>{p.provider}</span>
                        </div>
                      </td>
                      <td className="py-4 font-mono text-xs text-slate-600">{p.transactionId}</td>
                      <td className="py-4 font-bold text-slate-900">
                        {Number(p.amount).toLocaleString()} {p.currency || 'SAR'}
                      </td>
                      <td className="py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border ${
                          p.status === 'PAID' || p.status === 'CAPTURED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          p.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>{p.status}</span>
                        </span>
                      </td>
                      <td className="py-4 pl-6 text-center text-xs text-slate-500">
                        {new Date(p.createdAt).toLocaleString('ar-SA')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
