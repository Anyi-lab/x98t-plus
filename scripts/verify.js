#!/usr/bin/env node
/**
 * 校验 x98t-plus.user.js：
 *   1. 语法能被 JS 引擎解析
 *   2. 更新源已断开（无 @updateURL/@downloadURL、无 sleazyfork 可执行引用）
 *   3. 历次改动仍在位（板块默认排序=发布时间、一次性迁移、空间页图片预览）
 *   4. @version 与代码里的 scriptVer 一致，且与 meta.js 一致
 * 用法：node scripts/verify.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SCRIPT = path.join(ROOT, "x98t-plus.user.js");
const META = path.join(ROOT, "x98t-plus.meta.js");
const code = fs.readFileSync(SCRIPT, "utf8");

let pass = 0, fail = 0;
const t = (name, cond, got) => {
  if (cond) { pass++; console.log("PASS " + name); }
  else { fail++; console.log("FAIL " + name + (got === undefined ? "" : " got=" + JSON.stringify(String(got).slice(0, 140)))); }
};

// 1) 语法
try { new Function(code); console.log("SYNTAX_OK"); }
catch (e) { console.log("SYNTAX_FAIL " + e.message); process.exit(1); }

// 2) 更新源
t("头部更新源不含 sleazyfork", !/^\/\/\s*@(update|download)URL\s+\S*sleazyfork/mi.test(code));
t("代码里无写死的 sleazyfork 地址", !/["'`]https?:\/\/[^"'`]*sleazyfork/i.test(code));
const hasUpdate = /^\/\/\s*@updateURL/m.test(code);
const hasDownload = /^\/\/\s*@downloadURL/m.test(code);
t("@updateURL/@downloadURL 成对出现或都不出现", hasUpdate === hasDownload, { hasUpdate, hasDownload });
t("内建开关 SELF_UPDATE_META_URL 存在", /const SELF_UPDATE_META_URL = "[^"]*";/.test(code));
t("未配置自建源时不发请求", /if \(!SELF_UPDATE_META_URL\) \{[\s\S]{0,160}?return;/.test(code));

// 3) 板块默认排序（4.11.x）
t("getSettings 默认 dateline", /GM_getValue\("forumDefaultSort", "dateline"\)/.test(code));
t("归一化兜底 dateline", /\["native", "dateline", "lastpost"\]\.includes\(savedForumSort\)[\s\S]{0,120}?"dateline";/.test(code));
t("applyForumDefaultSort 默认 dateline", /var preferred = GM_getValue\("forumDefaultSort", "dateline"\)/.test(code));
t("createSortButton 如实反映原生 lastpost", /let currentOrder = 'lastpost'/.test(code));
t("preserveCurrentSort 兜底 dateline", /var fallbackOrder = GM_getValue\("forumDefaultSort", "dateline"\)/.test(code));
t("一次性迁移块存在", /bgshForumSortMigratedToDateline/.test(code));
t("resetSettings dateline", /forumDefaultSort: "dateline"/.test(code));
t("saveSettings dateline", /name="settingsForumSort"\]\s*:checked'\)\?\.value\s*\|\|\s*'dateline'/.test(code));
t("面板标注「网站默认（回复时间）」", code.includes("网站默认（回复时间）"));

// 4) 空间帖子列表图片预览（4.11.2）
t("isSpaceThreadPage 存在", /function isSpaceThreadPage\(url\)/.test(code));
t("空间页判定按 URL 参数", /const isSpacePage = \(\) => isSpaceThreadPage\(window\.location\.href\);/.test(code));
t("空间页翻页后补图", /isMySpacePage" \|\| pageName == "isSpacePage"\) \{[\s\S]{0,220}?displayAdvanThreadImages\(settings\);/.test(code));

t("toast：正文重复 emoji 会被剥掉", /lead\[1\] === autoIcon/.test(code) && /showAutoIcon = false/.test(code));
t("合并下载：复制标题按钮", /bgshCopyThreadTitleButton/.test(code));
t("合并下载：仅附件默认不挂载", /if \(window\.__bgshShowAttachButton\)/.test(code));

t("预览：只认标题链接 a.xst", /!a\.classList\.contains\("xst"\)/.test(code));
t("预览：父级优先 tbody#normalthread_", /tbody\[id\^="normalthread_"\], tbody\[id\^="stickthread_"\]'\)/.test(code));
t("预览：找不到链接时给提示", /__bgshPreviewWarned/.test(code));

t("预览：安全确认页感知 fetch", /async function fetchThreadPageHTML/.test(code) && /var safeid='\(\[\^'\]\+\)'/.test(code));
t("预览：空结果不写缓存", /if \(result\.length\) \{\s*\n\s*gmc\[tid\]/.test(code));
t("预览：tbody 不再承载 div", /hostRow\.appendChild\(previewTR\)/.test(code));
t("预览：清理空预览行", /function dropEmptyPreviewRow/.test(code));
t("预览：xst 让位逻辑未写反", /if \(row && row\.querySelector\("a\.xst"\)\) return;/.test(code));
t("预览：重建菜单", /重建图片预览/.test(code));

t("路由：mod=guide 不带 view 也算导读页", /function isGuideListPage/.test(code));
t("路由：delegatePageHandlers 已改用 isGuideListPage", /const isMySpacePage = \(\) => isGuideListPage/.test(code));
t("预览：tr 挂进 tbody 内部", /hostRow\.appendChild\(previewTR\)/.test(code));

t("分类：typeid 唯一性守卫", /var seenTypeIds = \{\}/.test(code));
t("分类：剥离计数节点的取名助手", /function typeNameFromAnchor/.test(code));
t("分类：丢弃纯数字名", /if \(\/\^\\d\+\$\/\.test\(name\)\) return false;/.test(code));
t("分类：原生栏链接不重复入库", /a\.closest\('#thread_types, ul\.ttp'\)/.test(code));

t("分类：移除「原生栏够用就不渲染」的守卫", !/var nativeItems = nativeTypeNav\.querySelectorAll/.test(code) && !/__bgshForceTypeFilter/.test(code));

t("域名：不再对 *://*/* 生效", !/^\/\/ @match\s+\*:\/\/\*\/\*\s*$/m.test(code));
t("域名：至少两条站点 @match", (code.match(/^\/\/ @match\s+\*:\/\/\*\./gm) || []).length >= 2);
t("域名：有 @include 家族正则", /^\/\/ @include\s+\/\^https/m.test(code));
t("域名：运行时 isSiteHost 兜底", /function isSiteHost/.test(code) && /if \(!isSiteHost\(\)\) return;/.test(code));

