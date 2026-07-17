# -*- coding: utf-8 -*-
"""Clean bad rows + assign reviewed multi-concept tags to every question.

- Deletes ids 143-154: NCCU institutional-repository copyright boilerplate that
  the PDF extractor mistook for exam questions (they are not questions).
- Fixes ids 167/174: DS content mislabelled as topic MIS.
- Normalizes subtopic '計算複雜度' -> '複雜度'.
- Sets questions.concepts to a hand-reviewed JSON array (1-3 tags per question),
  drawn from the same vocabulary as subtopic so filters stay consistent.

Idempotent: safe to re-run.
"""
import json
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parents[2] / "data" / "questions.db"

GARBAGE_IDS = list(range(143, 155))

TOPIC_FIXES = {
    167: ("DS", "複雜度"),
    174: ("DS", "圖"),
}

CONCEPTS = {
    # --- MIS essays 1-54 ---
    1: ["ERP"], 2: ["ERP", "IT專案管理"], 3: ["ERP"],
    4: ["CRM"], 5: ["CRM", "BI"], 6: ["CRM", "BI"],
    7: ["SCM"], 8: ["SCM"], 9: ["SCM", "新興技術"],
    10: ["IT治理"], 11: ["IT治理"],
    12: ["資訊安全"], 13: ["資訊安全", "資料庫"], 14: ["資訊安全", "計算機網路"],
    15: ["資訊安全"], 16: ["資訊安全"],
    17: ["電子商務"], 18: ["電子商務"], 19: ["電子商務", "策略MIS"], 20: ["電子商務"],
    21: ["BI", "資料庫"], 22: ["BI"], 23: ["BI"], 24: ["BI", "IT治理"],
    25: ["知識管理"], 26: ["知識管理"], 27: ["知識管理"],
    28: ["數位轉型"], 29: ["數位轉型"], 30: ["數位轉型", "IT治理"], 31: ["數位轉型", "策略MIS"],
    32: ["雲端"], 33: ["雲端", "資訊安全"], 34: ["雲端"], 35: ["雲端", "系統設計"],
    36: ["DSS", "BI"], 37: ["DSS", "新興技術"], 38: ["DSS"],
    39: ["策略MIS"], 40: ["策略MIS"], 41: ["策略MIS", "數位轉型"],
    42: ["SDLC"], 43: ["SDLC"], 44: ["SDLC"],
    45: ["IT專案管理"], 46: ["IT專案管理", "SDLC"],
    47: ["系統整合"],
    48: ["新興技術", "雲端"], 49: ["新興技術", "DSS"],
    50: ["策略MIS", "IT治理"], 51: ["IT治理"], 52: ["SDLC"],
    53: ["新興技術", "SCM"], 54: ["策略MIS"],
    # --- DS essays 55-100 ---
    55: ["陣列", "複雜度"], 56: ["陣列"],
    57: ["鏈結串列"], 58: ["鏈結串列"], 59: ["鏈結串列"], 60: ["鏈結串列"],
    61: ["堆疊佇列"], 62: ["堆疊佇列"], 63: ["堆疊佇列", "堆積"], 64: ["堆疊佇列"],
    65: ["樹"], 66: ["AVL樹", "樹"], 67: ["樹"], 68: ["B樹", "資料庫"],
    69: ["樹"], 70: ["樹", "字串"],
    71: ["排序", "堆積"], 72: ["堆積"],
    73: ["圖"], 74: ["圖"], 75: ["圖"], 76: ["圖", "動態規劃"], 77: ["圖"], 78: ["圖"],
    79: ["排序"], 80: ["排序"], 81: ["排序"], 82: ["排序"], 83: ["排序"],
    84: ["雜湊"], 85: ["雜湊", "分散式系統"], 86: ["雜湊"],
    87: ["複雜度"], 88: ["複雜度"],
    89: ["綜合設計", "雜湊", "鏈結串列"],
    90: ["字串"], 91: ["樹"], 92: ["動態規劃"], 93: ["圖"], 94: ["集合"],
    95: ["搜尋"], 96: ["動態規劃", "字串"], 97: ["演算法設計", "貪婪"],
    98: ["鏈結串列"], 99: ["貪婪", "樹"], 100: ["複雜度"],
    # --- CS essays 101-142 ---
    101: ["計算機組織"], 102: ["計算機組織"], 103: ["計算機組織"],
    104: ["記憶體管理", "作業系統"], 105: ["記憶體管理", "作業系統"],
    106: ["記憶體管理", "作業系統"], 107: ["記憶體管理", "計算機組織"],
    108: ["作業系統"], 109: ["作業系統"], 110: ["作業系統"], 111: ["作業系統"],
    112: ["作業系統"], 113: ["作業系統"], 114: ["作業系統"],
    115: ["計算機網路"], 116: ["計算機網路"], 117: ["計算機網路"],
    118: ["計算機網路"], 119: ["計算機網路"], 120: ["計算機網路"],
    121: ["資料庫"], 122: ["資料庫"], 123: ["資料庫"], 124: ["資料庫"], 125: ["資料庫"],
    126: ["軟體工程"], 127: ["軟體工程"], 128: ["軟體工程"],
    129: ["數字系統"], 130: ["數字系統"], 131: ["數字系統"],
    132: ["編譯器"], 133: ["編譯器"], 134: ["軟體工程"],
    135: ["作業系統", "記憶體管理"], 136: ["作業系統"], 137: ["作業系統"], 138: ["作業系統"],
    139: ["計算機網路", "資訊安全"],
    140: ["分散式系統"], 141: ["分散式系統"],
    142: ["系統設計", "雲端"],
    # --- MC 155-213 ---
    155: ["SCM"], 156: ["ERP"], 157: ["資訊安全"], 158: ["雲端"], 159: ["策略MIS"],
    160: ["BI", "資料庫"], 161: ["CRM"], 162: ["資訊安全"], 163: ["知識管理"],
    164: ["數位轉型"], 165: ["BI", "IT治理"], 166: ["電子商務"],
    167: ["複雜度", "陣列"], 168: ["數位轉型"], 169: ["策略MIS"],
    170: ["資訊安全", "IT治理"], 171: ["SDLC"], 172: ["IT治理"],
    173: ["SDLC", "系統設計"], 174: ["圖"],
    175: ["排序"], 176: ["AVL樹", "樹"], 177: ["堆積"], 178: ["圖"], 179: ["雜湊"],
    180: ["動態規劃"], 181: ["排序"], 182: ["圖"], 183: ["綜合設計", "雜湊", "鏈結串列"],
    184: ["複雜度"], 185: ["雜湊"], 186: ["B樹", "資料庫"], 187: ["排序"], 188: ["圖"],
    189: ["複雜度"], 190: ["樹", "字串"], 191: ["樹"], 192: ["圖"], 193: ["堆疊佇列"],
    194: ["集合"],
    195: ["計算機網路"], 196: ["記憶體管理", "作業系統"], 197: ["作業系統"],
    198: ["作業系統"], 199: ["計算機網路"], 200: ["資料庫"],
    201: ["記憶體管理", "計算機組織"], 202: ["計算機網路", "資訊安全"],
    203: ["作業系統"], 204: ["資料庫"], 205: ["計算機組織"], 206: ["計算機網路"],
    207: ["系統設計", "雲端"], 208: ["軟體工程"], 209: ["軟體工程"], 210: ["作業系統"],
    211: ["分散式系統"], 212: ["資料庫"], 213: ["系統設計", "雲端"],
}


