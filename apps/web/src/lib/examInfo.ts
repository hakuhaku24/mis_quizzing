/**
 * Static exam-info hub content: this cycle's (114 學年度，115 年 2 月筆試) official
 * bulletins, extracted from the PDFs the user collected under
 * `115我的資管所簡章/`. 116 學年度 bulletins aren't published yet (schools release
 * them ~Oct/Nov each year) — this is the entry point to replace wholesale once they are.
 *
 * Scope: 資訊管理所／系碩士班only. Each school's bulletin often bundles unrelated
 * departments (企管、工管、資安…) in the same joint-admission PDF — those branches
 * are deliberately left out here.
 */

export interface SchoolExamInfo {
  key: string;
  school: string;
  dept: string;
  groups: string; // group / subject breakdown, as written in the bulletin
  writtenDate: string;
  interview: string;
  quota: string;
  contact: string;
  officialUrl: string | null;
  /** A real, working past-exam link — only set when verified against this
   *  project's own scraper code (pipeline/jobs/download_real_exams.py,
   *  pipeline/sources/*.py). Never a guessed URL. */
  archiveUrl: string | null;
  archiveNote: string;
}

export const EXAM_INFO_NOTE =
  "以下為 114 學年度（115 年 2 月筆試）簡章資訊，取自使用者收集的官方 PDF。116 學年度（117 年 2 月筆試）各校簡章通常 10–11 月才公布，公布後要整批更新。";

export const SCHOOL_EXAM_INFO: SchoolExamInfo[] = [
  {
    key: "ncu",
    school: "中央大學",
    dept: "資訊管理學系碩士班",
    groups: "甲組：計算機概論＋資料結構／乙組：計算機概論＋管理資訊系統",
    writtenDate: "115 年（日期依簡章總則，本份未列單獨日期）",
    interview: "無複試",
    quota: "甲組 12 名／乙組 13 名",
    contact: "(03)4227151 轉 66500 · ncu6500@ncu.edu.tw",
    officialUrl: "http://im.mgt.ncu.edu.tw",
    archiveUrl: "https://rapid.lib.ncu.edu.tw/cexamn/exam/MA02_115_01.pdf",
    archiveNote:
      "命名規則固定：MA02_{學年}_{編號}.pdf，學年可填 105–115、編號 01–06（對應不同科目／年度），把網址裡的數字換掉就能抓別年的題目。",
  },
  {
    key: "nsysu",
    school: "中山大學",
    dept: "資訊管理學系碩士班",
    groups: "甲組（資訊管理）：計算機概論＋管理資訊系統／乙組（商業智慧）：計算機概論＋資料結構",
    writtenDate: "依簡章總則",
    interview: "無複試（比總成績）",
    quota: "甲乙組共 18 名",
    contact: "(07)5252000 轉 4701 · mis@mail.nsysu.edu.tw",
    officialUrl: "https://www.mis.nsysu.edu.tw/",
    archiveUrl: "https://www3.nsysu.edu.tw/exam/master/mana/infom/infom_115.pdf",
    archiveNote: "命名規則固定：infom_{學年}.pdf（一年一份合併 PDF），換學年數字即可，105–115 都抓得到。",
  },
  {
    key: "ccu",
    school: "中正大學",
    dept: "資訊管理學系碩士班",
    groups: "PDF 是圖片格式，自動擷取失敗，詳細考科請直接開原始簡章確認",
    writtenDate: "待補",
    interview: "待補",
    quota: "待補",
    contact: "待補",
    officialUrl: null,
    archiveUrl: null,
    archiveNote: "還沒找到中正官方的考古題公開入口，之後查到再補上。",
  },
  {
    key: "nycu",
    school: "陽明交通大學",
    dept: "資訊管理研究所碩士班",
    groups: "資訊科技與管理（2.5）＋英文（0.5），不可攜帶計算機",
    writtenDate: "115 年 2 月 5 日（星期四）",
    interview: "書面審查（資料審查，無口試）",
    quota: "一般生 16 名",
    contact: "03-5712301 · susan@nycu.edu.tw",
    officialUrl: "https://iim.nycu.edu.tw/",
    archiveUrl: null,
    archiveNote: "官方招生訊息站在 https://exam.nycu.edu.tw/，考古題公開入口還沒確認，之後查到再補上。",
  },
  {
    key: "ncku",
    school: "成功大學",
    dept: "資訊管理研究所碩士班",
    groups:
      "甲組：管理資訊系統 45% ＋計算機概論 45% ＋英文 10%／乙組：計算機概論 45% ＋資料結構 45% ＋英文 10%（皆不可用計算機）＋審查 40%",
    writtenDate: "依簡章總則",
    interview: "無口試，筆試通過後繳交審查資料（40%）",
    quota: "甲組 5 名／乙組 6 名／丙組（甄試）16 名",
    contact: "(06)2757575 轉 53700",
    officialUrl: "https://iim.ncku.edu.tw/",
    archiveUrl: "https://exam.lib.ncku.edu.tw/master_subject.php?department_code=BC08",
    archiveNote: "成大圖書館考古題系統，department_code=BC08 固定指向資管所，點進去選學年即可下載。",
  },
  {
    key: "nccu",
    school: "政治大學",
    dept: "資訊管理學系（科技組）",
    groups: "英文 B 4% ＋計算機概論 23% ＋資料結構 23%",
    writtenDate: "依簡章總則",
    interview: "面試 50%（依筆試成績擇優至多 15 名），面試日 115 年 3 月 20 日",
    quota: "5 名",
    contact: "(02)2939-3091 分機 89056",
    officialUrl: "https://mis2.nccu.edu.tw",
    archiveUrl:
      "https://www.lib.nccu.edu.tw/app/index.php?Action=libraryarcheorcgret&AechoPar=43&ArcheoCg=49&ArcheoLevel=Master&Page=1&Plugin=library",
    archiveNote: "政大圖書館考古題檢索系統，這個連結已經篩到資管所碩士班的分類。",
  },
  {
    key: "nthu",
    school: "清華大學",
    dept: "資訊系統與應用研究所碩士班（資應所，性質同資管）",
    groups: "計算機概論 66.7% ＋英文 33.3%，不可使用計算器",
    writtenDate: "115 年 2 月 5 日（星期四）",
    interview: "無複試",
    quota: "一般生 16 名／在職生 1 名",
    contact: "03-5742976 / 03-5738997",
    officialUrl: "https://isa.site.nthu.edu.tw/",
    archiveUrl: null,
    archiveNote: "考古題公開入口還沒確認，之後查到再補上。",
  },
];

export interface LearningResource {
  id: string;
  category: "youtube" | "notes" | "site" | "other";
  title: string;
  url: string;
  note?: string;
}

/** Empty on purpose — curated by the user, never guessed. Add entries here
 *  (or ask for them to be added) once there's a real, checked link. */
export const LEARNING_RESOURCES: LearningResource[] = [];
