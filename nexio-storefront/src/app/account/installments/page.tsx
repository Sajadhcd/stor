'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { formatIQD } from '@/lib/currency';
import { Boxes, ArrowRight, CheckCircle2, Calendar } from 'lucide-react';
import Link from 'next/link';

export default function AccountInstallmentsPage() {
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadInstallments() {
      try {
        const data = await apiFetch('/installments/contracts');
        setContracts(data.data ?? (Array.isArray(data) ? data : []));
      } catch (err: any) {
        console.error('Failed to load installment contracts:', err);
      } finally {
        setLoading(false);
      }
    }
    loadInstallments();
  }, []);

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <Link href="/account" className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-emerald-600">
        <ArrowRight className="w-4 h-4" />
        <span>العودة للوحة حساب العميل</span>
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">عقود البيع بالأقساط المباشرة</h1>
        <p className="text-sm text-slate-500 mt-1">متابعة الأقساط الشهرية المسددة والمتبقية وجدول الاستحقاقات.</p>
      </div>

      <div className="space-y-6">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">جاري جلب عقود الأقساط...</div>
        ) : contracts.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">لا توجد عقود أقساط مسجلة حالياً.</div>
        ) : (
          contracts.map((contract) => (
            <div key={contract.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                <div>
                  <span className="text-xs text-slate-400 block font-medium">عقد تقسيط رقم:</span>
                  <span className="text-lg font-black text-indigo-600 font-mono block">{contract.id.slice(0, 8)}</span>
                </div>
                <span className="px-3 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold border border-amber-200 w-fit">
                  {contract.status}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block mb-1">إجمالي المبلغ:</span>
                  <span className="font-bold text-slate-900">{formatIQD(Number(contract.totalAmount))}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-1">الدفعة الأولى المقدمة:</span>
                  <span className="font-bold text-emerald-600">{formatIQD(Number(contract.downPayment))}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-1">المتبقي بالأقساط:</span>
                  <span className="font-bold text-rose-600">{formatIQD(Number(contract.remainingAmount))}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-1">عدد الأشهر:</span>
                  <span className="font-bold text-slate-900">{contract.months} أشهر</span>
                </div>
              </div>

              {/* Monthly Schedule Table */}
              {contract.schedules && contract.schedules.length > 0 && (
                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <h4 className="text-xs font-bold text-slate-700">جدول استحقاق الأقساط الشهرية:</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {contract.schedules.map((sch: any, idx: number) => (
                      <div
                        key={sch.id}
                        className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                          sch.status === 'PAID' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        <div>
                          <span className="font-bold block">القسط {idx + 1}</span>
                          <span className="text-[10px] text-slate-500 font-mono block">
                            {new Date(sch.dueDate).toLocaleDateString('ar-IQ')}
                          </span>
                        </div>
                        <span className="font-black">{formatIQD(Number(sch.amount))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
