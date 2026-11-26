#!/usr/bin/env bash
# 準備 Quartz 外掛（deploy.yml 與 smoke.yml 共用，只在 CI 上執行）。
# 新增或移除本地外掛時只改這支：LOCAL_PLUGINS 清單，以及需要套用 dist 的 PATCHED_PLUGINS。
# 不要在本機跑：本機的 .quartz/plugins/<本地外掛> 是指向 plugins/<名稱> 的 junction，rm -rf 會把它換成複本。
set -euo pipefail

# 整個資料夾複製進 .quartz/plugins 的本地外掛（dist/ 已進版控，CI 不用建置）。
# node_modules 在本機是 junction，CI 用根目錄安裝的依賴，所以複製後拿掉。
LOCAL_PLUGINS=(wiki-tour semantic-search personal-notes read-aloud explorer site-ux book-picker home-hub verse-return)
# 用社群版安裝、再把 plugins/<名稱>/dist 蓋上去的外掛（config 裡是 github: 來源）
PATCHED_PLUGINS=(graph)

mkdir -p .quartz/plugins
for name in "${LOCAL_PLUGINS[@]}" "${PATCHED_PLUGINS[@]}"; do
  rm -rf ".quartz/plugins/$name"
done
for name in "${LOCAL_PLUGINS[@]}"; do
  cp -r "plugins/$name" ".quartz/plugins/$name"
  rm -rf ".quartz/plugins/$name/node_modules"
done

# 會改變頁面 HTML 結構的社群外掛，鎖在 quartz.lock.json 的版本（PINNED_PLUGINS）。
# 原因：--from-config 會抓上游最新版；2026-11-26 上游 obsidian-flavored-markdown 改成每個區塊包 div.el-*、
# 標題插摺疊箭頭，正式站跟本機產出的 HTML 不同，創1、創2 的分層呈現整頁失效。
# 不用 quartz 的 lockfile 安裝：它 clone --depth 1 後 checkout 舊 commit，舊 commit 不在淺層 clone 裡會失敗。
# 要升級這些外掛：本機 npx quartz plugin update、確認 test_content 建置與 e2e 都過，再提交 quartz.lock.json。
PINNED_PLUGINS=(obsidian-flavored-markdown)
cp quartz.lock.json /tmp/quartz.lock.pinned.json
npx quartz plugin install --from-config
cp /tmp/quartz.lock.pinned.json quartz.lock.json

for name in "${PINNED_PLUGINS[@]}"; do
  dir=".quartz/plugins/$name"
  commit=$(node -e "console.log(require('/tmp/quartz.lock.pinned.json').plugins['$name'].commit)")
  head=$(git -C "$dir" rev-parse HEAD)
  if [ "$head" != "$commit" ]; then
    echo "→ $name: ${head:0:7} → 鎖定版 ${commit:0:7}"
    git -C "$dir" fetch -q --depth 1 origin "$commit"
    git -C "$dir" checkout -q "$commit"
    (cd "$dir" && npm install --ignore-scripts --no-audit --no-fund && npm run build && npm prune --omit=dev)
  fi
done

for name in "${PATCHED_PLUGINS[@]}"; do
  mkdir -p ".quartz/plugins/$name/dist"
  cp -r "plugins/$name/dist/"* ".quartz/plugins/$name/dist/"
done
