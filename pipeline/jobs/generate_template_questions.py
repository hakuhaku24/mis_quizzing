"""
Generate 150 template exam questions (MIS/DS/CS × 50 each).
Questions are modelled after NCKU/NCCU master-level MIS entrance exam patterns.

Usage: python -m pipeline.jobs.generate_template_questions
"""

from pipeline.db.sqlite_loader import init_db, load_questions, get_stats, DB_PATH

# ─────────────────────────────────────────────────────────────────────────────
# Helper
# ─────────────────────────────────────────────────────────────────────────────

def q(text, topic, subtopic, qtype, diff, score, sol, expl=""):
    return {
        "school": "template",
        "department": "資訊管理研究所",
        "year_label": "範本題",
        "question_text": text.strip(),
        "question_type": qtype,
        "topic": topic,
        "subtopic": subtopic,
        "difficulty": diff,
        "value_score": score,
        "source_type": "template",
        "extraction_confidence": 1.0,
        "verified_status": "template",
        "solutions": [{"solution_text": sol.strip(), "explanation": expl.strip(), "source_type": "template"}],
    }


# ─────────────────────────────────────────────────────────────────────────────
# MIS — 50 題
# ─────────────────────────────────────────────────────────────────────────────

MIS_QUESTIONS = [
    # --- ERP ---
    q("請說明企業資源規劃（ERP）系統的核心概念與主要模組，並以製造業為例說明導入 ERP 如何改善跨部門資訊整合。",
      "MIS", "ERP", "essay", 3, 0.85,
      "ERP（Enterprise Resource Planning）整合財務、生產、供應鏈、人力資源等功能於單一平台，透過共享資料庫消除資訊孤島。製造業範例：採購模組與庫存模組即時連動，當原料低於安全庫存時自動觸發採購申請，財務模組同步更新應付帳款。",
      "關鍵詞：整合、共用資料庫、模組、最佳實務"),

    q("比較 ERP 的兩種導入策略：Big Bang（一次全面上線）與 Phased Rollout（分階段導入）的優缺點，並說明選擇策略時應考量哪些因素。",
      "MIS", "ERP", "essay", 4, 0.80,
      "Big Bang：全功能同步上線，整合測試充分，但風險集中，需長時間平行運轉。Phased：風險分散，學習曲線較平緩，但維護兩套系統的過渡成本高。考量因素：組織規模、變革管理能力、舊系統複雜度、預算。",
      "答題重點：需分析兩者 trade-off，提出選擇條件"),

    q("解釋 ERP 系統中「最佳實務（Best Practice）」的概念，以及企業在流程配適（Fit-Gap 分析）時面臨的主要挑戰為何？",
      "MIS", "ERP", "essay", 4, 0.75,
      "最佳實務指 ERP 廠商依全球客戶累積、內嵌於系統的標準作業流程。Fit-Gap 分析：比對企業現有流程與系統預設流程的差距。挑戰：客製化成本高、升級困難；改流程需克服組織阻力；關鍵差距可能需要開發 Z-program。"),

    # --- CRM ---
    q("說明顧客關係管理（CRM）系統的三大核心元件：操作型 CRM、分析型 CRM、協同型 CRM，並說明各元件在提升顧客終身價值（CLV）中的角色。",
      "MIS", "CRM", "essay", 3, 0.80,
      "操作型 CRM（Operational）：自動化銷售、行銷、客服流程，直接接觸顧客。分析型 CRM（Analytical）：分析顧客行為與購買模式，計算 CLV，識別高價值顧客。協同型 CRM（Collaborative）：整合各接觸點（電話、email、社群），提供一致體驗。三者協同可提升留客率，進而提高 CLV。"),

    q("請以 RFM 模型說明如何對顧客進行分群，並說明不同分群的行銷策略應如何差異化。",
      "MIS", "CRM", "essay", 3, 0.75,
      "RFM：Recency（最近購買距今時間）、Frequency（購買頻率）、Monetary（消費金額）。三維度各分高低後可組合成 8 個象限。高 R/高 F/高 M（最佳顧客）：維繫計畫；低 R/高 F/高 M（流失高價值）：挽回行銷；低三維度：成本效益評估是否維持關係。"),

    q("說明 360 度顧客視圖（360° Customer View）的概念，並說明建立過程中資料整合面臨哪些技術挑戰？",
      "MIS", "CRM", "essay", 4, 0.70,
      "360° 顧客視圖：整合所有接觸點（POS、APP、客服、社群）資料，形成單一顧客記錄。技術挑戰：資料孤島（各系統格式不同）、實體解析（同一人在多系統有不同 ID）、即時更新延遲、PII 隱私合規。"),

    # --- SCM ---
    q("解釋牛鞭效應（Bullwhip Effect）的成因，並說明企業可透過哪些 IT 機制加以緩解。",
      "MIS", "SCM", "essay", 4, 0.90,
      "牛鞭效應：需求訊號沿供應鏈放大，導致上游廠商庫存波動遠大於終端需求波動。成因：需求預測更新、批量訂購、價格促銷、缺貨恐慌。IT 緩解機制：VMI（供應商管理庫存）—廠商直接看庫存；EDI/B2B 平台—即時分享 POS 資料；CPFR（協同計畫、預測與補貨）—共同預測。"),

    q("比較 Push 與 Pull 供應鏈策略的差異，並說明混合策略（Push-Pull Boundary）在何種情境下最適合？",
      "MIS", "SCM", "essay", 3, 0.75,
      "Push：依預測生產，備貨面對不確定需求，適用需求穩定、前置時間長的產品。Pull：按訂單生產，庫存低，適用需求不穩定、個人化程度高的產品。Push-Pull Boundary：前段備半成品（Push），收到訂單後快速客製組裝（Pull），適用 PC、家具等「大量客製化」產品。"),

    q("說明 RFID 技術如何應用於供應鏈管理，並與條碼系統比較其優缺點。",
      "MIS", "SCM", "short_answer", 3, 0.70,
      "RFID 優點：非接觸式讀取（可穿透包裝）、可同時讀多個標籤、含動態資料（時間戳記）。RFID 缺點：成本高、金屬/液體干擾。條碼優點：低成本。應用：貨架補貨自動化、防竊、藥品追蹤、自動入出庫（沃爾瑪案例）。"),

    # --- IT Governance ---
    q("說明 COBIT 框架的核心概念，以及 IT 治理（IT Governance）與 IT 管理（IT Management）的主要差異為何？",
      "MIS", "IT治理", "essay", 4, 0.75,
      "IT 治理：董事會 / 高階主管層級，聚焦 IT 與企業策略對齊、資源配置決策、風險監督。IT 管理：執行層級，聚焦日常 IT 服務交付。COBIT（Control Objectives for IT）：以 37 個目標涵蓋治理與管理活動，連結業務目標與 IT 流程，提供稽核基準。"),

    q("解釋 IT 投資評估中的 IT 效益悖論（IT Productivity Paradox），並說明企業應如何衡量 IT 投資的商業價值？",
      "MIS", "IT治理", "essay", 5, 0.80,
      "IT 效益悖論：大量 IT 投資卻未見對應生產力成長（Solow, 1987）。原因：學習與適應期、衡量問題、重分配效果。衡量方式：平衡計分卡（財務、顧客、流程、學習）；IT BSC；TCO + ROI；IT 能力成熟度（CMM）。現代觀點：IT 本身是必要條件，商業價值來自 IT + 流程改造 + 人才。"),

    # --- 資訊安全 ---
    q("說明 CIA 三元素的定義，並各舉一個技術控制措施與一個管理控制措施作為保護手段。",
      "MIS", "資訊安全", "short_answer", 2, 0.70,
      "C（機密性）：技術—AES 加密；管理—最小權限原則。I（完整性）：技術—Hash/HMAC；管理—變更管理流程。A（可用性）：技術—備援伺服器/CDN；管理—BCP/DRP 演練。"),

    q("說明 SQL Injection 的攻擊原理，並說明開發者應採取哪些防禦措施？",
      "MIS", "資訊安全", "short_answer", 3, 0.75,
      "原理：惡意 SQL 語句嵌入輸入欄位，改變原 SQL 語義（例：' OR '1'='1）。防禦：參數化查詢（Prepared Statement）——最重要；ORM；輸入白名單驗證；最小資料庫權限；WAF；錯誤訊息不對外露出 SQL 細節。"),

    q("比較對稱式加密（Symmetric Encryption）與非對稱式加密（Asymmetric Encryption）的原理、優缺點，並說明 TLS 如何結合兩者？",
      "MIS", "資訊安全", "essay", 4, 0.80,
      "對稱：同一金鑰加解密（AES），速度快，金鑰分送問題。非對稱：公鑰加密私鑰解密（RSA），安全但慢。TLS handshake：非對稱交換 session key，之後用對稱加密傳輸—兼顧安全與效能。"),

    q("說明零信任架構（Zero Trust Architecture）的核心原則，以及傳統邊界安全模型的不足為何？",
      "MIS", "資訊安全", "essay", 4, 0.85,
      "零信任核心：「永不信任，持續驗證」（Never trust, always verify）。三原則：身份驗證每次請求；最小權限存取；假設已被入侵（Assume Breach）。傳統邊界不足：內部使用者/設備被預設信任，一旦攻破邊界即橫向移動無阻；雲端/遠端辦公讓邊界消失。"),

    q("說明社交工程（Social Engineering）攻擊的主要手法，並提出企業的防範策略。",
      "MIS", "資訊安全", "short_answer", 3, 0.70,
      "手法：釣魚（Phishing）—偽造信件/網站；Spear Phishing—針對特定人；Pretexting—偽造身份電話；Baiting—感染 USB。防範：資安意識教育訓練（定期模擬演練）；多因素驗證（MFA）；嚴格身份驗證流程；郵件過濾 DMARC/DKIM。"),

    # --- 電子商務 ---
    q("說明 B2B、B2C、C2C 三種電子商務模式的特徵與主要平台範例，並比較其技術需求差異。",
      "MIS", "電子商務", "essay", 2, 0.65,
      "B2B：企業對企業，高度客製化、契約導向（Alibaba.com、SAP Ariba）。B2C：企業對消費者，規模大、推薦系統重要（Amazon、蝦皮）。C2C：消費者對消費者，信任機制（評價系統、金流保障）最關鍵（eBay、旋轉衣櫥）。技術差異：B2B 需 EDI/API 整合；B2C 需高併發；C2C 需防詐欺機制。"),

    q("說明長尾理論（Long Tail Theory）在電子商務中的應用，並說明其對實體零售業的衝擊。",
      "MIS", "電子商務", "essay", 3, 0.75,
      "長尾：電商無實體貨架限制，可供應小眾商品。Chris Anderson：非熱門商品（尾部）累積銷量可超越熱門商品（頭部）。應用：Amazon 80% SKU 為利基商品；Spotify 多元音樂。對實體零售衝擊：無法備貨長尾，被迫專注爆款，競爭力下降；「展示廳效應」（到店看貨、線上購買）。"),

    q("說明網路外部性（Network Externality）的概念，並以平台經濟舉例說明其對市場競爭的影響。",
      "MIS", "電子商務", "essay", 4, 0.80,
      "網路外部性：每增加一個用戶，對既有用戶的價值也增加（直接外部性如電話；間接外部性如 iOS 與 App 開發者）。平台效應：雙邊市場正回饋——買家多→賣家多→買家更多，形成贏者全拿。對競爭影響：市場向龍頭集中，後進者需「突破臨界質量」，難度極高。"),

    q("說明電子商務中信任（Trust）的重要性，並列舉三種提升線上購物信任感的機制。",
      "MIS", "電子商務", "short_answer", 2, 0.65,
      "機制：1. 第三方認證（SSL 鎖頭、PCI DSS 標章）；2. 評論與評分系統（UGC 社會認同）；3. 安全金流（信用卡分期、貨到付款、退款保障）；4. 隱私政策透明；5. 品牌聲譽。"),

    # --- BI & 大數據 ---
    q("說明 OLTP 與 OLAP 的差異，並解釋資料倉儲（Data Warehouse）在商業智慧（BI）架構中的角色。",
      "MIS", "BI", "essay", 3, 0.80,
      "OLTP：頻繁的短小異動（INSERT/UPDATE），高並發，3NF 正規化。OLAP：大量讀取、複雜分析查詢，星型/雪花型架構，預先彙總。Data Warehouse：ETL 整合多來源資料，提供一致的歷史資料快照給 BI 工具（Tableau、Power BI）。"),

    q("解釋 ETL（Extract, Transform, Load）流程的各步驟，並說明資料品質（Data Quality）在此流程中為何至關重要？",
      "MIS", "BI", "essay", 3, 0.75,
      "E（抽取）：從異質來源（RDB、API、CSV）讀取原始資料。T（轉換）：清洗（去重、補值）、格式統一、業務邏輯計算。L（載入）：寫入 DW/Data Lake。資料品質重要性：「垃圾進，垃圾出（Garbage In, Garbage Out）」，分析結果失真→錯誤決策。常見問題：孤兒記錄、日期格式不一、空值處理策略。"),

    q("說明資料湖（Data Lake）與資料倉儲（Data Warehouse）的差異，並說明企業何時適合採用「湖倉一體（Lakehouse）」架構？",
      "MIS", "BI", "essay", 4, 0.80,
      "DW：結構化資料、Schema-on-Write、高品質、適合 SQL 分析。Data Lake：各種格式（raw）、Schema-on-Read、低儲存成本、適合 ML/探索分析。Lakehouse（Delta Lake、Apache Iceberg）：在湖上加 ACID 事務、Schema 演化、統一 SQL + ML，適合企業需要兩者但不想維護雙套架構。"),

    q("什麼是資料治理（Data Governance）？說明其主要組件，以及 GDPR 對企業資料管理的主要影響。",
      "MIS", "BI", "essay", 4, 0.85,
      "資料治理：確保資料在整個生命週期中的可用性、完整性、一致性、安全性的管理框架。組件：資料所有者（Data Owner）、資料管理員（Steward）、資料字典、Master Data Management、品質規則。GDPR 影響：資料最小化原則、明確同意、被遺忘權（Right to Erasure）、資料可攜權、72 小時外洩通報。"),

    # --- 知識管理 ---
    q("說明 Nonaka & Takeuchi 的知識螺旋（SECI 模型），並各舉企業實例說明四個知識轉換過程。",
      "MIS", "知識管理", "essay", 4, 0.85,
      "SECI：社會化（S-S）—師徒制、現場學習；外化（S-E）—工作手冊、案例庫；組合（E-E）—整合知識庫、製作報告；內化（E-S）—邊做邊學、訓練課程。暗默知識（Tacit）vs. 外顯知識（Explicit）的動態轉換是創新引擎。"),

    q("說明知識管理系統（KMS）的主要功能，並說明企業在推動知識管理時常面臨的文化障礙及解決方案。",
      "MIS", "知識管理", "essay", 3, 0.75,
      "KMS 功能：知識捕捉（文件、錄影）、儲存（知識庫）、搜尋（語意搜尋）、分享（社群）。文化障礙：知識即權力心態（不願分享）；缺乏激勵；「不是我發明的」（NIH）。解決方案：將貢獻與績效評核掛鉤；管理層示範；遊戲化（Gamification）；案例庫讓分享者獲得可見信譽。"),

    q("比較以技術為中心（Technology-centric）與以人為中心（People-centric）的知識管理策略，說明哪種情境下各自較適合。",
      "MIS", "知識管理", "short_answer", 3, 0.70,
      "技術中心（Codification 策略）：適合標準化、可重用知識多的產業（顧問業通用方法論、客服 FAQ），以文件管理系統儲存。人本中心（Personalization 策略）：適合高度情境化、創意性工作（研發、策略諮詢），強調人際連結與導師制。Hansen et al. (1999)：兩者比例依業務性質選擇，不宜各半。"),

    # --- 數位轉型 ---
    q("說明數位轉型（Digital Transformation）與資訊化（Digitization）、數位化（Digitalization）的差異，並說明企業推動數位轉型的主要障礙。",
      "MIS", "數位轉型", "essay", 3, 0.85,
      "Digitization：類比轉數位（掃描紙本）。Digitalization：用數位技術改善現有流程（數位簽核）。Digital Transformation：根本性重新定義商業模式、顧客關係、企業文化（從製造商轉平台）。障礙：遺留系統（Legacy System）、組織文化阻力、數位人才短缺、資料孤島、高層承諾不足。"),

    q("說明 API 經濟（API Economy）的概念，以及企業如何透過 Open API 策略創造新商業模式？",
      "MIS", "數位轉型", "essay", 4, 0.80,
      "API Economy：企業將核心能力包裝為 API 對外開放，允許第三方建構服務生態系。Open API 策略：Twilio（通訊 API）、Stripe（金流 API）、Google Maps。商業模式：API 即產品（直接收費）；平台效應（開放生態吸引開發者）；資料貨幣化。"),

    q("說明雙速 IT（Bimodal IT/Two-Speed IT）的概念，以及企業如何平衡穩定核心系統（Mode 1）與快速創新（Mode 2）之間的矛盾。",
      "MIS", "數位轉型", "essay", 4, 0.75,
      "Mode 1：穩定、可靠、安全（ERP、核心銀行），長交付週期，瀑布開發。Mode 2：快速實驗、接受失敗、短迭代（創新 App、數位平台），Agile/DevOps。平衡：明確界定邊界、API 解耦、建立共同治理委員會、防止 Mode 2 影響 Mode 1 穩定性。"),

    q("說明平台商業模式（Platform Business Model）與傳統管道模式（Pipeline Model）的差異，並分析 Uber 或 Airbnb 如何顛覆傳統產業。",
      "MIS", "數位轉型", "essay", 4, 0.85,
      "Pipeline：線性價值創造鏈（製造→配銷→消費者）。Platform：多邊市場撮合（生產者 ↔ 平台 ↔ 消費者）。Uber：不擁有車輛，但掌控匹配演算法與信任機制；透過動態定價與評分系統管理供需；網路效應使進入壁壘提高。顛覆傳統計程車業：消除調度中心成本、司機可彈性排班。"),

    # --- 雲端 ---
    q("比較 IaaS、PaaS、SaaS 三種雲端服務模式的差異，並各舉一個適用場景。",
      "MIS", "雲端", "short_answer", 2, 0.70,
      "IaaS（如 AWS EC2）：提供虛擬機/網路/儲存，用戶管理 OS 以上；適合需完全控制環境的企業。PaaS（如 Google App Engine）：提供開發平台，用戶只管應用程式；適合快速開發部署。SaaS（如 Salesforce）：直接使用完整應用；適合不想維護基礎設施的中小企業。"),

    q("說明多租戶架構（Multi-tenancy）的概念，以及雲端提供商如何透過技術手段確保不同租戶間的資料隔離？",
      "MIS", "雲端", "essay", 4, 0.80,
      "多租戶：多個客戶共用同一套基礎設施/應用程式。隔離技術：資料庫層—獨立 schema 或 Row-level security（tenant_id 欄位）；應用層—middleware 注入 tenant context；網路層—VPC/VLAN 隔離；容器—Namespace 隔離（Kubernetes）。風險：一旦隔離失敗造成資料外洩（Side-channel Attack）。"),

    q("說明雲端的五大特性（依 NIST 定義），以及企業在評估遷移上雲時應進行哪些考量？",
      "MIS", "雲端", "essay", 3, 0.75,
      "NIST 五特性：On-demand self-service、Broad network access、Resource pooling、Rapid elasticity、Measured service。遷移考量：成本模型（OpEx vs CapEx）；資料主權與合規（GDPR、個資法）；遺留系統相容；廠商鎖定（Lock-in）；網路延遲與可用性 SLA；資安責任模型（Shared Responsibility）。"),

    q("什麼是雲端原生（Cloud-Native）應用？說明微服務架構（Microservices）與傳統單體架構（Monolithic）的主要差異。",
      "MIS", "雲端", "essay", 4, 0.80,
      "Cloud-Native：從設計之初即為雲端優化，遵循 12-Factor App 原則，強調容器化、CI/CD、不可變基礎設施。微服務 vs. 單體：微服務各服務獨立部署/擴展/技術選擇，但服務間通訊複雜（分散式追蹤）、資料一致性挑戰（Saga Pattern）。適用：規模大、迭代快的產品選微服務；MVP/小團隊從單體開始。"),

    # --- 決策支援 ---
    q("說明決策支援系統（DSS）、主管資訊系統（EIS）與商業智慧（BI）三者的關聯與差異。",
      "MIS", "DSS", "essay", 3, 0.75,
      "DSS：半結構化決策輔助，強調模型驅動（What-if 分析、模擬）。EIS（Executive IS）：高層主管用，提供 KPI 儀表板、例外報表、趨勢分析，強調易用性。BI：更廣泛，涵蓋 DW、OLAP、報表、自助分析，強調資料驅動洞察。演化：EIS 已被現代 BI 工具（Power BI、Tableau）取代。"),

    q("解釋人工智慧輔助決策（AI-Augmented Decision Making）的概念，並說明使用 AI 決策時應注意哪些倫理與偏差（Bias）問題？",
      "MIS", "DSS", "essay", 4, 0.85,
      "AI 輔助決策：AI 提供建議/預測，人類最終決策（Human-in-the-loop）。偏差問題：訓練資料偏差（歷史性別/種族歧視）、確認偏誤（只接受符合預期的 AI 輸出）、自動化偏見（過度信任 AI）。倫理：可解釋性（XAI）、問責性、公平性（Fairness Metrics）、歐盟 AI 法案的高風險 AI 規定。"),

    q("說明群體決策支援系統（GDSS）的主要功能，以及電子腦力激盪（Electronic Brainstorming）相較於傳統腦力激盪的優缺點。",
      "MIS", "DSS", "short_answer", 3, 0.65,
      "GDSS：結構化群體會議、匿名投票、方案評估。電子腦力激盪優點：匿名（減少評估恐懼）、平行輸入（無發言順序）、社會懈怠減少。缺點：缺乏非語言線索、技術障礙、產出過多難以收斂。"),

    # --- Porter 競爭分析 ---
    q("以 Porter 五力模型分析臺灣電商平台（如蝦皮）所面臨的競爭環境。",
      "MIS", "策略MIS", "essay", 4, 0.85,
      "1. 既有競爭者：MOMO、PChome，競爭激烈，差異化難。2. 新進者威脅：中低（資本需求高、網路外部性保護龍頭）。3. 替代品：社群電商（IG/FB 直播購物）。4. 供應商（賣家）議價力：中（賣家多平台上架，平台依賴賣家品項）。5. 買家議價力：高（比價方便、轉換成本低）。"),

    q("說明資源基礎觀點（Resource-Based View, RBV）如何應用於說明企業 IT 能力的競爭優勢，並舉例說明何種 IT 資源符合 VRIN 條件？",
      "MIS", "策略MIS", "essay", 5, 0.85,
      "RBV：持續競爭優勢來自 VRIN 資源（Valuable、Rare、Imperfectly Imitable、Non-substitutable）。IT 資源分類：技術本身（硬體/軟體）難以 VRIN；IT 能力（如 Amazon 供應鏈管理能力、Netflix 個人化推薦演算法）因深嵌組織流程與資料而符合 VRIN。啟示：競爭優勢在 IT-business alignment，非 IT 本身。"),

    q("說明數位生態系統（Digital Ecosystem）的概念，並以 Apple 為例說明其如何建立平台鎖定（Platform Lock-in）。",
      "MIS", "策略MIS", "essay", 4, 0.80,
      "數位生態系統：圍繞核心平台的多邊市場，包括合作夥伴、開發者、用戶相互依存。Apple 鎖定機制：App Store 30% 佣金壟斷分發；iMessage/FaceTime 封閉生態（轉換成本）；設備與服務垂直整合（AirPods 在非 Apple 設備功能受限）；iCloud 資料黏著度。"),

    # --- SDLC ---
    q("說明軟體開發生命週期（SDLC）的主要階段，並比較瀑布模型（Waterfall）與敏捷開發（Agile）的適用情境。",
      "MIS", "SDLC", "essay", 3, 0.75,
      "SDLC 主要階段：規劃→需求分析→設計→開發→測試→部署→維護。瀑布：各階段循序、需求穩定、文件完整，適合監管嚴格（如醫療系統）、契約導向專案。Agile（Scrum/Kanban）：短衝刺、擁抱變化、客戶持續參與，適合需求不確定、快速市場反饋。"),

    q("說明需求工程（Requirements Engineering）中的功能性需求（Functional Requirements）與非功能性需求（Non-Functional Requirements）的差異，並各舉三例。",
      "MIS", "SDLC", "short_answer", 3, 0.70,
      "功能性需求：系統「做什麼」— 使用者登入、查詢訂單、產生報表。非功能性需求（品質屬性）：效能（頁面 < 2 秒）、可用性（99.9% uptime）、安全性（符合 ISO 27001）、可維護性、可擴展性（支援 10 萬並發）。非功能性需求往往決定架構選擇。"),

    q("說明 DevOps 的核心文化與實踐（CI/CD Pipeline），以及它如何縮短軟體交付週期？",
      "MIS", "SDLC", "essay", 3, 0.80,
      "DevOps：打破 Dev 與 Ops 的孤島，強調協作、自動化、持續改善。CI（持續整合）：每次 commit 自動構建與測試，及早發現問題。CD（持續交付/部署）：通過所有測試後自動部署到 staging/production。效益：部署頻率從季→週→日，缺陷逃逸率↓，MTTR（平均恢復時間）↓。"),

    # --- IT 專案管理 ---
    q("說明 IT 專案管理中的三重約束（Triple Constraint）—範疇、時間、成本，以及如何應用風險管理降低專案失敗率？",
      "MIS", "IT專案管理", "essay", 3, 0.75,
      "三重約束（鐵三角）：增加功能（範疇）→增加時間/成本；縮短時程→增加成本或減少品質。風險管理：識別（風險清單）→評估（機率×衝擊矩陣）→應對（規避/轉移/減輕/接受）→監控。Standish Report：IT 專案失敗率 > 60%，主因需求不明確、缺乏管理支持。"),

    q("說明敏捷開發中 Scrum 框架的主要角色（Product Owner、Scrum Master、Development Team）與儀式（Sprint Planning、Daily Standup、Sprint Review、Retrospective）。",
      "MIS", "IT專案管理", "short_answer", 3, 0.70,
      "PO：負責 Product Backlog 優先級，代表客戶。Scrum Master：流程教練，消除阻礙，非傳統 PM。Dev Team：自組織跨功能。儀式：Sprint Planning 決定 Sprint Backlog；Daily Standup（15 分鐘）同步進度；Sprint Review 展示成果給 stakeholder；Retrospective 反思流程改進。"),

    # --- 其他 MIS 主題 ---
    q("說明什麼是遺留系統（Legacy System）問題，以及企業有哪些現代化策略（例如 Strangler Fig Pattern）可以應對？",
      "MIS", "系統整合", "essay", 4, 0.75,
      "遺留系統：老舊、難以維護、技術債累積、但承載核心業務的系統（如大型主機 COBOL 代碼）。現代化策略：1. Lift and Shift（搬到雲）— 快但未改善。2. Replatform（換資料庫）。3. Refactor/Re-architect（微服務化）。4. Strangler Fig：漸進圍繞遺留系統建新功能，逐步「勒死」舊系統，降低風險。"),

    q("說明物聯網（IoT）在企業資訊系統中的應用，以及資料整合挑戰（從 Edge 到 Cloud）。",
      "MIS", "新興技術", "essay", 4, 0.80,
      "IoT 應用：智慧工廠（預測性維護）、供應鏈追蹤（冷鏈溫濕度）、零售（智能貨架）。架構：Device → Edge（本地預處理） → Fog → Cloud（分析）。挑戰：異質協議（MQTT, CoAP, HTTP）標準化；Edge 計算資源有限；海量小資料 ingestion；設備安全（韌體更新）；資料主權（本地 vs. 跨境）。"),

    q("說明人工智慧在 MIS 應用中的三個具體場景，並分析各場景的資料需求與主要風險。",
      "MIS", "新興技術", "essay", 4, 0.85,
      "1. 預測性分析（銷售預測）：需歷史交易資料；風險：概念漂移（市場環境改變）。2. 自然語言處理（客服 Chatbot）：需大量對話語料；風險：幻覺（Hallucination）、品牌形象損害。3. 電腦視覺（品管缺陷偵測）：需標記影像；風險：光線變化影響準確率、假陽性停線成本。"),

    q("解釋平衡計分卡（Balanced Scorecard, BSC）的四個構面，並說明如何將其應用於評估 IT 部門績效。",
      "MIS", "策略MIS", "essay", 3, 0.75,
      "BSC 四構面：財務（IT ROI、成本節省）、顧客（內部用戶滿意度、SLA 達成率）、內部流程（上線時間、缺陷率）、學習與成長（員工技能提升、IT 能力成熟度）。IT BSC 特色：IT 策略目標需與企業策略連結（Strategy Map），追蹤 IT 投資對業務目標的貢獻。"),

    q("說明企業架構（Enterprise Architecture, EA）的概念，以及 TOGAF 框架如何協助企業進行 IT 架構規劃。",
      "MIS", "IT治理", "essay", 5, 0.70,
      "EA：描述組織業務、資料、應用、技術的整體藍圖，確保一致性。TOGAF ADM（Architecture Development Method）：循環式方法，涵蓋業務→資料→應用→技術架構，以 Architecture Repository 維護。好處：避免重複投資、識別整合機會、降低技術複雜度。"),

    q("說明業務流程管理（BPM, Business Process Management）的生命週期，以及如何使用 BPMN 符號表示一個訂單處理流程。",
      "MIS", "SDLC", "essay", 3, 0.70,
      "BPM 生命週期：設計→建模→執行→監控→優化（持續循環）。BPMN 符號：Events（圓形）—開始/結束；Activities（矩形）—任務；Gateways（菱形）—決策/分流；Sequence Flow（箭頭）。訂單流程：接收訂單→庫存檢查→[有庫存? XOR Gateway]→備貨→出貨→結束 / 缺貨→採購→補貨→備貨。"),

    q("說明區塊鏈技術的核心特性（去中心化、不可竄改、透明性）在供應鏈管理中的潛在應用與限制。",
      "MIS", "新興技術", "essay", 4, 0.80,
      "應用：食品溯源（從農場到餐桌，IBM Food Trust）；藥品防偽（序號上鏈）；跨境貿易文件（智能合約自動放款）。限制：上鏈前資料真實性無法保證（Oracle Problem）；處理效率低（vs. 中央資料庫）；治理複雜（多方共識）；能耗（PoW）。"),

    q("請說明 Porter 的價值鏈（Value Chain）分析方法，並指出 IT 系統如何支援主要活動（Primary Activities）與支援活動（Support Activities）。",
      "MIS", "策略MIS", "essay", 3, 0.80,
      "主要活動：進料後勤（WMS）→生產作業（MES/ERP）→出料後勤（TMS）→行銷銷售（CRM/電商）→售後服務（客服系統）。支援活動：採購（e-Procurement）→技術開發（PLM/R&D 系統）→人力資源（HRM/ERP）→基礎設施（財務/法務 ERP）。IT 作為「基礎設施」可同時強化所有活動，降低成本或提高差異化。"),
]

