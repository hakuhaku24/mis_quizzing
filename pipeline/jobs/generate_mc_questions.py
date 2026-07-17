"""
生成 60 道選擇題（MIS/DS/CS 各 20），寫入 data/questions.db
Usage: python -m pipeline.jobs.generate_mc_questions
"""

import json
from pipeline.db.sqlite_loader import init_db, insert_question, insert_solution, DB_PATH


def mc(text, opts, correct, topic, subtopic, diff, score, expl):
    """opts: list of 4 strings like ['A. ...', 'B. ...', 'C. ...', 'D. ...']"""
    return {
        "school": "template",
        "department": "資訊管理研究所",
        "year_label": "範本選擇題",
        "question_text": text.strip(),
        "question_type": "multiple_choice",
        "topic": topic,
        "subtopic": subtopic,
        "difficulty": diff,
        "value_score": score,
        "source_type": "template",
        "extraction_confidence": 1.0,
        "verified_status": "template",
        "options": opts,
        "correct_option": correct,
        "solutions": [{"solution_text": expl.strip(), "source_type": "template", "verified_status": "template"}],
    }


# ─── MIS 20 題 ────────────────────────────────────────────────────────────────
MIS_MC = [
    mc("以下哪項最能描述「牛鞭效應（Bullwhip Effect）」？",
       ["A. 消費者需求波動導致零售商庫存增加",
        "B. 需求訊號沿供應鏈向上游傳遞時被逐漸放大",
        "C. 製造商因為預測錯誤而過量生產",
        "D. 電商平台因促銷導致退貨率上升"],
       "B", "MIS", "SCM", 2, 0.75,
       "牛鞭效應：從零售→批發→製造→原料，需求波動依次放大。根源是各層各自預測、批量訂購、促銷波動。"),

    mc("ERP 系統中「最佳實務（Best Practice）」的主要來源是？",
       ["A. 企業自行開發的內部流程規範",
        "B. 政府主管機關公布的標準作業程序",
        "C. ERP 廠商依多年客戶實作累積並內嵌於系統的標準流程",
        "D. ISO 9001 認證要求的流程文件"],
       "C", "MIS", "ERP", 2, 0.70,
       "ERP 廠商（SAP/Oracle）將全球客戶最佳作法內嵌為預設流程，企業導入時需決定是否接受或客製化。"),

    mc("資訊安全 CIA 三元素中，「完整性（Integrity）」最主要是透過哪種技術控制來保護？",
       ["A. 加密（Encryption）",
        "B. 防火牆（Firewall）",
        "C. 雜湊與數位簽章（Hash / Digital Signature）",
        "D. 雙因素驗證（2FA）"],
       "C", "MIS", "資訊安全", 2, 0.70,
       "完整性：確保資料未被竄改。Hash（SHA-256）讓任何一位元改動都使摘要完全不同；數位簽章同時驗證來源與完整性。加密主要保護機密性。"),

    mc("下列哪個選項最能描述「雲端運算」中的 PaaS（Platform as a Service）？",
       ["A. 提供虛擬機、儲存和網路，用戶管理 OS 以上所有軟體",
        "B. 提供開發與部署平台，用戶只負責應用程式本身",
        "C. 提供完整應用程式，用戶只需登入使用",
        "D. 提供容器化環境，用戶管理 Kubernetes Cluster"],
       "B", "MIS", "雲端", 2, 0.65,
       "IaaS→虛擬機。PaaS（Google App Engine, Heroku）→平台，用戶只管 App code。SaaS→完整應用（Salesforce）。"),

    mc("Porter 五力模型中，「替代品威脅（Threat of Substitutes）」對傳統計程車業的最大威脅來自哪裡？",
       ["A. 更多計程車公司進入市場",
        "B. 汽車零件供應商漲價",
        "C. Uber / Lyft 等叫車平台",
        "D. 大眾交通工具票價下降"],
       "C", "MIS", "策略MIS", 3, 0.75,
       "替代品是「不同形式但滿足相同需求」的產品。Uber 不是計程車公司，但滿足相同的「點到點移動」需求，且提供更好的 UX，是典型替代品威脅。"),

    mc("以下關於 OLAP 與 OLTP 的敘述，哪一項是「錯誤」的？",
       ["A. OLTP 適合頻繁的短小異動（INSERT/UPDATE）",
        "B. OLAP 適合大量讀取與複雜分析查詢",
        "C. OLAP 資料庫通常採用第三正規化（3NF）以確保資料品質",
        "D. OLTP 資料通常先經 ETL 後才流入 Data Warehouse"],
       "C", "MIS", "BI", 3, 0.75,
       "OLAP（Data Warehouse）使用星型/雪花型架構（反正規化），以空間換取查詢效率。3NF 是 OLTP 的設計原則。"),

    mc("下列哪種 CRM 功能屬於「操作型 CRM（Operational CRM）」？",
       ["A. 分析客戶終身價值（CLV）",
        "B. 建立 RFM 模型進行客戶分群",
        "C. 自動化銷售流程與電話客服紀錄",
        "D. 預測客戶流失機率"],
       "C", "MIS", "CRM", 2, 0.70,
       "操作型 CRM：直接接觸顧客的前台流程自動化（銷售、行銷、客服）。分析型 CRM：資料分析（CLV、分群、預測）。"),

    mc("以下哪項是「零信任架構（Zero Trust Architecture）」的核心原則？",
       ["A. 內部網路的流量可以被完全信任",
        "B. VPN 連線後即可存取所有內部資源",
        "C. 每次資源存取都需驗證身份，不因位於內網而信任",
        "D. 防火牆是唯一的存取控制點"],
       "C", "MIS", "資訊安全", 3, 0.80,
       "零信任核心：「永不信任，持續驗證」。傳統邊界安全假設內網可信，零信任假設已被入侵（Assume Breach），每次請求都要驗證身份和授權。"),

    mc("Nonaka & Takeuchi SECI 模型中，「外化（Externalization）」是指哪種知識轉換？",
       ["A. 暗默知識 → 暗默知識（師徒制）",
        "B. 暗默知識 → 外顯知識（撰寫手冊）",
        "C. 外顯知識 → 外顯知識（整合報告）",
        "D. 外顯知識 → 暗默知識（邊做邊學）"],
       "B", "MIS", "知識管理", 3, 0.75,
       "SECI：S=Socialization（暗→暗）、E=Externalization（暗→顯）、C=Combination（顯→顯）、I=Internalization（顯→暗）。外化是將專家的隱性知識寫成可分享的文件。"),

    mc("以下關於「數位轉型」的敘述，何者最正確？",
       ["A. 數位轉型等於將紙本文件掃描成電子檔",
        "B. 數位轉型是根本性地重新定義商業模式與企業文化",
        "C. 數位轉型只需要導入最新的 ERP 系統即可完成",
        "D. 數位轉型主要是 IT 部門的責任"],
       "B", "MIS", "數位轉型", 2, 0.75,
       "Digitization（類比→數位）≠ Digitalization（流程數位化）≠ Digital Transformation（根本重塑）。DX 需要全組織的文化變革，CEO 必須帶頭。"),

    mc("GDPR 中的「被遺忘權（Right to Erasure）」是指？",
       ["A. 用戶可要求企業刪除其個人資料",
        "B. 企業可在 72 小時內刪除外洩的資料",
        "C. 用戶可要求匿名化其歷史交易記錄",
        "D. 企業必須定期清除過期的備份資料"],
       "A", "MIS", "BI", 3, 0.80,
       "GDPR 被遺忘權（Art. 17）：在特定條件下（已無必要、撤回同意等），個人可要求企業刪除其所有個人資料。注意：有法律義務保存的資料可例外。"),

    mc("以下哪種模式屬於「雙邊市場（Two-Sided Market）」？",
       ["A. 超市向消費者販售商品",
        "B. Uber 連結司機與乘客",
        "C. 製造商透過批發商銷售給零售商",
        "D. 電信公司提供月租吃到飽方案"],
       "B", "MIS", "電子商務", 3, 0.75,
       "雙邊市場：平台撮合兩組不同用戶（司機⇔乘客、賣家⇔買家）。兩邊互相吸引、產生網路外部性。傳統通路是單邊的線性價值鏈。"),

    mc("「攤銷複雜度（Amortized Complexity）」的概念最常用於分析哪種資料結構的 insert 操作？",
       ["A. 靜態陣列（Static Array）",
        "B. 動態陣列（Dynamic Array / ArrayList）",
        "C. 平衡二元搜尋樹（AVL Tree）",
        "D. 鏈結串列（Linked List）"],
       "B", "MIS", "MIS", 3, 0.65,
       "動態陣列在滿了之後需 2x resize（複製所有元素），但攤銷每次 insert 仍是 O(1)。這是 amortized analysis 的典型範例。"),

    mc("以下關於「API 經濟（API Economy）」的描述，何者最正確？",
       ["A. API 只能用於系統內部整合，不對外開放",
        "B. 企業將核心能力以 API 形式對外開放，吸引第三方建立生態系",
        "C. API 是一種特殊的資料庫連線協定",
        "D. API 的主要目的是取代 ERP 系統"],
       "B", "MIS", "數位轉型", 3, 0.75,
       "API Economy：企業開放 API 讓合作夥伴/開發者建構服務（Twilio/Stripe），形成平台生態系，創造新收入來源或增加用戶黏性。"),

    mc("平衡計分卡（BSC）「學習與成長」構面的 KPI 範例，以下哪個最合適？",
       ["A. 財務報酬率（ROE）",
        "B. 顧客滿意度分數（NPS）",
        "C. 訂單處理週期（Order Cycle Time）",
        "D. 員工數位技能認證通過率"],
       "D", "MIS", "策略MIS", 2, 0.70,
       "BSC 四構面：財務（ROE/ROI）、顧客（NPS、滿意度）、內部流程（週期時間、缺陷率）、學習與成長（員工技能、知識管理）。"),

    mc("以下哪種資訊系統風險管理策略屬於「風險轉移（Risk Transfer）」？",
       ["A. 加裝防火牆以降低入侵風險",
        "B. 放棄某項高風險業務",
        "C. 購買網路資安保險",
        "D. 定期進行滲透測試"],
       "C", "MIS", "資訊安全", 2, 0.70,
       "風險應對策略：避免（放棄業務）、減輕（防火牆、加密）、轉移（保險、外包）、接受（低風險的殘餘風險）。保險是典型風險轉移。"),

    mc("在 SDLC 的「需求分析」階段，以下哪種文件最能清楚描述系統功能？",
       ["A. 系統架構圖（System Architecture Diagram）",
        "B. 使用案例圖（Use Case Diagram）",
        "C. 實體關係圖（ER Diagram）",
        "D. 部署圖（Deployment Diagram）"],
       "B", "MIS", "SDLC", 2, 0.65,
       "Use Case Diagram 描述系統與外部 Actor（使用者/外部系統）的互動功能，是需求階段最重要的文件。ER Diagram 是資料設計；架構圖/部署圖是技術設計。"),

    mc("以下哪項最能解釋「IT 效益悖論（IT Productivity Paradox）」？",
       ["A. IT 投資越多，企業獲利越高",
        "B. 大量 IT 投資卻在統計上未見對應的生產力成長",
        "C. 只有大型企業才能從 IT 投資中獲益",
        "D. AI 的導入會取代大部分 IT 工作"],
       "B", "MIS", "IT治理", 4, 0.75,
       "Solow（1987）觀察到 IT 大量普及，但宏觀生產力統計沒有對應增長。現代解釋：IT 創造的生產力已被衡量方式低估，且 IT 本身需搭配流程再造與人才才能顯現效益。"),

    mc("以下哪個組合是「微服務架構（Microservices）」相較於「單體架構（Monolith）」的主要優點？",
       ["A. 開發速度更快、部署更簡單",
        "B. 各服務可獨立擴展、技術棧可異質",
        "C. 資料庫設計更簡單、事務管理更容易",
        "D. 測試覆蓋率更高、缺陷更少"],
       "B", "MIS", "SDLC", 4, 0.80,
       "微服務優點：獨立部署（影響範圍小）、獨立擴展（只 scale 需要的服務）、技術自主（各服務可選不同語言）。缺點：分散式複雜度、服務間通訊開銷、分散式事務難度。"),

    mc("以下哪種情況最適合採用「Kruskal 演算法」而非「Prim 演算法」求最小生成樹？",
       ["A. 圖的節點數非常多（稠密圖）",
        "B. 邊數遠少於節點數的平方（稀疏圖）",
        "C. 圖包含負邊權重",
        "D. 需要求所有節點對的最短路徑"],
       "B", "MIS", "MIS", 4, 0.65,
       "Kruskal 對邊排序，適合稀疏圖（E 小）。Prim 用 Priority Queue 逐步擴展，在稠密圖（E ≈ V²）時與 Kruskal 相近但更適合。"),
]

