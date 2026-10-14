# Progress Report

最後更新：2026-10-10 深夜（CS/DS/MIS 選擇題全部補完）

## 2026-10-10 深夜（續）：CS + MIS 也補完了

使用者是資結組，優先序 計概=資結>MIS，但三科都要。照序跑完：
- CS：24 題（0 失敗）
- MIS：原本 topic='MIS' 沒有任何 NCU 真題，`generate_mc_batch.py` 原本抓「真題知識點分佈」當 concepts 來源的邏輯在這裡會整個空掉——改成查不到真題就退回範本題當風格參考，知識點改手動指定（BI/IT治理/資訊安全/策略MIS/數位轉型/SDLC/雲端/SCM/新興技術/電子商務/ERP/CRM）。24 題裡 2 題 JSON 解析失敗（`repair_json` 沒接住的另一種壞法），單獨補跑 2 題後全部到齊。

**最終選擇題數量**：CS 75、DS 48、MIS 41（總題庫 455 題：CS 215、DS 145、MIS 95）。

## 2026-10-10 深夜：AI 生成選擇題補量

使用者發現選擇題太少，查資料證實：中央真題裡**資料結構完全沒有選擇題**（0/181，資結真題全是申論/計算），MIS 真題則是完全沒有（0 題，全靠範本撐）。原因可能是 NCU 資結考試本來就不考選擇題（不是資料缺漏，是真實考試格式），但練習題庫還是需要選擇題做快速檢測。

新增 `pipeline/jobs/generate_mc_batch.py`：用 Gemini 3.5 Flash-Lite，針對指定科目最常見的知識點（從現有 `concepts` 標籤統計出前 12 個）各生 N 題，用真題當 few-shot 風格參考（不照抄，只學難度與語氣），同時寫入 SQLite 跟 Supabase。標記 `source_type='template'`、`verified_status='ai_draft'`，誠實標示是 AI 生成非真題。

第一批：資結 12 個知識點 × 2 題 = 24 題，全部成功（0 失敗）。品質抽查幾題都有真正的鑑別度（紅黑樹刪除操作複雜度、對稱矩陣一維索引公式、二次探測法涵蓋性條件），不是送分題。DS 選擇題從 22 → 48 題。

同樣是純資料變動，不用重新 build APK。

MIS 真題仍是 0，之後如果也要用同一套補量，指令：`python -m pipeline.jobs.generate_mc_batch --topic MIS --per-concept 2`（MIS 的 concepts 標籤統計見分析結果：BI/IT治理/資訊安全/策略MIS/數位轉型/SDLC/雲端/SCM/新興技術/電子商務/ERP/CRM 等）。

## 2026-10-10 晚間：題庫知識點篩選 + 資料品質修復

**題庫新增「知識點」篩選**：topic 選定後動態抓該科目的 concepts 標籤（DS：樹/排序/圖/雜湊/搜尋/B樹/AVL樹…），使用者原本要的「資結裡的二元樹/高等樹/圖/Hashing/Search and Sort」用現有標籤就能覆蓋，不用重新標記。`pipeline/jobs/bank.ts` 的 `getBankConcepts()`。

**修掉 6 題真正的資料 bug**（使用者截圖回報一題明明是問答題卻顯示成選擇題）：`split_real_exams.py` 的 `parse_mc_options()` 只要看到文字裡有「(A)…(B)…」就整批當成選擇題選項處理，不管那其實是申論題的 (a)(b) 子題。受影響：id 223/271/272/275/281/282（全部 NCU 真題）。AI 還因此幫每題配了一個莫名其妙的「正確答案」——有幾筆 AI 自己在解答裡寫「本題為簡答題形式但被包裝在選擇題中」，等於它知道不對勁但被輸出格式綁死。
- 修法：合併 stem + 兩個「選項」回一個 question_text（標 (a)(b)），改回 `short_answer`，清掉 `options`/`correct_option`，刪掉舊的誤導詳解，重新生成正確的詳解
- **SQLite 跟 Supabase 是兩份獨立資料，都要分別修**——這次才發現 `pipeline/jobs/migrate_to_supabase.py` 當初的 id 序號沒接上（序號自動提升那段失敗了但沒人注意），導致後來想單獨補一筆 solution 進 Supabase 就撞 id 衝突（409）。用 CLI 補了 `supabase/migrations/003_bump_sequences.sql` 修正
- 順便把一直放著的死檔案 `001_initial_schema.sql` 刪了（從來沒真的套用過，`supabase db push` 會因為它報錯擋住後面的 migration）
- **這類誤判可能還有殘留**：篩選條件是「選項文字包含問號」，抓到的 6 題應該是高信心的，但沒有再往下查有沒有不含問號、同樣被誤判的案例（例如用祈使句 "Explain..." "Prove..." 而非疑問句的子題）——之後有空可以再用更寬的規則掃一次
- 沒有重新 build APK：這是純資料修正，不是程式碼，手機上下次打開會直接讀到正確版本

