"""R24 文件回執與定向完整性檢查；不修改應用程式。"""
from pathlib import Path
import json
import re
from datetime import datetime, timezone

qa = Path(__file__).resolve().parent
site = qa.parents[2]
docs = [qa/'FINAL_REPORT.md', qa/'R24_REWORK.md', site/'docs/planning/REVAMP_PROGRESS.md']
replacements = {'核对':'核對','没有':'沒有','本轮':'本輪','可点':'可點','證据':'證據','来源':'來源'}
for p in docs + [qa/'r24-static-audit.py']:
    text = p.read_text(encoding='utf-8')
    for before, after in replacements.items():
        text = text.replace(before, after)
    p.write_text(text,encoding='utf-8')

progress = docs[2]
text = progress.read_text(encoding='utf-8')
if '## R24 執行回執' not in text:
    text += '''

## R24 執行回執

任務 ID／日期：R24／2026-09-10（Asia/Taipei）。執行模型：GPT-6 Astra 驗收代理；沒有新增 Luna 子代理工作。
開始基準：`685da044`，`feat/appendix-exodus25-revamp`。本輪只新增／更新 QA 文件、工具、回執與截圖；保留六個既有 `.blend1`，沒有修改正式經文、raw_data、production、網站程式或 Blender。derived 驗證的 generatedAt 變動已還原。
已讀：LUNA_START、REVAMP_MASTER／TASKS／ACCEPTANCE／PROGRESS、R23 FINAL_REPORT 與 receipts、研究／程序／角色／服飾契約、具名實作、正式來源經文；沒有新增內容 claim。
命令：`npm run build` exit 0（21檔65測試、104 modules、17 assets）；`npm run verify:derived` exit 0；經文抽取與 `r24-static-audit.py` exit 0。來源臺帳27筆錯配0、引文9段一致、17資產來源與衍生／dist一致。日誌位於 `docs/qa/revamp/r24-*.log`。
Browser：production dist、中文巢狀重載、六器物 ready、五站、來源覆層 Escape 焦點、六程序與贖罪日14步文字、手機 drawer、真 HTTP500／恢復。15筆成功模型回應 hash 與 dist 相符；此數字不代表15次完整驗收。臨時 localhost:4179 測試伺服器已停止，viewport override 已清除。
結論：NEEDS_CHANGES；完整 QA 為 FAIL 8、UNVERIFIED 10。P0-01 修正來源語意，P1-02～08 處理角色場景、五祭、模式還原、部件／取景、來源入口、故障可及性與量測／重建。詳見 FINAL_REPORT、R24_REWORK；R00–R23 自驗保留歷史，不代表總控核准。
未決／限制：U-R24-01 壇識別 unresolved；完整 activeAssetIds／camera、受控網路競態、WebGL故障、reduced-motion、全鍵盤200%、效能長測、真手機GPU、乾淨Blender全鏈與真人新讀者未驗證。部分原始截圖落後 DOM，已明確排除其狀態證明效力。
提交／push：以本輪收尾回執記錄實際命令結果，不預填成功。下一步依 P0/P1 卡安排已授權 Luna 修正，再由總控復驗；整站未發布。
'''
    progress.write_text(text,encoding='utf-8')

missing = []
for p in docs:
    for target in re.findall(r'\]\(([^)]+)\)',p.read_text(encoding='utf-8')):
        if '://' in target or target.startswith('#'):
            continue
        if not (p.parent / target.split('#')[0]).exists():
            missing.append({'file':str(p.relative_to(site)),'target':target})
parsed = []
for p in qa.iterdir():
    if p.name.startswith('r24-') and p.suffix == '.json':
        json.loads(p.read_text(encoding='utf-8-sig'))
        parsed.append(p.name)
    if p.name.startswith('r24-') and p.suffix == '.py':
        compile(p.read_text(encoding='utf-8'),str(p),'exec')
report = {'generatedAt':datetime.now(timezone.utc).isoformat(),'missingLocalLinks':missing,'jsonParsed':parsed,'pythonSyntax':'PASS','verdict':'NEEDS_CHANGES','qaCounts':{'FAIL':8,'UNVERIFIED':10,'PASS':0},'delivery':'提交與 push 結果另記 r24-handoff.json'}
(qa/'r24-document-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'missingLocalLinks':len(missing),'jsonParsed':len(parsed),'pythonSyntax':'PASS'},ensure_ascii=False))
assert not missing, missing