# ─── DS 20 題 ────────────────────────────────────────────────────────────────
DS_MC = [
    mc("以下哪種排序演算法在「幾乎已排序（Nearly Sorted）」的陣列上效能最好？",
       ["A. Quick Sort",
        "B. Merge Sort",
        "C. Insertion Sort",
        "D. Heap Sort"],
       "C", "DS", "排序", 2, 0.70,
       "幾乎已排序時，Insertion Sort 每個元素只需移動少數位置，實際操作數接近 O(n)。Quick Sort 在幾乎有序時反而退化（若選首元素為 pivot）；Merge Sort 和 Heap Sort 不管怎樣都是 O(n log n)。"),

    mc("AVL 樹在插入後需要 LL 旋轉的觸發條件是？",
       ["A. 根的 Balance Factor 為 -2，且右子的 BF 為 -1",
        "B. 根的 Balance Factor 為 +2，且左子的 BF 為 +1 或 0",
        "C. 根的 Balance Factor 為 +2，且左子的 BF 為 -1",
        "D. 根的 Balance Factor 為 -2，且右子的 BF 為 +1"],
       "B", "DS", "AVL樹", 4, 0.85,
       "LL 情況：根 BF=+2（左重），左子 BF≥0（左子的左邊更重），此時對根做一次「右旋（Right Rotation）」即可。若左子 BF=-1，則需先左旋左子再右旋根（LR 情況）。"),

    mc("以下哪個操作在「最小堆（Min-Heap）」中的時間複雜度為 O(log n)？",
       ["A. 查詢最小值（peek-min）",
        "B. 建構堆（Build-Heap from array）",
        "C. 刪除任意節點",
        "D. 取出最小值（extract-min）"],
       "D", "DS", "堆積", 2, 0.70,
       "peek-min O(1)（直接看根）；Build-Heap O(n)；delete arbitrary O(log n) 但需先 O(n) 找到節點；extract-min：移除根 O(1) + sift-down O(log n) = O(log n)。"),

    mc("Floyd-Warshall 演算法的時間複雜度為？",
       ["A. O(V log V + E)",
        "B. O(VE)",
        "C. O(V³)",
        "D. O(E log E)"],
       "C", "DS", "圖", 3, 0.80,
       "Floyd-Warshall 三層迴圈（i, j, k 各跑 V 次）→ O(V³)。適合稠密圖的全對最短路（All-Pairs Shortest Path）。Dijkstra 是 O((V+E) log V)，適合單源最短路。"),

    mc("以下關於「Hash Table 開放定址法（Open Addressing）」的描述，何者正確？",
       ["A. 每個 bucket 用 Linked List 儲存碰撞元素",
        "B. 碰撞時探測下一個空位，元素仍存在陣列中",
        "C. Load Factor 可以超過 1",
        "D. 刪除操作比 Chaining 更簡單"],
       "B", "DS", "雜湊", 3, 0.75,
       "開放定址：所有元素都存在陣列（不用額外 Linked List）。Load Factor 必須 < 1（若達 1 則無空位）。刪除需 Tombstone 標記，比 Chaining 麻煩。優點：Cache 友善。"),

    mc("以下哪個問題可用「動態規劃（DP）」解，且時間複雜度優於暴力搜尋？",
       ["A. 在排序陣列中二分搜尋特定值",
        "B. 0/1 背包問題（Knapsack Problem）",
        "C. 在無向圖中找 Euler Path",
        "D. 計算 n 個元素的所有排列"],
       "B", "DS", "動態規劃", 3, 0.80,
       "0/1 背包暴力 O(2ⁿ)，DP O(nW)（偽多項式）。二分搜尋不是 DP；Euler Path 有 O(E) 算法；排列全枚舉不能避免 O(n!)。"),

    mc("「快速排序（Quick Sort）」的最差情況出現在哪種輸入下（使用首元素作為 pivot）？",
       ["A. 完全隨機的陣列",
        "B. 已排序或反向排序的陣列",
        "C. 所有元素相同的陣列",
        "D. 只有兩種不同值的陣列"],
       "B", "DS", "排序", 2, 0.75,
       "首元素 pivot 在已排序（或反序）陣列上，每次 partition 結果極度不均（一邊 0 個，另一邊 n-1 個），遞迴深度 n → O(n²)。三取中（Median-of-Three）可緩解此問題。"),

    mc("以下關於 BFS（廣度優先搜尋）與 DFS（深度優先搜尋）的敘述，哪一項是「正確」的？",
       ["A. DFS 保證找到兩點間的最短路徑（跳數）",
        "B. BFS 在無權圖中保證找到最短路徑（跳數）",
        "C. BFS 使用遞迴實作效率最高",
        "D. DFS 的時間複雜度為 O(V²)"],
       "B", "DS", "圖", 2, 0.75,
       "BFS 按距離層序展開，第一次到達目標即保證最短跳數。DFS 不保證最短路。BFS 用 Queue（迭代），DFS 用 Stack 或遞迴。兩者時間 O(V+E)（鄰接串列）。"),

    mc("以下哪種資料結構最適合實作 LRU（Least Recently Used）快取，使 get/put 均為 O(1)？",
       ["A. 單向鏈結串列 + 陣列",
        "B. 雙向鏈結串列 + HashMap",
        "C. Min-Heap + HashMap",
        "D. AVL 樹 + Queue"],
       "B", "DS", "綜合設計", 4, 0.85,
       "HashMap：O(1) 查找節點指標。雙向鏈結串列：O(1) 在任意位置插入/刪除（只需指標操作）。組合後：get O(1) 找到 + 移到頭；put O(1) 插頭 + 必要時刪尾。"),

    mc("Master Theorem：T(n) = 4T(n/2) + n 的解為？",
       ["A. Θ(n log n)",
        "B. Θ(n²)",
        "C. Θ(n log² n)",
        "D. Θ(n³)"],
       "B", "DS", "複雜度", 4, 0.85,
       "a=4, b=2, f(n)=n。d = log_b(a) = log₂4 = 2。f(n) = n = O(n^{2-1})，符合 Case 1（f 比 n^d 慢）→ T(n) = Θ(n²)。"),

    mc("以下關於「Bloom Filter」的描述，何者正確？",
       ["A. 可以確定一個元素「一定存在」",
        "B. 存在假陰性（False Negative）但無假陽性",
        "C. 存在假陽性（False Positive）但無假陰性",
        "D. 支援高效的元素刪除操作"],
       "C", "DS", "雜湊", 4, 0.80,
       "Bloom Filter：查詢若所有 k 個 bit 都是 1 → 可能存在（假陽性）；若任一為 0 → 一定不存在（無假陰性）。不支援刪除（因為共用 bit 無法區分哪個元素設置的）。"),

    mc("以下哪個操作是 B+ Tree 相較於一般 B-Tree 的主要優勢？",
       ["A. 插入操作更快",
        "B. 葉節點形成串列，支援高效的範圍查詢",
        "C. 樹高更低，查詢深度更淺",
        "D. 記憶體使用量更少"],
       "B", "DS", "B樹", 3, 0.85,
       "B+ Tree：所有資料在葉節點，葉節點以 Linked List 串接。範圍查詢（between A and B）只需找到起點後沿葉串列掃描，無需多次回到內部節點。資料庫索引幾乎都用 B+ Tree。"),

    mc("以下哪種排序演算法是「穩定（Stable）」的？",
       ["A. Quick Sort（基本版本）",
        "B. Heap Sort",
        "C. Merge Sort",
        "D. Selection Sort"],
       "C", "DS", "排序", 2, 0.70,
       "穩定排序：相等元素的相對順序在排序後不變。Merge Sort：合併時左半優先 → 穩定。Quick Sort 和 Heap Sort 不穩定（可改造但不常見）。Selection Sort 不穩定。"),

    mc("Dijkstra 演算法為何不能正確處理含負邊的圖？",
       ["A. 負邊會造成無限迴圈",
        "B. 已確定最短距離的節點可能被負邊再度更新，但 Dijkstra 不回頭",
        "C. Dijkstra 無法處理有向圖",
        "D. 負邊會導致 Priority Queue 排序錯誤"],
       "B", "DS", "圖", 4, 0.85,
       "Dijkstra 的 greedy 性質：一旦節點被標記為「已確定」就不再更新。若有負邊，已確定的節點可能透過負邊找到更短路徑，導致結果錯誤。Bellman-Ford 可處理負邊（鬆弛 V-1 次）。"),

    mc("以下哪個問題是「NP 完全（NP-Complete）」問題？",
       ["A. 有向無環圖的拓撲排序",
        "B. 最短路徑（Single Source Shortest Path）",
        "C. 旅行業務員問題的決策版本（TSP-Decision）",
        "D. 最大流（Maximum Flow）"],
       "C", "DS", "計算複雜度", 4, 0.85,
       "TSP-Decision（是否存在 ≤ k 成本的 Hamiltonian Cycle）是 NP-Complete。拓撲排序 O(V+E)；SSSP O((V+E) log V)；Max Flow O(VE²)——都是多項式時間可解的 P 問題。"),

    mc("以下關於「Trie（字首樹）」的描述，何者正確？",
       ["A. 查詢一個長度為 m 的字串需要 O(log n) 時間",
        "B. 不支援前綴搜尋（Prefix Search）",
        "C. 查詢時間為 O(m)，與字典中的字串數無關",
        "D. 空間複雜度通常優於 Hash Table"],
       "C", "DS", "樹", 3, 0.80,
       "Trie 查詢 O(m)（m=字串長度），與字典大小 n 無關（Hash Table 在最差碰撞情況下可能退化）。優點：前綴查詢天然支援。缺點：空間通常比 Hash Table 大（alphabet × 節點數）。"),

    mc("以下哪個場景最適合使用「Segment Tree（線段樹）」？",
       ["A. 儲存學生成績的有序列表",
        "B. 大量的點更新與區間查詢（如區間最小值）",
        "C. 快速查詢兩個字串的最長公共子序列",
        "D. 實作先進先出（FIFO）的任務隊列"],
       "B", "DS", "樹", 4, 0.85,
       "Segment Tree：點更新 O(log n)，區間查詢 O(log n)。適合需要頻繁更新又需要範圍聚合（sum/min/max）的場景。純陣列的區間查詢 O(n)；Prefix Sum 查詢 O(1) 但更新 O(n)。"),

    mc("「Bellman-Ford」演算法最多執行幾輪鬆弛（Relaxation）才能確保找到所有最短路徑？",
       ["A. V 輪",
        "B. V - 1 輪",
        "C. E 輪",
        "D. log(V) 輪"],
       "B", "DS", "圖", 3, 0.80,
       "最短路徑最多經過 V-1 條邊（否則有環）。每輪鬆弛保證找到長度 ≤ 該輪數的最短路。V-1 輪後，若仍可鬆弛，代表存在負環。"),

    mc("以下哪種操作在「雙端佇列（Deque, Double-Ended Queue）」中效率為 O(1)？",
       ["A. 在中間插入元素",
        "B. 在頭部或尾部插入/刪除元素",
        "C. 以 index 隨機存取元素",
        "D. 搜尋特定值的元素"],
       "B", "DS", "堆疊佇列", 2, 0.65,
       "Deque 支援兩端 O(1) 的 push/pop（用 circular array 或 doubly linked list 實作）。中間插入 O(n)；Random Access 在 Linked List Deque 是 O(n)（Array Deque 是 O(1)）；Search O(n)。"),

    mc("以下關於「Union-Find（Disjoint Set Union）」的描述，何者最正確？",
       ["A. Path Compression 讓 find 操作達到嚴格的 O(1)",
        "B. Union by Rank 結合 Path Compression 讓各操作攤銷複雜度接近 O(1)",
        "C. Union-Find 可以高效支援「分割（Split）」操作",
        "D. Union-Find 的空間複雜度為 O(n²)"],
       "B", "DS", "集合", 4, 0.85,
       "Union by Rank + Path Compression：攤銷複雜度 O(α(n))（α 為反 Ackermann 函數，實作上視為常數）。Split 操作 Union-Find 不支援。空間 O(n)（每個元素一個 parent 指標）。"),
]

