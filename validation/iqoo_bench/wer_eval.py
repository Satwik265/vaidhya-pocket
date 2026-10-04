#!/usr/bin/env python3
"""WER/CER per language. Pure python (no jiwer needed). No inputs -> NOT MEASURED."""
import csv, json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
MAN = os.path.join(HERE, "asr_clips", "manifest.csv")
HYP = os.path.join(HERE, "asr_clips", "hypotheses.json")
OUT = os.path.join(HERE, "out", "asr.json")

def norm(s): return re.sub(r"\s+", " ", re.sub(r"[^\w\s]", " ", s.lower())).strip()

def edit(a, b):
    prev = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        cur = [i]
        for j, y in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x != y)))
        prev = cur
    return prev[-1]

def main():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    if not (os.path.exists(MAN) and os.path.exists(HYP)):
        json.dump({"status": "NOT MEASURED", "reason": "manifest.csv or hypotheses.json missing"}, open(OUT, "w"), indent=2)
        print("ASR: NOT MEASURED"); return
    hyp = json.load(open(HYP, encoding="utf-8"))
    per = {}
    with open(MAN, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row["file"] not in hyp: continue
            ref, h = norm(row["reference"]), norm(hyp[row["file"]])
            d = per.setdefault(row["lang"], {"we": 0, "wn": 0, "ce": 0, "cn": 0, "clips": 0})
            d["we"] += edit(ref.split(), h.split()); d["wn"] += max(1, len(ref.split()))
            d["ce"] += edit(list(ref), list(h)); d["cn"] += max(1, len(ref)); d["clips"] += 1
    if not per:
        json.dump({"status": "NOT MEASURED", "reason": "no clips matched"}, open(OUT, "w"), indent=2); print("ASR: NOT MEASURED"); return
    res = {k: {"clips": v["clips"], "WER": round(v["we"] / v["wn"], 4), "CER": round(v["ce"] / v["cn"], 4)} for k, v in per.items()}
    json.dump({"status": "MEASURED", "per_language": res}, open(OUT, "w"), indent=2, ensure_ascii=False)
    print("ASR:", res)

if __name__ == "__main__":
    main()