## 2026-10-10 下午：EAS Build 出 APK + 忘記密碼

**第一個 standalone APK build 成功**：https://expo.dev/artifacts/eas/ar52d4sLYAvpR5dhjQlAWECbhU8bfXAaD66790hf1oo.apk ——使用者裝上手機、脫離 Metro/電腦，完全走正常網路連 Supabase，運作正常。這是目前「不用電腦」「給朋友用」兩個目標的關鍵解鎖，不是等所有功能做完才上架。

**EAS Build 設定**：
- Expo 帳號 `jerrywang65`，EAS 專案 `@jerrywang65/mis-grad-coach`（project ID `5bea1204-2e40-4ac1-a6db-4277d3016fde`）
- `app.json` 補上 `android.package` / `ios.bundleIdentifier`（`com.jerrywang65.misgradcoach`）、`scheme: "misgradcoach"`（深層連結用）
- **第一次 build 在「Install dependencies」階段失敗**：本機之前一直用 `npm install --legacy-peer-deps` 繞過 React 19.2.3 vs react-dom 19.3.0 的 peer-dep 衝突，但 EAS 乾淨環境的安裝不會自動加這個 flag，直接撞同一個 ERESOLVE 錨死。修法：加 `apps/mobile/.npmrc`（`legacy-peer-deps=true`），這樣任何環境的 `npm install` 都會自動套用，不用每次手動加 flag
- EAS 的環境變數（`EXPO_PUBLIC_SUPABASE_URL`/`ANON_KEY`）跟本機 `.env` 是分開的兩套，要另外用 `eas env:set --environment production/preview/development` 設定，否則雲端 build 出來的 APK 連不到 Supabase（會在 `supabase.ts` 直接 throw）
- 密鑰放在根目錄 `.env`：新增 `SUPABASE_ACCESS_TOKEN`（CLI 登入用，來自使用者的 Personal Access Token）跟 `EXPO_TOKEN`（EAS CLI 登入用，來自 expo.dev 帳號設定）

**忘記密碼修好了**：原本點信裡的連結會轉址到打不開的 `localhost:3000`。本來想改用「信裡顯示驗證碼」的 OTP 方式，但 Supabase **免費方案不能自訂 Email 樣板**（`mailer_templates_recovery_content` 改了會 400），OTP 這條路被擋死。改用深層連結：`site_url`/`uri_allow_list` 加白名單 `misgradcoach://**`，`supabase.ts` 的 client 設 `flowType: "pkce"`（PKCE 讓連結帶 `?code=` 查詢參數，不是 RN 很難處理的 URL fragment `#access_token=...`），新增 `app/reset-password.tsx` 接住連結、`exchangeCodeForSession` 換 session、讓使用者設新密碼。**這個改動动到 app.json 的 native scheme 設定，已經重新送一次 build，等它跑完才算真的生效。**

目前只有 email/password 登入，**還沒有 Google OAuth**——是時間有限下選的最快路徑，不是刻意考量過的決定，之後要加可以再做（需要 Google Cloud Console 設 OAuth client + RN 端加原生 Google Sign-In SDK，比 email/password 多一截工）。也還沒有匿名登入（Anonymous Sign-in）選項，使用者問過要不要加，還沒決定。

## 2026-10-10 中午：真機測試成功 + 新增題庫瀏覽

**手機版第一次真的跑起來了**，使用者用自己的 Android 手機（透過手機熱點分享網路給電腦，Metro 用 `exp://10.25.142.132:8081`）連上測試成功，註冊、登入、首頁都正常。過程中解掉的環境問題（記下來避免下次重踩）：
- 這台電腦有加入網域（`haku\jerry`），網域政策把「防火牆允許應用程式」的互動提示關掉了，一般使用者權限連不上——必須用系統管理員權限開的終端機跑 `New-NetFirewallRule` 才能真正解除封鎖
- Supabase 專案的 Auth 設定 `site_url` 預設是 `http://localhost:3000`，驗證信連結點了之後會轉址到這個打不開的網址——但驗證本身在轉址前就已經成功了，不影響登入。順手把 `mailer_autoconfirm` 設成 `true`，以後都不用再處理這個問題
- 題目 `$3.$ 鏈結串列...` 在練習清單/答題紀錄的預覽行顯示出原始的 `$3.$` 符號——因為清單預覽直接顯示 `question_text` 沒有經過 `RichText`。修法：把網頁版既有的 `stripMarkup()`（`apps/web/src/lib/text.ts`）port 過去（`apps/mobile/src/lib/text.ts`），套用在 `practice.tsx`／`history.tsx` 的清單預覽

