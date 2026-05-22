# Source Survey Report

調查日期：2026-05-23

## 摘要

| 來源 | 可存取 | 匿名下載 | 風險 | 建議策略 |
|------|--------|----------|------|----------|
| NCKU 成功大學 | ✅ | ✅ | low | direct_html_parse |
| NCU 中央大學 | ❌ | 未知 | high | manual_import |
| NCCU 政治大學 | ✅ | ✅ | low | direct_html_parse |

---

## NCKU 國立成功大學

- **URL**: https://exam.lib.ncku.edu.tw/master_subject.php?department_code=BC08
- **可存取**: 是
- **需要登入**: 否
- **匿名下載**: 是（已確認）
- **風險**: low

### 可用年度
87～115 學年（共 29 個學年）

### 可用科目
管理資訊系統、資料結構、計算機概論、統計學、管理學、微積分、程式設計、經濟學（個經）

### PDF URL 規律
```
https://exam.lib.ncku.edu.tw/exam/BC08_{year}_{subject_index}.pdf
```
例：`BC08_115_0.pdf`（115 學年度管理資訊系統）

科目 index 對應（近期 113-115）：
- 0 = 管理資訊系統
- 1 = 資料結構
- 2 = 計算機概論

### 範例 PDF URLs
- https://exam.lib.ncku.edu.tw/exam/BC08_115_0.pdf
- https://exam.lib.ncku.edu.tw/exam/BC08_115_1.pdf
- https://exam.lib.ncku.edu.tw/exam/BC08_115_2.pdf
- https://exam.lib.ncku.edu.tw/exam/BC08_114_0.pdf
- https://exam.lib.ncku.edu.tw/exam/BC08_113_0.pdf

### 備注
- URL 規律極佳，可直接批次嘗試下載，無需複雜 HTML parsing
- 頁面無任何 bot 防護機制
- 科目 index 因年度而異，需先解析列表頁取得 mapping

---

## NCU 國立中央大學

- **URL**: https://rapid.lib.ncu.edu.tw/cexamn/
- **可存取**: **否（SSL 憑證驗證失敗）**
- **建議**: manual_import_required

### 失敗原因
SSL 憑證驗證失敗（自簽或過期憑證），三種 URL 形式均無法存取：
- https://rapid.lib.ncu.edu.tw/cexamn/
- https://rapid.lib.ncu.edu.tw/cexamn/index.php
- http://rapid.lib.ncu.edu.tw/cexamn/

### 處理方式
人工以瀏覽器（可忽略憑證警告）確認內容後手動導入，或等待 SSL 問題修復。

---

## NCCU 國立政治大學

政大有兩套系統：

### 系統 A（主系統，106-115 年）
- **URL**: https://www.lib.nccu.edu.tw/app/index.php?Action=libraryarcheorcgret...
- **可存取**: 是
- **PDF URL 規律**: `https://www.lib.nccu.edu.tw/var/file/0/1000/img/7/master_mis{YY}.pdf`
- **已確認**: master_mis115.pdf 可匿名下載（341KB）

### 系統 B（機構典藏 NCCUR，85-109 年）
- **URL**: https://nccur.lib.nccu.edu.tw/handle/140.119/105795
- **可存取**: 是
- **PDF URL**: 每筆需從 DSpace bitstream 路徑解析，共 76 筆
- **已取得**: 85-109 年完整 URL 列表

### 可用年度
- 系統 A：106～115 學年
- 系統 B：85～109 學年（碩士 100-109，博士 85-99）

### 備注
- 每年為單一整合 PDF（所有考科合一），不像 NCKU 按科目分檔
- 頁面標明「無償提供學術研究與公眾教育等公益性使用」，法律風險低

### NCCUR 已取得 URL 列表（系統 B）

| 年度 | URL |
|------|-----|
| 85（博） | https://nccur.lib.nccu.edu.tw/bitstream/140.119/107571/1/mis85.pdf |
| 86（博） | https://nccur.lib.nccu.edu.tw/bitstream/140.119/107572/1/mis86.pdf |
| 87（博） | https://nccur.lib.nccu.edu.tw/bitstream/140.119/107573/1/mis87.pdf |
| 88（博） | https://nccur.lib.nccu.edu.tw/bitstream/140.119/107574/1/mis88.pdf |
| 89（博） | https://nccur.lib.nccu.edu.tw/bitstream/140.119/107575/1/mis89.pdf |
| 90（博） | https://nccur.lib.nccu.edu.tw/bitstream/140.119/107576/1/mis90.pdf |
| 91（博） | https://nccur.lib.nccu.edu.tw/bitstream/140.119/107577/1/mis91.pdf |
| 92（博） | https://nccur.lib.nccu.edu.tw/bitstream/140.119/107578/1/mis92.pdf |
| 93（博） | https://nccur.lib.nccu.edu.tw/bitstream/140.119/107579/1/mis93.pdf |
| 94（博） | https://nccur.lib.nccu.edu.tw/bitstream/140.119/107580/1/mis94.pdf |
| 95（博） | https://nccur.lib.nccu.edu.tw/bitstream/140.119/107581/1/mis95.pdf |
| 96（博） | https://nccur.lib.nccu.edu.tw/bitstream/140.119/107582/1/mis96.pdf |
| 97（博） | https://nccur.lib.nccu.edu.tw/bitstream/140.119/107583/1/mis97.pdf |
| 98（博） | https://nccur.lib.nccu.edu.tw/bitstream/140.119/107584/1/mis98.pdf |
| 99（博） | https://nccur.lib.nccu.edu.tw/bitstream/140.119/107585/1/mis99.pdf |
| 100（碩） | https://nccur.lib.nccu.edu.tw/bitstream/140.119/106630/1/mis100.pdf |
| 101（碩） | https://nccur.lib.nccu.edu.tw/bitstream/140.119/106631/1/mis101.pdf |
| 102（碩） | https://nccur.lib.nccu.edu.tw/bitstream/140.119/106632/1/mis102.pdf |
| 103（碩） | https://nccur.lib.nccu.edu.tw/bitstream/140.119/106633/1/mis103.pdf |
| 104（碩） | https://nccur.lib.nccu.edu.tw/bitstream/140.119/106634/1/mis104.pdf |
| 105（碩） | https://nccur.lib.nccu.edu.tw/bitstream/140.119/106635/1/mis105.pdf |
| 106（碩） | https://nccur.lib.nccu.edu.tw/bitstream/140.119/134504/1/294.pdf |
| 107（碩） | https://nccur.lib.nccu.edu.tw/bitstream/140.119/134505/1/67.pdf |
| 108（碩） | https://nccur.lib.nccu.edu.tw/bitstream/140.119/134506/1/68.pdf |
| 109（碩） | https://nccur.lib.nccu.edu.tw/bitstream/140.119/134507/1/295.pdf |

---

## 結論與建議

1. **優先實作 NCKU** — URL 最規律，風險最低，科目最完整（MIS + DS + 計概）
2. **同步實作 NCCU 系統 A** — URL 同樣規律，近期年度（106-115）可直接下載
3. **NCCU 系統 B** — 使用上方已取得的 URL 清單直接下載，不需爬取
4. **NCU** — 標記 `manual_import_required`，不阻塞 MVP 進度
