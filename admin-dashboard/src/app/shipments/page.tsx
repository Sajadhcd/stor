'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { apiFetch } from '@/lib/api';
import { Truck, CheckCircle2, Clock, AlertTriangle, ArrowUpRight } from 'lucide-react';

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadShipments = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/shipping/shipments');
      setShipments(data.data ?? (Array.isArray(data) ? data : []));
    } catch (err: any) {
      console.error('Failed to load shipments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShipments();
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">إدارة الشحن والتوصيل اللوجستي</h1>
            <p className="text-sm text-slate-500 mt-1">متابعة شحنات الطلبات وتتبع أرقام الشحن مع شركات اللوجستية (Aramex, SMSA, DHL).</p>
          </div>
        </div>

        {/* Shipments Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-slate-400 text-sm">جاري جلب سجل الشحنات...</div>
          ) : shipments.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">لا توجد شحنات مسجلة حالياً.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <th className="py-4 pr-6">شركة الشحن (Carrier)</th>
                    <th className="py-4">رقم التتبع (Tracking Number)</th>
                    <th className="py-4">حالة الشحنة</th>
                    <th className="py-4">تاريخ الشحن</th>
                    <th className="py-4 pl-6 text-center">تاريخ التوصيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {shipments.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 pr-6 font-bold text-slate-900">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                            <Truck className="w-4 h-4" />
                          </div>
                          <span>{s.carrier}</span>
                        </div>
                      </td>
                      <td className="py-4 font-mono text-xs text-indigo-600 font-bold">{s.trackingNumber}</td>
                      <td className="py-4">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold border border-amber-200">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{s.status}</span>
                        </span>
                      </td>
                      <td className="py-4 text-xs text-slate-500">
                        {s.shippedAt ? new Date(s.shippedAt).toLocaleDateString('ar-SA') : 'قيد التجهيز'}
                      </td>
                      <td className="py-4 pl-6 text-center text-xs text-slate-500">
                        {s.deliveredAt ? new Date(s.deliveredAt).toLocaleDateString('ar-SA') : 'لم يتم التوصيل بعد'}
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
