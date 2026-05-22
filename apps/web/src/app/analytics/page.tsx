"use client";

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">弱點分析</h1>
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
        <p className="text-lg">開始答題後，這裡會顯示你的科目答對率與弱點主題。</p>
        <p className="text-sm mt-2">前往 <a href="/questions" className="text-blue-600 underline">題庫</a> 開始練習。</p>
      </div>
    </div>
  );
}