# ─── CS 20 題 ────────────────────────────────────────────────────────────────
CS_MC = [
    mc("在 TCP 三次握手中，第二次握手的封包類型是？",
       ["A. SYN",
        "B. ACK",
        "C. SYN-ACK",
        "D. FIN-ACK"],
       "C", "CS", "計算機網路", 2, 0.70,
       "三次握手：Client → SYN；Server → SYN-ACK（同時確認 SYN 並發出自己的 SYN）；Client → ACK。SYN-ACK 合併了兩個動作，這也是握手只需三次（而非四次）的原因。"),

    mc("以下關於「虛擬記憶體分頁機制（Paging）」的描述，哪一項是「錯誤」的？",
       ["A. 虛擬地址分為 Page Number 和 Offset 兩部分",
        "B. TLB 快取最近使用的頁表條目，加快地址轉換",
        "C. 分頁完全消除了記憶體碎片問題",
        "D. Page Fault 發生時作業系統從磁碟載入缺少的頁"],
       "C", "CS", "記憶體管理", 3, 0.75,
       "分頁消除了「外部碎片」（邏輯連續的空間不需要物理連續），但仍有「內部碎片」（最後一頁可能未完全使用）。"),

    mc("以下關於「死結（Deadlock）」的描述，哪個是 Coffman 四個必要條件之一？",
       ["A. 所有程序都在 Ready Queue 中等待",
        "B. 資源可以被強制搶佔（Preemption）",
        "C. 程序持有至少一個資源，同時等待其他被佔用的資源（Hold and Wait）",
        "D. 每個資源只能由一個程序以外的程序使用"],
       "C", "CS", "作業系統", 3, 0.80,
       "Coffman 四個必要條件：互斥（Mutual Exclusion）、持有並等待（Hold and Wait）、不可搶佔（No Preemption）、循環等待（Circular Wait）。四個都存在才可能發生死結。"),

    mc("以下哪種 CPU 排程演算法保證「最小平均等待時間」？",
       ["A. FCFS（First-Come, First-Served）",
        "B. Round-Robin（時間量 = 10ms）",
        "C. SJF（Shortest Job First, Non-preemptive）",
        "D. Priority Scheduling（靜態優先級）"],
       "C", "CS", "作業系統", 3, 0.80,
       "SJF 可以數學證明在所有 Non-preemptive 排程中最小化平均等待時間（Greedy 選擇性質）。缺點：需預知 Burst Time，長作業可能飢餓。"),

    mc("以下關於 HTTP/2 與 HTTP/1.1 的差異，何者正確？",
       ["A. HTTP/2 使用 UDP 而非 TCP",
        "B. HTTP/2 解決了 TCP 層的 Head-of-Line Blocking",
        "C. HTTP/2 支援同一 TCP 連線上的多路複用（Multiplexing）",
        "D. HTTP/2 放棄了 HTTPS 加密要求"],
       "C", "CS", "計算機網路", 3, 0.80,
       "HTTP/2：同一 TCP 連線上多個 Stream 交錯傳輸（Multiplexing），解決了「應用層」的 HOL Blocking。但 TCP 層的 HOL Blocking 仍存在（一個丟包阻塞所有 Stream）。HTTP/3（QUIC/UDP）才徹底解決 TCP 層 HOL。"),

    mc("以下哪個 SQL 語句可以找出「沒有訂單的客戶」？",
       ["A. SELECT * FROM customers INNER JOIN orders ON customers.id = orders.customer_id",
        "B. SELECT * FROM customers LEFT JOIN orders ON customers.id = orders.customer_id WHERE orders.id IS NULL",
        "C. SELECT * FROM customers WHERE customer_id IN (SELECT customer_id FROM orders)",
        "D. SELECT * FROM customers FULL OUTER JOIN orders ON customers.id = orders.customer_id"],
       "B", "CS", "資料庫", 3, 0.80,
       "LEFT JOIN 保留所有客戶，沒有對應訂單的客戶在 orders 欄位為 NULL。WHERE orders.id IS NULL 篩選出這些無訂單客戶。另法：NOT IN (subquery) 或 NOT EXISTS。"),

    mc("以下哪種記憶體快取映射方式的衝突（Conflict Miss）問題最嚴重？",
       ["A. 全關聯（Full Associative）",
        "B. 2-way Set Associative",
        "C. 4-way Set Associative",
        "D. 直接映射（Direct Mapped）"],
       "D", "CS", "計算機組織", 3, 0.75,
       "直接映射：每個主記憶體塊只能進固定的 Cache Line。若兩個塊映射到同一 Line，會互相驅逐（Thrashing）。全關聯：可進任何 Line，衝突最少，但比較電路成本最高。"),

    mc("以下關於「HTTPS/TLS 1.3 Handshake」的描述，何者正確？",
       ["A. TLS 1.3 需要 2-RTT 才能建立連線",
        "B. TLS 1.3 使用 RSA 進行 Key Exchange",
        "C. TLS 1.3 使用 ECDHE 達成 1-RTT 握手且支援 Perfect Forward Secrecy",
        "D. TLS 1.3 不需要伺服器憑證"],
       "C", "CS", "計算機網路", 4, 0.85,
       "TLS 1.3 改進：移除 RSA Key Exchange（改用 ECDHE，每次握手產生新 Key Pair → Perfect Forward Secrecy）；將 Handshake 壓縮為 1-RTT（0-RTT 用於 Session Resumption）。"),

    mc("以下哪種作業系統同步機制能避免「優先級反轉（Priority Inversion）」？",
       ["A. Mutex（標準互斥鎖）",
        "B. Binary Semaphore",
        "C. 優先級繼承協定（Priority Inheritance Protocol）",
        "D. Spinlock"],
       "C", "CS", "作業系統", 4, 0.80,
       "優先級反轉：低優先級任務持有鎖，導致高優先級任務等待。優先級繼承：持有鎖的低優先級任務臨時繼承等待者的高優先級，加速完成並釋放鎖。Mars Pathfinder 任務曾因此問題重置。"),

    mc("以下關於資料庫「MVCC（Multi-Version Concurrency Control）」的描述，何者正確？",
       ["A. MVCC 使用排他鎖（Exclusive Lock）來保證讀一致性",
        "B. MVCC 透過保存資料的舊版本，讓讀取不阻塞寫入",
        "C. MVCC 會導致更多的死結（Deadlock）",
        "D. MVCC 只在 SERIALIZABLE 隔離級別下使用"],
       "B", "CS", "資料庫", 4, 0.85,
       "MVCC：寫入時建立新版本，讀取時依時間戳找合適的舊版本，讀不需要鎖、不阻塞寫。PostgreSQL 和 MySQL InnoDB 都使用 MVCC。相對地，2PL（Two-Phase Locking）讀寫互相阻塞。"),

    mc("以下哪種場景說明了 CPU 流水線的「結構危害（Structural Hazard）」？",
       ["A. 一個指令的結果被下一個指令立刻使用",
        "B. 跳轉指令導致取出的指令需要被丟棄",
        "C. 指令記憶體和資料記憶體共用同一個讀取埠",
        "D. 外部中斷打斷了目前執行的指令"],
       "C", "CS", "計算機組織", 4, 0.80,
       "Structural Hazard：兩個指令同時需要同一個硬體資源。IF（取指）和 MEM（記憶體讀取）都需要存取記憶體，若共用一個 port 就衝突。解法：分離 Instruction Cache 和 Data Cache。"),

    mc("IPv4 位址 192.168.10.0/26 的廣播地址（Broadcast Address）是？",
       ["A. 192.168.10.63",
        "B. 192.168.10.127",
        "C. 192.168.10.31",
        "D. 192.168.10.255"],
       "A", "CS", "計算機網路", 3, 0.75,
       "/26 → 子網遮罩 255.255.255.192，主機位元 6 位 → 64 個位址（0-63）。網路地址：192.168.10.0，廣播地址：192.168.10.63（主機位全 1），可用主機：.1 ~ .62，共 62 個。"),

    mc("以下哪種方法可以解決 Docker 容器的「不可變基礎設施（Immutable Infrastructure）」原則與「需要持久化資料」的矛盾？",
       ["A. 直接在容器內部寫入檔案",
        "B. 使用 Docker Volume 將資料掛載到宿主機",
        "C. 每次重啟容器時從備份還原",
        "D. 增加容器的讀寫層大小"],
       "B", "CS", "系統設計", 3, 0.80,
       "Docker Volume：將宿主機目錄掛載進容器，容器刪除後資料仍保留。容器層（Writable Layer）隨容器消失，不適合持久資料（資料庫/日誌）。Volume 是 Docker 推薦的持久化方式。"),

    mc("以下關於「垃圾回收（Garbage Collection）中的引用計數（Reference Counting）」，哪項描述是「缺點」？",
       ["A. 物件可被即時釋放（不需等待 GC 週期）",
        "B. 無法偵測循環引用（Circular Reference）造成的記憶體洩漏",
        "C. 實作簡單，不需要追蹤所有可達物件",
        "D. 不會產生 Stop-the-World 的 GC 暫停"],
       "B", "CS", "軟體工程", 3, 0.80,
       "引用計數缺點：若 A 引用 B、B 引用 A，兩者計數永遠不為 0，即使無外部引用也無法釋放（循環引用洩漏）。Python 同時用引用計數 + 週期性循環 GC 來解決此問題。"),

    mc("以下哪個符合「REST API 無狀態（Stateless）」的設計原則？",
       ["A. 伺服器記錄每個用戶的 Session 狀態",
        "B. 每個請求都包含所有必要的認證資訊（如 JWT Token）",
        "C. API 使用 Cookie 來追蹤用戶的購物車",
        "D. 伺服器快取用戶的最後一次操作"],
       "B", "CS", "軟體工程", 3, 0.75,
       "REST Stateless：每個請求必須自帶所有必要資訊（認證 Token、參數），伺服器不保留 Session State。JWT 方式讓認證信息存在 Token 中隨請求發送，符合 Stateless 原則。"),

    mc("以下哪個選項正確描述了 Linux 的 epoll 相較於 select 的主要優勢？",
       ["A. epoll 支援比 select 更多的 socket 連線類型",
        "B. epoll 只返回就緒的 fd，避免了 O(n) 的線性掃描",
        "C. epoll 可以監控本地檔案的變更",
        "D. epoll 使用 UDP，延遲比 select 低"],
       "B", "CS", "作業系統", 4, 0.80,
       "select/poll 每次呼叫需線性掃描所有 fd（O(n)），高並發時極慢。epoll 維護 interest list（epoll_ctl 登記），只把就緒 fd 放入 ready list，每次呼叫 O(就緒數)，適合萬連線等級的高並發服務。"),

    mc("關於 CAP 定理，以下哪個描述最正確？",
       ["A. 分散式系統可以同時滿足 CAP 三個性質",
        "B. 網路分區不可避免時，系統必須在 Consistency 與 Availability 之間選擇",
        "C. CA 系統（放棄 P）是大多數雲端服務的選擇",
        "D. Eventual Consistency 等同於 CAP 中的 Consistency"],
       "B", "CS", "分散式系統", 4, 0.90,
       "P（Partition Tolerance）在分散式系統中幾乎不可放棄（網路故障難免），所以實際上選擇在 CP（ZooKeeper）或 AP（DynamoDB）之間取捨。Eventual Consistency 是 AP 系統的一種一致性模型，比 CAP 的強一致性寬鬆。"),

    mc("以下哪種 SQL 執行計畫優化策略可以加速 `SELECT * FROM orders WHERE status='pending' ORDER BY created_at`？",
       ["A. 在 customer_id 欄位建立索引",
        "B. 在 (status, created_at) 上建立複合索引",
        "C. 在 order_total 欄位建立索引",
        "D. 增加資料庫的最大連線數"],
       "B", "CS", "資料庫", 4, 0.85,
       "複合索引（status, created_at）：先用 status='pending' 縮小範圍（Index Seek），再利用 created_at 的已排序特性直接輸出（無需額外 Sort 操作）。索引前綴原則：查詢條件需符合索引的最左前綴。"),

    mc("以下關於 Docker 的 Union File System（OverlayFS）的描述，哪項正確？",
       ["A. 每個容器都有完全獨立的基礎映像副本",
        "B. 多個容器可共享相同的唯讀映像層，節省儲存空間",
        "C. 容器寫入的資料會直接修改底層唯讀層",
        "D. OverlayFS 需要每次啟動容器時重建所有層"],
       "B", "CS", "系統設計", 3, 0.80,
       "OverlayFS：映像層（唯讀）+ 容器層（可寫）疊加。多個容器共享同一唯讀層，只有修改時才 COW（Copy-on-Write）到各自的可寫層。100 個 nginx 容器可共享同一份 nginx 映像層。"),
]


def main():
    conn = init_db(DB_PATH)

    # Check duplicates
    existing = conn.execute(
        "SELECT COUNT(*) FROM questions WHERE question_type='multiple_choice'"
    ).fetchone()[0]
    if existing > 0:
        print(f"Already have {existing} MC questions. Skipping.")
        conn.close()
        return

    all_mc = MIS_MC + DS_MC + CS_MC
    inserted = 0
    for i, item in enumerate(all_mc, start=1):
        item["question_number"] = str(i)
        from pipeline.db.sqlite_loader import insert_question, insert_solution
        qid = insert_question(conn, item)
        for sol in item.get("solutions", []):
            insert_solution(conn, qid, sol)
        inserted += 1

    conn.commit()
    conn.close()
    print(f"Inserted {inserted} MC questions (MIS:{len(MIS_MC)} DS:{len(DS_MC)} CS:{len(CS_MC)})")


if __name__ == "__main__":
    main()