def main() -> None:
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    placeholders = ",".join("?" * len(GARBAGE_IDS))
    cur.execute(f"DELETE FROM user_attempts WHERE question_id IN ({placeholders})", GARBAGE_IDS)
    cur.execute(f"DELETE FROM user_question_states WHERE question_id IN ({placeholders})", GARBAGE_IDS)
    cur.execute(f"DELETE FROM solutions WHERE question_id IN ({placeholders})", GARBAGE_IDS)
    deleted = cur.execute(
        f"DELETE FROM questions WHERE id IN ({placeholders})", GARBAGE_IDS
    ).rowcount

    for qid, (topic, subtopic) in TOPIC_FIXES.items():
        cur.execute("UPDATE questions SET topic = ?, subtopic = ? WHERE id = ?", (topic, subtopic, qid))

    cur.execute("UPDATE questions SET subtopic = '複雜度' WHERE subtopic = '計算複雜度'")

    tagged = 0
    for qid, tags in CONCEPTS.items():
        tagged += cur.execute(
            "UPDATE questions SET concepts = ? WHERE id = ?",
            (json.dumps(tags, ensure_ascii=False), qid),
        ).rowcount

    conn.commit()

    total = cur.execute("SELECT count(*) FROM questions").fetchone()[0]
    untagged = cur.execute("SELECT count(*) FROM questions WHERE concepts IS NULL").fetchone()[0]
    n_concepts = cur.execute(
        "SELECT count(DISTINCT j.value) FROM questions q, json_each(q.concepts) j"
    ).fetchone()[0]
    print(f"deleted garbage rows: {deleted}")
    print(f"tagged: {tagged}, total questions: {total}, untagged: {untagged}")
    print(f"distinct concepts: {n_concepts}")
    conn.close()


if __name__ == "__main__":
    main()