# ─────────────────────────────────────────────────────────────────────────────
# DS (資料結構) — 50 題
# ─────────────────────────────────────────────────────────────────────────────

DS_QUESTIONS = [
    # --- Array & 基礎 ---
    q("說明陣列（Array）的連續記憶體特性，以及為何隨機存取（Random Access）的時間複雜度為 O(1)？並說明動態陣列（Dynamic Array）在 resize 時的攤銷複雜度分析。",
      "DS", "陣列", "essay", 2, 0.70,
      "Array：元素儲存於連續記憶體，index i 的位址 = base + i × element_size，因此 O(1) 存取。Dynamic Array（如 Java ArrayList）：滿了後分配 2 倍空間並複製。攤銷分析：n 個 insert 觸發 O(1)+O(2)+...+O(n) 複製 = O(n) 總複製，均攤每次 O(1)。"),

    q("解釋稀疏矩陣（Sparse Matrix）的概念，並說明使用三元組（Triple）或鏈式表示法儲存稀疏矩陣的優缺點。",
      "DS", "陣列", "short_answer", 3, 0.65,
      "稀疏矩陣：大多數元素為 0。三元組 <row, col, value> 只儲存非零元素，節省空間。缺點：隨機存取失去 O(1)，需線性搜索。鏈式（Linked List per row）：插入/刪除靈活但額外指標開銷。"),

    # --- Linked List ---
    q("比較單向鏈結串列（Singly Linked List）、雙向鏈結串列（Doubly Linked List）與環形鏈結串列（Circular Linked List）的結構差異與適用場景。",
      "DS", "鏈結串列", "essay", 2, 0.70,
      "Singly：每節點含 data+next，節省空間，但反向遍歷需 O(n)。Doubly：含 prev+next，反向遍歷 O(1)，但 2x 指標空間，適合 LRU Cache、瀏覽器上下頁。Circular：尾指回頭，適合輪詢排班（Round-Robin）、音樂播放迴圈。"),

    q("說明如何在 O(n) 時間、O(1) 額外空間內反轉一個鏈結串列，並提供演算法步驟（不需寫完整程式碼，說明關鍵指標操作即可）。",
      "DS", "鏈結串列", "short_answer", 3, 0.75,
      "三指標法：prev = null, curr = head, next = null。迴圈：next = curr.next; curr.next = prev; prev = curr; curr = next。結束後 prev 為新 head。時間 O(n)，空間 O(1)（原地修改）。"),

    q("如何偵測鏈結串列中是否存在環（Cycle）？請說明 Floyd's Cycle Detection Algorithm 的原理及其正確性。",
      "DS", "鏈結串列", "essay", 4, 0.80,
      "Floyd 龜兔賽跑：慢指標每步走 1，快指標每步走 2。若有環，快慢必在環內相遇（快追上慢的相對速度 1，環內距離有限）。若無環，快指標先到 null。正確性：假設環長 λ，慢入環後快在環內追趕，距離差每步縮 1，必在 ≤ λ 步內相遇。時間 O(n)，空間 O(1)。"),

    q("說明如何找到兩個鏈結串列的相交節點（Intersection Node），並分析時間與空間複雜度。",
      "DS", "鏈結串列", "essay", 4, 0.75,
      "兩步法：分別遍歷兩串列取長度差 d；長的先走 d 步；再同步走，第一個相同節點即為交叉點。時間 O(m+n)，空間 O(1)。另法：Hash Set 儲存 A 所有節點，遍歷 B 找第一個在 Hash Set 內的，O(m+n) 時間 O(m) 空間。"),

    # --- Stack & Queue ---
    q("說明用兩個 Stack 模擬 Queue 的方法（In-Stack 與 Out-Stack），並分析 enqueue 與 dequeue 的攤銷時間複雜度。",
      "DS", "堆疊佇列", "essay", 3, 0.75,
      "Enqueue：直接 push 到 In-Stack，O(1)。Dequeue：若 Out-Stack 非空，pop O(1)；若空，將 In-Stack 全倒入 Out-Stack，再 pop。攤銷：每個元素最多被 push/pop 兩次（一次進 In，一次倒入 Out），攤銷 O(1)。"),

    q("說明單調棧（Monotonic Stack）的概念，並舉例說明如何用它求解「下一個較大元素（Next Greater Element）」問題，時間複雜度為何？",
      "DS", "堆疊佇列", "essay", 4, 0.80,
      "維護遞減棧：遍歷陣列，若當前元素 > 棧頂，彈出棧頂並記錄「其下一個較大元素為當前值」，直到棧空或棧頂 ≥ 當前。最後棧中剩餘元素無下一個較大元素。每個元素最多 push/pop 一次，時間 O(n)，空間 O(n)。"),

    q("說明優先佇列（Priority Queue）的 ADT，以及用最小堆（Min-Heap）實作時 insert 與 extract-min 的時間複雜度分析。",
      "DS", "堆疊佇列", "essay", 3, 0.75,
      "Priority Queue：每次取優先級最高（最小或最大）的元素。Min-Heap 實作：insert—加到末尾，向上 sift-up，最多 O(log n) 層。extract-min—取根（最小值），將末尾放到根，向下 sift-down，O(log n)。空間 O(n)。Build-Heap：O(n)（非 O(n log n)，因底層節點 sift-down 距離短）。"),

    q("說明如何使用 Stack 驗證括號是否配對（Balanced Parentheses），並說明此演算法的時間與空間複雜度。",
      "DS", "堆疊佇列", "short_answer", 2, 0.65,
      "遍歷字元：遇左括號 push；遇右括號，若 stack 空或 pop 出的左括號不匹配 → invalid；遍歷完後 stack 非空 → invalid。時間 O(n)，空間 O(n)（最差全部左括號）。"),

    # --- Tree ---
    q("說明 BST（Binary Search Tree）的性質，以及在最差情況（退化成鏈）下，search/insert/delete 的時間複雜度各為何？",
      "DS", "樹", "short_answer", 2, 0.70,
      "BST 性質：左子樹所有值 < 根 < 右子樹所有值。最差（依序插入）退化為鏈，高度 O(n)：search O(n)、insert O(n)、delete O(n)。最佳（平衡）高度 O(log n)，各操作 O(log n)。"),

    q("說明 AVL 樹的平衡條件（Balance Factor），以及插入導致不平衡時，四種旋轉（LL, RR, LR, RL）各自的觸發情境與修正方式。",
      "DS", "AVL樹", "essay", 4, 0.85,
      "BF = 左高 - 右高，必須 ∈ {-1, 0, 1}。LL（BF=+2 且左子 BF≥0）：右旋。RR（BF=-2 且右子 BF≤0）：左旋。LR（BF=+2 且左子 BF<0）：先左旋左子，再右旋根。RL（BF=-2 且右子 BF>0）：先右旋右子，再左旋根。每次 insert 後從插入點向上更新 BF，發現第一個失衡點處理即可。"),

    q("說明二元樹的三種深度優先走訪（Inorder, Preorder, Postorder）的順序，並分別說明其典型應用。",
      "DS", "樹", "short_answer", 2, 0.70,
      "Inorder（左根右）：BST 輸出遞增序列，用於排序驗證。Preorder（根左右）：複製樹結構、序列化（根先記錄）。Postorder（左右根）：計算表達式樹、刪除樹（先刪子才刪父）、計算目錄大小。"),

    q("說明 B-Tree 的定義（以 Degree t 表示），以及為何資料庫索引（如 B+ Tree）偏好使用 B-Tree 而非 BST？",
      "DS", "B樹", "essay", 4, 0.85,
      "B-Tree（degree t）：每個節點 [t-1, 2t-1] 個鍵，[t, 2t] 個子節點（根除外）。B+ Tree：資料只在葉節點，葉節點串列，支援範圍查詢。偏好原因：磁碟 I/O 以頁為單位，B-Tree 扇出大→樹高 O(log_t n) 遠低於 BST O(n)→I/O 次數少；葉節點串列→範圍掃描只需遍歷葉層，無需多次 I/O。"),

    q("說明紅黑樹（Red-Black Tree）的五個性質，並說明為何其插入/刪除操作可保證 O(log n)？",
      "DS", "樹", "essay", 5, 0.85,
      "性質：1.每節點為紅或黑。2.根為黑。3.葉（NIL）為黑。4.紅節點的兩子均為黑。5.從任意節點到其後代葉的路徑，黑節點數相同（Black Height）。由性質 4&5：最長路徑（紅黑交替）≤ 2 × 最短路徑（全黑）→高度 ≤ 2 log(n+1)→O(log n)。"),

    q("說明 Trie（字首樹）的結構，以及在字串查詢上與 Hash Table 相比的優缺點。",
      "DS", "樹", "essay", 4, 0.80,
      "Trie：每節點代表一字元，從根到標記節點的路徑表示一個字串。查詢 O(m)（m = 字串長度）。優點：前綴查詢天然支援（autocomplete）、無 Hash Collision、字典序輸出。缺點：空間 O(alphabet × total_chars)，遠大於 Hash Table 的 O(total_chars)；不適合非前綴需求。"),

    # --- Heap ---
    q("說明 Heap Sort 的步驟，並分析其最佳、平均、最差時間複雜度，以及說明為何在實務中 QuickSort 通常較快。",
      "DS", "排序", "essay", 4, 0.80,
      "Heap Sort：1. Build Max-Heap O(n)。2. 重複 extract-max 放到末尾 n-1 次，每次 O(log n)。總 O(n log n)。三種情況均 O(n log n)（無最差退化）。實務上 QuickSort 更快：Cache 友善（連續記憶體存取）；常數因子小；Heap Sort 的 sift-down 遠端記憶體存取多導致 cache miss 多。"),

    q("說明如何用 Max-Heap 實作「求陣列中第 k 大元素」，分析其時間複雜度，並與 Quick Select 方法比較。",
      "DS", "堆積", "essay", 4, 0.80,
      "Max-Heap 法：build heap O(n)，extract-max k-1 次 O(k log n)，總 O(n + k log n)。Min-Heap 法（更佳）：維護大小 k 的 Min-Heap，遍歷陣列，堆頂即第 k 大，O(n log k)。Quick Select：平均 O(n)，最差 O(n²)（可用三取中避免），適合 k 接近中位數時更快。"),

    # --- Graph ---
    q("說明圖的鄰接矩陣（Adjacency Matrix）與鄰接串列（Adjacency List）兩種表示法的空間與時間複雜度，並說明各自的適用情境。",
      "DS", "圖", "essay", 3, 0.75,
      "鄰接矩陣：O(V²) 空間，查詢邊存在 O(1)，遍歷鄰居 O(V)。適合稠密圖、需頻繁查邊。鄰接串列：O(V+E) 空間，遍歷鄰居 O(degree(v))。適合稀疏圖（多數圖）。DFS/BFS 在串列表示下 O(V+E)，矩陣下 O(V²)。"),

    q("說明廣度優先搜尋（BFS）在「求無權圖兩點間最短路徑」上的原理，並說明其時間複雜度。",
      "DS", "圖", "essay", 3, 0.75,
      "BFS 以 Queue 層序展開，第一次到達某節點即保證最短路（跳數最少）—因為 BFS 按距離層層展開。使用 visited[] 避免重複。時間：O(V+E)（每節點/每邊最多處理一次）。空間：O(V)（Queue 最多存一層節點）。"),

    q("說明 Dijkstra 最短路徑演算法的步驟，以及為何不能處理負邊（Negative Weight Edge）？若有負邊應使用何種演算法？",
      "DS", "圖", "essay", 4, 0.85,
      "Dijkstra：初始化 dist[source]=0 其餘 ∞；每次取 dist 最小的未處理節點 u，更新 u 的鄰居 dist[v] = min(dist[v], dist[u]+w)。負邊問題：已確定最短的節點可能被後來的負邊更新，Dijkstra 不回頭，導致錯誤。解法：Bellman-Ford—鬆弛 V-1 次，O(VE)，可偵測負環。"),

    q("說明 Floyd-Warshall 演算法的動態規劃轉移方程，以及其時間複雜度，並說明與 Dijkstra 的使用場景差異。",
      "DS", "圖", "essay", 4, 0.80,
      "DP[i][j][k] = 經過前 k 個節點的 i→j 最短路。轉移：DP[i][j][k] = min(DP[i][j][k-1], DP[i][k][k-1] + DP[k][j][k-1])。時間 O(V³)，空間 O(V²)（可去掉 k 維）。適合：All-Pairs Shortest Path，V 較小的稠密圖，支援負邊（可偵測負環）。Dijkstra 適合：Single-Source，大圖配合 Priority Queue O((V+E) log V)。"),

    q("說明最小生成樹（MST）的定義，並比較 Prim's 與 Kruskal's 演算法的思路與複雜度。",
      "DS", "圖", "essay", 4, 0.80,
      "MST：連通圖中邊權重總和最小的生成樹（V-1 條邊）。Prim's：從任意節點出發，每次加入一條最便宜的跨界邊（貪婪）；O(E log V)（配合 Priority Queue）；適合稠密圖。Kruskal's：排序所有邊，依序加入不形成環的邊（Union-Find）；O(E log E) = O(E log V)；適合稀疏圖（邊少）。"),

    q("說明深度優先搜尋（DFS）如何用來偵測有向圖中的環（Cycle），說明「白灰黑三色標記」的意義。",
      "DS", "圖", "essay", 3, 0.75,
      "白：未訪問；灰：在 DFS 遞歸棧中（正在處理）；黑：完成處理。若 DFS 訪問到灰色節點 → 存在後向邊（Back Edge）→ 有環。時間 O(V+E)。無向圖：若訪問到已訪問的非父節點即有環。"),

    # --- 排序 ---
    q("說明快速排序（Quick Sort）的分治策略，分析其最佳、平均、最差時間複雜度，以及三取中（Median-of-three）如何緩解最差情況。",
      "DS", "排序", "essay", 4, 0.85,
      "分治：選 pivot，partition 成 ≤pivot 與 ≥pivot，遞迴排序兩半。最佳/平均：O(n log n)（pivot 每次均分）。最差：O(n²)（已排序陣列且選首元素為 pivot）。三取中：取首/尾/中三個值的中位數作 pivot，避免已排序或逆序的退化。Introsort（C++ STL）：Quick + Heap Sort fallback，保證 O(n log n)。"),

    q("說明合併排序（Merge Sort）的穩定性（Stability）與空間複雜度，以及為何外部排序（External Sort）偏好合併排序？",
      "DS", "排序", "essay", 3, 0.80,
      "Merge Sort：穩定（相等元素相對順序不變，合併時優先取左半）。空間 O(n)（額外暫存陣列）。時間恆 O(n log n)。外部排序偏好：磁碟資料按順序讀取效率高（Sequential I/O 遠快於 Random I/O）；Merge Sort 的合併步驟完全順序讀寫，可產生「歸併段（Run）」逐步合併大檔案。"),

    q("說明計數排序（Counting Sort）與基數排序（Radix Sort）的原理，以及它們能達到 O(n) 的前提條件。",
      "DS", "排序", "essay", 3, 0.75,
      "Counting Sort：計算每個值出現次數 → 累加取排名 → 依排名放置，O(n+k)（k 為值域）。O(n) 前提：k = O(n)（值域小）。Radix Sort：LSD 或 MSD，每個 digit 用穩定計數排序，d 位數 × O(n+k) = O(d(n+k))。前提：位數 d = O(1)、每位數值域 k = O(n)。"),

    q("比較 Insertion Sort 與 Bubble Sort 的最佳情況複雜度，並說明 Insertion Sort 在「幾乎有序（Nearly Sorted）」陣列上的效能優勢。",
      "DS", "排序", "short_answer", 2, 0.65,
      "Insertion Sort 最佳（已排序）：O(n)——每次 insert 只比較一次就停。Bubble Sort 最佳（加 flag）：O(n)。Insertion Sort 優勢：幾乎有序時每個元素只需移動少數位置，實際操作數遠少於 O(n²)；ShellSort 基於此優勢。"),

    q("說明 Tim Sort 的核心設計思想，以及為何它被 Python 和 Java（Arrays.sort for objects）採用。",
      "DS", "排序", "essay", 4, 0.75,
      "Tim Sort = 合併 Merge Sort + Insertion Sort。步驟：1. 找出自然 Run（已排序子序列），長度不足 minrun（32-64）則用 Insertion Sort 延伸。2. 用 Merge Sort 合併 runs。優點：對真實資料（含自然有序段）O(n) 最佳；穩定；空間 O(n)；最差 O(n log n)。"),

    # --- Hashing ---
    q("說明 Hash Table 的碰撞解決方法：鏈結法（Chaining）與開放定址法（Open Addressing）的原理，並比較 Load Factor 對效能的影響。",
      "DS", "雜湊", "essay", 3, 0.80,
      "Chaining：每個槽維護一條 Linked List，碰撞元素同掛一串。Load Factor α = n/m，查詢平均 O(1+α)。Open Addressing（Linear/Quadratic/Double Hashing）：碰撞則探測下一個空槽，α 接近 1 時效能急劇下降（α 建議 < 0.7）。Chaining 在高 α 下更穩健；Open Addressing Cache 友善但刪除需 Tombstone 標記。"),

    q("說明一致性雜湊（Consistent Hashing）的概念，以及它如何解決分散式快取（如 Memcached）在節點增減時的大規模緩存失效問題。",
      "DS", "雜湊", "essay", 5, 0.85,
      "一般 Hash：key % n，加/移一個節點幾乎所有 key 重分配 → 大量 cache miss。一致性 Hash：節點與 key 同映射到一個 Hash Ring（0 ~ 2^32-1），每個 key 順時針找最近節點。新增節點只影響一段 Ring 的 key；虛擬節點（Virtual Node）解決負載不均。"),

    q("說明 Bloom Filter 的原理，以及假陽性（False Positive）和假陰性（False Negative）的存在性，並舉出一個實際應用場景。",
      "DS", "雜湊", "essay", 4, 0.80,
      "Bloom Filter：m 位元陣列 + k 個 Hash 函數。插入：k 個 bit 設 1。查詢：若所有 k 個 bit 都是 1 → 可能存在（假陽性）；若任一為 0 → 一定不存在（無假陰性）。應用：Google BigTable 減少磁碟 I/O（確認 row key 不存在）；瀏覽器惡意網址快速篩查。代價：不支援刪除（使用 Counting Bloom Filter 可解）。"),

    # --- 複雜度 ---
    q("說明 Big-O, Ω, Θ 三種漸近符號的定義，並舉例說明一個演算法如何同時具有 O(n²) 與 Ω(n) 的界。",
      "DS", "複雜度", "essay", 3, 0.75,
      "O（上界）：f(n) = O(g(n)) 若存在 c,n₀ 使 f(n) ≤ c·g(n) ∀n≥n₀。Ω（下界）：f ≥ c·g。Θ（緊界）：f = Θ(g) iff f=O(g) 且 f=Ω(g)。範例：Insertion Sort 最佳 Ω(n)、最差 O(n²)，Θ 存在於特定情況（如已排序時 Θ(n)）。"),

    q("說明 Master Theorem 的三個 case，並應用它分析 T(n) = 2T(n/2) + n 與 T(n) = 4T(n/2) + n 的複雜度。",
      "DS", "複雜度", "essay", 4, 0.85,
      "Master Theorem：T(n)=aT(n/b)+f(n)，令 d=log_b(a)。Case 1 f=O(n^{d-ε})：T=Θ(n^d)。Case 2 f=Θ(n^d)：T=Θ(n^d log n)。Case 3 f=Ω(n^{d+ε})：T=Θ(f(n))。T(n)=2T(n/2)+n：d=1, f=n=Θ(n^1)→Case 2→T=Θ(n log n)（Merge Sort）。T(n)=4T(n/2)+n：d=2, f=n=O(n^{2-1})→Case 1→T=Θ(n²)。"),

    # --- 其他重要DS主題 ---
    q("說明 LRU（Least Recently Used）快取的設計，使用哪種資料結構組合可達到 get/put 均為 O(1)？",
      "DS", "綜合設計", "essay", 4, 0.85,
      "使用 HashMap（key→節點指標）+ Doubly Linked List（維護存取順序，頭=最新，尾=最舊）。get：從 HashMap O(1) 找節點，移到鏈表頭 O(1)。put：若 key 存在，更新值並移頭；若滿，刪除尾（最久未使用）並在 HashMap 移除，新節點插頭，HashMap 更新。全程 O(1)。"),

    q("說明字串匹配中 KMP 演算法的核心思想（Failure Function），以及如何避免暴力匹配的重複比較，達到 O(n+m) 複雜度。",
      "DS", "字串", "essay", 5, 0.85,
      "Failure Function（前綴函數）：f[j] = pattern[0..j] 中最長真前綴 = 後綴的長度。預處理 pattern O(m)。匹配時若 pattern[j] 失配，不回退文本指標，pattern 跳至 f[j-1] 重新對比，避免重複。文本指標只前進不後退，O(n)。總計 O(n+m)。暴力法 O(nm)。"),

    q("說明段樹（Segment Tree）的結構與建構方式，以及如何支援「區間查詢」與「點更新」各 O(log n)。",
      "DS", "樹", "essay", 5, 0.85,
      "Segment Tree 以完全二元樹表示：葉節點存原始值，內節點存子區間聚合值（sum/min/max）。建構 O(n)。區間查詢：若當前節點區間完全在查詢範圍內，返回節點值；否則分割左右子查詢，O(log n)。點更新：更新葉後向上更新父節點，O(log n)。空間 O(n)。"),

    q("說明動態規劃（DP）的兩個核心條件：最優子結構與重疊子問題，並以 Fibonacci 和 0/1 背包問題說明 Memoization 與 Tabulation 的差異。",
      "DS", "動態規劃", "essay", 4, 0.85,
      "最優子結構：整體最優解包含子問題最優解。重疊子問題：子問題被重複計算。Memoization（Top-down）：遞迴 + 快取，只計算用到的子問題，空間取決於呼叫圖。Tabulation（Bottom-up）：迭代填表，計算所有子問題，可能節省 stack 空間。0/1 背包：dp[i][w] = max(dp[i-1][w], dp[i-1][w-w_i]+v_i)，Tabulation O(nW) 時間空間。"),

    q("說明圖的拓撲排序（Topological Sort）的 DFS 與 BFS（Kahn's）兩種方法，以及如何偵測有向無環圖（DAG）條件。",
      "DS", "圖", "essay", 4, 0.80,
      "DFS 法：後序（postorder）完成節點加到結果的前端，最後反轉。若 DFS 遇灰色節點→有環，非 DAG。Kahn's（BFS）：計算 in-degree，將 in-degree=0 的節點加 Queue；每次取出節點，減少其鄰居 in-degree，降到 0 的加入 Queue；最後若輸出節點數 < V → 有環。時間 O(V+E)。"),

    q("解釋 Union-Find（Disjoint Set Union）資料結構，說明 Path Compression 與 Union by Rank 如何使各操作達到接近 O(1) 的攤銷複雜度。",
      "DS", "集合", "essay", 4, 0.85,
      "Union-Find：每個集合以樹表示，根為代表元素。Find：返回根（可能 O(n) 高）。Path Compression：find 時將路徑上所有節點直接指向根，後續查詢更快。Union by Rank：矮樹接在高樹下，控制高度。兩者結合：攤銷複雜度 O(α(n))，其中 α 為反 Ackermann 函數，實際上視為常數。應用：Kruskal MST、連通分量偵測。"),

    q("說明二分搜尋（Binary Search）的正確實作（注意邊界條件），以及如何應用二分搜尋解「在旋轉排序陣列中搜尋目標值」問題。",
      "DS", "搜尋", "essay", 3, 0.80,
      "標準 BS：while lo≤hi; mid=(lo+hi)>>1（避免溢位）；目標在左→hi=mid-1，在右→lo=mid+1。旋轉陣列：每次判斷哪半段有序（比較 arr[lo] vs arr[mid]），再判斷目標是否在有序段內，縮減範圍，O(log n)。"),

    q("說明最長公共子序列（LCS）的動態規劃解法，並分析時間與空間複雜度，以及如何優化空間至 O(min(m,n))。",
      "DS", "動態規劃", "essay", 4, 0.85,
      "dp[i][j] = LCS of A[1..i] and B[1..j]。若 A[i]==B[j]：dp[i][j] = dp[i-1][j-1]+1。否則：max(dp[i-1][j], dp[i][j-1])。時間 O(mn)，空間 O(mn)。空間優化：只保留當前行與上一行（兩行滾動），O(min(m,n))。"),

    q("說明貪婪演算法（Greedy Algorithm）的適用條件，並以活動選擇問題（Activity Selection Problem）說明貪婪選擇性質（Greedy Choice Property）的成立。",
      "DS", "演算法設計", "essay", 4, 0.80,
      "貪婪適用：問題具有「貪婪選擇性質」（局部最優→全域最優）與「最優子結構」。活動選擇：每次選結束時間最早的不衝突活動。證明：若最優解未選最早結束的活動 a*，可將其第一個活動替換成 a*，結束更早不影響後選活動數 → a* 安全。排序後 O(n log n)，選擇 O(n)。"),

    q("說明 Skip List 的結構與查詢機制，以及其期望查詢時間為 O(log n) 的直觀解釋。",
      "DS", "鏈結串列", "essay", 4, 0.75,
      "Skip List：多層鏈表，底層含所有元素，每層隨機（機率 1/2）保留部分元素作為「快速道」。查詢：從最高層開始，盡量向右跳，遇到值過大則下降一層，直到底層確認。期望高度 O(log n)，每層期望跳 O(1) 步 → 總 O(log n)。空間 O(n) 期望。無需像平衡樹那樣複雜旋轉，實作較簡單。"),

    q("說明 Huffman Coding 的構造步驟，以及為何它是最優前綴碼（Optimal Prefix Code）？",
      "DS", "貪婪", "essay", 4, 0.80,
      "步驟：將所有字元以頻率建 Min-Heap；每次取兩個最小頻率節點，合併成新節點（頻率相加）再 push 回 heap；重複直到只剩根 → 構成二元樹，左邊為 0，右邊為 1。最優性：貪婪選擇性質——頻率最小的兩字元一定在最深層，且互為兄弟。可用最優子結構證明歸納正確性。"),

    q("說明何謂 NP 完全（NP-Complete）問題，以及 P vs NP 問題的重要性，並舉出三個 NP-C 問題。",
      "DS", "計算複雜度", "essay", 5, 0.85,
      "P：多項式時間可解。NP：多項式時間可驗證答案。NP-C：最難的 NP 問題，所有 NP 問題都可多項式規約到它。若 P=NP，所有 NP-C 可在多項式時間解決（密碼學崩潰）。三個 NP-C：旅行業務員問題（TSP-Decision）、3-SAT、Subset Sum。實務應對：近似演算法、參數化複雜度、啟發式搜尋。"),
]

