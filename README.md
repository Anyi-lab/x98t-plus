# x98t-plus（98堂脚本 · 自维护版）

「X大哥4.10版+收藏夹」的个人自维护分支。**已断开官方/sleazyfork 更新源**，不会再被整份覆盖；
改动全部走本地 git，上游出新版时用补丁方式合并（只审差异）。

## 目录

| 路径 | 作用 |
|---|---|
| `x98t-plus.user.js` | **唯一源文件**，也是 Tampermonkey 要安装的那份 |
| `x98t-plus.meta.js` | 头部元数据（由 `gen-meta.js` 生成，供 TM 检查更新用） |
| `scripts/verify.js` | 校验：语法 + 更新源已断开 + 历次改动是否还在 + 版本号一致性 |
| `scripts/bump.js` | 版本号递增（同步改 `@version` 和代码里的 `scriptVer`） |
| `scripts/gen-meta.js` | 从源文件头部重新生成 `.meta.js` |
| `scripts/set-github.js` | 把自己的 GitHub raw 地址写进更新源（或 `--off` 再断开） |
| `scripts/release.sh` | 发版：bump → 校验 → 生成 meta → commit + tag |
| `scripts/make-patch.sh` | 生成两个版本之间的差异补丁，存到 `patches/` |
| `patches/` | 历史改动补丁（用于把改动重新打到新上游上） |

## 重要事实：Tampermonkey 没有增量更新

TM 只在 `@version` 变大时**整份重新下载覆盖**，不存在「只传差异」。
所以「差异化」体现在工作流上：改动用 git 管成补丁，上游更新时把你的补丁重新打一遍，只审这点差异。

## 日常流程（改功能）

```bash
cd /mnt/d/Desktop/色花堂脚本/98t-userscript
# 1. 改 x98t-plus.user.js
node scripts/verify.js          # 语法 + 回归断言
bash scripts/release.sh patch   # 递增版本号 + 校验 + 提交 + 打 tag
git push && git push --tags     # 推到自己仓库（如已配置更新源）
```

然后在 Tampermonkey 里**编辑现有脚本、全选粘贴新内容**（不要新装，否则两个脚本会同时生效）。

## 首次配置自建更新源（可选）

```bash
node scripts/set-github.js https://raw.githubusercontent.com/<用户名>/<仓库>/main
git add -A && git commit -m "chore: 指向自建更新源" && git push
```

之后 TM 每天检查一次；有新版会弹出「自维护版有新版本」对话框并跳到你的 raw 地址。
想再断开：`node scripts/set-github.js --off`。

> 注意：raw.githubusercontent.com 在国内可能需要代理，否则 TM 检查更新会失败（不影响脚本本身运行）。

## 合并上游新版（差异化流程）

1. 拿到上游新版（覆盖 `upstream/` 下的对照文件）。
2. `git diff <上次上游版本> <新上游版本> -- <文件>` 看上游改了什么。
3. 把新版作为新基线提交，再把 `patches/` 里我们的补丁依次 `git apply`。
4. `node scripts/verify.js` 确认我们的改动都还在。
5. `bash scripts/release.sh minor` 发版。

## 历史快照（已提交进 git）

| 提交 | 对应文件 |
|---|---|
| 4.11.0 基线 | `../old/X大哥4.10版+收藏夹-4.11.0.bak.txt` |
| 09-03 排序改动前 | `../old/…bak2-排序前.txt` |
| 排序默认设为 native | `../old/…bak3-默认排序改发布时间前.txt` |
| 4.11.1 默认改发布时间 | `../X大哥…bak4-空间帖子列表图片预览前.txt` |
| 4.11.2 空间页图片预览修复 | `../X大哥4.10版+收藏夹-4.11.0.txt` |
