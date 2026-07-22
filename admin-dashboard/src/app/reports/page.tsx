'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { apiFetch } from '@/lib/api';
import { BarChart3, ShieldCheck, Database, FileText, Globe, Terminal, Server } from 'lucide-react';

export default function ReportsPage() {
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/audit-logs');
      setAuditLogs(data.data ?? (Array.isArray(data) ? data : []));
    } catch (err: any) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">التقارير وسجلات التدقيق الإداري (Audit Ledger)</h1>
            <p className="text-sm text-slate-500 mt-1">سجل المعاملات الإدارية المولدة تلقائياً عبر مشغلات قاعدة البيانات (PL/pgSQL Triggers).</p>
          </div>
          <div className="flex items-center gap-2 px-3.5 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold border border-emerald-200/60">
            <Database className="w-4 h-4 text-emerald-600" />
            <span>سجل غير قابل للتعديل Immutable Audit</span>
          </div>
        </div>

        {/* Audit Logs Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900">سجل الأحداث الأخيرة (Live Audit Trail)</h3>
            <span className="text-xs text-slate-500 font-mono">BigInt Safe Conversion</span>
          </div>

          {loading ? (
            <div className="py-16 text-center text-slate-400 text-sm">جاري جلب سجلات التدقيق...</div>
          ) : auditLogs.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">لا توجد سجلات تدقيق مسجلة حالياً.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <th className="py-4 pr-6">معرف السجل (BigInt)</th>
                    <th className="py-4">الجدول (Table)</th>
                    <th className="py-4">الإجراء (Action)</th>
                    <th className="py-4">عنوان IP Client</th>
                    <th className="py-4 pl-6 text-center">التاريخ والوقت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 pr-6 font-mono text-xs font-bold text-slate-900">{log.id}</td>
                      <td className="py-4 font-mono text-xs text-indigo-600 font-bold">{log.tableName}</td>
                      <td className="py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ${
                          log.action === 'INSERT' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          log.action === 'UPDATE' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="py-4 font-mono text-xs text-slate-500">{log.clientIp || '127.0.0.1'}</td>
                      <td className="py-4 pl-6 text-center text-xs text-slate-500">
                        {new Date(log.createdAt).toLocaleString('ar-SA')}
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