t("分类：URL 参数级重建（不再正则删整串）", /function stripTypeParams/.test(code) && /function buildTypeHref/.test(code));
t("分类：不再用 =\\d* 的老删参正则", !/\(typeid\|filter\|page\)=\\d\*/.test(code.replace(/\/\/.*$/gm, "")));
t("翻页：空值参数不复制到链接上", /if \(value !== null && value !== ""\) target\.searchParams\.set/.test(code));

// 4.15.1 复查修复
t("翻页：走带安全页重试的 fetchPageHTML", /async function fetchPageHTML/.test(code) && /const html = await fetchPageHTML\(url, \{ signal/.test(code));
const loadNextSrc = (() => {
  const a = code.indexOf("async function loadNextPage(");
  const b = code.indexOf("function checkAndLoad(", a);
  return a >= 0 && b > a ? code.slice(a, b) : "";
})();
t("翻页：loadNextPage 里没有裸 fetch", loadNextSrc.length > 0 && loadNextSrc.indexOf("await fetch(") === -1 && loadNextSrc.indexOf("fetchPageHTML(") > -1);
const favAuthorSrc = (() => {
  const a = code.indexOf("async function fillMissingAuthors(");
  const b = code.indexOf("var worker = async function()", a);
  return a >= 0 && b > a ? code.slice(a, b) : "";
})();
t("收藏补作者：同样走 fetchPageHTML", favAuthorSrc.length > 0 && favAuthorSrc.indexOf("fetchPageHTML(") > -1 && favAuthorSrc.indexOf("await fetch(") === -1);
t("预览：fetchThreadPageHTML 复用 fetchPageHTML", /return fetchPageHTML\(href, \{ signal: AbortSignal\.timeout\(9000\) \}\)/.test(code));
t("提示条：正文改用 textContent（不再拼 innerHTML）", /querySelector\('\.bgsh-toast-message'\)\.textContent = bodyMessage/.test(code) && code.indexOf('bgsh-toast-message">${bodyMessage}') === -1);
t("弹窗：没有裸 showWindow 调用", !/(^|[^.\w])showWindow\(/m.test(code.replace(/\/\/.*$/gm, "")));
t("弹窗：openSiteWindow 兜底存在", /function openSiteWindow/.test(code) && code.indexOf('typeof pageWin.showWindow === "function"') > -1);
t("最佳答案：setanswer 有 typeof 守卫", code.indexOf('typeof setanswer === "function"') > -1);
t("分类：addType 统一剥方括号", code.indexOf("/^[\\s\\[【]+|[\\s\\]】]+$/g") > -1);
t("分类：typeid=0 不入库（0 即「全部」）", code.indexOf("if (typeid && String(typeid) === '0') return false;") > -1);
t("分类：取名字不再无差别删 span/em", code.indexOf("'.xg1, .num, .xi1, em, span'") === -1 && code.indexOf("if (/^\\s*\\d+\\s*$/.test(n.textContent || '')) n.remove();") > -1);
t("分类：无 typeid 的名字不渲染成按钮", code.indexOf("return !!typeMap[name].typeid;") > -1);
t("分类：路径式分页归回第 1 页", code.indexOf("/^(\\/forum-\\d+-)\\d+(\\.html)$/") > -1);
t("清理：无未使用的 baseUrl / allTypeLinks", code.indexOf("var baseUrl") === -1 && code.indexOf("allTypeLinks") === -1);
t("清理：预览父节点变量不再重复声明", code.indexOf("myPreviewCell") > -1 && code.indexOf("var previewCell = document.createElement('td');\n                var firstRow") === -1);

// 4.15.2 收藏目录（分类）不再凭空消失
t("收藏：uid 只认自己（无 space-uid-* 兜底进强来源）", !/const userLink = [^;]*a\[href\*='space-uid-'\][^;]*;/.test(code));
t("收藏：弱来源 uid 不写回缓存", /if \(cachedUid\) return String\(cachedUid\);/.test(code) && !/if \(urlUid\) \{ GM_setValue\("bgsh_uid", urlUid\); return urlUid; \}/.test(code));
t("收藏：条目里用到的目录会补回列表（不降级）", /else if \(!folders\.includes\(data\.folder\)\) \{ folders\.push\(data\.folder\); folderRestored = true; \}/.test(code));
t("收藏：loadFavoriteData 以条目补齐目录", /Object\.keys\(favCache\)\.forEach\(function \(k2\) \{[\s\S]{0,160}?folders\.push\(f\);/.test(code));
t("收藏：目录列表空了从备份自愈", /bgsh_favs_backup_/.test(code) && /已从备份还原/.test(code));
t("收藏：自动分类不删用户建的目录", /function cleanEmptyFolders\(keepFolders\)/.test(code) && /keep\.has\(f\) \|\| usedFolders\.has\(f\)/.test(code));

// 5) 版本一致性
const v = (code.match(/^\/\/\s*@version\s+(\S+)/m) || [])[1];
const sv = (code.match(/const scriptVer = "v([^"]+)";/) || [])[1];
t("@version 与 scriptVer 一致（" + v + " / " + sv + "）", v && sv && v === sv, { v, sv });
if (fs.existsSync(META)) {
  const meta = fs.readFileSync(META, "utf8");
  const mv = (meta.match(/^\/\/\s*@version\s+(\S+)/m) || [])[1];
  t("meta.js 与 user.js 版本一致（" + mv + "）", mv === v, { mv, v });
} else {
  t("meta.js 存在", false, "缺少 x98t-plus.meta.js（跑 node scripts/gen-meta.js）");
}

// 6) 合并下载（4.13.0，从【蚂蚁脚本】并入，已去 localhost 依赖）
t("合并下载：不调用任何本地端口", !/https?:\/\/localhost:\d+/i.test(code) && !/fetch\(\s*[`"']http:\/\/127\.0\.0\.1/i.test(code));
t("合并下载：Alt+D 快捷键", /event\.altKey/.test(code) && /keyCode !== 68/.test(code) && /bgshMergeHotkeyBound/.test(code));
t("合并下载：ed2k + magnet 双解析", /magnet:\\\?\\\?/.test(code) && /ed2k:\\\/\\\/\\\|file\\\|/.test(code));
t("合并下载：三个入口按钮", ["bgshMergeDownloadButton","bgshExportLinksButton","bgshDownloadAttachmentsButton"].every(function(id){ return code.indexOf(id) > -1; }));
t("合并下载：跳过目录/sha1/torrent", /isNoiseAttachment/.test(code));
t("合并下载：已接入 handlePostPage", /insertMergeDownloadButtons\(buttonContainer\);/.test(code));

console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
