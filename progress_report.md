# Progress Report

最後更新：2026-07-18（前次：07-17 Phase 1 + AI 批改）

## 已完成（累計）

### 核心迴圈
- **作答遙測**：信心度（送出前必選）、計時、錯因四選一、自評
- **AI 批改**（Groq `llama-3.3-70b`）：0–10 分＋有答到/漏掉/寫錯＋總評
  - 防幻覺三層：got_points 必附逐字引文 → 程式驗證引文存在 → 獨立審核員核對引文內容是否真的成立
  - typo 保護：name_checks 逐名詞分類，拼錯但指涉正確的給分並訂正（程式端強制）
  - 重新批改／補批按鈕（history 頁）
- **弱點分析**：統一掌握分數（MC 對錯/AI 分/自評）、各科＋44 知識點掌握度（由弱到強）、AI 平均
- **儀表板首頁**：考試倒數（2027/2）、今日任務 10 題（60% 弱點/20% 複習/20% 新題，限 CS+DS）、掌握度、最近 AI 分數

### 真題（2026-07-18 新增）
- 官方來源下載器：中央（rapid.lib.ncu.edu.tw，83–115 學年）＋中山（www3.nsysu.edu.tw，87–115）→ 49 份掃描 PDF（本機，不進 repo）
- 視覺 LLM OCR（qwen3.6-27b，scout 被 Groq 下架後切換）：斷點續傳、限速自適應
- 拆題入庫：LLM 找邊界＋Python 逐字切片 → **179 道中央真題**（計概 105–115、資結 106–113）
- LaTeX/Markdown 渲染（KaTeX）：真題數學式可讀
- 題庫篩選：URL 持久化（返回不丟失）＋年份＋難度篩選
- AI 草稿詳解生成中（gpt-oss-120b high reasoning）：申論得分點式參考答案、選擇題答案＋逐選項解析＋信心標註，全掛 ai_draft 標籤

## 進行中（背景，可斷點續跑）
1. **OCR**：135/~250 頁。剩：中央 114 計概末 5 頁、中央 MIS/統計卷（低優先）、中山 11 份整合卷。卡 Groq 日額度，回充自動續跑。指令：`python -m pipeline.jobs.ocr_real_exams`
2. **草稿詳解**：16/179。指令：`python -m pipeline.jobs.generate_draft_solutions`

## 下次繼續（優先序）
1. 確認兩個背景工作跑完（沒跑完就重跑上面兩個指令，都是冪等的）
2. 中山卷 OCR 完成後：擴充 `split_real_exams.py` 支援中山整合卷格式（一份 PDF 含多科，需辨識計概/資結段落）
3. 真題拆題精修：3 題定位失敗＋4 題誤刪的短題＋題組排版（如 110 資結 Question 2 矩陣題組）
4. 真題知識點標籤精修（機器初標不準，如資料庫題標成作業系統）＋AI 估難度
5. 生成對齊真題風格的計概＋資結新題（分析 179 題真題題型後再生，中央計概近年：50 題單選英文出題、資料庫比重高）
6. 「教我這題」：批改低分後生成針對性小課
7. Backlog：`docs/optimizations-backlog.md`（批改分數漂移→固定 rubric、校準曲線 30 筆後解鎖）

## 檔案地圖
- 前端 `apps/web`（Next 16 + better-sqlite3；`npm run dev`）
- 管線 `pipeline/jobs/`：download_real_exams → ocr_real_exams → split_real_exams → generate_draft_solutions
- DB `data/questions.db`（進版控；WAL commit 前要 checkpoint）
- 真題原始檔 `data/downloads/`、轉錄 `data/ocr/`（皆 gitignore，個人使用）
- Key：`apps/web/.env.local`（GROQ_API_KEY，勿入版控）
