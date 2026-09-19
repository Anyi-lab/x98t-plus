#!/usr/bin/env bash
# 发版：递增版本号 → 校验 → 生成 meta → 提交 + 打 tag
# 用法：bash scripts/release.sh patch   （或 minor / major / 4.12.0）
set -e
cd "$(dirname "$0")/.."

BUMP="${1:-patch}"
node scripts/bump.js "$BUMP"
node scripts/verify.js

VER=$(grep -m1 '^// @version' x98t-plus.user.js | awk '{print $3}')
git add -A
git commit -q -m "release: $VER" || echo "（无改动可提交）"
git tag -f "v$VER" >/dev/null
echo
echo "已发版 v$VER（tag v$VER）"
echo "推送：git push && git push --tags"
