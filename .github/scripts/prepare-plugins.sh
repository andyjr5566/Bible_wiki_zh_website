#!/usr/bin/env bash
# 準備 Quartz 外掛（deploy.yml 與 smoke.yml 共用，只在 CI 上執行）。
# 新增或移除本地外掛時只改這支：LOCAL_PLUGINS 清單，以及需要套用 dist 的 PATCHED_PLUGINS。
# 不要在本機跑：本機的 .quartz/plugins/<本地外掛> 是指向 plugins/<名稱> 的 junction，rm -rf 會把它換成複本。
set -euo pipefail

# 整個資料夾複製進 .quartz/plugins 的本地外掛（dist/ 已進版控，CI 不用建置）。
# node_modules 在本機是 junction，CI 用根目錄安裝的依賴，所以複製後拿掉。
LOCAL_PLUGINS=(wiki-tour semantic-search personal-notes read-aloud explorer site-ux book-picker home-hub)
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

npx quartz plugin install --from-config

for name in "${PATCHED_PLUGINS[@]}"; do
  mkdir -p ".quartz/plugins/$name/dist"
  cp -r "plugins/$name/dist/"* ".quartz/plugins/$name/dist/"
done