**新增「題庫」分頁**（`apps/mobile/src/app/(tabs)/bank.tsx`）：使用者指出主要缺口是「分科目練習」跟「分校歷屆考題練習」，本質上是同一個「瀏覽+篩選題庫」需求，之前完全沒做（舊網頁版有 `/questions`，手機版重寫時沒搬）。現在支援依學校（全部/真題/範本題）、科目（CS/DS/MIS）、年份篩選，分頁載入。目前資料分佈：`template` 201 題（不分校）、`NCU` 真題 181 題（CS 130 + DS 51，105–115 學年）；MIS 的 72 題全部是範本題，還沒有真實考古題。

全部跑過 `tsc --noEmit`、`expo lint`、`expo-doctor`：21/21 checks passed，0 error。**沒有在裝置上實際點過新畫面**——Metro 在使用者自己的互動終端機跑（有 Fast Refresh），新程式碼存檔後應該會自動 hot-reload，但我沒有看過結果，使用者下次開 App 時幫忙確認一下「題庫」分頁正常。

---

最後更新：2026-10-10（前次：07-18 真題匯入）

## 重大轉向（2026-10-10）：行動版 App，React Native + Supabase

使用者決定全部重寫成 React Native（Expo），目標上架，先做 Android。原因：UI/UX 設計稿（v2，見下）已經做好，既然要重寫前端就順便把 UX 做得更好；技術選型本來建議 Capacitor（可以 100% 重用 Next.js，且 LaTeX 渲染在 RN 沒有好方案），但使用者堅持要 React Native。

**這個決定帶來的已知代價**：React Native 沒有 DOM，原本網頁版用 `react-markdown` + `rehype-katex` 渲染題目/詳解裡的 LaTeX 數學式，在 RN 裡完全不能用。今晚先用簡化版（`apps/mobile/src/components/RichText.tsx`：只把 `$...$` 斜體化，不是真的渲染數學式），**不是真的解決**，之後要做的正確方案是用 `react-native-webview` 包一個真正跑 KaTeX 的頁面——今晚沒有 Android 模擬器/實機可以測試，沒有冒險做這塊，留到下個 sprint。

## 原有系統（網頁版，仍可用，未來可能淘汰或共存）
- `apps/web`：Next.js 16 + better-sqlite3，本機跑（`npm run dev`），213 題（154 範本/59 選擇題）+ 179 道中央真題
- SRS 間隔複習排程（簡化版 SM-2）已接上真實後端：`apps/web/src/lib/srs.ts`
- AI 批改（Groq）：防幻覺三層驗證
- 考情資訊整合頁 `/info`：七校 115 簡章 + 考古題連結

## 今晚新增：`apps/mobile`（Expo SDK 57 + Expo Router + TypeScript）

### 已完成
- 專案建好，`npx expo install` 裝好核心套件（expo-router、supabase-js、async-storage、vector-icons 等）
- **Supabase Auth 登入畫面**（email+password）、`(tabs)` 群組做 session gate
- **5 個畫面全部用真實資料邏輯寫完**（不是假資料）：
  - 首頁（`(tabs)/index.tsx`）：考前準備度、今日任務分 到期複習/弱點/新題
  - 練習清單（`(tabs)/practice.tsx`）
  - 作答＋AI 批改結果（`question/[id].tsx`，單一畫面依 `submitted` 狀態切換，跟網頁版行為一致）
  - 弱點分析（`(tabs)/analytics.tsx`）
  - 答題紀錄（`(tabs)/history.tsx`）
- **資料層全部寫好**：`src/lib/daily.ts`（每日任務選題演算法，從 `/api/daily` 的 SQL port 成 client-side TS）、`src/lib/srs.ts`（SM-2 排程，port 自網頁版）、`src/lib/attempts.ts`（送出作答/自評/錯因）、`src/lib/analytics.ts`
- **AI 批改 Edge Function 已寫好**：`supabase/functions/grade-attempt/index.ts`，完整 port 網頁版的三層防幻覺批改邏輯，用轉發的使用者 JWT（不是 service_role），RLS 照常生效
- **新 Postgres schema**：`supabase/migrations/002_mobile_schema.sql`，直接對應 SQLite 現有結構（不是用舊的 `001_initial_schema.sql`，那個正規化成 schools/departments/subjects 表的設計從來沒被網頁版實際使用過，是死檔案）
- **資料搬移腳本**：`pipeline/jobs/migrate_to_supabase.py`，把 `questions`＋`solutions` 搬到 Supabase（**不搬** `user_attempts`/`user_question_states`——那是網頁版的練習紀錄，手機版用新的 Supabase Auth 使用者重新開始，沒有做舊資料的 user 對應）
- 全部跑過 `tsc --noEmit`、`expo lint`、`expo-doctor`：21/21 checks passed，0 type error，0 lint warning

