#!/usr/bin/env node
/**
 * 把自己的 GitHub raw 地址写进更新源（头部 @updateURL/@downloadURL + 代码里的 SELF_UPDATE_META_URL）。
 * 用法：
 *   node scripts/set-github.js https://raw.githubusercontent.com/<用户名>/<仓库>/main
 *   node scripts/set-github.js --off        # 再次断开自动更新
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const SCRIPT = path.join(ROOT, "x98t-plus.user.js");
let code = fs.readFileSync(SCRIPT, "utf8");

const base = (process.argv[2] || "").replace(/\/+$/, "");
const off = base === "--off" || base === "";

// 先清掉旧的三个地址行
code = code
  .replace(/^\/\/ @downloadURL .*\n/m, "")
  .replace(/^\/\/ @updateURL .*\n/m, "")
  .replace(/^\/\/ @homepageURL .*\n/m, "");

if (off) {
  code = code.replace(/const SELF_UPDATE_META_URL = "[^"]*";/, 'const SELF_UPDATE_META_URL = "";');
  fs.writeFileSync(SCRIPT, code);
  execFileSync(process.execPath, [path.join(__dirname, "gen-meta.js")], { stdio: "inherit" });
  console.log("已断开自建更新源（SELF_UPDATE_META_URL 置空）。");
  process.exit(0);
}

const metaURL = base + "/x98t-plus.meta.js";
const userURL = base + "/x98t-plus.user.js";
const lines = [
  "// @homepageURL  " + base,
  "// @downloadURL  " + userURL,
  "// @updateURL    " + metaURL,
].join("\n") + "\n";

code = code.replace(/^(\/\/ ==\/UserScript==)/m, lines + "$1");
code = code.replace(
  /const SELF_UPDATE_META_URL = "[^"]*";/,
  'const SELF_UPDATE_META_URL = "' + metaURL + '";'
);
fs.writeFileSync(SCRIPT, code);
execFileSync(process.execPath, [path.join(__dirname, "gen-meta.js")], { stdio: "inherit" });
console.log("更新源已指向：" + metaURL);
console.log("记得 push 之后再让 Tampermonkey 检查一次更新。");
