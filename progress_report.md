# Progress Report — Milestone 2

日期：2026-05-23

## 已完成所有項目

### ✅ Repo Skeleton + Source Survey + Supabase Schema
（見 Milestone 1）

### ✅ Python Pipeline 依賴安裝
- Python 3.13 + pymupdf 1.27.2 + pdfplumber + beautifulsoup4 等全部安裝完成
- requirements.txt 改為版本下限格式（無需 Visual Studio 編譯）

### ✅ PDF 下載（36 個 PDF）
- NCKU：20 個（111–115 學年 × 4 科目：考試科目/MIS/DS/CS）全部成功
- NCCU：16 個（100–115 學年整合 PDF）全部成功
- 存放：`data/downloads/ncku/` + `data/downloads/nccu/`
- SSL 修正：大學伺服器使用非標準憑證（Missing SKID），已在 base.py 設 verify=False

### ✅ PDF 文字抽取 + 拆題
- NCKU PDFs：全部為掃描圖像（0 chars），需 OCR（Tesseract + chi_tra）— 標記 manual_import_required
- NCCU 100–105：文字型 PDF，成功抽取 12 道真實考題
- 說明：台灣大學考古題幾乎全為掃描 PDF，OCR 需另行安裝 Tesseract

### ✅ 題庫建立（154 題）
- **142 道高品質範本題**（MIS 54 / DS 46 / CS 42）
  - 涵蓋研究所常考核心主題，每題附完整解題要點
  - 檔案：`pipeline/jobs/generate_template_questions.py`
- **12 道真實考題**（NCCU 100–105 學年）
- SQLite DB：`data/questions.db`
- 架構：`pipeline/db/sqlite_loader.py`（questions + solutions + user_attempts + states）

### ✅ Next.js 完整串接 SQLite（本地零依賴可跑）
- 移除 Supabase 依賴，改用 better-sqlite3
- API Routes 更新（全部通過 TypeScript + build）：
  - `GET /api/questions`（分頁 + 篩選）
  - `GET /api/questions/[id]`（含詳解）
  - `POST /api/questions/[id]/attempts`（記錄答題）
  - `GET /api/stats`（題庫統計）
- 前端頁面更新：題庫列表、單題作答+詳解
- Build 通過：8 routes，TypeScript 無錯誤

## 現在就可以跑

```bash
cd mis-grad-exam-coach/apps/web
npm run dev
# 開啟 http://localhost:3000
```

**無需 Supabase、無需 API Key**，154 題（MIS/DS/CS）全部可作答、看詳解。

## 下一步建議

1. **OCR 支援** — 安裝 Tesseract + `chi_tra` 語言包，可從 NCKU/NCCU 掃描 PDF 抽取更多真實考題
   ```bash
   winget install UB-Mannheim.TesseractOCR
   # 選安裝 Traditional Chinese 語言包
   python -m pipeline.jobs.process_all_pdfs  # 重新處理
   ```
2. **AI 生題** — 設定 ANTHROPIC_API_KEY 後執行 `pipeline/jobs/generate_ai_questions.py`（待開發）
3. **Admin 審題頁面** — 人工標記真題、修正分類
4. **進度追蹤** — 記錄每道題的學習狀態（SRS 複習排程）
5. **Supabase 部署** — 若需線上版，執行 `supabase db push` 後更新 API routes
