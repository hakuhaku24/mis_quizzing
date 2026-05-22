import Link from "next/link";

const SCHOOLS = [
  { code: "NCKU", name: "成功大學", subjects: ["管理資訊系統", "資料結構", "計算機概論"] },
  { code: "NCCU", name: "政治大學", subjects: ["資訊管理（整合）"] },
  { code: "NCU",  name: "中央大學", subjects: ["待手動匯入"] },
];

export default function HomePage() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="text-center py-12 space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">資管所備考教練</h1>
        <p className="text-lg text-gray-500 max-w-xl mx-auto">
          考古題題庫 · 個人化弱點分析 · 題目價值排序
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <Link
            href="/questions"
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            開始練題
          </Link>
          <Link
            href="/analytics"
            className="px-6 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            查看弱點
          </Link>
        </div>
      </section>

      {/* 支援學校 */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">支援學校</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {SCHOOLS.map((s) => (
            <div key={s.code} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{s.name}</span>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{s.code}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {s.subjects.map((sub) => (
                  <span key={sub} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{sub}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 核心特色 */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">為什麼不只是 PDF</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { title: "哪題值得先練", desc: "題目價值評分 S/A/B/C/D，依頻率、難度、近年度自動排序" },
            { title: "你弱在哪", desc: "答題後即時更新弱點地圖，最常錯的主題一目瞭然" },
            { title: "下一步補什麼", desc: "根據弱點推薦相關題，AI 申論批改提供改善建議" },
          ].map((f) => (
            <div key={f.title} className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
              <p className="font-semibold text-blue-700">{f.title}</p>
              <p className="text-sm text-gray-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
