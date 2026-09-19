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
t("头部无 @updateURL", !/^\/\/\s*@updateURL/m.test(code));
t("头部无 @downloadURL", !/^\/\/\s*@downloadURL/m.test(code));
t("无写死的 sleazyfork 地址", !/["'`]https?:\/\/[^"'`]*sleazyfork/i.test(code));
t("内建开关 SELF_UPDATE_META_URL 存在", /const SELF_UPDATE_META_URL = "";/.test(code));
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

console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
