#!/usr/bin/env node
/**
 * 从 x98t-plus.user.js 的头部生成 x98t-plus.meta.js（Tampermonkey 更新检查用的小文件）。
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SCRIPT = path.join(ROOT, "x98t-plus.user.js");
const META = path.join(ROOT, "x98t-plus.meta.js");

const code = fs.readFileSync(SCRIPT, "utf8");
const start = code.indexOf("// ==UserScript==");
const end = code.indexOf("// ==/UserScript==");
if (start === -1 || end === -1) {
  console.error("找不到 UserScript 头");
  process.exit(1);
}
const header = code.slice(start, end + "// ==/UserScript==".length);
fs.writeFileSync(META, header + "\n");
const v = (code.match(/^\/\/\s*@version\s+(\S+)/m) || [])[1];
console.log("已生成 x98t-plus.meta.js（@version " + v + "）");
