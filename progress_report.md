# Progress Report — Milestone 1

日期：2026-05-23

## 完成項目

### ✅ Repo Skeleton
- git init + 目錄結構（apps/web, pipeline, data, docs, supabase, tests）
- .gitignore

### ✅ Source Survey
- NCKU：可匿名下載，URL 規律極佳，87-115 學年，3 科目
- NCCU：可匿名下載，主系統 106-115 + 機構典藏 100-109，已取得完整 URL 清單
- NCU：SSL 憑證問題，標記 `manual_import_required`
- 產出：`docs/source_survey_report.md`, `data/source_registry.seed.json`

### ✅ Supabase Schema
- `supabase/migrations/001_initial_schema.sql`：8 張資料表 + 索引
- `supabase/seed.sql`：學校、科目種子資料

### ✅ Python Pipeline
- `pipeline/sources/ncku.py`：NCKU connector（discover + download）
- `pipeline/sources/nccu.py`：NCCU connector（系統A + 系統B known URL list）
- `pipeline/sources/base.py`：共用 download_pdf + ExamAsset dataclass
- `pipeline/extract/pdf_text.py`：PyMuPDF + pdfplumber + OCR fallback
- `pipeline/extract/split_questions.py`：多策略拆題 + quality gate
- `pipeline/classify/tag_question.py`：keyword 分類
- `pipeline/classify/score_value.py`：價值評分公式
- `pipeline/jobs/run_source_survey.py`：Survey job
- `pipeline/jobs/ingest_asset.py`：下載 job
- `pipeline/jobs/process_asset.py`：處理 job

### ✅ Next.js Web App
- `apps/web`：Next.js 16 + TypeScript + Tailwind + shadcn/ui
- Supabase SSR client（server + browser）
- API Routes：`GET /api/questions`、`GET /api/questions/[id]`、`POST /api/questions/[id]/attempts`
- 頁面：Landing `/`、題庫列表 `/questions`（篩選器）、單題頁 `/questions/[id]`（作答 + 詳解）、分析 `/analytics`
- TypeScript 型別檢查通過，build 無錯誤（7 routes）

## 待完成（下一步）

1. **Supabase 連線設定** — 建立 `.env.local`（SUPABASE_URL + ANON_KEY）
2. **執行 DB migration** — `supabase db push` 或直接在 Supabase Studio 貼 SQL
3. **執行 pipeline** — `pip install -r pipeline/requirements.txt` → `python -m pipeline.jobs.ingest_asset --source ncku` 下載 PDF
4. **處理 PDF** — `python -m pipeline.jobs.process_asset --pdf ... --subject MIS` 抽文字 + 拆題
5. **手動匯入問題** — 將拆出的題目 INSERT 進 Supabase questions 表
6. **前端串接** — 設好 SUPABASE_URL 後即可直接使用
7. **Admin review 頁面** — 人工修正題目、審核 AI 詳解
8. **AI 申論批改 API** — `/api/questions/[id]/ai-grade`

## 下一個要授權的環境設定

```bash
# pipeline/.env（在 mis-grad-exam-coach 根目錄建立）
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx
ANTHROPIC_API_KEY=sk-ant-xxx
```

```bash
# apps/web/.env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
ANTHROPIC_API_KEY=sk-ant-xxx
```
