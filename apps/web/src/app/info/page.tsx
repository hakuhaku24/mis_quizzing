import { EXAM_INFO_NOTE, SCHOOL_EXAM_INFO, LEARNING_RESOURCES } from "@/lib/examInfo";

const CATEGORY_LABELS: Record<string, string> = {
  youtube: "YouTube 頻道",
  notes: "筆記網站",
  site: "資源網站",
  other: "其他",
};

export default function InfoPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">考情資訊整合</h1>
        <p className="text-sm text-gray-500 mt-1">
          只收資管所／資訊管理系碩士班，其他研究所不管 — 這是我們要考的範圍。
        </p>
      </div>

      {/* exam calendar */}
      <section className="space-y-3">
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-4 py-3">
          {EXAM_INFO_NOTE}
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>
                <th className="text-left font-medium px-4 py-2.5">學校 / 系所</th>
                <th className="text-left font-medium px-4 py-2.5">考科組別</th>
                <th className="text-left font-medium px-4 py-2.5">初試日期</th>
                <th className="text-left font-medium px-4 py-2.5">複試</th>
                <th className="text-left font-medium px-4 py-2.5">名額</th>
                <th className="text-left font-medium px-4 py-2.5">聯絡</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {SCHOOL_EXAM_INFO.map((s) => (
                <tr key={s.key}>
                  <td className="px-4 py-3 align-top">
                    <div className="font-semibold">{s.school}</div>
                    <div className="text-xs text-gray-400">{s.dept}</div>
                    {s.officialUrl && (
                      <a href={s.officialUrl} target="_blank" rel="noreferrer"
                         className="text-xs text-blue-600 hover:underline">
                        系所官網 →
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top text-gray-600 max-w-xs">{s.groups}</td>
                  <td className="px-4 py-3 align-top text-gray-600 whitespace-nowrap">{s.writtenDate}</td>
                  <td className="px-4 py-3 align-top text-gray-600">{s.interview}</td>
                  <td className="px-4 py-3 align-top text-gray-600 whitespace-nowrap">{s.quota}</td>
                  <td className="px-4 py-3 align-top text-gray-400 text-xs">{s.contact}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* past exam archives */}
      <section className="space-y-3">
        <h2 className="font-semibold text-lg">考古題連結</h2>
        <p className="text-sm text-gray-500">只放已經確認可以打開、拿到題目的連結；還沒查到的誠實標待補，不亂猜網址。</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {SCHOOL_EXAM_INFO.map((s) => (
            <div key={s.key} className="bg-white rounded-xl border border-gray-200 p-4 space-y-1.5">
              <div className="font-semibold text-sm">{s.school} · {s.dept}</div>
              {s.archiveUrl ? (
                <a href={s.archiveUrl} target="_blank" rel="noreferrer"
                   className="text-sm text-blue-600 hover:underline break-all block">
                  {s.archiveUrl}
                </a>
              ) : (
                <span className="text-sm text-orange-500">尚未確認官方入口</span>
              )}
              <p className="text-xs text-gray-400">{s.archiveNote}</p>
            </div>
          ))}
        </div>
      </section>

      {/* learning resources */}
      <section className="space-y-3">
        <h2 className="font-semibold text-lg">學習資源</h2>
        {LEARNING_RESOURCES.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
            還沒整理。平常在看的 YouTube 頻道、筆記網站、資源網站，丟給我，我幫你分類放進來 —
            不會自己亂找、亂放沒驗證過的連結。
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {LEARNING_RESOURCES.map((r) => (
              <a key={r.id} href={r.url} target="_blank" rel="noreferrer"
                 className="bg-white rounded-xl border border-gray-200 p-4 space-y-1 hover:border-blue-300 transition-colors block">
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                    {CATEGORY_LABELS[r.category] ?? r.category}
                  </span>
                  <span className="font-medium text-sm">{r.title}</span>
                </div>
                {r.note && <p className="text-xs text-gray-400">{r.note}</p>}
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