### 已解決（2026-10-10 凌晨，使用者貼了 Personal Access Token 解鎖 CLI）
1. ✅ **Schema 已建**（使用者自己貼 SQL Editor 跑的）
2. ✅ **資料已搬**：382 題 + 378 份詳解，跟 SQLite 筆數完全一致，用 `python -m pipeline.jobs.migrate_to_supabase`
3. ✅ **Edge Function 已部署並驗證可用**：`supabase functions deploy grade-attempt`。過程中發現並修掉一個 bug——GROQ_MODEL 寫死用 `llama-3.3-70b-versatile`，這個模型已經從 Groq 帳號下架（跟今晚其他地方遇到的模型下架問題同一個模式），改成 `openai/gpt-oss-120b`（`apps/web/.env.local` 跟 Edge Function 都改了）
4. ✅ **全鏈路用拋棄式測試帳號實際跑過**：註冊→登入→RLS 讀題（未登入讀不到，已登入讀得到）→寫入作答→呼叫 AI 批改 Edge Function 拿到正確結構的批改結果→清掉測試帳號跟測試資料。這是目前能做到最接近「真的測試過」的程度，但仍然不是在手機 App 上跑的。

### 仍然卡住
1. **完全沒有在裝置上跑過 App 本身**。這台機器沒有 Android SDK/emulator，上面驗證的是「後端 API 合約是通的」，不是「App 畫面跑起來沒問題」。使用者第一次用 `npx expo start` + 手機裝 Expo Go 掃碼測試時，大概率會發現一些我看不到的問題（版面、互動、SafeArea 等），這是預期中的。
2. **一個不急的尾巴**：`questions`/`solutions` 的 id 序號沒有自動往後跳（搬移時保留原始 id，序號還停在搬移前的位置）。現在不影響——只有「之後要直接在 Supabase 新增題目」才會用到。要處理的話在 SQL Editor 跑：`select setval(pg_get_serial_sequence('questions','id'), 403); select setval(pg_get_serial_sequence('solutions','id'), 395);`

### Supabase 專案資訊
- Project ID: `fdozfvubcmbccdepaamz`
- 金鑰存在 `.env`（repo 根目錄，publishable + secret，給 Python 搬移腳本用，gitignore）跟 `apps/mobile/.env`（只有 publishable key，手機 App 會打包進去，secret key 絕對不能放這裡）

## 下次繼續（優先序）
1. 使用者執行上面「卡住」的 4 步（schema push → migrate → deploy function → `npx expo start` 真機測試）
2. 根據真機測試的實際問題修 bug（版面跑掉、互動不順等——現在完全沒驗證過）
3. LaTeX 數學式真正渲染：`react-native-webview` + KaTeX，取代現在的簡化版 `RichText`
4. 把網頁版的舊練習紀錄（`user_attempts`/`user_question_states`）決定要不要搬過去（需要先決定 user_id 怎麼對應）
5. EAS Build 設定，上架 Android 內部測試
6. 中山卷 OCR／拆題、知識點標籤精修——這些是舊 backlog，暫緩，先把手機版跑起來

## 舊 backlog（暫緩，見上）
- 中山卷 OCR 完成後：擴充 `split_real_exams.py` 支援中山整合卷格式
- 真題知識點標籤精修＋AI 估難度
- 生成對齊真題風格的新題
- 「教我這題」：批改低分後生成針對性小課
- Backlog：`docs/optimizations-backlog.md`

## 檔案地圖
- 網頁版 `apps/web`（Next 16 + better-sqlite3）
- **手機版 `apps/mobile`**（Expo Router；`npx expo start`）
- 管線 `pipeline/jobs/`：download_real_exams → ocr_real_exams → split_real_exams → generate_draft_solutions → **migrate_to_supabase**（新）
- DB `data/questions.db`（本機/網頁版用，進版控；WAL commit 前要 checkpoint）
- Supabase schema：`supabase/migrations/002_mobile_schema.sql`（用這個，`001` 是死檔案）
- Supabase Edge Function：`supabase/functions/grade-attempt/`
- Key：`apps/web/.env.local`（GROQ/GEMINI，勿入版控）、`.env`（Supabase，勿入版控）、`apps/mobile/.env`（Supabase publishable key only，勿入版控但即使入了也只是 client-safe key）
