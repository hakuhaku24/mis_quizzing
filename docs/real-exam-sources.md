# 真題來源調查（科技組：計概＋資料結構）

2026-07-18 調查。所有下載僅供個人備考使用；PDF 存 `data/downloads/`（已 gitignore，**不進公開 repo**）。

## 已取得（49 份 PDF，105–115 學年）

### 中央資管所（主場、主力志願）✅
- 官方來源：中央大學圖書館考古題系統 https://rapid.lib.ncu.edu.tw/cexamn/MA02.html
- URL 規則：`https://rapid.lib.ncu.edu.tw/cexamn/exam/MA02_{學年}_{科目碼}.pdf`，83–115 學年都在
- 科目碼依組別/年代對應 統計/計概/資結/MIS（下載全碼、之後靠內容分類）
- 已下載 105–115 學年共 38 份 → `data/downloads/ncu_central/`
- 注意：伺服器憑證有問題，需 `verify=False`
- 圖書館只提供題目、無解答

### 中山資管系（主力志願）✅
- 官方來源：中山圖書與資訊處 https://lis.nsysu.edu.tw/p/412-1001-6014.php
- URL 規則：`https://www3.nsysu.edu.tw/exam/master/mana/infom/infom_{學年}.pdf`（87–115，一年一份整合卷）
- 已下載 105–115 學年共 11 份（每份 13–14 頁，含全部科目）→ `data/downloads/nsysu/`

**兩校 PDF 全為掃描影像（0 可抽取文字）→ 需 OCR。**

## OCR 方案（下一步）

1. 首選：**視覺 LLM 轉錄**（Groq `meta-llama/llama-4-scout-17b-16e-instruct` 支援影像）
   - pymupdf 把每頁 render 成 PNG → base64 → 請模型逐頁轉錄題目
   - 印刷體中文考卷效果應遠勝 Tesseract，且不用裝系統套件、用現有 key
   - 轉錄後：拆題 → 標 school/year/subject/concepts → 進 DB（`source_type='pdf_extracted'`）
2. 備案：Tesseract + chi_tra（`winget install UB-Mannheim.TesseractOCR`）

## 其他志願學校（待辦）

| 學校 | 狀態 | 已知線索 |
|---|---|---|
| 陽明交大資管 | 未取得 | 官方管道不明；搜尋只見補習班/私人整理站，需再查 NYCU 圖書館試題系統 |
| 政大資管（科技組） | 部分 | 之前已抓 16 份政大整合 PDF（`data/downloads/nccu/`，掃描檔）；100–105 為舊制，需確認近年科技組卷 |
| 中正資管乙組 | 待查 | exams.ccu.edu.tw/reference.php 有全校考古題入口；系網 mis.ccu.edu.tw 對外解析失敗（可能限內網） |
| 中興資管 | 待查 | 圖書館考古題系統待確認 |
| 台北大資管 | 待查 | 只考計概一科 |
| 清大資應 | 待查 | 只考計概一科 |

## 出題方向筆記（給生題用）

- 中央甲組：計概＋資結各一卷（近年 115/114/113 卷在手，OCR 後可分析題型）
- 中山：整合卷內含各科，乙組取計概＋資結部分
- 趨勢（補習班觀察）：計概「網路」比重上升；需涵蓋資訊科技新趨勢名詞
