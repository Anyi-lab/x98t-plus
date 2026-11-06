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
