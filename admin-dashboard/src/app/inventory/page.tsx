'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Boxes, Warehouse, Lock, ArrowUpRight, AlertTriangle, ShieldCheck, Layers } from 'lucide-react';

export default function InventoryPage() {
  const warehouses = [
    {
      id: 'wh-sa-01',
      name: 'المستودع الرئيسي - الرياض',
      code: 'WH-RUH-01',
      activeStock: 1450,
      reservedStock: 120,
      status: 'نشط',
    },
    {
      id: 'wh-jed-02',
      name: 'مستودع جدة الساحلي',
      code: 'WH-JED-02',
      activeStock: 890,
      reservedStock: 45,
      status: 'نشط',
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">إدارة المخزون والمستودعات</h1>
            <p className="text-sm text-slate-500 mt-1">مراقبة كميات المخزون الفيزيائي والمخصص مع حماية المعاملات الحصرية (FOR UPDATE).</p>
          </div>
          <div className="flex items-center gap-2 px-3.5 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-200/60">
            <Lock className="w-4 h-4 text-indigo-600" />
            <span>حماية الأقفال متشابكة بالمعاملات</span>
          </div>
        </div>

        {/* Warehouses Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {warehouses.map((wh) => (
            <div key={wh.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                    <Warehouse className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">{wh.name}</h3>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">{wh.code}</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-200/60">
                  {wh.status}
                </span>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-xs text-slate-500 font-bold block mb-1">المخزون الفيزيائي المتاح</span>
                  <span className="text-xl font-black text-slate-900">{wh.activeStock} قطعة</span>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-xs text-slate-500 font-bold block mb-1">المخزون المحجوز (Reserved)</span>
                  <span className="text-xl font-black text-amber-600">{wh.reservedStock} قطعة</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Stock Level Details Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">مستويات المخزون حسب المتغيرات (Stock Levels)</h3>
              <p className="text-xs text-slate-500">تفاصيل كمية المخزون حسب رمز SKU المعزول للمستأجر</p>
            </div>
            <span className="text-xs text-slate-500 font-medium">جدول مرجعي</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider">
                  <th className="py-4 pr-6">المتغير SKU</th>
                  <th className="py-4">المستودع</th>
                  <th className="py-4">الكمية الفيزيائية</th>
                  <th className="py-4">الكمية المحجوزة</th>
                  <th className="py-4 pl-6 text-center">حالة الصلاحية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                <tr className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-4 pr-6 font-mono text-xs font-bold text-indigo-600">VELO-TSHIRT-BLK-L</td>
                  <td className="py-4">المستودع الرئيسي - الرياض</td>
                  <td className="py-4 font-bold text-slate-900">500</td>
                  <td className="py-4 text-amber-600 font-bold">25</td>
                  <td className="py-4 pl-6 text-center">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-200/60">
                      متوفر
                    </span>
                  </td>
                </tr>
                <tr className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-4 pr-6 font-mono text-xs font-bold text-indigo-600">VELO-RUN-SNK-42</td>
                  <td className="py-4">المستودع الرئيسي - الرياض</td>
                  <td className="py-4 font-bold text-slate-900">250</td>
                  <td className="py-4 text-amber-600 font-bold">10</td>
                  <td className="py-4 pl-6 text-center">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-200/60">
                      متوفر
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
