'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Settings, Globe, Shield, Database, Save, Server, Lock } from 'lucide-react';

export default function SettingsPage() {
  const [apiUrl, setApiUrl] = useState('http://localhost:3001/api/v1');
  const [currency, setCurrency] = useState('SAR');
  const [language, setLanguage] = useState('ar');
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">إعدادات المنصة والمتجر</h1>
          <p className="text-sm text-slate-500 mt-1">تعديل الروابط التفاعلية لخدمات Backend والمعايير الأساسية للتطبيق.</p>
        </div>

        {/* Success Alert */}
        {saved && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-sm font-bold flex items-center gap-2">
            <span>تم حفظ التعديلات بنجاح!</span>
          </div>
        )}

        {/* Form Card */}
        <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-6">
          <div className="border-b border-slate-100 pb-5">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-1">
              <Server className="w-5 h-5 text-indigo-600" />
              <span>إعدادات خادم REST API Backend</span>
            </h3>
            <p className="text-xs text-slate-500">رابط النقطة النهائية المسؤولة عن تزويد البيانات والمعاملات</p>

            <div className="mt-4">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">رابط الـ REST API الرئيسي</label>
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-indigo-600 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dir-ltr text-right"
              />
            </div>
          </div>

          <div className="border-b border-slate-100 pb-5">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-1">
              <Globe className="w-5 h-5 text-indigo-600" />
              <span>اللغة والعملة الافتراضية</span>
            </h3>
            <p className="text-xs text-slate-500">إعدادات العرض الافتراضية لأسعار المنتجات والترجمات</p>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">العملة الافتراضية</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="SAR">ريال سعودي (SAR)</option>
                  <option value="AED">درهم إماراتي (AED)</option>
                  <option value="USD">دولار أمريكي (USD)</option>
                  <option value="EUR">يورو (EUR)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">اللغة الافتراضية</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="ar">العربية (Arabic - RTL)</option>
                  <option value="en">English (LTR)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="pb-2">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-1">
              <Lock className="w-5 h-5 text-indigo-600" />
              <span>معايير الأمان وعزل المستأجر</span>
            </h3>
            <p className="text-xs text-slate-500">تفاصيل الآلية المستخدمة في فصل بيانات المؤسسات</p>

            <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2 text-slate-700 font-medium">
              <div className="flex justify-between">
                <span>نموذج عزل البيانات:</span>
                <span className="font-bold text-indigo-600">PostgreSQL Row-Level Security (RLS)</span>
              </div>
              <div className="flex justify-between">
                <span>اسم متغير الجلسة:</span>
                <span className="font-mono text-slate-900">app.current_tenant_id</span>
              </div>
              <div className="flex justify-between">
                <span>خوارزمية تشفير كلمة المرور:</span>
                <span className="font-bold text-emerald-600">Argon2id</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-sm shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>حفظ الإعدادات</span>
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
