#!/usr/bin/env bash
# 生成差异补丁：git diff <起点> -- x98t-plus.user.js > patches/<名字>.patch
# 用法：
#   bash scripts/make-patch.sh                 # 相对上一个 tag 到当前
#   bash scripts/make-patch.sh <commit> <名字>
set -e
cd "$(dirname "$0")/.."
mkdir -p patches

BASE="${1:-$(git describe --tags --abbrev=0 2>/dev/null || git rev-list --max-parents=0 HEAD)}"
NAME="${2:-$(date +%Y%m%d-%H%M)}"

OUT="patches/${NAME}.patch"
git diff "$BASE" -- x98t-plus.user.js > "$OUT"
echo "已生成 $OUT （起点 $BASE）"
wc -l "$OUT"
