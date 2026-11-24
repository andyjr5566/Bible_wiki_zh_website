#!/usr/bin/env bash
# 檢查：這次推送改了某個外掛的原始碼（plugins/<名稱>/src/），就必須一起提交重建後的 dist/。
# CI 直接使用版控裡的 dist/、不會自己編譯外掛，忘了重建時正式站會默默跑舊版。
#
# 為什麼不在 CI 重建再比對：tsup 壓縮後的變數命名在不同機器上會不同（功能相同、位元組不同），
# 逐位元組比對會一直誤報，所以只檢查「src 有改、dist 卻沒改」這個最常見的漏建情況。
#
# 用法：check-plugin-dist.sh <base-sha> <head-sha>
#   base 為空或全 0（新分支、手動觸發）時改比對 head 的上一個 commit。
#   測試用：設定 CHANGED_FILES（每行一個路徑）可略過 git diff。
# 修正方式：npm --prefix plugins/<名稱> run build，再把 plugins/<名稱>/dist 一起提交。
set -euo pipefail

base="${1:-}"
head="${2:-HEAD}"

if [[ -n "${CHANGED_FILES:-}" ]]; then
  changed="$CHANGED_FILES"
else
  if [[ -z "$base" || "$base" =~ ^0+$ ]] || ! git cat-file -e "$base^{commit}" 2>/dev/null; then
    base="$(git rev-parse "$head~1" 2>/dev/null || true)"
  fi
  if [[ -z "$base" ]]; then
    echo "找不到可比對的上一個 commit，略過檢查。"
    exit 0
  fi
  changed="$(git diff --name-only "$base" "$head")"
fi

missing=()
for plugin in $(printf '%s\n' "$changed" | sed -n 's#^plugins/\([^/]*\)/src/.*#\1#p' | sort -u); do
  # 沒有追蹤 dist/ 的外掛不適用
  if [[ -z "${CHANGED_FILES:-}" ]] && [[ -z "$(git ls-files "plugins/$plugin/dist" | head -n 1)" ]]; then
    continue
  fi
  if ! printf '%s\n' "$changed" | grep -q "^plugins/$plugin/dist/"; then
    missing+=("$plugin")
  fi
done

if (( ${#missing[@]} > 0 )); then
  for plugin in "${missing[@]}"; do
    echo "::error::plugins/$plugin/src 有變更，但 plugins/$plugin/dist 沒有一起更新。請執行 npm --prefix plugins/$plugin run build，並提交 dist/。"
  done
  exit 1
fi

echo "外掛 dist 檢查通過。"