# ─────────────────────────────────────────────────────────────────────────────
# CS (計算機概論) — 50 題
# ─────────────────────────────────────────────────────────────────────────────

CS_QUESTIONS = [
    # --- 計算機組織 ---
    q("說明 von Neumann 架構的主要元件，以及哈佛架構（Harvard Architecture）在哪些方面有所改善？",
      "CS", "計算機組織", "short_answer", 2, 0.65,
      "von Neumann：CPU（ALU + Control Unit）+ Memory（程式與資料共用）+ I/O + Bus。瓶頸：Memory Bandwidth（指令與資料競爭同一匯流排）。Harvard：分離指令記憶體與資料記憶體（兩組 Bus），允許同時取指與取資料，現代 CPU 以分離 L1 Cache（I-Cache/D-Cache）模擬 Harvard。"),

    q("說明 RISC 與 CISC 指令集架構的主要差異，以及現代 x86 處理器如何在 CISC 外表下使用 RISC 核心？",
      "CS", "計算機組織", "essay", 3, 0.75,
      "RISC：指令等長、Load-Store 架構、大暈暮存器、管線友善。CISC：複雜可變長度指令、記憶體直接運算。現代 x86（Intel Core）：前端解碼將 CISC 指令分解為 micro-ops（μops），後端 RISC 微架構執行，流水線效率高。RISC-V 崛起：開放標準 RISC ISA，ARM 的競爭者。"),

    q("說明 CPU 流水線（Pipeline）的執行階段，以及資料相依（Data Hazard）、控制相依（Control Hazard）如何影響效能？",
      "CS", "計算機組織", "essay", 3, 0.80,
      "Pipeline 五階段：IF→ID→EX→MEM→WB。Data Hazard：前後指令依賴（RAW）→ Forwarding/Bypassing 或插入 NOP Stall。Control Hazard：跳轉目標不確定 → Branch Prediction（動態/靜態）；預測失敗 Flush 管線（Penalty 取決於 pipeline 深度）。Structure Hazard：資源衝突 → 分開 I-Cache/D-Cache。"),

    # --- 記憶體管理 ---
    q("說明虛擬記憶體（Virtual Memory）的原理，以及分頁（Paging）機制如何透過頁表（Page Table）將虛擬地址轉換為實體地址？",
      "CS", "記憶體管理", "essay", 3, 0.80,
      "Virtual Memory：每個 process 有獨立虛擬位址空間，映射到實體記憶體或磁碟（Swap）。分頁：虛擬位址 = Page Number + Offset。Page Table 儲存 VPN→PFN 映射。TLB（Translation Lookaside Buffer）快取最近的映射，命中 O(1)；TLB miss 走 Page Table Walk O(存取次數)。多層頁表（x86-64 4 層）節省空間。"),

    q("說明頁面替換演算法（Page Replacement Algorithms）中 FIFO、LRU、OPT 的策略，以及為何 LRU 接近最佳？",
      "CS", "記憶體管理", "essay", 3, 0.75,
      "FIFO：替換最早進來的頁（Belady 異常：增加框數反而 page fault 增加）。OPT：替換最遠未來才用到的頁，最優但需預知未來，僅用於比較。LRU：替換最久未使用的頁，基於局部性原理（Locality of Reference）近似最優。實作：Stack 或 Counter，O(n) 或配合 Hash+DLL 達 O(1)。"),

    q("說明記憶體分割策略：固定分割（Fixed Partitioning）、動態分割（Dynamic Partitioning）與分頁（Paging）各自的碎片化（Fragmentation）問題。",
      "CS", "記憶體管理", "essay", 3, 0.70,
      "固定分割：內部碎片（分配空間 > 需求，浪費在分割槽內）。動態分割：外部碎片（已分配的空洞散落，總空間夠但無連續大塊），Compaction 解決但代價高。分頁：無外部碎片（邏輯連續但物理散落）；少量內部碎片（最後一頁未用完）。分段（Segmentation）：外部碎片，需要 compaction。"),

    q("說明記憶體快取（Cache Memory）的運作原理，並解釋直接映射（Direct Mapping）、全關聯（Full Associative）、組合關聯（Set Associative）三種映射方式的差異。",
      "CS", "記憶體管理", "essay", 4, 0.80,
      "Cache 利用 Temporal/Spatial Locality 預存近期用到的資料。直接映射：每個主記憶體 block 只能進固定的 Cache line（address mod n），衝突率高。全關聯：可放任何 Cache line，需比較所有 tag，成本高，小容量使用。Set Associative（k-way）：分組，block 可進固定組內任意 way，折衷。實際：L1/L2 多為 4 或 8-way。"),

    # --- 進程與執行緒 ---
    q("說明程序（Process）與執行緒（Thread）的差異，以及多執行緒相較於多程序的優缺點。",
      "CS", "作業系統", "essay", 3, 0.75,
      "Process：獨立位址空間、獨立資源（fd/堆疊），建立/切換成本高。Thread：同進程共用位址空間、heap，各自擁有 stack 和 register，切換輕量。多執行緒優點：通訊成本低（共用記憶體）、建立快。缺點：一個 thread 崩潰可能拖垮整個 process（隔離性差）；需同步（Race Condition）。"),

    q("說明死結（Deadlock）的四個必要條件（Coffman's Conditions），以及預防（Prevention）、避免（Avoidance）、偵測與恢復（Detection & Recovery）三種策略的差異。",
      "CS", "作業系統", "essay", 4, 0.85,
      "四條件：互斥、Hold and Wait、不可剝奪（Non-preemption）、循環等待。Prevention：破壞一個條件（如強制剝奪、一次請求全部資源）。Avoidance：Banker's Algorithm—動態檢查分配後是否仍在安全狀態。Detection+Recovery：允許死結發生，定期偵測資源等待圖（找環），再強制結束進程或回滾。"),

    q("說明 Mutex、Semaphore、Monitor 三種同步機制的差異，並說明使用 Binary Semaphore 實作 Mutex 的方法。",
      "CS", "作業系統", "essay", 4, 0.80,
      "Mutex：互斥鎖，同一執行緒 lock/unlock，防止多執行緒同時進入 Critical Section。Semaphore：計數器，可允許 N 個執行緒並發（Counting Semaphore），P（wait）/V（signal）操作。Monitor：高層抽象，自動互斥 + Condition Variable，Java synchronized 即 Monitor 實作。Binary Semaphore：初始值 1，wait=lock, signal=unlock，效果等同 Mutex，但任何執行緒都可 signal（Mutex 只有 owner 可 unlock）。"),

    q("說明 CPU 排程中 SJF（Shortest Job First）的最短平均等待時間性質，以及 Preemptive SJF（SRTF）如何應對長作業飢餓（Starvation）問題？",
      "CS", "作業系統", "essay", 3, 0.75,
      "SJF：Burst Time 最短的作業先執行，可證明最小化平均等待時間（相同原理：Greedy 排程活動）。問題：Burst Time 需預測；長作業可能永遠等待（Starvation）。SRTF（SJF Preemptive）：若新作業 Burst < 當前剩餘，搶占。Aging 解決飢餓：等待時間越長，優先級越高。"),

    q("說明 Round-Robin 排程的時間量（Time Quantum）設定對效能的影響，以及與 FCFS、SJF、Priority Scheduling 的比較。",
      "CS", "作業系統", "short_answer", 3, 0.70,
      "RR：Q 太小→context switch 開銷大，效率低；Q 太大→退化成 FCFS，回應慢。FCFS：非 Preemptive，護航效應（短作業等長作業）。SJF：最優平均等待，但需預知 Burst Time。Priority：優先級高先執行，低優先級 Starvation（Aging 解決）。RR 最適合互動/分時系統，Response Time 可預測。"),

    # --- 檔案系統 ---
    q("說明 inode 的概念，以及 Unix 檔案系統如何用直接塊、間接塊（Single/Double/Triple Indirect Block）支援大型檔案？",
      "CS", "作業系統", "essay", 3, 0.75,
      "inode：儲存檔案 metadata（權限、大小、時間戳記）與資料塊位址（不含檔名，目錄儲存 filename→inode 映射）。直接塊（12 個）：直接指向資料塊（12×4KB = 48KB）。Single Indirect：1 個指向塊，儲存 1024 個塊位址（1024×4KB = 4MB）。Double/Triple Indirect 逐層擴大，支援 TB 級大檔。"),

    q("比較 FAT32 與 NTFS 的主要差異，包含最大檔案大小、日誌（Journal）機制、存取控制。",
      "CS", "作業系統", "short_answer", 2, 0.65,
      "FAT32：最大檔案 4GB（32 位元 cluster 計數），無日誌（斷電可能損壞），無 ACL 存取控制，相容性好（USB、SD 卡）。NTFS：最大 16EB，有日誌（Journal）保持一致性，ACL 細粒度存取控制，支援壓縮/加密（EFS），MFT（Master File Table）。"),

    # --- 計算機網路 ---
    q("說明 TCP 三次握手（Three-Way Handshake）和四次揮手（Four-Way Handshake）的過程，以及為何揮手需要四次而握手只需三次？",
      "CS", "計算機網路", "essay", 3, 0.80,
      "握手：SYN→SYN-ACK→ACK（三次因 SYN-ACK 合併發送）。揮手：FIN（A 請求關閉）→ACK（B 確認）→FIN（B 完成請求關閉）→ACK（A 確認）四次。揮手多一次：接收 FIN 只代表對方不再發送，B 可能仍有資料要傳，兩個方向獨立關閉，故 ACK 與 FIN 不合并。TIME_WAIT 狀態：確保最後 ACK 到達，等待 2MSL。"),

    q("說明 TCP 的擁塞控制機制（Slow Start、Congestion Avoidance、Fast Retransmit、Fast Recovery），以及 ssthresh 的作用。",
      "CS", "計算機網路", "essay", 4, 0.85,
      "Slow Start：cwnd 從 1 指數成長直到 ssthresh 或遇到擁塞。CA：cwnd 線性成長（每 RTT +1 MSS）。Fast Retransmit：收到 3 個重複 ACK 立即重傳（不等 timeout）。Fast Recovery：ssthresh = cwnd/2，cwnd = ssthresh + 3（不回到 1），繼續 CA（TCP Reno）。Timeout 則回 cwnd=1 重跑 Slow Start。"),

    q("說明 DNS 解析流程（從輸入 URL 到收到 IP），包含遞迴查詢與迭代查詢的差異。",
      "CS", "計算機網路", "essay", 3, 0.75,
      "流程：Browser Cache→OS Cache→Recursive Resolver→Root Nameserver（.）→TLD Nameserver（.com）→Authoritative Nameserver（example.com）→IP。遞迴查詢：Resolver 代為向上查，客戶端得到最終答案。迭代查詢：每個 Nameserver 回應下一個要問誰，Resolver 自行逐步查詢。Resolver 通常對客戶端遞迴、對 Nameserver 迭代。"),

    q("比較 HTTP/1.1、HTTP/2、HTTP/3 的主要改進，說明 HOL Blocking 問題在各版本的解決程度。",
      "CS", "計算機網路", "essay", 4, 0.85,
      "HTTP/1.1：Pipelining（並行發請求但需按序收回應）→TCP 層 HOL Blocking。HTTP/2：Multiplexing（同一 TCP 連線多個 Stream 交錯）→應用層 HOL 解決，但 TCP 丟包仍阻塞所有 Stream。HTTP/3（QUIC over UDP）：每個 Stream 獨立，一個丟包只影響該 Stream→徹底解決 HOL Blocking。QUIC 另提供 0-RTT 連線、內建 TLS 1.3。"),

    q("說明子網路遮罩（Subnet Mask）與 CIDR 的概念，以及如何將 192.168.1.0/24 網路切割為 4 個等大小子網路。",
      "CS", "計算機網路", "short_answer", 3, 0.70,
      "CIDR（Classless Inter-Domain Routing）：以 /prefix 表示網路位元數，取代傳統 A/B/C 類。/24→256 位址。切 4 個等大→每個 64 位址→/26（借 2 位元）。四個子網：192.168.1.0/26（0-63）、192.168.1.64/26（64-127）、192.168.1.128/26（128-191）、192.168.1.192/26（192-255）。各可用主機 62 個。"),

    q("說明 NAT（Network Address Translation）的工作原理，以及它如何讓多台私有 IP 設備共用一個公共 IP？",
      "CS", "計算機網路", "short_answer", 3, 0.70,
      "PAT（Port Address Translation）：Router 建立 NAT Table（PrivateIP:Port → PublicIP:Port）。封包出去時替換 Source，回來時根據 Port 反查，替換 Destination 後轉給內部設備。解決 IPv4 位址不足，但破壞 End-to-End 透明性，P2P 應用需 NAT Traversal（STUN/TURN）。"),

    # --- 資料庫 ---
    q("說明資料庫正規化（Normalization）的 1NF、2NF、3NF、BCNF，以及反正規化（Denormalization）的使用時機。",
      "CS", "資料庫", "essay", 4, 0.85,
      "1NF：每個屬性原子值，無重複群。2NF：1NF + 非鍵屬性完全依賴主鍵（消除部分依賴）。3NF：2NF + 非鍵屬性不依賴其他非鍵屬性（消除遞移依賴）。BCNF：每個 FD 的決定者都是候選鍵。反正規化：OLAP/報表場景，用冗餘換取 JOIN 減少，提升讀效能，但增加寫開銷與一致性維護。"),

    q("說明 ACID 性質（Atomicity、Consistency、Isolation、Durability）以及資料庫如何透過日誌（WAL）與鎖（Locking）機制實現它們？",
      "CS", "資料庫", "essay", 4, 0.85,
      "A（原子性）：WAL（Write-Ahead Log）—先寫日誌再寫資料，回滾時用日誌 Undo。C（一致性）：應用層約束 + 外鍵/Check 約束。I（隔離性）：MVCC（Multi-Version Concurrency Control）或 2PL（Two-Phase Locking）。D（持久性）：Log 在事務 commit 前必須持久化（fsync）到磁碟。"),

    q("說明 SQL 中 INNER JOIN、LEFT OUTER JOIN、FULL OUTER JOIN 的差異，並各舉一個使用情境。",
      "CS", "資料庫", "short_answer", 2, 0.65,
      "INNER JOIN：只保留兩表都有匹配的記錄（訂單 JOIN 客戶—只看有客戶資料的訂單）。LEFT JOIN：保留左表所有記錄，右表無匹配填 NULL（查所有客戶，包含未下單的）。FULL OUTER JOIN：兩邊都保留（查所有客戶與所有訂單，包含無訂單的客戶和無客戶的孤兒訂單）。"),

    q("說明資料庫索引（Index）的運作原理，以及何時「不應該」建立索引？",
      "CS", "資料庫", "essay", 3, 0.80,
      "索引（B+ Tree）：維護排序的 key→rowid 映射，加速 WHERE/ORDER BY/JOIN，代價是寫入時維護。不建立索引：1. 低 Cardinality 欄（如 Boolean）—Index Scan 比 Full Table Scan 差。2. 小表—全表掃比索引查更快（Index Overhead）。3. 頻繁 UPDATE/INSERT 的欄—維護成本高。4. 函數依賴欄（除非 Function-Based Index）。"),

    q("說明事務隔離級別（Transaction Isolation Levels）：READ UNCOMMITTED、READ COMMITTED、REPEATABLE READ、SERIALIZABLE，以及各級別可能發生的異常（Dirty Read、Non-Repeatable Read、Phantom Read）。",
      "CS", "資料庫", "essay", 4, 0.85,
      "READ UNCOMMITTED：臟讀（讀到未提交資料）。READ COMMITTED（Oracle/SQL Server 預設）：解決臟讀，但非重複讀（同事務內再讀值可能不同）。REPEATABLE READ（MySQL 預設）：解決非重複讀，但幻讀（同事務內範圍查詢行數可能改變）。SERIALIZABLE：完全隔離，無異常，但效能最差（全表鎖或 MVCC + Gap Lock）。"),

    # --- 軟體工程 ---
    q("說明軟體測試的層次：單元測試（Unit Test）、整合測試（Integration Test）、系統測試（System Test）、驗收測試（UAT），以及測試金字塔（Test Pyramid）的意義。",
      "CS", "軟體工程", "essay", 3, 0.75,
      "Unit Test：測最小可測單元（函數/類別），快速、隔離，用 Mock 替代依賴。Integration Test：測多個模組/服務互動（API 層、資料庫）。System Test：整體系統端到端（E2E）。UAT：業務人員驗收。測試金字塔：底層（Unit Test）數量多、成本低；中層（Integration）；頂層（E2E）少但覆蓋關鍵路徑；越往頂層越慢越貴，維護成本越高。"),

    q("說明設計模式（Design Patterns）中 Singleton、Factory Method、Observer 三種模式的用途，以及各自可能的濫用風險。",
      "CS", "軟體工程", "essay", 3, 0.80,
      "Singleton：確保類別只有一個實例（日誌器、Config），缺點：全域狀態→測試難、多執行緒需 Double-Checked Locking。Factory Method：抽象建立邏輯，子類決定實例類型，符合開閉原則；過度使用增加類別數量。Observer（Pub-Sub）：一對多依賴，廣泛用於 Event-Driven；過多 Observer 造成 Debug 困難（事件鏈追蹤）、記憶體洩漏（未取消訂閱）。"),

    q("說明 REST API 的六個架構約束（Layered, Stateless, Cache, Client-Server, Uniform Interface, Code on Demand），以及與 GraphQL 的主要差異。",
      "CS", "軟體工程", "essay", 4, 0.80,
      "REST 六約束（Fielding, 2000）：無狀態（Stateless）最關鍵—每個請求自帶所有資訊。GraphQL 差異：客戶端精確指定需要的欄位（解決 Over/Under-fetching）；單一 endpoint；複雜查詢可能 N+1 問題（需 DataLoader）；Schema 即文件；學習曲線較高。選擇：簡單 CRUD → REST；多端點複雜資料需求→ GraphQL。"),

    # --- 數字系統與計算機基礎 ---
    q("將十進位數 -45 以 8 位元二補數（Two's Complement）表示，並說明二補數表示法相較於符號大小（Sign-Magnitude）的計算優勢。",
      "CS", "數字系統", "short_answer", 3, 0.70,
      "45 = 0b00101101。取反 = 0b11010010，+1 = 0b11010011。驗證：-45 = -(128-83) = -(128-83) = -45 ✓。優勢：加減法電路統一（不需區分正負單獨處理），不存在 -0，可直接用加法器做減法（A - B = A + (-B 的二補數)）。"),

    q("說明浮點數 IEEE 754 單精度（32 bit）的組成（Sign, Exponent, Mantissa），以及表示 0.1 時出現誤差的原因。",
      "CS", "數字系統", "essay", 3, 0.75,
      "IEEE 754：1 位 Sign + 8 位 Exponent（Bias=127）+ 23 位 Mantissa。0.1 = 0.0001100110011...（二進位循環小數），23 位截斷→舍入誤差。範例：0.1 + 0.2 ≠ 0.3（約 0.30000000000000004）。解法：使用 Decimal 類別（高精度十進位）或整數表示（金融系統以分計）。"),

    q("說明布林代數中 De Morgan's Law，並用 NAND 閘實作 AND、OR、NOT 三種邏輯閘，說明 NAND 為什麼是功能完備集（Functionally Complete）？",
      "CS", "數字系統", "short_answer", 3, 0.70,
      "De Morgan：¬(A∧B) = ¬A∨¬B；¬(A∨B) = ¬A∧¬B。NOT A = NAND(A,A)。AND A,B = NOT(NAND(A,B)) = NAND(NAND(A,B), NAND(A,B))。OR A,B = NAND(NOT A, NOT B) = NAND(NAND(A,A), NAND(B,B))。功能完備：任何布林函數可用 NOT+AND+OR 組成，而這三者都可用 NAND 實作，故 NAND 足以構建任意電路（NOR 同理）。"),

    # --- 編譯器 ---
    q("說明編譯器的前端（Frontend）與後端（Backend）分工，以及詞法分析（Lexical Analysis）→語法分析（Parsing）→語意分析（Semantic Analysis）的輸入輸出為何？",
      "CS", "編譯器", "essay", 4, 0.75,
      "詞法分析（Scanner）：原始碼字元流→Token 序列（識別字、關鍵字、符號）。語法分析（Parser）：Token 序列→AST（Abstract Syntax Tree），驗證語法規則（CFG）。語意分析：AST→帶語意的 AST 或 IR，型別檢查、符號解析、Scope 分析。後端：IR→目標機器碼（Register Allocation、指令選擇、最佳化）。"),

    q("說明LL(1) 與 LR(1) 解析器的差異，以及為何大多數程式語言偏好 LR 解析器？",
      "CS", "編譯器", "essay", 5, 0.70,
      "LL(1)：由左至右掃描、最左推導、看 1 個前瞻符號，Top-Down，手寫遞歸下降容易。限制：不能處理左遞歸、Ambiguous Grammar 問題多。LR(1)：Left-to-right, Rightmost derivation in reverse（Bottom-up），用 Shift-Reduce 驅動，可處理更廣泛的 Grammar（LR ⊃ LL）。大多數語言文法為 LR(1)，yacc/bison 自動生成 LR 解析器。"),

    q("說明垃圾回收（Garbage Collection）的三種主要演算法：標記清除（Mark-and-Sweep）、引用計數（Reference Counting）、複製（Copying GC），並分析各自的優缺點。",
      "CS", "軟體工程", "essay", 4, 0.80,
      "Mark-and-Sweep：追蹤可達物件標記，清除未標記；缺點 Stop-the-World pause、記憶體碎片。Reference Counting：物件有引用計數，歸零時即時釋放；缺點：循環引用洩漏（需弱引用或周期檢測）、原子操作成本。Copying GC：從 Active 半空間複製可達物件到 Inactive，自動壓縮；缺點：只能使用一半記憶體。現代 GC（如 JVM G1）組合三者（分代 + 並發標記）。"),

    # --- 作業系統補充 ---
    q("說明 Thrashing 現象的成因，以及工作集（Working Set）模型如何作為預防策略？",
      "CS", "作業系統", "essay", 4, 0.80,
      "Thrashing：process 過多且每個分配的 Frame 數過少，花大量時間 Page Swapping 而非執行，CPU 使用率崩潰。Working Set：以時間窗口 Δ 追蹤最近 Δ 次記憶體存取涉及的頁面集合（Working Set）。若系統所有 process 工作集總和 > 可用 Frame → 暫停部分 process（換出到磁碟），確保剩餘 process 的工作集都能在 Frame 內，避免 Thrashing。"),

    q("說明 Copy-on-Write（COW）機制，以及 Linux fork() 如何利用 COW 提升效能？",
      "CS", "作業系統", "short_answer", 3, 0.75,
      "COW：fork() 後父子共用同一份實體頁面，標記為唯讀。當任一方嘗試寫入，才觸發 Page Fault，OS 複製頁面給寫入方，使雙方各有獨立副本。效益：如果 fork 後立即 exec（shell 典型模式），大量頁面從未寫入，無需複製，大幅節省記憶體與時間。"),

    q("解釋 I/O Multiplexing 中 select、poll 與 epoll 的差異，以及為何高並發服務（如 Nginx）偏好 epoll？",
      "CS", "作業系統", "essay", 4, 0.80,
      "select/poll：每次呼叫需將所有 fd 複製到 kernel，kernel O(n) 線性掃描返回就緒集合，max fd 有上限（select 1024）。epoll：向 kernel 登記感興趣的 fd（epoll_ctl），只有就緒的 fd 放入就緒佇列，O(1) 每次返回。高並發（N > 10000 fd）時 epoll 複雜度從 O(N) 降為 O(就緒數)，nginx/Redis 使用 epoll（Linux）或 kqueue（BSD）。"),

    q("說明微核心（Microkernel）與宏核心（Monolithic Kernel）作業系統架構的差異，並各舉一個代表性 OS。",
      "CS", "作業系統", "essay", 3, 0.70,
      "Monolithic（宏核心）：所有 OS 服務（FS、網路、驅動）都在核心態，效能高（零切換）但龐大、任何模組崩潰導致整個 kernel 崩潰（Linux、Windows NT）。Microkernel：核心只保留 IPC、基本記憶體管理、排程，其餘服務在使用者態，模組崩潰可隔離，可靠性高但 IPC 頻繁導致效能較差（Mach、seL4、QNX）。Hybrid（Windows NT/macOS XNU）：折衷設計。"),

    q("說明 HTTPS 的完整通訊流程（TLS 1.3 Handshake），以及憑證鏈（Certificate Chain）如何建立信任？",
      "CS", "計算機網路", "essay", 4, 0.85,
      "TLS 1.3 Handshake（1-RTT）：Client Hello（支援的 Cipher Suites + Key Share）→Server Hello（選定 Cipher + Key Share）→雙方用 ECDH 計算 Session Key + Finished（驗證 Handshake 完整性）。相較 TLS 1.2 少一個 RTT。憑證鏈：Server Cert → Intermediate CA Cert → Root CA Cert。Root CA 預裝於 OS/Browser 信任庫，逐層驗證簽章即建立信任。"),

    q("說明 CAP 定理的三個性質（Consistency, Availability, Partition Tolerance），以及為何分散式系統只能保證其中兩個？",
      "CS", "分散式系統", "essay", 4, 0.90,
      "C（一致性）：所有節點同時看到相同資料。A（可用性）：每個請求都能收到回應（即使不是最新資料）。P（分區容忍性）：網路分區發生時系統仍繼續運作。網路分區在分散式系統中不可避免（P 必須保留），所以需在 C 與 A 之間取捨。CA（單節點 RDBMS）、CP（ZooKeeper、HBase）、AP（DynamoDB、Cassandra）。PACELC 模型補充：無分區時也需在延遲（L）與一致性（C）之間取捨。"),

    q("說明 MapReduce 的程式設計模型，以及 Map 與 Reduce 階段各自的輸入輸出格式，並以「詞頻計算（Word Count）」為例說明。",
      "CS", "分散式系統", "essay", 3, 0.80,
      "MapReduce：Map（(key1, val1) → list[(key2, val2)]）、Shuffle（按 key2 分組）、Reduce（(key2, list[val2]) → (key2, val3)）。Word Count 範例：Map 輸入 (docID, text)，輸出 (word, 1)；Shuffle 按 word 分組；Reduce 輸入 (word, [1,1,1,...])，輸出 (word, count)。並行化：Map 可在所有 chunk 並行執行，Reduce 各 key 獨立。"),

    q("說明虛擬化（Virtualization）與容器化（Containerization）的技術差異，以及 Docker 的 Copy-on-Write 層（Union File System）如何節省儲存空間？",
      "CS", "系統設計", "essay", 4, 0.85,
      "VM：Hypervisor 模擬完整硬體，每個 VM 有獨立 OS（完整隔離，啟動慢，記憶體開銷大）。Container（Docker）：共用宿主 OS Kernel，Namespace 隔離（PID/Network/Mount），cgroups 資源限制，啟動快，密度高。Union FS（OverlayFS）：Image 由唯讀層堆疊，只有寫入時才 COW 到可寫層。多個容器共用同一 base image 的唯讀層，節省大量磁碟空間。"),
]

# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main():
    all_questions = []

    for i, item in enumerate(MIS_QUESTIONS, start=1):
        item["question_number"] = str(i)
        all_questions.append(item)

    for i, item in enumerate(DS_QUESTIONS, start=1):
        item["question_number"] = str(i)
        all_questions.append(item)

    for i, item in enumerate(CS_QUESTIONS, start=1):
        item["question_number"] = str(i)
        all_questions.append(item)

    conn = init_db(DB_PATH)
    inserted = load_questions(conn, all_questions)
    conn.close()

    print(f"Inserted {inserted} template questions into {DB_PATH}")
    print(f"  MIS: {len(MIS_QUESTIONS)} | DS: {len(DS_QUESTIONS)} | CS: {len(CS_QUESTIONS)}")


if __name__ == "__main__":
    main()
