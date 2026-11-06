// ==UserScript==
// @name         X大哥4.10版+收藏夹
// @namespace    https://www.sehuatang.net
// @version      4.14.1
// @description  98堂(原色花堂)官方脚本 高级搜索 作者追更 收藏追更/导出 图片分批懒加载 原图查看 橙金风UI
// @author       98堂
// @match        *://*.sehuatang.net/*
// @match        *://*.sehuatang.org/*
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        GM_listValues
// @grant        GM_deleteValue
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// @grant        GM_openInTab
// @connect      *
// @license      GPL-4.0 License
// @homepageURL  https://raw.githubusercontent.com/Anyi-lab/x98t-plus/main
// @downloadURL  https://raw.githubusercontent.com/Anyi-lab/x98t-plus/main/x98t-plus.user.js
// @updateURL    https://raw.githubusercontent.com/Anyi-lab/x98t-plus/main/x98t-plus.meta.js
// ==/UserScript==

// 自维护版（98T-plus）说明：
// 1. 已断开上游 sleazyfork 更新源（@updateURL / @downloadURL 已移除），不会再被官方整份覆盖。
// 2. 更新源改为自建仓库：跑一次 scripts/set-github.sh <raw-base> 就会把两个 URL 指过去。
// 3. 每次改动必须递增 @version —— Tampermonkey 只认它来判断有没有新版（无增量更新机制）。

(async function () {
    "use strict";

    // #region 全局变量
    const scriptVer = "v4.14.1";
    let activeTooltips = 0;
    let toastQueue = [];
    let isToastShowing = false;

    const DEFAULT_TID_OPTIONS = [
        { value: 95, label: "综合区" },
        { value: 166, label: "AI区" },
        { value: 141, label: "原创区" },
        { value: 142, label: "转帖区" },
        { value: 96, label: "投诉区" },
        { value: 97, label: "出售区" },
        { value: 143, label: "悬赏区" },
        { value: 2, label: "国产原创" },
        { value: 36, label: "亚洲无码" },
        { value: 37, label: "亚洲有码" },
        { value: 103, label: "中文字幕" },
        { value: 107, label: "三级写真" },
        { value: 160, label: "VR视频区" },
        { value: 104, label: "素人有码" },
        { value: 38, label: "欧美无码" },
        { value: 151, label: "4K原版" },
        { value: 152, label: "韩国主播" },
        { value: 39, label: "动漫原创" },
        { value: 154, label: "文学区原创人生" },
        { value: 135, label: "文学区乱伦人妻" },
        { value: 137, label: "文学区青春校园" },
        { value: 138, label: "文学区武侠玄幻" },
        { value: 136, label: "文学区激情都市" },
        { value: 139, label: "文学区TXT下载" },
        { value: 145, label: "原档自提字幕区" },
        { value: 146, label: "原档自译字幕区" },
        { value: 121, label: "原档字幕分享区" },
        { value: 159, label: "原档新作区" },
        { value: 41, label: "在线国产自拍" },
        { value: 109, label: "在线中文字幕" },
        { value: 42, label: "在线日韩无码" },
        { value: 43, label: "在线日韩有码" },
        { value: 44, label: "在线欧美风情" },
        { value: 45, label: "在线卡通动漫" },
        { value: 46, label: "在线剧情三级" },
        { value: 155, label: "图区原创自拍" },
        { value: 125, label: "图区转帖自拍" },
        { value: 50, label: "图区华人街拍" },
        { value: 48, label: "图区亚洲性爱" },
        { value: 49, label: "图区欧美性爱" },
        { value: 117, label: "图区卡通动漫" },
        { value: 165, label: "图区套图下载" },
    ];

    var SEARCH_BOARD_GROUPS = [
        { label: "📁 综合区", fids: [95, 166] },
        { label: "📝 原创与转贴", fids: [141, 142, 96, 97, 143] },
        { label: "🎬 亚洲无码", fids: [36] },
        { label: "🎬 亚洲有码", fids: [37] },
        { label: "📺 中文字幕", fids: [103] },
        { label: "📷 三级写真&VR", fids: [107, 160] },
        { label: "👤 素人&欧美", fids: [104, 38] },
        { label: "🎥 4K原版&韩国", fids: [151, 152] },
        { label: "🎨 动漫原创", fids: [39] },
        { label: "🌐 在线区", fids: [41, 109, 42, 43, 44, 45, 46] },
        { label: "🖼️ 图区", fids: [155, 125, 50, 48, 49, 117, 165] },
        { label: "📚 文学区", fids: [154, 135, 137, 136, 139] },
        { label: "📄 原档字幕", fids: [145, 146, 121, 159] },
    ];
    var SEARCH_BOARD_NAMES = {};
    var SEARCH_FORMHASH = "";

    const baseURL = `https://${window.location.host}`;
    // #endregion

    // #region Toast 通知系统
    function showToast(message, type = 'info', duration = 3000) {
        toastQueue.push({ message, type, duration });
        processToastQueue();
    }

    function processToastQueue() {
        if (isToastShowing || toastQueue.length === 0) return;
        isToastShowing = true;
        const { message, type, duration } = toastQueue.shift();

        const toast = document.createElement('div');
        toast.className = 'bgsh-toast';
        toast.setAttribute('data-type', type);

        const iconMap = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        // 调用处大量消息本身以 emoji 开头（如 "✅ 已开始…"），而这里又按 type 自动加图标，
        // 结果同一个 emoji 出现两次。统一在渲染前处理：
        //   - 正文开头与自动图标相同 -> 去掉正文里那个，只保留自动图标
        //   - 正文开头是别的 emoji -> 保留正文的，隐藏自动图标（尊重调用处意图）
        var autoIcon = iconMap[type] || 'ℹ️';
        var lead = String(message).match(/^\s*(\p{Extended_Pictographic}️?)\s*/u);
        var showAutoIcon = true;
        var bodyMessage = String(message);
        if (lead) {
            if (lead[1] === autoIcon) {
                bodyMessage = bodyMessage.replace(lead[0], '');
            } else {
                showAutoIcon = false;
            }
        }

        toast.innerHTML = `
            <span class="bgsh-toast-icon"${showAutoIcon ? '' : ' hidden'}>${autoIcon}</span>
            <span class="bgsh-toast-message">${bodyMessage}</span>
            <span class="bgsh-toast-progress"></span>
        `;

        document.body.appendChild(toast);
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.remove();
                isToastShowing = false;
                processToastQueue();
            }, 400);
        }, duration);
    }

    function showTooltip(message) {
        showToast(message, 'info', 2500);
    }
    // #endregion

    // #region 深色模式
    function isDarkMode() {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    function getTheme() {
        return GM_getValue('bgsh_theme', 'auto');
    }

    function setTheme(theme) {
        GM_setValue('bgsh_theme', theme);
        applyTheme(theme);
    }

    function applyTheme(theme) {
        const isDark = theme === 'dark' || (theme === 'auto' && isDarkMode());
        document.documentElement.setAttribute('data-bgsh-theme', isDark ? 'dark' : 'light');
        if (document.documentElement.getAttribute("data-bgsh-custom-background") === "1") {
            setTimeout(function() {
                var settings = getSettings();
                applyForumListBackgroundTransparency(settings);
                setupAdaptiveForumText(settings);
            }, 0);
        }
    }

    function normalizeCustomBackgroundImage(value) {
        value = String(value || "").trim();
        if (!value) return "";
        if (/^data:image\//i.test(value)) return value;
        try {
            var url = new URL(value, location.href);
            if (!/^https?:$/i.test(url.protocol)) return "";
            return url.href;
        } catch (error) {
            return "";
        }
    }

    function normalizeTextColor(value) {
        value = String(value || "").trim();
        return /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : "#ffffff";
    }

    function getTextColorLuminance(hexColor) {
        var color = normalizeTextColor(hexColor).slice(1);
        var channels = [0, 2, 4].map(function(index) {
            return srgbChannelToLinear(parseInt(color.slice(index, index + 2), 16));
        });
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    }

    function getContrastingTextEffectColor(hexColor, alpha) {
        // 统一用深灰色描边，避免白色描边在按钮/容器上透出白框
        return "rgba(45,45,45," + alpha + ")";
    }

    function applyTextRenderingEnhancement(settings) {
        var root = document.documentElement;
        if (!settings || !settings.textRenderingEnhancementEnabled) {
            root.removeAttribute("data-bgsh-text-sharpening");
            clearAdaptiveForumText();
            return;
        }
        root.setAttribute("data-bgsh-text-sharpening", "1");
        if (settings.customBackgroundEnabled && !settings.customTextColorEnabled) {
            setupAdaptiveForumText(settings);
        }
    }

    function applyCustomTextAppearance(settings) {
        var root = document.documentElement;
        if (!settings || !settings.customTextColorEnabled) {
            root.removeAttribute("data-bgsh-custom-text");
            root.removeAttribute("data-bgsh-text-effect");
            root.style.removeProperty("--bgsh-custom-text-color");
            root.style.removeProperty("--bgsh-custom-text-outline");
            root.style.removeProperty("--bgsh-custom-text-shadow");
            return;
        }

        var color = normalizeTextColor(settings.customTextColor);
        var mode = settings.customTextContrastMode === "shadow" ? "shadow" :
                   settings.customTextContrastMode === "stroke12" ? "stroke12" :
                   settings.customTextContrastMode === "stroke2" ? "stroke2" : "stroke";
        root.style.setProperty("--bgsh-custom-text-color", color);
        root.style.setProperty("--bgsh-custom-text-outline", getContrastingTextEffectColor(color, 0.96));
        root.style.setProperty("--bgsh-custom-text-shadow", getContrastingTextEffectColor(color, 0.74));
        root.setAttribute("data-bgsh-custom-text", "1");
        root.setAttribute("data-bgsh-text-effect", mode);
        root.setAttribute("data-bgsh-text-stroke-only", "1");
        document.querySelectorAll(".bgsh-text-on-light-bg, .bgsh-text-on-dark-bg").forEach(function(row) {
            row.classList.remove("bgsh-text-on-light-bg", "bgsh-text-on-dark-bg");
        });
    }

    let responsiveBackgroundCover = {
        source: "", naturalWidth: 0, naturalHeight: 0, loadToken: 0
    };
    let responsiveBackgroundResizeBound = false;
    let responsiveBackgroundResizeTimer = null;

    function updateResponsiveBackgroundCover() {
        var root = document.documentElement;
        var imageWidth = responsiveBackgroundCover.naturalWidth;
        var imageHeight = responsiveBackgroundCover.naturalHeight;
        if (root.getAttribute("data-bgsh-custom-background") !== "1" ||
            !imageWidth || !imageHeight) return;

        var viewportWidth = Math.max(1,
            window.visualViewport ? window.visualViewport.width : 0,
            document.documentElement.clientWidth,
            window.innerWidth || 0
        );
        var viewportHeight = Math.max(1,
            window.visualViewport ? window.visualViewport.height : 0,
            window.innerHeight || 0
        );
        var imageRatio = imageWidth / imageHeight;
        var viewportRatio = viewportWidth / viewportHeight;
        var scale = imageRatio > viewportRatio
            ? viewportHeight / imageHeight
            : viewportWidth / imageWidth;
        var renderedWidth = Math.ceil(imageWidth * scale);
        var renderedHeight = Math.ceil(imageHeight * scale);
        var offsetX = Math.floor((viewportWidth - renderedWidth) / 2);
        var offsetY = Math.floor((viewportHeight - renderedHeight) / 2);

        root.style.setProperty("--bgsh-custom-background-size",
            renderedWidth + "px " + renderedHeight + "px");
        root.style.setProperty("--bgsh-custom-background-position",
            offsetX + "px " + offsetY + "px");
        root.dataset.bgshBackgroundNaturalSize = imageWidth + "x" + imageHeight;
        root.dataset.bgshBackgroundViewportRatio = viewportRatio.toFixed(4);
    }

    function scheduleResponsiveBackgroundCover() {
        if (responsiveBackgroundResizeTimer) clearTimeout(responsiveBackgroundResizeTimer);
        responsiveBackgroundResizeTimer = setTimeout(function() {
            responsiveBackgroundResizeTimer = null;
            updateResponsiveBackgroundCover();
            scheduleAdaptiveForumTextUpdate();
        }, 60);
    }

    function setResponsiveBackgroundNaturalSize(source, width, height) {
        if (!source || source !== responsiveBackgroundCover.source || !width || !height) return;
        responsiveBackgroundCover.naturalWidth = width;
        responsiveBackgroundCover.naturalHeight = height;
        updateResponsiveBackgroundCover();
    }

    function setupResponsiveBackgroundCover(source) {
        source = normalizeCustomBackgroundImage(source);
        if (!source) return;
        if (!responsiveBackgroundResizeBound) {
            responsiveBackgroundResizeBound = true;
            window.addEventListener("resize", scheduleResponsiveBackgroundCover);
            window.addEventListener("orientationchange", scheduleResponsiveBackgroundCover);
            if (window.visualViewport) {
                window.visualViewport.addEventListener("resize", scheduleResponsiveBackgroundCover);
            }
        }
        if (responsiveBackgroundCover.source === source &&
            responsiveBackgroundCover.naturalWidth && responsiveBackgroundCover.naturalHeight) {
            updateResponsiveBackgroundCover();
            return;
        }

        var token = responsiveBackgroundCover.loadToken + 1;
        responsiveBackgroundCover = {
            source: source, naturalWidth: 0, naturalHeight: 0, loadToken: token
        };
        var image = new Image();
        image.onload = function() {
            if (responsiveBackgroundCover.loadToken !== token ||
                responsiveBackgroundCover.source !== source) return;
            setResponsiveBackgroundNaturalSize(source,
                image.naturalWidth || image.width, image.naturalHeight || image.height);
        };
        image.onerror = function() {
            if (responsiveBackgroundCover.loadToken !== token) return;
            document.documentElement.style.setProperty("--bgsh-custom-background-size", "cover");
            document.documentElement.style.setProperty("--bgsh-custom-background-position", "center center");
        };
        image.src = source;
    }

    function resetResponsiveBackgroundCover() {
        responsiveBackgroundCover = {
            source: "", naturalWidth: 0, naturalHeight: 0,
            loadToken: responsiveBackgroundCover.loadToken + 1
        };
        var root = document.documentElement;
        root.style.removeProperty("--bgsh-custom-background-size");
        root.style.removeProperty("--bgsh-custom-background-position");
        delete root.dataset.bgshBackgroundNaturalSize;
        delete root.dataset.bgshBackgroundViewportRatio;
    }

    function applyCustomBackground(settings) {
        var root = document.documentElement;
        var image = settings && settings.customBackgroundEnabled
            ? normalizeCustomBackgroundImage(settings.customBackgroundImage)
            : "";
        if (!image) {
            root.removeAttribute("data-bgsh-custom-background");
            root.style.removeProperty("--bgsh-custom-background-image");
            root.style.removeProperty("--bgsh-custom-background-overlay");
            root.style.removeProperty("--bgsh-custom-background-blur");
            resetResponsiveBackgroundCover();
            restoreForumListBackgrounds();
            return;
        }

        var opacity = Math.max(0, Math.min(100,
            parseInt(settings.customBackgroundOpacity, 10) || 0));
        var blur = Math.max(0, Math.min(10,
            parseInt(settings.customBackgroundBlur, 10) || 0));
        var escapedImage = image.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
            .replace(/[\r\n\f]/g, "");
        root.style.setProperty("--bgsh-custom-background-image", 'url("' + escapedImage + '")');
        root.style.setProperty("--bgsh-custom-background-overlay", (1 - opacity / 100).toFixed(2));
        root.style.setProperty("--bgsh-custom-background-blur", blur + "px");
        root.setAttribute("data-bgsh-custom-background", "1");
        settings.textRenderingEnhancementEnabled = true;
        applyTextRenderingEnhancement(settings);
        setupResponsiveBackgroundCover(image);
        applyForumListBackgroundTransparency(settings);
        setupForumListBackgroundObserver(settings);
        setupAdaptiveForumText(settings);
    }

    const forumListBackgroundOriginals = new Map();
    let forumListBackgroundObserver = null;
    let forumListBackgroundTimer = null;

    function parseComputedColor(color) {
        var match = String(color || "").match(
            /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/i
        );
        if (!match) return null;
        return {
            red: Math.max(0, Math.min(255, Math.round(Number(match[1])))),
            green: Math.max(0, Math.min(255, Math.round(Number(match[2])))),
            blue: Math.max(0, Math.min(255, Math.round(Number(match[3])))),
            alpha: match[4] === undefined ? 1 : Math.max(0, Math.min(1, Number(match[4])))
        };
    }

    function elementHasOwnVisibleBackground(element) {
        if (!element || element.nodeType !== 1) return false;
        var parsed = parseComputedColor(getComputedStyle(element).backgroundColor);
        return Boolean(parsed && parsed.alpha > 0.02);
    }

    function hasColoredDirectChildren(element) {
        if (!element || !element.children) return false;
        return Array.from(element.children).some(function(child) {
            return elementHasOwnVisibleBackground(child) ||
                Array.from(child.children || []).some(elementHasOwnVisibleBackground);
        });
    }

    function getForumListBackgroundElements(root) {
        var scope = root && root.querySelectorAll ? root : document;
        var selector = [
            "#threadlist .bm_c > table > tbody, #threadlisttableid > tbody",
            "#threadlist .bm_c > table > tbody > tr, #threadlisttableid > tbody > tr",
            "#threadlist .bm_c > table > tbody > tr > th, #threadlisttableid > tbody > tr > th",
            "#threadlist .bm_c > table > tbody > tr > td, #threadlisttableid > tbody > tr > td",
            "#threadlist tbody[id^='normalthread_']",
            "#threadlist tbody[id^='stickthread_']",
            "#threadlist .thread-item",
            "#threadlist .thread",
            ".threadlist > li",
            ".searchresult > li"
        ].join(",");
        var elements = Array.from(scope.querySelectorAll(selector));
        if (scope.matches && scope.matches(selector)) elements.unshift(scope);
        return Array.from(new Set(elements));
    }

    function makeElementBackgroundTranslucent(element, maximumAlpha) {
        var original = forumListBackgroundOriginals.get(element);
        var parsed = original ? original.color : parseComputedColor(getComputedStyle(element).backgroundColor);
        if (!parsed || parsed.alpha <= 0.02) return;
        if (!original) {
            original = {
                color: parsed,
                inlineColor: element.style.getPropertyValue("background-color"),
                inlineColorPriority: element.style.getPropertyPriority("background-color"),
                inlineBackdrop: element.style.getPropertyValue("backdrop-filter"),
                inlineWebkitBackdrop: element.style.getPropertyValue("-webkit-backdrop-filter")
            };
            forumListBackgroundOriginals.set(element, original);
        }

        if (maximumAlpha <= 0) {
            element.style.setProperty("background-color", "transparent", "important");
        } else {
            var alpha = Math.min(parsed.alpha, maximumAlpha);
            element.style.setProperty("background-color",
                "rgba(" + parsed.red + "," + parsed.green + "," + parsed.blue + "," + alpha + ")", "important");
        }
        element.style.setProperty("backdrop-filter", "none", "important");
        element.style.setProperty("-webkit-backdrop-filter", "none", "important");
        element.dataset.bgshTranslucentForumRow = "1";
    }

    function applyForumListBackgroundTransparency(settings, root) {
        if (!settings || !settings.customBackgroundEnabled ||
            !normalizeCustomBackgroundImage(settings.customBackgroundImage)) return;

        // 列表外壳和每一行主题条目都使用真正的透明背景。
        var scope = root && root.querySelectorAll ? root : document;
        var containerSelector = [
            "#threadlist", "#threadlist .bm_c", "#threadlist .tl",
            "#threadlisttableid", ".threadlist", ".searchresult"
        ].join(",");
        var containers = Array.from(scope.querySelectorAll(containerSelector));
        if (scope.matches && scope.matches(containerSelector)) containers.unshift(scope);
        Array.from(new Set(containers)).forEach(function(element) {
            makeElementBackgroundTranslucent(element, 0);
        });

        getForumListBackgroundElements(root).forEach(function(element) {
            if ((element.tagName === "TBODY" || element.tagName === "TR") &&
                hasColoredDirectChildren(element)) return;
            makeElementBackgroundTranslucent(element, 0);
        });
    }

    function restoreForumListBackgrounds() {
        clearAdaptiveForumText();
        if (forumListBackgroundObserver) {
            forumListBackgroundObserver.disconnect();
            forumListBackgroundObserver = null;
        }
        if (forumListBackgroundTimer) {
            clearTimeout(forumListBackgroundTimer);
            forumListBackgroundTimer = null;
        }
        forumListBackgroundOriginals.forEach(function(original, element) {
            if (!element || !element.style) return;
            if (original.inlineColor) {
                element.style.setProperty("background-color", original.inlineColor, original.inlineColorPriority || "");
            } else {
                element.style.removeProperty("background-color");
            }
            if (original.inlineBackdrop) element.style.setProperty("backdrop-filter", original.inlineBackdrop);
            else element.style.removeProperty("backdrop-filter");
            if (original.inlineWebkitBackdrop) element.style.setProperty("-webkit-backdrop-filter", original.inlineWebkitBackdrop);
            else element.style.removeProperty("-webkit-backdrop-filter");
            delete element.dataset.bgshTranslucentForumRow;
        });
        forumListBackgroundOriginals.clear();
    }

    function setupForumListBackgroundObserver(settings) {
        if (forumListBackgroundObserver || !document.body) return;
        forumListBackgroundObserver = new MutationObserver(function(mutations) {
            var hasAddedElements = mutations.some(function(mutation) {
                return mutation.addedNodes && Array.from(mutation.addedNodes).some(function(node) {
                    return node.nodeType === 1;
                });
            });
            if (!hasAddedElements || forumListBackgroundTimer) return;
            forumListBackgroundTimer = setTimeout(function() {
                forumListBackgroundTimer = null;
                applyForumListBackgroundTransparency(getSettings());
                scheduleAdaptiveForumTextUpdate();
            }, 120);
        });
        forumListBackgroundObserver.observe(document.body, { childList: true, subtree: true });
    }

    let adaptiveBackgroundSampler = {
        source: "", status: "idle", naturalWidth: 0, naturalHeight: 0,
        width: 0, height: 0, pixels: null, objectUrl: ""
    };
    let adaptiveForumTextScheduled = false;
    let adaptiveForumTextListenersBound = false;
    let adaptiveForumTextSettings = null;

    function getAdaptiveForumRows() {
        var selector = [
            "#threadlist .bm_c > table > tbody[id^='normalthread_'], #threadlisttableid > tbody[id^='normalthread_']",
            "#threadlist .bm_c > table > tbody[id^='stickthread_'], #threadlisttableid > tbody[id^='stickthread_']",
            "#threadlisttableid > tbody:not([id^='normalthread_']):not([id^='stickthread_']) > tr",
            "#threadlist .thread-item",
            "#threadlist .thread",
            ".threadlist > li",
            ".searchresult > li",
            ".fl_tb tr",
            ".pgs"
        ].join(",");
        return Array.from(new Set(document.querySelectorAll(selector))).filter(function(row) {
            return row.getBoundingClientRect().width > 0;
        });
    }

    function loadSamplerImage(source, useCors) {
        return new Promise(function(resolve, reject) {
            var image = new Image();
            if (useCors) image.crossOrigin = "anonymous";
            image.onload = function() { resolve(image); };
            image.onerror = function() { reject(new Error("背景图读取失败")); };
            image.src = source;
        });
    }

    function requestBackgroundImageBlob(source) {
        return new Promise(function(resolve, reject) {
            if (typeof GM_xmlhttpRequest !== "function") {
                reject(new Error("跨域图片读取不可用"));
                return;
            }
            GM_xmlhttpRequest({
                method: "GET",
                url: source,
                responseType: "blob",
                timeout: 15000,
                onload: function(response) {
                    if (response.status < 200 || response.status >= 300 || !response.response) {
                        reject(new Error("背景图请求失败"));
                        return;
                    }
                    var blob = response.response instanceof Blob
                        ? response.response
                        : new Blob([response.response], {
                            type: String(response.responseHeaders || "").match(/content-type:\s*([^\r\n]+)/i)?.[1] || "image/*"
                        });
                    resolve(blob);
                },
                ontimeout: function() { reject(new Error("背景图请求超时")); },
                onerror: function() { reject(new Error("背景图跨域请求失败")); }
            });
        });
    }

    function buildBackgroundSampler(image, objectUrl) {
        var naturalWidth = image.naturalWidth || image.width;
        var naturalHeight = image.naturalHeight || image.height;
        if (!naturalWidth || !naturalHeight) throw new Error("背景图尺寸无效");
        setResponsiveBackgroundNaturalSize(adaptiveBackgroundSampler.source, naturalWidth, naturalHeight);
        var scale = Math.min(1, 320 / Math.max(naturalWidth, naturalHeight));
        var width = Math.max(1, Math.round(naturalWidth * scale));
        var height = Math.max(1, Math.round(naturalHeight * scale));
        var canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        var context = canvas.getContext("2d", { willReadFrequently: true });
        context.drawImage(image, 0, 0, width, height);
        var pixels = context.getImageData(0, 0, width, height).data;
        return {
            source: adaptiveBackgroundSampler.source,
            status: "ready",
            naturalWidth: naturalWidth,
            naturalHeight: naturalHeight,
            width: width,
            height: height,
            pixels: pixels,
            objectUrl: objectUrl || ""
        };
    }

    async function prepareAdaptiveBackgroundSampler(settings) {
        var source = normalizeCustomBackgroundImage(settings && settings.customBackgroundImage);
        if (!source) return;
        if (adaptiveBackgroundSampler.source === source &&
            (adaptiveBackgroundSampler.status === "loading" || adaptiveBackgroundSampler.status === "ready")) return;

        if (adaptiveBackgroundSampler.objectUrl) URL.revokeObjectURL(adaptiveBackgroundSampler.objectUrl);
        adaptiveBackgroundSampler = {
            source: source, status: "loading", naturalWidth: 0, naturalHeight: 0,
            width: 0, height: 0, pixels: null, objectUrl: ""
        };
        var objectUrl = "";
        try {
            var image;
            try {
                image = await loadSamplerImage(source, !/^data:image\//i.test(source));
                buildBackgroundSampler(image, "");
            } catch (directError) {
                if (/^data:image\//i.test(source)) throw directError;
                var blob = await requestBackgroundImageBlob(source);
                objectUrl = URL.createObjectURL(blob);
                image = await loadSamplerImage(objectUrl, false);
            }
            if (adaptiveBackgroundSampler.source !== source) {
                if (objectUrl) URL.revokeObjectURL(objectUrl);
                return;
            }
            adaptiveBackgroundSampler = buildBackgroundSampler(image, objectUrl);
        } catch (error) {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            if (adaptiveBackgroundSampler.source === source) {
                adaptiveBackgroundSampler.status = "failed";
                adaptiveBackgroundSampler.pixels = null;
            }
        }
        scheduleAdaptiveForumTextUpdate();
    }

    function getSampledPixel(viewportX, viewportY) {
        var sampler = adaptiveBackgroundSampler;
        if (sampler.status !== "ready" || !sampler.pixels) return null;
        var viewportWidth = Math.max(1, document.documentElement.clientWidth || window.innerWidth);
        var viewportHeight = Math.max(1, window.innerHeight);
        var coverScale = Math.max(
            viewportWidth / sampler.naturalWidth,
            viewportHeight / sampler.naturalHeight
        );
        var renderedWidth = sampler.naturalWidth * coverScale;
        var renderedHeight = sampler.naturalHeight * coverScale;
        var offsetX = (viewportWidth - renderedWidth) / 2;
        var offsetY = (viewportHeight - renderedHeight) / 2;
        var naturalX = Math.max(0, Math.min(sampler.naturalWidth - 1, (viewportX - offsetX) / coverScale));
        var naturalY = Math.max(0, Math.min(sampler.naturalHeight - 1, (viewportY - offsetY) / coverScale));
        var x = Math.max(0, Math.min(sampler.width - 1,
            Math.floor(naturalX / sampler.naturalWidth * sampler.width)));
        var y = Math.max(0, Math.min(sampler.height - 1,
            Math.floor(naturalY / sampler.naturalHeight * sampler.height)));
        var index = (y * sampler.width + x) * 4;
        return {
            red: sampler.pixels[index], green: sampler.pixels[index + 1],
            blue: sampler.pixels[index + 2], alpha: sampler.pixels[index + 3] / 255
        };
    }

    function srgbChannelToLinear(value) {
        value /= 255;
        return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
    }

    function getRowBackgroundLuminance(row, settings) {
        var rect = row.getBoundingClientRect();
        var isDarkTheme = document.documentElement.getAttribute("data-bgsh-theme") === "dark";
        var base = isDarkTheme ? { red: 24, green: 18, blue: 13 } : { red: 255, green: 248, blue: 235 };
        var visibleOpacity = Math.max(0, Math.min(100,
            parseInt(settings.customBackgroundOpacity, 10) || 0)) / 100;
        if (adaptiveBackgroundSampler.status !== "ready") {
            return isDarkTheme ? 0.02 : 0.92;
        }

        var left = Math.max(0, rect.left);
        var right = Math.min(document.documentElement.clientWidth || window.innerWidth, rect.right);
        var top = Math.max(0, rect.top);
        var bottom = Math.min(window.innerHeight, rect.bottom);
        if (right <= left || bottom <= top) return isDarkTheme ? 0.02 : 0.92;

        var luminances = [];
        [0.12, 0.3, 0.5, 0.7, 0.88].forEach(function(xRatio) {
            [0.3, 0.7].forEach(function(yRatio) {
                var pixel = getSampledPixel(
                    left + (right - left) * xRatio,
                    top + (bottom - top) * yRatio
                );
                if (!pixel) return;
                var imageAlpha = pixel.alpha * visibleOpacity;
                var red = pixel.red * imageAlpha + base.red * (1 - imageAlpha);
                var green = pixel.green * imageAlpha + base.green * (1 - imageAlpha);
                var blue = pixel.blue * imageAlpha + base.blue * (1 - imageAlpha);
                luminances.push(
                    0.2126 * srgbChannelToLinear(red) +
                    0.7152 * srgbChannelToLinear(green) +
                    0.0722 * srgbChannelToLinear(blue)
                );
            });
        });
        if (!luminances.length) return isDarkTheme ? 0.02 : 0.92;
        luminances.sort(function(a, b) { return a - b; });
        return luminances[Math.floor(luminances.length / 2)];
    }

    function updateAdaptiveForumText() {
        adaptiveForumTextScheduled = false;
        var settings = adaptiveForumTextSettings;
        if (!settings || !settings.customBackgroundEnabled ||
            document.documentElement.getAttribute("data-bgsh-custom-background") !== "1") return;

        getAdaptiveForumRows().forEach(function(row) {
            var rect = row.getBoundingClientRect();
            if (rect.bottom < -100 || rect.top > window.innerHeight + 100) return;
            var luminance = getRowBackgroundLuminance(row, settings);
            var blackContrast = (luminance + 0.05) / 0.05;
            var whiteContrast = 1.05 / (luminance + 0.05);
            var useBlackText = blackContrast >= whiteContrast;
            row.classList.toggle("bgsh-text-on-light-bg", useBlackText);
            row.classList.toggle("bgsh-text-on-dark-bg", !useBlackText);
        });
    }

    function scheduleAdaptiveForumTextUpdate() {
        if (adaptiveForumTextScheduled) return;
        adaptiveForumTextScheduled = true;
        requestAnimationFrame(updateAdaptiveForumText);
    }

    function setupAdaptiveForumText(settings) {
        if (!settings || !settings.customBackgroundEnabled) return;
        if (!settings.textRenderingEnhancementEnabled || settings.customTextColorEnabled) {
            clearAdaptiveForumText();
            return;
        }
        adaptiveForumTextSettings = {
            customBackgroundEnabled: true,
            customBackgroundImage: settings.customBackgroundImage,
            customBackgroundOpacity: settings.customBackgroundOpacity
        };
        prepareAdaptiveBackgroundSampler(settings);
        if (!adaptiveForumTextListenersBound) {
            adaptiveForumTextListenersBound = true;
            window.addEventListener("scroll", scheduleAdaptiveForumTextUpdate, { passive: true });
            window.addEventListener("resize", scheduleAdaptiveForumTextUpdate);
        }
        scheduleAdaptiveForumTextUpdate();
    }

    function clearAdaptiveForumText() {
        adaptiveForumTextSettings = null;
        document.querySelectorAll(".bgsh-text-on-light-bg, .bgsh-text-on-dark-bg").forEach(function(row) {
            row.classList.remove("bgsh-text-on-light-bg", "bgsh-text-on-dark-bg");
        });
        if (adaptiveBackgroundSampler.objectUrl) URL.revokeObjectURL(adaptiveBackgroundSampler.objectUrl);
        adaptiveBackgroundSampler = {
            source: "", status: "idle", naturalWidth: 0, naturalHeight: 0,
            width: 0, height: 0, pixels: null, objectUrl: ""
        };
    }
    // #endregion

    // #region 获取用户设置
    function getSettings() {
        const getJSONValue = (key, defaultValue) => {
            const value = GM_getValue(key, defaultValue);
            try {
                return JSON.parse(value);
            } catch {
                return JSON.parse(defaultValue);
            }
        };
        const savedSearchSort = GM_getValue("searchSort", GM_getValue("bgshSearchSort", "native"));
        const normalizedSearchSort = ["native", "dateline", "lastpost"].includes(savedSearchSort)
            ? savedSearchSort
            : "native";
        // 板块帖子列表的默认排序：默认「发布时间」。
        // 网站原生默认是「回复时间」，所以脚本进入板块页会补 orderby=dateline 重定向；
        // 选 native（网站默认）则不干预，选 lastpost（回复时间）则补 orderby=lastpost。
        const savedForumSort = GM_getValue("forumDefaultSort", "dateline");
        const normalizedForumSort = ["native", "dateline", "lastpost"].includes(savedForumSort)
            ? savedForumSort
            : "dateline";
        const customBackgroundEnabled = GM_getValue("bgshCustomBackgroundEnabled", false) === true;

        return {
            logoText: GM_getValue("logoText", "永久地址 WWW.98T.LA"),
            tipsText: GM_getValue("tipsText", "九八堂提醒你"),
            imageSize: GM_getValue("imageSize", "50px"),
            imageUrl: GM_getValue("imageUrl", "/static/image/common/logo.png"),
            blockMedals: GM_getValue("blockMedals", 0),
            resizeMedals: GM_getValue("resizeMedals", 0),
            replaceMedals: GM_getValue("replaceMedals", 0),
            displayBlockedTips: GM_getValue("displayBlockedTips", true),
            autoPagination: GM_getValue("autoPagination", true),
            showImageButton: GM_getValue("showImageButton", "show"),
            defaultHidePostImages: GM_getValue("defaultHidePostImages", false) !== false,
            lastCheckedUpdate: GM_getValue("lastCheckedUpdate", 0),
            enableTitleStyle: GM_getValue("enableTitleStyle", true),
            titleStyleSize: GM_getValue("titleStyleSize", 20),
            titleStyleWeight: GM_getValue("titleStyleWeight", 700),
            largeResourceThresholdGb: Math.max(1, Math.min(500,
                parseInt(GM_getValue("largeResourceThresholdGb", 50), 10) || 50)),
            blockedUsers: GM_getValue("blockedUsers", []),
            followedAuthors: GM_getValue("followedAuthors", []),
            showAvatar: GM_getValue("showAvatar", true),
            maxGradeThread: GM_getValue("maxGradeThread", 10),
            defaultSwipeToSearch: GM_getValue("defaultSwipeToSearch", true),
            displayThreadImages: GM_getValue("displayThreadImages", false),
            previewWheelResizeEnabled: GM_getValue("previewWheelResizeEnabled", true),
            threadPreviewCount: Math.max(1, Math.min(12, parseInt(GM_getValue("threadPreviewCount", 3), 10) || 3)),
            visitedThreadColor: GM_getValue("visitedThreadColor", "#999999"),
            largeResourceTitleColor: GM_getValue("largeResourceTitleColor", "#ff6a00"),
            displayThreadBuyInfo: GM_getValue("displayThreadBuyInfo", true),
            customBackgroundEnabled: customBackgroundEnabled,
            customBackgroundImage: GM_getValue("bgshCustomBackgroundImage", ""),
            customBackgroundOpacity: Math.max(0, Math.min(100,
                parseInt(GM_getValue("bgshCustomBackgroundOpacity", 25), 10) || 0)),
            customBackgroundBlur: Math.max(0, Math.min(10,
                parseInt(GM_getValue("bgshCustomBackgroundBlur", 0), 10) || 0)),
            customTextColorEnabled: GM_getValue("bgshCustomTextColorEnabled", false),
            customTextColor: normalizeTextColor(GM_getValue("bgshCustomTextColor", "#ffffff")),
            customTextContrastMode: (function() {
                var m = GM_getValue("bgshCustomTextContrastMode", "stroke");
                return m === "shadow" ? "shadow" : m === "stroke12" ? "stroke12" : m === "stroke2" ? "stroke2" : "stroke";
            })(),
            textRenderingEnhancementEnabled: customBackgroundEnabled ||
                GM_getValue("bgshTextRenderingEnhancementEnabled", false) === true,
            isShowWatermarkMessage: GM_getValue("isShowWatermarkMessage", true),
            clickEffectStyle: GM_getValue("clickEffectStyle", "ripple"),
            postImageLazyLoad: GM_getValue("postImageLazyLoad", true),
            postImageLazyBatchSize: Math.max(1, Math.min(20, parseInt(GM_getValue("postImageLazyBatchSize", 6), 10) || 6)),
            showDown: GM_getValue("showDown", true),
            showCopyCode: GM_getValue("showCopyCode", true),
            showFastPost: GM_getValue("showFastPost", true),
            showFastReply: GM_getValue("showFastReply", true),
            showQuickGrade: GM_getValue("showQuickGrade", true),
            showQuickStar: GM_getValue("showQuickStar", true),
            showClickDouble: GM_getValue("showClickDouble", true),
            showViewRatings: GM_getValue("showViewRatings", true),
            showPayLog: GM_getValue("showPayLog", true),
            showFastCopy: GM_getValue("showFastCopy", true),
            blockingResolved: GM_getValue("blockingResolved", true),
            isOnlyShowMoney: GM_getValue("isOnlyShowMoney", false),
            blockingIndex: GM_getValue("blockingIndex", false),
            menuButtonIsVisible: GM_getValue("menuButtonIsVisible", true),
            // 搜索设置
            searchCacheEnabled: GM_getValue("searchCacheEnabled", true),
            searchAutoComplete: GM_getValue("searchAutoComplete", true),
            searchHistoryCount: Math.max(5, Math.min(50, parseInt(GM_getValue("searchHistoryCount", 20), 10) || 20)),
            searchResultCount: GM_getValue("searchResultCount", 50),
            searchHotKeys: GM_getValue("searchHotKeys", true),
            searchSort: normalizedSearchSort,
            forumDefaultSort: normalizedForumSort,
            // 筛选状态
            boardFilterGroup: GM_getValue("bgsh_filter_group", "all"),
            boardFilterIndividual: GM_getValue("bgsh_filter_individual", "[]"),
            boardFilterCollapsed: GM_getValue("bgsh_filter_collapsed", false),
            typeFilterTypes: GM_getValue("bgsh_typeFilter_types", "[]"),
            typeFilterCollapsed: GM_getValue("bgsh_typeFilter_collapsed", false),
        };
    }
    // #endregion

    // #region 统一样式表 (保持长方形按钮 + 板块筛选)
    function addStyles() {
        const style = document.createElement("style");
        style.innerHTML = `
            /* ===== 全局设计 Token ===== */
            :root {
                --bgsh-primary: #f7971e;
                --bgsh-primary-light: #ffd200;
                --bgsh-primary-gradient: linear-gradient(135deg, var(--bgsh-primary), var(--bgsh-primary-light));
                --bgsh-radius: 16px;
                --bgsh-radius-sm: 10px;
                --bgsh-shadow: 0 12px 48px rgba(200, 120, 50, 0.2);
                --bgsh-shadow-hover: 0 8px 30px rgba(247, 151, 30, 0.4);
                --bgsh-font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                --bgsh-bg-light: rgba(255, 248, 235, 0.92);
                --bgsh-bg-dark: rgba(40, 30, 20, 0.92);
                --bgsh-text-light: #4a2e1b;
                --bgsh-text-dark: #f0e0c0;
                --bgsh-border-light: rgba(255, 200, 150, 0.3);
                --bgsh-border-dark: rgba(255, 200, 150, 0.1);
                --bgsh-backdrop: blur(24px);
            }

            /* ----- 自定义页面背景 -----
               仅替换 body 背景，不创建覆盖层、不参与布局，也不拦截鼠标事件。 */
            html[data-bgsh-custom-background="1"],
            html[data-bgsh-custom-background="1"] body {
                min-height: 100%;
            }
            html[data-bgsh-custom-background="1"] body {
                background-color: #fff8eb !important;
                background-image:
                    linear-gradient(
                        rgba(255, 248, 235, var(--bgsh-custom-background-overlay, .85)),
                        rgba(255, 248, 235, var(--bgsh-custom-background-overlay, .85))
                    ),
                    var(--bgsh-custom-background-image) !important;
                background-position:
                    0 0,
                    var(--bgsh-custom-background-position, center center) !important;
                background-size:
                    100% 100%,
                    var(--bgsh-custom-background-size, cover) !important;
                background-repeat: no-repeat, no-repeat !important;
                background-attachment: fixed, fixed !important;
                position: relative;
                isolation: isolate;
            }
            /* 位于正文后方、背景图前方的模糊层；滑块通过 CSS 变量实时控制。 */
            html[data-bgsh-custom-background="1"] body::before {
                content: "";
                position: fixed;
                inset: 0;
                z-index: -1;
                pointer-events: none;
                background: rgba(255, 255, 255, 0.001);
                backdrop-filter: blur(var(--bgsh-custom-background-blur, 0px));
                -webkit-backdrop-filter: blur(var(--bgsh-custom-background-blur, 0px));
            }
            html[data-bgsh-custom-background="1"][data-bgsh-theme="dark"] body {
                background-color: #18120d !important;
                background-image:
                    linear-gradient(
                        rgba(24, 18, 13, var(--bgsh-custom-background-overlay, .85)),
                        rgba(24, 18, 13, var(--bgsh-custom-background-overlay, .85))
                    ),
                    var(--bgsh-custom-background-image) !important;
            }
            /* ----- 论坛主体全层级背景穿透 -----
               只清除内容层的底色/纹理，保留边框、排版与所有交互组件。 */
            html[data-bgsh-custom-background="1"] :is(
                #wp,
                #wp.wp,
                #ct,
                #ct.ct1,
                #ct.ct2,
                #ct.ct2_a,
                #ct.ct2_wp,
                #pt,
                #diy_chart,
                .mn,
                .sd,
                .bm,
                .bmw,
                .bm_c,
                .bm_h,
                .fl,
                .fl_tb,
                .fl_row,
                .tl,
                .tl .th,
                #threadlist,
                #threadlisttableid,
                #postlist,
                #postlist > div,
                .pl,
                .pl table,
                .pls,
                .plc,
                .pcb,
                .t_fsz,
                .t_f,
                .threadlist,
                .searchresult,
                .pbn,
                .tbmu,
                .emp
            ) {
                background-color: transparent !important;
                background-image: none !important;
                backdrop-filter: none !important;
                -webkit-backdrop-filter: none !important;
            }
            /* Discuz 表格层级常各自带底色，需要逐层穿透。 */
            html[data-bgsh-custom-background="1"] :is(
                #diy_chart,
                .fl_tb,
                #threadlisttableid,
                #postlist,
                .pl
            ) :is(table, tbody, tr, th, td) {
                background-color: transparent !important;
                background-image: none !important;
                backdrop-filter: none !important;
                -webkit-backdrop-filter: none !important;
            }
            /* ----- 主体结构彻底穿透 -----
               覆盖分页条、帖子正文和其余仍可能保留白底的结构层。 */
            html[data-bgsh-custom-background="1"] :is(#wp, #ct) :is(
                div, section, article, main, aside, nav,
                table, thead, tbody, tfoot, tr, th, td,
                ul, ol, li, dl, dt, dd, form, fieldset
            ),
            html[data-bgsh-custom-background="1"] :is(
                #pgt, #pgt .pgs, #pgt .pg, #pgt .pgb,
                #postlist .plhin, #postlist .pct, #postlist .pcb,
                #postlist .t_fsz, #postlist .t_f,
                #postlist .pi, #postlist .po, #postlist .pob,
                #postlist .locked, #postlist .showhide,
                #postlist .quote, #postlist .blockcode,
                #postlist .attach_nopermission,
                .pgs, .pg, .pgb, .pg label,
                .vw, .vw .d, .vw .o, .vw .s
            ) {
                background: transparent !important;
                backdrop-filter: none !important;
                -webkit-backdrop-filter: none !important;
            }
            /* 分页数字和翻页链接自身通常使用白色背景图，也一并清除。 */
            html[data-bgsh-custom-background="1"] :is(
                #pgt .pg a, #pgt .pg strong, #pgt .pgb a,
                .pgs .pg a, .pgs .pg strong, .pgs .pgb a,
                .pg a, .pg strong, .pgb a
            ) {
                background: transparent !important;
                background-image: none !important;
                backdrop-filter: none !important;
                -webkit-backdrop-filter: none !important;
            }
            /* 清除主体结构伪元素残留的白色遮罩，但不触碰输入框和按钮。 */
            html[data-bgsh-custom-background="1"] :is(#wp, #ct) :is(
                div, section, article, main, aside, nav,
                table, thead, tbody, tfoot, tr, th, td,
                ul, ol, li, dl, dt, dd, form, fieldset
            )::before,
            html[data-bgsh-custom-background="1"] :is(#wp, #ct) :is(
                div, section, article, main, aside, nav,
                table, thead, tbody, tfoot, tr, th, td,
                ul, ol, li, dl, dt, dd, form, fieldset
            )::after {
                background: transparent !important;
                background-image: none !important;
            }
            /* ----- 文字锐化 -----
               font-smooth/crisp-edges 属于非标准或间接属性，不支持时由其余规则兜底。 */
            html[data-bgsh-text-sharpening="1"] body,
            html[data-bgsh-text-sharpening="1"] body :is(
                div, p, a, span, em, strong, cite, label,
                h1, h2, h3, h4, h5, h6,
                ul, ol, li, dl, dt, dd,
                table, thead, tbody, tfoot, tr, th, td,
                input, textarea, button, select, option,
                code, pre, blockquote
            ) {
                font-smooth: never !important;
                -webkit-font-smoothing: none !important;
                -moz-osx-font-smoothing: auto !important;
                text-rendering: geometricPrecision !important;
                image-rendering: crisp-edges !important;
                shape-rendering: crispEdges !important;
                font-weight: 600 !important;
                text-stroke: 0.65px rgba(0, 0, 0, 0.95) !important;
                -webkit-text-stroke: 0.65px rgba(0, 0, 0, 0.95) !important;
                text-shadow: none !important;
                paint-order: stroke fill !important;
            }
            /* 主题列表文字保持完全不透明，仅用极细描边增强复杂背景上的可读性。 */
            html[data-bgsh-custom-background="1"][data-bgsh-text-sharpening="1"] :is(
                #threadlisttableid > tbody,
                #threadlisttableid > tbody > tr,
                #threadlisttableid > tbody > tr > th,
                #threadlisttableid > tbody > tr > td,
                #threadlist .thread-item,
                #threadlist .thread,
                .threadlist > li,
                .searchresult > li
            ) {
                opacity: 1 !important;
                filter: none !important;
                text-stroke: 0.65px rgba(0, 0, 0, 0.95) !important;
                -webkit-text-stroke: 0.65px rgba(0, 0, 0, 0.95) !important;
                paint-order: stroke fill;
            }
            html[data-bgsh-custom-background="1"][data-bgsh-text-sharpening="1"][data-bgsh-theme="dark"] :is(
                #threadlisttableid > tbody,
                #threadlisttableid > tbody > tr,
                #threadlisttableid > tbody > tr > th,
                #threadlisttableid > tbody > tr > td,
                #threadlist .thread-item,
                #threadlist .thread,
                .threadlist > li,
                .searchresult > li
            ) {
                text-stroke-color: rgba(0, 0, 0, 0.92) !important;
                -webkit-text-stroke-color: rgba(0, 0, 0, 0.92) !important;
            }
            /* 按每一行背后的实际图像亮度切换文字方案。 */
            html[data-bgsh-custom-background="1"][data-bgsh-text-sharpening="1"] .bgsh-text-on-light-bg,
            html[data-bgsh-custom-background="1"][data-bgsh-text-sharpening="1"] .bgsh-text-on-light-bg :is(
                th, td, li, a, span, em, strong, cite, p, div, label
            ):not(.bgsh-sales-badge):not(.bgsh-customBtn) {
                color: #111 !important;
                text-stroke: 0.6px rgba(0, 0, 0, 0.95) !important;
                -webkit-text-stroke: 0.6px rgba(0, 0, 0, 0.95) !important;
                text-shadow: 0 1px 0.65px rgba(255, 255, 255, 0.8) !important;
                paint-order: stroke fill !important;
            }
            html[data-bgsh-custom-background="1"][data-bgsh-text-sharpening="1"] .bgsh-text-on-dark-bg,
            html[data-bgsh-custom-background="1"][data-bgsh-text-sharpening="1"] .bgsh-text-on-dark-bg :is(
                th, td, li, a, span, em, strong, cite, p, div, label
            ):not(.bgsh-sales-badge):not(.bgsh-customBtn) {
                color: #fff !important;
                text-stroke: 0.6px rgba(0, 0, 0, 0.97) !important;
                -webkit-text-stroke: 0.6px rgba(0, 0, 0, 0.97) !important;
                text-shadow: 0 1px 0.8px rgba(0, 0, 0, 0.8) !important;
                paint-order: stroke fill !important;
            }
            /* ----- 全局自定义文字颜色 ----- */
            html[data-bgsh-custom-text="1"] body,
            html[data-bgsh-custom-text="1"] body *:not(svg):not(path):not(g):not(use) {
                color: var(--bgsh-custom-text-color, #fff) !important;
            }
            html[data-bgsh-custom-text="1"][data-bgsh-text-stroke-only="1"][data-bgsh-text-effect="stroke"] body *:not(svg):not(path):not(g):not(use):not(button):not(input):not(select):not(textarea):not(.bgsh-customBtn) {
                -webkit-text-stroke: 1px var(--bgsh-custom-text-outline, rgba(45,45,45,.96)) !important;
                text-shadow: none !important;
                paint-order: stroke fill;
            }
            html[data-bgsh-custom-text="1"][data-bgsh-text-stroke-only="1"][data-bgsh-text-effect="stroke12"] body *:not(svg):not(path):not(g):not(use):not(button):not(input):not(select):not(textarea):not(.bgsh-customBtn) {
                -webkit-text-stroke: 1.2px var(--bgsh-custom-text-outline, rgba(45,45,45,.96)) !important;
                text-stroke: 1.2px var(--bgsh-custom-text-outline, rgba(45,45,45,.96)) !important;
                text-shadow: none !important;
                paint-order: stroke fill;
            }
            html[data-bgsh-custom-text="1"][data-bgsh-text-stroke-only="1"][data-bgsh-text-effect="stroke2"] body *:not(svg):not(path):not(g):not(use):not(button):not(input):not(select):not(textarea):not(.bgsh-customBtn) {
                -webkit-text-stroke: 2px rgba(45,45,45,.98) !important;
                text-stroke: 2px rgba(45,45,45,.98) !important;
                text-shadow: none !important;
                paint-order: stroke fill;
            }
            html[data-bgsh-custom-text="1"][data-bgsh-text-stroke-only="1"][data-bgsh-text-effect="shadow"] body *:not(svg):not(path):not(g):not(use):not(button):not(input):not(select):not(textarea):not(.bgsh-customBtn) {
                -webkit-text-stroke: 0 transparent !important;
                text-shadow: 0 1px 0.85px var(--bgsh-custom-text-shadow, rgba(45,45,45,.74)) !important;
            }
            html[data-bgsh-custom-text="1"] body :is(input, textarea, select)::placeholder {
                color: var(--bgsh-custom-text-color, #fff) !important;
                opacity: .78;
            }

            /* ----- Toast 通知 ----- */
            .bgsh-toast {
                position: fixed;
                top: 24px;
                left: 50%;
                transform: translateX(-50%) translateY(-120px);
                background: var(--bgsh-bg-light);
                backdrop-filter: var(--bgsh-backdrop);
                -webkit-backdrop-filter: var(--bgsh-backdrop);
                border-radius: var(--bgsh-radius);
                padding: 14px 28px;
                box-shadow: var(--bgsh-shadow);
                z-index: 100000;
                display: flex;
                align-items: center;
                gap: 12px;
                font-size: 15px;
                font-weight: 500;
                color: var(--bgsh-text-light);
                transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                max-width: 90vw;
                border: 1px solid var(--bgsh-border-light);
                pointer-events: none;
                font-family: var(--bgsh-font);
            }
            .bgsh-toast.show { transform: translateX(-50%) translateY(0); }
            .bgsh-toast[data-type="success"] { border-color: rgba(247, 151, 30, 0.5); }
            .bgsh-toast[data-type="error"] { border-color: rgba(255, 80, 50, 0.5); }
            .bgsh-toast[data-type="warning"] { border-color: rgba(255, 200, 0, 0.5); }
            .bgsh-toast-icon { font-size: 20px; flex-shrink: 0; }
            .bgsh-toast-message { flex: 1; word-break: break-word; }
            .bgsh-toast-progress {
                position: absolute;
                bottom: 0;
                left: 0;
                height: 3px;
                background: var(--bgsh-primary-gradient);
                border-radius: 0 0 var(--bgsh-radius) var(--bgsh-radius);
                animation: bgshToastProgress 3s linear forwards;
            }
            @keyframes bgshToastProgress {
                from { width: 100%; }
                to { width: 0%; }
            }
            [data-bgsh-theme="dark"] .bgsh-toast {
                background: var(--bgsh-bg-dark);
                color: var(--bgsh-text-dark);
                border-color: var(--bgsh-border-dark);
                box-shadow: 0 12px 48px rgba(0,0,0,0.5);
            }

            /* ----- 原有按钮风格 (长方形) ----- */
            .bgsh-customBtn, .bgsh-searchBtn, .bgsh-quickTopicadminToPostBtn,
            .bgsh-quickReplyToPostBtn, .bgsh-QuickMiscReportBtn,
            .bgsh-quickReportadToPostBtn, .bgsh-quickGradeToPostBtn,
            .bgsh-openAllUrlBtn, .bgsh-fastPMButtonBtn,
            .bgsh-quickReplyEditToPostBtn, .bgsh-setAnswerToPostBtn {
                padding: 8px 15px;
                margin-bottom: 8px;
                margin-right: 8px;
                width: 100%;
                border: none;
                outline: none;
                white-space: pre-line;
                border-radius: 10px;
                font-size: 13px;
                font-weight: 500;
                color: #3d2a1a;
                cursor: pointer;
                background: linear-gradient(135deg, #f7971e, #ffd200);
                box-shadow: 0 4px 15px rgba(247, 151, 30, 0.3);
                transition: all 0.3s ease;
                position: relative;
                overflow: hidden;
            }
            .bgsh-customBtn:hover, .bgsh-searchBtn:hover {
                transform: translateY(-2px) scale(1.02);
                box-shadow: 0 8px 30px rgba(247, 151, 30, 0.4);
            }
            .bgsh-customBtn:active, .bgsh-searchBtn:active {
                transform: scale(0.96);
            }
            .bgsh-quickTopicadminToPostBtn, .bgsh-quickReplyToPostBtn,
            .bgsh-quickReplyEditToPostBtn, .bgsh-setAnswerToPostBtn {
                width: auto;
                float: right;
                background: linear-gradient(135deg, #f093fb, #f5576c);
                box-shadow: 0 4px 15px rgba(245, 87, 108, 0.3);
                color: #fff;
            }
            .bgsh-quickGradeToPostBtn, .bgsh-QuickMiscReportBtn,
            .bgsh-quickReportadToPostBtn {
                width: auto;
                float: left;
                background: linear-gradient(135deg, #4facfe, #00f2fe);
                box-shadow: 0 4px 15px rgba(79, 172, 254, 0.3);
                color: #fff;
            }
            .bgsh-fastPMButtonBtn {
                width: auto;
                float: left;
                background: linear-gradient(135deg, #a18cd1, #fbc2eb);
                box-shadow: 0 4px 15px rgba(161, 140, 209, 0.3);
                color: #fff;
            }
            .bgsh-openAllUrlBtn {
                width: 100px;
                font-size: 16px;
                padding: 0;
                background: linear-gradient(135deg, #ff6b6b, #ee5a24);
                box-shadow: 0 4px 15px rgba(238, 90, 36, 0.3);
                color: #fff;
            }
            .bgsh-searchBtn {
                max-width: 400px;
                background: linear-gradient(135deg, #f7971e, #ffd200);
                color: #3d2a1a;
            }

            /* ----- 浮动工具栏 (长方形按钮) ----- */
            .bgsh-toolbar {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 6px;
                position: fixed;
                top: 50%;
                right: 12px;
                z-index: 1000;
                transform: translateY(-50%);
                max-height: 80vh;
                overflow-y: auto;
                padding: 4px 0;
                scrollbar-width: thin;
            }
            /* 帖子页按钮多，分组：分隔线与下载组高亮，避免一长条同色按钮糊成一片 */
            .bgsh-toast-icon[hidden] { display: none !important; }
            .bgsh-toolbar .bgsh-toolbar-sep {
                width: 34px;
                height: 1px;
                flex: 0 0 auto;
                background: linear-gradient(90deg, transparent, rgba(247,151,30,.55), transparent);
                margin: 2px 0;
            }
            .bgsh-toolbar .bgsh-btn-download {
                background: linear-gradient(135deg, #f5576c, #f093fb);
                color: #fff;
            }
            .bgsh-toolbar .bgsh-btn-download:hover {
                box-shadow: 0 8px 26px rgba(245,87,108,.4);
            }
            .bgsh-toolbar .bgsh-btn-sub {
                background: rgba(247,151,30,.14);
                color: #a85f0d;
                font-weight: 500;
            }
            [data-bgsh-theme="dark"] .bgsh-toolbar .bgsh-btn-sub {
                background: rgba(247,151,30,.18);
                color: #ffd200;
            }
            .bgsh-toolbar .bgsh-customBtn {
                width: 108px;
                min-width: 108px;
                max-width: 108px;
                padding: 8px 10px;
                border-radius: 10px;
                font-size: 13px;
                font-weight: 500;
                box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                background: linear-gradient(135deg, #f7971e, #ffd200);
                color: #3d2a1a;
                transition: all 0.3s ease;
                margin: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                text-align: center;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                line-height: 1.3;
            }
            .bgsh-toolbar .bgsh-customBtn:hover {
                transform: translateY(-2px);
                box-shadow: var(--bgsh-shadow-hover);
            }
            .bgsh-toolbar .bgsh-customBtn:active {
                transform: scale(0.96);
            }
            .bgsh-toolbar::-webkit-scrollbar { width: 3px; }
            .bgsh-toolbar::-webkit-scrollbar-thumb {
                background: var(--bgsh-primary);
                border-radius: 3px;
            }
            /* “同步所有出售主题”只允许出现在功能设置内部。 */
            #syncSaleThreadBuyInfo.bgsh-settings-only-action { display: none !important; }
            #settingsUIContainer #syncSaleThreadBuyInfo.bgsh-settings-only-action {
                display: inline-flex !important;
                width: auto;
                margin: 0;
            }
            /* ----- ROG 大体积资源标题高亮 ----- */
            a.bgsh-large-resource-title {
                color: var(--bgsh-large-resource-title-color, #ff6a00) !important;
                font-weight: 900 !important;
                text-shadow: 0 1px 0 rgba(255,255,255,.75), 0 0 5px rgba(255,106,0,.34) !important;
                letter-spacing: .15px;
            }
            [data-bgsh-theme="dark"] a.bgsh-large-resource-title {
                color: var(--bgsh-large-resource-title-color, #ff8a1f) !important;
                text-shadow: 0 1px 0 rgba(0,0,0,.9), 0 0 6px rgba(255,106,0,.48) !important;
            }

            /* ----- 通用对话框 (搜索 & 设置) ----- */
            .bgsh-dialog-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                z-index: 99999;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: bgshFadeIn 0.3s ease-out;
            }
            @keyframes bgshFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            .bgsh-dialog {
                background: var(--bgsh-bg-light);
                backdrop-filter: var(--bgsh-backdrop);
                -webkit-backdrop-filter: var(--bgsh-backdrop);
                border-radius: var(--bgsh-radius);
                width: 820px;
                max-width: 94vw;
                max-height: 88vh;
                box-shadow: 0 32px 80px rgba(0,0,0,0.25);
                overflow: hidden;
                display: flex;
                flex-direction: column;
                animation: bgshSlideUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
                border: 1px solid var(--bgsh-border-light);
                font-family: var(--bgsh-font);
            }
            [data-bgsh-theme="dark"] .bgsh-dialog {
                background: var(--bgsh-bg-dark);
                border-color: var(--bgsh-border-dark);
                color: var(--bgsh-text-dark);
            }
            @keyframes bgshSlideUp {
                from { opacity: 0; transform: scale(0.92) translateY(30px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
            }
            .bgsh-dialog-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 18px 24px;
                border-bottom: 1px solid rgba(0,0,0,0.06);
                background: rgba(255,248,235,0.2);
                flex-shrink: 0;
            }
            [data-bgsh-theme="dark"] .bgsh-dialog-header {
                border-color: var(--bgsh-border-dark);
                background: rgba(255,248,235,0.05);
            }
            .bgsh-dialog-title {
                display: flex;
                align-items: center;
                gap: 10px;
                margin: 0;
                font-size: 18px;
                font-weight: 700;
                color: var(--bgsh-text-light);
            }
            [data-bgsh-theme="dark"] .bgsh-dialog-title {
                color: var(--bgsh-text-dark);
            }
            .bgsh-dialog-title .badge {
                font-size: 11px;
                background: var(--bgsh-primary-gradient);
                color: #3d2a1a;
                padding: 2px 12px;
                border-radius: 12px;
                font-weight: 500;
            }
            .bgsh-dialog-close {
                font-size: 24px;
                color: #999;
                cursor: pointer;
                padding: 4px 8px;
                border-radius: 8px;
                border: none;
                background: none;
                transition: all 0.2s;
            }
            .bgsh-dialog-close:hover {
                background: rgba(0,0,0,0.06);
                color: #333;
            }
            [data-bgsh-theme="dark"] .bgsh-dialog-close:hover {
                background: rgba(255,255,255,0.06);
                color: #ccc;
            }
            .bgsh-dialog-body {
                padding: 20px 24px;
                overflow-y: auto;
                flex: 1;
            }
            .bgsh-dialog-body::-webkit-scrollbar { width: 5px; }
            .bgsh-dialog-body::-webkit-scrollbar-thumb {
                background: rgba(247,151,30,0.3);
                border-radius: 10px;
            }
            .bgsh-dialog-footer {
                display: flex;
                justify-content: flex-end;
                gap: 10px;
                padding: 14px 24px;
                border-top: 1px solid rgba(0,0,0,0.06);
                background: rgba(255,248,235,0.2);
                flex-shrink: 0;
            }
            [data-bgsh-theme="dark"] .bgsh-dialog-footer {
                border-color: var(--bgsh-border-dark);
                background: rgba(255,248,235,0.05);
            }

            /* ----- 搜索对话框特有 (升级版) ----- */
            .bgsh-search-input-group {
                display: flex;
                gap: 10px;
                margin-bottom: 6px;
                position: relative;
            }
            .bgsh-search-input {
                flex: 1;
                height: 46px;
                padding: 0 18px;
                border: 2px solid rgba(0,0,0,0.08);
                border-radius: var(--bgsh-radius-sm);
                font-size: 15px;
                outline: none;
                transition: all 0.25s ease;
                background: rgba(255,255,255,0.5);
                backdrop-filter: blur(4px);
                color: var(--bgsh-text-light);
            }
            [data-bgsh-theme="dark"] .bgsh-search-input {
                background: rgba(255,255,255,0.05);
                border-color: var(--bgsh-border-dark);
                color: var(--bgsh-text-dark);
            }
            .bgsh-search-input:focus {
                border-color: var(--bgsh-primary);
                box-shadow: 0 0 0 4px rgba(247,151,30,0.12);
                background: rgba(255,255,255,0.8);
            }
            .bgsh-search-hint {
                font-size: 12px;
                color: #aaa;
                margin: 4px 0 12px 0;
                display: flex;
                justify-content: space-between;
                flex-wrap: wrap;
                gap: 4px;
            }
            .bgsh-search-hint kbd {
                background: rgba(0,0,0,0.06);
                padding: 1px 8px;
                border-radius: 4px;
                font-size: 11px;
                color: #666;
                border: 1px solid rgba(0,0,0,0.06);
            }
            [data-bgsh-theme="dark"] .bgsh-search-hint kbd {
                background: rgba(255,255,255,0.06);
                color: #aaa;
                border-color: var(--bgsh-border-dark);
            }
            .bgsh-search-filters {
                display: flex;
                flex-wrap: wrap;
                gap: 6px 12px;
                padding: 8px 12px;
                background: rgba(0,0,0,0.03);
                border-radius: var(--bgsh-radius-sm);
                margin-bottom: 12px;
            }
            [data-bgsh-theme="dark"] .bgsh-search-filters {
                background: rgba(255,255,255,0.03);
            }
            .bgsh-filter-label {
                font-size: 12px;
                font-weight: 600;
                color: #999;
                display: flex;
                align-items: center;
                margin-right: 4px;
            }
            .bgsh-search-filters label {
                display: flex;
                align-items: center;
                gap: 4px;
                font-size: 13px;
                color: #555;
                cursor: pointer;
                padding: 2px 10px;
                border-radius: 8px;
                background: rgba(255,255,255,0.5);
                border: 1px solid rgba(0,0,0,0.04);
                transition: all 0.15s;
            }
            [data-bgsh-theme="dark"] .bgsh-search-filters label {
                background: rgba(255,255,255,0.05);
                border-color: var(--bgsh-border-dark);
                color: #ccc;
            }
            .bgsh-search-filters label:hover {
                background: rgba(247,151,30,0.08);
                border-color: var(--bgsh-primary);
            }
            .bgsh-search-filters input[type="radio"],
            .bgsh-search-filters input[type="checkbox"] {
                accent-color: var(--bgsh-primary);
                margin: 0;
            }
            /* 搜索历史 */
            .bgsh-search-history {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                padding: 8px 0 4px 0;
                border-top: 1px solid rgba(0,0,0,0.04);
                margin-top: 8px;
            }
            .bgsh-search-history .history-tag {
                background: rgba(247,151,30,0.12);
                padding: 2px 10px;
                border-radius: 12px;
                font-size: 12px;
                color: var(--bgsh-primary);
                cursor: pointer;
                transition: all 0.15s;
                border: 1px solid rgba(247,151,30,0.15);
            }
            .bgsh-search-history .history-tag:hover {
                background: rgba(247,151,30,0.25);
                transform: scale(1.05);
            }
            .bgsh-search-history .history-clear {
                font-size: 11px;
                color: #999;
                cursor: pointer;
                padding: 2px 8px;
                border-radius: 8px;
                background: rgba(0,0,0,0.04);
                border: none;
            }
            .bgsh-search-history .history-clear:hover {
                background: rgba(255,0,0,0.08);
                color: #ff6b6b;
            }

            .bgsh-search-boards {
                border-top: 1px solid rgba(0,0,0,0.06);
                padding-top: 14px;
                margin-top: 6px;
            }
            [data-bgsh-theme="dark"] .bgsh-search-boards {
                border-color: var(--bgsh-border-dark);
            }
            .bgsh-search-boards-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 8px;
                margin-bottom: 8px;
            }
            .bgsh-search-boards-header span {
                font-size: 13px;
                font-weight: 600;
                color: #666;
            }
            [data-bgsh-theme="dark"] .bgsh-search-boards-header span {
                color: #ccc;
            }
            .bgsh-search-boards-header .count {
                font-size: 12px;
                color: #999;
                font-weight: 400;
            }
            .bgsh-search-boards-header .bgsh-btn {
                padding: 2px 14px;
                font-size: 12px;
            }
            .bgsh-search-board-groups {
                display: flex;
                flex-direction: column;
                gap: 8px;
                max-height: 260px;
                overflow-y: auto;
            }
            .bgsh-search-board-groups::-webkit-scrollbar { width: 4px; }
            .bgsh-search-board-groups::-webkit-scrollbar-thumb {
                background: rgba(247,151,30,0.3);
                border-radius: 4px;
            }
            .bgsh-search-board-group {
                background: rgba(0,0,0,0.02);
                border-radius: var(--bgsh-radius-sm);
                padding: 6px 10px;
            }
            [data-bgsh-theme="dark"] .bgsh-search-board-group {
                background: rgba(255,255,255,0.02);
            }
            .bgsh-search-board-group-title {
                font-size: 11px;
                font-weight: 700;
                color: #888;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 4px;
                padding-bottom: 3px;
                border-bottom: 1px dashed rgba(0,0,0,0.06);
            }
            [data-bgsh-theme="dark"] .bgsh-search-board-group-title {
                color: #666;
                border-color: var(--bgsh-border-dark);
            }
            .bgsh-search-board-items {
                display: flex;
                flex-wrap: wrap;
                gap: 4px;
            }
            .bgsh-search-board-items label {
                display: flex;
                align-items: center;
                gap: 4px;
                font-size: 12px;
                color: #555;
                cursor: pointer;
                padding: 2px 8px;
                border-radius: 6px;
                background: rgba(255,255,255,0.5);
                border: 1px solid rgba(0,0,0,0.04);
                transition: all 0.15s;
            }
            [data-bgsh-theme="dark"] .bgsh-search-board-items label {
                background: rgba(255,255,255,0.03);
                border-color: var(--bgsh-border-dark);
                color: #ccc;
            }
            .bgsh-search-board-items label:hover {
                background: rgba(247,151,30,0.08);
            }
            .bgsh-search-board-items label.checked {
                background: rgba(247,151,30,0.15);
                border-color: var(--bgsh-primary);
                color: var(--bgsh-primary);
            }
            .bgsh-search-board-items input[type="checkbox"] {
                accent-color: var(--bgsh-primary);
                width: 13px;
                height: 13px;
                margin: 0;
            }
            .bgsh-board-star {
                margin-left: 2px;
                color: #bbb;
                font-size: 13px;
                line-height: 1;
                cursor: pointer;
                user-select: none;
            }
            .bgsh-board-star:hover,
            .bgsh-board-star.active {
                color: #f5a623;
                transform: scale(1.12);
            }
            .bgsh-search-board-group.common {
                background: linear-gradient(135deg, rgba(247,151,30,0.12), rgba(255,210,90,0.08));
                border: 1px solid rgba(247,151,30,0.22);
            }
            .bgsh-search-board-group.common .bgsh-search-board-group-title {
                color: var(--bgsh-primary);
            }
            /* ----- 4.10 紧凑搜索布局 ----- */
            .bgsh-search-dialog { width: min(920px, 96vw); max-height: 94vh; }
            .bgsh-search-dialog .bgsh-dialog-body { padding: 14px 18px; }
            .bgsh-search-dialog .bgsh-search-hint { margin: 3px 0 7px; }
            .bgsh-search-filter-grid {
                display: grid;
                gap: 5px;
                padding: 7px 9px;
                margin-bottom: 7px;
                border-radius: 9px;
                background: rgba(0,0,0,.03);
            }
            [data-bgsh-theme="dark"] .bgsh-search-filter-grid { background: rgba(255,255,255,.035); }
            .bgsh-search-filter-row {
                display: grid;
                grid-template-columns: 58px minmax(0, 1fr);
                gap: 7px;
                align-items: center;
            }
            .bgsh-search-filter-options {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(82px, 1fr));
                gap: 5px;
                min-width: 0;
            }
            .bgsh-search-filter-options label {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 4px;
                min-height: 25px;
                padding: 1px 7px;
                border: 1px solid rgba(0,0,0,.05);
                border-radius: 7px;
                background: rgba(255,255,255,.55);
                color: #555;
                font-size: 12px;
                cursor: pointer;
                box-sizing: border-box;
            }
            [data-bgsh-theme="dark"] .bgsh-search-filter-options label {
                background: rgba(255,255,255,.05);
                border-color: var(--bgsh-border-dark);
                color: #ccc;
            }
            .bgsh-search-filter-options label:hover { border-color: var(--bgsh-primary); }
            .bgsh-search-filter-options input { margin: 0; accent-color: var(--bgsh-primary); }
            .bgsh-search-keyword-row {
                display: grid;
                grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
                gap: 8px;
                margin-top: 7px;
            }
            .bgsh-search-keyword-row .bgsh-search-input {
                width: 100%;
                min-width: 0;
                height: 36px;
                padding: 0 12px;
                font-size: 12px;
                box-sizing: border-box;
            }
            .bgsh-search-history {
                display: grid;
                grid-template-columns: auto minmax(0, 1fr) auto;
                align-items: center;
                gap: 7px;
                padding: 5px 0;
                margin: 2px 0 5px;
                border-top: 0;
            }
            .bgsh-search-history-label { color: #888; font-size: 12px; white-space: nowrap; }
            .bgsh-search-history-select {
                width: 100%;
                min-width: 0;
                height: 30px;
                padding: 0 8px;
                border: 1px solid rgba(0,0,0,.12);
                border-radius: 7px;
                background: rgba(255,255,255,.65);
                color: inherit;
            }
            .bgsh-search-boards { padding-top: 7px; margin-top: 3px; }
            .bgsh-search-boards-header { margin-bottom: 5px; }
            .bgsh-search-boards.collapsed .bgsh-search-board-groups { display: none; }
            .bgsh-search-boards.collapsed { border-bottom: 1px solid rgba(0,0,0,.05); padding-bottom: 5px; }
            .bgsh-search-board-toggle { min-width: 76px; }
            @media (max-width: 640px) {
                .bgsh-search-filter-row { grid-template-columns: 48px minmax(0, 1fr); }
                .bgsh-search-filter-options { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                .bgsh-search-keyword-row { grid-template-columns: 1fr; }
                .bgsh-search-history { grid-template-columns: 1fr auto; }
                .bgsh-search-history-label { display: none; }
            }

            /* ----- 设置面板 (升级版) ----- */
            .bgsh-settings-tabs {
                display: flex;
                flex-direction: column;
                gap: 4px;
                padding: 12px 0;
                background: rgba(0,0,0,0.02);
                border-right: 1px solid rgba(0,0,0,0.06);
                flex-shrink: 0;
                width: 120px;
            }
            [data-bgsh-theme="dark"] .bgsh-settings-tabs {
                background: rgba(255,255,255,0.02);
                border-color: var(--bgsh-border-dark);
            }
            .bgsh-tab-btn {
                padding: 10px 16px;
                border: none;
                background: transparent;
                text-align: left;
                font-size: 13px;
                font-weight: 500;
                color: #888;
                cursor: pointer;
                transition: all 0.2s;
                border-radius: 0 10px 10px 0;
                position: relative;
            }
            .bgsh-tab-btn:hover {
                background: rgba(247,151,30,0.06);
                color: #555;
            }
            [data-bgsh-theme="dark"] .bgsh-tab-btn:hover {
                background: rgba(247,151,30,0.1);
                color: #ccc;
            }
            .bgsh-tab-btn.active {
                background: var(--bgsh-primary-gradient);
                color: #3d2a1a;
                box-shadow: 0 4px 20px rgba(247,151,30,0.3);
            }
            .bgsh-tab-btn.active::before {
                content: "";
                position: absolute;
                left: 0;
                top: 20%;
                height: 60%;
                width: 3px;
                background: #3d2a1a;
                border-radius: 0 3px 3px 0;
            }
            .bgsh-settings-content {
                flex: 1;
                padding: 16px 20px;
                overflow-y: auto;
                background: rgba(255,255,255,0.05);
            }
            [data-bgsh-theme="dark"] .bgsh-settings-content {
                background: rgba(255,255,255,0.02);
            }
            .bgsh-tab-panel {
                display: none;
                animation: bgshFadeContent 0.25s ease-out;
            }
            .bgsh-tab-panel.active { display: block; }
            @keyframes bgshFadeContent {
                from { opacity: 0; transform: translateY(8px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .bgsh-setting-group {
                display: flex;
                flex-direction: column;
                gap: 12px;
                margin-bottom: 16px;
            }
            .bgsh-setting-item {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            .bgsh-setting-item > label:not(.bgsh-switch-label) {
                font-size: 12px;
                font-weight: 600;
                color: #555;
            }
            [data-bgsh-theme="dark"] .bgsh-setting-item > label:not(.bgsh-switch-label) {
                color: #ccc;
            }
            .bgsh-setting-item input[type="text"],
            .bgsh-setting-item input[type="number"],
            .bgsh-setting-item select,
            .bgsh-setting-item textarea {
                padding: 8px 14px;
                border: 2px solid rgba(0,0,0,0.06);
                border-radius: var(--bgsh-radius-sm);
                font-size: 13px;
                color: var(--bgsh-text-light);
                background: rgba(255,255,255,0.5);
                backdrop-filter: blur(4px);
                transition: all 0.25s ease;
                outline: none;
                font-family: var(--bgsh-font);
            }
            .bgsh-setting-item textarea {
                resize: vertical;
                min-height: 80px;
                line-height: 1.6;
            }
            [data-bgsh-theme="dark"] .bgsh-setting-item input,
            [data-bgsh-theme="dark"] .bgsh-setting-item select,
            [data-bgsh-theme="dark"] .bgsh-setting-item textarea {
                background: rgba(255,255,255,0.05);
                border-color: var(--bgsh-border-dark);
                color: var(--bgsh-text-dark);
            }
            .bgsh-setting-item input:focus,
            .bgsh-setting-item select:focus,
            .bgsh-setting-item textarea:focus {
                border-color: var(--bgsh-primary);
                box-shadow: 0 0 0 4px rgba(247,151,30,0.1);
                background: rgba(255,255,255,0.8);
            }
            .bgsh-hint {
                font-size: 11px;
                color: #aaa;
                margin-top: 2px;
            }
            [data-bgsh-theme="dark"] .bgsh-hint { color: #666; }
            .bgsh-switch-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 4px 16px;
            }
            .bgsh-switch-label {
                display: inline-flex;
                align-items: center;
                cursor: pointer;
                font-size: 13px;
                font-weight: 400;
                color: #555;
                gap: 10px;
                user-select: none;
                padding: 6px 0;
                min-height: 32px;
                flex-shrink: 0;
                flex-wrap: nowrap;
            }
            [data-bgsh-theme="dark"] .bgsh-switch-label {
                color: #ccc;
            }
            .bgsh-switch-label input {
                display: none;
            }
            .bgsh-switch-slider {
                position: relative;
                width: 42px;
                min-width: 42px;
                height: 24px;
                background: rgba(0,0,0,0.15);
                border-radius: 12px;
                transition: all 0.3s ease;
                flex-shrink: 0;
                display: inline-block;
            }
            [data-bgsh-theme="dark"] .bgsh-switch-slider {
                background: rgba(255,255,255,0.1);
            }
            .bgsh-switch-slider::after {
                content: "";
                position: absolute;
                top: 2px;
                left: 2px;
                width: 20px;
                height: 20px;
                background: #fff;
                border-radius: 50%;
                transition: all 0.3s ease;
                box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            }
            .bgsh-switch-label input:checked + .bgsh-switch-slider {
                background: var(--bgsh-primary-gradient);
            }
            .bgsh-switch-label input:checked + .bgsh-switch-slider::after {
                left: 20px;
            }
            .bgsh-switch-text {
                font-weight: 400;
                font-size: 13px;
                color: #555;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                flex: 1;
                min-width: 0;
            }
            [data-bgsh-theme="dark"] .bgsh-switch-text { color: #ccc; }
            .bgsh-radio-group {
                display: flex;
                flex-wrap: wrap;
                gap: 4px;
                margin-top: 2px;
            }
            .bgsh-radio-label {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                font-size: 12px;
                color: #555;
                cursor: pointer;
                padding: 4px 12px;
                border-radius: 8px;
                background: rgba(255,255,255,0.5);
                transition: all 0.15s;
                border: 1px solid rgba(0,0,0,0.04);
            }
            [data-bgsh-theme="dark"] .bgsh-radio-label {
                background: rgba(255,255,255,0.03);
                border-color: var(--bgsh-border-dark);
                color: #ccc;
            }
            .bgsh-radio-label:hover {
                background: rgba(247,151,30,0.06);
            }
            .bgsh-radio-label input[type="radio"] {
                accent-color: var(--bgsh-primary);
                width: 14px;
                height: 14px;
                margin: 0;
                flex-shrink: 0;
            }
            .bgsh-radio-label:has(input:checked) {
                background: rgba(247,151,30,0.12);
                border-color: var(--bgsh-primary);
                color: var(--bgsh-primary);
            }

            /* ----- 图片预览遮罩 ----- */
            .bgsh-image-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.85);
                backdrop-filter: blur(20px);
                z-index: 99998;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: zoom-out;
                animation: bgshFadeIn 0.3s ease-out;
            }
            .bgsh-image-overlay img {
                max-width: 92vw;
                max-height: 92vh;
                border-radius: 12px;
                box-shadow: 0 32px 80px rgba(0,0,0,0.5);
                animation: bgshZoomIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            .bgsh-image-viewer {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 100%;
                height: 100%;
            }
            .bgsh-image-actions {
                position: fixed;
                left: 50%;
                bottom: 24px;
                transform: translateX(-50%);
                z-index: 2;
                display: flex;
                gap: 10px;
                padding: 8px 10px;
                border-radius: 12px;
                background: rgba(20,20,20,.78);
                backdrop-filter: blur(12px);
                cursor: default;
            }
            .bgsh-image-action {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-height: 34px;
                padding: 0 14px;
                border: 1px solid rgba(255,255,255,.2);
                border-radius: 8px;
                background: rgba(255,255,255,.12);
                color: #fff !important;
                text-decoration: none !important;
                font-size: 13px;
                cursor: pointer;
            }
            .bgsh-image-action:hover { background: rgba(247,151,30,.85); }
            img.bgsh-post-lazy {
                min-height: 96px;
                background: linear-gradient(110deg, rgba(247,151,30,.08) 30%, rgba(255,210,0,.18) 50%, rgba(247,151,30,.08) 70%);
                background-size: 200% 100%;
                animation: bgshLazyPulse 1.4s linear infinite;
            }
            img.bgsh-post-lazy-loaded {
                min-height: 0;
                animation: none;
                background: transparent;
            }
            /* 页面级帖子图片开关：论坛购买后即使替换正文节点，新图片仍继承当前状态。 */
            html[data-bgsh-post-images="hide"] img.zoom,
            html[data-bgsh-post-images="hide"] .t_f img,
            html[data-bgsh-post-images="hide"] [id^="postmessage_"] img {
                display: none !important;
            }
            @keyframes bgshLazyPulse { to { background-position-x: -200%; } }
            /* ----- 紧凑型主题预览图 ----- */
            .bgsh-pt {
                display: grid !important;
                grid-auto-flow: row !important;
                align-items: flex-start !important;
                justify-content: flex-start !important;
                min-width: 0 !important;
                width: 100% !important;
                max-width: 100% !important;
                overflow: hidden !important;
                clear: both !important;
                float: none !important;
                box-sizing: border-box !important;
                gap: 4px !important;
                line-height: 0 !important;
                margin-top: 4px !important;
            }
            .bgsh-pt > img {
                display: block !important;
                flex: 0 0 auto !important;
                width: var(--bgsh-effective-preview-size, 100%) !important;
                max-width: var(--bgsh-preview-size, 180px) !important;
                height: var(--bgsh-effective-preview-height, auto) !important;
                aspect-ratio: 4 / 3 !important;
                margin: 0 !important;
                padding: 0 !important;
                object-fit: cover !important;
                vertical-align: top !important;
            }
            .bgsh-favorite-preview > img {
                width: var(--bgsh-effective-preview-size, var(--bgsh-preview-size, 180px)) !important;
                height: var(--bgsh-effective-preview-height, var(--bgsh-preview-height, 135px)) !important;
                object-fit: cover !important;
                flex: 0 0 auto !important;
            }
            .bgsh-my-post-preview-row > td {
                padding: 2px 8px 8px 28px !important;
                border-top: 0 !important;
                box-sizing: border-box !important;
            }
            .bgsh-my-post-preview-host {
                display: block !important;
                width: 100% !important;
                max-width: 100% !important;
                overflow: visible !important;
                box-sizing: border-box !important;
            }
            @keyframes bgshZoomIn {
                from { transform: scale(0.8); opacity: 0; }
                to { transform: scale(1); opacity: 1; }
            }

            /* ----- 水印特效 ----- */
            .bgsh-watermark-wrapper {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 9999;
            }
            .bgsh-watermark-text {
                position: absolute;
                text-align: center;
                font-size: 30px;
                color: rgba(255,0,0,0.15);
                font-weight: bold;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: bgshWatermarkFloat 20s infinite alternate ease-in-out;
            }
            @keyframes bgshWatermarkFloat {
                0% { transform: rotate(-2deg) scale(1); }
                100% { transform: rotate(2deg) scale(1.05); }
            }
            .bgsh-watermark-text .icon {
                width: 30px;
                height: 30px;
                fill: rgba(255,0,0,0.15);
                margin: 0 5px;
            }

            /* ----- 板块筛选栏 (新增) ----- */
            /* 宽度对齐站点原生容器（#ct 版块内容区），不再写死 960px。
               站点宽度是流式的，写死像素会出现「插件块比论坛主体窄/宽一截」。 */
            .bgsh-board-filter {
                background: var(--bgsh-bg-light);
                backdrop-filter: blur(24px);
                -webkit-backdrop-filter: blur(24px);
                border-radius: var(--bgsh-radius);
                border: 1px solid var(--bgsh-border-light);
                box-shadow: var(--bgsh-shadow);
                box-sizing: border-box;
                width: auto;
                max-width: none;
                margin: 10px 0 18px 0;
                overflow: hidden;
                font-family: var(--bgsh-font);
                transition: all 0.3s ease;
            }
            [data-bgsh-theme="dark"] .bgsh-board-filter {
                background: var(--bgsh-bg-dark);
                border-color: var(--bgsh-border-dark);
                box-shadow: 0 12px 48px rgba(0,0,0,0.5);
            }
            .bgsh-board-filter-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 10px 16px;
                background: var(--bgsh-primary-gradient);
                color: #3d2a1a;
                font-weight: 700;
                font-size: 14px;
                cursor: pointer;
                user-select: none;
            }
            .bgsh-board-filter-header span { display: flex; align-items: center; gap: 6px; }
            .bgsh-board-filter-toggle {
                font-size: 11px;
                opacity: 0.7;
                cursor: pointer;
                transition: opacity 0.2s;
            }
            .bgsh-board-filter-toggle:hover { opacity: 1; }
            .bgsh-board-filter-body {
                padding: 8px 12px;
                transition: max-height 0.3s ease, opacity 0.3s ease;
                max-height: 800px;
                overflow: hidden;
                opacity: 1;
            }
            .bgsh-board-filter-body.collapsed {
                max-height: 0;
                padding-top: 0;
                padding-bottom: 0;
                opacity: 0;
            }
            .bgsh-board-filter-section {
                margin-bottom: 6px;
            }
            .bgsh-board-filter-section-title {
                font-size: 11px;
                font-weight: 700;
                color: #888;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 4px;
                padding-bottom: 2px;
                border-bottom: 1px dashed rgba(0,0,0,0.06);
            }
            [data-bgsh-theme="dark"] .bgsh-board-filter-section-title {
                color: #666;
                border-color: var(--bgsh-border-dark);
            }
            .bgsh-board-filter-groups {
                display: flex;
                flex-wrap: wrap;
                gap: 6px 8px;
                margin-bottom: 8px;
            }
            .bgsh-board-filter-btn {
                padding: 5px 14px;
                border: 2px solid rgba(247,151,30,0.2);
                border-radius: 20px;
                background: rgba(255,255,255,0.5);
                color: #666;
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                outline: none;
                font-family: var(--bgsh-font);
                white-space: nowrap;
            }
            [data-bgsh-theme="dark"] .bgsh-board-filter-btn {
                background: rgba(255,255,255,0.05);
                border-color: rgba(247,151,30,0.15);
                color: #aaa;
            }
            .bgsh-board-filter-btn:hover {
                background: rgba(247,151,30,0.1);
                border-color: var(--bgsh-primary);
                color: var(--bgsh-text-light);
                transform: translateY(-1px);
            }
            .bgsh-board-filter-btn.active {
                background: var(--bgsh-primary-gradient);
                border-color: var(--bgsh-primary);
                color: #3d2a1a;
                box-shadow: 0 2px 12px rgba(247,151,30,0.3);
            }
            .bgsh-board-filter-btn.small {
                padding: 3px 10px;
                font-size: 11px;
            }
            .bgsh-board-filter-items {
                display: flex;
                flex-wrap: wrap;
                gap: 4px;
            }
            .bgsh-board-filter-items label {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                font-size: 11px;
                color: #666;
                cursor: pointer;
                padding: 2px 8px;
                border-radius: 6px;
                background: rgba(255,255,255,0.3);
                border: 1px solid rgba(0,0,0,0.04);
                transition: all 0.15s;
                user-select: none;
            }
            [data-bgsh-theme="dark"] .bgsh-board-filter-items label {
                background: rgba(255,255,255,0.03);
                border-color: var(--bgsh-border-dark);
                color: #bbb;
            }
            .bgsh-board-filter-items label:hover {
                background: rgba(247,151,30,0.08);
            }
            .bgsh-board-filter-items label.checked {
                background: rgba(247,151,30,0.15);
                border-color: var(--bgsh-primary);
                color: var(--bgsh-primary);
            }
            .bgsh-board-filter-items input[type="checkbox"] {
                accent-color: var(--bgsh-primary);
                width: 12px;
                height: 12px;
                margin: 0;
            }
            .bgsh-board-filter-count {
                font-size: 11px;
                color: #aaa;
                padding: 4px 0 0 4px;
            }
            [data-bgsh-theme="dark"] .bgsh-board-filter-count { color: #666; }

            /* ----- 主题分类筛选栏 (新增) ----- */
            .bgsh-type-filter {
                background: var(--bgsh-bg-light);
                backdrop-filter: blur(24px);
                -webkit-backdrop-filter: blur(24px);
                border-radius: var(--bgsh-radius);
                border: 1px solid var(--bgsh-border-light);
                box-shadow: var(--bgsh-shadow);
                box-sizing: border-box;
                width: auto;
                max-width: none;
                margin: 10px 0 18px 0;
                overflow: hidden;
                font-family: var(--bgsh-font);
                transition: all 0.3s ease;
            }
            [data-bgsh-theme="dark"] .bgsh-type-filter {
                background: var(--bgsh-bg-dark);
                border-color: var(--bgsh-border-dark);
                box-shadow: 0 12px 48px rgba(0,0,0,0.5);
            }
            .bgsh-type-filter-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 10px 16px;
                background: var(--bgsh-primary-gradient);
                color: #3d2a1a;
                font-weight: 700;
                font-size: 14px;
                cursor: pointer;
                user-select: none;
            }
            .bgsh-type-filter-header span { display: flex; align-items: center; gap: 6px; }
            .bgsh-type-filter-toggle {
                font-size: 11px;
                opacity: 0.7;
                cursor: pointer;
                transition: opacity 0.2s;
            }
            .bgsh-type-filter-toggle:hover { opacity: 1; }
            .bgsh-type-filter-body {
                padding: 8px 12px;
                transition: max-height 0.3s ease, opacity 0.3s ease;
                max-height: 800px;
                overflow: hidden;
                opacity: 1;
            }
            .bgsh-type-filter-body.collapsed {
                max-height: 0;
                padding-top: 0;
                padding-bottom: 0;
                opacity: 0;
            }
            .bgsh-type-filter-types {
                display: flex;
                flex-wrap: wrap;
                gap: 6px 8px;
                margin-bottom: 4px;
            }
            .bgsh-type-filter-btn {
                padding: 5px 14px;
                border: 2px solid rgba(247,151,30,0.2);
                border-radius: 20px;
                background: rgba(255,255,255,0.5);
                color: #666;
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                outline: none;
                font-family: var(--bgsh-font);
                white-space: nowrap;
            }
            [data-bgsh-theme="dark"] .bgsh-type-filter-btn {
                background: rgba(255,255,255,0.05);
                border-color: rgba(247,151,30,0.15);
                color: #aaa;
            }
            .bgsh-type-filter-btn:hover {
                background: rgba(247,151,30,0.1);
                border-color: var(--bgsh-primary);
                color: var(--bgsh-text-light);
                transform: translateY(-1px);
            }
            .bgsh-type-filter-btn.active {
                background: var(--bgsh-primary-gradient);
                border-color: var(--bgsh-primary);
                color: #3d2a1a;
                box-shadow: 0 2px 12px rgba(247,151,30,0.3);
            }
            .bgsh-type-filter-count {
                font-size: 11px;
                color: #aaa;
                padding: 4px 0 0 4px;
            }
            [data-bgsh-theme="dark"] .bgsh-type-filter-count { color: #666; }
            .bgsh-type-filter-pills {
                display: flex;
                flex-wrap: wrap;
                gap: 6px 8px;
                padding: 6px 4px;
            }
            .bgsh-type-pill {
                display: inline-block;
                padding: 4px 14px;
                background: rgba(247,151,30,0.10);
                border: 2px solid rgba(247,151,30,0.15);
                border-radius: 20px;
                font-size: 12px;
                font-weight: 500;
                color: #c47a1a;
                text-decoration: none;
                transition: all 0.15s;
                white-space: nowrap;
                cursor: pointer;
            }
            .bgsh-type-pill:hover {
                background: rgba(247,151,30,0.25);
                color: #3d2a1a;
                transform: translateY(-1px);
            }
            .bgsh-type-pill.active {
                background: var(--bgsh-primary-gradient);
                border-color: var(--bgsh-primary);
                color: #3d2a1a;
                box-shadow: 0 2px 12px rgba(247,151,30,0.3);
            }
            [data-bgsh-theme="dark"] .bgsh-type-pill {
                background: rgba(247,151,30,0.12);
                border-color: rgba(247,151,30,0.2);
                color: #f0d080;
            }
            [data-bgsh-theme="dark"] .bgsh-type-pill:hover {
                background: rgba(247,151,30,0.3);
                color: #ffd200;
            }
            [data-bgsh-theme="dark"] .bgsh-type-pill.active {
                color: #3d2a1a;
            }

            /* ----- 板块列表行 ----- */
            .bgsh-board-filter-rows {
                display: flex;
                flex-direction: column;
                gap: 2px;
                padding: 4px 0;
            }
            .bgsh-board-filter-row {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 3px 6px;
                border-radius: 6px;
                transition: background 0.15s;
            }
            .bgsh-board-filter-row:hover {
                background: rgba(247,151,30,0.06);
            }
            .bgsh-board-filter-cb {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                cursor: pointer;
                user-select: none;
                min-width: 100px;
                flex-shrink: 0;
            }
            .bgsh-board-filter-cb input[type="checkbox"] {
                accent-color: var(--bgsh-primary);
                width: 13px;
                height: 13px;
                margin: 0;
                cursor: pointer;
            }
            .bgsh-board-link {
                color: #4a2e1b;
                text-decoration: none;
                font-size: 13px;
                font-weight: 500;
                transition: color 0.15s;
                white-space: nowrap;
            }
            .bgsh-board-link:hover {
                color: #f7971e;
                text-decoration: underline;
            }
            [data-bgsh-theme="dark"] .bgsh-board-link {
                color: #f0e0c0;
            }
            [data-bgsh-theme="dark"] .bgsh-board-link:hover {
                color: #ffd200;
            }
            .bgsh-board-types {
                display: flex;
                align-items: center;
                gap: 3px;
                flex-wrap: wrap;
            }

            /* ----- 响应式优化 ----- */
            @media (max-width: 640px) {
                .bgsh-dialog { max-width: 98vw; max-height: 95vh; }
                .bgsh-dialog-body { padding: 16px; }
                .bgsh-settings-tabs {
                    flex-direction: row;
                    width: 100%;
                    padding: 6px 10px;
                    border-right: none;
                    border-bottom: 1px solid rgba(0,0,0,0.06);
                    overflow-x: auto;
                    gap: 2px;
                }
                .bgsh-tab-btn {
                    padding: 6px 14px;
                    border-radius: var(--bgsh-radius-sm);
                    font-size: 12px;
                    white-space: nowrap;
                }
                .bgsh-tab-btn.active::before { display: none; }
                .bgsh-switch-grid { grid-template-columns: 1fr; gap: 2px; }
                .bgsh-switch-label { padding: 4px 0; min-height: 28px; }
                .bgsh-switch-text { font-size: 12px; }
                .bgsh-toolbar {
                    right: 6px;
                    gap: 4px;
                }
                .bgsh-toolbar .bgsh-customBtn {
                    width: 88px;
                    min-width: 88px;
                    max-width: 88px;
                    padding: 4px 6px;
                    font-size: 11px;
                }
                .bgsh-search-input-group { flex-wrap: wrap; }
                .bgsh-search-input { height: 40px; font-size: 14px; }
                .bgsh-search-go { height: 40px; padding: 0 20px; }
                .bgsh-board-filter { margin: 6px 8px; border-radius: var(--bgsh-radius-sm); }
                .bgsh-board-filter-header { padding: 8px 12px; font-size: 13px; }
                .bgsh-board-filter-body { padding: 6px 8px; }
                .bgsh-board-filter-btn { padding: 4px 10px; font-size: 11px; }
                .bgsh-board-filter-btn.small { padding: 2px 7px; font-size: 10px; }
                .bgsh-board-filter-items label { font-size: 10px; padding: 1px 6px; }
            }

            /* ----- 已读/未读帖子区别 ----- */
            a.s.xst:visited {
                opacity: 1 !important;
                color: var(--bgsh-visited-thread-color, #999999) !important;
            }
            a.s.xst:visited * {
                color: var(--bgsh-visited-thread-color, #999999) !important;
            }
            a.xst:visited,
            .searchresult a[href*="thread-"]:visited,
            .searchresult a[href*="tid="]:visited,
            #favorite_ul a[href*="thread-"]:visited,
            #favorite_ul a[href*="tid="]:visited,
            #bgshFavoriteApp a[href*="thread-"]:visited,
            #bgshFavoriteApp a[href*="tid="]:visited {
                opacity: 1 !important;
                color: var(--bgsh-visited-thread-color, #999999) !important;
            }
`;
        document.head.appendChild(style);
    }

    function applyVisitedThreadColor(settings) {
        var color = settings && /^#[0-9a-f]{6}$/i.test(settings.visitedThreadColor)
            ? settings.visitedThreadColor
            : "#999999";
        document.documentElement.style.setProperty("--bgsh-visited-thread-color", color);
    }

    function applyLargeResourceTitleColor(settings) {
        var color = settings && /^#[0-9a-f]{6}$/i.test(settings.largeResourceTitleColor)
            ? settings.largeResourceTitleColor
            : "#ff6a00";
        document.documentElement.style.setProperty("--bgsh-large-resource-title-color", color);
    }
    // #endregion

    // #region 按钮工厂 (保持长方形)
    function createButtonContainer() {
        const container = document.createElement("div");
        container.className = "bgsh-toolbar";
        return container;
    }

    const createButton = (id, text, clickFunction, className = "bgsh-customBtn") => {
        const button = document.createElement("button");
        button.id = id;
        button.innerText = text;
        button.className = className;
        button.addEventListener("click", clickFunction);
        return button;
    };
    // #endregion

    // #region 辅助函数
    // ===== 主题列表结构兼容层（Discuz X3.4 / X3.5 / 导读页） =====
    // X3.4 板块页：#threadlist > .bm_c > #threadlisttableid > tbody(id=normalthread_*) > tr > th/td
    // X3.5 导读页(forum.php?mod=guide) 等列表：没有 #threadlisttableid，
    //   tbody 直接挂在 #threadlist .bm_c 下的 table 上，同样是 tbody(id=normalthread_*)。
    // 统一走 THREAD_LIST_BODY_SELECTOR，禁止再写死 #threadlisttableid。
    const THREAD_LIST_BODY_SELECTOR = [
        "#threadlist .bm_c > table > tbody[id^='normalthread_']",
        "#threadlist .bm_c > table > tbody[id^='stickthread_']",
        "#threadlisttableid > tbody[id^='normalthread_']",
        "#threadlisttableid > tbody[id^='stickthread_']",
        "#threadlist tbody[id^='normalthread_']",
        "#threadlist tbody[id^='stickthread_']"
    ].join(", ");

    // 返回板块页的「主题表格」本体，找不到时退回 #threadlist 外壳。
    function getThreadListTable(root) {
        var scope = root && root.querySelector ? root : document;
        var table = scope.querySelector("#threadlisttableid") ||
            scope.querySelector("#threadlist .bm_c > table") ||
            scope.querySelector("#threadlist .tl table") ||
            scope.querySelector("#threadlist table");
        if (table) return table;
        var host = scope.querySelector ? scope.querySelector("#threadlist") : null;
        return host && host.matches && host.matches("table") ? host : (host || null);
    }

    // 站点标题不可靠时（CF 挑战页 / 站点改名）的兜底判定：
    // 只要页面本身是 Discuz 论坛结构，就认为运行环境正确。
    function looksLikeDiscuzForum(doc) {
        var d = doc || document;
        if (!d || !d.querySelector) return false;
        if (d.querySelector("#wp, #ct, #threadlist, #postlist, .bm, .bmw, #pgt")) return true;
        var generator = d.querySelector('meta[name="generator"]');
        if (generator && /Discuz/i.test(generator.getAttribute("content") || "")) return true;
        var pathname = (d.location && d.location.pathname) || "";
        return /(?:^|\/)(?:forum|home|search|plugin|member)\.php$/i.test(pathname) ||
            /\/thread-\d+-\d+-\d+\.html$/i.test(pathname) ||
            /\/forum-\d+-\d+\.html$/i.test(pathname);
    }

    function getCheckedRadioValue(name) {
        const radios = document.getElementsByName(name);
        for (let i = 0; i < radios.length; i++) {
            if (radios[i].checked) {
                return parseInt(radios[i].value);
            }
        }
        return null;
    }

    function getFormHash() {
        const element = document.querySelector('input[name="formhash"]');
        return element ? element.value : null;
    }

    function getUserId() {
        const userLink = document.querySelector(".vwmy a");
        if (userLink) {
            const match = userLink.href.match(/uid=(\d+)/);
            if (match) return match[1];
        }
        return null;
    }

    function getTableIdFromElement(element) {
        if (element) {
            let parentTable = element.closest("table");
            if (parentTable && parentTable.id.startsWith("pid")) {
                return parentTable.id.replace("pid", "");
            }
        }
        return null;
    }

    function getFidFromElement() {
        let element = document.querySelector("#newspecial");
        if (!element) return null;
        let hrefValue = element.getAttribute("onclick");
        if (!hrefValue) return null;
        let match = /fid=(\d+)/.exec(hrefValue);
        return match ? match[1] : null;
    }

    function extractTid(url) {
        let tid = null;
        const threadMatch = url.match(/thread-(\d+)-\d+-\d+\.html/);
        if (threadMatch && threadMatch.length > 1) {
            tid = threadMatch[1];
        } else {
            const queryMatch = url.match(/tid=(\d+)/);
            if (queryMatch && queryMatch.length > 1) {
                tid = queryMatch[1];
            }
        }
        return tid;
    }

    function getQueryParams(url) {
        const queryParams = {};
        if (url.includes("?")) {
            const queryPattern = /[?&]([^=&]+)=([^&]*)/g;
            let match;
            while ((match = queryPattern.exec(url)) !== null) {
                queryParams[match[1]] = decodeURIComponent(match[2]);
            }
        } else {
            const pathPattern = /forum-(\d+)-(\d+)\.html$/;
            const pathMatch = pathPattern.exec(url);
            if (pathMatch && pathMatch.length === 3) {
                queryParams.fid = pathMatch[1];
                queryParams.page = pathMatch[2];
            }
        }
        return queryParams;
    }

    async function copyToClipboard(text, onSuccess, onError) {
        try {
            await navigator.clipboard.writeText(text);
            if (onSuccess) onSuccess();
        } catch (err) {
            if (onError) onError(err);
            console.error("无法将文本复制到剪贴板", err);
        }
    }

    function getBoardName(fid) {
        if (SEARCH_BOARD_NAMES[String(fid)]) return SEARCH_BOARD_NAMES[String(fid)];
        for (var i = 0; i < DEFAULT_TID_OPTIONS.length; i++) {
            if (DEFAULT_TID_OPTIONS[i].value === parseInt(fid)) return DEFAULT_TID_OPTIONS[i].label;
        }
        return "fid=" + fid;
    }
    // #endregion

    // #region 收藏夹辅助函数
    const BGSH = (function() {
        const initialized = new Set();
        const listeners = new Set();
        return {
            debug: false,
            initialized,
            listeners,
            cleanup() { listeners.forEach(fn => { try { fn(); } catch(e) {} }); listeners.clear(); initialized.clear(); }
        };
    })();

    function debugLog(...args) { if (BGSH.debug) console.log("[98T]", ...args); }
    function errorLog(...args) { console.error("[98T]", ...args); }

    function safeCall(fn, fallback = undefined) {
        try { return typeof fn === "function" ? fn() : fallback; }
        catch (error) { errorLog(error); return fallback; }
    }

    function safeURL(value, fallback = "") {
        if (!value) return fallback;
        try {
            const url = new URL(String(value), location.href);
            if (!["http:", "https:"].includes(url.protocol)) return fallback;
            return url.href;
        } catch { return fallback; }
    }

    function normalizeURL(value) { return safeURL(value, ""); }

    function getJSONValue(key, fallback) {
        try {
            const value = GM_getValue(key, fallback);
            if (value === null || value === undefined) return fallback;
            if (typeof value !== "string") return value;
            const parsed = JSON.parse(value);
            return parsed === null || parsed === undefined ? fallback : parsed;
        } catch { return fallback; }
    }

    function setJSONValue(key, value) { GM_setValue(key, value); }

    function clampNumber(value, min, max, fallback) {
        const number = Number(value);
        if (!Number.isFinite(number)) return fallback;
        return Math.min(max, Math.max(min, number));
    }

    function debounce(fn, wait) {
        let timer = null;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => safeCall(() => fn.apply(this, args)), wait || 200);
        };
    }

    function qs(selector, root) {
        try { return (root || document).querySelector(selector); }
        catch { return null; }
    }

    function qsa(selector, root) {
        try { return Array.from((root || document).querySelectorAll(selector)); }
        catch { return []; }
    }

    function createElement(tagName, options) {
        const element = document.createElement(tagName);
        if (!options) return element;
        if (options.className) element.className = options.className;
        if (options.id) element.id = options.id;
        if (options.text !== undefined) element.textContent = String(options.text);
        if (options.title) element.title = String(options.title);
        if (options.attrs && typeof options.attrs === "object") {
            for (const [key, value] of Object.entries(options.attrs)) {
                if (value !== null && value !== undefined) element.setAttribute(key, String(value));
            }
        }
        if (options.styles && typeof options.styles === "object") Object.assign(element.style, options.styles);
        if (typeof options.onClick === "function") element.addEventListener("click", options.onClick);
        return element;
    }

    function clearElement(element) {
        if (!element) return;
        while (element.firstChild) element.removeChild(element.firstChild);
    }

    async function fetchWithTimeout(input, options, timeout) {
        const controller = new AbortController();
        const timer = setTimeout(function() { controller.abort(); }, timeout || 10000);
        try {
            const response = await fetch(input, { credentials: "include", ...(options || {}), signal: controller.signal });
            if (!response.ok) throw new Error("HTTP " + response.status);
            return response;
        } finally { clearTimeout(timer); }
    }

    async function fetchText(input, options, timeout) {
        const response = await fetchWithTimeout(input, options, timeout);
        return response.text();
    }

    function isPageType(type) {
        const url = location.href;
        const pageMatchers = {
            post: /forum\.php\?mod=viewthread|\/thread-\d+-\d+-\d+\.html/i,
            search: /search\.php/i,
            forum: /forum\.php\?mod=forumdisplay|\/forum-\d+-\d+\.html/i,
            favorite: /home\.php\?.*do=favorite/i,
            space: /home\.php\?.*mod=space/i,
            newThread: /forum\.php\?mod=post&action=newthread/i
        };
        return Boolean(pageMatchers[type]?.test(url));
    }

    function parseProfileFollowerCount(html, uid) {
        var doc = new DOMParser().parseFromString(String(html || ""), "text/html");
        var followerLinks = Array.from(doc.querySelectorAll(
            "a[href*='mod=follow'][href*='do=follower'], a[href*='do=follow'][href*='view=follower']"
        ));
        for (var i = 0; i < followerLinks.length; i++) {
            var followerLink = followerLinks[i];
            var href = followerLink.getAttribute("href") || "";
            try {
                var linkUrl = new URL(href, baseURL);
                var linkUid = linkUrl.searchParams.get("uid");
                if (uid && linkUid && String(linkUid) !== String(uid)) continue;
            } catch (error) {}
            var strong = followerLink.querySelector("strong");
            var countText = strong ? strong.textContent : followerLink.textContent;
            var countMatch = String(countText || "").match(/\d+/);
            if (countMatch) return parseInt(countMatch[0], 10);
        }

        var stats = Array.from(doc.querySelectorAll(".my_flw_stats li, .flw_hd li"));
        for (var j = 0; j < stats.length; j++) {
            var statText = String(stats[j].textContent || "").replace(/\s+/g, " ");
            if (!/(?:听众|粉丝|被关注)/.test(statText)) continue;
            var statMatch = statText.match(/\d+/);
            if (statMatch) return parseInt(statMatch[0], 10);
        }

        var rawMatch = String(html || "").match(/["']follower["']\s*[:=]\s*["']?(\d+)/i);
        return rawMatch ? parseInt(rawMatch[1], 10) : null;
    }

    async function fetchProfileFollowerCount(uid) {
        var encodedUid = encodeURIComponent(uid);
        var endpoints = [
            baseURL + "/home.php?mod=follow&do=feed&uid=" + encodedUid,
            baseURL + "/home.php?mod=follow&do=follower&uid=" + encodedUid,
            baseURL + "/home.php?mod=space&uid=" + encodedUid + "&do=follow&view=follower"
        ];
        for (var i = 0; i < endpoints.length; i++) {
            try {
                var html = await fetchText(endpoints[i], { cache: "no-store" }, 12000);
                var count = parseProfileFollowerCount(html, uid);
                if (Number.isInteger(count) && count >= 0) return count;
            } catch (error) {
                debugLog("读取被关注数失败", endpoints[i], error);
            }
        }
        return null;
    }

    // 被关注数防删除：记录已插入的元素和目标位置，被网站脚本删除时自动重建
    var bgshFollowerGuard = { inserted: false, observer: null, count: null, uid: null };

    function findProfileFollowerTargetLi() {
        var statLinks = Array.from(document.querySelectorAll("#ct .mn li, #ct .bm_c li, .creditl li, .profile_menu li"));
        for (var i = 0; i < statLinks.length; i++) {
            var liText = String(statLinks[i].textContent || "").replace(/\s+/g, " ");
            if (/主题数\s*\d*/.test(liText)) return statLinks[i];
        }
        for (var j = 0; j < statLinks.length; j++) {
            var liText2 = String(statLinks[j].textContent || "").replace(/\s+/g, " ");
            if (/好友数\s*\d*/.test(liText2)) return statLinks[j];
        }
        return null;
    }

    function buildFollowerElements(count) {
        var pipe = document.createElement("span");
        pipe.className = "pipe";
        pipe.dataset.bgshFollowerPipe = "1";
        pipe.dataset.bgshPersistent = "1";
        pipe.textContent = "|";
        var followerStat = document.createElement("span");
        followerStat.id = "bgshProfileFollowerCount";
        followerStat.dataset.bgshPersistent = "1";
        followerStat.textContent = "被关注数：";
        var followerValue = document.createElement("span");
        followerValue.className = "xi2";
        followerValue.dataset.bgshPersistent = "1";
        followerValue.textContent = count !== null ? String(count) + " 人" : "…";
        followerStat.appendChild(followerValue);
        if (count !== null) followerStat.title = "被关注数：" + count;
        return { pipe: pipe, stat: followerStat, value: followerValue };
    }

    function insertFollowerCount() {
        if (document.getElementById("bgshProfileFollowerCount")) {
            bgshFollowerGuard.inserted = true;
            return true;
        }
        var targetLi = findProfileFollowerTargetLi();
        if (!targetLi) return false;
        // 防重复：先清理同位置可能残留的旧元素
        targetLi.querySelectorAll("[data-bgsh-follower-pipe], [data-bgsh-persistent]").forEach(function(el) {
            if (el.id === "bgshProfileFollowerCount" || el.dataset.bgshFollowerPipe) el.remove();
        });
        var els = buildFollowerElements(bgshFollowerGuard.count);
        targetLi.appendChild(els.pipe);
        targetLi.appendChild(els.stat);
        bgshFollowerGuard.inserted = true;
        return true;
    }

    function startFollowerGuardObserver() {
        if (bgshFollowerGuard.observer) return;
        bgshFollowerGuard.observer = new MutationObserver(function(mutations) {
            var removed = false;
            mutations.forEach(function(m) {
                m.removedNodes.forEach(function(node) {
                    if (node.id === "bgshProfileFollowerCount" ||
                        (node.dataset && node.dataset.bgshFollowerPipe)) {
                        removed = true;
                    }
                });
            });
            if (removed && bgshFollowerGuard.count !== null) {
                // 延迟重建，避免和网站脚本同时操作DOM冲突
                setTimeout(function() { insertFollowerCount(); }, 100);
                setTimeout(function() { insertFollowerCount(); }, 500);
            }
        });
        bgshFollowerGuard.observer.observe(document.body, { childList: true, subtree: true });
    }

    async function setupProfileFollowerCount() {
        var pageUrl;
        try { pageUrl = new URL(location.href); } catch (error) { return; }
        // 个人空间首页和资料页都显示
        if (pageUrl.searchParams.get("mod") !== "space") return;
        var pageDo = pageUrl.searchParams.get("do");
        if (pageDo && pageDo !== "profile" && pageDo !== "thread") return;

        var uid = pageUrl.searchParams.get("uid") || getUid();
        if (!uid) return;
        bgshFollowerGuard.uid = uid;

        // 等页面原生 DOM 完全加载、网站自带渲染逻辑执行完毕后再插入
        var tryInsert = function(delay) {
            setTimeout(function() {
                if (!findProfileFollowerTargetLi()) {
                    if (delay < 3000) tryInsert(delay + 500);
                    return;
                }
                insertFollowerCount();
                startFollowerGuardObserver();
            }, delay);
        };

        if (document.readyState === "complete") {
            tryInsert(800);
        } else {
            window.addEventListener("load", function() { tryInsert(800); }, { once: true });
        }

        // 后台拉取被关注数，拿到后更新并确保元素存在
        var count = await fetchProfileFollowerCount(uid);
        if (count === null) return;
        bgshFollowerGuard.count = count;

        // 更新已有元素的数字
        var existing = document.getElementById("bgshProfileFollowerCount");
        if (existing) {
            var valSpan = existing.querySelector(".xi2");
            if (valSpan) valSpan.textContent = String(count) + " 人";
            existing.title = "被关注数：" + count;
        } else {
            insertFollowerCount();
        }
        // 拉取完成后再补插一次，防止网站脚本在拉取期间清除了元素
        setTimeout(function() { insertFollowerCount(); }, 300);
        setTimeout(function() { insertFollowerCount(); }, 1500);
    }

    function addSafeEventListener(target, eventName, handler, options) {
        if (!target || typeof target.addEventListener !== "function") return;
        target.addEventListener(eventName, function(event) {
            try {
                const result = handler(event);
                if (result && typeof result.catch === "function") {
                    result.catch(function(error) { errorLog(error); showToast("操作失败，请稍后重试", "error"); });
                }
            } catch (error) { errorLog(error); showToast("操作失败，请稍后重试", "error"); }
        }, options);
    }
    // #endregion

    // #region 勋章操作 (保持原样)
    function manipulateMedals(settings) {
        const excludeNumbers = [17, 29, 31, 32, 33, 34, 35, 36, 37, 38, 110, 111, 112, 113, 114, 116, 117];
        const targetMedalNumbers = Array.from({ length: 122 }, (_, i) => i + 14)
            .filter((num) => !excludeNumbers.includes(num))
            .map((num) => `medal${num}`);

        document.querySelectorAll(".md_ctrl img").forEach((img) => {
            const imgSrc = img.src;
            const targetMatch = targetMedalNumbers.some((target) => imgSrc.includes(target));

            const shouldApply = (setting) => setting === 1 || (setting === 2 && targetMatch);

            if (shouldApply(settings.blockMedals)) {
                img.style.display = "none";
            } else {
                img.style.display = "";
            }

            if (shouldApply(settings.resizeMedals)) {
                img.style.width = settings.imageSize;
            } else {
                img.style.width = "auto";
            }

            if (shouldApply(settings.replaceMedals)) {
                img.src = settings.imageUrl;
                img.style.width = "50px";
            }
        });
    }
    // #endregion

    // #region 帖子标题样式 (保持原样)
    function stylePosts(settings) {
        const style = document.createElement("style");
        style.id = "customTitleStyle";
        style.textContent = `
            .s.xst {
                font-size: ${settings.titleStyleSize}px;
                font-weight: ${settings.titleStyleWeight};
                font-family: 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei New', 'STHeiti Light', sans-serif;
            }
        `;
        document.head.appendChild(style);

        var images = document.querySelectorAll('img[alt="heatlevel"]');
        images.forEach((image) => {
            var parent = image.parentNode;
            var link = parent.querySelector("a.s.xst");
            var uniqueId = "t98theatleveldisplay";

            if (link) {
                const existingSpan = link.parentNode.querySelector("#" + uniqueId);
                if (!existingSpan) {
                    var span = document.createElement("span");
                    span.textContent = ` [${image.getAttribute("title")}]`;
                    span.style.color = "red";
                    span.style.fontWeight = "bold";
                    span.style.fontSize = `${settings.titleStyleSize}px`;
                    span.id = uniqueId;
                    link.parentNode.insertBefore(span, link.nextSibling);
                }
            }
        });
    }

    function undoStylePosts() {
        const styleElement = document.getElementById("customTitleStyle");
        if (styleElement) styleElement.remove();
    }

    let largeResourceHighlightThreshold = 50;
    let largeResourceHighlightObserver = null;
    let largeResourceHighlightTimer = null;

    function extractLargestResourceSizeGb(titleText) {
        var text = String(titleText || "");
        var regex = /(\d+(?:\.\d+)?)\s*(?:G(?:B|iB)?|Ｇ(?:Ｂ)?)(?![A-Za-z])/gi;
        var largest = 0;
        var match;
        while ((match = regex.exec(text)) !== null) {
            largest = Math.max(largest, parseFloat(match[1]) || 0);
        }
        return largest;
    }

    function applyLargeResourceTitleHighlights(root) {
        var scope = root && root.querySelectorAll ? root : document;
        var links = [];
        if (scope.matches && scope.matches("a.s.xst, a.xst[href*='thread'], a[href*='/thread-']")) {
            links.push(scope);
        }
        scope.querySelectorAll(
            "a.s.xst, a.xst[href*='thread'], " +
            ".threadlist a[href*='/thread-'], .searchresult a[href*='/thread-']"
        ).forEach(function(link) { links.push(link); });

        Array.from(new Set(links)).forEach(function(link) {
            if (link.closest(".bgsh-toolbar, .bgsh-dialog, #settingsUIContainer")) return;
            var sizeGb = extractLargestResourceSizeGb(link.textContent);
            var highlighted = sizeGb > largeResourceHighlightThreshold;
            link.classList.toggle("bgsh-large-resource-title", highlighted);
            if (highlighted) {
                if (!link.hasAttribute("data-bgsh-large-resource-styled")) {
                    link.dataset.bgshOriginalInlineColor = link.style.getPropertyValue("color");
                    link.dataset.bgshOriginalInlineColorPriority = link.style.getPropertyPriority("color");
                    link.dataset.bgshOriginalInlineWeight = link.style.getPropertyValue("font-weight");
                    link.dataset.bgshOriginalInlineWeightPriority = link.style.getPropertyPriority("font-weight");
                    link.setAttribute("data-bgsh-large-resource-styled", "1");
                }
                link.style.setProperty("color", "#ff6a00", "important");
                link.style.setProperty("font-weight", "900", "important");
                link.dataset.bgshResourceSizeGb = String(sizeGb);
                link.title = (link.getAttribute("title") || "").replace(/\s*\|\s*ROG高亮：[^|]+$/u, "") +
                    " | ROG高亮：" + sizeGb + "G > " + largeResourceHighlightThreshold + "G";
            } else {
                if (link.hasAttribute("data-bgsh-large-resource-styled")) {
                    var originalColor = link.dataset.bgshOriginalInlineColor || "";
                    var originalColorPriority = link.dataset.bgshOriginalInlineColorPriority || "";
                    var originalWeight = link.dataset.bgshOriginalInlineWeight || "";
                    var originalWeightPriority = link.dataset.bgshOriginalInlineWeightPriority || "";
                    if (originalColor) link.style.setProperty("color", originalColor, originalColorPriority);
                    else link.style.removeProperty("color");
                    if (originalWeight) link.style.setProperty("font-weight", originalWeight, originalWeightPriority);
                    else link.style.removeProperty("font-weight");
                    delete link.dataset.bgshOriginalInlineColor;
                    delete link.dataset.bgshOriginalInlineColorPriority;
                    delete link.dataset.bgshOriginalInlineWeight;
                    delete link.dataset.bgshOriginalInlineWeightPriority;
                    link.removeAttribute("data-bgsh-large-resource-styled");
                }
                delete link.dataset.bgshResourceSizeGb;
                if (link.title) link.title = link.title.replace(/\s*\|\s*ROG高亮：[^|]+$/u, "");
            }
        });
    }

    function setupLargeResourceTitleHighlights(settings) {
        largeResourceHighlightThreshold = Math.max(1, Math.min(500,
            parseInt(settings && settings.largeResourceThresholdGb, 10) || 50));
        applyLargeResourceTitleHighlights(document);
        if (largeResourceHighlightObserver || !document.body) return;
        largeResourceHighlightObserver = new MutationObserver(function(mutations) {
            if (!mutations.some(function(mutation) { return mutation.addedNodes.length > 0; })) return;
            clearTimeout(largeResourceHighlightTimer);
            largeResourceHighlightTimer = setTimeout(function() {
                applyLargeResourceTitleHighlights(document);
            }, 100);
        });
        largeResourceHighlightObserver.observe(document.body, { childList: true, subtree: true });
    }
    // #endregion

    // #region 用户屏蔽 (保持原样)
    function blockContentByUsers(settings) {
        const { blockedUsers, displayBlockedTips } = settings;
        blockedUsers.forEach((userID) => {
            const actions = [
                {
                    xpath: `//table//tr[1]/td[2]//cite/a[text()="${userID}"]/ancestor::tbody[1]`,
                    message: `<tr><td class='icn'><img src='static/image/common/folder_common.gif' /></td>
                        <th class='common'><b>已屏蔽主题 <font color=grey></th>
                        <td class='by'><cite><font color=grey>${userID}</font></cite></td>
                        <td class='num'></td><td class='by'></td></tr>`
                },
                {
                    xpath: `//ul/li[p[3]/span[2]/a[text()='${userID}']]`,
                    message: `<li class="pbw"><p><span>已屏蔽"${userID}"</span></p></li>`
                }
            ];

            actions.forEach(action => {
                const elements = document.evaluate(action.xpath, document, null,
                    XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null);
                for (let i = 0; i < elements.snapshotLength; i++) {
                    if (displayBlockedTips) {
                        elements.snapshotItem(i).innerHTML = action.message;
                    } else {
                        elements.snapshotItem(i).style.display = "none";
                    }
                }
            });
        });
    }
    // #endregion

    // #region 水印特效 (保持原样)
    function showWatermarkMessage() {
        var settings = getSettings();
        if (!settings.isShowWatermarkMessage) return;

        const watermarkWrapper = document.createElement("div");
        watermarkWrapper.className = "bgsh-watermark-wrapper";

        const positions = [];
        const maxAttempts = 10;

        const kissIcon = `<svg class="icon" viewBox="0 0 1489 1024" xmlns="http://www.w3.org/2000/svg">
            <path d="M1445.997803 542.822364c-28.845516 31.637018-113.986313 125.61757-171.677346 201.918612-70.252789 93.050052-107.007559 171.677345-165.163841 215.41087A249.374138 249.374138 0 0 1 935.153019 1023.891131a303.343168 303.343168 0 0 1-160.976589-46.525025 139.575077 139.575077 0 0 0-46.525026-6.513504 121.430317 121.430317 0 0 0-46.525026 5.117753 298.690666 298.690666 0 0 1-160.511339 46.525026 253.096141 253.096141 0 0 1-174.003597-63.274035C291.246662 915.022571 254.491891 837.791028 186.100103 744.740976 126.54807 667.044183 40.942023 573.063631 12.096507 541.426614c-6.048253-6.513504-12.096507-7.909254-12.096507-13.027008s12.096507-13.027007 12.096507-13.027007a487.11702 487.11702 0 0 0 85.606047-6.513503c21.401512-6.513504 211.688868-133.992074 211.688868-133.992075l150.741083-119.104066a143.76233 143.76233 0 0 1 68.391788-15.818509c41.872523 0 200.522861 100.028806 200.522862 100.028806S887.697493 241.340197 930.500517 241.340197a147.949582 147.949582 0 0 1 68.857038 15.353259l149.810583 119.569316s189.822105 127.013321 211.688868 133.992075a482.464518 482.464518 0 0 0 85.140797 6.513504s12.561757 7.909254 12.561757 13.027007-6.048253 6.513504-12.561757 13.027007zM1483.217823 136.658889a110.264311 110.264311 0 0 1-9.305005 21.401512 121.895568 121.895568 0 0 1-11.166006 15.818509L1315.72773 326.015744l-147.484331-150.741084a100.494056 100.494056 0 0 1-12.561757-17.67951 96.772054 96.772054 0 0 1-8.839755-17.679509 157.254587 157.254587 0 0 1-6.048254-41.872524 93.050052 93.050052 0 0 1 100.959306-93.050051 110.264311 110.264311 0 0 1 73.044291 46.525026A110.264311 110.264311 0 0 1 1387.84152 0.340563 93.050052 93.050052 0 0 1 1488.800827 95.716866a154.928336 154.928336 0 0 1-5.583004 40.942023z" fill="rgba(255,0,0,0.15)"></path>
            <path d="M729.047155 553.52312a739.28266 739.28266 0 0 0-87.001799 0 1777.255987 1777.255987 0 0 0-226.576875 58.621533c0 7.444004 13.492257 17.67951 113.055812 26.984515a1599.530388 1599.530388 0 0 0 200.522862 4.187252 1460.885811 1460.885811 0 0 0 201.453362-2.791501c99.563555-9.770255 113.521063-19.540511 113.521063-26.984515a1759.576477 1759.576477 0 0 0-227.042126-59.086783c-26.054014-2.791502-87.932299-0.930501-87.932299-0.930501z" fill="rgba(242,195,48,0.15)"></path>
        </svg>`;

        for (let i = 0; i < 20; i++) {
            const watermarkText = document.createElement("div");
            watermarkText.className = "bgsh-watermark-text";
            watermarkText.innerHTML = `${kissIcon}${settings.logoText}${kissIcon}`;

            let attempts = 0;
            let overlap = false;

            do {
                overlap = false;
                const x = Math.random() * window.innerWidth * 0.8;
                const y = Math.random() * window.innerHeight * 0.8;

                for (let pos of positions) {
                    const dx = x - pos.x;
                    const dy = y - pos.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance < 400) {
                        overlap = true;
                        break;
                    }
                }

                if (!overlap) {
                    watermarkText.style.left = `${x}px`;
                    watermarkText.style.top = `${y}px`;
                    positions.push({ x, y });
                }
                attempts++;
            } while (overlap && attempts < maxAttempts);

            if (attempts < maxAttempts) {
                watermarkWrapper.appendChild(watermarkText);
            }
        }

        document.body.appendChild(watermarkWrapper);
        setTimeout(() => watermarkWrapper.remove(), 500);
    }

    function appendAnimatedClickElement(element, keyframes, options) {
        Object.assign(element.style, {
            position: "fixed",
            pointerEvents: "none",
            zIndex: "2147483647",
            transformOrigin: "center",
            willChange: "transform, opacity"
        });
        document.body.appendChild(element);
        var animation = element.animate(keyframes, options);
        animation.onfinish = function() { element.remove(); };
        animation.oncancel = function() { element.remove(); };
        setTimeout(function() { element.remove(); }, Number(options.duration || 700) + 150);
    }

    function playClickEffect(x, y, effectStyle) {
        var styleName = ["ripple", "heart", "sparkle", "firework"].includes(effectStyle)
            ? effectStyle
            : "ripple";

        if (styleName === "ripple") {
            var ring = document.createElement("span");
            Object.assign(ring.style, {
                left: x + "px",
                top: y + "px",
                width: "24px",
                height: "24px",
                border: "3px solid #f7971e",
                borderRadius: "50%",
                boxShadow: "0 0 10px rgba(247,151,30,.55)"
            });
            appendAnimatedClickElement(ring, [
                { transform: "translate(-50%, -50%) scale(.2)", opacity: 1 },
                { transform: "translate(-50%, -50%) scale(3.2)", opacity: 0 }
            ], { duration: 560, easing: "cubic-bezier(.15,.75,.3,1)" });
            return;
        }

        var particleCount = styleName === "firework" ? 12 : 8;
        var glyphs = styleName === "heart" ? ["❤", "♥", "♡"] : ["✦", "✧", "★", "⋆"];
        for (var i = 0; i < particleCount; i++) {
            var particle = document.createElement("span");
            var angle = Math.PI * 2 * i / particleCount + (Math.random() - .5) * .22;
            var distance = 38 + Math.random() * 42;
            var dx = Math.cos(angle) * distance;
            var dy = Math.sin(angle) * distance;
            Object.assign(particle.style, {
                left: x + "px",
                top: y + "px",
                color: styleName === "heart" ? (i % 2 ? "#ff4d88" : "#ff6b5f") : "#ffd200",
                fontSize: (13 + Math.random() * 8) + "px",
                lineHeight: "1",
                textShadow: "0 0 7px currentColor"
            });

            if (styleName === "firework") {
                particle.textContent = "";
                Object.assign(particle.style, {
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: "hsl(" + ((i * 31 + 18) % 360) + " 95% 60%)",
                    boxShadow: "0 0 7px currentColor"
                });
            } else {
                particle.textContent = glyphs[i % glyphs.length];
            }

            appendAnimatedClickElement(particle, [
                { transform: "translate(-50%, -50%) scale(.25) rotate(0deg)", opacity: 1 },
                { transform: "translate(calc(-50% + " + dx + "px), calc(-50% + " + dy + "px)) scale(1.15) rotate(" + (i % 2 ? 55 : -55) + "deg)", opacity: .95, offset: .62 },
                { transform: "translate(calc(-50% + " + (dx * 1.18) + "px), calc(-50% + " + (dy * 1.18 + 18) + "px)) scale(.65) rotate(" + (i % 2 ? 90 : -90) + "deg)", opacity: 0 }
            ], { duration: 650 + Math.random() * 180, easing: "cubic-bezier(.18,.75,.35,1)" });
        }
    }

    function setupGlobalClickEffect() {
        if (window.__bgshGlobalClickEffectBound) return;
        window.__bgshGlobalClickEffectBound = true;
        document.addEventListener("click", function(event) {
            if (!event.isTrusted || !GM_getValue("isShowWatermarkMessage", true)) return;
            playClickEffect(
                event.clientX,
                event.clientY,
                GM_getValue("clickEffectStyle", "ripple")
            );
        }, true);
    }
    // #endregion

    // #region 收藏夹管理 - 完整系统

    // ===== 收藏夹存储 =====
    let currentUid = null;
    let favKeys = null;
    let favCache = {};
    let folders = ["/"];
    let currentFolder = "ALL";
    let currentSort = "favid";
    let isSidebarCollapsed = false;
    let isAutoPreview = false;
    let previewCount = 4;
    let poolSize = 5;
    let isToolboxHidden = false;
    let lastFolder = "/";
    let activeFavoriteExportFavid = "";
    const PAGE_SIZE = 100;
    let renderLimit = PAGE_SIZE;
    let needsPageReset = true;

    function isFavoritePageURL(urlValue) {
        try {
            const url = new URL(urlValue || location.href, location.href);
            return /\/home\.php$/i.test(url.pathname) &&
                url.searchParams.get("mod") === "space" &&
                url.searchParams.get("do") === "favorite";
        } catch (error) {
            return /home\.php/i.test(urlValue || location.href) &&
                /[?&]do=favorite(?:&|#|$)/i.test(urlValue || location.href);
        }
    }

    function getUid() {
        const cachedUid = GM_getValue("bgsh_uid", null);
        let uid = null;
        if (typeof window.discuz_uid !== "undefined" && window.discuz_uid && String(window.discuz_uid) !== "0") {
            uid = String(window.discuz_uid);
            if (uid !== cachedUid) GM_setValue("bgsh_uid", uid);
            return uid;
        }
        const userLink = qs(".vwmy a") || qs(".userinfo a[href*='uid=']") || qs("#um a[href*='uid=']") || qs("a[href*='space-uid-']");
        if (userLink) {
            try {
                const url = new URL(userLink.href, location.href);
                uid = url.searchParams.get("uid");
            } catch {
                const match = userLink.href.match(/[?&]uid=(\d+)/);
                uid = match ? match[1] : null;
            }
            if (!uid) { const m = userLink.href.match(/space-uid-(\d+)/); uid = m ? m[1] : null; }
            if (uid) { GM_setValue("bgsh_uid", uid); return uid; }
        }
        const urlUid = new URL(location.href).searchParams.get("uid");
        if (urlUid) { GM_setValue("bgsh_uid", urlUid); return urlUid; }
        return cachedUid ? String(cachedUid) : null;
    }

    function initFavoriteStorage() {
        currentUid = getUid();
        if (!currentUid) { console.log("[98T] initFavoriteStorage: getUid failed"); return false; }
        favKeys = {
            favs: "bgsh_favs_" + currentUid,
            folders: "bgsh_folders_" + currentUid,
            sort: "bgsh_sort_" + currentUid,
            sidebar: "bgsh_sidebar_" + currentUid,
            autoPreview: "bgsh_auto_preview_" + currentUid,
            previewCount: "bgsh_preview_count_" + currentUid,
            poolSize: "bgsh_pool_size_" + currentUid,
            toolbox: "bgsh_toolbox_" + currentUid,
            lastFolder: "bgsh_last_folder_" + currentUid
        };
        const storedFavs = getJSONValue(favKeys.favs, {});
        const storedFolders = getJSONValue(favKeys.folders, ["/"]);
        favCache = storedFavs && typeof storedFavs === "object" && !Array.isArray(storedFavs) ? storedFavs : {};
        folders = Array.isArray(storedFolders) ? storedFolders.map(function(f) { return String(f); }).filter(Boolean) : ["/"];
        if (!folders.includes("/")) folders.unshift("/");
        currentSort = String(GM_getValue(favKeys.sort, "favid"));
        if (!["favid", "tid", "updates"].includes(currentSort)) currentSort = "favid";
        isSidebarCollapsed = GM_getValue(favKeys.sidebar, false) === true;
        // 收藏夹与“设置 → 显示 → 图片预览”共用唯一开关，不再各自保存状态。
        isAutoPreview = getSettings().displayThreadImages === true;
        GM_setValue(favKeys.autoPreview, isAutoPreview);
        var globalPreviewCount = getSettings().threadPreviewCount || 3;
        previewCount = clampNumber(GM_getValue(favKeys.previewCount, globalPreviewCount), 1, 20, globalPreviewCount);
        poolSize = clampNumber(GM_getValue(favKeys.poolSize, 5), 1, 20, 5);
        // bgsh_toolbox_<uid> 是只读键：脚本里没有任何入口能把它写回 false，
        // 一旦为 true（例如从旧脚本 sht_tree_toolbox_hide_ 迁移过来），侧栏底部
        // 整块按钮会永久消失且无法恢复。这里做自愈：强制展开并清掉脏值。
        isToolboxHidden = false;
        if (GM_getValue(favKeys.toolbox, false) === true) GM_setValue(favKeys.toolbox, false);
        lastFolder = String(GM_getValue(favKeys.lastFolder, "/"));
        if (!folders.includes(lastFolder)) { lastFolder = "/"; GM_setValue(favKeys.lastFolder, "/"); }
        var changed = false;
        for (var k in favCache) {
            if (!favCache.hasOwnProperty(k)) continue;
            var data = favCache[k];
            if (!data || typeof data !== "object") continue;
            if (!data.folder || !folders.includes(data.folder)) { data.folder = "/"; changed = true; }
            if (data.url) { var norm = normalizeURL(data.url); if (norm && norm !== data.url) { data.url = norm; changed = true; } }
        }
        if (changed) saveFavoriteData();
        return true;
    }

    function loadFavoriteData() {
        if (!favKeys) return;
        var data = getJSONValue(favKeys.favs, {});
        favCache = data && typeof data === "object" && !Array.isArray(data) ? data : {};
        var savedFolders = getJSONValue(favKeys.folders, ["/"]);
        folders = Array.isArray(savedFolders) ? savedFolders : ["/"];
        if (!folders.includes("/")) folders.unshift("/");
    }

    function saveFavoriteData() {
        if (!favKeys) return;
        setJSONValue(favKeys.favs, favCache);
        setJSONValue(favKeys.folders, folders);
    }

    function formatFolderName(folder) {
        if (folder === "ALL") return "全部记录";
        if (folder === "/") return "未分类";
        return String(folder).replace(/^\/+/, "");
    }

    function normalizeFolderName(folder) {
        var name = String(folder || "").trim();
        if (!name) return "/";
        if (!name.startsWith("/")) name = "/" + name;
        return name.replace(/\s+/g, " ");
    }

    function getFavoriteTid(data) {
        if (!data) return "";
        return String(data.tid || extractTid(data.url) || "");
    }

    function getFavoriteTitle(data) {
        return String(data ? (data.title || data.subject || "无标题") : "无标题").trim();
    }

    function getFavoriteAuthor(data) {
        return String(data ? (data.author || "") : "").trim();
    }

    function isFavoriteProcessed(data) { return Boolean(data ? data.processed : false); }

    function getFavoriteEntries() {
        return Object.keys(favCache)
            .filter(function(k) { return favCache[k] && typeof favCache[k] === "object"; })
            .map(function(k) { return [k, favCache[k]]; });
    }

    // ===== 收藏请求 =====
    async function executeDeleteRequest(favid) {
        var formhash = getFormHash();
        if (!favid || !formhash) { showToast("缺少取消收藏参数", "error"); return false; }
        var params = new URLSearchParams({ mod: "spacecp", ac: "favorite", op: "delete", favid: String(favid), type: "all", inajax: "1" });
        var body = new URLSearchParams({ deletesubmit: "true", formhash: formhash, handlekey: "a_delete_" + favid });
        try {
            var text = await fetchText("/home.php?" + params.toString(), { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Requested-With": "XMLHttpRequest" }, body: body.toString() }, 10000);
            return text.includes("操作成功") || text.includes("删除成功");
        } catch (error) { errorLog("取消收藏失败:", error); return false; }
    }

    function extractFavoriteId(text) {
        if (!text) return "";
        var patterns = [/\['favid'\]\s*:\s*['"]?(\d+)/i, /favid[=\s"':]+(\d+)/i, /favorite_(\d+)/i];
        for (var i = 0; i < patterns.length; i++) {
            var match = String(text).match(patterns[i]);
            if (match) return match[1];
        }
        return "";
    }

    async function requestFavorite(requestURL, tid, folder, title) {
        var source = safeURL(requestURL, "");
        if (!source) { showToast("收藏链接无效", "error"); return false; }
        try {
            var separator = source.includes("?") ? "&" : "?";
            var text = await fetchText(source + separator + "infloat=yes&handlekey=k_favorite&inajax=1", {}, 10000);
            if (text.includes("已收藏") || text.includes("抱歉，您已收藏")) { showToast("抱歉，您已收藏，请勿重复收藏", "warning"); return false; }
            if (!text.includes("成功") && !text.includes("收藏成功")) { showToast("收藏失败，服务器返回异常", "error"); return false; }
            var favid = extractFavoriteId(text);
            if (!favid) { showToast("收藏成功，但未获取到收藏编号", "warning"); return true; }
            var safeFolder = folders.includes(folder) ? folder : "/";
            favCache[favid] = { tid: String(tid || ""), title: title || qs("#thread_subject")?.textContent?.trim() || document.title || "无标题", url: normalizeURL("/forum.php?mod=viewthread&tid=" + encodeURIComponent(tid)), folder: safeFolder, processed: false, author: "" };
            lastFolder = safeFolder;
            GM_setValue(favKeys.lastFolder, lastFolder);
            saveFavoriteData();
            showToast("信息收藏成功", "success");
            return true;
        } catch (error) { errorLog("收藏请求失败:", error); showToast("网络请求异常，收藏失败", "error"); return false; }
    }

    // ===== 收藏目录弹窗 =====
    function createFavoriteModal(title) {
        if (title === undefined) title = "🌟 收藏至目录";
        var overlay = createElement("div", { className: "bgsh-dialog-overlay" });
        var dialog = createElement("div", { className: "bgsh-dialog" });
        dialog.style.width = "360px";
        dialog.style.maxHeight = "none";
        var header = createElement("div", { className: "bgsh-dialog-header" });
        var heading = createElement("div", { className: "bgsh-dialog-title", text: title });
        var closeButton = createElement("button", { className: "bgsh-dialog-close", text: "×", id: "bgshFavModalClose" });
        header.append(heading, closeButton);
        var body = createElement("div", { className: "bgsh-dialog-body" });
        var select = createElement("select", { id: "bgshFavFolderSelect" });
        Object.assign(select.style, { width: "100%", marginBottom: "12px", padding: "8px", borderRadius: "8px", border: "1px solid #ccc" });
        var folderOptions = [{ value: "/", label: "📦 未分类" }];
        folders.filter(function(f) { return f !== "/"; }).forEach(function(f) { folderOptions.push({ value: f, label: "📁 " + formatFolderName(f) }); });
        for (var i = 0; i < folderOptions.length; i++) {
            var opt = folderOptions[i];
            var element = createElement("option", { text: opt.label, attrs: { value: opt.value } });
            element.selected = opt.value === lastFolder;
            select.appendChild(element);
        }
        var input = createElement("input", { id: "bgshNewFolderInput", attrs: { type: "text", placeholder: "输入新目录名（可选）", autocomplete: "off" } });
        Object.assign(input.style, { boxSizing: "border-box", width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid #ccc" });
        body.append(select, input);
        var footer = createElement("div", { className: "bgsh-dialog-footer" });
        var cancelButton = createElement("button", { className: "bgsh-customBtn", text: "取消", id: "bgshFavModalCancel" });
        cancelButton.style.width = "auto"; cancelButton.style.background = "rgba(0,0,0,.06)"; cancelButton.style.color = "#666";
        var confirmButton = createElement("button", { className: "bgsh-customBtn", text: "确认收藏", id: "bgshFavModalConfirm" });
        confirmButton.style.width = "auto";
        footer.append(cancelButton, confirmButton);
        dialog.append(header, body, footer);
        overlay.appendChild(dialog);
        overlay._elements = { select: select, input: input, closeButton: closeButton, cancelButton: cancelButton, confirmButton: confirmButton };
        return overlay;
    }

    function showFavModal(requestURL, tid, onSuccess, customTitle) {
        if (!favKeys) { showToast("无法识别当前用户", "error"); return; }
        var old = qs("#bgshFavoriteModal");
        if (old) old.remove();
        var overlay = createFavoriteModal(customTitle ? "🌟 收藏至目录" : undefined);
        overlay.id = "bgshFavoriteModal";
        document.body.appendChild(overlay);
        var _e = overlay._elements;
        var close = function() { overlay.remove(); };
        var confirm = async function() {
            var folder = _e.input.value.trim();
            if (folder) {
                folder = normalizeFolderName(folder);
                if (!folders.includes(folder)) { folders.push(folder); setJSONValue(favKeys.folders, folders); }
            } else { folder = _e.select.value || "/"; }
            _e.confirmButton.disabled = true;
            _e.confirmButton.textContent = "请求中...";
            var success = await requestFavorite(requestURL, tid, folder, customTitle || "");
            if (success && typeof onSuccess === "function") onSuccess();
            close();
        };
        addSafeEventListener(_e.closeButton, "click", close);
        addSafeEventListener(_e.cancelButton, "click", close);
        addSafeEventListener(_e.confirmButton, "click", confirm);
        addSafeEventListener(overlay, "click", function(event) { if (event.target === overlay) close(); });
        addSafeEventListener(_e.input, "keydown", function(event) {
            if (event.key === "Enter") { event.preventDefault(); confirm(); }
            if (event.key === "Escape") { close(); }
        });
        _e.input.focus();
    }

    // 新版 star - 显示收藏弹窗
    async function star(onSuccess) {
        var tid = extractTid(location.href);
        var formhash = getFormHash();
        if (!tid || !formhash) { showToast("无法获取收藏参数", "error"); return; }
        var params = new URLSearchParams({ mod: "spacecp", ac: "favorite", type: "thread", id: tid, formhash: formhash });
        showFavModal("/home.php?" + params.toString(), tid, onSuccess || renderThreadFavoriteState);
    }

    // ===== 帖子页收藏增强 =====
    function getCurrentThreadFavorite() {
        var tid = extractTid(location.href);
        if (!tid) return null;
        var entries = getFavoriteEntries();
        for (var i = 0; i < entries.length; i++) {
            if (getFavoriteTid(entries[i][1]) === String(tid)) return entries[i];
        }
        return null;
    }

    function removeThreadFavoriteUI() {
        qsa("#bgshThreadUnfavorite, #bgshThreadFavoriteFloat").forEach(function(el) { el.remove(); });
    }

    function renderThreadFavoriteState() {
        var favoriteButton = qs("#k_favorite");
        if (!favKeys) return;
        removeThreadFavoriteUI();
        var current = getCurrentThreadFavorite();
        if (favoriteButton) favoriteButton.style.display = "none";

        var toolbarButton = qs("#quickStarButton");
        if (!toolbarButton) return;
        if (current) {
            var folder = formatFolderName(current[1].folder);
            toolbarButton.textContent = "⭐ 已收藏";
            toolbarButton.title = "已收藏至：" + folder + "；点击取消收藏";
            toolbarButton.dataset.favorited = "1";
        } else {
            toolbarButton.textContent = "☆ 收藏主题";
            toolbarButton.title = "收藏当前主题至指定目录";
            toolbarButton.dataset.favorited = "0";
        }
    }

    function initThreadFavorite() {
        if (!favKeys || !isPageType("post")) return;
        if (!qs("#k_favorite")) return;
        loadFavoriteData();
        renderThreadFavoriteState();
        if (typeof GM_addValueChangeListener === "function" && !BGSH.initialized.has("threadFavoriteListener")) {
            BGSH.initialized.add("threadFavoriteListener");
            var listenerID = GM_addValueChangeListener(favKeys.favs, function(key, oldValue, newValue, remote) {
                if (!remote) return;
                favCache = newValue && typeof newValue === "object" ? newValue : {};
                renderThreadFavoriteState();
            });
            BGSH.listeners.add(function() { if (typeof GM_removeValueChangeListener === "function") GM_removeValueChangeListener(listenerID); });
        }
    }

    // ===== 主题列表快捷收藏 =====
    function getSearchThreadItems() {
        var selectors = [
            "#threadlisttableid a.xst",
            "#threadlist a.xst",
            ".tl a.xst",
            ".searchresult h3.xs3 a",
            "ul.searchresult li.pbw h3 a",
            "#delform a.xst",
            ".threadlist a.xst",
            ".slst a.xst"
        ];
        return Array.from(new Set(qsa(selectors.join(", "))));
    }

    function getThreadItemData(item) {
        if (!item) return null;
        var link = item.tagName === "A"
            ? item
            : qs("h3.xs3 a", item) || qs("a.xst", item) || qs("a[href*='thread-']", item) || qs("a[href*='tid=']", item);
        if (!link) return null;
        var tid = extractTid(link.href);
        if (!tid) return null;
        return { item: item, link: link, tid: tid, title: link.textContent.trim() };
    }

    function renderSearchFavoriteButtons() {
        if (!favKeys || !GM_getValue("showQuickStar", true)) return;
        if (isPageType("post") || isPageType("favorite") || isPageType("newThread")) return;
        loadFavoriteData();
        var formhash = getFormHash();
        var items = getSearchThreadItems();
        for (var i = 0; i < items.length; i++) {
            (function(item) {
                var data = getThreadItemData(item);
                if (!data) return;
                var host = data.link.parentElement;
                if (!host) return;
                var old = qs(".bgsh-list-favorite, .bgsh-search-favorite", host);
                if (old) old.remove();
                var entries = getFavoriteEntries();
                var current = null;
                for (var j = 0; j < entries.length; j++) {
                    if (getFavoriteTid(entries[j][1]) === data.tid) { current = entries[j]; break; }
                }
                var button = createElement("button", { className: "bgsh-list-favorite", text: current ? "★" : "☆", title: current ? "已收藏，点击取消" : "快速收藏主题", attrs: { type: "button", "data-tid": data.tid } });
                Object.assign(button.style, { marginRight: "5px", padding: "0 2px", border: "0", background: "transparent", color: current ? "#ff6600" : "#aaa", cursor: "pointer", fontSize: "17px", lineHeight: "1", verticalAlign: "middle" });
                if (current) {
                    (function(favid) {
                        addSafeEventListener(button, "click", async function(event) {
                            event.preventDefault(); event.stopPropagation();
                            button.textContent = "⏳";
                            if (await executeDeleteRequest(favid)) { delete favCache[favid]; saveFavoriteData(); showToast("已取消收藏", "success"); renderSearchFavoriteButtons(); }
                            else { showToast("取消失败", "error"); renderSearchFavoriteButtons(); }
                        });
                    })(current[0]);
                } else {
                    addSafeEventListener(button, "click", function(event) {
                        event.preventDefault(); event.stopPropagation();
                        var requestURL = formhash ? "/home.php?mod=spacecp&ac=favorite&type=thread&id=" + encodeURIComponent(data.tid) + "&formhash=" + encodeURIComponent(formhash) : "/home.php?mod=spacecp&ac=favorite&type=thread&id=" + encodeURIComponent(data.tid);
                        showFavModal(requestURL, data.tid, renderSearchFavoriteButtons, data.title);
                    });
                }
                host.insertBefore(button, data.link);
            })(items[i]);
        }
    }

    function initSearchFavorite() {
        if (!favKeys || !GM_getValue("showQuickStar", true)) return;
        if (isPageType("post") || isPageType("favorite") || isPageType("newThread")) return;
        renderSearchFavoriteButtons();
        if (BGSH.initialized.has("listFavoriteObserver")) return;
        BGSH.initialized.add("listFavoriteObserver");
        var root = qs("#threadlist") || qs(".searchresult") || qs("#delform") || document.body;
        var run = debounce(renderSearchFavoriteButtons, 250);
        var observer = new MutationObserver(function(mutations) {
            for (var m = 0; m < mutations.length; m++) {
                if (mutations[m].addedNodes.length > 0) { run(); break; }
            }
        });
        observer.observe(root, { childList: true, subtree: true });
        BGSH.listeners.add(function() { observer.disconnect(); });
    }

    // ===== 收藏夹同步与作者提取 =====
    function extractAuthorFromFavoriteItem(item) {
        var selectors = ["a[href*='uid=']", "a[href*='username=']", ".author a", ".by a", ".mg_i em a", "em a"];
        var ignored = new Set(["删除", "编辑", "管理", "取消", "收藏", "移入", "移至", "移出"]);
        for (var s = 0; s < selectors.length; s++) {
            var el = qs(selectors[s], item);
            var text = el ? el.textContent.trim() : "";
            if (text && text.length < 40 && !ignored.has(text)) return text;
        }
        var match = (item.textContent || "").match(/作者\s*[：:]\s*([^-\s【】]+)/i);
        return match ? match[1] : "";
    }

    function extractFavoriteItems(doc) {
        var result = [];
        qsa("#favorite_ul li, #delform li, .favorite li, [id^='favorite_']", doc).forEach(function(item) {
            var link = qs("a[target='_blank'][href*='thread'], a[href*='thread-'], a[href*='tid='], a[href*='viewthread']", item);
            if (!link) return;
            var checkbox = qs("input[type='checkbox']", item);
            var tid = (checkbox && checkbox.getAttribute("vid")) || extractTid(link.href) || "";
            var favid = checkbox && (checkbox.value || checkbox.getAttribute("data-favid"));
            if (favid && !/^\d+$/.test(String(favid))) favid = "";
            if (!favid) {
                var source = (item.id || "") + " " + (item.innerHTML || "");
                var favMatch = source.match(/(?:favorite_|favid[=:\"']+)(\d+)/i);
                favid = favMatch ? favMatch[1] : "";
            }
            // 某些模板不输出收藏 ID，仍以主题 ID 建立稳定的本地记录。
            if (!favid && tid) favid = "tid:" + tid;
            if (!favid) return;
            result.push({ favid: String(favid), tid: tid, title: link.textContent.trim(), url: normalizeURL(link.href), author: extractAuthorFromFavoriteItem(item) });
        });
        return result;
    }

    async function syncFavoritePages(pages, onProgress) {
        if (!currentUid || !favKeys) throw new Error("无法识别当前用户");
        loadFavoriteData();
        var added = 0, updated = 0, completed = 0, total = pages.length;
        var pageQueue = pages.slice();
        var worker = async function() {
            while (pageQueue.length > 0) {
                var page = pageQueue.shift();
                try {
                    var params = new URLSearchParams({ mod: "space", do: "favorite", view: "me", type: "thread", page: String(page) });
                    var html = await fetchText("/home.php?" + params.toString(), {}, 12000);
                    var doc = new DOMParser().parseFromString(html, "text/html");
                    var items = extractFavoriteItems(doc);
                    for (var ii = 0; ii < items.length; ii++) {
                        var item = items[ii];
                        var old = favCache[item.favid];
                        if (!old) {
                            favCache[item.favid] = { tid: item.tid, title: item.title, url: item.url, folder: "/", processed: false, author: item.author };
                            added++;
                        } else {
                            var changed = false;
                            if (!old.title && item.title) { old.title = item.title; changed = true; }
                            if (!old.url && item.url) { old.url = item.url; changed = true; }
                            if (!old.author && item.author) { old.author = item.author; changed = true; }
                            if (changed) updated++;
                        }
                    }
                } catch(e) {}
                completed++;
                if (typeof onProgress === "function") onProgress(completed, total);
            }
        };
        var currentPool = Math.min(poolSize, total);
        var workers = [];
        for (var w = 0; w < currentPool; w++) workers.push(worker());
        await Promise.all(workers);
        saveFavoriteData();
        return { added: added, updated: updated };
    }

    async function getFavoriteTotalPages(firstDoc) {
        var title = qs(".pg span", firstDoc)?.getAttribute("title") || qs(".pg", firstDoc)?.textContent || "";
        var numbers = title.match(/\d+/g);
        if (!numbers || !numbers.length) return 1;
        return Math.max(1, Number(numbers[numbers.length - 1]));
    }

    async function syncAllFavorites(onProgress) {
        if (!currentUid) throw new Error("无法识别当前用户");
        var firstParams = new URLSearchParams({ mod: "space", do: "favorite", view: "me", type: "thread", page: "1" });
        var firstHTML = await fetchText("/home.php?" + firstParams.toString(), {}, 12000);
        var firstDoc = new DOMParser().parseFromString(firstHTML, "text/html");
        var totalPages = await getFavoriteTotalPages(firstDoc);
        var pageArr = [];
        for (var p = 1; p <= totalPages; p++) pageArr.push(p);
        return syncFavoritePages(pageArr, onProgress);
    }

    function isSuspiciousAuthor(name) {
        if (!name) return false;
        return name.length > 20 || /--|【|】/.test(name);
    }

    async function fillMissingAuthors(onProgress) {
        if (!favKeys) return 0;
        loadFavoriteData();
        var entries = getFavoriteEntries().filter(function(e) {
            var author = getFavoriteAuthor(e[1]);
            return (!author || isSuspiciousAuthor(author)) && e[1].url;
        });
        if (!entries.length) return 0;
        var updated2 = 0, completed = 0, total = entries.length;
        var processEntry = async function(entry) {
            var favid = entry[0], data = entry[1];
            try {
                var url = normalizeURL(data.url);
                if (!url) return false;
                var response = await fetch(url, { credentials: "include" });
                if (!response.ok) return false;
                var html = await response.text();
                var doc = new DOMParser().parseFromString(html, "text/html");
                var author = qs(".pls .authi a.xw1, .pls .authi a", doc)?.textContent?.trim() || "";
                if (author) { favCache[favid].author = author; return true; }
            } catch (error) { debugLog("补齐作者失败:", favid, error); }
            return false;
        };
        var worker = async function() {
            while (entries.length > 0) {
                var entry = entries.shift();
                var result = await processEntry(entry);
                if (result) updated2++;
                completed++;
                if (typeof onProgress === "function") onProgress(completed, total);
            }
        };
        var currentPool = Math.min(poolSize, total);
        var workers = [];
        for (var w = 0; w < currentPool; w++) workers.push(worker());
        await Promise.all(workers);
        saveFavoriteData();
        return updated2;
    }

    function cleanEmptyFolders() {
        var usedFolders = new Set();
        for (var k in favCache) {
            if (!favCache.hasOwnProperty(k)) continue;
            var f = favCache[k].folder;
            if (f && f !== "/") usedFolders.add(f);
        }
        var before = folders.length;
        folders = ["/"].concat(folders.filter(function(f) { return f === "/" || usedFolders.has(f); }).filter(function(f, i, arr) { return arr.indexOf(f) === i; }));
        setJSONValue(favKeys.folders, folders);
        return before - folders.length;
    }

    async function autoCategorizeByAuthor(onProgress) {
        if (!favKeys) return 0;
        loadFavoriteData();
        var allEntries = getFavoriteEntries();
        if (!allEntries.length) return 0;
        var missingAuthorEntries = allEntries.filter(function(e) { return !getFavoriteAuthor(e[1]) && e[1].url; });
        if (missingAuthorEntries.length > 0) {
            if (typeof onProgress === "function") onProgress(0, 1, "正在补全作者信息...");
            await fillMissingAuthors(function(current, total) {
                if (typeof onProgress === "function") onProgress(current, total, "补全作者 " + current + "/" + total);
            });
            loadFavoriteData();
        }
        var entriesWithAuthor = getFavoriteEntries();
        var authorGroups = new Map();
        for (var i2 = 0; i2 < entriesWithAuthor.length; i2++) {
            var _entry = entriesWithAuthor[i2];
            var author = getFavoriteAuthor(_entry[1]);
            if (!author) continue;
            if (!authorGroups.has(author)) authorGroups.set(author, []);
            authorGroups.get(author).push(_entry);
        }
        if (!authorGroups.size) return 0;
        var moved = 0, processed = 0, totalGroups = authorGroups.size;
        for (var _entries2 of authorGroups.entries()) {
            var _author = _entries2[0], items = _entries2[1];
            var authorFolder = normalizeFolderName(_author);
            if (!folders.includes(authorFolder)) folders.push(authorFolder);
            for (var i3 = 0; i3 < items.length; i3++) {
                var __entry = items[i3];
                if (__entry[1].folder !== authorFolder) { favCache[__entry[0]].folder = authorFolder; moved++; }
            }
            processed++;
            if (typeof onProgress === "function") onProgress(processed, totalGroups, "分类: " + _author + " (" + items.length + "条)");
        }
        saveFavoriteData();
        var cleaned = cleanEmptyFolders();
        if (cleaned > 0 && typeof onProgress === "function") onProgress(processed, totalGroups, "已清理 " + cleaned + " 个空文件夹");
        return { moved: moved, cleaned: cleaned };
    }

    // ===== 收藏夹图片预览 =====
    function isUsablePreviewImage(url) {
        if (!url) return false;
        var source = safeURL(url, "");
        if (!source) return false;
        try { if (!/^https?:$/i.test(new URL(source).protocol)) return false; } catch(e) { return false; }
        return !["static/image", "avatar", "smiley", "none.gif", "/common/", "common/loading", "common/logo"]
            .some(function(keyword) { return source.toLowerCase().includes(keyword); });
    }

    function extractImageURLs(root, maxCount) {
        if (maxCount === undefined) maxCount = 3;
        if (!root) return [];
        var result = [];
        var matched = new Set();
        var addSource = function(url) {
            if (!url || matched.has(url)) return;
            var absoluteURL = safeURL(url, "");
            if (absoluteURL && result.indexOf(absoluteURL) === -1) { result.push(absoluteURL); matched.add(url); }
        };
        var addImage = function(image) {
            if (result.length >= maxCount) return;
            var src = image.getAttribute("file") || image.getAttribute("zoomfile") || image.getAttribute("data-src") || image.getAttribute("data-original") || image.getAttribute("src") || image.currentSrc;
            if (!src) return;
            if (!isUsablePreviewImage(src)) return;
            addSource(src);
        };
        qsa("img[file], img[zoomfile], img.zoom", root).forEach(addImage);
        if (result.length < maxCount) {
            qsa("img", root).forEach(function(image) {
                if (result.length >= maxCount) return;
                if (image.hasAttribute("file") || image.hasAttribute("zoomfile")) return;
                addImage(image);
            });
        }
        return result;
    }

    async function fetchFavoritePreview(data) {
        var url = normalizeURL(data ? data.url : null);
        if (!url) return [];
        var tid = getFavoriteTid(data);
        var sharedCache = {};
        try { sharedCache = JSON.parse(GM_getValue('bgsh_preview_cache', '{}')); } catch(e) {}
        if (tid && sharedCache[tid] && Array.isArray(sharedCache[tid].imgs) && sharedCache[tid].imgs.length &&
            ((sharedCache[tid].limit || 3) >= previewCount || sharedCache[tid].imgs.length >= previewCount)) {
            return sharedCache[tid].imgs.slice(0, previewCount);
        }
        try {
            var html = await fetchText(url, {}, 10000);
            var doc = new DOMParser().parseFromString(html, "text/html");
            var urls = extractImageURLs(doc.body || doc, Math.max(previewCount, 12));
            if (tid) {
                sharedCache[tid] = {
                    imgs: urls,
                    ts: Date.now(),
                    limit: Math.max(previewCount, 12)
                };
                GM_setValue('bgsh_preview_cache', JSON.stringify(sharedCache));
            }
            return urls;
        } catch (error) { debugLog("收藏夹图片预览失败:", error); return []; }
    }

    function createFavoritePreview(container, urls) {
        clearElement(container);
        var allUrls = Array.isArray(urls) ? urls : [];
        if (!allUrls.length) { container.dataset.loaded = "1"; return; }
        var columns = getPreviewColumnCount(Math.min(previewCount, allUrls.length));
        Object.assign(container.style, {
            display: "grid",
            gridTemplateColumns: "repeat(" + columns + ", var(--bgsh-effective-preview-size, var(--bgsh-preview-size, 180px)))",
            gridAutoFlow: "row dense",
            justifyContent: "start",
            alignItems: "start",
            gap: "4px",
            width: "100%",
            marginTop: "6px",
            paddingLeft: "28px",
            boxSizing: "border-box"
        });
        var imageEls = [];
        var slotCount = Math.min(previewCount, allUrls.length);
        for (var i = 0; i < slotCount; i++) {
            var img = createElement("img");
            Object.assign(img.style, { display: "block", width: "var(--bgsh-preview-size, 180px)", height: "var(--bgsh-preview-height, 135px)", margin: "0", padding: "0", border: "1px solid #eaeaea", borderRadius: "6px", objectFit: "cover", cursor: "zoom-in", boxSizing: "border-box" });
            container.appendChild(img);
            imageEls.push(img);
        }
        var loaded = 0, urlIdx = 0;
        var done = function() {
            for (var i4 = loaded; i4 < imageEls.length; i4++) imageEls[i4].style.display = "none";
            var cols = getPreviewColumnCount(loaded || 1);
            container.style.gridTemplateColumns = "repeat(" + cols + ", var(--bgsh-effective-preview-size, var(--bgsh-preview-size, 180px)))";
            container.dataset.bgshPreviewColumns = String(cols);
            container.dataset.loaded = "1";
            requestAnimationFrame(function() {
                syncPreviewBoxSize(container, getPreviewSize());
            });
        };
        var loadSlot = function(slot) {
            if (loaded >= previewCount || urlIdx >= allUrls.length) { done(); return; }
            var _url = allUrls[urlIdx++];
            if (!_url) { loadSlot(slot); return; }
            var img = imageEls[slot];
            var settled = false;
            var onLoad = function() { if (settled) return; settled = true; loaded++; loadSlot(slot + 1); };
            var onError = function() { if (settled) return; settled = true; loadSlot(slot); };
            img.addEventListener("load", onLoad);
            img.addEventListener("error", onError);
            (function(url) { img.onclick = function(event) { event.stopPropagation(); window.open(url, '_blank'); }; })(_url);
            img.alt = "";
            img.src = _url;
            if (img.complete) { if (img.naturalWidth > 0) onLoad(); else onError(); }
        };
        loadSlot(0);
    }

    function extractFavoriteReplyState(html) {
        var doc = new DOMParser().parseFromString(html, "text/html");
        var posts = getPostContainers(doc);
        var latestPid = posts.length ? getPostPid(posts[0]) : "";
        var pids = Array.from(new Set(posts.map(getPostPid).filter(Boolean)));
        var maxFloor = 0;
        doc.querySelectorAll(".pi strong a em, .pi strong em, .pi .floor, [id^='postnum']").forEach(function(node) {
            var match = String(node.textContent || "").match(/(\d+)/);
            if (match) maxFloor = Math.max(maxFloor, parseInt(match[1], 10) || 0);
        });
        var replyCount = maxFloor > 0 ? Math.max(0, maxFloor - 1) : 0;
        if (!replyCount) {
            var pageText = String(doc.body ? doc.body.textContent : "");
            var replyMatch = pageText.match(/回复\s*[:：]\s*(\d+)/);
            if (replyMatch) replyCount = parseInt(replyMatch[1], 10) || 0;
        }
        return { replyCount: replyCount, latestPid: latestPid, pids: pids };
    }

    async function fetchFavoriteReplyState(data) {
        var tid = getFavoriteTid(data);
        if (!tid) throw new Error("缺少主题编号");
        var url = baseURL + "/forum.php?mod=viewthread&tid=" + encodeURIComponent(tid) + "&ordertype=1&page=1";
        var html = await fetchText(url, { cache: "no-store" }, 12000);
        if (/过于?频繁|间隔.*秒|请稍后/i.test(html)) throw new Error("网站限制访问频率");
        return extractFavoriteReplyState(html);
    }

    async function checkFavoriteReplyUpdates(entries, onProgress) {
        var queue = (entries || []).slice();
        var total = queue.length;
        var completed = 0;
        var updated = 0;
        var failed = 0;
        var worker = async function() {
            while (queue.length) {
                var entry = queue.shift();
                var data = entry && entry[1];
                if (!data) continue;
                try {
                    var state = await fetchFavoriteReplyState(data);
                    var previousBaseline = Number(data.replyBaseline);
                    var hasBaseline = data.replyBaseline !== undefined && data.replyBaseline !== null && Number.isFinite(previousBaseline);
                    if (!hasBaseline) {
                        data.replyBaseline = state.replyCount;
                        data.newReplyCount = 0;
                    } else {
                        var countDifference = Math.max(0, state.replyCount - previousBaseline);
                        var previousPids = Array.isArray(data.replySnapshotPids) ? data.replySnapshotPids : [];
                        var newlySeenPids = state.pids.filter(function(pid) { return previousPids.indexOf(pid) === -1; }).length;
                        data.newReplyCount = countDifference > 0
                            ? countDifference
                            : Math.max(0, Number(data.newReplyCount) || 0) + newlySeenPids;
                        if (data.newReplyCount > 0) updated++;
                    }
                    data.latestReplyCount = state.replyCount;
                    data.latestReplyPid = state.latestPid;
                    data.replySnapshotPids = state.pids.slice(0, 50);
                    data.replyCheckedAt = Date.now();
                } catch (error) {
                    failed++;
                    debugLog("检查收藏追更失败", getFavoriteTid(data), error);
                }
                completed++;
                if (typeof onProgress === "function") onProgress(completed, total, updated, failed);
                if (queue.length) await new Promise(function(resolve) { setTimeout(resolve, 180); });
            }
        };
        var workers = [];
        var concurrency = Math.max(1, Math.min(3, poolSize, total));
        for (var i = 0; i < concurrency; i++) workers.push(worker());
        await Promise.all(workers);
        saveFavoriteData();
        return { total: total, updated: updated, failed: failed };
    }

    function markFavoriteReplyUpdatesSeen(data) {
        if (!data) return;
        var latest = Number(data.latestReplyCount);
        if (Number.isFinite(latest)) data.replyBaseline = latest;
        data.newReplyCount = 0;
        saveFavoriteData();
    }

    function findFavoriteThreadPostContent(doc) {
        return doc && doc.querySelector(
            "#postlist [id^='postmessage_'], #postlist .pcb .t_f, " +
            "#postlist .plc .t_f, div[id^='postmessage_'], .pcb .t_f, .plc .t_f"
        );
    }

    function extractStandardEd2kLinks(sourceDocumentOrHtml) {
        var doc = sourceDocumentOrHtml && sourceDocumentOrHtml.nodeType === 9
            ? sourceDocumentOrHtml
            : new DOMParser().parseFromString(String(sourceDocumentOrHtml || ""), "text/html");
        var mainPostContent = findFavoriteThreadPostContent(doc);
        if (!mainPostContent && doc.body) mainPostContent = doc.body;
        if (!mainPostContent) return [];

        var links = [];
        var seen = new Set();

        // 第一步：精准定位帖子正文里带 ed2k 行的代码容器
        var allCodeContainers = mainPostContent.querySelectorAll(
            ".blockcode, .blockcode li, pre, code, textarea, .showhide, .locked, .quote"
        );
        var ed2kContainers = [];
        for (var i = 0; i < allCodeContainers.length; i++) {
            var container = allCodeContainers[i];
            var containerText = container.textContent || container.innerHTML || "";
            if (/ed2k:\/\/\|file\|/i.test(containerText)) {
                ed2kContainers.push(container);
            }
        }

        // 第二步：只从带 ed2k 的代码容器提取；找不到时才回退到正文整体
        var searchTargets = ed2kContainers.length > 0 ? ed2kContainers : [mainPostContent];

        // 兼容：全小写/大写(i标志)、带中英文括号包裹、ed2k标准三段格式
        // 标准格式: ed2k://|file|文件名|大小|哈希|/
        var pattern = /(?:[（(]\s*)?(ed2k:\/\/\|file\|[^<>"'\r\n|]*\|[^<>"'\r\n|]*\|[^<>"'\r\n|]*\|\/)(?:\s*[)）])?/gi;

        searchTargets.forEach(function(target) {
            // 同时读取文本内容和HTML，确保多行链接都能抓到
            var rawParts = [
                target.textContent || "",
                target.innerHTML || ""
            ];
            // 如果是textarea或input，额外读取value
            if (target.value) rawParts.push(target.value);
            // 如果是a标签，额外读取href
            if (target.getAttribute && target.getAttribute("href")) rawParts.push(target.getAttribute("href"));

            rawParts.forEach(function(rawText) {
                // 先解码HTML实体，避免 &amp; &lt; 等破坏链接匹配
                var text = String(rawText || "")
                    .replace(/&amp;/g, "&")
                    .replace(/&lt;/g, "<")
                    .replace(/&gt;/g, ">")
                    .replace(/&quot;/g, '"')
                    .replace(/&#39;/g, "'")
                    .replace(/&nbsp;/g, " ");
                pattern.lastIndex = 0;
                var match;
                while ((match = pattern.exec(text)) !== null) {
                    var link = String(match[1] || match[0]).trim();
                    // 清理链接两端可能残留的括号、空白和HTML标签
                    link = link.replace(/^[（(\s]+|[）)\s]+$/g, "").replace(/<[^>]+>/g, "");
                    var key = link.toLocaleLowerCase();
                    if (!seen.has(key) && /^ed2k:\/\/\|file\|.+\|.+\|.+\|\/$/i.test(link)) {
                        seen.add(key);
                        links.push(link);
                    }
                }
            });
        });
        return links;
    }

    function openFavoriteThreadAndWaitForPost(threadUrl) {
        var openedWindow = window.open(threadUrl, "_blank");
        if (!openedWindow) return Promise.reject(new Error("浏览器阻止了帖子页面弹出"));

        return new Promise(function(resolve, reject) {
            var startedAt = Date.now();
            var contentReadyAt = 0;
            var timer = setInterval(function() {
                if (openedWindow.closed) {
                    clearInterval(timer);
                    reject(new Error("帖子页面已关闭"));
                    return;
                }
                var openedDocument;
                try {
                    openedDocument = openedWindow.document;
                } catch (error) {
                    clearInterval(timer);
                    reject(new Error("帖子页面与当前页面不同域，无法读取正文"));
                    return;
                }

                var postContent = findFavoriteThreadPostContent(openedDocument);
                var pageLoaded = openedDocument.readyState === "complete";
                if (pageLoaded && postContent) {
                    if (!contentReadyAt) contentReadyAt = Date.now();
                    // 直接检测正文中是否已出现 ed2k 链接，出现就立即返回
                    var contentHtml = postContent.innerHTML || postContent.textContent || "";
                    var hasEd2k = /ed2k:\/\/\|file\|/i.test(contentHtml);
                    var codeBlock = postContent.querySelector(
                        ".blockcode, pre, code, a[href^='ed2k:' i], textarea, .showhide, .locked"
                    );
                    // 找到ed2k链接立即返回；有代码块也返回；正文就绪超过3秒也返回（给动态内容足够时间）
                    if (hasEd2k || codeBlock || Date.now() - contentReadyAt >= 3000) {
                        clearInterval(timer);
                        resolve(openedDocument);
                        return;
                    }
                }
                if (Date.now() - startedAt >= 25000) {
                    clearInterval(timer);
                    if (postContent) resolve(openedDocument);
                    else reject(new Error("等待帖子正文加载超时"));
                }
            }, 200);
        });
    }

    function sanitizeFavoriteEd2kFilename(title, tid) {
        var safeTitle = String(title || "")
            .replace(/[\\/:*?"<>|\x00-\x1f]/g, "_")
            .replace(/[.\s]+$/g, "")
            .trim()
            .slice(0, 100);
        return (safeTitle || ("98T-ED2K-" + (tid || "export"))) + ".txt";
    }

    function downloadFavoriteEd2kText(title, tid, links) {
        // 指定格式：第一行标题，下一行开始逐条写入链接。
        var lineTitle = String(title || "").replace(/[\r\n\t]+/g, " ").trim();
        var textContent = [lineTitle].concat(links).join("\r\n") + "\r\n";
        var blob = new Blob(["\uFEFF", textContent], { type: "text/plain;charset=utf-8" });
        var objectUrl = URL.createObjectURL(blob);
        var downloadLink = document.createElement("a");
        var filename = sanitizeFavoriteEd2kFilename(title, tid);
        downloadLink.href = objectUrl;
        downloadLink.download = filename;
        downloadLink.style.display = "none";
        document.body.appendChild(downloadLink);
        downloadLink.click();
        downloadLink.remove();
        setTimeout(function() { URL.revokeObjectURL(objectUrl); }, 1000);
        return filename;
    }

    // 批量导出：多个帖子的标题+链接合并到同一个 TXT
    function downloadFavoriteEd2kBatchText(entries) {
        // entries: [{title: "标题", links: ["ed2k://...", ...]}, ...]
        var lines = [];
        entries.forEach(function(entry, index) {
            if (index > 0) lines.push(""); // 帖子之间空一行分隔
            lines.push(String(entry.title || "").replace(/[\r\n\t]+/g, " ").trim());
            (entry.links || []).forEach(function(link) {
                lines.push(link);
            });
        });
        var textContent = lines.join("\r\n") + "\r\n";
        var blob = new Blob(["\uFEFF", textContent], { type: "text/plain;charset=utf-8" });
        var objectUrl = URL.createObjectURL(blob);
        var downloadLink = document.createElement("a");
        var dateStr = new Date().toISOString().slice(0, 10);
        var filename = "98T-ED2K批量导出-" + dateStr + ".txt";
        downloadLink.href = objectUrl;
        downloadLink.download = filename;
        downloadLink.style.display = "none";
        document.body.appendChild(downloadLink);
        downloadLink.click();
        downloadLink.remove();
        setTimeout(function() { URL.revokeObjectURL(objectUrl); }, 1000);
        return filename;
    }

    async function exportFavoriteLinks(data) {
        if (!data) return { count: 0 };
        // 用勾选行的正确 tid 拼接帖子链接，避免 data.url 有误导致串到其他帖子
        var tid = getFavoriteTid(data);
        var threadUrl = tid
            ? baseURL + "/forum.php?mod=viewthread&tid=" + encodeURIComponent(tid)
            : normalizeURL(data.url);
        if (!threadUrl) {
            showToast("当前收藏条目缺少主题编号", "warning");
            return { count: 0 };
        }

        // 后台 fetch 请求帖子页面 HTML，不跳转、不弹窗
        var htmlText;
        try {
            showToast("正在后台提取链接，请稍候...", "info", 2500);
            htmlText = await fetchText(threadUrl, { cache: "no-store" }, 15000);
        } catch (fetchError) {
            debugLog("提取收藏帖 ED2K 链接失败", tid, fetchError);
            showToast("读取帖子页面失败，请检查网络或登录状态", "error");
            return { count: 0 };
        }

        // 从 HTML 文本中精准定位代码容器，提取 ed2k 链接
        var links = extractStandardEd2kLinks(htmlText);
        if (!links.length) {
            showToast("没有找到有效的 ED2K 下载链接，请确认帖子已解锁且包含资源链接", "warning", 4500);
            return { count: 0 };
        }

        // 拼好内容生成 Blob，触发下载，留在当前收藏列表页
        var title = String(getFavoriteTitle(data) || ("主题 " + tid)).trim();
        var filename = downloadFavoriteEd2kText(title, tid, links);
        return { count: links.length, filename: filename };
    }

    // ===== 收藏夹页面 UI =====
    function createFavoritePageSkeleton() {
        var root = createElement("div", { id: "bgshFavoriteApp" });
        Object.assign(root.style, { display: "flex", width: "100%", height: "750px", overflow: "hidden", border: "1px solid #ddd", borderRadius: "8px", background: "#fff", boxSizing: "border-box" });
        var sidebar = createElement("aside", { id: "bgshFavoriteSidebar" });
        Object.assign(sidebar.style, { display: "flex", width: "230px", flexShrink: "0", minHeight: "0", flexDirection: "column", borderRight: "1px solid #eee", background: "#f9f9f9", transition: "width .2s" });
        var sidebarTitle = createElement("div", { text: "📁 目录导航" });
        Object.assign(sidebarTitle.style, { padding: "15px", borderBottom: "1px solid #eee", background: "#eee", fontWeight: "bold" });
        var tree = createElement("div", { id: "bgshFavoriteTree" });
        // minHeight:0 是必须的：flex 子项默认 min-height:auto，目录多的时候目录树
        // 不肯收缩，会把下面的工具箱顶出 #bgshFavoriteApp（固定 750px + overflow:hidden），
        // 导致「创建目录/同步/补齐作者/自动分类/清空」整块被裁掉看不见。
        Object.assign(tree.style, { flex: "1 1 auto", minHeight: "0", overflowY: "auto", padding: "10px 0" });
        var toolbox = createElement("div", { id: "bgshFavoriteToolbox" });
        Object.assign(toolbox.style, { flexShrink: "0", maxHeight: "60%", overflowY: "auto", padding: "12px", borderTop: "1px solid #eee", background: "#fbfbfb" });
        var addInput = createElement("input", { id: "bgshFavoriteFolderInput", attrs: { type: "text", placeholder: "输入目录名..." } });
        Object.assign(addInput.style, { boxSizing: "border-box", width: "100%", marginBottom: "8px", padding: "7px", border: "1px solid #ccc", borderRadius: "4px" });
        var addButton = createElement("button", { className: "bgsh-customBtn", text: "➕ 创建目录", id: "bgshFavoriteAddFolder" });
        addButton.style.margin = "0 0 10px"; addButton.style.background = "linear-gradient(135deg,#ff6600,#ff9900)"; addButton.style.color = "#fff";
        var autoPreviewLabel = createElement("label", { text: "🖼️ 图片预览（同步显示设置）" });
        var autoPreview = createElement("input", { id: "bgshFavoriteAutoPreview", attrs: { type: "checkbox" } });
        autoPreviewLabel.prepend(autoPreview);
        var countWrapper = createElement("div", { text: "🖼️ 预览数量：" });
        var countInput = createElement("input", { id: "bgshFavoritePreviewCount", attrs: { type: "number", min: "1", max: "20" } });
        countInput.style.width = "50px"; countInput.style.marginLeft = "5px"; countWrapper.appendChild(countInput);
        var poolWrapper = createElement("div", { text: "⏳ 并发请求数：" });
        var poolInput = createElement("input", { id: "bgshFavoritePoolSize", attrs: { type: "number", min: "1", max: "20" } });
        poolInput.style.width = "50px"; poolInput.style.marginLeft = "5px"; poolInput.value = poolSize; poolInput.title = "同步全部收藏夹和补齐作者的并发请求数"; poolWrapper.appendChild(poolInput);
        var syncInput = createElement("input", { id: "bgshFavoriteSyncPages", attrs: { type: "text", placeholder: "页码，如 1 或 1-3" } });
        Object.assign(syncInput.style, { boxSizing: "border-box", width: "100%", marginTop: "10px", padding: "6px", border: "1px solid #66bb6a", borderRadius: "4px" });
        var syncPageButton = createElement("button", { className: "bgsh-customBtn", text: "📄 同步指定页", id: "bgshFavoriteSyncPagesButton" });
        var syncAllButton = createElement("button", { className: "bgsh-customBtn", text: "🔄 同步全部收藏夹", id: "bgshFavoriteSyncAllButton" });
        var authorButton = createElement("button", { className: "bgsh-customBtn", text: "🖊️ 补齐作者", id: "bgshFavoriteFillAuthors" });
        var categorizeButton = createElement("button", { className: "bgsh-customBtn", text: "📂 自动分类", id: "bgshFavoriteCategorize" });
        var resetButton = createElement("button", { className: "bgsh-customBtn", text: "🧹 清空本地数据", id: "bgshFavoriteReset" });
        var buttons = [syncPageButton, syncAllButton, authorButton, categorizeButton, resetButton];
        for (var b = 0; b < buttons.length; b++) { buttons[b].style.margin = "8px 0 0"; buttons[b].style.fontSize = "12px"; }
        resetButton.style.background = "linear-gradient(135deg,#ff6b6b,#ee5a24)"; resetButton.style.color = "#fff";
        toolbox.append(addInput, addButton, autoPreviewLabel, countWrapper, poolWrapper, syncInput, syncPageButton, syncAllButton, authorButton, categorizeButton, resetButton);
        sidebar.append(sidebarTitle, tree, toolbox);
        var main = createElement("main", { id: "bgshFavoriteMain" });
        Object.assign(main.style, { display: "flex", minWidth: "0", flex: "1", flexDirection: "column" });
        var toolbar = createElement("div", { id: "bgshFavoriteToolbar" });
        Object.assign(toolbar.style, { display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px", flexShrink: "0", padding: "10px 14px", borderBottom: "1px solid #eee", background: "#fcfcfc" });
        var toggleSidebar = createElement("button", { className: "bgsh-customBtn", text: "≡", id: "bgshFavoriteToggleSidebar" });
        toggleSidebar.style.width = "auto"; toggleSidebar.style.margin = "0";
        var path = createElement("strong", { id: "bgshFavoritePath", text: "🏠 全部记录" });
        Object.assign(path.style, { flex: "1", overflow: "hidden", color: "#ff6600", textOverflow: "ellipsis", whiteSpace: "nowrap" });
        var sort = createElement("select", { id: "bgshFavoriteSort" });
        sort.innerHTML = '<option value="favid">⏱️ 按收藏时间</option><option value="tid">📝 按发帖时间</option><option value="updates">🔴 按新回复</option>';
        var mode = createElement("select", { id: "bgshFavoriteSearchMode" });
        mode.innerHTML = '<option value="all">🔍 全部</option><option value="title">📄 标题</option><option value="author">👤 作者</option>';
        var search = createElement("input", { id: "bgshFavoriteSearch", attrs: { type: "search", placeholder: "🔍 关键词过滤：空格分词，-词排除" } });
        Object.assign(search.style, { width: "240px", flex: "1 1 220px", padding: "6px 10px", border: "1px solid #ccc", borderRadius: "18px" });
        var updateButton = createElement("button", { className: "bgsh-customBtn", text: "🔔 检查收藏追更", id: "bgshFavoriteCheckUpdates" });
        var exportButton = createElement("button", { className: "bgsh-customBtn", text: "💾 保存 ED2K 到 TXT", id: "bgshFavoriteExportLinks" });
        updateButton.title = "首次检查会建立回复数基线，之后检查时标红显示新增回复";
        exportButton.title = "将最近悬浮或高亮激活收藏帖的标题和有效 ED2K 链接直接保存为 TXT";
        [updateButton, exportButton].forEach(function(button) {
            button.style.width = "auto";
            button.style.margin = "0";
            button.style.padding = "5px 10px";
            button.style.fontSize = "12px";
        });
        toolbar.append(toggleSidebar, path, sort, mode, search, updateButton, exportButton);
        var list = createElement("div", { id: "bgshFavoriteList" });
        Object.assign(list.style, { flex: "1", overflowY: "auto" });
        main.append(toolbar, list);
        root.append(sidebar, main);
        return { root: root, sidebar: sidebar, tree: tree, toolbox: toolbox, list: list, path: path, addInput: addInput, addButton: addButton, autoPreview: autoPreview, countInput: countInput, poolInput: poolInput, syncInput: syncInput, syncPageButton: syncPageButton, syncAllButton: syncAllButton, authorButton: authorButton, categorizeButton: categorizeButton, resetButton: resetButton, toggleSidebar: toggleSidebar, sort: sort, mode: mode, search: search, updateButton: updateButton, exportButton: exportButton };
    }

    function renderFavoriteTree(ui, renderList2, refreshTree) {
        clearElement(ui.tree);
        var counts = { ALL: 0, "/": 0 };
        for (var f = 0; f < folders.length; f++) counts[folders[f]] = 0;
        var entries = getFavoriteEntries();
        for (var i = 0; i < entries.length; i++) {
            var data = entries[i][1];
            counts.ALL++;
            var folder2 = folders.includes(data.folder) ? data.folder : "/";
            counts[folder2] = (counts[folder2] || 0) + 1;
        }
        var createNode = function(folder2, label, icon, system) {
            var item = createElement("div");
            Object.assign(item.style, { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderLeft: currentFolder === folder2 ? "4px solid #ff6600" : "4px solid transparent", background: currentFolder === folder2 ? "#fff" : "transparent", color: currentFolder === folder2 ? "#ff6600" : "#333", cursor: "pointer", fontWeight: currentFolder === folder2 ? "bold" : "normal" });
            var name = createElement("span", { text: icon + " " + label + " (" + (counts[folder2] || 0) + ")" });
            name.style.flex = "1";
            addSafeEventListener(item, "click", function(event) {
                if (event.target !== item && event.target.parentElement !== item) return;
                currentFolder = folder2;
                needsPageReset = true;
                try { if (typeof refreshTree === "function") refreshTree(); renderList2(); } catch (error) { errorLog("切换文件夹失败:", error, "folder:", folder2); showToast("切换文件夹失败", "error"); }
            });
            item.appendChild(name);
            if (!system) {
                var actions = createElement("span");
                (function(folderName) {
                    var rename = createElement("button", { className: "bgsh-customBtn", text: "✏️" });
                    rename.style.width = "auto"; rename.style.margin = "0"; rename.style.padding = "2px 4px"; rename.style.background = "transparent"; rename.style.boxShadow = "none";
                    addSafeEventListener(rename, "click", function(event) {
                        event.stopPropagation();
                        showRenameFolderModal(folderName, typeof refreshTree === "function" ? refreshTree : renderList2, renderList2);
                    });
                    var remove = createElement("button", { className: "bgsh-customBtn", text: "🗑️" });
                    remove.style.width = "auto"; remove.style.margin = "0"; remove.style.padding = "2px 4px"; remove.style.background = "transparent"; remove.style.boxShadow = "none";
                    addSafeEventListener(remove, "click", function(event) {
                        event.stopPropagation();
                        showDeleteFolderModal(folderName, typeof refreshTree === "function" ? refreshTree : renderList2, renderList2);
                    });
                    actions.append(rename, remove);
                })(folder2);
                item.appendChild(actions);
            }
            ui.tree.appendChild(item);
        };
        createNode("ALL", "全部记录", "🏠", true);
        createNode("/", "未分类", "📦", true);
        folders.filter(function(f) { return f !== "/"; }).sort(function(a, b) { return a.localeCompare(b); }).forEach(function(f) { createNode(f, formatFolderName(f), "📂", false); });
    }

    function getFilteredFavoriteEntries(ui) {
        var query = ui.search.value.trim().toLowerCase();
        var modeVal = ui.mode.value;
        var terms = query ? query.split(/\s+/).filter(Boolean) : [];
        var entries = getFavoriteEntries();
        var result = [];
        for (var i = 0; i < entries.length; i++) {
            var entry = entries[i], data = entry[1];
            if (currentFolder !== "ALL" && data.folder !== currentFolder) continue;
            if (terms.length) {
                var title = getFavoriteTitle(data).toLowerCase();
                var author = getFavoriteAuthor(data).toLowerCase();
                var text = modeVal === "title" ? title : modeVal === "author" ? author : title + " " + author;
                var match = true;
                for (var t = 0; t < terms.length; t++) {
                    if (terms[t].startsWith("-")) { if (text.includes(terms[t].slice(1))) { match = false; break; } }
                    else { if (!text.includes(terms[t])) { match = false; break; } }
                }
                if (!match) continue;
            }
            result.push(entry);
        }
        result.sort(function(a, b) {
            if (currentSort === "updates") {
                var updateDiff = Number(b[1].newReplyCount || 0) - Number(a[1].newReplyCount || 0);
                if (updateDiff) return updateDiff;
                var checkedDiff = Number(b[1].replyCheckedAt || 0) - Number(a[1].replyCheckedAt || 0);
                if (checkedDiff) return checkedDiff;
            }
            if (currentSort === "tid") return Number(getFavoriteTid(b[1])) - Number(getFavoriteTid(a[1]));
            return Number(b[0]) - Number(a[0]);
        });
        return result;
    }

    function renderFavoriteList(ui) {
        if (needsPageReset) { renderLimit = PAGE_SIZE; needsPageReset = false; }
        clearElement(ui.list);
        var entries = getFilteredFavoriteEntries(ui);
        if (!entries.length) {
            var totalCount = Object.keys(favCache).length;
            var empty = createElement("div", { text: totalCount ? "没有找到匹配的内容~" : "📭 暂无数据，请点击左侧「同步」按钮拉取收藏" });
            Object.assign(empty.style, { padding: "50px", color: "#999", textAlign: "center" });
            ui.list.appendChild(empty);
            return;
        }
        var showEntries = renderLimit > 0 ? entries.slice(0, renderLimit) : entries;
        for (var i = 0; i < showEntries.length; i++) {
            (function() {
                var entry = showEntries[i];
                var favid = entry[0], data = entry[1];
                var newReplyCount = Math.max(0, Number(data.newReplyCount) || 0);
                var item = createElement("div", { className: "bgsh-favorite-item" });
                item.dataset.favid = favid;
                Object.assign(item.style, {
                    padding: "12px 18px",
                    borderBottom: "1px solid #eee",
                    borderLeft: newReplyCount > 0 ? "4px solid #ff3b30" : "4px solid transparent",
                    background: newReplyCount > 0 ? "rgba(255,59,48,.07)" : "transparent"
                });
                var activateForExport = function() {
                    ui.list.querySelectorAll(".bgsh-favorite-export-active").forEach(function(activeItem) {
                        activeItem.classList.remove("bgsh-favorite-export-active");
                        activeItem.removeAttribute("aria-selected");
                        activeItem.style.removeProperty("box-shadow");
                    });
                    activeFavoriteExportFavid = String(favid);
                    item.classList.add("bgsh-favorite-export-active");
                    item.setAttribute("aria-selected", "true");
                    item.style.boxShadow = "inset 4px 0 0 #ff7a00, inset 0 0 0 1px rgba(255,122,0,.35)";
                };
                addSafeEventListener(item, "mouseenter", activateForExport);
                addSafeEventListener(item, "pointerdown", activateForExport);
                if (String(activeFavoriteExportFavid) === String(favid)) activateForExport();
                var row = createElement("div");
                Object.assign(row.style, { display: "flex", alignItems: "center", gap: "8px" });
                var processed = createElement("input", { attrs: { type: "checkbox" } });
                processed.checked = isFavoriteProcessed(data);
                var titleLink = createElement("a", { text: getFavoriteTitle(data), attrs: { href: normalizeURL(data.url) || "#", target: "_blank", rel: "noopener noreferrer" } });
                Object.assign(titleLink.style, { flex: "1", minWidth: "0", overflow: "hidden", color: processed.checked ? "#aaa" : newReplyCount > 0 ? "#d93025" : "#333", textDecoration: processed.checked ? "line-through" : "none", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: "bold" });
                var updateBadge = null;
                if (newReplyCount > 0) {
                    updateBadge = createElement("span", { text: "+" + newReplyCount + " 新回复", title: "打开主题后标记为已读" });
                    Object.assign(updateBadge.style, { flexShrink: "0", padding: "2px 7px", borderRadius: "10px", background: "#ff3b30", color: "#fff", fontSize: "11px", fontWeight: "700" });
                }
                var folderSelect = createElement("select", { className: "bgsh-favorite-move" });
                Object.assign(folderSelect.style, { maxWidth: "150px", minWidth: "80px", flexShrink: "0" });
                var folderOpts = [["/", "📦 未分类"]];
                folders.filter(function(f) { return f !== "/"; }).forEach(function(f) { folderOpts.push([f, "📁 " + formatFolderName(f)]); });
                for (var o = 0; o < folderOpts.length; o++) {
                    var opt2 = createElement("option", { text: folderOpts[o][1], attrs: { value: folderOpts[o][0] } });
                    opt2.selected = folderOpts[o][0] === data.folder;
                    folderSelect.appendChild(opt2);
                }
                folderSelect.title = "当前: " + formatFolderName(data.folder) + " → 选择移动至...";
                var deleteButton = createElement("button", { className: "bgsh-customBtn", text: "❌ 移除" });
                deleteButton.style.width = "auto"; deleteButton.style.margin = "0"; deleteButton.style.padding = "4px 6px"; deleteButton.style.background = "transparent"; deleteButton.style.boxShadow = "none"; deleteButton.style.color = "#d9534f";
                row.append(processed, titleLink);
                if (updateBadge) row.appendChild(updateBadge);
                row.append(folderSelect, deleteButton);
                var author = getFavoriteAuthor(data);
                if (author) {
                    var authorElement = createElement("div", { text: "👤 作者: " + author });
                    Object.assign(authorElement.style, { marginTop: "4px", marginLeft: "28px", color: "#999", fontSize: "12px" });
                    item.appendChild(row);
                    item.appendChild(authorElement);
                } else { item.appendChild(row); }
                var preview = createElement("div", { className: "bgsh-favorite-preview" });
                preview.style.display = "none";
                item.appendChild(preview);
                addSafeEventListener(processed, "change", function() {
                    favCache[favid].processed = processed.checked;
                    saveFavoriteData();
                    titleLink.style.color = processed.checked ? "#aaa" : newReplyCount > 0 ? "#d93025" : "#333";
                    titleLink.style.textDecoration = processed.checked ? "line-through" : "none";
                });
                addSafeEventListener(titleLink, "click", function() {
                    if (newReplyCount <= 0) return;
                    markFavoriteReplyUpdatesSeen(data);
                    newReplyCount = 0;
                    item.style.borderLeftColor = "transparent";
                    item.style.background = "transparent";
                    titleLink.style.color = processed.checked ? "#aaa" : "#333";
                    if (updateBadge) updateBadge.remove();
                });
                addSafeEventListener(folderSelect, "change", function() {
                    favCache[favid].folder = folderSelect.value;
                    saveFavoriteData();
                    showToast("移动成功", "success");
                    renderFavoriteTree(ui, function() { renderFavoriteList(ui); });
                    if (currentFolder !== "ALL" && favCache[favid].folder !== currentFolder) item.remove();
                });
                addSafeEventListener(deleteButton, "click", async function() {
                    deleteButton.disabled = true;
                    deleteButton.textContent = "删除中...";
                    if (await executeDeleteRequest(favid)) {
                        if (String(activeFavoriteExportFavid) === String(favid)) activeFavoriteExportFavid = "";
                        delete favCache[favid]; saveFavoriteData(); item.remove(); showToast("移除成功", "success");
                    }
                    else { deleteButton.disabled = false; deleteButton.textContent = "❌ 移除"; showToast("移除失败", "error"); }
                });
                if (isAutoPreview) {
                    preview.style.display = "block";
                    if (data.imagePreview && Array.isArray(data.imagePreview.urls)) {
                        createFavoritePreview(preview, data.imagePreview.urls);
                    } else {
                        preview.dataset.loading = "1";
                        fetchFavoritePreview(data).then(function(urls) {
                            if (!item.isConnected) return;
                            data.imagePreview = { urls: urls, ts: Date.now() };
                            createFavoritePreview(preview, urls);
                        });
                    }
                }
                ui.list.appendChild(item);
            })();
        }
        if (entries.length > renderLimit) {
            var remaining = entries.length - renderLimit;
            var loadMore = createElement("div", { text: "▼ 加载更多 (剩余 " + remaining + " 条)" });
            Object.assign(loadMore.style, { padding: "14px", textAlign: "center", color: "#ff6600", cursor: "pointer", fontSize: "14px", fontWeight: "bold", borderBottom: "1px solid #eee", userSelect: "none" });
            loadMore.onclick = function() { needsPageReset = false; renderLimit += PAGE_SIZE; renderFavoriteList(ui); };
            ui.list.appendChild(loadMore);
        }
    }

    function parsePageRange(value) {
        var input = String(value || "").trim();
        if (/^\d+$/.test(input)) { var page = Number(input); return page > 0 ? [page] : []; }
        var match = input.match(/^(\d+)\s*-\s*(\d+)$/);
        if (!match) return [];
        var start = Math.max(1, Number(match[1])), end = Math.max(start, Number(match[2]));
        var pages = [];
        for (var p2 = start; p2 <= end; p2++) pages.push(p2);
        return pages.slice(0, 100);
    }

    // ===== 目录操作弹窗 =====
    function showRenameFolderModal(oldFolder, renderTree, renderList2) {
        var overlay = createElement("div", { className: "bgsh-dialog-overlay" });
        var dialog = createElement("div", { className: "bgsh-dialog" });
        dialog.style.width = "360px";
        var header = createElement("div", { className: "bgsh-dialog-header" });
        var title = createElement("div", { className: "bgsh-dialog-title", text: "✏️ 重命名目录" });
        var close = createElement("button", { className: "bgsh-dialog-close", text: "×" });
        addSafeEventListener(close, "click", function() { overlay.remove(); });
        header.append(title, close);
        var body = createElement("div", { className: "bgsh-dialog-body" });
        var input = createElement("input", { attrs: { type: "text", value: formatFolderName(oldFolder) } });
        Object.assign(input.style, { boxSizing: "border-box", width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "8px" });
        body.appendChild(input);
        var footer = createElement("div", { className: "bgsh-dialog-footer" });
        var cancel = createElement("button", { className: "bgsh-customBtn", text: "取消" });
        cancel.style.width = "auto";
        addSafeEventListener(cancel, "click", function() { overlay.remove(); });
        var confirm = createElement("button", { className: "bgsh-customBtn", text: "确定" });
        confirm.style.width = "auto";
        addSafeEventListener(confirm, "click", function() {
            var name = normalizeFolderName(input.value);
            if (name === "/") { showToast("目录名不能为空", "warning"); return; }
            if (folders.includes(name) && name !== oldFolder) { showToast("该目录已存在", "warning"); return; }
            var index = folders.indexOf(oldFolder);
            if (index >= 0) folders[index] = name;
            for (var k in favCache) {
                if (!favCache.hasOwnProperty(k)) continue;
                if (favCache[k].folder === oldFolder) favCache[k].folder = name;
            }
            if (currentFolder === oldFolder) currentFolder = name;
            if (lastFolder === oldFolder) { lastFolder = name; GM_setValue(favKeys.lastFolder, lastFolder); }
            saveFavoriteData();
            overlay.remove();
            showToast("重命名成功", "success");
            renderTree();
            renderList2();
        });
        footer.append(cancel, confirm);
        dialog.append(header, body, footer);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        input.focus();
        input.select();
    }

    function showDeleteFolderModal(folder2, renderTree, renderList2) {
        var overlay2 = createElement("div", { className: "bgsh-dialog-overlay" });
        var dialog2 = createElement("div", { className: "bgsh-dialog" });
        dialog2.style.width = "420px";
        var header2 = createElement("div", { className: "bgsh-dialog-header" });
        var title2 = createElement("div", { className: "bgsh-dialog-title", text: "🗑️ 删除目录：" + formatFolderName(folder2) });
        var close2 = createElement("button", { className: "bgsh-dialog-close", text: "×" });
        addSafeEventListener(close2, "click", function() { overlay2.remove(); });
        header2.append(title2, close2);
        var body2 = createElement("div", { className: "bgsh-dialog-body" });
        body2.appendChild(createElement("p", { text: "请选择该目录下收藏的处理方式：" }));
        var moveButton = createElement("button", { className: "bgsh-customBtn", text: "📦 删除目录，帖子退回未分类" });
        moveButton.style.background = "linear-gradient(135deg,#eeeeee,#dddddd)"; moveButton.style.color = "#555";
        addSafeEventListener(moveButton, "click", function() {
            folders = folders.filter(function(item) { return item !== folder2; });
            for (var k2 in favCache) {
                if (!favCache.hasOwnProperty(k2)) continue;
                if (favCache[k2].folder === folder2) favCache[k2].folder = "/";
            }
            if (currentFolder === folder2) currentFolder = "ALL";
            if (lastFolder === folder2) { lastFolder = "/"; GM_setValue(favKeys.lastFolder, "/"); }
            saveFavoriteData();
            overlay2.remove();
            showToast("目录已删除", "success");
            renderTree();
            renderList2();
        });
        var deleteAllButton = createElement("button", { className: "bgsh-customBtn", text: "❌ 删除目录并取消其中所有收藏" });
        deleteAllButton.style.background = "linear-gradient(135deg,#ff6b6b,#ee5a24)"; deleteAllButton.style.color = "#fff";
        addSafeEventListener(deleteAllButton, "click", async function() {
            var entries3 = getFavoriteEntries().filter(function(e) { return e[1].folder === folder2; });
            deleteAllButton.disabled = true;
            deleteAllButton.textContent = "正在取消收藏...";
            var successCount = 0;
            for (var e2 = 0; e2 < entries3.length; e2++) {
                if (await executeDeleteRequest(entries3[e2][0])) { delete favCache[entries3[e2][0]]; successCount++; }
                await new Promise(function(r) { setTimeout(r, 250); });
            }
            folders = folders.filter(function(item) { return item !== folder2; });
            currentFolder = "ALL"; lastFolder = "/";
            GM_setValue(favKeys.lastFolder, "/");
            saveFavoriteData();
            overlay2.remove();
            showToast("已取消 " + successCount + " 个收藏", "success");
            renderTree();
            renderList2();
        });
        body2.append(moveButton, deleteAllButton);
        dialog2.append(header2, body2);
        overlay2.appendChild(dialog2);
        document.body.appendChild(overlay2);
    }

    // ===== 收藏夹主页 =====
    function initFavoritePage() {
        if (!favKeys || !isFavoritePageURL(location.href)) return;
        var mainContent = qs(".mn") || qs("#ct") || qs("#wrap");
        if (!mainContent) return;

        // 必须在替换原收藏页面之前读取服务器已渲染的收藏条目。
        var visibleFavorites = extractFavoriteItems(document);
        var importedFavorites = 0;
        visibleFavorites.forEach(function(item) {
            var old = favCache[item.favid];
            if (!old) {
                favCache[item.favid] = {
                    tid: item.tid,
                    title: item.title,
                    url: item.url,
                    folder: "/",
                    processed: false,
                    author: item.author
                };
                importedFavorites++;
            } else {
                if (item.tid) old.tid = item.tid;
                if (item.title) old.title = item.title;
                if (item.url) old.url = item.url;
                if (item.author) old.author = item.author;
            }
        });
        if (visibleFavorites.length) saveFavoriteData();

        var oldApp = qs("#bgshFavoriteApp");
        if (oldApp) oldApp.remove();
        for (var key in favCache) {
            if (favCache.hasOwnProperty(key)) delete favCache[key].imagePreview;
        }
        var ui = createFavoritePageSkeleton();
        clearElement(mainContent);
        mainContent.appendChild(ui.root);
        mainContent.style.overflow = "visible";
        ui.sort.value = currentSort;
        ui.autoPreview.checked = isAutoPreview;
        ui.countInput.value = previewCount;
        ui.toolbox.style.display = isToolboxHidden ? "none" : "";
        var renderTree = function() {
            renderFavoriteTree(ui, function() { renderList(); }, renderTree);
        };
        var renderList = function() {
            ui.path.textContent = currentFolder === "ALL" ? "🏠 全部记录" : currentFolder === "/" ? "📦 未分类" : "📂 " + formatFolderName(currentFolder);
            needsPageReset = true;
            renderFavoriteList(ui);
        };
        addSafeEventListener(ui.toggleSidebar, "click", function() {
            isSidebarCollapsed = !isSidebarCollapsed;
            GM_setValue(favKeys.sidebar, isSidebarCollapsed);
            ui.sidebar.style.display = isSidebarCollapsed ? "none" : "flex";
        });
        ui.sidebar.style.display = isSidebarCollapsed ? "none" : "flex";
        addSafeEventListener(ui.addButton, "click", function() {
            var value = normalizeFolderName(ui.addInput.value);
            if (value === "/") { showToast("请输入目录名", "warning"); return; }
            if (folders.includes(value)) { showToast("该目录已存在", "warning"); return; }
            folders.push(value);
            ui.addInput.value = "";
            saveFavoriteData();
            renderTree();
            renderList();
            showToast("目录创建成功", "success");
        });
        addSafeEventListener(ui.addInput, "keydown", function(event) { if (event.key === "Enter") ui.addButton.click(); });
        addSafeEventListener(ui.autoPreview, "change", function() {
            isAutoPreview = ui.autoPreview.checked;
            GM_setValue(favKeys.autoPreview, isAutoPreview);
            GM_setValue("displayThreadImages", isAutoPreview);
            renderList();
        });
        addSafeEventListener(ui.countInput, "change", function() {
            previewCount = clampNumber(ui.countInput.value, 1, 20, 4);
            ui.countInput.value = previewCount;
            GM_setValue(favKeys.previewCount, previewCount);
            if (isAutoPreview) renderList();
        });
        addSafeEventListener(ui.poolInput, "change", function() {
            poolSize = clampNumber(ui.poolInput.value, 1, 20, 5);
            ui.poolInput.value = poolSize;
            GM_setValue(favKeys.poolSize, poolSize);
        });
        addSafeEventListener(ui.sort, "change", function() {
            currentSort = ui.sort.value;
            GM_setValue(favKeys.sort, currentSort);
            needsPageReset = true;
            renderList();
        });
        addSafeEventListener(ui.search, "input", debounce(function() { needsPageReset = true; renderList(); }, 180));
        addSafeEventListener(ui.mode, "change", renderList);
        addSafeEventListener(ui.exportButton, "click", async function() {
            // 获取所有勾选的收藏行（支持多选批量导出）
            var checkedItems = Array.from(ui.list.querySelectorAll(".bgsh-favorite-item input[type='checkbox']:checked"))
                .map(function(cb) { return cb.closest(".bgsh-favorite-item"); })
                .filter(Boolean);
            // 没有勾选时，回退到鼠标悬停激活的单条
            if (!checkedItems.length) {
                var activeItem = ui.list.querySelector(".bgsh-favorite-item.bgsh-favorite-export-active");
                if (activeItem) checkedItems.push(activeItem);
            }
            if (!checkedItems.length) {
                showToast("请先勾选要导出的收藏条目（可多选），或将鼠标移到目标条目上", "warning");
                return;
            }
            var originalText = ui.exportButton.textContent;
            ui.exportButton.disabled = true;

            var allEntries = [];
            var totalLinks = 0;
            var successCount = 0;

            // 逐个 fetch 每个选中帖子，提取 ed2k 链接
            for (var i = 0; i < checkedItems.length; i++) {
                var item = checkedItems[i];
                var favid = String(item.dataset.favid || "");
                var data = favid ? favCache[favid] : null;
                if (!data) continue;

                ui.exportButton.textContent = "⏳ 提取中 " + (i + 1) + "/" + checkedItems.length;

                try {
                    var tid = getFavoriteTid(data);
                    var threadUrl = tid
                        ? baseURL + "/forum.php?mod=viewthread&tid=" + encodeURIComponent(tid)
                        : normalizeURL(data.url);
                    if (!threadUrl) continue;

                    var htmlText = await fetchText(threadUrl, { cache: "no-store" }, 15000);
                    var links = extractStandardEd2kLinks(htmlText);

                    if (links.length) {
                        allEntries.push({ title: getFavoriteTitle(data), links: links });
                        totalLinks += links.length;
                        successCount++;
                    }
                } catch (e) {
                    debugLog("批量提取ED2K失败", favid, e);
                }
                // 请求间隔，避免触发频率限制
                if (i < checkedItems.length - 1) {
                    await new Promise(function(r) { setTimeout(r, 600); });
                }
            }

            ui.exportButton.disabled = false;
            ui.exportButton.textContent = originalText;

            if (!allEntries.length) {
                showToast("没有找到任何有效的 ED2K 链接，请确认帖子已解锁", "warning", 4500);
                return;
            }

            // 所有标题+链接合并到同一个 TXT，一次性下载
            var filename = downloadFavoriteEd2kBatchText(allEntries);
            showToast("💾 已保存 " + filename + "（" + successCount + " 个帖子，" + totalLinks + " 条链接）", "success", 4000);
        });
        addSafeEventListener(ui.updateButton, "click", async function() {
            var entries = getFilteredFavoriteEntries(ui);
            if (!entries.length) { showToast("当前筛选下没有可检查的收藏", "warning"); return; }
            ui.updateButton.disabled = true;
            try {
                var result = await checkFavoriteReplyUpdates(entries, function(current, total, updated) {
                    ui.updateButton.textContent = "⏳ " + current + "/" + total + " · 更新 " + updated;
                });
                renderList();
                var message = result.updated > 0
                    ? "🔴 发现 " + result.updated + " 个收藏有新回复"
                    : "✅ 追更检查完成，暂无新回复";
                if (result.failed > 0) message += "，" + result.failed + " 个检查失败";
                showToast(message, result.updated > 0 ? "warning" : "success", 5000);
            } catch (error) {
                errorLog("检查收藏追更失败", error);
                showToast("收藏追更检查失败", "error");
            } finally {
                ui.updateButton.disabled = false;
                ui.updateButton.textContent = "🔔 检查收藏追更";
            }
        });
        var runAutoFavoriteUpdateCheck = async function() {
            if (ui.updateButton.disabled || !ui.root.isConnected) return;
            var now = Date.now();
            var tracked = getFavoriteEntries().filter(function(entry) {
                var data = entry[1];
                return data.replyBaseline !== undefined && data.replyBaseline !== null &&
                    Number.isFinite(Number(data.replyBaseline)) &&
                    now - Number(data.replyCheckedAt || 0) >= 15 * 60 * 1000;
            }).sort(function(a, b) {
                return Number(a[1].replyCheckedAt || 0) - Number(b[1].replyCheckedAt || 0);
            }).slice(0, 30);
            if (!tracked.length) return;
            ui.updateButton.disabled = true;
            ui.updateButton.textContent = "⏳ 自动检查 0/" + tracked.length;
            try {
                var result = await checkFavoriteReplyUpdates(tracked, function(current, total) {
                    ui.updateButton.textContent = "⏳ 自动检查 " + current + "/" + total;
                });
                renderList();
                if (result.updated > 0) showToast("🔴 收藏追更：" + result.updated + " 个主题有新回复", "warning", 6000);
            } finally {
                ui.updateButton.disabled = false;
                ui.updateButton.textContent = "🔔 检查收藏追更";
            }
        };
        setTimeout(runAutoFavoriteUpdateCheck, 3500);
        var favoriteUpdateTimer = setInterval(runAutoFavoriteUpdateCheck, 15 * 60 * 1000);
        BGSH.listeners.add(function() { clearInterval(favoriteUpdateTimer); });
        addSafeEventListener(ui.syncPageButton, "click", async function() {
            var pages = parsePageRange(ui.syncInput.value);
            if (!pages.length) { showToast("请输入有效页码，如 1 或 1-3", "warning"); return; }
            ui.syncPageButton.disabled = true;
            try {
                var result = await syncFavoritePages(pages, function(current, total) { ui.syncPageButton.textContent = "⏳ " + current + "/" + total + " 页"; });
                showToast("同步完成，新增 " + result.added + " 条，更新 " + result.updated + " 条", "success");
                renderTree();
                renderList();
            } catch (error) { errorLog("同步收藏失败:", error); showToast("同步失败", "error"); }
            finally { ui.syncPageButton.disabled = false; ui.syncPageButton.textContent = "📄 同步指定页"; }
        });
        addSafeEventListener(ui.syncAllButton, "click", async function() {
            ui.syncAllButton.disabled = true;
            try {
                var result = await syncAllFavorites(function(current, total) { ui.syncAllButton.textContent = "⏳ 同步 " + current + "/" + total + " 页"; });
                showToast("同步完成，新增 " + result.added + " 条，更新 " + result.updated + " 条", "success");
                renderTree();
                renderList();
            } catch (error) { errorLog("同步全部收藏失败:", error); showToast("同步失败", "error"); }
            finally { ui.syncAllButton.disabled = false; ui.syncAllButton.textContent = "🔄 同步全部收藏夹"; }
        });
        addSafeEventListener(ui.authorButton, "click", async function() {
            ui.authorButton.disabled = true;
            try {
                var count = await fillMissingAuthors(function(current, total) { ui.authorButton.textContent = "⏳ " + current + "/" + total; });
                showToast("作者补全完成，更新 " + count + " 条", "success");
                renderList();
            } catch (error) { errorLog("补齐作者失败:", error); showToast("补齐作者失败", "error"); }
            finally { ui.authorButton.disabled = false; ui.authorButton.textContent = "🖊️ 补齐作者"; }
        });
        addSafeEventListener(ui.categorizeButton, "click", async function() {
            ui.categorizeButton.disabled = true;
            try {
                var result = await autoCategorizeByAuthor(function(current, total, status) { ui.categorizeButton.textContent = "⏳ " + (status || current + "/" + total); });
                var msg = "自动分类完成，移动 " + result.moved + " 条帖子";
                if (result.cleaned > 0) msg += "，清理 " + result.cleaned + " 个空白文件夹";
                showToast(msg, "success");
                renderTree();
                renderList();
            } catch (error) { errorLog("自动分类失败:", error); showToast("自动分类失败", "error"); }
            finally { ui.categorizeButton.disabled = false; ui.categorizeButton.textContent = "📂 自动分类"; }
        });
        addSafeEventListener(ui.resetButton, "click", function() {
            if (!window.confirm("确定清空本地收藏数据吗？此操作不会取消服务器收藏。")) return;
            favCache = {}; folders = ["/"]; currentFolder = "ALL"; lastFolder = "/";
            GM_setValue(favKeys.lastFolder, "/");
            saveFavoriteData();
            renderTree(); renderList();
            showToast("本地数据已清空，可重新同步", "warning");
        });
        if (typeof GM_addValueChangeListener === "function" && !BGSH.initialized.has("favoritePageListener")) {
            BGSH.initialized.add("favoritePageListener");
            var favListener = GM_addValueChangeListener(favKeys.favs, function(key, oldValue, newValue, remote) {
                if (!remote) return;
                favCache = newValue && typeof newValue === "object" ? newValue : {};
                renderTree(); renderList();
            });
            var folderListener = GM_addValueChangeListener(favKeys.folders, function(key, oldValue, newValue, remote) {
                if (!remote) return;
                folders = Array.isArray(newValue) ? newValue : ["/"];
                renderTree(); renderList();
            });
            var previewSettingListener = GM_addValueChangeListener("displayThreadImages", function(key, oldValue, newValue, remote) {
                if (!remote) return;
                isAutoPreview = newValue === true;
                ui.autoPreview.checked = isAutoPreview;
                GM_setValue(favKeys.autoPreview, isAutoPreview);
                renderList();
            });
            BGSH.listeners.add(function() {
                if (typeof GM_removeValueChangeListener === "function") {
                    GM_removeValueChangeListener(favListener);
                    GM_removeValueChangeListener(folderListener);
                    GM_removeValueChangeListener(previewSettingListener);
                }
            });
        }
        renderTree();
        renderList();
        if (importedFavorites > 0) {
            showToast("已识别并导入 " + importedFavorites + " 条网站收藏", "success");
        }
    }

    function initFavorites() {
        if (!initFavoriteStorage()) return;
        if (isPageType("post")) initThreadFavorite();
        initSearchFavorite();
        if (isPageType("favorite")) initFavoritePage();
    }
    // #endregion

    // #region 帖子评分 (保持原样)
    async function getRateInfo(pid, tid, timestamp) {
        const infoDefaults = { state: false, max: 0, left: 0, formHash: "", referer: "", handleKey: "", error: "" };

        try {
            const url = `/forum.php?mod=misc&action=rate&tid=${tid}&pid=${pid}&infloat=yes&handlekey=rate&t=${timestamp}&inajax=1&ajaxtarget=fwin_content_rate`;
            const response = await fetch(url);
            if (!response.ok) throw new Error("Failed to fetch rate info");

            const text = await response.text();
            const xml = new DOMParser().parseFromString(text, "text/xml");
            const htmlContent = xml.querySelector("root").textContent;
            const doc = new DOMParser().parseFromString(htmlContent, "text/html");

            if (htmlContent.includes("alert_error")) {
                const alertErrorElement = doc.querySelector(".alert_error");
                const scriptElements = alertErrorElement.querySelectorAll("script");
                scriptElements.forEach((script) => script.remove());
                const errorMessage = alertErrorElement.textContent.trim();
                return { ...infoDefaults, error: errorMessage };
            }

            const maxElement = doc.querySelector("#scoreoption8 li");
            if (!maxElement) {
                return { ...infoDefaults, error: "评分不足啦!" };
            }

            const max = parseInt(maxElement.textContent.replace("+", ""), 10);
            const left = parseInt(doc.querySelector(".dt.mbm td:last-child").textContent, 10);
            const formHash = doc.querySelector('input[name="formhash"]').value;
            const referer = doc.querySelector('input[name="referer"]').value;
            const handleKey = doc.querySelector('input[name="handlekey"]').value;

            return { state: true, max: Math.min(max, left), left, formHash, referer, handleKey, error: "" };
        } catch (error) {
            showToast("❌ " + error.message, "error");
            return infoDefaults;
        }
    }

    async function gradeManual(tid, pid) {
        showWindow("rate", "forum.php?mod=misc&action=rate&tid=" + tid + "&pid=" + pid, "get", -1);
        return false;
    }

    async function grade(pid) {
        showWatermarkMessage();
        const tid = extractTid(window.location.href);
        const timestamp = new Date().getTime();
        const rateInfo = await getRateInfo(pid, tid, timestamp);

        if (!rateInfo.state) {
            showToast("❌ " + rateInfo.error, "error");
            return;
        }

        var settings = getSettings();
        var maxGradeThread = settings.maxGradeThread;
        rateInfo.max = parseInt(rateInfo.max) < parseInt(maxGradeThread) ? rateInfo.max : maxGradeThread;

        const rateUrl = "/forum.php?mod=misc&action=rate&ratesubmit=yes&infloat=yes&inajax=1";
        const data = new URLSearchParams();
        data.append("formhash", rateInfo.formHash);
        data.append("tid", tid);
        data.append("pid", pid);
        data.append("referer", rateInfo.referer);
        data.append("handlekey", rateInfo.handleKey);
        data.append("score8", "1");
        data.append("reason", settings.logoText);
        data.append("sendreasonpm", "on");

        const request = new Request(rateUrl, {
            method: "post",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: data,
        });

        try {
            const responseText = await fetch(request).then((r) => r.text());
            if (responseText.includes("感谢您的参与，现在将转入评分前页面")) {
                showToast("✅ +1 评分成功，并通知了楼主!", "success");
            } else {
                showToast("❌ 评分失败", "error");
                console.error(responseText);
            }
        } catch (error) {
            showToast("❌ 评分请求失败", "error");
            console.error(error);
        }
    }
    // #endregion

    // #region 一键二连 (保持原样)
    function gradeAndStar() {
        let firstPobClElement = document.querySelector(".po.hin");
        let pid = getTableIdFromElement(firstPobClElement);
        grade(pid);
        star();
    }
    // #endregion

    // #region 获取购买记录
    const purchaseInfoMemoryCache = new Map();
    const purchaseInfoPendingRequests = new Map();
    const PURCHASE_INFO_CACHE_TTL = 5 * 60 * 1000;
    const PURCHASED_THREAD_RECORD_PREFIX = "bgshPurchasedThreadIds:";

    function getPurchasedThreadRecordKey() {
        var uid = getUid();
        return uid ? PURCHASED_THREAD_RECORD_PREFIX + uid : "";
    }

    function parsePurchasedThreadRecord(value) {
        if (typeof value === "string") {
            try { value = JSON.parse(value); }
            catch (error) { value = {}; }
        }
        return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    }

    function getPurchasedThreadRecord() {
        var key = getPurchasedThreadRecordKey();
        return key ? parsePurchasedThreadRecord(GM_getValue(key, {})) : {};
    }

    function hasPurchasedThreadRecord(tid) {
        return Boolean(getPurchasedThreadRecord()[String(tid || "")]);
    }

    function rememberPurchasedThread(tid, source) {
        tid = String(tid || "").trim();
        var key = getPurchasedThreadRecordKey();
        if (!key || !/^\d+$/.test(tid)) return false;
        var record = getPurchasedThreadRecord();
        if (record[tid]) return true;
        record[tid] = { timestamp: Date.now(), source: source || "detected" };
        var trimmed = Object.entries(record).sort(function(left, right) {
            return Number(right[1] && right[1].timestamp || 0) -
                Number(left[1] && left[1].timestamp || 0);
        }).slice(0, 3000);
        GM_setValue(key, Object.fromEntries(trimmed));
        return true;
    }

    function purchaseRowsContainCurrentUser(rows) {
        var currentUid = String(getUid() || "");
        if (!currentUid) return false;
        return Array.from(rows || []).some(function(row) {
            return Array.from(row.querySelectorAll('a[href*="uid="], a[href*="space-uid-"]'))
                .some(function(link) {
                    var href = link.getAttribute("href") || link.href || "";
                    var match = href.match(/[?&]uid=(\d+)|space-uid-(\d+)/i);
                    return Boolean(match && String(match[1] || match[2]) === currentUid);
                });
        });
    }

    async function getViewpayments(tid, silent) {
        const infoDefaults = {
            state: false,
            dataRowCount: 0,
            currentUserPurchased: hasPurchasedThreadRecord(tid),
            error: ""
        };

        try {
            const url = `/forum.php?mod=misc&action=viewpayments&tid=${tid}&infloat=yes&handlekey=pay&inajax=1&ajaxtarget=fwin_content_pay`;
            const response = await fetch(url);
            if (!response.ok) throw new Error("Failed to fetch Viewpayments info");

            const text = await response.text();
            const xml = new DOMParser().parseFromString(text, "text/xml");
            const htmlContent = xml.querySelector("root").textContent;
            const doc = new DOMParser().parseFromString(htmlContent, "text/html");

            if (htmlContent.includes("alert_error")) {
                const alertErrorElement = doc.querySelector(".alert_error");
                const scriptElements = alertErrorElement.querySelectorAll("script");
                scriptElements.forEach((script) => script.remove());
                const errorMessage = alertErrorElement.textContent.trim();
                return { ...infoDefaults, error: errorMessage };
            }

            if (htmlContent.includes("目前没有用户购买此主题")) {
                return { ...infoDefaults, state: true, dataRowCount: 0, error: "" };
            }

            var table = doc.querySelector("table.list");
            if (!table) {
                return { ...infoDefaults, state: true, dataRowCount: 0, error: "" };
            }
            var rows = table.querySelectorAll("tr");
            var dataRowCount = rows.length - 1;
            var currentUserPurchased = infoDefaults.currentUserPurchased ||
                purchaseRowsContainCurrentUser(Array.from(rows).slice(1));
            if (currentUserPurchased) rememberPurchasedThread(tid, "viewpayments");
            return {
                state: true,
                dataRowCount: dataRowCount,
                currentUserPurchased: currentUserPurchased,
                error: ""
            };
        } catch (error) {
            if (!silent) showToast("❌ " + error.message, "error");
            return infoDefaults;
        }
    }

    async function getCachedViewpayments(tid, forceRefresh, silent) {
        tid = String(tid || "").trim();
        if (!/^\d+$/.test(tid)) return { state: false, dataRowCount: 0, error: "主题编号无效" };

        var cached = purchaseInfoMemoryCache.get(tid);
        if (!forceRefresh && cached && Date.now() - cached.timestamp < PURCHASE_INFO_CACHE_TTL) {
            return cached.value;
        }
        if (purchaseInfoPendingRequests.has(tid)) return purchaseInfoPendingRequests.get(tid);

        var request = getViewpayments(tid, silent).then(function(result) {
            if (result.state) {
                purchaseInfoMemoryCache.set(tid, { value: result, timestamp: Date.now() });
            }
            return result;
        }).finally(function() {
            purchaseInfoPendingRequests.delete(tid);
        });
        purchaseInfoPendingRequests.set(tid, request);
        return request;
    }

    function styleSalesBadge(badge, besidePurchaseButton) {
        badge.classList.add("bgsh-sales-badge");
        badge.style.cssText = [
            "display:inline-flex", "align-items:center", "white-space:nowrap",
            "margin-left:6px", "padding:2px 7px", "border-radius:999px",
            "font-size:11px", "line-height:1.5", "font-weight:700",
            "color:#9a4b00", "background:linear-gradient(135deg,#fff1cf,#ffd88a)",
            "border:1px solid rgba(247,151,30,.45)", "vertical-align:middle",
            besidePurchaseButton ? "box-shadow:0 2px 8px rgba(247,151,30,.18)" : ""
        ].filter(Boolean).join(";");
    }

    function stylePurchasedBadge(badge) {
        badge.classList.add("bgsh-purchased-badge");
        badge.style.cssText = [
            "display:inline-flex", "align-items:center", "white-space:nowrap",
            "margin-left:5px", "padding:2px 8px", "border-radius:999px",
            "font-size:11px", "line-height:1.5", "font-weight:800",
            "color:#fff", "background:linear-gradient(135deg,#20bf6b,#079447)",
            "border:1px solid rgba(0,110,55,.55)", "vertical-align:middle",
            "box-shadow:0 2px 8px rgba(7,148,71,.32)"
        ].join(";");
    }

    function renderPurchasedBadgeAfter(salesBadge, tid, purchased) {
        if (!salesBadge || !salesBadge.parentNode) return null;
        var place = salesBadge.dataset.bgshSalesPlace || "unknown";
        var selector = '.bgsh-purchased-badge[data-bgsh-purchased-tid="' + tid + '"]' +
            '[data-bgsh-purchased-place="' + place + '"]';
        var badge = salesBadge.parentNode.querySelector(selector);
        if (!purchased) {
            if (badge) badge.remove();
            return null;
        }
        if (!badge) {
            badge = document.createElement("span");
            badge.dataset.bgshPurchasedTid = String(tid);
            badge.dataset.bgshPurchasedPlace = place;
            badge.textContent = "✓ 已购买";
            badge.title = "当前用户已购买该主题";
            stylePurchasedBadge(badge);
        }
        if (salesBadge.nextElementSibling !== badge) {
            salesBadge.insertAdjacentElement("afterend", badge);
        }
        return badge;
    }

    function refreshPurchasedBadgesForTid(tid, apiConfirmed) {
        tid = String(tid || "").trim();
        if (!/^\d+$/.test(tid)) return false;
        var isCurrentThread = String(extractTid(window.location.href) || "") === tid;
        var pageConfirmed = isCurrentThread && isCurrentThreadConfirmedPurchased();
        if (apiConfirmed || pageConfirmed) {
            rememberPurchasedThread(tid, apiConfirmed ? "viewpayments" : "unlocked-ed2k");
        }
        var purchased = Boolean(apiConfirmed || pageConfirmed || hasPurchasedThreadRecord(tid));
        document.querySelectorAll(
            '.bgsh-sales-badge[data-bgsh-sales-tid="' + tid + '"]'
        ).forEach(function(salesBadge) {
            renderPurchasedBadgeAfter(salesBadge, tid, purchased);
        });
        return purchased;
    }

    function setupPurchasedThreadRecordListener() {
        if (window.__bgshPurchasedThreadRecordListener ||
            typeof GM_addValueChangeListener !== "function") return;
        var key = getPurchasedThreadRecordKey();
        if (!key) return;
        window.__bgshPurchasedThreadRecordListener = GM_addValueChangeListener(
            key,
            function(name, oldValue, newValue) {
                var record = parsePurchasedThreadRecord(newValue);
                document.querySelectorAll(".bgsh-sales-badge[data-bgsh-sales-tid]")
                    .forEach(function(salesBadge) {
                        var tid = salesBadge.dataset.bgshSalesTid;
                        renderPurchasedBadgeAfter(salesBadge, tid, Boolean(record[tid]));
                    });
            }
        );
    }

    function renderThreadListSalesBadge(link, tid, count, currentUserPurchased) {
        if (!link || !link.parentNode) return;
        var selector = '.bgsh-sales-badge[data-bgsh-sales-tid="' + tid + '"][data-bgsh-sales-place="list"]';
        var badge = link.parentNode.querySelector(selector);
        if (!badge) {
            badge = document.createElement("span");
            badge.dataset.bgshSalesTid = tid;
            badge.dataset.bgshSalesPlace = "list";
            styleSalesBadge(badge, false);
            link.insertAdjacentElement("afterend", badge);
        }
        badge.textContent = "已售 " + count + " 份";
        badge.title = "该主题已有 " + count + " 人购买";
        renderPurchasedBadgeAfter(
            badge,
            tid,
            Boolean(currentUserPurchased || hasPurchasedThreadRecord(tid))
        );
        return badge;
    }

    function findThreadPurchaseControls() {
        var selectors = [
            'a[href*="action=pay"]', 'a[onclick*="action=pay"]',
            'button[onclick*="action=pay"]', 'input[onclick*="action=pay"]'
        ].join(',');
        var candidates = Array.from(document.querySelectorAll(selectors));
        document.querySelectorAll("a, button, input[type='button'], input[type='submit']").forEach(function(element) {
            var text = (element.textContent || element.value || "").trim();
            if (/购买主题|购买此主题|立即购买/.test(text)) candidates.push(element);
        });
        return Array.from(new Set(candidates)).filter(function(element) {
            if (element.closest(".bgsh-toolbar, #settingsUIContainer")) return false;
            var href = element.getAttribute("href") || "";
            return !/action=viewpayments/i.test(href);
        });
    }

    function isVisiblePurchaseStateElement(element) {
        if (!element || !element.isConnected) return false;
        if (element.closest("[hidden], [aria-hidden='true'], .attach_nopermission")) return false;
        var current = element;
        while (current && current.nodeType === 1) {
            var style = getComputedStyle(current);
            if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") return false;
            current = current.parentElement;
        }
        return true;
    }

    function containsStandardEd2kLink(value) {
        return /ed2k:\/\/\|file\|[^|\r\n<>"']+\|\d+\|[a-f0-9]{32}\|(?:[^<>"'\r\n]*?\|)?\//i.test(String(value || ""));
    }

    function hasUnlockedVisibleEd2kInPost() {
        var firstPost = getPostContainers(document)[0];
        var scope = firstPost || document.querySelector("#postlist");
        if (!scope) return false;
        var contentRoots = Array.from(scope.querySelectorAll("[id^='postmessage_'], .pcb .t_f, .plc .t_f, .t_f"));
        if (!contentRoots.length && scope.matches && scope.matches("[id^='postmessage_'], .t_f")) contentRoots.push(scope);
        return contentRoots.some(function(contentRoot) {
            if (!isVisiblePurchaseStateElement(contentRoot) || contentRoot.closest(".locked, .attach_nopermission")) return false;
            var valueElements = Array.from(contentRoot.querySelectorAll("a[href], .blockcode, pre, code, textarea, input[value]"));
            if (valueElements.some(function(element) {
                if (!isVisiblePurchaseStateElement(element) || element.closest(".locked, .attach_nopermission")) return false;
                return containsStandardEd2kLink(
                    element.getAttribute("href") || element.value || element.textContent || ""
                );
            })) return true;

            var walker = document.createTreeWalker(contentRoot, NodeFilter.SHOW_TEXT);
            var textNode;
            while ((textNode = walker.nextNode())) {
                var parent = textNode.parentElement;
                if (parent && isVisiblePurchaseStateElement(parent) &&
                    !parent.closest(".locked, .attach_nopermission") &&
                    containsStandardEd2kLink(textNode.nodeValue)) return true;
            }
            return false;
        });
    }

    function isCurrentThreadConfirmedPurchased() {
        var hasVisiblePurchaseButton = findThreadPurchaseControls().some(isVisiblePurchaseStateElement);
        return !hasVisiblePurchaseButton && hasUnlockedVisibleEd2kInPost();
    }

    function setupRememberedSalePriceObserver(tid) {
        window.__bgshRememberedSalePriceTid = String(tid || "");
        if (window.__bgshRememberedSalePriceObserver || !document.body) return;
        var timer = null;
        window.__bgshRememberedSalePriceObserver = new MutationObserver(function() {
            clearTimeout(timer);
            timer = setTimeout(function() {
                var currentTid = window.__bgshRememberedSalePriceTid;
                renderRememberedSalePrice(currentTid);
                refreshPurchasedBadgesForTid(currentTid, false);
            }, 100);
        });
        window.__bgshRememberedSalePriceObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["class", "style", "hidden", "aria-hidden"]
        });
    }

    function renderPurchaseButtonSalesBadge(tid, count) {
        var controls = findThreadPurchaseControls();
        controls.forEach(function(control) {
            var anchor = control.closest('a[href*="action=pay"], a[onclick*="action=pay"]');
            var placement = anchor || control;
            var next = placement.nextElementSibling;
            var badge = next && next.matches && next.matches(
                '.bgsh-sales-badge[data-bgsh-sales-place="purchase-button"]'
            ) ? next : null;
            if (!badge) {
                badge = document.createElement("span");
                badge.dataset.bgshSalesPlace = "purchase-button";
                badge.dataset.bgshSalesTid = tid;
                styleSalesBadge(badge, true);
                placement.insertAdjacentElement("afterend", badge);
            }
            badge.textContent = "已售 " + count + " 份";
            badge.title = "该主题已有 " + count + " 人购买";
            refreshPurchasedBadgesForTid(tid, false);
        });
        return controls.length;
    }

    function setupPurchaseButtonSalesBadge(tid, count) {
        window.__bgshPurchaseSalesBadgeState = { tid: String(tid), count: count };
        renderPurchaseButtonSalesBadge(tid, count);
        if (window.__bgshPurchaseSalesBadgeObserver) return;

        var renderTimer = null;
        window.__bgshPurchaseSalesBadgeObserver = new MutationObserver(function(mutations) {
            var mayContainPurchaseControl = mutations.some(function(mutation) {
                return mutation.addedNodes && mutation.addedNodes.length > 0;
            });
            if (!mayContainPurchaseControl || renderTimer) return;
            renderTimer = setTimeout(function() {
                renderTimer = null;
                var state = window.__bgshPurchaseSalesBadgeState;
                if (state) renderPurchaseButtonSalesBadge(state.tid, state.count);
            }, 80);
        });
        window.__bgshPurchaseSalesBadgeObserver.observe(document.body, { childList: true, subtree: true });
    }

    function getThreadSaleMarkerContainer(link) {
        if (!link || !link.closest) return null;
        return link.closest(
            'tbody[id^="normalthread_"], tbody[id^="stickthread_"], ' +
            'tr, li, dl, .thread-item, .thread, .pbw, .content'
        );
    }

    const SALE_THREAD_META_KEY = "bgshSaleThreadMeta";
    let saleThreadMetaCache = null;

    function getSaleThreadMetaMap() {
        if (saleThreadMetaCache) return saleThreadMetaCache;
        var stored = GM_getValue(SALE_THREAD_META_KEY, {});
        saleThreadMetaCache = stored && typeof stored === "object" && !Array.isArray(stored)
            ? stored : {};
        return saleThreadMetaCache;
    }

    function extractSalePriceLabel(root) {
        if (!root) return "";
        var text = String(root.textContent || "").replace(/\s+/g, " ");
        var match = text.match(
            /售\s*价\s*[:：]?\s*(\d+(?:\.\d+)?)\s*(金币|金钱|积分|威望|贡献|铜币|论坛币|色币|点券|点|分)?/i
        );
        if (!match) return "";
        return "售价 " + match[1] + (match[2] ? " " + match[2] : "");
    }

    function rememberSaleThreadInfo(tid, root) {
        tid = String(tid || "").trim();
        if (!/^\d+$/.test(tid)) return null;
        var map = getSaleThreadMetaMap();
        var previous = map[tid] || {};
        var priceLabel = extractSalePriceLabel(root) || previous.priceLabel || "";
        var now = Date.now();
        var shouldSave = !previous.knownSale ||
            (priceLabel && priceLabel !== previous.priceLabel) ||
            !previous.updatedAt || now - previous.updatedAt > 24 * 60 * 60 * 1000;
        map[tid] = { knownSale: true, priceLabel: priceLabel, updatedAt: now };
        if (shouldSave) {
            var entries = Object.entries(map).sort(function(left, right) {
                return (right[1].updatedAt || 0) - (left[1].updatedAt || 0);
            }).slice(0, 1000);
            saleThreadMetaCache = Object.fromEntries(entries);
            GM_setValue(SALE_THREAD_META_KEY, saleThreadMetaCache);
        }
        return map[tid];
    }

    function getRememberedSaleThreadInfo(tid) {
        return getSaleThreadMetaMap()[String(tid || "")] || null;
    }

    function renderRememberedSalePrice(tid) {
        var badge = document.getElementById("bgshRememberedSalePrice");
        if (!isCurrentThreadConfirmedPurchased()) {
            if (badge) badge.remove();
            return false;
        }
        var info = getRememberedSaleThreadInfo(tid);
        if (!info || !info.priceLabel) {
            if (badge) badge.remove();
            return false;
        }
        var subject = document.getElementById("thread_subject");
        if (!subject || !subject.parentNode) return false;
        if (!badge) {
            badge = document.createElement("span");
            badge.id = "bgshRememberedSalePrice";
            badge.dataset.bgshSalesTid = String(tid);
            styleSalesBadge(badge, false);
            subject.insertAdjacentElement("afterend", badge);
        }
        var badgeText = info.priceLabel + "（已购买）";
        if (badge.textContent !== badgeText) badge.textContent = badgeText;
        badge.title = "购买按钮已消失，且正文已解锁显示 ED2K 链接";
        return true;
    }

    function hasSalePriceMarker(root) {
        if (!root) return false;
        var text = String(root.textContent || "").replace(/\s+/g, " ");
        if (/售\s*价/i.test(text)) return true;
        return Array.from(root.querySelectorAll ? root.querySelectorAll('[title], [alt], [data-title]') : [])
            .some(function(element) {
                var marker = [element.title, element.alt, element.dataset && element.dataset.title]
                    .filter(Boolean).join(" ");
                return /售\s*价/i.test(marker);
            });
    }

    function isPaidThreadLink(link) {
        return hasSalePriceMarker(getThreadSaleMarkerContainer(link));
    }

    function isCurrentPaidThreadPage() {
        var tid = extractTid(window.location.href);
        var controls = findThreadPurchaseControls();
        var firstPost = getPostContainers(document)[0];
        var root = firstPost || document.querySelector("#postlist, .pcb, .locked");
        var text = String(root && root.textContent || "").replace(/\s+/g, " ");
        var detected = controls.length > 0 || hasSalePriceMarker(root) ||
            /本主题需.*支付|购买主题|购买此主题/.test(text);
        if (detected) rememberSaleThreadInfo(tid, root || document);
        return detected || Boolean(getRememberedSaleThreadInfo(tid));
    }

    function getLoadedSaleThreadLinks() {
        var unique = new Map();
        document.querySelectorAll(
            "a.s.xst, a[href*='/thread-'], a[href*='mod=viewthread']"
        ).forEach(function(link) {
            var tid = extractTid(link.href || "");
            if (!tid || !isPaidThreadLink(link)) return;
            rememberSaleThreadInfo(tid, getThreadSaleMarkerContainer(link));
            var key = String(tid);
            var existing = unique.get(key);
            var isPreferredTitle = link.matches("a.s.xst") || Boolean(link.closest("th, h2, h3"));
            var existingIsPreferred = existing &&
                (existing.matches("a.s.xst") || Boolean(existing.closest("th, h2, h3")));
            if (!existing || (isPreferredTitle && !existingIsPreferred)) {
                unique.set(key, link);
            }
        });
        return Array.from(unique.entries());
    }

    async function syncLoadedSaleThreadBuyInfo(settings, options) {
        options = options || {};
        if (!settings.displayThreadBuyInfo && !options.forceRefresh) return { total: 0, updated: 0, failed: 0 };
        var entries = getLoadedSaleThreadLinks();
        var cursor = 0;
        var completed = 0;
        var updated = 0;
        var failed = 0;

        async function worker() {
            while (cursor < entries.length) {
                var entry = entries[cursor++];
                var tid = entry[0];
                var link = entry[1];
                var buyInfo = await getCachedViewpayments(tid, Boolean(options.forceRefresh), true);
                if (buyInfo.state) {
                    renderThreadListSalesBadge(
                        link,
                        tid,
                        buyInfo.dataRowCount,
                        buyInfo.currentUserPurchased
                    );
                    updated++;
                } else {
                    failed++;
                }
                completed++;
                if (typeof options.onProgress === "function") {
                    options.onProgress(completed, entries.length, updated, failed);
                }
                if (cursor < entries.length) await new Promise(function(resolve) { setTimeout(resolve, 100); });
            }
        }

        var workerCount = Math.min(3, entries.length);
        await Promise.all(Array.from({ length: workerCount }, worker));
        return { total: entries.length, updated: updated, failed: failed };
    }

    function createSyncSaleThreadsButton(settings) {
        var button = createButton("syncSaleThreadBuyInfo", "🔄 同步所有出售主题", async function() {
            if (button.disabled) return;
            button.disabled = true;
            var originalText = button.textContent;
            try {
                var result = await syncLoadedSaleThreadBuyInfo(settings, {
                    forceRefresh: true,
                    onProgress: function(done, total) {
                        button.textContent = "⏳ 同步 " + done + "/" + total;
                    }
                });
                if (!result.total) {
                    showToast("当前页面没有可同步的出售主题", "warning");
                } else if (result.failed) {
                    showToast("已同步 " + result.updated + " 个主题，" + result.failed + " 个失败", "warning", 3500);
                } else {
                    showToast("✅ 已同步当前已加载的全部 " + result.updated + " 个出售主题", "success", 3000);
                }
            } finally {
                button.disabled = false;
                button.textContent = originalText;
            }
        });
        button.title = "刷新当前页面已加载的全部出售主题购买人数";
        button.classList.add("bgsh-settings-only-action");
        return button;
    }

    function removeExternalSyncSaleThreadsButton() {
        var existing = document.getElementById("syncSaleThreadBuyInfo");
        if (existing && !existing.closest("#settingsUIContainer")) existing.remove();
        var oldRail = document.getElementById("bgshPersistentSideRail");
        if (oldRail) oldRail.remove();
    }

    function mountSyncSaleThreadsButtonInSettings(settings, settingsContainer) {
        var target = settingsContainer &&
            settingsContainer.querySelector("#bgshSyncSaleThreadsSettingsMount");
        if (!target) return null;
        removeExternalSyncSaleThreadsButton();
        var existing = document.getElementById("syncSaleThreadBuyInfo");
        if (existing) existing.remove();
        var button = createSyncSaleThreadsButton(settings);
        target.appendChild(button);
        return button;
    }
    // #endregion

    // #region 帖子置顶 (保持原样)
    async function getTopicadmin(fid, tid, pid) {
        const infoDefaults = { state: false, action: "", formhash: "", page: "", handlekey: "", error: "" };

        try {
            const formhash = getFormHash();
            const url = `/forum.php?mod=topicadmin&action=stickreply&fid=${fid}&tid=${tid}&handlekey=mods&infloat=yes&nopost=yes&inajax=1`;
            const data = new URLSearchParams();
            data.append("formhash", formhash);
            data.append("optgroup", "");
            data.append("operation", "");
            data.append("listextra", "");
            data.append("page", 1);
            data.append("topiclist[]", pid);

            const request = new Request(url, {
                method: "post",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: data,
            });

            const text = await fetch(request).then((r) => r.text());
            const xml = new DOMParser().parseFromString(text, "text/xml");
            const htmlContent = xml.querySelector("root").textContent;
            const doc = new DOMParser().parseFromString(htmlContent, "text/html");

            if (htmlContent.includes("alert_error")) {
                const alertErrorElement = doc.querySelector(".alert_error");
                const scriptElements = alertErrorElement.querySelectorAll("script");
                scriptElements.forEach((script) => script.remove());
                const errorMessage = alertErrorElement.textContent.trim();
                return { ...infoDefaults, error: errorMessage };
            }

            const element = doc.querySelector("#topicadminform");
            if (!element) {
                return { ...infoDefaults, error: "提取置顶信息失败拉!" };
            }

            const action = element.getAttribute("action").replace(/amp;/g, "") + "&inajax=1";
            const newformhash = element.querySelector('input[name="formhash"]').value;
            const page = element.querySelector('input[name="page"]').value;
            const handlekey = element.querySelector('input[name="handlekey"]').value;

            return { state: true, action, formhash: newformhash, page, handlekey, error: "" };
        } catch (error) {
            showToast("❌ " + error.message, "error");
            return infoDefaults;
        }
    }

    async function topicadmin(pid, stickreply) {
        showWatermarkMessage();
        const tid = extractTid(window.location.href);
        let fid = getFidFromElement();

        if (!fid) {
            showToast("❌ 获取板块ID失败", "error");
            return;
        }

        const topicadminInfo = await getTopicadmin(fid, tid, pid);
        if (!topicadminInfo.state) {
            showToast("❌ " + topicadminInfo.error, "error");
            return;
        }

        const settings = getSettings();
        const topicadminUrl = `/${topicadminInfo.action}`;
        const data = new URLSearchParams();
        data.append("formhash", topicadminInfo.formhash);
        data.append("fid", fid);
        data.append("tid", tid);
        data.append("topiclist[]", pid);
        data.append("page", topicadminInfo.page);
        data.append("handlekey", topicadminInfo.handlekey);
        data.append("stickreply", stickreply);
        data.append("reason", settings.logoText);
        data.append("sendreasonpm", "on");

        const request = new Request(topicadminUrl, {
            method: "post",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: data,
        });

        try {
            const responseText = await fetch(request).then((r) => r.text());
            if (responseText.includes("操作成功 ")) {
                showToast(stickreply == "1" ? "✅ 置顶成功!" : "✅ 取消置顶成功!", "success");
            } else {
                showToast("❌ 置顶失败", "error");
                console.error(responseText);
            }
        } catch (error) {
            showToast("❌ 置顶请求失败", "error");
            console.error(error);
        }
    }
    // #endregion

    // #region 帖子内容页功能 (保持原样)
    function createFastCopyButton() {
        return createButton("fastCopyButton", "📋 复制帖子", function () {
            var content = document.querySelector(".t_f");
            var secondContent = document.querySelectorAll(".t_f")[1];
            var resultHtml = "";
            if (content) {
                resultHtml += processContent(content);
            }
            if (secondContent && secondContent.querySelectorAll("img").length > 3) {
                resultHtml += processContent(secondContent);
            }
            if (resultHtml !== "") {
                copyToClipboard(resultHtml, () => showToast("✅ 内容已复制!", "success"));
            } else {
                showToast("❌ 复制失败: 没有找到相应内容", "error");
            }
        });
    }

    function processContent(content) {
        var html = content.innerHTML;
        var cleanedHtml = removeElementsByClass(html, ["pstatus", "tip_4"],
            ["font", "div", "ignore_js_op", "br", "ol", "li", "strong", "a", "i", "table", "tbody", "tr", "td", "blockquote"],
            ["em"]);
        cleanedHtml = removeNbspAndNewlines(cleanedHtml);
        cleanedHtml = removeElementsByIdPrefix(cleanedHtml, "attach_");
        return cleanedHtml;
    }

    function removeNbspAndNewlines(htmlString) {
        var stringWithoutNbsp = htmlString.replace(/&nbsp;/g, "");
        stringWithoutNbsp = stringWithoutNbsp.replace(/&amp;/g, "");
        stringWithoutNbsp = stringWithoutNbsp.replace(/\n+/g, "\n");
        stringWithoutNbsp = stringWithoutNbsp.replace(/\\t98t/g, "\n");
        return stringWithoutNbsp;
    }

    function removeElementsByClass(htmlString, classList, tagsToRemove, tagsToAllRemove) {
        var parser = new DOMParser();
        var doc = parser.parseFromString(htmlString, "text/html");

        classList.forEach(function (className) {
            var elements = doc.querySelectorAll("." + className);
            elements.forEach(function (element) {
                element.parentNode.removeChild(element);
            });
        });

        tagsToRemove.forEach(function (tagName) {
            var elements = doc.querySelectorAll(tagName);
            elements.forEach(function (element) {
                while (element.firstChild) {
                    element.parentNode.insertBefore(element.firstChild, element);
                }
                element.parentNode.removeChild(element);
            });
        });

        tagsToAllRemove.forEach(function (tagName) {
            var elements = doc.querySelectorAll(tagName);
            elements.forEach(function (element) {
                element.parentNode.removeChild(element);
            });
        });

        var imgElements = doc.querySelectorAll("img");
        imgElements.forEach(function (img) {
            var fileAttr = img.getAttribute("file");
            if (fileAttr) {
                var fileText = (fileAttr.includes("static/image") ? "" : fileAttr) + "\\t98t";
                var textNode = document.createTextNode(fileText);
                img.parentNode.replaceChild(textNode, img);
            } else {
                var srcAttr = img.getAttribute("src");
                if (srcAttr) {
                    var srcText = (srcAttr.includes("static/image") ? "" : srcAttr) + "\\t98t";
                    var textNode1 = document.createTextNode(srcText);
                    img.parentNode.replaceChild(textNode1, img);
                }
            }
        });

        return doc.body.innerHTML;
    }

    function removeElementsByIdPrefix(html, idPrefix) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const elements = doc.querySelectorAll(`[id^="${idPrefix}"]`);
        elements.forEach((element) => element.remove());
        return doc.body.innerHTML;
    }

    function createFastReplyButton() {
        return createButton("fastReplyButton", "📝 快速回复", function () {
            let fid = getFidFromElement();
            const tid = extractTid(window.location.href);
            showWindow("reply", `forum.php?mod=post&action=reply&fid=${fid}&tid=${tid}`);
        }, "bgsh-quickReplyToPostBtn");
    }

    function createFastPMButton(pid, touid) {
        return createButton("fastPMButton", "💬 快速私信", function () {
            let fid = getFidFromElement();
            const tid = extractTid(window.location.href);
            showWindow("sendpm",
                `home.php?mod=spacecp&ac=pm&op=showmsg&handlekey=showmsg_${touid}&touid=${touid}&pmid=0&daterange=2&pid=${pid}&tid=${tid}`);
        }, "bgsh-fastPMButtonBtn");
    }

    function createViewRatingsButton(pid) {
        return createButton("viewRatingsButton", "⭐ 查看评分", function () {
            let fid = getFidFromElement();
            const tid = extractTid(window.location.href);
            showWindow("viewratings", `forum.php?mod=misc&action=viewratings&tid=${tid}&pid=${pid}`);
        });
    }

    function createPayLogButton(pid) {
        return createButton("payLogButton", "💰 购买记录", function () {
            let fid = getFidFromElement();
            const tid = extractTid(window.location.href);
            showWindow("pay", `forum.php?mod=misc&action=viewpayments&tid=${tid}&pid=${pid}`);
        });
    }

    function createDownButton() {
        return createButton("downButton", "📥 下载附件", function () {
            if (document.getElementById("customModal")) return;

            const spans = document.querySelectorAll('span[id*="attach_"]');
            const lockedDivs = Array.from(document.querySelectorAll("div.locked"))
                .filter((div) => div.textContent.includes("购买"));
            const dls = Array.from(document.querySelectorAll("dl.tattl"))
                .filter((dl) => dl.querySelector("p.attnm"));

            const elements = [...spans, ...dls, ...lockedDivs];

            if (elements.length === 0) {
                showToast("ℹ️ 没有找到任何附件", "info");
                return;
            }

            const result = elements.map((el) => el.outerHTML).join("<br>");

            const modal = document.createElement("div");
            modal.id = "customModal";
            modal.style.cssText = `
                position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%);
                background: rgba(255,248,235,0.92); backdrop-filter: blur(20px);
                padding: 24px; border-radius: 16px;
                box-shadow: 0 32px 80px rgba(0,0,0,0.25);
                width: 80%; max-width: 600px; max-height: 80vh; overflow-y: auto;
                z-index: 100;
                border: 1px solid rgba(255,200,150,0.3);
            `;

            modal.innerHTML = `
                <div style="margin-bottom: 20px;">${result}</div>
                <button id="closeModal" style="padding: 8px 20px; background: linear-gradient(135deg, #ff6b6b, #ee5a24); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 500;">关闭</button>
            `;

            document.body.appendChild(modal);
            document.getElementById("closeModal").addEventListener("click", () => modal.remove());
        });
    }

    function createCopyCodeButton() {
        return createButton("copyCodeButton", "📋 复制代码", function () {
            let allBlockCodes = document.querySelectorAll(".blockcode");
            let allTexts = [];
            allBlockCodes.forEach((blockCode) => {
                let liElements = blockCode.querySelectorAll("li");
                liElements.forEach((li) => allTexts.push(li.textContent));
            });
            let combinedText = allTexts.join("\n");
            copyToClipboard(combinedText, () => showToast("✅ 代码已复制!", "success"));
        });
    }

    function createQuickGradeButton(tid, pid) {
        return createButton("quickGradeButton", "⭐ 一键评分", () => gradeManual(tid, pid), "bgsh-quickGradeToPostBtn");
    }

    function createQuickStarButton() {
        var button = createButton("quickStarButton", "☆ 收藏主题", async function() {
            var current = getCurrentThreadFavorite();
            if (!current) {
                star(renderThreadFavoriteState);
                return;
            }
            var favid = current[0];
            if (!/^\d+$/.test(String(favid))) {
                showToast("该收藏缺少服务器编号，请在收藏夹页面取消", "warning");
                return;
            }
            button.disabled = true;
            button.textContent = "⏳ 取消中";
            if (await executeDeleteRequest(favid)) {
                delete favCache[favid];
                saveFavoriteData();
                showToast("已取消收藏", "success");
            } else {
                showToast("取消收藏失败", "error");
            }
            button.disabled = false;
            renderThreadFavoriteState();
        });
        setTimeout(renderThreadFavoriteState, 0);
        return button;
    }

    function getFollowedAuthors() {
        var value = GM_getValue("followedAuthors", []);
        if (typeof value === "string") {
            try { value = JSON.parse(value); }
            catch (error) { value = value.split(/\r?\n/); }
        }
        if (!Array.isArray(value)) value = [];
        return Array.from(new Set(value.map(function(name) {
            return String(name || "").trim();
        }).filter(Boolean)));
    }

    const FOLLOW_AUTHOR_GROUPS_KEY = "bgshFollowAuthorGroups";
    const FOLLOW_AUTHOR_CUSTOM_GROUPS_KEY = "bgshFollowAuthorCustomGroups";
    const FOLLOW_AUTHOR_GROUP_DEFINITIONS = [
        { id: "premium", name: "优质资源作者", icon: "🏆" },
        { id: "regular", name: "常规关注作者", icon: "👤" }
    ];

    function getFollowAuthorCustomGroups() {
        var stored = GM_getValue(FOLLOW_AUTHOR_CUSTOM_GROUPS_KEY, []);
        if (!Array.isArray(stored)) stored = [];
        var seenIds = new Set();
        var seenNames = new Set(FOLLOW_AUTHOR_GROUP_DEFINITIONS.map(function(group) {
            return group.name.toLocaleLowerCase();
        }));
        return stored.map(function(group) {
            var id = String(group && group.id || "").trim();
            var name = String(group && group.name || "").replace(/\s+/g, " ").trim().slice(0, 30);
            var normalizedName = name.toLocaleLowerCase();
            if (!/^custom_[a-z0-9_]+$/i.test(id) || !name || seenIds.has(id) || seenNames.has(normalizedName)) return null;
            seenIds.add(id);
            seenNames.add(normalizedName);
            return { id: id, name: name, icon: "📁", custom: true };
        }).filter(Boolean);
    }

    function saveFollowAuthorCustomGroups(groups) {
        GM_setValue(FOLLOW_AUTHOR_CUSTOM_GROUPS_KEY, (groups || []).map(function(group) {
            return { id: group.id, name: group.name };
        }));
    }

    function getFollowAuthorGroupDefinitions() {
        return FOLLOW_AUTHOR_GROUP_DEFINITIONS.concat(getFollowAuthorCustomGroups());
    }

    function createFollowAuthorCustomGroup(groupName) {
        var name = String(groupName || "").replace(/\s+/g, " ").trim().slice(0, 30);
        if (!name) return { group: null, reason: "empty" };
        var definitions = getFollowAuthorGroupDefinitions();
        var duplicate = definitions.find(function(group) {
            return group.name.toLocaleLowerCase() === name.toLocaleLowerCase();
        });
        if (duplicate) return { group: duplicate, reason: "duplicate" };
        var customGroups = getFollowAuthorCustomGroups();
        var id = "custom_" + Date.now().toString(36);
        while (definitions.some(function(group) { return group.id === id; })) id += "_1";
        var group = { id: id, name: name, icon: "📁", custom: true };
        customGroups.push(group);
        saveFollowAuthorCustomGroups(customGroups);
        return { group: group, reason: "created" };
    }

    function removeFollowAuthorCustomGroup(groupId) {
        var customGroups = getFollowAuthorCustomGroups();
        var target = customGroups.find(function(group) { return group.id === groupId; });
        if (!target) return null;
        saveFollowAuthorCustomGroups(customGroups.filter(function(group) { return group.id !== groupId; }));
        return target;
    }

    function getFollowAuthorGroupAssignments(authors) {
        var stored = GM_getValue(FOLLOW_AUTHOR_GROUPS_KEY, {});
        if (!stored || typeof stored !== "object" || Array.isArray(stored)) stored = {};
        var validGroupIds = new Set(getFollowAuthorGroupDefinitions().map(function(group) { return group.id; }));
        var validAuthors = new Set((authors || getFollowedAuthors()).map(function(author) {
            return author.toLocaleLowerCase();
        }));
        var normalized = {};
        validAuthors.forEach(function(key) {
            normalized[key] = validGroupIds.has(stored[key]) ? stored[key] : "regular";
        });
        return normalized;
    }

    function saveFollowAuthorGroupAssignments(assignments) {
        GM_setValue(FOLLOW_AUTHOR_GROUPS_KEY, assignments || {});
    }

    function syncFollowAuthorGroupAssignments(authors) {
        var normalized = getFollowAuthorGroupAssignments(authors);
        saveFollowAuthorGroupAssignments(normalized);
        return normalized;
    }

    function setFollowAuthorGroup(author, groupId, assignments) {
        var map = assignments || getFollowAuthorGroupAssignments();
        var validGroupIds = new Set(getFollowAuthorGroupDefinitions().map(function(group) { return group.id; }));
        map[String(author || "").toLocaleLowerCase()] = validGroupIds.has(groupId) ? groupId : "regular";
        saveFollowAuthorGroupAssignments(map);
        return map;
    }

    function removeFollowAuthorGroup(author, assignments) {
        var map = assignments || getFollowAuthorGroupAssignments();
        delete map[String(author || "").toLocaleLowerCase()];
        saveFollowAuthorGroupAssignments(map);
        return map;
    }

    function getAuthorThreadsURL(author) {
        var url = new URL(baseURL + "/home.php");
        url.searchParams.set("mod", "space");
        url.searchParams.set("username", author);
        url.searchParams.set("do", "thread");
        url.searchParams.set("view", "me");
        url.searchParams.set("type", "thread");
        url.searchParams.set("from", "space");
        return url.href;
    }

    function getLocalDateKey(date) {
        var value = date || new Date();
        return value.getFullYear() + "-" +
            String(value.getMonth() + 1).padStart(2, "0") + "-" +
            String(value.getDate()).padStart(2, "0");
    }

    function isTodayForumDate(value) {
        var text = String(value || "").trim();
        if (!text) return false;
        var now = new Date();
        var start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        var end = start + 86400000;
        if (/今天|刚刚/.test(text)) return true;
        var relative = text.match(/(\d+)\s*(秒|分钟|小时)前/);
        if (relative) {
            var unit = relative[2] === "秒" ? 1000 : relative[2] === "分钟" ? 60000 : 3600000;
            var relativeTime = Date.now() - parseInt(relative[1], 10) * unit;
            return relativeTime >= start && relativeTime < end;
        }
        var fullDate = text.match(/(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
        if (fullDate) {
            return Number(fullDate[1]) === now.getFullYear() &&
                Number(fullDate[2]) === now.getMonth() + 1 &&
                Number(fullDate[3]) === now.getDate();
        }
        var shortDate = text.match(/(?:^|\s)(\d{1,2})[-/.月](\d{1,2})(?:日|\s|$)/);
        return Boolean(shortDate &&
            Number(shortDate[1]) === now.getMonth() + 1 &&
            Number(shortDate[2]) === now.getDate());
    }

    function countTodayAuthorThreads(html) {
        return extractTodayAuthorThreadInfo(html).length;
    }

    function parseAuthorThreadTime(value) {
        var text = String(value || "").trim();
        var now = new Date();
        if (/刚刚/.test(text)) return Date.now();
        var relative = text.match(/(\d+)\s*(秒|分钟|小时)前/);
        if (relative) {
            var unit = relative[2] === "秒" ? 1000 : relative[2] === "分钟" ? 60000 : 3600000;
            return Date.now() - parseInt(relative[1], 10) * unit;
        }
        var clock = text.match(/(?:今天|刚刚)?\s*(\d{1,2}):(\d{2})/);
        if (clock && /(?:今天|刚刚)/.test(text)) {
            return new Date(now.getFullYear(), now.getMonth(), now.getDate(), Number(clock[1]), Number(clock[2])).getTime();
        }
        var normalized = text.replace(/[年\/]/g, "-").replace(/月/g, "-").replace(/日/g, " ").replace(/\./g, "-");
        var parsed = Date.parse(normalized);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function extractTodayAuthorThreadInfo(html) {
        var doc = new DOMParser().parseFromString(html, "text/html");
        var links = Array.from(doc.querySelectorAll(
            "#delform a.xst, #threadlisttableid a.xst, #threadlist a.xst, " +
            ".tl a.xst, .threadlist a.xst"
        ));
        var seen = new Set();
        var result = [];
        links.forEach(function(link) {
            // 只接受主题列表的标题链接；回帖定位、评论和跳转链接一律不计数。
            var rawHref = link.getAttribute("href") || "";
            if (!rawHref || /(?:[?&]pid=|[?&]goto=findpost|[?&]mod=redirect|#pid)/i.test(rawHref)) return;
            var tid = extractTid(link.href);
            if (!tid || seen.has(tid)) return;
            var row = link.closest(
                "tr, tbody[id^='normalthread_'], tbody[id^='stickthread_'], " +
                "tbody[id^='thread_'], li.thread-item, .thread-item"
            );
            if (!row) return;
            var byCells = row.querySelectorAll("td.by");
            // Discuz 主题列表中第一个 td.by 是发帖作者/发布时间，后一个是最后回复。
            // 找不到发布时间栏时不使用整行文字兜底，避免把回复时间误算成发帖时间。
            if (!byCells.length) return;
            var dateHost = byCells[0];
            var dateNode = dateHost.querySelector("span[title], time[datetime], em span, em, time");
            var dateText = dateNode
                ? dateNode.getAttribute("title") || dateNode.getAttribute("datetime") || dateNode.textContent
                : dateHost.textContent;
            if (isTodayForumDate(dateText)) {
                seen.add(tid);
                result.push({
                    tid: String(tid),
                    title: String(link.textContent || "").replace(/\s+/g, " ").trim() || "无标题",
                    url: normalizeURL(link.href),
                    timeText: String(dateText || "").trim(),
                    timestamp: parseAuthorThreadTime(dateText)
                });
            }
        });
        result.sort(function(a, b) { return b.timestamp - a.timestamp; });
        return result;
    }

    async function getAuthorTodayUpdateInfo(author) {
        var cache = getJSONValue("bgshAuthorTodayThreadInfoCacheV3", {});
        if (!cache || typeof cache !== "object" || Array.isArray(cache)) cache = {};
        var key = "author:" + author.toLocaleLowerCase();
        var today = getLocalDateKey();
        var cached = cache[key];
        if (cached && cached.date === today && Date.now() - Number(cached.time || 0) < 15 * 60 * 1000) {
            return {
                count: Number(cached.count) || 0,
                latestTime: Number(cached.latestTime) || 0,
                latestTitles: Array.isArray(cached.latestTitles) ? cached.latestTitles : [],
                latestTids: Array.isArray(cached.latestTids) ? cached.latestTids : []
            };
        }
        var html = await fetchText(getAuthorThreadsURL(author), {}, 10000);
        if (/过于?频繁|间隔.*秒|请稍后/i.test(html)) throw new Error("网站限制访问频率");
        var items = extractTodayAuthorThreadInfo(html);
        var info = {
            count: items.length,
            latestTime: items.length ? items[0].timestamp : 0,
            latestTitles: items.slice(0, 5).map(function(item) { return item.title; }),
            latestTids: items.slice(0, 20).map(function(item) { return item.tid; })
        };
        // 并发统计时重新读取最新缓存，避免不同作者的结果互相覆盖。
        cache = getJSONValue("bgshAuthorTodayThreadInfoCacheV3", {});
        if (!cache || typeof cache !== "object" || Array.isArray(cache)) cache = {};
        cache[key] = { date: today, time: Date.now(), count: info.count, latestTime: info.latestTime, latestTitles: info.latestTitles, latestTids: info.latestTids };
        setJSONValue("bgshAuthorTodayThreadInfoCacheV3", cache);
        return info;
    }

    async function getAuthorTodayUpdateCount(author) {
        return (await getAuthorTodayUpdateInfo(author)).count;
    }

    const FOLLOWED_AUTHOR_SEEN_KEY = "bgshFollowAuthorSeenUpdatesV1";

    function getFollowedAuthorUpdateSignature(info) {
        if (!info || Number(info.count || 0) <= 0) return "";
        var latestTids = Array.isArray(info.latestTids) ? info.latestTids.filter(Boolean) : [];
        var latestTitle = Array.isArray(info.latestTitles) && info.latestTitles.length
            ? String(info.latestTitles[0])
            : "";
        return [
            getLocalDateKey(),
            Number(info.count || 0),
            latestTids.length ? latestTids.join(",") : latestTitle
        ].join("|");
    }

    function getFollowedAuthorSeenUpdates() {
        var value = getJSONValue(FOLLOWED_AUTHOR_SEEN_KEY, {});
        return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    }

    function isFollowedAuthorUpdateUnread(author, info) {
        var signature = getFollowedAuthorUpdateSignature(info);
        if (!signature) return false;
        var seen = getFollowedAuthorSeenUpdates();
        return seen[String(author || "").toLocaleLowerCase()] !== signature;
    }

    function markFollowedAuthorUpdateSeen(author, info) {
        var signature = getFollowedAuthorUpdateSignature(info);
        if (!signature) return;
        var seen = getFollowedAuthorSeenUpdates();
        seen[String(author || "").toLocaleLowerCase()] = signature;
        setJSONValue(FOLLOWED_AUTHOR_SEEN_KEY, seen);
    }

    function clearFollowedAuthorSeenUpdate(author) {
        var seen = getFollowedAuthorSeenUpdates();
        var key = String(author || "").toLocaleLowerCase();
        if (!Object.prototype.hasOwnProperty.call(seen, key)) return;
        delete seen[key];
        setJSONValue(FOLLOWED_AUTHOR_SEEN_KEY, seen);
    }

    function renderFollowedAuthorBadge(badge, author, info, unread) {
        if (!badge) return;
        var count = Number(info && info.count || 0);
        badge.textContent = String(count);
        badge.style.display = "inline-flex";
        badge.style.opacity = count > 0 ? "1" : ".58";
        badge.style.background = unread ? "#e52424" : (count > 0 ? "#f7971e" : "#9b8b7a");
        badge.style.color = "#fff";
        badge.style.boxShadow = unread ? "0 0 0 3px rgba(229,36,36,.16), 0 2px 8px rgba(229,36,36,.38)" : "none";
        badge.dataset.unread = unread ? "1" : "0";
        var titlePreview = info && info.latestTitles && info.latestTitles.length
            ? "\n最新主题：\n" + info.latestTitles.map(function(title, index) { return (index + 1) + ". " + title; }).join("\n")
            : "\n今日暂无新主题";
        badge.title = author + " 今天新发 " + count + " 个主题" +
            (unread ? "（有未读更新，点击作者查看后标记已读）" : "") + titlePreview;
    }

    async function loadFollowedAuthorTodayCounts(authors, badgeMap, itemMap, onUpdated) {
        var queue = authors.slice();
        var worker = async function() {
            while (queue.length) {
                var author = queue.shift();
                var badge = badgeMap.get(author);
                try {
                    var info = await getAuthorTodayUpdateInfo(author);
                    if (!badge || !badge.isConnected) continue;
                    var unread = isFollowedAuthorUpdateUnread(author, info);
                    renderFollowedAuthorBadge(badge, author, info, unread);
                    var item = itemMap && itemMap.get(author);
                    if (item) {
                        item.dataset.updateTime = String(info.latestTime || 0);
                        item.dataset.updateCount = String(info.count || 0);
                        item.dataset.updateUnread = unread ? "1" : "0";
                        item.__bgshAuthorUpdateInfo = info;
                        item.title = badge.title;
                        var authorLink = item.querySelector ? item.querySelector("a") : null;
                        if (authorLink) authorLink.title = badge.title;
                    }
                    if (typeof onUpdated === "function") onUpdated(author, info);
                } catch (error) {
                    if (badge && badge.isConnected) { badge.textContent = "!"; badge.title = "统计失败，请稍后重试"; }
                    debugLog("统计作者今日更新失败:", author, error);
                }
            }
        };
        var workers = [];
        for (var i = 0; i < Math.min(3, authors.length); i++) workers.push(worker());
        await Promise.all(workers);
    }

    function showFollowedAuthorsDialog() {
        var old = document.getElementById("bgshFollowAuthorsDialog");
        if (old) old.remove();

        var authors = getFollowedAuthors();
        var groupDefinitions = getFollowAuthorGroupDefinitions();
        var assignments = syncFollowAuthorGroupAssignments(authors);
        var sortByUpdate = GM_getValue("bgshFollowAuthorsSortByUpdate", false) === true;
        var expandedGroups = GM_getValue("bgshFollowAuthorExpandedGroups", { premium: true, regular: true });
        if (!expandedGroups || typeof expandedGroups !== "object") expandedGroups = { premium: true, regular: true };

        var overlay = createElement("div", { id: "bgshFollowAuthorsDialog", className: "bgsh-dialog-overlay" });
        var dialog = createElement("div", { className: "bgsh-dialog" });
        dialog.style.width = "560px";
        dialog.style.maxWidth = "94vw";

        var header = createElement("div", { className: "bgsh-dialog-header" });
        var title = createElement("div", { className: "bgsh-dialog-title", text: "👥 关注作者（" + authors.length + "）" });
        var closeButton = createElement("button", { className: "bgsh-dialog-close", text: "×", attrs: { type: "button" } });
        header.append(title, closeButton);

        var body = createElement("div", { className: "bgsh-dialog-body" });
        var actions = createElement("div");
        Object.assign(actions.style, { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", marginBottom: "10px" });
        var dragHint = createElement("span", { text: "拖动作者卡片可切换分组" });
        Object.assign(dragHint.style, { color: "#9a6a35", fontSize: "12px" });
        var actionButtons = createElement("div");
        Object.assign(actionButtons.style, { display: "flex", gap: "8px" });
        var sortButton = createElement("button", { className: "bgsh-customBtn", text: sortByUpdate ? "✓ 已按更新时间" : "⏱️ 按更新时间排序" });
        var clearButton = createElement("button", { className: "bgsh-customBtn", text: "🧹 清空关注" });
        [sortButton, clearButton].forEach(function(button) {
            Object.assign(button.style, { width: "auto", margin: "0", padding: "5px 10px", fontSize: "12px" });
        });
        clearButton.style.background = "linear-gradient(135deg,#ff5a36,#d93025)";
        clearButton.style.color = "#fff";
        actionButtons.append(sortButton, clearButton);
        actions.append(dragHint, actionButtons);
        body.appendChild(actions);

        var groupCreator = createElement("div");
        Object.assign(groupCreator.style, { display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" });
        var groupNameInput = createElement("input", {
            attrs: { type: "text", maxlength: "30", placeholder: "输入自定义分组名" }
        });
        Object.assign(groupNameInput.style, { flex: "1", minWidth: "0", padding: "7px 10px", border: "1px solid rgba(247,151,30,.38)", borderRadius: "8px", outline: "none" });
        var createGroupButton = createElement("button", { className: "bgsh-customBtn", text: "➕ 新建分组", attrs: { type: "button" } });
        Object.assign(createGroupButton.style, { width: "auto", margin: "0", padding: "7px 12px", fontSize: "12px", flexShrink: "0" });
        groupCreator.append(groupNameInput, createGroupButton);
        body.appendChild(groupCreator);

        var groupContainer = createElement("div");
        Object.assign(groupContainer.style, { display: "flex", flexDirection: "column", gap: "10px", maxHeight: "460px", overflowY: "auto", paddingRight: "2px" });
        var groupListMap = new Map();
        var groupCountMap = new Map();
        var groupEmptyMap = new Map();
        var badgeMap = new Map();
        var itemMap = new Map();
        var emptyAll = createElement("div", { text: "暂无关注作者，请在设置 → 功能中添加作者名字。" });
        Object.assign(emptyAll.style, { display: "none", padding: "28px 10px", textAlign: "center", color: "#999" });
        body.append(emptyAll, groupContainer);

        function saveExpandedGroups() {
            GM_setValue("bgshFollowAuthorExpandedGroups", expandedGroups);
        }

        function handleGroupDrop(event, groupId) {
            event.preventDefault();
            var author = event.dataTransfer.getData("text/bgsh-follow-author") || event.dataTransfer.getData("text/plain");
            if (!author || !itemMap.has(author)) return;
            var previous = assignments[author.toLocaleLowerCase()] || "regular";
            if (previous === groupId) return;
            assignments = setFollowAuthorGroup(author, groupId, assignments);
            sortAuthorElements();
            var group = groupDefinitions.find(function(item) { return item.id === groupId; });
            showToast("已将 " + author + " 移至“" + group.name + "”", "success", 1800);
        }

        function renderGroupSection(group) {
            if (!group || groupListMap.has(group.id)) return;
            var section = createElement("section");
            section.dataset.groupId = group.id;
            Object.assign(section.style, { border: "1px solid rgba(247,151,30,.26)", borderRadius: "11px", background: "rgba(255,248,235,.18)", overflow: "hidden" });
            var groupHeader = createElement("div");
            Object.assign(groupHeader.style, { display: "flex", alignItems: "stretch", width: "100%", color: "#7a4615", background: "linear-gradient(135deg,rgba(255,106,0,.15),rgba(255,157,0,.08))", fontWeight: "800" });
            var groupToggle = createElement("button", { attrs: { type: "button" } });
            Object.assign(groupToggle.style, { display: "flex", alignItems: "center", justifyContent: "space-between", flex: "1", minWidth: "0", padding: "9px 11px", border: "0", cursor: "pointer", color: "inherit", background: "transparent", fontWeight: "inherit" });
            var groupName = createElement("span", { text: group.icon + " " + group.name });
            var groupMeta = createElement("span");
            groupToggle.append(groupName, groupMeta);
            groupHeader.appendChild(groupToggle);
            var memberList = createElement("div");
            Object.assign(memberList.style, { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "8px", padding: "9px" });
            var empty = createElement("div", { text: "暂无成员，可将作者拖到这里" });
            Object.assign(empty.style, { gridColumn: "1 / -1", padding: "12px", textAlign: "center", color: "#aaa", fontSize: "12px" });
            memberList.appendChild(empty);
            groupListMap.set(group.id, memberList);
            groupCountMap.set(group.id, groupMeta);
            groupEmptyMap.set(group.id, empty);

            function updateExpandedState() {
                var expanded = expandedGroups[group.id] !== false;
                memberList.style.display = expanded ? "grid" : "none";
                groupMeta.dataset.expanded = expanded ? "1" : "0";
            }
            groupToggle.addEventListener("click", function() {
                expandedGroups[group.id] = expandedGroups[group.id] === false;
                saveExpandedGroups();
                updateExpandedState();
                renderGroupCounts();
            });
            if (group.custom) {
                var deleteGroupButton = createElement("button", {
                    text: "🗑️",
                    title: "删除分组“" + group.name + "”",
                    attrs: { type: "button", "aria-label": "删除分组“" + group.name + "”" }
                });
                Object.assign(deleteGroupButton.style, { flex: "0 0 auto", width: "38px", padding: "0", border: "0", borderLeft: "1px solid rgba(247,151,30,.22)", cursor: "pointer", color: "#c4472d", background: "rgba(255,255,255,.18)", fontSize: "14px" });
                deleteGroupButton.addEventListener("click", function(event) {
                    event.preventDefault();
                    event.stopPropagation();
                    var affectedAuthors = authors.filter(function(author) {
                        return (assignments[author.toLocaleLowerCase()] || "regular") === group.id;
                    });
                    var message = "确定删除分组“" + group.name + "”吗？";
                    if (affectedAuthors.length) message += "\n该组的 " + affectedAuthors.length + " 位作者将移回“常规关注作者”。";
                    if (!window.confirm(message)) return;

                    affectedAuthors.forEach(function(author) {
                        assignments[author.toLocaleLowerCase()] = "regular";
                    });
                    saveFollowAuthorGroupAssignments(assignments);
                    if (!removeFollowAuthorCustomGroup(group.id)) return;
                    groupDefinitions = groupDefinitions.filter(function(item) { return item.id !== group.id; });
                    delete expandedGroups[group.id];
                    saveExpandedGroups();
                    groupListMap.delete(group.id);
                    groupCountMap.delete(group.id);
                    groupEmptyMap.delete(group.id);
                    section.remove();
                    sortAuthorElements();
                    showToast("已删除分组“" + group.name + "”，成员已移回常规关注", "success", 2600);
                });
                groupHeader.appendChild(deleteGroupButton);
            }
            [section, memberList].forEach(function(dropTarget) {
                dropTarget.addEventListener("dragover", function(event) {
                    event.preventDefault();
                    section.style.boxShadow = "0 0 0 2px rgba(255,106,0,.5)";
                });
                dropTarget.addEventListener("dragleave", function(event) {
                    if (!section.contains(event.relatedTarget)) section.style.boxShadow = "none";
                });
                dropTarget.addEventListener("drop", function(event) {
                    section.style.boxShadow = "none";
                    handleGroupDrop(event, group.id);
                });
            });
            section.append(groupHeader, memberList);
            groupContainer.appendChild(section);
            updateExpandedState();
        }

        groupDefinitions.forEach(renderGroupSection);

        function createCustomGroupFromInput() {
            var result = createFollowAuthorCustomGroup(groupNameInput.value);
            if (!result.group) {
                showToast("请输入分组名称", "warning");
                groupNameInput.focus();
                return;
            }
            if (result.reason === "duplicate") {
                showToast("分组“" + result.group.name + "”已存在", "warning");
                groupNameInput.select();
                return;
            }
            groupDefinitions.push(result.group);
            expandedGroups[result.group.id] = true;
            saveExpandedGroups();
            renderGroupSection(result.group);
            groupNameInput.value = "";
            sortAuthorElements();
            showToast("已新建分组：“" + result.group.name + "”", "success", 1800);
        }
        createGroupButton.addEventListener("click", createCustomGroupFromInput);
        groupNameInput.addEventListener("keydown", function(event) {
            if (event.key !== "Enter") return;
            event.preventDefault();
            createCustomGroupFromInput();
        });

        function renderGroupCounts() {
            groupDefinitions.forEach(function(group) {
                var count = authors.filter(function(author) {
                    return (assignments[author.toLocaleLowerCase()] || "regular") === group.id;
                }).length;
                var meta = groupCountMap.get(group.id);
                var expanded = expandedGroups[group.id] !== false;
                if (meta) meta.textContent = (expanded ? "▲" : "▼") + " " + count + " 人";
                var empty = groupEmptyMap.get(group.id);
                if (empty) empty.style.display = count ? "none" : "block";
            });
            emptyAll.style.display = authors.length ? "none" : "block";
            groupContainer.style.display = authors.length ? "flex" : "none";
            title.textContent = "👥 关注作者（" + authors.length + "）";
            clearButton.disabled = !authors.length;
        }

        function compareAuthorItems(left, right) {
            var timeDiff = Number(right.dataset.updateTime || 0) - Number(left.dataset.updateTime || 0);
            if (timeDiff) return timeDiff;
            var countDiff = Number(right.dataset.updateCount || 0) - Number(left.dataset.updateCount || 0);
            if (countDiff) return countDiff;
            return String(left.dataset.author || "").localeCompare(String(right.dataset.author || ""), "zh-CN");
        }

        function sortAuthorElements() {
            groupDefinitions.forEach(function(group) {
                var groupAuthors = authors.filter(function(author) {
                    return (assignments[author.toLocaleLowerCase()] || "regular") === group.id;
                });
                var items = groupAuthors.map(function(author) { return itemMap.get(author); }).filter(Boolean);
                if (sortByUpdate) items.sort(compareAuthorItems);
                var memberList = groupListMap.get(group.id);
                items.forEach(function(item) { memberList.appendChild(item); });
            });
            renderGroupCounts();
        }

        sortButton.addEventListener("click", function() {
            sortByUpdate = !sortByUpdate;
            GM_setValue("bgshFollowAuthorsSortByUpdate", sortByUpdate);
            sortButton.textContent = sortByUpdate ? "✓ 已按更新时间" : "⏱️ 按更新时间排序";
            sortAuthorElements();
        });

        clearButton.addEventListener("click", function() {
            if (!authors.length) return;
            if (!window.confirm("确定清空全部 " + authors.length + " 个关注作者吗？")) return;
            GM_setValue("followedAuthors", []);
            authors.forEach(clearFollowedAuthorSeenUpdate);
            authors = [];
            assignments = {};
            saveFollowAuthorGroupAssignments(assignments);
            itemMap.forEach(function(item) { item.remove(); });
            badgeMap.clear();
            itemMap.clear();
            renderGroupCounts();
            showToast("🧹 已清空全部关注作者", "success");
        });

        authors.forEach(function(author) {
            var item = createElement("div");
            item.dataset.author = author;
            item.dataset.updateTime = "0";
            item.dataset.updateCount = "0";
            item.dataset.updateUnread = "0";
            item.draggable = true;
            Object.assign(item.style, { display: "flex", alignItems: "center", gap: "4px", padding: "4px", border: "1px solid rgba(247,151,30,.22)", borderRadius: "8px", background: "rgba(247,151,30,.08)", overflow: "hidden", whiteSpace: "nowrap", cursor: "grab" });
            var link = createElement("a", { attrs: { href: getAuthorThreadsURL(author), target: "_blank", rel: "noopener noreferrer" }, title: "查看 " + author + " 发表的主题" });
            link.draggable = false;
            Object.assign(link.style, { display: "flex", alignItems: "center", justifyContent: "space-between", flex: "1 1 auto", minWidth: "0", gap: "6px", padding: "5px 6px", color: "#8a5419", textDecoration: "none", overflow: "hidden" });
            var name = createElement("span", { text: "👤 " + author });
            Object.assign(name.style, { minWidth: "0", overflow: "hidden", textOverflow: "ellipsis" });
            var badge = createElement("span", { text: "…", title: "正在统计今日更新" });
            Object.assign(badge.style, { display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: "0", minWidth: "18px", height: "18px", padding: "0 4px", borderRadius: "9px", background: "#9b8b7a", color: "#fff", fontSize: "11px", fontWeight: "700", boxSizing: "border-box", opacity: ".58" });
            var removeButton = createElement("button", { text: "×", title: "取消关注 " + author, attrs: { type: "button", "aria-label": "取消关注 " + author } });
            Object.assign(removeButton.style, { display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto", width: "20px", height: "20px", padding: "0", border: "0", borderRadius: "6px", background: "transparent", color: "#b35a45", cursor: "pointer", fontSize: "17px", lineHeight: "1" });
            badgeMap.set(author, badge);
            itemMap.set(author, item);
            link.append(name, badge);

            item.addEventListener("dragstart", function(event) {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/bgsh-follow-author", author);
                event.dataTransfer.setData("text/plain", author);
                item.style.opacity = ".55";
            });
            item.addEventListener("dragend", function() { item.style.opacity = "1"; });
            link.addEventListener("click", function() {
                var info = item.__bgshAuthorUpdateInfo;
                if (info) {
                    markFollowedAuthorUpdateSeen(author, info);
                    renderFollowedAuthorBadge(badge, author, info, false);
                    item.dataset.updateUnread = "0";
                } else {
                    getAuthorTodayUpdateInfo(author).then(function(latestInfo) {
                        markFollowedAuthorUpdateSeen(author, latestInfo);
                    }).catch(function(error) {
                        debugLog("记录作者更新已读状态失败:", author, error);
                    });
                }
                overlay.remove();
            });
            removeButton.addEventListener("click", function(event) {
                event.preventDefault();
                event.stopPropagation();
                var targetName = author.toLocaleLowerCase();
                authors = authors.filter(function(value) { return value.toLocaleLowerCase() !== targetName; });
                GM_setValue("followedAuthors", authors);
                assignments = removeFollowAuthorGroup(author, assignments);
                clearFollowedAuthorSeenUpdate(author);
                badgeMap.delete(author);
                itemMap.delete(author);
                item.remove();
                sortAuthorElements();
                showToast("已取消关注作者：" + author, "info", 1800);
            });
            item.append(link, removeButton);
        });

        sortAuthorElements();
        if (authors.length) {
            loadFollowedAuthorTodayCounts(authors, badgeMap, itemMap, function() {
                if (sortByUpdate) sortAuthorElements();
                else renderGroupCounts();
            });
        }

        var close = function() { overlay.remove(); };
        closeButton.addEventListener("click", close);
        overlay.addEventListener("click", function(event) { if (event.target === overlay) close(); });
        dialog.append(header, body);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
    }

    function getCurrentThreadAuthorLink() {
        var firstPost = qs("#postlist > div[id^='post_']") ||
            qs("#postlist [id^='post_']") ||
            qs("[id^='post_']");
        var selectors = [
            ".pls .authi a.xw1",
            ".pls .authi a[href*='mod=space']",
            ".pls a[href*='space-uid']",
            ".authi a.xw1"
        ];
        for (var i = 0; i < selectors.length; i++) {
            var link = qs(selectors[i], firstPost || document);
            if (link && link.textContent.trim()) return link;
        }
        return null;
    }

    function getCurrentThreadAuthor() {
        var link = getCurrentThreadAuthorLink();
        return link ? link.textContent.trim() : "";
    }

    function createFollowAuthorButton() {
        var author = getCurrentThreadAuthor();
        if (!author) return null;
        var button = createButton("followThreadAuthorButton", "", function() {
            var authors = getFollowedAuthors();
            var targetName = author.toLocaleLowerCase();
            var index = authors.findIndex(function(name) {
                return name.toLocaleLowerCase() === targetName;
            });
            if (index >= 0) {
                authors.splice(index, 1);
                GM_setValue("followedAuthors", authors);
                removeFollowAuthorGroup(author);
                clearFollowedAuthorSeenUpdate(author);
                showToast("已取消关注作者：" + author, "info", 1800);
            } else {
                authors.push(author);
                GM_setValue("followedAuthors", authors);
                setFollowAuthorGroup(author, "regular");
                showToast("已关注作者：" + author, "success", 1800);
            }
            updateState();
        });

        function updateState() {
            var followed = getFollowedAuthors().some(function(name) {
                return name.toLocaleLowerCase() === author.toLocaleLowerCase();
            });
            button.textContent = followed ? "✅ 已关注作者" : "👤 关注作者";
            button.title = (followed ? "取消关注：" : "关注当前主题作者：") + author;
            button.dataset.followed = followed ? "1" : "0";
        }

        updateState();
        return button;
    }

    function createOneClickDoubleButton() {
        return createButton("oneClickDoubleButton", "✨ 一键二连", gradeAndStar);
    }

    function createQuickTopicadminToPostButton(post, stickreply) {
        var text = stickreply === "1" ? "📌 快速置顶" : "↗️ 取消置顶";
        return createButton("quickTopicadminToPost", text, () => {
            let pid = getTableIdFromElement(post);
            if (pid) topicadmin(pid, stickreply);
            else showToast("❌ 未找到置顶元素", "error");
        }, "bgsh-quickTopicadminToPostBtn");
    }

    function createQuickReplyEditToPostButton(post) {
        return createButton("quickReplyEditToPost", "✏️ 编辑回复", () => {
            let pid = getTableIdFromElement(post);
            if (pid) {
                let fid = getFidFromElement();
                const tid = extractTid(window.location.href);
                window.location.href = `forum.php?mod=post&action=edit&fid=${fid}&tid=${tid}&pid=${pid}`;
            } else {
                showToast("❌ 未找到回复元素", "error");
            }
        }, "bgsh-quickReplyEditToPostBtn");
    }

    function createQuickReplyToPostButton(post) {
        return createButton("quickReplyToPost", "💬 快速回复", () => {
            let pid = getTableIdFromElement(post);
            if (pid) {
                let fid = getFidFromElement();
                const tid = extractTid(window.location.href);
                showWindow("reply", `forum.php?mod=post&action=reply&fid=${fid}&tid=${tid}&repquote=${pid}`);
            } else {
                showToast("❌ 未找到回复元素", "error");
            }
        }, "bgsh-quickReplyToPostBtn");
    }

    function createSetAnswerToPostButton(post) {
        return createButton("setAnswerToPost", "✅ 最佳答案", () => {
            let pid = getTableIdFromElement(post);
            if (pid) setanswer(pid, "");
            else showToast("❌ 未找到最佳答案", "error");
        }, "bgsh-setAnswerToPostBtn");
    }

    function createQuickReportadToPostButton(post) {
        return createButton("quickReportadToPost", "🚫 广告举报", () => {
            let pid = getTableIdFromElement(post);
            if (pid) {
                const tid = extractTid(window.location.href);
                showWindow("reportad", `plugin.php?id=pc_reportad&tid=${tid}&pid=${pid}`);
            } else {
                showToast("❌ 未找到举报元素", "error");
            }
        }, "bgsh-quickReportadToPostBtn");
    }

    function createQuickSupportToPostButton(post) {
        const replyAddElement = post.querySelector("a.replyadd");
        if (replyAddElement) {
            return createButton("quickSupportToPost", "👍 快速支持", async () => {
                let pid = getTableIdFromElement(post);
                if (pid) {
                    let fid = getFidFromElement();
                    const tid = extractTid(window.location.href);
                    const formHash = document.querySelector('input[name="formhash"]').value;
                    const url = `forum.php?mod=misc&action=postreview&do=support&tid=${tid}&pid=${pid}&hash=${formHash}`;
                    let response = await fetch(url);
                    let text = await response.text();
                    var parser = new DOMParser();
                    var doc = parser.parseFromString(text, "text/html");
                    var nfl = doc.querySelector(".nfl");
                    let content = nfl.textContent.replace(/[\r\n]/g, "").split(" ")[0];
                    showToast(content, "info");
                } else {
                    showToast("❌ 未找到支持元素", "error");
                }
            }, "bgsh-QuickMiscReportBtn");
        }
        return null;
    }

    function createQuickMiscReportToPostButton(post) {
        return createButton("quickMiscReport", "🚨 快速举报", () => {
            let pid = getTableIdFromElement(post);
            if (pid) {
                let fid = getFidFromElement();
                const tid = extractTid(window.location.href);
                showWindow(`miscreport${pid}`, `misc.php?mod=report&rtype=post&rid=${pid}&tid=${tid}&fid=${fid}`);
            } else {
                showToast("❌ 未找到回复元素", "error");
            }
        }, "bgsh-QuickMiscReportBtn");
    }

    function addQuickActionToPostButton() {
        const postContainers = document.querySelectorAll(".po.hin");

        postContainers.forEach((postContainer) => {
            const existingButton = postContainer.parentNode.querySelector("#quickTopicadminToPost");
            if (existingButton) return;

            let parentTbody = postContainer.closest("tbody");
            var stickreply = parentTbody && parentTbody.querySelector('img[src="static/image/common/settop.png"]') ? "0" : "1";

            const quickTopicadminToPostButton = createQuickTopicadminToPostButton(postContainer, stickreply);
            const replyToPostButton = createQuickReplyToPostButton(postContainer);
            const quickSupportToPostButton = createQuickSupportToPostButton(postContainer);
            const quickMiscReportToPostButton = createQuickMiscReportToPostButton(postContainer);
            const quickReportadToPostButton = createQuickReportadToPostButton(postContainer);
            const setAnswerToPostButton = createSetAnswerToPostButton(postContainer);

            postContainer.appendChild(replyToPostButton);
            postContainer.appendChild(quickTopicadminToPostButton);
            postContainer.appendChild(quickMiscReportToPostButton);
            postContainer.appendChild(quickReportadToPostButton);
            if (quickSupportToPostButton) postContainer.appendChild(quickSupportToPostButton);

            const found = postContainer.querySelector(".editp");
            if (found) {
                const quickReplyEditToPostButton = createQuickReplyEditToPostButton(postContainer);
                postContainer.appendChild(quickReplyEditToPostButton);
            }
            if (postContainer && postContainer.innerHTML.includes("setanswer(")) {
                postContainer.appendChild(setAnswerToPostButton);
            }
        });
    }

    function showAvatarEvent() {
        const avatars = document.querySelectorAll(".avatar");
        const isPostPage = () => /forum\.php\?mod=viewthread|\/thread-\d+-\d+-\d+\.html/.test(window.location.href);
        if (!isPostPage()) return;

        var settings = getSettings();
        avatars.forEach((avatar) => {
            avatar.style.display = settings.showAvatar ? "block" : "none";
        });
    }

    async function replacePMonPost() {
        let firstPobClElement = document.querySelector(".po.hin");
        let pid = getTableIdFromElement(firstPobClElement);

        document.querySelectorAll('[class*="pm2"]').forEach((element) => {
            const anchor = element.querySelector("a");
            if (anchor) {
                const href = anchor.getAttribute("href");
                const urlParams = new URLSearchParams(href);
                const touid = urlParams.get("touid");

                if (touid) {
                    const newButton = createFastPMButton(pid, touid);
                    if (element.nextSibling) {
                        element.parentNode.insertBefore(newButton, element.nextSibling);
                    } else {
                        element.parentNode.appendChild(newButton);
                    }
                }
            }
            element.remove();
        });
    }

    function appendTitleFromHotImage() {
        const regex = /static\/image\/common\/hot_\d+\.gif/;
        const images = Array.from(document.querySelectorAll("img")).filter((img) => regex.test(img.src));

        images.forEach((image) => {
            const titleContent = image.title;
            const threadSubjectSpans = document.querySelectorAll("#thread_subject");
            threadSubjectSpans.forEach((threadSubjectSpan) => {
                const uniqueId = `hotTitle-appendTitleFromHotImage`;
                if (!threadSubjectSpan.parentNode.querySelector(`#${uniqueId}`)) {
                    const newSpan = document.createElement("span");
                    newSpan.id = uniqueId;
                    newSpan.textContent = ` [${titleContent}]`;
                    newSpan.style.color = "red";
                    threadSubjectSpan.parentNode.insertBefore(newSpan, threadSubjectSpan.nextSibling);
                }
            });
        });
    }

    async function appendBuyNumber() {
        var href = window.location.href;
        var tid = extractTid(href);
        if (!tid || !isCurrentPaidThreadPage()) return;

        setupRememberedSalePriceObserver(tid);
        renderRememberedSalePrice(tid);
        refreshPurchasedBadgesForTid(tid, false);

        var buyInfo = await getCachedViewpayments(tid, false, false);
        if (buyInfo.state) {
            var dataRowCount = buyInfo.dataRowCount;
            const threadSubjectSpans = document.querySelectorAll("#thread_subject");
            threadSubjectSpans.forEach((threadSubjectSpan) => {
                const uniqueId = `buynum-appendBuyNumber`;
                if (!threadSubjectSpan.parentNode.querySelector(`#${uniqueId}`)) {
                    const newSpan = document.createElement("span");
                    newSpan.id = uniqueId;
                    newSpan.dataset.bgshSalesTid = tid;
                    newSpan.dataset.bgshSalesPlace = "thread-title";
                    newSpan.textContent = `已售 ${dataRowCount} 份`;
                    newSpan.title = `该主题已有 ${dataRowCount} 人购买`;
                    styleSalesBadge(newSpan, false);
                    threadSubjectSpan.parentNode.insertBefore(newSpan, threadSubjectSpan.nextSibling);
                } else {
                    var existing = threadSubjectSpan.parentNode.querySelector(`#${uniqueId}`);
                    existing.textContent = `已售 ${dataRowCount} 份`;
                }
            });

            refreshPurchasedBadgesForTid(tid, buyInfo.currentUserPurchased);

            // 同时覆盖页面静态购买按钮和论坛稍后打开的购买弹窗。
            setupPurchaseButtonSalesBadge(tid, dataRowCount);
        }
    }

    function removeFastReply() {
        document.querySelectorAll("#f_pst").forEach((element) => element.remove());
    }

    function isPostContainer(element) {
        return Boolean(element && element.nodeType === 1 &&
            (/^post_\d+$/i.test(element.id || "") || /^pid\d+$/i.test(element.id || "")));
    }

    function getPostContainers(root) {
        var scope = root || document;
        var result = [];
        if (isPostContainer(scope)) result.push(scope);
        var postList = scope.id === "postlist" ? scope :
            (scope.querySelector ? scope.querySelector("#postlist") : null);
        if (postList) {
            Array.from(postList.children).forEach(function(child) {
                if (isPostContainer(child)) result.push(child);
            });
        } else if (scope.querySelectorAll) {
            scope.querySelectorAll("div[id^='post_'], table[id^='pid']").forEach(function(element) {
                if (isPostContainer(element)) result.push(element);
            });
        }
        return Array.from(new Set(result));
    }

    function getPostPid(post) {
        if (!post) return "";
        var match = String(post.id || "").match(/(?:post_|pid)(\d+)/i);
        if (match) return match[1];
        var message = post.querySelector("[id^='postmessage_']");
        match = message && message.id.match(/postmessage_(\d+)/i);
        return match ? match[1] : "";
    }

    function getSessionPostImageAction(tid, fallbackAction) {
        if (!tid) return fallbackAction;
        try {
            var raw = sessionStorage.getItem("bgshPostImageAction:" + tid);
            if (!raw) return fallbackAction;
            var saved = JSON.parse(raw);
            if (!saved || Date.now() - Number(saved.timestamp || 0) > 5 * 60 * 1000) {
                sessionStorage.removeItem("bgshPostImageAction:" + tid);
                return fallbackAction;
            }
            return saved.action === "hide" ? "hide" : "show";
        } catch (error) {
            return fallbackAction;
        }
    }

    function saveSessionPostImageAction(tid, action) {
        if (!tid) return;
        try {
            sessionStorage.setItem("bgshPostImageAction:" + tid, JSON.stringify({
                action: action === "hide" ? "hide" : "show",
                timestamp: Date.now()
            }));
        } catch (error) {}
    }

    function handlePostPage(settings, buttonContainer) {
        const toggleImages = (action) => {
            var normalizedAction = action === "hide" ? "hide" : "show";
            document.documentElement.setAttribute("data-bgsh-post-images", normalizedAction);
        };

        const currentTid = extractTid(window.location.href);
        const hideImagesOnLoad = false;
        const defaultImageAction = "show";
        let currentImageAction = "show";
        toggleImages(currentImageAction);
        const initialButtonText = currentImageAction === "show" ? "🙈 隐藏图片" : "👀 显示图片";

        const toggleButton = createButton("toggleImageDisplay", initialButtonText, function () {
            if (currentImageAction === "hide") {
                currentImageAction = "show";
                toggleImages(currentImageAction);
                toggleButton.innerText = "🙈 隐藏图片";
            } else {
                currentImageAction = "hide";
                toggleImages(currentImageAction);
                toggleButton.innerText = "👀 显示图片";
            }
            saveSessionPostImageAction(currentTid, currentImageAction);
        });
        toggleButton.title = "切换当前主题；购买刷新后短时保留，进入其他帖子时使用默认设置";
        buttonContainer.appendChild(toggleButton);

        const applyDefaultImageShowing = function() {
            currentImageAction = "show";
            toggleImages("show");
            toggleButton.innerText = "🙈 隐藏图片";
            saveSessionPostImageAction(currentTid, "show");
        };
        if (document.readyState === "complete") {
            setTimeout(applyDefaultImageShowing, 0);
        } else {
            window.addEventListener("load", applyDefaultImageShowing, { once: true });
        }
        // 双重保险：再调用一次显示图片
        setTimeout(function() { toggleImages("show"); }, 200);

        if (settings.showDown) buttonContainer.appendChild(createDownButton());

        let codeBlocks = document.querySelectorAll(".blockcode");
        if (codeBlocks.length > 0 && settings.showCopyCode) {
            buttonContainer.appendChild(createCopyCodeButton());
        }

        let firstPobClElement = document.querySelector(".po.hin");
        let pid = getTableIdFromElement(firstPobClElement);
        const userid = getUserId();

        if (userid) {
            if (settings.showFastPost) buttonContainer.appendChild(createFastPostButton());
            if (settings.showFastReply) buttonContainer.appendChild(createFastReplyButton());
            if (settings.showQuickGrade) {
                const tid = extractTid(window.location.href);
                buttonContainer.appendChild(createQuickGradeButton(tid, pid));
            }
            if (settings.showQuickStar) buttonContainer.appendChild(createQuickStarButton());
            if (settings.showClickDouble) buttonContainer.appendChild(createOneClickDoubleButton());
            addQuickActionToPostButton();
        }

        const followAuthorButton = createFollowAuthorButton();
        const threadAuthorLink = getCurrentThreadAuthorLink();
        if (followAuthorButton && threadAuthorLink) {
            const authorLine = threadAuthorLink.closest(".authi") || threadAuthorLink.parentElement;
            if (authorLine) {
                Object.assign(authorLine.style, {
                    display: "flex",
                    alignItems: "center",
                    flexWrap: "nowrap",
                    gap: "0",
                    whiteSpace: "nowrap"
                });
            }
            Object.assign(threadAuthorLink.style, {
                display: "inline-flex",
                alignItems: "center",
                flex: "0 1 auto",
                minWidth: "0"
            });
            Object.assign(followAuthorButton.style, {
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "0 0 auto",
                width: "auto",
                padding: "2px 7px",
                margin: "0 0 0 6px",
                borderRadius: "7px",
                fontSize: "11px",
                verticalAlign: "middle"
            });
            threadAuthorLink.insertAdjacentElement("afterend", followAuthorButton);
        }

        if (settings.showViewRatings) buttonContainer.appendChild(createViewRatingsButton(pid));
        if (settings.showPayLog) buttonContainer.appendChild(createPayLogButton(pid));
        if (settings.showFastCopy) buttonContainer.appendChild(createFastCopyButton());

        setupPostImageLazyLoading(buttonContainer);
        insertMergeDownloadButtons(buttonContainer);
        initInfiniteScroll("isPostPage");
        showAvatarEvent();
        replacePMonPost();
        removeFastReply();
        appendTitleFromHotImage();
        appendBuyNumber();
    }
    // #endregion

    // #region 合并下载（从【蚂蚁脚本】98tang--[合并下载] 并入，重写为不依赖 localhost）
    // 原脚本能力：帖子页抓 blockcode 里的 ed2k/magnet 存成 txt + 逐个点附件 + Alt+D 快捷键。
    // 原脚本还调用一个第三方本地服务（00Opera，默认 8082 端口）代按 Enter / Ctrl+W，
    // 那套依赖与浏览器安全边界冲突，这里全部删掉：不再向任何本地端口发请求。
    // 新增：合并下载 / 仅导出链接 / 仅下载附件 三个入口，统一挂在右侧工具栏。

    function getMdThreadTitle() {
        var el = document.querySelector("#thread_subject");
        var title = el ? el.textContent.trim() : "";
        if (!title) title = (document.title || "").replace(/\s*-\s*98堂.*$/, "").trim();
        if (!title) title = "untitled";
        return title.replace(/[\\/:*?"<>|@&]/g, "_").slice(0, 120);
    }

    function splitEd2kFromLine(line) {
        var out = [];
        var pattern = /ed2k:\/\/\|file\|[^\s<>"']*?\|\d+\|[a-f0-9]{32}\|(?:[^\s<>"']*?\|)?\//gi;
        var match;
        while ((match = pattern.exec(line)) !== null) out.push(match[0]);
        return out;
    }

    function collectMdDownloadLinks() {
        var result = { ed2k: [], magnet: [], other: [] };
        var seen = new Set();
        function push(kind, value) {
            value = String(value || "").trim();
            if (!value) return;
            var key = kind + "|" + value.toLowerCase();
            if (seen.has(key)) return;
            seen.add(key);
            result[kind].push(value);
        }

        // 1) Discuz 代码块（与原脚本 .blockcode li 等价，但兼容 li/文本混合与换行）
        var containers = document.querySelectorAll(
            ".t_f .blockcode, .t_f pre, .t_f code, .t_f .quote, [id^='postmessage_'] .blockcode, [id^='postmessage_'] pre"
        );
        containers.forEach(function (box) {
            var text = String(box.textContent || box.innerText || "")
                .replace(/&amp;/g, "&").replace(/&nbsp;/g, " ");
            text.split(/\r?\n/).forEach(function (line) {
                line = line.trim();
                if (!line) return;
                splitEd2kFromLine(line).forEach(function (u) { push("ed2k", u); });
                var magnets = line.match(/magnet:\?\?[^\s<>"']+/gi) || [];
                magnets.forEach(function (u) { push("magnet", u); });
            });
        });

        // 2) 兜底：正文里任意位置出现的 ed2k / magnet
        [".t_f", "[id^='postmessage_']"].forEach(function (sel) {
            document.querySelectorAll(sel).forEach(function (root) {
                var text = String(root.textContent || "").replace(/&amp;/g, "&");
                splitEd2kFromLine(text).forEach(function (u) { push("ed2k", u); });
                (text.match(/magnet:\?\?[^\s<>"']+/gi) || []).forEach(function (u) { push("magnet", u); });
            });
        });

        return result;
    }

    // 原脚本的附件识别逻辑，补上 DOM 兜底（span#attach_* / a#aid*）
    function collectMdAttachments() {
        var list = [];
        var seen = new Set();
        function push(a) {
            if (!a || !a.href) return;
            if (seen.has(a.href)) return;
            seen.add(a.href);
            list.push(a);
        }
        document.querySelectorAll("span[id^='attach_'] a, [id^='attach_'] a[href]").forEach(push);
        document.querySelectorAll("a[id^='aid']").forEach(function (a) {
            if (a.classList.length === 0) push(a);
        });
        document.querySelectorAll(".t_f a[href*='mod=attachment'], .t_f a[href*='attachment']").forEach(push);
        return list;
    }

    function isNoiseAttachment(a) {
        var text = String(a.textContent || "");
        return text.indexOf("目录") > -1 || text.toLowerCase().indexOf("sha1") > -1 ||
            text.toLowerCase().indexOf(".torrent") > -1;
    }

    function downloadMdText(content, filename) {
        var blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), content], { type: "text/plain;charset=utf-8" });
        var objectUrl = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.download = filename;
        a.href = objectUrl;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(objectUrl); }, 3000);
    }

    function buildMdLinkText(links) {
        var lines = [];
        links.ed2k.forEach(function (u) { lines.push(u); });
        links.magnet.forEach(function (u) { lines.push(u); });
        return lines.join("\r\n");
    }

    function runMergeDownload(button) {
        var title = getMdThreadTitle();
        var links = collectMdDownloadLinks();
        var attachments = collectMdAttachments().filter(function (a) { return !isNoiseAttachment(a); });
        var linkCount = links.ed2k.length + links.magnet.length;

        if (!linkCount && !attachments.length) {
            showToast("❌ 此页没有 ed2k/磁力链接，也没有可下载的附件", "error", 2400);
            return;
        }

        if (linkCount) {
            downloadMdText(buildMdLinkText(links), title + ".txt");
        }

        if (attachments.length) {
            // 逐个触发；间隔 800ms，避免浏览器把连续下载判定成弹窗拦截
            attachments.forEach(function (a, index) {
                setTimeout(function () { a.click(); }, 900 * index);
            });
        }

        var parts = [];
        if (linkCount) parts.push(links.ed2k.length + " 条 ed2k / " + links.magnet.length + " 条磁力");
        if (attachments.length) parts.push(attachments.length + " 个附件");
        showToast("✅ 已开始：" + parts.join(" + "), "success", 2600);
    }

    function insertMergeDownloadButtons(buttonContainer) {
        if (!buttonContainer || document.getElementById("bgshMergeDownloadButton")) return;
        var url = window.location.href;
        if (!/forum\.php\?mod=viewthread|\/thread-\d+-\d+-\d+\.html/.test(url)) return;

        var mergeButton = createButton("bgshMergeDownloadButton", "⏬ 合并下载", function () {
            runMergeDownload(mergeButton);
        });
        mergeButton.title = "导出 ed2k/磁力到 txt，并逐个下载附件（快捷键 Alt+D）";

        var linksButton = createButton("bgshExportLinksButton", "🔗 仅链接", function () {
            var links = collectMdDownloadLinks();
            var text = buildMdLinkText(links);
            if (!text) { showToast("❌ 此页没有 ed2k/磁力链接", "error", 2000); return; }
            downloadMdText(text, getMdThreadTitle() + ".txt");
            showToast("✅ 链接已导出（" + links.ed2k.length + " ed2k / " + links.magnet.length + " 磁力）", "success");
        });
        linksButton.title = "只把 ed2k/磁力链接存成 txt";

        var attachButton = createButton("bgshDownloadAttachmentsButton", "📎 仅附件", function () {
            var list = collectMdAttachments().filter(function (a) { return !isNoiseAttachment(a); });
            if (!list.length) { showToast("❌ 此页没有可下载附件", "error", 2000); return; }
            list.forEach(function (a, index) {
                setTimeout(function () { a.click(); }, 900 * index);
            });
            showToast("✅ 开始下载 " + list.length + " 个附件", "success");
        });
        attachButton.title = "只下载附件，跳过目录 / sha1 / torrent";

        var titleButton = createButton("bgshCopyThreadTitleButton", "🏷️ 复制标题", function () {
            var title = getMdThreadTitle();
            copyToClipboard(title, function () {
                showToast("标题已复制", "success", 1600);
            }, function () {
                showToast("复制失败，浏览器拒绝了剪贴板权限", "error", 2400);
            });
        });
        titleButton.title = "复制帖子标题（文件名安全化处理）";
        titleButton.className = "bgsh-customBtn bgsh-btn-sub";

        mergeButton.className = "bgsh-customBtn bgsh-btn-download";
        linksButton.className = "bgsh-customBtn bgsh-btn-sub";

        // 放在工具栏末尾，前面加一条分隔线，和上面的通用功能区分开
        var sep = document.createElement("div");
        sep.className = "bgsh-toolbar-sep";
        buttonContainer.appendChild(sep);
        buttonContainer.appendChild(mergeButton);

        buttonContainer.appendChild(linksButton);
        // 「仅附件」默认不挂：工具栏上方已有原生「📥 下载附件」。
        // 需要时在控制台执行 window.__bgshShowAttachButton = true 再刷新。
        if (window.__bgshShowAttachButton) {
            attachButton.className = "bgsh-customBtn bgsh-btn-sub";
            buttonContainer.appendChild(attachButton);
        }
        buttonContainer.appendChild(titleButton);

        // Alt+D：触发合并下载（原脚本快捷键，冲突时可在设置里关掉）
        if (!document.documentElement.dataset.bgshMergeHotkeyBound) {
            document.documentElement.dataset.bgshMergeHotkeyBound = "1";
            document.addEventListener("keydown", function (event) {
                if (!event.altKey || event.keyCode !== 68) return;
                if (!/forum\.php\?mod=viewthread|\/thread-\d+-\d+-\d+\.html/.test(window.location.href)) return;
                var target = document.getElementById("bgshMergeDownloadButton");
                if (!target) return;
                event.preventDefault();
                event.stopPropagation();
                target.click();
            }, true);
        }
    }
    // #endregion

    // #region 帖子列表页功能 (保持原样)
    function createFastPostButton() {
        return createButton("fastPostButton", "✏️ 快速发帖", function () {
            let fid = getFidFromElement();
            showWindow("newthread", `forum.php?mod=post&action=newthread&fid=${fid}`);
        });
    }

    function removeFastPost() {
        document.querySelectorAll("#f_pst").forEach((element) => element.remove());
    }

    function getLocalDateInputValue(date) {
        var value = date || new Date();
        return [
            value.getFullYear(),
            String(value.getMonth() + 1).padStart(2, "0"),
            String(value.getDate()).padStart(2, "0")
        ].join("-");
    }

    function createDateInput(id, defaultValue) {
        const input = document.createElement("input");
        input.type = "date";
        input.id = id;
        input.value = defaultValue || getLocalDateInputValue();
        input.className = "bgsh-dateInput";
        input.style.cssText = "padding: 6px 10px; border: 2px solid rgba(0,0,0,0.06); border-radius: 8px; font-size: 13px; background: rgba(255,248,235,0.5); backdrop-filter: blur(4px); color: #4a2e1b;";
        return input;
    }

    function addDateRangeSelectorAndButton(targetElementOrId) {
        const refElement = typeof targetElementOrId === "string" ? document.getElementById(targetElementOrId) : targetElementOrId;
        if (!refElement) return;
        if (document.getElementById("openAllUrlButton")) return;

        const startDateInput = createDateInput("startDateSelector");
        const endDateInput = createDateInput("endDateSelector");

        const openButton = createButton("openAllUrlButton", "📂 批量打开", () => filterAndOpenThreadsByDate(),
            "bgsh-openAllUrlBtn");
        openButton.title = "按所选日期范围批量打开当前页面中的主题";

        refElement.after(openButton);
        refElement.after(endDateInput);
        refElement.after(document.createTextNode("到"));
        refElement.after(startDateInput);
    }

    function parseDateInputBoundary(value, endOfDay) {
        var match = String(value || "").match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (!match) return null;
        return new Date(
            Number(match[1]), Number(match[2]) - 1, Number(match[3]),
            endOfDay ? 23 : 0,
            endOfDay ? 59 : 0,
            endOfDay ? 59 : 0,
            endOfDay ? 999 : 0
        );
    }

    function parseForumThreadDate(value) {
        var text = String(value || "").trim().replace(/发表于|发布于/g, "").trim();
        if (!text) return null;

        var absolute = text.match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
        if (absolute) {
            return new Date(
                Number(absolute[1]), Number(absolute[2]) - 1, Number(absolute[3]),
                Number(absolute[4] || 0), Number(absolute[5] || 0), Number(absolute[6] || 0)
            );
        }

        var relative = text.match(/(今天|昨天|前天)(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
        if (relative) {
            var date = new Date();
            date.setHours(Number(relative[2] || 0), Number(relative[3] || 0), Number(relative[4] || 0), 0);
            if (relative[1] === "昨天") date.setDate(date.getDate() - 1);
            if (relative[1] === "前天") date.setDate(date.getDate() - 2);
            return date;
        }

        var timestamp = Date.parse(text.replace(/-/g, "/"));
        return Number.isNaN(timestamp) ? null : new Date(timestamp);
    }

    function getForumThreadRowDate(row) {
        var candidates = row.querySelectorAll(
            "td.by em span[title], td.by em span, .by em span[title], .by em span, " +
            ".authi em span[title], .authi em span, time[datetime]"
        );
        for (var i = 0; i < candidates.length; i++) {
            var candidate = candidates[i];
            var values = [
                candidate.getAttribute("title"),
                candidate.getAttribute("datetime"),
                candidate.textContent
            ];
            for (var j = 0; j < values.length; j++) {
                var parsed = parseForumThreadDate(values[j]);
                if (parsed && !Number.isNaN(parsed.getTime())) return parsed;
            }
        }
        return null;
    }

    function openThreadInBackground(url) {
        if (typeof GM_openInTab === "function") {
            try {
                GM_openInTab(url, { active: false, insert: true, setParent: true });
                return true;
            } catch (error) {
                console.warn("GM_openInTab failed, falling back to window.open", error);
            }
        }
        var opened = window.open(url, "_blank");
        if (!opened) return false;
        try { opened.opener = null; } catch (error) {}
        return true;
    }

    function filterAndOpenThreadsByDate() {
        var startInput = document.getElementById("startDateSelector");
        var endInput = document.getElementById("endDateSelector");
        var openButton = document.getElementById("openAllUrlButton");
        var startDate = parseDateInputBoundary(startInput && startInput.value, false);
        var endDate = parseDateInputBoundary(endInput && endInput.value, true);

        if (!startDate || !endDate) {
            showToast("请先选择完整的开始和结束日期", "warning", 2200);
            return;
        }
        if (startDate > endDate) {
            showToast("开始日期不能晚于结束日期", "warning", 2200);
            return;
        }

        var rows = document.querySelectorAll(
            THREAD_LIST_BODY_SELECTOR + ", " +
            "#threadlisttableid tbody > tr, #threadlist .bm_c > table > tbody > tr, .threadlist > li"
        );
        var urls = [];
        var seen = new Set();
        rows.forEach(function(row) {
            var postDate = getForumThreadRowDate(row);
            if (!postDate || postDate < startDate || postDate > endDate) return;
            var link = row.querySelector("a.s.xst, a.xst, a[href*='/thread-'], a[href*='mod=viewthread']");
            if (!link || !link.href || seen.has(link.href)) return;
            seen.add(link.href);
            urls.push(link.href);
        });

        if (!urls.length) {
            showToast("所选日期范围内没有找到可打开的主题", "info", 2600);
            return;
        }
        if (urls.length > 50 && !window.confirm("共找到 " + urls.length + " 个主题，打开大量标签页可能造成卡顿，是否继续？")) {
            return;
        }

        if (openButton) {
            openButton.disabled = true;
            openButton.textContent = "⏳ 打开中";
        }
        var openedCount = 0;
        urls.forEach(function(url) {
            if (openThreadInBackground(url)) openedCount++;
        });
        if (openButton) {
            setTimeout(function() {
                openButton.disabled = false;
                openButton.textContent = "📂 批量打开";
            }, 800);
        }
        if (openedCount === urls.length) {
            showToast("已打开 " + openedCount + " 个主题", "success", 2200);
        } else {
            showToast(
                "已打开 " + openedCount + "/" + urls.length + " 个主题；请允许该网站打开弹窗后重试",
                "warning", 4200
            );
        }
    }

    function cleanupDuplicateThreadPreviews() {
        const checkedParents = new Set();
        document.querySelectorAll('.bgsh-pt').forEach(function(box) {
            const parent = box.parentElement;
            if (!parent || checkedParents.has(parent)) return;
            checkedParents.add(parent);
            const boxes = Array.from(parent.children).filter(function(child) {
                return child.classList && child.classList.contains('bgsh-pt');
            });
            boxes.slice(1).forEach(function(duplicate) { duplicate.remove(); });
        });
    }

    function getThreadPreviewState() {
        return window.__98t_preview_state || (window.__98t_preview_state = {});
    }

    function getPreviewColumnCount(imageCount) {
        var count = Math.max(1, parseInt(imageCount, 10) || 1);
        if (count === 4) return 2;
        return Math.min(3, count);
    }

    function applyThreadPreviewLayout(box) {
        if (!box) return;
        var imageCount = box.querySelectorAll(":scope > img").length;
        if (!imageCount) return;
        var columns = getPreviewColumnCount(imageCount);
        var size = getPreviewSize();
        box.dataset.bgshPreviewCount = String(imageCount);
        box.dataset.bgshPreviewColumns = String(columns);
        box.style.display = "grid";
        var totalGap = Math.max(0, columns - 1) * 4;
        var responsiveSize = "min(var(--bgsh-preview-size, " + size + "px), calc((100% - " + totalGap + "px) / " + columns + "))";
        box.style.gridTemplateColumns = "repeat(" + columns + ", minmax(0, " + responsiveSize + "))";
        box.style.gridAutoFlow = "row";
        box.style.justifyContent = "start";
        box.style.alignItems = "start";
        requestAnimationFrame(function() {
            syncPreviewBoxSize(box, getPreviewSize());
        });
    }

    // 站点的「18 岁确认」不是 Cloudflare，而是站点自己的确认页：
    //   页面里下发 var safeid='...'，再由 static/safe/js/mainv2.js 写成 _safe cookie 后重载。
    // 预览功能靠 fetch 拉帖子页取图，拿到的是这个确认页（没有 .t_f），
    // 于是永远提取不到图片 —— 导读/版块/收藏的预览图就整片消失。
    // 这里照它自己的做法过闸：取出 safeid → 写 _safe → 重取一次。
    async function fetchThreadPageHTML(href) {
        var opts = { signal: AbortSignal.timeout(9000), credentials: "same-origin" };
        var html = await (await fetch(href, opts)).text();
        var m = html.match(/var safeid='([^']+)'/);
        if (m) {
            try {
                document.cookie = "_safe=" + m[1] + "; path=/; max-age=86400; SameSite=Lax";
            } catch (e) {}
            html = await (await fetch(href, opts)).text();
        }
        return html;
    }

    // 清掉「读了但没图」的空行，避免预览行越积越多
    function dropEmptyPreviewRow(host) {
        if (!host || host.querySelector(".bgsh-pt")) return;
        var row = host.closest(".bgsh-preview-row");
        var cell = row ? row.querySelector("td") : null;
        if (row && cell && cell.children.length <= 1) row.remove();
        else if (!row) host.remove();
    }

    async function displayThreadImages(settings) {
        if (!settings.displayThreadImages) return;
        cleanupDuplicateThreadPreviews();
        const cache = getThreadPreviewState();
        const wantedPreviewCount = Math.max(1, Math.min(12, parseInt(settings.threadPreviewCount, 10) || 3));

        // Find thread rows
        const rows = [];
        const thMap = new Map();

        document.querySelectorAll(THREAD_LIST_BODY_SELECTOR + ", .tl > tbody[id^='normalthread_']").forEach(tbody => {
            const link = tbody.querySelector('a.xst, a[href*="thread-"]');
            const tid = (tbody.id || '').replace('normalthread_', '') || (link?.href || '').match(/thread-(\d+)/i)?.[1] || '';
            const titleCell = tbody.querySelector('th.new, th.common, th');
            if (tid && link && titleCell) {
                rows.push({ tbody, link, tid, titleCell });
                thMap.set(tid, titleCell);
            }
        });

        // Fallback: find .s.xst links directly
        if (!rows.length) {
            document.querySelectorAll('.s.xst').forEach(link => {
                const tid = (link.href || '').match(/thread-(\d+)/i)?.[1] || (link.href || '').match(/tid=(\d+)/)?.[1];
                const titleCell = link.closest('th') || link.parentElement?.closest('th');
                const tbody = link.closest('tbody');
                if (tid && titleCell && tbody) {
                    rows.push({ tbody, link, tid, titleCell });
                    thMap.set(tid, titleCell);
                }
            });
        }

        if (!rows.length) return;

        // Load from GM cache
        let gmc = {};
        try { gmc = JSON.parse(GM_getValue('bgsh_preview_cache', '{}')); } catch(e) {}
        for (const k in gmc) { if (Date.now() - (gmc[k].ts||0) > 86400000) delete gmc[k]; }

        const toFetch = [];
        rows.forEach(({ tid, link, titleCell }) => {
            if (cache[tid] === 'loading' || cache[tid] === 'rendered') return;
            if (titleCell.querySelector('.bgsh-pt')) {
                cache[tid] = 'rendered';
                return;
            }

            if (gmc[tid] && gmc[tid].imgs && gmc[tid].imgs.length &&
                ((gmc[tid].limit || 3) >= wantedPreviewCount || gmc[tid].imgs.length >= wantedPreviewCount)) {
                const box = document.createElement('div');
                box.className = 'bgsh-pt';
                box.dataset.bgshPreviewTid = tid;
                box.style.cssText = 'display:flex;gap:4px;margin-top:4px;flex-wrap:wrap;align-items:flex-start;';
                gmc[tid].imgs.slice(0, wantedPreviewCount).forEach(u => { const img = mkThumb(u); if (img) box.appendChild(img); });
                applyThreadPreviewLayout(box);
                titleCell.appendChild(box);
                cache[tid] = 'rendered';
            } else if (!gmc[tid] || (gmc[tid].limit || 3) < wantedPreviewCount) {
                cache[tid] = 'loading';
                toFetch.push({ tid, href: link.href, titleCell });
            } else {
                cache[tid] = 'rendered';
            }
        });

        if (!toFetch.length) return;

        for (let i = 0; i < toFetch.length; i += 8) {
            await Promise.all(toFetch.slice(i, i + 8).map(async ({ tid, href, titleCell }) => {
                try {
                    const html = await fetchThreadPageHTML(href);
                    if (/过于?频繁|间隔.*秒|请稍后/i.test(html)) {
                        delete cache[tid];
                        return;
                    }
                    const doc = new DOMParser().parseFromString(html, 'text/html');
                    const post = doc.querySelector('.t_f, [id^="postmessage_"], .pcb, .message');
                    const imgs = [];
                    if (post) {
                        post.querySelectorAll('img').forEach(el => {
                            const u = el.getAttribute('file') || el.getAttribute('zoomfile') || el.getAttribute('src') || '';
                            if (u && !u.includes('static') && !u.includes('avatar') && !u.includes('smiley') && /.(jpe?g|png|gif|webp)/i.test(u)) {
                                const abs = new URL(u, location.href).href;
                                if (!imgs.includes(abs)) imgs.push(abs);
                            }
                        });
                    }
                    const result = imgs.slice(0, wantedPreviewCount);
                    gmc[tid] = { imgs: result, ts: Date.now(), limit: wantedPreviewCount };
                    GM_setValue('bgsh_preview_cache', JSON.stringify(gmc));
                    if (result.length && !titleCell.querySelector('.bgsh-pt')) {
                        const box = document.createElement('div');
                        box.className = 'bgsh-pt';
                        box.dataset.bgshPreviewTid = tid;
                        box.style.cssText = 'display:flex;gap:4px;margin-top:4px;flex-wrap:wrap;align-items:flex-start;';
                        result.forEach(u => box.appendChild(mkThumb(u)));
                        applyThreadPreviewLayout(box);
                        titleCell.appendChild(box);
                    }
                    cache[tid] = 'rendered';
                } catch(e) {
                    delete cache[tid];
                }
            }));
        }

        function mkThumb(url) {
            const ps = getPreviewSize();
            const img = document.createElement('img');
            img.src = url;
            img.loading = 'lazy';
            img.style.cssText = 'display:block;width:' + ps + 'px;height:' + Math.round(ps * 0.75) + 'px;border-radius:4px;cursor:pointer;object-fit:cover;border:1px solid rgba(0,0,0,.08);margin:0;';
            img.addEventListener('click', function(e) {
                e.stopPropagation();
                const ov = document.createElement('div');
                ov.className = 'bgsh-image-overlay';
                const ci = document.createElement('img');
                ci.src = url;
                ov.appendChild(ci);
                ov.addEventListener('click', () => ov.remove());
                document.body.appendChild(ov);
            });
            return img;
        }
    }

    async function displayThreadBuyInfo(settings) {
        if (!settings.displayThreadBuyInfo) return;
        return syncLoadedSaleThreadBuyInfo(settings, { forceRefresh: false });
    }

    async function displayThreadBuyInfoOther(settings) {
        if (!settings.displayThreadBuyInfo) return;
        return syncLoadedSaleThreadBuyInfo(settings, { forceRefresh: false });
    }

    async function displayAdvanThreadImages(settings) {
        if (!settings.displayThreadImages) return;
        if (/home\.php\?.*do=favorite/i.test(location.href)) return;
        cleanupDuplicateThreadPreviews();
        const cache = getThreadPreviewState();
        const wantedPreviewCount = Math.max(1, Math.min(12, parseInt(settings.threadPreviewCount, 10) || 3));
        let retries = 0;
        const maxRetries = 3;
        const previewPageURL = new URL(location.href);
        const isMyPostsPreviewPage =
            (previewPageURL.pathname.toLowerCase().endsWith("/home.php") &&
                previewPageURL.searchParams.get("do") === "thread") ||
            (previewPageURL.searchParams.get("mod") === "guide" &&
                previewPageURL.searchParams.get("view") === "my");

        function resolveAdvancedPreviewParent(el, tid) {
            if (isMyPostsPreviewPage) {
                var tableRow = el.closest("tr");
                if (tableRow && tableRow.parentNode) {
                    var existingHost = tableRow.parentNode.querySelector(
                        '[data-bgsh-preview-host-tid="' + tid + '"]'
                    );
                    if (existingHost) return existingHost;

                    var previewRow = document.createElement("tr");
                    previewRow.className = "bgsh-my-post-preview-row";
                    previewRow.dataset.bgshPreviewRowTid = tid;
                    var previewCell = document.createElement("td");
                    var totalColumns = Array.from(tableRow.children).reduce(function(total, cell) {
                        return total + (parseInt(cell.getAttribute("colspan"), 10) || 1);
                    }, 0);
                    previewCell.colSpan = Math.max(1, totalColumns);
                    var host = document.createElement("div");
                    host.className = "bgsh-my-post-preview-host";
                    host.dataset.bgshPreviewHostTid = tid;
                    previewCell.appendChild(host);
                    previewRow.appendChild(previewCell);
                    tableRow.insertAdjacentElement("afterend", previewRow);
                    return host;
                }
            }
            // 表格行布局（导读 / 版块 / 收藏）：用一条新的 <tr><td colspan> 承载预览。
            // 不能把 div 直接 append 进 <tbody>（tbody 只允许 tr，表格布局会把 div 吃掉，
            // 表现就是「预览图不显示」）；也不放在 th 里（标题格宽随列宽变，容易被裁）。
            var hostRow = el.closest('tbody[id^="normalthread_"], tbody[id^="stickthread_"]');
            if (hostRow && hostRow.parentNode) {
                var rowHost = hostRow.parentNode.querySelector(
                    '[data-bgsh-preview-host-tid="' + tid + '"]'
                );
                if (rowHost) return rowHost;

                var previewTR = document.createElement('tr');
                previewTR.className = 'bgsh-preview-row';
                previewTR.dataset.bgshPreviewRowTid = tid;
                var previewCell = document.createElement('td');
                var firstRow = hostRow.querySelector('tr');
                var totalColumns = firstRow
                    ? Array.from(firstRow.children).reduce(function(total, cell) {
                          return total + (parseInt(cell.getAttribute('colspan'), 10) || 1);
                      }, 0)
                    : 1;
                previewCell.colSpan = Math.max(1, totalColumns);
                previewCell.style.cssText = 'padding:4px 0 8px 0;border:0;background:transparent;';
                var host = document.createElement('div');
                host.className = 'bgsh-preview-host';
                host.dataset.bgshPreviewHostTid = tid;
                previewCell.appendChild(host);
                previewTR.appendChild(previewCell);
                // 必须挂进 tbody 内部：table 的直接子元素只能是 thead/tbody/tfoot/tr/caption，
                // 把 tr 插在 tbody 后面会被浏览器提升或丢弃，预览行照样不显示。
                hostRow.appendChild(previewTR);
                return host;
            }

            return el.closest('.pbw') ||
                el.closest('li') ||
                el.closest('th') ||
                el.closest('td') ||
                el.closest('.thread-item, .thread, .content') ||
                el.parentElement;
        }

        function removeEmptyMyPostsPreview(parent) {
            if (!isMyPostsPreviewPage || !parent || parent.querySelector('.bgsh-pt')) return;
            var row = parent.closest(".bgsh-my-post-preview-row");
            if (row) row.remove();
        }

        // Helper: extract TID from any URL format
        function getTid(href) {
            if (!href) return '';
            const m = href.match(/thread-(\d+)/i) || href.match(/tid=(\d+)/);
            return m ? m[1] : '';
        }

        async function tryLoad() {
            // Find ALL thread-related links: both thread-xxx and ?tid=xxx formats
            const links = new Map();

            document.querySelectorAll('a[href*="thread-"], a[href*="tid="], a[href*="viewthread"]').forEach(a => {
                const tid = getTid(a.href);
                if (!tid || links.has(tid)) return;
                const text = (a.textContent || '').trim();
                if (!text || text.length < 3) return;
                // 只认标题链接本身，避免「最后发表」那一列的时间链接先占住 tid。
                // Discuz 标题链接固定带 class=xst（原版 a.xst / a.s.xst）。
                // 规则：不是 xst 的链接，只要它所在行里已经有 a.xst，就让位。
                if (!a.classList.contains("xst")) {
                    const row = a.closest("tbody[id^='normalthread_'], tbody[id^='stickthread_'], tr, li");
                    if (row && row.querySelector("a.xst")) return;
                }
                links.set(tid, { href: a.href, el: a });
            });

            if (!links.size) {
                if (retries < maxRetries) {
                    retries++;
                    await new Promise(r => setTimeout(r, 1000));
                    return tryLoad();
                }
                // 到这个页面结构仍然认不出来时，不要静默失败：给个一次性提示，方便定位。
                if (!window.__bgshPreviewWarned) {
                    window.__bgshPreviewWarned = true;
                    showToast("主题预览未找到可挂载的链接（页面结构可能又变了）", "warning", 3200);
                }
                return;
            }

            // GM cache
            let gmc = {};
            try { gmc = JSON.parse(GM_getValue('bgsh_preview_cache', '{}')); } catch(e) {}
            for (const k in gmc) { if (Date.now() - (gmc[k].ts||0) > 86400000) delete gmc[k]; }

            const toFetch = [];
            links.forEach(({ href, el }, tid) => {
                // Find parent for preview insertion
                if (cache[tid] === 'loading' || cache[tid] === 'rendered') return;
                let parent = resolveAdvancedPreviewParent(el, tid);
                if (!parent) return;
                if (parent.querySelector('.bgsh-pt')) {
                    cache[tid] = 'rendered';
                    return;
                }

                if (gmc[tid] && gmc[tid].imgs && gmc[tid].imgs.length &&
                    ((gmc[tid].limit || 3) >= wantedPreviewCount || gmc[tid].imgs.length >= wantedPreviewCount)) {
                    var box = document.createElement('div');
                    box.className = 'bgsh-pt';
                    box.dataset.bgshPreviewTid = tid;
                    box.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;align-items:flex-start;justify-content:flex-start;width:100%;clear:both;box-sizing:border-box;';
                    gmc[tid].imgs.slice(0, wantedPreviewCount).forEach(function(u) { var img = mkThumb(u); if (img) box.appendChild(img); });
                    applyThreadPreviewLayout(box);
                    parent.appendChild(box);
                    cache[tid] = 'rendered';
                } else if (!gmc[tid] || !(gmc[tid].imgs && gmc[tid].imgs.length) ||
                           (gmc[tid].limit || 3) < wantedPreviewCount) {
                    cache[tid] = 'loading';
                    toFetch.push({ tid, href, parent });
                } else {
                    cache[tid] = 'rendered';
                    removeEmptyMyPostsPreview(parent);
                    dropEmptyPreviewRow(parent);
                }
            });

            if (!toFetch.length) return;

            for (let i = 0; i < toFetch.length; i += 6) {
                await Promise.all(toFetch.slice(i, i + 6).map(async ({ tid, href, parent }) => {
                    try {
                        const html = await fetchThreadPageHTML(href);
                        if (/过于?频繁|间隔.*秒|请稍后/i.test(html)) {
                            delete cache[tid];
                            removeEmptyMyPostsPreview(parent);
                            return;
                        }
                        const doc = new DOMParser().parseFromString(html, 'text/html');
                        const post = doc.querySelector('.t_f, [id^="postmessage_"], .pcb, .message');
                        if (!post) {
                            delete cache[tid];
                            removeEmptyMyPostsPreview(parent);
                            return;
                        }
                        const imgs = [];
                        post.querySelectorAll('img').forEach(el => {
                            const u = el.getAttribute('file') || el.getAttribute('zoomfile') || el.getAttribute('src') || '';
                            if (u && !u.includes('static') && !u.includes('avatar') && !u.includes('smiley') && /.(jpe?g|png|gif|webp)/i.test(u)) {
                                const abs = new URL(u, location.href).href;
                                if (!imgs.includes(abs)) imgs.push(abs);
                            }
                        });
                        const result = imgs.slice(0, wantedPreviewCount);
                        // 只有真的取到图才落缓存。写空数组会让这个 tid 被判定为
                        // 「已渲染且 limit 够」，之后永远走 else 分支不再重试 ——
                        // 一次失败（安全确认页 / 限流）就会把预览永久钉死。
                        if (result.length) {
                            gmc[tid] = { imgs: result, ts: Date.now(), limit: wantedPreviewCount };
                            GM_setValue('bgsh_preview_cache', JSON.stringify(gmc));
                        }
                        if (result.length && !parent.querySelector('.bgsh-pt')) {
                            var box = document.createElement('div');
                            box.className = 'bgsh-pt';
                            box.dataset.bgshPreviewTid = tid;
                            box.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;align-items:flex-start;justify-content:flex-start;width:100%;clear:both;box-sizing:border-box;';
                            result.forEach(function(u) { box.appendChild(mkThumb(u)); });
                            applyThreadPreviewLayout(box);
                            parent.appendChild(box);
                        } else if (!result.length) {
                            removeEmptyMyPostsPreview(parent);
                            dropEmptyPreviewRow(parent);
                        }
                        cache[tid] = 'rendered';
                    } catch(e) {
                        delete cache[tid];
                        removeEmptyMyPostsPreview(parent);
                    }
                }));
            }

            function mkThumb(url) {
                var ps = getPreviewSize();
                var img = document.createElement('img');
                img.src = url;
                img.loading = 'lazy';
                img.style.cssText = 'width:' + ps + 'px;height:' + Math.round(ps * 0.75) + 'px;border-radius:8px;cursor:pointer;object-fit:cover;border:1px solid #eaeaea;';
                img.addEventListener('click', function(e) {
                    e.stopPropagation();
                    var ov = document.createElement('div');
                    ov.className = 'bgsh-image-overlay';
                    var ci = document.createElement('img');
                    ci.src = url;
                    ov.appendChild(ci);
                    ov.addEventListener('click', function() { ov.remove(); });
                    document.body.appendChild(ov);
                });
                return img;
            }
        }

        await tryLoad();

        // MutationObserver for dynamically loaded results
        if (!window.__bgshSearchObserver) {
            window.__bgshSearchObserver = new MutationObserver(() => {
                const existing = document.querySelectorAll('.bgsh-pt').length;
                const newLinks = document.querySelectorAll('a[href*="thread-"], a[href*="tid="], a[href*="viewthread"]').length;
                if (newLinks > existing + 3) tryLoad();
            });
            const root = document.querySelector('.searchresult, #threadlist, .tl, .bm_c, .mainbox') || document.body;
            window.__bgshSearchObserver.observe(root, { childList: true, subtree: true });
        }
    }

    async function blockingResolvedAction(settings) {
        if (settings.blockingResolved) {
            const tbodies = document.querySelectorAll("tbody");
            tbodies.forEach((tbody) => {
                if (tbody.textContent.includes("[已解决]")) {
                    tbody.remove();
                }
            });
        }
    }

    async function isOnlyShowMoneyAction(settings) {
        if (!settings.isOnlyShowMoney) return;

        const tbodies = document.querySelectorAll("tbody");
        const keywords = ["E卡", "e卡", "话费"];
        const excludedSelectors = ["#scbar_txt", "#scbar_btn", "#scbar_type"];

        tbodies.forEach((tbody) => {
            const isExcluded = excludedSelectors.some((selector) => tbody.querySelector(selector));
            if (isExcluded) return;

            const containsKeyword = keywords.some((keyword) => tbody.textContent.includes(keyword));
            if (!containsKeyword) tbody.remove();
        });
    }

    async function handleForumDisplayPage(settings, buttonContainer) {
        if (settings.enableTitleStyle) stylePosts(settings);

        removeFastPost();
        const currentURL = window.location.href;
        const queryParams = getQueryParams(currentURL);
        const fid = queryParams.fid;

        if (fid == 143 || fid == "143") {
            blockingResolvedAction(settings);
            isOnlyShowMoneyAction(settings);

            const blockingResolvedText = settings.blockingResolved == true ? "✅ 显示解决" : "🚫 屏蔽解决";
            const blockingResolvedButton = createButton("blockingResolvedBtn", blockingResolvedText, function () {
                if (blockingResolvedButton.innerText === "✅ 显示解决") {
                    blockingResolvedButton.innerText = "🚫 屏蔽解决";
                    GM_setValue("blockingResolved", false);
                    location.reload();
                } else {
                    blockingResolvedButton.innerText = "✅ 显示解决";
                    GM_setValue("blockingResolved", true);
                    location.reload();
                }
            });
            buttonContainer.appendChild(blockingResolvedButton);

            const isOnlyShowMoneyText = settings.isOnlyShowMoney == true ? "📋 显示全部" : "💵 只看现金";
            const isOnlyShowMoneyButton = createButton("isOnlyShowMoneyBtn", isOnlyShowMoneyText, function () {
                if (isOnlyShowMoneyButton.innerText === "📋 显示全部") {
                    isOnlyShowMoneyButton.innerText = "💵 只看现金";
                    GM_setValue("isOnlyShowMoney", false);
                    location.reload();
                } else {
                    isOnlyShowMoneyButton.innerText = "📋 显示全部";
                    GM_setValue("isOnlyShowMoney", true);
                    location.reload();
                }
            });
            buttonContainer.appendChild(isOnlyShowMoneyButton);
        }

        if (settings.displayThreadBuyInfo && getLoadedSaleThreadLinks().length > 0) {
            await displayThreadBuyInfo(settings);
        }

        const userid = getUserId();
        if (userid && settings.showFastPost) {
            buttonContainer.appendChild(createFastPostButton());
        }

        // Sort button
        buttonContainer.appendChild(createSortButton());
        preserveNativePaginationSort();

        const targetElement = document.querySelector(".xs1.xw0.i");
        setTimeout(() => displayThreadImages(settings), 350);
        addDateRangeSelectorAndButton(targetElement);
        initInfiniteScroll("isForumDisplayPage");
    }

    // 板块帖子列表默认排序：网站原生默认是「按回复时间」(orderby=lastpost)。
    // 脚本默认给没带 orderby 的板块页补上 orderby=dateline&ascdesc=desc 并重定向一次，
    // 让服务端真正按发布时间取数据（只在前端重排会导致取到的帖子集合本身就是错的）。
    // 选「网站默认」时不干预；选「回复时间」时补 orderby=lastpost。
    // 用 location.replace 避免污染后退历史；URL 里已有 orderby 时一律不干预，
    // 这样点排序按钮切回「回复时间」仍然有效，不会被自动改回去。
    function applyForumDefaultSort() {
        var preferred = GM_getValue("forumDefaultSort", "dateline");
        if (preferred !== "dateline" && preferred !== "lastpost") return false;
        if (!/forum\.php\?mod=forumdisplay|\/forum-\d+-\d+\.html/.test(window.location.href)) return false;

        var url;
        try {
            url = new URL(window.location.href);
        } catch (error) {
            return false;
        }
        if (url.searchParams.get("orderby")) return false;

        // 双保险：同一个地址只自动跳一次，任何意外都不会变成重定向死循环
        var guardKey = "bgshForumSortRedirect:" + url.pathname + url.search;
        try {
            if (sessionStorage.getItem(guardKey)) return false;
            sessionStorage.setItem(guardKey, "1");
        } catch (error) {}

        url.searchParams.set("orderby", preferred);
        url.searchParams.set("ascdesc", "desc");
        window.location.replace(url.toString());
        return true;
    }

    function createSortButton() {
        const currentURL = window.location.href;
        // 本站原生默认是「按回复时间」(orderby=lastpost)。URL 没带 orderby 时
        // 按原生排序展示（回复时间），按钮如实显示当前状态，点击后切换排序。
        let currentOrder = 'lastpost';
        const om = currentURL.match(/orderby=(\w+)/);
        if (om) currentOrder = om[1];

        const labels = { lastpost: '🕐 按回复时间', dateline: '📅 按发布时间' };
        const nextOrder = currentOrder === 'lastpost' ? 'dateline' : 'lastpost';

        const btn = createButton('sortTimeBtn', labels[currentOrder] || '🕐 按回复时间', function() {
            const url = new URL(window.location.href);
            url.searchParams.set('orderby', nextOrder);
            url.searchParams.set('ascdesc', 'desc');
            window.location.href = url.toString();
        });
        return btn;
    }

    function preserveNativePaginationSort() {
        var current;
        try {
            current = new URL(window.location.href);
        } catch (error) {
            return;
        }
        var orderby = current.searchParams.get("orderby");
        if (orderby !== "dateline" && orderby !== "lastpost") return;

        var inheritedParams = [
            "orderby", "ascdesc", "filter", "dateline", "specialtype",
            "typeid", "digest", "recommend"
        ];
        var rewriteLink = function(link) {
            if (!link || !link.getAttribute("href") || /^javascript:/i.test(link.getAttribute("href"))) return;
            try {
                var target = new URL(link.getAttribute("href"), location.href);
                inheritedParams.forEach(function(name) {
                    var value = current.searchParams.get(name);
                    if (value !== null) target.searchParams.set(name, value);
                });
                link.href = target.href;
            } catch (error) {}
        };

        document.querySelectorAll(".pg a[href], .pgs a[href]").forEach(rewriteLink);

        if (document.documentElement.dataset.bgshNativeSortGuard === "1") return;
        document.documentElement.dataset.bgshNativeSortGuard = "1";
        document.addEventListener("click", function(event) {
            var link = event.target.closest && event.target.closest(".pg a[href], .pgs a[href]");
            if (link) rewriteLink(link);
        }, true);
    }

    function addPageNumbers() {
        const sourceElement = document.querySelector(".pgs.cl.mbm");
        const targetElement = document.querySelector(".slst.mtw");

        if (!sourceElement) {
            console.error("源元素未找到！");
            return;
        }
        if (!targetElement) {
            console.error("目标元素未找到！");
            return;
        }

        const parentElement = targetElement.parentElement;
        if (!parentElement) return;

        const clonedElement = sourceElement.cloneNode(true);
        parentElement.insertBefore(clonedElement, targetElement);
    }

    function replaceImageSrc() {
        window.addEventListener("load", function () {
            document.querySelectorAll('img[src="static/image/common/logo_sc_s.png"]').forEach(function (img) {
                img.src = "static/image/common/logo.png";
            });
        });
    }
    // #endregion

    // #region 搜索功能 (4.7 - 全站板块分类、常用板块与原生搜索)
    function escapeSearchHtml(value) {
        return String(value).replace(/[&<>"']/g, function(char) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
        });
    }

    function cleanBoardName(value) {
        return String(value || "")
            .replace(/\s+/g, " ")
            .replace(/[（(]\s*\d+\s*[)）]\s*$/, "")
            .trim();
    }

    function extractBoardFid(href) {
        if (!href) return null;
        var match = String(href).match(/[?&]fid=(\d+)|\/forum-(\d+)-\d+\.html|forum-(\d+)-\d+\.html/i);
        var value = match && (match[1] || match[2] || match[3]);
        return value ? parseInt(value, 10) : null;
    }

    function getBoardLinkGroupName(link) {
        var section = link.closest("[id^='category_'], .bm.fl, .fl.bm, .bm");
        if (!section) return "网站其他板块";
        var heading = section.querySelector(".bm_h h2, .bm_h h1, .fl_tb h2, .xs2 a, .xw1");
        var text = cleanBoardName(heading && heading.textContent);
        return text && text.length < 40 ? text : "网站其他板块";
    }

    function readSearchBoardJson(key, fallback) {
        try {
            var value = JSON.parse(GM_getValue(key, JSON.stringify(fallback)));
            return value && typeof value === "object" ? value : fallback;
        } catch (error) {
            return fallback;
        }
    }

    function getAllRecognizedBoardFids() {
        var all = new Set();
        SEARCH_BOARD_GROUPS.forEach(function(group) {
            (group.fids || []).forEach(function(fid) {
                fid = parseInt(fid, 10);
                if (fid) all.add(fid);
            });
        });
        return all;
    }

    function getManualCommonBoards() {
        return readSearchBoardJson("bgshCommonBoardsV47", []).map(function(fid) {
            return parseInt(fid, 10);
        }).filter(Boolean);
    }

    function getCommonBoardFids(limit) {
        var available = getAllRecognizedBoardFids();
        var manual = getManualCommonBoards();
        var usage = readSearchBoardJson("bgshBoardUsageV47", {});
        var result = [];
        manual.forEach(function(fid) {
            if (available.has(fid) && result.indexOf(fid) === -1) result.push(fid);
        });
        Object.keys(usage).map(function(fid) {
            return { fid: parseInt(fid, 10), count: Number(usage[fid]) || 0 };
        }).filter(function(item) {
            return item.fid && available.has(item.fid) && result.indexOf(item.fid) === -1;
        }).sort(function(a, b) {
            return b.count - a.count;
        }).forEach(function(item) {
            if (item.count > 0 && result.length < limit) result.push(item.fid);
        });
        return result.slice(0, limit);
    }

    function recordCommonBoardUsage(fids) {
        var usage = readSearchBoardJson("bgshBoardUsageV47", {});
        Array.from(new Set(fids.map(String))).forEach(function(fid) {
            usage[fid] = (Number(usage[fid]) || 0) + 1;
        });
        GM_setValue("bgshBoardUsageV47", JSON.stringify(usage));
    }

    function parseWebsiteSearchBoards(doc) {
        var hashInput = doc.querySelector('input[name="formhash"]');
        if (hashInput && hashInput.value) SEARCH_FORMHASH = hashInput.value;
        var groupMap = new Map();

        function addBoard(groupName, fid, name) {
            if (!Number.isFinite(fid) || fid <= 0) return;
            var cleanName = cleanBoardName(name);
            if (!cleanName || /^\d+$/.test(cleanName)) cleanName = "fid=" + fid;
            SEARCH_BOARD_NAMES[String(fid)] = cleanName;
            var label = "📂 " + cleanBoardName(groupName || "网站其他板块");
            if (!groupMap.has(label)) groupMap.set(label, []);
            var list = groupMap.get(label);
            if (list.indexOf(fid) === -1) list.push(fid);
        }

        doc.querySelectorAll('select[name="srchfid[]"], select[name="srchfid"]').forEach(function(select) {
            Array.from(select.querySelectorAll("option")).forEach(function(option) {
                if (!/^\d+$/.test(option.value) || option.disabled) return;
                var parent = option.parentElement;
                var groupName = parent && parent.tagName === "OPTGROUP"
                    ? parent.getAttribute("label")
                    : "搜索板块";
                addBoard(groupName, parseInt(option.value, 10), option.textContent);
            });
        });

        doc.querySelectorAll(
            'a[href*="mod=forumdisplay"][href*="fid="], ' +
            'a[href*="forum-"][href$=".html"], a[href*="forum-"]'
        ).forEach(function(link) {
            var fid = extractBoardFid(link.getAttribute("href") || link.href);
            if (!fid) return;
            addBoard(getBoardLinkGroupName(link), fid, link.textContent);
        });

        return Array.from(groupMap.entries()).map(function(entry) {
            return { label: entry[0], fids: entry[1] };
        }).filter(function(group) { return group.fids.length > 0; });
    }

    function mergeSearchBoardGroups(groupSets) {
        var seen = new Set();
        var merged = [];
        var mergedByLabel = new Map();
        groupSets.forEach(function(groups) {
            (groups || []).forEach(function(group) {
                var label = cleanBoardName(group.label || "📂 网站其他板块");
                var target = mergedByLabel.get(label);
                if (!target) {
                    target = { label: label, fids: [] };
                    mergedByLabel.set(label, target);
                    merged.push(target);
                }
                (group.fids || []).forEach(function(rawFid) {
                    var fid = parseInt(rawFid, 10);
                    if (!fid || seen.has(fid)) return;
                    seen.add(fid);
                    target.fids.push(fid);
                });
            });
        });
        return merged.filter(function(group) { return group.fids.length > 0; });
    }

    function splitWebsiteBoardGroups(groups) {
        var result = { classified: [], generic: [] };
        (groups || []).forEach(function(group) {
            var label = cleanBoardName(group.label || "").replace(/^[^\p{L}\p{N}]+/u, "");
            if (/^(搜索板块|网站其他板块|其他板块)$/.test(label)) result.generic.push(group);
            else result.classified.push(group);
        });
        return result;
    }

    async function fetchBoardDocument(path) {
        var response = await fetch(baseURL + path, {
            credentials: "include",
            cache: "no-store"
        });
        if (!response.ok) throw new Error("HTTP " + response.status);
        var html = await response.text();
        return new DOMParser().parseFromString(html, "text/html");
    }

    async function syncSearchBoards() {
        var cacheEnabled = getSettings().searchCacheEnabled;
        var cachedGroups = [];
        var cachedTime = 0;
        if (cacheEnabled) {
            try {
                var cached = JSON.parse(GM_getValue("bgshSearchBoardsV474", "null"));
                if (cached && cached.groups && cached.groups.length) {
                    cachedGroups = cached.groups;
                    cachedTime = Number(cached.time) || 0;
                    Object.assign(SEARCH_BOARD_NAMES, cached.names || {});
                }
            } catch (error) {}
        }

        var localGroups = parseWebsiteSearchBoards(document);
        var localParts = splitWebsiteBoardGroups(localGroups);
        var cacheIsFresh = cacheEnabled && cachedGroups.length && Date.now() - cachedTime < 6 * 60 * 60 * 1000;
        if (cacheIsFresh) {
            var cachedMerged = mergeSearchBoardGroups([
                cachedGroups,
                localParts.classified,
                SEARCH_BOARD_GROUPS,
                localParts.generic
            ]);
            if (cachedMerged.length) SEARCH_BOARD_GROUPS = cachedMerged;
            return;
        }

        var searchGroups = [];
        var indexGroups = [];

        try {
            var searchDoc = await fetchBoardDocument("/search.php?mod=forum");
            searchGroups = parseWebsiteSearchBoards(searchDoc);
        } catch (error) {
            console.warn("[98T Search] 读取搜索板块列表失败", error);
        }

        try {
            var indexDoc = await fetchBoardDocument("/forum.php");
            indexGroups = parseWebsiteSearchBoards(indexDoc);
        } catch (error) {
            console.warn("[98T Search] 读取论坛首页板块列表失败", error);
        }

        var indexParts = splitWebsiteBoardGroups(indexGroups);
        var searchParts = splitWebsiteBoardGroups(searchGroups);
        var merged = mergeSearchBoardGroups([
            indexParts.classified,
            searchParts.classified,
            localParts.classified,
            SEARCH_BOARD_GROUPS,
            indexParts.generic,
            searchParts.generic,
            localParts.generic,
            cachedGroups
        ]);
        if (merged.length) SEARCH_BOARD_GROUPS = merged;

        if (cacheEnabled) {
            GM_setValue("bgshSearchBoardsV474", JSON.stringify({
                time: Date.now(),
                groups: SEARCH_BOARD_GROUPS,
                names: SEARCH_BOARD_NAMES,
                count: SEARCH_BOARD_GROUPS.reduce(function(total, group) {
                    return total + group.fids.length;
                }, 0)
            }));
        }
    }

    function normalizeSearchBoardFids(fids) {
        if (!Array.isArray(fids)) return [];
        return Array.from(new Set(fids.map(function(fid) {
            return String(fid || "").trim();
        }).filter(function(fid) {
            return /^\d+$/.test(fid) && parseInt(fid, 10) > 0;
        })));
    }

    function submitWebsiteSearch(query, type, timeVal, sortVal, selectedFids) {
        // 每个板块只保留自己的 fid，不按所在分组扩展或合并选择范围。
        selectedFids = normalizeSearchBoardFids(selectedFids);
        var form = document.createElement("form");
        form.method = "post";
        form.action = baseURL + "/search.php?mod=forum";
        form.style.display = "none";

        var fields = {
            formhash: getFormHash() || SEARCH_FORMHASH || "",
            srchtxt: query,
            searchsubmit: "yes"
        };
        // “网站默认”不附加高级搜索字段，行为与网站顶部普通搜索完全一致。
        if (type === "thread") fields.srchtype = "title";
        if (type === "forum") fields.srchtype = "fulltext";
        // Discuz 普通搜索分支可能忽略 srchfid[]。勾选板块后强制进入
        // 高级标题搜索分支，确保服务器实际应用板块条件。
        if (selectedFids.length && type === "native") fields.srchtype = "title";
        if (timeVal !== "0") fields.srchfrom = timeVal;
        if (sortVal !== "native") fields.orderby = sortVal;

        Object.keys(fields).forEach(function(name) {
            var input = document.createElement("input");
            input.type = "hidden";
            input.name = name;
            input.value = fields[name];
            form.appendChild(input);
        });
        selectedFids.forEach(function(fid) {
            var input = document.createElement("input");
            input.type = "hidden";
            input.name = "srchfid[]";
            input.value = fid;
            form.appendChild(input);
        });
        document.body.appendChild(form);
        form.submit();
    }

    function fillExistingSearchDialog(query, autoExecute) {
        var overlay = document.getElementById("bgshSearchOverlay");
        if (!overlay) return false;
        var input = overlay.querySelector("#bgshSearchInput");
        if (input && query) input.value = String(query).trim();
        if (autoExecute && input && input.value.trim()) {
            var execute = overlay.querySelector("#bgshSearchGoBtn");
            if (execute) setTimeout(function() { execute.click(); }, 0);
        } else if (input) {
            input.focus();
            input.select();
        }
        return true;
    }

    async function showSearchDialog(initialQuery, autoExecute) {
        initialQuery = String(initialQuery || "").trim();
        if (fillExistingSearchDialog(initialQuery, autoExecute)) return;
        await syncSearchBoards();
        if (fillExistingSearchDialog(initialQuery, autoExecute)) return;

        var settings = getSettings();

        // 4.2 首次运行时清除旧版遗留的强制全文/板块条件。
        // 此后用户主动选择的高级条件仍会正常保存。
        if (!GM_getValue("bgshSearchNativeV42", false)) {
            GM_setValue("bgshSearchOpts", JSON.stringify([]));
            GM_setValue("bgshSearchTime", "0");
            GM_setValue("bgshSearchType", "native");
            GM_setValue("bgshSearchSort", "native");
            GM_setValue("bgshSearchNativeV42", true);
        }
        var savedOpts = normalizeSearchBoardFids(getJSONValue("bgshSearchOpts", []));
        // 用 fid 集合作为唯一状态源。即使同一板块同时出现在“常用板块”和
        // 原始分组中，也只同步同一个 fid，不会影响同组内的其他板块。
        var selectedBoardFids = new Set(savedOpts);
        var savedTime = GM_getValue("bgshSearchTime", "0");
        var savedType = GM_getValue("bgshSearchType", "native");
        var savedSort = GM_getValue("bgshSearchSort", settings.searchSort || "native");
        var savedIncludeKeywords = GM_getValue("bgshSearchIncludeKeywords", "");
        var savedExcludeKeywords = GM_getValue("bgshSearchExcludeKeywords", "");
        var boardsCollapsed = GM_getValue("bgshSearchBoardsCollapsed", false) === true;
        var searchHistory = getJSONValue("bgshSearchHistory", []);
        if (!Array.isArray(searchHistory)) searchHistory = [];
        searchHistory = Array.from(new Set(searchHistory.map(function(item) {
            return String(item || "").trim();
        }).filter(Boolean))).slice(0, settings.searchHistoryCount);
        var totalBoardCount = SEARCH_BOARD_GROUPS.reduce(function(total, group) {
            return total + group.fids.length;
        }, 0);
        var commonBoardFids = getCommonBoardFids(12);
        var manualCommonSet = new Set(getManualCommonBoards());

        var overlay = document.createElement("div");
        overlay.id = "bgshSearchOverlay";
        overlay.className = "bgsh-dialog-overlay";

        var historyHtml = '';
        if (searchHistory.length > 0) {
            historyHtml = `
                <div class="bgsh-search-history">
                    <span class="bgsh-search-history-label">🕘 搜索历史</span>
                    <select class="bgsh-search-history-select" id="bgshSearchHistorySelect">
                        <option value="">选择历史关键词…</option>
                        ${searchHistory.map(item => `<option value="${escapeSearchHtml(item)}">${escapeSearchHtml(item)}</option>`).join('')}
                    </select>
                    <button class="history-clear" id="bgshClearHistory">清空</button>
                </div>
            `;
        }

        var html = `
            <div class="bgsh-dialog bgsh-search-dialog">
                <div class="bgsh-dialog-header">
                    <div class="bgsh-dialog-title">
                        🔍 极速搜索 <span class="badge">${scriptVer}</span>
                    </div>
                    <button class="bgsh-dialog-close" id="bgshSearchClose">&times;</button>
                </div>
                <div class="bgsh-dialog-body">
                    <div class="bgsh-search-input-group">
                        <input type="text" class="bgsh-search-input" id="bgshSearchInput" placeholder="输入关键词搜索..."${settings.searchAutoComplete ? ' list="bgshSearchSuggestions"' : ''} autocomplete="off" autofocus>
                        ${settings.searchAutoComplete ? `<datalist id="bgshSearchSuggestions">${searchHistory.map(function(item) { return `<option value="${escapeSearchHtml(item)}"></option>`; }).join('')}</datalist>` : ''}
                        <button class="bgsh-customBtn" id="bgshSearchGoBtn" style="width:auto;padding:0 20px;height:46px;border-radius:10px;">🔍 搜索</button>
                    </div>
                    <div class="bgsh-search-hint">
                        <span>支持 <kbd>Enter</kbd> 快速搜索 · 默认与网站普通搜索完全一致</span>
                        <span>🌐 网站原生结果</span>
                    </div>
                    ${historyHtml}
                    <div class="bgsh-search-filter-grid">
                        <div class="bgsh-search-filter-row"><span class="bgsh-filter-label">📌 类型</span><div class="bgsh-search-filter-options">
                            <label><input type="radio" name="bgshSearchType" value="native" ${savedType==='native'?'checked':''}> 网站默认</label>
                            <label><input type="radio" name="bgshSearchType" value="forum" ${savedType==='forum'?'checked':''}> 全文</label>
                            <label><input type="radio" name="bgshSearchType" value="thread" ${savedType==='thread'?'checked':''}> 标题</label>
                            <label><input type="radio" name="bgshSearchType" value="author" ${savedType==='author'?'checked':''}> 作者</label>
                        </div></div>
                        <div class="bgsh-search-filter-row"><span class="bgsh-filter-label">⏰ 时间</span><div class="bgsh-search-filter-options">
                            <label><input type="radio" name="bgshSearchTime" value="0" ${savedTime==='0'?'checked':''}> 全部</label>
                            <label><input type="radio" name="bgshSearchTime" value="86400" ${savedTime==='86400'?'checked':''}> 今天</label>
                            <label><input type="radio" name="bgshSearchTime" value="604800" ${savedTime==='604800'?'checked':''}> 本周</label>
                            <label><input type="radio" name="bgshSearchTime" value="2592000" ${savedTime==='2592000'?'checked':''}> 本月</label>
                        </div></div>
                        <div class="bgsh-search-filter-row"><span class="bgsh-filter-label">🔢 排序</span><div class="bgsh-search-filter-options">
                            <label><input type="radio" name="bgshSearchSort" value="native"> 网站默认</label>
                            <label><input type="radio" name="bgshSearchSort" value="dateline"> 发布时间</label>
                            <label><input type="radio" name="bgshSearchSort" value="lastpost"> 回复时间</label>
                        </div></div>
                    </div>
                    <div class="bgsh-search-keyword-row">
                        <input type="text" class="bgsh-search-input" id="bgshSearchIncludeKeywords" value="${escapeSearchHtml(savedIncludeKeywords)}" placeholder="必须包含（空格/逗号分词）">
                        <input type="text" class="bgsh-search-input" id="bgshSearchExcludeKeywords" value="${escapeSearchHtml(savedExcludeKeywords)}" placeholder="排除关键词（命中任意词即隐藏）">
                    </div>
                    <div class="bgsh-search-hint" style="margin-top:3px;">
                        <span>🔎 关键词筛选：包含词需全部命中，排除词命中任意一个即隐藏</span>
                    </div>
                    <div class="bgsh-search-boards${boardsCollapsed ? ' collapsed' : ''}" id="bgshSearchBoardsPanel">
                        <div class="bgsh-search-boards-header">
                            <span>📂 搜索板块 <span class="count">(共 <span id="bgshBoardTotal">${totalBoardCount}</span> 个，已选 <span id="bgshSelectedCount">${savedOpts.length}</span> 个)</span></span>
                            <div>
                                <button class="bgsh-customBtn bgsh-search-board-toggle" id="bgshBoardCollapse" style="width:auto;padding:2px 12px;font-size:12px;">${boardsCollapsed ? '▼ 展开' : '▲ 折叠'}</button>
                                <button class="bgsh-customBtn" id="bgshBoardSelectAll" style="width:auto;padding:2px 14px;font-size:12px;">✅ 全选</button>
                                <button class="bgsh-customBtn" id="bgshBoardSelectNone" style="width:auto;padding:2px 14px;font-size:12px;">❌ 清除</button>
                            </div>
                        </div>
                        <div class="bgsh-search-board-groups" id="bgshBoardGroups">
        `;
        if (commonBoardFids.length) {
            html += `<div class="bgsh-search-board-group common"><div class="bgsh-search-board-group-title">⭐ 常用板块</div><div class="bgsh-search-board-items">`;
            for (let commonFid of commonBoardFids) {
                let commonName = escapeSearchHtml(getBoardName(commonFid));
                let commonChecked = selectedBoardFids.has(String(commonFid)) ? ' checked' : '';
                let commonCls = commonChecked ? ' checked' : '';
                let commonStar = manualCommonSet.has(commonFid) ? '★' : '☆';
                let commonStarCls = manualCommonSet.has(commonFid) ? ' active' : '';
                html += `<label class="${commonCls}"><input type="checkbox" class="bgsh-board-cb" value="${commonFid}"${commonChecked}> ${commonName}<span class="bgsh-board-star${commonStarCls}" data-fid="${commonFid}" title="设为常用板块">${commonStar}</span></label>`;
            }
            html += `</div></div>`;
        }
        for (let group of SEARCH_BOARD_GROUPS) {
            html += `<div class="bgsh-search-board-group"><div class="bgsh-search-board-group-title">${escapeSearchHtml(group.label)}</div><div class="bgsh-search-board-items">`;
            for (let fid of group.fids) {
                let fname = escapeSearchHtml(getBoardName(fid));
                let checked = selectedBoardFids.has(String(fid)) ? ' checked' : '';
                let cls = checked ? ' checked' : '';
                let star = manualCommonSet.has(parseInt(fid, 10)) ? '★' : '☆';
                let starCls = manualCommonSet.has(parseInt(fid, 10)) ? ' active' : '';
                html += `<label class="${cls}"><input type="checkbox" class="bgsh-board-cb" value="${fid}"${checked}> ${fname}<span class="bgsh-board-star${starCls}" data-fid="${fid}" title="设为常用板块">${star}</span></label>`;
            }
            html += `</div></div>`;
        }
        html += `
                        </div>
                    </div>
                </div>
                <div class="bgsh-dialog-footer">
                    <button class="bgsh-customBtn" id="bgshSearchCancel" style="width:auto;background:rgba(255,255,255,0.5);color:#666;">取消</button>
                    <button class="bgsh-customBtn" id="bgshSearchExecute" style="width:auto;">🚀 开始搜索</button>
                </div>
            </div>
        `;
        overlay.innerHTML = html;
        document.body.appendChild(overlay);

        const input = document.getElementById("bgshSearchInput");
        if (initialQuery) input.value = initialQuery;

        function updateSelectedCount() {
            let countNode = overlay.querySelector("#bgshSelectedCount");
            if (countNode) countNode.textContent = selectedBoardFids.size;
            overlay.querySelectorAll(".bgsh-board-items label").forEach(lb => {
                let cb = lb.querySelector('input[type="checkbox"]');
                if (cb && cb.checked) lb.classList.add("checked");
                else lb.classList.remove("checked");
            });
        }

        // 历史记录下拉复用：只回填，不立即提交，便于继续修改条件。
        const historySelect = document.getElementById('bgshSearchHistorySelect');
        if (historySelect) {
            historySelect.addEventListener('change', function() {
                if (!this.value) return;
                input.value = this.value;
                this.value = "";
                input.focus();
                input.select();
            });
        }

        // 清空历史
        const clearHistoryBtn = document.getElementById('bgshClearHistory');
        if (clearHistoryBtn) {
            clearHistoryBtn.addEventListener('click', function() {
                GM_setValue('bgshSearchHistory', JSON.stringify([]));
                const historyDiv = document.querySelector('.bgsh-search-history');
                if (historyDiv) historyDiv.remove();
                showToast('🗑️ 搜索历史已清空', 'info');
            });
        }

        const boardCollapseButton = document.getElementById("bgshBoardCollapse");
        const boardPanel = document.getElementById("bgshSearchBoardsPanel");
        if (boardCollapseButton && boardPanel) {
            boardCollapseButton.addEventListener("click", function() {
                var collapsed = boardPanel.classList.toggle("collapsed");
                boardCollapseButton.textContent = collapsed ? "▼ 展开" : "▲ 折叠";
                GM_setValue("bgshSearchBoardsCollapsed", collapsed);
            });
        }

        document.getElementById("bgshBoardSelectAll").addEventListener("click", function() {
            selectedBoardFids.clear();
            overlay.querySelectorAll(".bgsh-board-cb").forEach(function(cb) {
                cb.checked = true;
                selectedBoardFids.add(String(cb.value));
            });
            updateSelectedCount();
        });

        document.getElementById("bgshBoardSelectNone").addEventListener("click", function() {
            selectedBoardFids.clear();
            overlay.querySelectorAll(".bgsh-board-cb").forEach(cb => cb.checked = false);
            updateSelectedCount();
        });

        overlay.addEventListener('change', function(e) {
            if (e.target.classList && e.target.classList.contains('bgsh-board-cb')) {
                var changedFid = e.target.value;
                var changedState = e.target.checked;
                if (changedState) selectedBoardFids.add(changedFid);
                else selectedBoardFids.delete(changedFid);
                overlay.querySelectorAll('.bgsh-board-cb[value="' + changedFid + '"]').forEach(function(cb) {
                    cb.checked = changedState;
                });
                updateSelectedCount();
            }
        });

        overlay.querySelectorAll(".bgsh-board-star").forEach(function(star) {
            star.addEventListener("click", function(e) {
                e.preventDefault();
                e.stopPropagation();
                var fid = parseInt(this.dataset.fid, 10);
                var manual = getManualCommonBoards();
                var index = manual.indexOf(fid);
                if (index === -1) {
                    manual.unshift(fid);
                    showToast("⭐ 已添加，下次打开搜索时显示在顶部", "success", 2200);
                } else {
                    manual.splice(index, 1);
                    showToast("已取消常用板块", "info", 1600);
                }
                GM_setValue("bgshCommonBoardsV47", JSON.stringify(manual));
                var active = index === -1;
                overlay.querySelectorAll('.bgsh-board-star[data-fid="' + fid + '"]').forEach(function(item) {
                    item.textContent = active ? "★" : "☆";
                    item.classList.toggle("active", active);
                });
            });
        });

        // 结果数量默认值
        const sortRadios = document.querySelectorAll('input[name="bgshSearchSort"]');
        sortRadios.forEach(r => { if (r.value === savedSort) r.checked = true; });

        function doSearch() {
            let query = input.value.trim();
            if (!query) {
                input.focus();
                input.style.borderColor = '#ff6b6b';
                setTimeout(() => input.style.borderColor = '', 1000);
                return;
            }

            // 保存搜索历史
            let history = getJSONValue('bgshSearchHistory', []);
            if (!Array.isArray(history)) history = [];
            history = history.filter(item => item !== query);
            history.unshift(query);
            if (history.length > settings.searchHistoryCount) {
                history = history.slice(0, settings.searchHistoryCount);
            }
            GM_setValue('bgshSearchHistory', JSON.stringify(history));

            let type = overlay.querySelector('input[name="bgshSearchType"]:checked').value;
            let timeVal = overlay.querySelector('input[name="bgshSearchTime"]:checked').value;
            let sortVal = overlay.querySelector('input[name="bgshSearchSort"]:checked')?.value || 'native';
            let includeKeywords = overlay.querySelector("#bgshSearchIncludeKeywords").value.trim();
            let excludeKeywords = overlay.querySelector("#bgshSearchExcludeKeywords").value.trim();
            // 提交时以当前界面实际勾选状态为准，不读取分组 fid、历史集合，
            // 也不额外附加任何板块（包括求片问答区）。
            let selectedFids = normalizeSearchBoardFids(
                Array.from(overlay.querySelectorAll(".bgsh-board-cb:checked")).map(function(cb) {
                    return cb.value;
                })
            );

            GM_setValue("bgshSearchOpts", JSON.stringify(selectedFids));
            recordCommonBoardUsage(selectedFids);
            GM_setValue("bgshSearchTime", timeVal);
            GM_setValue("bgshSearchType", type);
            GM_setValue("bgshSearchSort", sortVal);
            GM_setValue("bgshSearchIncludeKeywords", includeKeywords);
            GM_setValue("bgshSearchExcludeKeywords", excludeKeywords);

            if (type === "author") {
                window.open(baseURL + "/home.php?mod=space&username=" + encodeURIComponent(query) + "&do=thread&view=me&type=thread&from=space", "_blank");
                overlay.remove();
                return;
            }

            showToast("🔍 正在搜索: " + query, "info", 2000);
            overlay.remove();
            setTimeout(function() {
                submitWebsiteSearch(query, type, timeVal, sortVal, selectedFids);
            }, 120);
        }

        document.getElementById("bgshSearchGoBtn").addEventListener("click", doSearch);
        document.getElementById("bgshSearchExecute").addEventListener("click", doSearch);
        overlay.querySelectorAll("#bgshSearchInput, #bgshSearchIncludeKeywords, #bgshSearchExcludeKeywords").forEach(function(field) {
            field.addEventListener("keydown", function(event) {
                if (event.key === "Enter") {
                    event.preventDefault();
                    doSearch();
                }
            });
        });
        document.getElementById("bgshSearchClose").addEventListener("click", () => overlay.remove());
        document.getElementById("bgshSearchCancel").addEventListener("click", () => overlay.remove());

        overlay.addEventListener("click", function(e) {
            if (e.target === overlay) overlay.remove();
        });

        setTimeout(function() {
            updateSelectedCount();
            if (autoExecute && input.value.trim()) doSearch();
            else {
                input.focus();
                if (initialQuery) input.select();
            }
        }, 150);
    }

    function setupSearchHotKeys() {
        if (window.__bgshSearchHotKeysBound) return;
        window.__bgshSearchHotKeysBound = true;
        document.addEventListener("keydown", function(event) {
            if (event.key === "Escape") {
                var overlay = document.getElementById("bgshSearchOverlay");
                if (overlay) overlay.remove();
                return;
            }
            if (!GM_getValue("searchHotKeys", true)) return;
            if (event.ctrlKey && event.shiftKey && String(event.key).toLowerCase() === "f") {
                event.preventDefault();
                showSearchDialog();
            }
        });
    }

    // 搜索缓存清理（每天自动清理一次过期缓存）
    function cleanSearchCache() {
        const keys = typeof GM_listValues === "function" ? GM_listValues() : [];
        const now = Date.now();
        let cleaned = 0;
        keys.forEach(key => {
            if (key.startsWith('bgsh_cache_') && key.endsWith('_time')) {
                const time = GM_getValue(key, 0);
                if (now - time > 86400000) { // 24小时过期
                    const cacheKey = key.replace('_time', '');
                    GM_deleteValue(cacheKey);
                    GM_deleteValue(key);
                    cleaned++;
                }
            }
        });
        if (cleaned > 0) {
            console.log('[98T] 清理了 ' + cleaned + ' 条搜索缓存');
        }
    }

    // 定期清理缓存
    setInterval(cleanSearchCache, 3600000); // 每小时检查一次

    function parseSearchFilterKeywords(value) {
        return Array.from(new Set(
            String(value || "")
                .split(/[\s,，;；]+/)
                .map(function(keyword) { return keyword.trim().toLowerCase(); })
                .filter(Boolean)
        ));
    }

    function normalizeSearchBoardLabel(value) {
        return cleanBoardName(value)
            .replace(/^(?:板块|版块|论坛|来自)\s*[:：]?\s*/i, "")
            .replace(/^[\[【（(]+|[\]】）)]+$/g, "")
            .replace(/\s+/g, "")
            .toLowerCase();
    }

    function buildSearchBoardNameLookup() {
        var lookup = new Map();
        SEARCH_BOARD_GROUPS.forEach(function(group) {
            (group.fids || []).forEach(function(fid) {
                var normalizedName = normalizeSearchBoardLabel(getBoardName(fid));
                if (!normalizedName || /^fid=\d+$/.test(normalizedName)) return;
                if (!lookup.has(normalizedName)) lookup.set(normalizedName, new Set());
                lookup.get(normalizedName).add(String(fid));
            });
        });
        return lookup;
    }

    function resolveSearchResultBoardFid(item, boardNameLookup) {
        // 链接中的 fid 是唯一可靠来源，优先直接读取。
        var boardLinks = Array.from(item.querySelectorAll(
            'a[href*="mod=forumdisplay"], a[href*="fid="], ' +
            'a[href*="/forum-"], a[href^="forum-"]'
        ));
        for (var i = 0; i < boardLinks.length; i++) {
            var directFid = extractBoardFid(
                boardLinks[i].getAttribute("href") || boardLinks[i].href
            );
            if (directFid) return String(directFid);
        }

        // 某些搜索模板不在链接中带 fid，此时只精确匹配“板块标签”自身的文字。
        // 不再扫描整条帖子的文本，避免其他板块名、导航文字造成错误联动。
        var labelNodes = boardLinks.concat(Array.from(item.querySelectorAll(
            '.forumname, .boardname, [class~="forum-name"], [class~="board-name"]'
        )));
        for (var j = 0; j < labelNodes.length; j++) {
            var normalizedLabel = normalizeSearchBoardLabel(labelNodes[j].textContent);
            var matchingFids = boardNameLookup.get(normalizedLabel);
            if (matchingFids && matchingFids.size === 1) {
                return matchingFids.values().next().value;
            }
        }
        return "";
    }

    function filterSearchResults() {
        if (!window.location.href.match(/search\.php.*(?:searchid|srchtxt|mod=forum)/)) return;

        var savedOpts = [];
        try {
            savedOpts = normalizeSearchBoardFids(
                JSON.parse(GM_getValue("bgshSearchOpts", "[]")) || []
            );
        } catch (error) {}
        var selectedBoardFidSet = new Set(savedOpts);
        var boardNameLookup = buildSearchBoardNameLookup();
        var includeKeywords = parseSearchFilterKeywords(
            GM_getValue("bgshSearchIncludeKeywords", "")
        );
        var excludeKeywords = parseSearchFilterKeywords(
            GM_getValue("bgshSearchExcludeKeywords", "")
        );
        if (savedOpts.length === 0 && includeKeywords.length === 0 && excludeKeywords.length === 0) return;

        function hideNonMatching() {
            var items = document.querySelectorAll(
                'ul.searchresult > li, .forumcontrol + table tr, #threadlist tr, ' +
                'div.threadlist > table > tbody > tr, .tl .bm_c li'
            );

            if (items.length === 0) {
                items = document.querySelectorAll('li.pbw, .threadlist tr, table.threadlist tr, [id^="thread_"]');
            }

            var hiddenCount = 0;

            items.forEach(function(item) {
                if (item.style.display === 'none') return;
                if (item.tagName === 'TR' && item.querySelector('th')) {
                    var headerText = item.textContent.trim();
                    if (headerText.indexOf('标题') >= 0 || headerText.indexOf('作者') >= 0) return;
                }

                var normalizedText = String(item.textContent || "").toLowerCase();
                var missingRequired = includeKeywords.some(function(keyword) {
                    return normalizedText.indexOf(keyword) === -1;
                });
                var containsExcluded = excludeKeywords.some(function(keyword) {
                    return normalizedText.indexOf(keyword) !== -1;
                });
                if (missingRequired || containsExcluded) {
                    item.style.display = 'none';
                    item.dataset.bgshKeywordFiltered = "1";
                    hiddenCount++;
                    return;
                }

                if (selectedBoardFidSet.size === 0) return;

                var resultBoardFid = resolveSearchResultBoardFid(item, boardNameLookup);
                if (resultBoardFid && !selectedBoardFidSet.has(resultBoardFid)) {
                    item.style.display = 'none';
                    item.dataset.bgshBoardFiltered = "1";
                    hiddenCount++;
                }
            });

            if (hiddenCount > 0) {
                console.log("[98T Filter] 已按板块/关键词隐藏 " + hiddenCount + " 个搜索结果");
            }
        }

        setTimeout(hideNonMatching, 300);

        var observer = new MutationObserver(function(mutations) {
            var hasRelevantChanges = mutations.some(function(m) {
                return m.type === 'childList' && m.addedNodes.length > 0;
            });
            if (hasRelevantChanges) {
                clearTimeout(window._98tFilterTimer);
                window._98tFilterTimer = setTimeout(hideNonMatching, 200);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        window.addEventListener('load', function() {
            setTimeout(hideNonMatching, 500);
        });
    }
    // #endregion

    // #region ROG 划词搜索
    function setupSelectionSearch(settings) {
        if (window.__bgshSelectionSearchBound || !settings.defaultSwipeToSearch) return;
        window.__bgshSelectionSearchBound = true;
        document.addEventListener("mouseup", selectSearch);
        document.addEventListener("pointerdown", function(event) {
            if (!event.target.closest || !event.target.closest(".bgsh-sav-menu")) removeSearchMenu();
        });
        window.addEventListener("blur", removeSearchMenu);
    }

    function selectSearch(e) {
        const LEFT_MOUSE_BUTTON = 0;
        const MIN_TEXT_LENGTH = 2;

        if (e.button !== LEFT_MOUSE_BUTTON) return;
        if (e.target.closest && e.target.closest(".bgsh-sav-menu, input, textarea, select, [contenteditable='true']")) return;

        const selection = window.getSelection();
        const selectedText = selection ? selection.toString().trim().slice(0, 200) : "";

        if (selectedText.length < MIN_TEXT_LENGTH) {
            removeSearchMenu();
            return;
        }

        removeSearchMenu();
        const searchPopup = createSearchPopup(selectedText);
        var rangeRect = null;
        try {
            if (selection.rangeCount) rangeRect = selection.getRangeAt(0).getBoundingClientRect();
        } catch (error) {}
        var anchorX = rangeRect && rangeRect.width ? rangeRect.left + rangeRect.width / 2 : e.clientX;
        var anchorY = rangeRect && rangeRect.height ? rangeRect.bottom : e.clientY;
        displaySearchPopup(anchorX, anchorY, searchPopup);
    }

    function removeSearchMenu() {
        const searchMenu = document.querySelector(".bgsh-sav-menu");
        if (searchMenu) searchMenu.remove();
    }

    function displaySearchPopup(x, y, element) {
        Object.assign(element.style, {
            position: "fixed",
            visibility: "hidden",
            zIndex: "100000"
        });
        document.body.appendChild(element);
        const rect = element.getBoundingClientRect();
        var left = Math.max(8, Math.min(window.innerWidth - rect.width - 8, x - rect.width / 2));
        var top = y + 8;
        if (top + rect.height > window.innerHeight - 8) top = Math.max(8, y - rect.height - 8);
        Object.assign(element.style, {
            left: left + "px",
            top: top + "px",
            visibility: "visible"
        });
    }

    function createSearchPopup(selectedText) {
        const button = document.createElement("button");
        button.classList.add("bgsh-sav-menu", "bgsh-searchBtn");
        button.setAttribute("type", "button");

        button.dataset.query = selectedText;
        button.textContent = "🔍 ROG 搜索";
        button.title = "搜索选中文字：“" + selectedText + "”";
        Object.assign(button.style, {
            width: "auto",
            minWidth: "0",
            maxWidth: "150px",
            margin: "0",
            padding: "6px 10px",
            border: "1px solid rgba(255,106,0,.58)",
            borderRadius: "9px",
            color: "#fff",
            background: "linear-gradient(135deg,#ff6a00,#ff9d00)",
            boxShadow: "0 5px 18px rgba(255,106,0,.32)",
            fontSize: "12px",
            fontWeight: "800",
            whiteSpace: "nowrap",
            cursor: "pointer"
        });
        button.addEventListener("click", handleSearchPopupClick);
        return button;
    }

    function handleSearchPopupClick(e) {
        e.preventDefault();
        e.stopPropagation();
        var button = e.currentTarget;
        var query = String(button.dataset.query || "").trim();
        removeSearchMenu();
        if (query) showSearchDialog(query, true);
    }

    function searchSehuatang(query) {
        const formhash = getFormHash();
        const openSearch = () => window.open(`${baseURL}/search.php`, "_blank");

        if (!formhash) {
            copyToClipboard(query).then(openSearch);
            return;
        }

        const formDataString = `formhash=${encodeURIComponent(formhash)}&srchtxt=${encodeURIComponent(query)}&searchsubmit=yes`;

        GM_xmlhttpRequest({
            method: "POST",
            url: `${baseURL}/search.php?mod=forum`,
            data: formDataString,
            redirect: "manual",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Origin: baseURL,
                Referer: baseURL,
            },
            onload: function(response) {
                if (response.status === 301 || response.status === 302) {
                    var headers = response.responseHeaders.split("\n");
                    var locationHeader = headers.find((header) => header.toLowerCase().startsWith("location:"));
                    if (locationHeader) {
                        var location = locationHeader.split(":")[1].trim();
                        window.open(`${baseURL}/${location}`, "_blank");
                    }
                } else {
                    if (response.finalUrl && response.finalUrl.includes("searchmd5")) {
                        showToast("⚠️ 划词搜索需要 Tampermonkey BETA 版本", "warning");
                        return;
                    }
                    var htmlString = response.responseText;
                    var parser = new DOMParser();
                    var doc = parser.parseFromString(htmlString, "text/html");
                    var messagetextElement = doc.getElementById("messagetext");
                    if (messagetextElement) {
                        var firstPElement = messagetextElement.querySelector("p");
                        if (firstPElement) {
                            showToast(firstPElement.textContent, "warning");
                            return;
                        }
                    }
                }
            },
            onerror: function(error) {
                console.error("GM_xmlhttpRequest error:", error);
                showToast("❌ 搜索请求失败", "error");
            },
        });
    }
    // #endregion

    // #region 无缝翻页 (4.1.1 - 防重复加载与内容去重)
    function initInfiniteScroll(pageName) {
        let isLoading = false;
        let noMoreData = false;
        let pendingLoadTimer = null;
        let mutationCheckTimer = null;
        let nextPageUrl = "";
        let loadedPageCount = 1;
        let pageObserver = null;
        const requestedUrls = new Set();
        const appendedItemKeys = new Set();
        const settings = getSettings();

        const isSearchPage = pageName === "isSearchPage" || /search\.php/.test(window.location.href);

        if (!settings.autoPagination) {
            preserveNativePaginationSort();
            console.log("[98T] 自动翻页已关闭");
            return;
        }

        // 同一页面只允许初始化一个滚动监听器，避免多个实例同时翻页。
        if (document.documentElement.dataset.bgshInfiniteScroll === "1") {
            console.log("[98T] 无限滚动已初始化，跳过重复启动");
            return;
        }
        document.documentElement.dataset.bgshInfiniteScroll = "1";

        const loadSentinel = document.createElement("div");
        loadSentinel.id = "bgshInfiniteScrollSentinel";
        loadSentinel.style.cssText = "clear:both;text-align:center;padding:18px 10px;min-height:44px;";
        const loadMoreButton = document.createElement("button");
        loadMoreButton.type = "button";
        loadMoreButton.className = "bgsh-customBtn";
        loadMoreButton.style.cssText = "width:auto;min-width:180px;padding:8px 20px;";
        loadMoreButton.textContent = "继续加载下一页";
        loadSentinel.appendChild(loadMoreButton);
        document.body.appendChild(loadSentinel);

        function setLoadState(text, disabled) {
            loadMoreButton.textContent = text;
            loadMoreButton.disabled = !!disabled;
            loadMoreButton.style.opacity = disabled ? "0.7" : "1";
        }

        function normalizePageUrl(href) {
            if (!href || /^javascript:/i.test(href)) return "";
            try {
                return new URL(href, location.href).href;
            } catch (error) {
                return "";
            }
        }

        function getPageNumber(url) {
            try {
                const parsed = new URL(url, location.href);
                const queryPage = parseInt(parsed.searchParams.get("page") || "1", 10);
                if (queryPage > 0) return queryPage;
                const pathMatch = parsed.pathname.match(/-(\d+)\.html$/);
                return pathMatch ? parseInt(pathMatch[1], 10) : 1;
            } catch (error) {
                return 1;
            }
        }

        function findNextPageUrl(root) {
            const explicit = root.querySelector(".pg .nxt, a.nxt, a[rel='next']");
            if (explicit) {
                const explicitUrl = normalizePageUrl(explicit.getAttribute("href"));
                if (explicitUrl && !requestedUrls.has(explicitUrl)) return explicitUrl;
            }

            // 后段分页没有“下一页”按钮时，从数字页码中选择最近的未访问页。
            const currentPage = Math.max(
                getPageNumber(location.href),
                ...Array.from(requestedUrls).map(getPageNumber)
            );
            const candidates = Array.from(root.querySelectorAll(".pg a[href]"))
                .map(function(link) { return normalizePageUrl(link.getAttribute("href")); })
                .filter(function(url) {
                    return url && !requestedUrls.has(url) && getPageNumber(url) > currentPage;
                })
                .sort(function(a, b) { return getPageNumber(a) - getPageNumber(b); });
            return candidates[0] || "";
        }

        function getNextLink() {
            if (nextPageUrl && !requestedUrls.has(nextPageUrl)) return nextPageUrl;
            return findNextPageUrl(document);
        }

        function preserveCurrentSort(urlValue) {
            if (!urlValue) return "";
            if (isSearchPage) return urlValue;
            try {
                const target = new URL(urlValue, location.href);
                const current = new URL(location.href);
                // 排序字段必须覆盖下一页链接中可能存在的网站默认值，
                // 不能只在参数缺失时补充，否则会混用 dateline/lastpost。
                // 兜底值取用户设置的板块默认排序；用户没设时按脚本默认「发布时间」，
                // 避免自动翻页时退回网站原生的回复时间排序。
                var fallbackOrder = GM_getValue("forumDefaultSort", "dateline");
                if (fallbackOrder !== "dateline" && fallbackOrder !== "lastpost") fallbackOrder = "dateline";
                target.searchParams.set(
                    "orderby",
                    current.searchParams.get("orderby") || fallbackOrder
                );
                target.searchParams.set(
                    "ascdesc",
                    current.searchParams.get("ascdesc") || "desc"
                );
                [
                    "filter", "dateline", "specialtype", "typeid", "digest", "recommend"
                ].forEach(function(name) {
                    const value = current.searchParams.get(name);
                    if (value !== null) {
                        target.searchParams.set(name, value);
                    }
                });
                return target.href;
            } catch (error) {
                return urlValue;
            }
        }

        function getItemKey(item) {
            if (!item || item.nodeType !== 1) return "";

            const identified = item.matches('[id^="normalthread_"], [id^="stickthread_"], [id^="thread_"], [id^="post_"], [id^="favorite_"]')
                ? item
                : item.querySelector('[id^="normalthread_"], [id^="stickthread_"], [id^="thread_"], [id^="post_"], [id^="favorite_"]');
            if (identified && identified.id) return "id:" + identified.id;

            const link = item.querySelector('a[href*="thread-"], a[href*="tid="], a[href*="pid="]');
            if (link) {
                const href = link.getAttribute("href") || "";
                const match = href.match(/thread-(\d+)|[?&]tid=(\d+)|[?&]pid=(\d+)/);
                if (match) return "topic:" + (match[1] || match[2] || match[3]);
            }
            return "";
        }

        function rememberExistingItems(container) {
            if (!container) return;
            Array.from(container.children).forEach(function(item) {
                const key = getItemKey(item);
                if (key) appendedItemKeys.add(key);
            });
        }

        function getContentContainer() {
            if (isSearchPage) {
                let container = document.querySelector("ul.searchresult");
                if (container && container.children.length > 0) return container;

                container = document.querySelector(".searchresult");
                if (container && container.children.length > 0) return container;

                const tl = document.querySelector(".tl, .bm_c");
                if (tl) {
                    const newContainer = document.createElement("ul");
                    newContainer.className = "searchresult";

                    const items = tl.querySelectorAll("li.pbw, li.pbo, li");
                    if (items.length > 0) {
                        items.forEach(item => {
                            newContainer.appendChild(item.cloneNode(true));
                            item.remove();
                        });
                        tl.parentNode.insertBefore(newContainer, tl);
                        tl.remove();
                        return newContainer;
                    }
                }

                const mainArea = document.querySelector(".bm, .main, #wrap");
                if (mainArea) {
                    const newContainer = document.createElement("ul");
                    newContainer.className = "searchresult";
                    mainArea.appendChild(newContainer);
                    return newContainer;
                }
                return null;
            } else {
                // 板块页必须追加到主题表格，而不是追加整个 #threadlist 外层。
                if (pageName === "isForumDisplayPage") {
                    // 板块页只给「主题表格」，不能给 #threadlist 外壳，
                    // 否则整块表头/筛选条会被重复追加一遍。
                    return getThreadListTable(document);
                }
                let selector = "#threadlist";
                if (pageName === "isPostPage") selector = "#postlist";
                if (pageName === "isSpacePage" || pageName === "isMySpacePage") selector = "#delform, #threadlist";
                if (pageName === "isMyfavoritePage") selector = "#favorite_ul";
                if (pageName === "isShowdarkroomPage") selector = "#darkroomtable";
                return document.querySelector(selector);
            }
        }

        function extractNewContent(html) {
            const div = document.createElement("div");
            div.innerHTML = html;

            if (isSearchPage) {
                let items = [];

                let lis = div.querySelectorAll("li.pbw");
                if (lis.length > 0) {
                    lis.forEach(el => items.push(el));
                }

                if (items.length === 0) {
                    lis = div.querySelectorAll("li.pbo");
                    lis.forEach(el => items.push(el));
                }

                if (items.length === 0) {
                    const ul = div.querySelector("ul.searchresult");
                    if (ul) {
                        lis = ul.querySelectorAll("li");
                        lis.forEach(el => items.push(el));
                    }
                }

                if (items.length === 0) {
                    const result = div.querySelector(".searchresult");
                    if (result) {
                        const children = result.children;
                        for (let i = 0; i < children.length; i++) {
                            items.push(children[i]);
                        }
                    }
                }

                if (items.length === 0) {
                    const container = div.querySelector(".tl, .bm_c");
                    if (container) {
                        lis = container.querySelectorAll("li.pbw, li.pbo, li");
                        lis.forEach(el => {
                            const text = el.textContent.trim();
                            if (text.indexOf('标题') >= 0 && text.indexOf('作者') >= 0) return;
                            if (text.indexOf('回复') >= 0 && text.indexOf('查看') >= 0) return;
                            items.push(el);
                        });
                    }
                }

                if (items.length > 0) {
                    const wrapper = document.createElement("div");
                    wrapper.className = "searchresult-items";
                    items.forEach(item => {
                        wrapper.appendChild(item.cloneNode(true));
                    });
                    return wrapper;
                }
                return null;
            } else {
                if (pageName === "isForumDisplayPage") {
                    var sourceTable = getThreadListTable(div);
                    var threadBodies = div.querySelectorAll(THREAD_LIST_BODY_SELECTOR);
                    if (threadBodies.length) {
                        var bodyWrapper = document.createElement("div");
                        threadBodies.forEach(function(tbody) {
                            bodyWrapper.appendChild(tbody.cloneNode(true));
                        });
                        return bodyWrapper;
                    }
                    return sourceTable;
                }
                let selector = "#threadlist";
                if (pageName === "isPostPage") selector = "#postlist";
                if (pageName === "isSpacePage" || pageName === "isMySpacePage") selector = "#delform, #threadlist";
                if (pageName === "isMyfavoritePage") selector = "#favorite_ul";
                if (pageName === "isShowdarkroomPage") selector = "#darkroomtable";
                return div.querySelector(selector);
            }
        }

        function appendContent(container, newContent) {
            if (!container || !newContent) return false;

            rememberExistingItems(container);
            const children = Array.from(newContent.children);
            if (children.length === 0) return false;

            let addedCount = 0;
            for (let i = 0; i < children.length; i++) {
                const key = getItemKey(children[i]);
                if (key && appendedItemKeys.has(key)) {
                    console.log("[98T] 跳过重复内容:", key);
                    continue;
                }
                const clone = children[i].cloneNode(true);
                if (clone.tagName === 'TR' && clone.querySelector('th')) {
                    continue;
                }
                if (pageName === "isPostPage") {
                    preparePostImagesForLazyLoad(clone, true);
                }
                container.appendChild(clone);
                if (key) appendedItemKeys.add(key);
                addedCount++;
            }

            return addedCount > 0;
        }

        function parseForumDate(value) {
            var text = String(value || "").trim();
            if (!text) return NaN;
            var now = new Date();
            var relative = text.match(/(\d+)\s*(秒|分钟|小时|天)前/);
            if (relative) {
                var unitMs = relative[2] === "秒" ? 1000 :
                    relative[2] === "分钟" ? 60000 :
                    relative[2] === "小时" ? 3600000 : 86400000;
                return Date.now() - parseInt(relative[1], 10) * unitMs;
            }
            if (/刚刚/.test(text)) return Date.now();
            var clock = text.match(/(今天|昨天|前天)\s*(\d{1,2}):(\d{2})/);
            if (clock) {
                var offset = clock[1] === "今天" ? 0 : clock[1] === "昨天" ? 1 : 2;
                return new Date(
                    now.getFullYear(), now.getMonth(), now.getDate() - offset,
                    parseInt(clock[2], 10), parseInt(clock[3], 10), 0
                ).getTime();
            }
            var normalized = text
                .replace(/[年\/]/g, "-")
                .replace(/月/g, "-")
                .replace(/日/g, " ")
                .replace(/\./g, "-")
                .replace(/\s+/g, " ")
                .trim();
            var timestamp = Date.parse(normalized);
            return Number.isFinite(timestamp) ? timestamp : NaN;
        }

        function getThreadSortTime(tbody, orderby) {
            var cells = tbody.querySelectorAll("td.by");
            if (!cells.length) return NaN;

            // 按发布时间排序时，强制从第一个 td.by（作者/发表时间栏）里的时间标签读取，
            // 不复用最后回复时间的取值逻辑，避免把回复时间当成发布时间。
            if (orderby === "dateline") {
                var publishCell = cells[0];
                if (!publishCell) return NaN;
                // 优先匹配带 title 的时间 span（Discuz 原生"发表时间"标签），
                // 其次是 time[datetime]、em 内的日期文本，最后兜底整格文字。
                var publishNode = publishCell.querySelector(
                    "span[title][id*='authorposton'], span[title][class*='time'], " +
                    "span[title], time[datetime], em span, em, time"
                );
                if (!publishNode) return NaN;
                var publishValue = publishNode.getAttribute("title") ||
                    publishNode.getAttribute("datetime") ||
                    publishNode.textContent;
                // 统一转成标准时间戳后返回
                return parseForumDate(publishValue);
            }

            // 回复时间排序：取最后一个 td.by
            var replyCell = cells[cells.length - 1];
            if (!replyCell) return NaN;
            var replyNode = replyCell.querySelector("span[title], time[datetime], em span, em, time");
            if (!replyNode) return NaN;
            var replyValue = replyNode.getAttribute("title") ||
                replyNode.getAttribute("datetime") ||
                replyNode.textContent;
            return parseForumDate(replyValue);
        }

        function enforceForumThreadOrder(container) {
            if (pageName !== "isForumDisplayPage" || !container) return;
            var currentURL = new URL(location.href);
            var orderby = currentURL.searchParams.get("orderby") || "lastpost";
            if (orderby !== "dateline" && orderby !== "lastpost") return;
            var direction = currentURL.searchParams.get("ascdesc") === "asc" ? 1 : -1;
            var rows = Array.from(container.children).filter(function(child) {
                return child.id && child.id.indexOf("normalthread_") === 0;
            });
            if (rows.length < 2) return;

            var decorated = rows.map(function(row, index) {
                return { row: row, index: index, time: getThreadSortTime(row, orderby) };
            });
            var validCount = decorated.filter(function(item) {
                return Number.isFinite(item.time);
            }).length;
            if (validCount < 2) return;

            // 时间戳统一转成标准数值后做降序（或升序）排列
            decorated.sort(function(a, b) {
                var aValid = Number.isFinite(a.time);
                var bValid = Number.isFinite(b.time);
                if (aValid && bValid && a.time !== b.time) {
                    return direction * (a.time - b.time);
                }
                if (aValid !== bValid) return aValid ? -1 : 1;
                return a.index - b.index;
            });

            // 排序后校验：确保有效时间的行严格按方向排列，无效时间的行保持原相对顺序
            var lastValidTime = null;
            var lastValidIndex = -1;
            var sortedOk = true;
            for (var i = 0; i < decorated.length; i++) {
                var t = decorated[i].time;
                if (!Number.isFinite(t)) continue;
                if (lastValidTime !== null) {
                    if (direction < 0 && t > lastValidTime) { sortedOk = false; break; }
                    if (direction > 0 && t < lastValidTime) { sortedOk = false; break; }
                }
                lastValidTime = t;
                lastValidIndex = i;
            }
            if (!sortedOk) {
                // 校验不通过时重新做一次稳定排序，确保最新发布的排在最前面
                decorated.sort(function(a, b) {
                    var aValid = Number.isFinite(a.time);
                    var bValid = Number.isFinite(b.time);
                    if (aValid && bValid) return direction * (a.time - b.time) || (a.index - b.index);
                    if (aValid !== bValid) return aValid ? -1 : 1;
                    return a.index - b.index;
                });
            }

            // 使用占位符只交换普通主题行，广告、分隔行和置顶主题保持原位。
            var placeholders = rows.map(function(row) {
                var marker = document.createComment("bgsh-thread-order");
                container.insertBefore(marker, row);
                row.remove();
                return marker;
            });
            decorated.forEach(function(item, index) {
                placeholders[index].replaceWith(item.row);
            });
        }

        function updatePagination(newHtml) {
            const div = document.createElement("div");
            div.innerHTML = newHtml;
            const newPgs = div.querySelectorAll(".pg");
            nextPageUrl = findNextPageUrl(div);

            if (!newPgs.length) return;
            const currentPgs = document.querySelectorAll(".pg");
            currentPgs.forEach(function(currentPg, index) {
                const source = newPgs[Math.min(index, newPgs.length - 1)];
                currentPg.innerHTML = source.innerHTML;
            });
        }

        async function loadNextPage() {
            if (pendingLoadTimer) {
                clearTimeout(pendingLoadTimer);
                pendingLoadTimer = null;
            }

            const url = preserveCurrentSort(getNextLink());
            if (!url || noMoreData) {
                if (!noMoreData) {
                    showToast("ℹ️ 已经是全部数据了", "info");
                    noMoreData = true;
                }
                setLoadState("✅ 已加载全部 " + loadedPageCount + " 页", true);
                if (pageObserver) pageObserver.disconnect();
                return;
            }

            if (isLoading || requestedUrls.has(url)) return;
            isLoading = true;
            let skipEmptyPage = false;
            requestedUrls.add(url);
            setLoadState("⏳ 正在加载第 " + (loadedPageCount + 1) + " 页...", true);
            console.log("[98T] 加载下一页:", url);

            try {
                const response = await fetch(url, { credentials: "include" });
                if (!response.ok) throw new Error("HTTP " + response.status);
                const html = await response.text();

                updatePagination(html);

                const newContent = extractNewContent(html);
                if (!newContent || newContent.children.length === 0) {
                    // 不设置固定空页上限：只要网站仍提供未访问的下一页就继续。
                    if (nextPageUrl && !requestedUrls.has(nextPageUrl)) {
                        console.log("[98T] 当前页无可追加内容，自动尝试下一页");
                        skipEmptyPage = true;
                    } else {
                        console.log("[98T] 没有新内容");
                        noMoreData = true;
                        setLoadState("✅ 已加载全部 " + loadedPageCount + " 页", true);
                    }
                    return;
                }

                let container = getContentContainer();
                if (!container) {
                    console.log("[98T] 找不到容器，创建新容器");
                    container = document.createElement("ul");
                    container.className = "searchresult";
                    const mainArea = document.querySelector(".bm, .main, #wrap");
                    if (mainArea) {
                        mainArea.appendChild(container);
                    } else {
                        document.body.appendChild(container);
                    }
                }

                const added = appendContent(container, newContent);
                if (added) {
                    loadedPageCount++;
                    console.log("[98T] 追加了", newContent.children.length, "个项目");
                    // 网站各页使用同一排序参数后，严格按返回顺序追加。
                    // 不再进行客户端日期解析和重排，避免相对时间解析造成错序。
                    setLoadState("继续加载第 " + (loadedPageCount + 1) + " 页", false);
                    const newSettings = getSettings();
                    await processPageContentBasedOnSettings(pageName, newSettings);
                    blockContentByUsers(newSettings);
                } else {
                    // 置顶帖或重复帖可能占满一页，不能因此提前结束整个搜索。
                    if (nextPageUrl && !requestedUrls.has(nextPageUrl)) {
                        console.log("[98T] 当前页内容均已存在，自动跳到下一页");
                        skipEmptyPage = true;
                    } else {
                        console.log("[98T] 没有可追加的新内容");
                        noMoreData = true;
                        setLoadState("✅ 已加载全部 " + loadedPageCount + " 页", true);
                    }
                }

            } catch (error) {
                requestedUrls.delete(url);
                console.error("[98T] 加载失败:", error);
                showToast("❌ 加载下一页失败", "error");
                setLoadState("⚠️ 加载失败，点击重试", false);
            } finally {
                isLoading = false;
                if (skipEmptyPage && !noMoreData) {
                    setTimeout(loadNextPage, 120);
                } else {
                    checkAndLoad();
                }
            }
        }

        function checkAndLoad() {
            if (noMoreData || isLoading) return;

            const bodyHeight = Math.max(
                document.body.scrollHeight,
                document.documentElement.scrollHeight
            );
            const windowHeight = window.innerHeight;
            const scrollPosition = windowHeight + window.scrollY;

            if (bodyHeight <= windowHeight + 200 || scrollPosition >= bodyHeight - 900) {
                if (pendingLoadTimer) return;
                pendingLoadTimer = setTimeout(function() {
                    pendingLoadTimer = null;
                    loadNextPage();
                }, 500);
            }
        }

        async function processPageContentBasedOnSettings(pageName, settings) {
            if (pageName == "isSearchPage" || /search\.php/.test(window.location.href)) {
                displayAdvanThreadImages(settings);
                filterSearchResults();
                await displayThreadBuyInfo(settings);
            } else if (pageName == "isForumDisplayPage") {
                if (settings.enableTitleStyle) stylePosts(settings);
                const currentURL = window.location.href;
                const queryParams = getQueryParams(currentURL);
                const fid = queryParams.fid;
                if (fid == 143 || fid == "143") {
                    blockingResolvedAction(settings);
                    isOnlyShowMoneyAction(settings);
                }
                await displayThreadBuyInfo(settings);
                displayThreadImages(settings);
            } else if (pageName == "isPostPage") {
                replacePMonPost();
                appendTitleFromHotImage();
                appendBuyNumber();
                showAvatarEvent();
                const userid = getUserId();
                if (userid) addQuickActionToPostButton();
                manipulateMedals(settings);
            } else if (pageName == "isMySpacePage" || pageName == "isSpacePage") {
                await displayThreadBuyInfoOther(settings);
                // 空间帖子列表自动加载下一页后，新插入的行也要补图片预览，
                // 否则只有首屏有图（板块列表一直是这么做的）。
                displayAdvanThreadImages(settings);
            }
        }

        // 搜索页启用反爬兼容模式：
        // 不使用后台 fetch 连续抓取，点击后按网站原生方式打开下一页。
        // 每一页重新由网站完整渲染，可避免第二页后被站点拦截。
        if (isSearchPage) {
            const nativeNextUrl = getNextLink();
            if (nativeNextUrl) {
                setLoadState("下一页（网站原生加载）", false);
                loadMoreButton.addEventListener("click", function() {
                    const url = getNextLink();
                    if (!url) {
                        setLoadState("✅ 已经是最后一页", true);
                        return;
                    }
                    setLoadState("⏳ 正在打开网站下一页...", true);
                    window.location.assign(url);
                });
            } else {
                setLoadState("✅ 已经是最后一页", true);
            }
            console.log("[98T] 搜索页已启用反爬兼容翻页");
            return;
        }

        loadMoreButton.addEventListener("click", loadNextPage);

        // 以页面底部哨兵为主触发器，避免仅依赖 body 高度导致第三页后失效。
        if ("IntersectionObserver" in window) {
            pageObserver = new IntersectionObserver(function(entries) {
                if (entries.some(function(entry) { return entry.isIntersecting; })) {
                    loadNextPage();
                }
            }, { root: null, rootMargin: "900px 0px", threshold: 0 });
            pageObserver.observe(loadSentinel);
        }

        // 旧浏览器或特殊页面结构下的滚动回退。
        window.addEventListener("scroll", () => {
            if (noMoreData || isLoading) return;

            const scrollPosition = window.innerHeight + window.scrollY;
            const bodyHeight = document.body.offsetHeight;

            if (scrollPosition >= bodyHeight - 400) {
                loadNextPage();
            }
        });

        setTimeout(checkAndLoad, 2000);

        const observer = new MutationObserver(() => {
            clearTimeout(mutationCheckTimer);
            mutationCheckTimer = setTimeout(checkAndLoad, 180);
        });
        observer.observe(document.body, { childList: true, subtree: true });

        console.log("[98T] 无限滚动已启动, 页面:", pageName);
    }
    // #endregion

    // #region 搜索页面处理 (保持原样)
    function handleSearchPage(settings) {
        replaceImageSrc();
        addPageNumbers();
        displayAdvanThreadImages(settings);

        setTimeout(() => {
            initInfiniteScroll("isSearchPage");
        }, 1500);
    }
    // #endregion

    // #region 板块筛选功能
    function getBoardFilterGroup() {
        return GM_getValue('bgsh_filter_group', 'all');
    }
    function setBoardFilterGroup(val) {
        GM_setValue('bgsh_filter_group', val);
    }

    function getBoardFilterIndividual() {
        try {
            return JSON.parse(GM_getValue('bgsh_filter_individual', '[]'));
        } catch { return []; }
    }
    function setBoardFilterIndividual(fids) {
        GM_setValue('bgsh_filter_individual', JSON.stringify(fids));
    }

    function getBoardFilterCollapsed() {
        return GM_getValue('bgsh_filter_collapsed', false);
    }
    function setBoardFilterCollapsed(val) {
        GM_setValue('bgsh_filter_collapsed', val);
    }

    function getTypeFilterCollapsed() {
        return GM_getValue('bgsh_typeFilter_collapsed', false);
    }
    function setTypeFilterCollapsed(val) {
        GM_setValue('bgsh_typeFilter_collapsed', val);
    }

    function buildFidMap() {
        const map = {};
        DEFAULT_TID_OPTIONS.forEach(function (opt) {
            map[opt.value] = opt.label;
        });
        return map;
    }

    function applyBoardFilter(mode, param, boardInfos) {
        let visibleFids = new Set();

        if (mode === 'all') {
            boardInfos.forEach(function (info) {
                info.element.style.display = '';
            });
            return;
        }

        if (mode === 'group') {
            const group = SEARCH_BOARD_GROUPS.find(function (g) { return g.label === param; });
            if (group) {
                group.fids.forEach(function (f) { visibleFids.add(f); });
            }
        } else if (mode === 'individual') {
            if (Array.isArray(param)) {
                param.forEach(function (f) { visibleFids.add(f); });
            }
        }

        let visibleCount = 0;
        boardInfos.forEach(function (info) {
            if (visibleFids.size === 0 || visibleFids.has(info.fid)) {
                info.element.style.display = '';
                visibleCount++;
            } else {
                info.element.style.display = 'none';
            }
        });

        const countEl = document.querySelector('.bgsh-board-filter-count');
        if (countEl) {
            countEl.textContent = '(显示 ' + visibleCount + '/' + boardInfos.length + ' 个板块)';
        }
    }

    function getCurrentFid() {
        const m = window.location.pathname.match(/forum-(\d+)-/);
        return m ? parseInt(m[1], 10) : null;
    }

    function initBoardFilter() {
        var boardElements = document.querySelectorAll('[id^="forum_"]');

        if (boardElements.length === 0) {
            boardElements = document.querySelectorAll('.fl_tb[id^="category_"] [id^="forum_"], .fl_tb table[id^="forum_"], .fl_tb tbody[id^="forum_"], .bm_c [id^="forum_"]');
        }

        if (boardElements.length === 0) {
            const cats = document.querySelectorAll('.fl_tb, .fl[class]');
            if (cats.length > 0) {
                if (!window._bgshFilterRetried) {
                    window._bgshFilterRetried = true;
                    setTimeout(initBoardFilter, 2000);
                }
                return;
            }
            return;
        }

        const fidMap = buildFidMap();
        var boardInfos = [];

        var processedIds = {};
        boardElements.forEach(function (el) {
            var m = el.id.match(/forum_(\d+)/);
            if (m) {
                var fid = parseInt(m[1], 10);
                if (processedIds[fid]) return;
                processedIds[fid] = true;

                var container = el.closest('.fl_tb, .fl, .bm, .bm_c, table') || el;
                if (container && container !== el) {
                } else {
                    var parentTable = el.closest('table');
                    if (parentTable) container = parentTable;
                }
                var fltb = container.closest('.fl_tb');
                if (fltb) container = fltb;

                boardInfos.push({ fid: fid, element: container });
            }
        });
        if (boardInfos.length === 0) return;

        const isCollapsed = getBoardFilterCollapsed();
        const filterBar = document.createElement('div');
        filterBar.className = 'bgsh-board-filter';
        filterBar.id = 'bgsh-board-filter';

        function buildGroupsHTML() {
            var html = '<div class="bgsh-board-filter-section">';
            html += '<div class="bgsh-board-filter-section-title">按分组筛选</div>';
            html += '<div class="bgsh-board-filter-groups">';
            html += '<button class="bgsh-board-filter-btn" data-mode="all" data-param="">🌐 全部</button>';
            SEARCH_BOARD_GROUPS.forEach(function (g) {
                html += '<button class="bgsh-board-filter-btn" data-mode="group" data-param="' + g.label.replace(/"/g, '&quot;') + '">' + g.label + '</button>';
            });
            html += '</div></div>';
            return html;
        }

        function buildIndividualHTML() {
            var html = '<div class="bgsh-board-filter-section">';
            html += '<div class="bgsh-board-filter-section-title">📂 板块列表 — 点击板块名进入, 勾选后筛选首页</div>';
            html += '<div class="bgsh-board-filter-rows">';
            SEARCH_BOARD_GROUPS.forEach(function (group) {
                group.fids.forEach(function (fid) {
                    var label = fidMap[fid] || ('fid=' + fid);
                    var boardUrl = '/forum-' + fid + '-1.html';
                    html += '<div class="bgsh-board-filter-row" data-fid="' + fid + '">';
                    html += '<label class="bgsh-board-filter-cb">';
                    html += '<input type="checkbox" value="' + fid + '">';
                    html += '<a href="' + boardUrl + '" class="bgsh-board-link" target="_self">' + label + '</a>';
                    html += '</label>';
                    html += '<span class="bgsh-board-types">';
                    html += '<a href="' + boardUrl + '" class="bgsh-type-pill">全部</a>';
                    html += '</span>';
                    html += '</div>';
                });
            });
            html += '</div></div>';
            return html;
        }

        filterBar.innerHTML =
            '<div class="bgsh-board-filter-header">' +
            '<span>📋 板块筛选</span>' +
            '<span class="bgsh-board-filter-toggle">' + (isCollapsed ? '展开 ▼' : '收起 ▲') + '</span>' +
            '</div>' +
            '<div class="bgsh-board-filter-body' + (isCollapsed ? ' collapsed' : '') + '">' +
            buildGroupsHTML() +
            buildIndividualHTML() +
            '<div class="bgsh-board-filter-count">(共 ' + boardInfos.length + ' 个板块)</div>' +
            '</div>';

        const contentArea = document.querySelector('#wp, .wp, #ct, .ct, #mainarea, .mainbox, #content');
        if (contentArea) {
            contentArea.insertBefore(filterBar, contentArea.firstChild);
        } else {
            document.body.insertBefore(filterBar, document.body.firstChild);
        }

        const header = filterBar.querySelector('.bgsh-board-filter-header');
        const body = filterBar.querySelector('.bgsh-board-filter-body');
        const toggle = filterBar.querySelector('.bgsh-board-filter-toggle');
        header.addEventListener('click', function (e) {
            if (e.target.closest('.bgsh-board-filter-btn') || e.target.closest('label')) return;
            const nowCollapsed = body.classList.toggle('collapsed');
            toggle.textContent = nowCollapsed ? '展开 ▼' : '收起 ▲';
            setBoardFilterCollapsed(nowCollapsed);
        });

        const groupButtons = filterBar.querySelectorAll('.bgsh-board-filter-btn');
        groupButtons.forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                groupButtons.forEach(function (b) { b.classList.remove('active'); });
                this.classList.add('active');

                const allCheckboxes = filterBar.querySelectorAll('.bgsh-board-filter-row input[type="checkbox"]');
                allCheckboxes.forEach(function (cb) { cb.checked = false; });

                const mode = this.dataset.mode;
                const param = this.dataset.param;
                if (mode === 'all') {
                    setBoardFilterGroup('all');
                    setBoardFilterIndividual([]);
                    applyBoardFilter('all', null, boardInfos);
                } else if (mode === 'group') {
                    setBoardFilterGroup(param);
                    setBoardFilterIndividual([]);
                    applyBoardFilter('group', param, boardInfos);
                }
            });
        });

        const boardCheckboxes = filterBar.querySelectorAll('.bgsh-board-filter-row input[type="checkbox"]');
        boardCheckboxes.forEach(function (cb) {
            cb.addEventListener('change', function (e) {
                e.stopPropagation();
                const checkedFids = [];
                filterBar.querySelectorAll('.bgsh-board-filter-row input[type="checkbox"]').forEach(function (c) {
                    if (c.checked) checkedFids.push(parseInt(c.value, 10));
                });
                groupButtons.forEach(function (b) { b.classList.remove('active'); });
                if (checkedFids.length === 0) {
                    setBoardFilterGroup('all');
                    setBoardFilterIndividual([]);
                    const allBtn = filterBar.querySelector('.bgsh-board-filter-btn[data-mode="all"]');
                    if (allBtn) allBtn.classList.add('active');
                    applyBoardFilter('all', null, boardInfos);
                } else {
                    setBoardFilterGroup('');
                    setBoardFilterIndividual(checkedFids);
                    applyBoardFilter('individual', checkedFids, boardInfos);
                }
            });
        });

        const savedIndividual = getBoardFilterIndividual();
        if (savedIndividual && savedIndividual.length > 0) {
            filterBar.querySelectorAll('.bgsh-board-filter-row input[type="checkbox"]').forEach(function (cb) {
                const fid = parseInt(cb.value, 10);
                if (savedIndividual.indexOf(fid) !== -1) {
                    cb.checked = true;
                }
            });
            groupButtons.forEach(function (b) { b.classList.remove('active'); });
            applyBoardFilter('individual', savedIndividual, boardInfos);
            return;
        }

        const savedGroup = getBoardFilterGroup();
        if (savedGroup && savedGroup !== 'all') {
            const savedBtn = filterBar.querySelector('.bgsh-board-filter-btn[data-mode="group"][data-param="' + savedGroup.replace(/"/g, '&quot;') + '"]');
            if (savedBtn) {
                savedBtn.click();
                return;
            }
        }

        const allBtn = filterBar.querySelector('.bgsh-board-filter-btn[data-mode="all"]');
        if (allBtn) allBtn.classList.add('active');
    }
    // #endregion

    // #region 主题分类筛选
    function initTopicTypeFilter() {
        var fid = null;
        var pathMatch = window.location.pathname.match(/forum-(\d+)-/);
        if (pathMatch) {
            fid = pathMatch[1];
        } else {
            var url = window.location.href;
            var fidMatch = url.match(/[?&]fid=(\d+)/);
            if (fidMatch) fid = fidMatch[1];
        }
        if (!fid) return;

        var threadList = document.querySelector('#threadlist, .threadlist, form table, form .bm_c, form .bm');
        if (!threadList) threadList = document.querySelector('.mainbox form');
        if (!threadList) return;

        var typeMap = {};
        var typeNavSeen = {};
        // 去重键：分类名 + typeid。只按名字去重会把「站点分类栏(#thread_types)」里的
        // 13 个真分类挡掉，因为主题行里的 th em 先占了这个名字（没有 typeid）。
        var seenTypeKeys = {};

        function addType(name, typeid) {
            name = String(name || '').replace(/\s+/g, ' ').trim();
            if (!name) return false;
            var key = name + '|' + (typeid || '');
            if (seenTypeKeys[key]) return false;
            if (!typeid && typeMap[name] && typeMap[name].typeid) return false;
            seenTypeKeys[key] = true;
            if (!typeMap[name] || (typeid && !typeMap[name].typeid)) {
                typeMap[name] = { name: name, typeid: typeid || null };
            }
            return true;
        }

        // 站点原生分类栏：Discuz 的 <ul id="thread_types" class="ttp bm cl">，
        // 里面是 <li><a href="...filter=typeid&typeid=NNN">名称<span class="xg1 num">帖子数</span></a>。
        // 这是最权威的来源，优先入库。
        document.querySelectorAll('#thread_types a[href*="typeid="], ul.ttp a[href*="typeid="]').forEach(function (a) {
            var typeid = (a.href.match(/[?&]typeid=(\d+)/) || [])[1];
            if (!typeid || typeid === '0') return;
            // 名称去掉尾部的帖子数字
            var name = (a.textContent || '').replace(/\d+/g, '').replace(/\s+/g, ' ').trim();
            if (!name || name.length > 20) return;
            addType(name, typeid);
        });

        var allHrefTypeLinks = document.querySelectorAll('a[href*="typeid="]');
        allHrefTypeLinks.forEach(function (a) {
            var name = a.textContent.trim();
            if (!name) return;
            if (name === '全部' || name === '更多' || name === '|' || name.length > 12) return;
            var tidMatch = a.href.match(/[?&]typeid=(\d+)/);
            if (!tidMatch || tidMatch[1] === '0') return;
            var linkFid = a.href.match(/[?&]fid=(\d+)/);
            if (linkFid && linkFid[1] !== fid) return;

            var typeid = tidMatch[1];
            var key = '_tid_' + typeid;
            if (typeNavSeen[key]) return;
            typeNavSeen[key] = true;
            addType(name, typeid);
        });

        var emLinks = document.querySelectorAll('th em a[href*="typeid="]');
        emLinks.forEach(function (a) {
            var name = a.textContent.replace(/^\[|\]$/g, '').trim();
            if (!name) return;
            var tidMatch = a.href.match(/[?&]typeid=(\d+)/);
            var typeid = tidMatch ? tidMatch[1] : null;
            addType(name, typeid);
        });

        var xg1s = document.querySelectorAll('span.xg1');
        xg1s.forEach(function (span) {
            var m = span.textContent.match(/\[([^\]]+)\]/);
            if (m) {
                var name = m[1].trim();
                if (!name) return;
                addType(name, null);
            }
        });

        var thEms = document.querySelectorAll('th em');
        thEms.forEach(function (em) {
            if (em.querySelector('a')) return;
            var text = em.textContent.replace(/^\[|\]$/g, '').trim();
            if (!text || text.length > 8) return;
            addType(text, null);
        });

        var typeSelect = document.querySelector('select[name="typeid"], select#typeid');
        if (typeSelect) {
            var opts = typeSelect.querySelectorAll('option');
            opts.forEach(function (opt) {
                var val = opt.value;
                var text = opt.textContent.trim();
                if (!val || val === '0' || !text || text === '全部' || text === '选择分类') return;
                addType(text, val);
            });
        }

        if (Object.keys(typeMap).length === 0) {
            showToast('📭 此板块暂无主题分类可筛选', 'info', 2000);
            return;
        }

        var typeNames = Object.keys(typeMap);

        var typeHrefMap = {};
        var allTypeLinks = document.querySelectorAll('a[href*="typeid="]');
        allTypeLinks.forEach(function (a) {
            var name = a.textContent.trim();
            if (!name) return;
            if (typeMap[name]) {
                typeHrefMap[name] = a.href;
            }
        });

        var baseUrl = window.location.href.replace(/[?&](typeid|filter|page)=\d*/g, '').replace(/\?&/, '?').replace(/\?$/, '').replace(/&&/g, '&');
        while (baseUrl.indexOf('&&') >= 0) baseUrl = baseUrl.replace('&&', '&');
        if (baseUrl.charAt(baseUrl.length-1) === '?' || baseUrl.charAt(baseUrl.length-1) === '&')
            baseUrl = baseUrl.substring(0, baseUrl.length-1);

        typeNames.forEach(function (name) {
            if (!typeHrefMap[name]) {
                var info = typeMap[name];
                if (info.typeid) {
                    typeHrefMap[name] = baseUrl + (baseUrl.indexOf('?') >= 0 ? '&' : '?') + 'filter=typeid&typeid=' + info.typeid;
                }
            }
        });

        var currentTypeid = null;
        var tidMatch = window.location.href.match(/[?&]typeid=(\d+)/);
        if (tidMatch) currentTypeid = tidMatch[1];

        var isCollapsed = getTypeFilterCollapsed();
        var filterBar = document.createElement('div');
        filterBar.className = 'bgsh-type-filter';
        filterBar.id = 'bgsh-type-filter';

        var allUrl = window.location.href.replace(/[?&](typeid|filter)=\d*[^&]*/g, '').replace(/\?&/, '?').replace(/\?$/, '');
        while (allUrl.indexOf('&&') >= 0) allUrl = allUrl.replace('&&', '&');
        if (allUrl.charAt(allUrl.length-1) === '?' || allUrl.charAt(allUrl.length-1) === '&')
            allUrl = allUrl.substring(0, allUrl.length-1);

        var isFiltered = !!currentTypeid;

        var pillHtml = '';
        var allActive = !isFiltered;
        pillHtml += '<a class="bgsh-type-pill' + (allActive ? ' active' : '') + '" href="' + allUrl.replace(/"/g, '&quot;') + '">🌐 全部</a>';
        typeNames.forEach(function (name) {
            var info = typeMap[name];
            var href = typeHrefMap[name] || '';
            var isActive = false;
            if (info.typeid && currentTypeid && info.typeid.toString() === currentTypeid) {
                isActive = true;
            }
            pillHtml += '<a class="bgsh-type-pill' + (isActive ? ' active' : '') + '" href="' + href.replace(/"/g, '&quot;') + '">' + name + '</a>';
        });

        // 原生分类栏已经能胜任时，默认不重复渲染（站点自己的 #thread_types 更贴合版块），
        // 想要双重保险可在设置里强制显示。折叠状态记忆仍然生效。
        var nativeTypeNav = document.querySelector('#thread_types, ul.ttp');
        if (nativeTypeNav && !window.__bgshForceTypeFilter) {
            var nativeItems = nativeTypeNav.querySelectorAll('a[href*="typeid="]').length;
            if (nativeItems >= Object.keys(typeMap).length) return;
        }

        filterBar.innerHTML =
            '<div class="bgsh-type-filter-header">' +
            '<span>🏷️ 主题分类筛选 <span style="font-weight:400;font-size:11px;opacity:0.6">共' + typeNames.length + '种, 点击即跳转</span></span>' +
            '<span class="bgsh-type-filter-toggle">' + (isCollapsed ? '展开 ▼' : '收起 ▲') + '</span>' +
            '</div>' +
            '<div class="bgsh-type-filter-body' + (isCollapsed ? ' collapsed' : '') + '">' +
            '<div class="bgsh-type-filter-pills">' + pillHtml + '</div>' +
            '</div>';

        var insertTarget = document.querySelector('#threadlist, .threadlist, .mainbox form');
        if (insertTarget) {
            insertTarget.parentNode.insertBefore(filterBar, insertTarget);
        } else {
            var contentArea = document.querySelector('#wp, .wp, #ct, .ct');
            if (contentArea) {
                contentArea.insertBefore(filterBar, contentArea.firstChild);
            } else {
                document.body.insertBefore(filterBar, document.body.firstChild);
            }
        }

        var typeHeader = filterBar.querySelector('.bgsh-type-filter-header');
        var typeBody = filterBar.querySelector('.bgsh-type-filter-body');
        var typeToggle = filterBar.querySelector('.bgsh-type-filter-toggle');
        typeHeader.addEventListener('click', function (e) {
            if (e.target.closest('a')) return;
            var nowCollapsed = typeBody.classList.toggle('collapsed');
            typeToggle.textContent = nowCollapsed ? '展开 ▼' : '收起 ▲';
            setTypeFilterCollapsed(nowCollapsed);
        });
    }
    // #endregion

    // #region 其他功能 (保持原样)
    function removeIndex() {
        window.addEventListener("load", function() {
            const diyChart = document.querySelector("#diy_chart");
            if (diyChart) diyChart.remove();
        });
    }

    function PostContent() {
        if (!window.location.href.includes("forum.php?mod=post&action=newthread")) return;

        const link = document.createElement("a");
        link.href = "/forum.php?mod=redirect&goto=findpost&ptid=1708826&pid=16039784";
        link.textContent = "📖 发帖须知";
        link.target = "_blank";
        link.style.cssText = "margin-right: 8px; color: #f7971e; text-decoration: none; font-weight: 500;";

        const organizeButton = document.createElement("li");
        organizeButton.className = "a";
        organizeButton.innerHTML = '<button id="organizeBtn" type="button" style="padding: 4px 12px; border: none; border-radius: 6px; background: linear-gradient(135deg, #f7971e, #ffd200); color: #3d2a1a; cursor: pointer;">📋 整理</button>';

        const shareButton = document.createElement("li");
        shareButton.className = "a";
        shareButton.innerHTML = '<button id="shareBtn" type="button" style="padding: 4px 12px; border: none; border-radius: 6px; background: linear-gradient(135deg, #f093fb, #f5576c); color: #fff; cursor: pointer;">🔄 自转</button>';

        const ulElement = document.querySelector(".tb.cl.mbw");
        if (ulElement) {
            const li = document.createElement("li");
            li.className = "a";
            li.appendChild(link);
            ulElement.appendChild(li);
            ulElement.appendChild(organizeButton);
            ulElement.appendChild(shareButton);
        }

        var ttttype = "";
        const modalContent = `
            <div id="organizeModal" style="display:none; position:fixed; z-index:1000; left:50%; top:50%; transform:translate(-50%, -50%); background:rgba(255,248,235,0.92); backdrop-filter:blur(20px); padding:24px; border-radius:16px; box-shadow:0 32px 80px rgba(0,0,0,0.25); border:1px solid rgba(255,200,150,0.3); max-width:92vw; max-height:90vh; overflow-y:auto;">
                <div style="display:grid; gap:12px;">
                    <div><strong>【资源名称】：</strong><input type="text" id="resourceName" style="width:100%; padding:6px 12px; border:2px solid rgba(0,0,0,0.06); border-radius:8px; background:rgba(255,255,255,0.5);"/></div>
                    <div><strong>【资源类型】：</strong>
                        <label><input type="radio" name="resourceType" value="影片"/>影片</label>
                        <label><input type="radio" name="resourceType" value="视频" checked/>视频</label>
                        <label><input type="radio" name="resourceType" value="动漫"/>动漫</label>
                        <label><input type="radio" name="resourceType" value="套图"/>套图</label>
                        <label><input type="radio" name="resourceType" value="游戏"/>游戏</label>
                    </div>
                    <div><strong>【是否有码】：</strong>
                        <label><input type="radio" name="censorship" value="有码"/>有码</label>
                        <label><input type="radio" name="censorship" value="无码" checked/>无码</label>
                    </div>
                    <div><strong>【是否水印】：</strong>
                        <label><input type="radio" name="watermark" value="有水印"/>有水印</label>
                        <label><input type="radio" name="watermark" value="无水印" checked/>无水印</label>
                    </div>
                    <div><strong>【字幕】：</strong>
                        <label><input type="radio" name="subtitle" value="中文字幕"/>中文字幕</label>
                        <label><input type="radio" name="subtitle" value="日文字幕"/>日文字幕</label>
                        <label><input type="radio" name="subtitle" value="英文字幕"/>英文字幕</label>
                        <label><input type="radio" name="subtitle" value="无字幕" checked/>无字幕</label>
                    </div>
                    <div><strong>【资源大小】：</strong>
                        <input type="text" id="resourceSize" placeholder="大小" style="padding:6px 12px; border:2px solid rgba(0,0,0,0.06); border-radius:8px; background:rgba(255,255,255,0.5);"/>
                        <label><input type="radio" name="sizeUnit" value="M" checked/>M</label>
                        <label><input type="radio" name="sizeUnit" value="G"/>G</label>
                        <label><input type="radio" name="sizeUnit" value="T"/>T</label>
                    </div>
                    <div><strong>【下载类型】：</strong>
                        <label><input type="radio" name="downType" value="115ED2K" checked/>115ED2K</label>
                        <label><input type="radio" name="downType" value="BT/磁链"/>BT/磁链</label>
                        <label><input type="radio" name="downType" value="ED2K"/>ED2K</label>
                        <label><input type="radio" name="downType" value="夸克网盘"/>夸克网盘</label>
                        <label><input type="radio" name="downType" value="百度网盘"/>百度网盘</label>
                        <label><input type="radio" name="downType" value="PikPak网盘"/>PikPak网盘</label>
                        <label><input type="radio" name="downType" value="其它网盘"/>其它网盘</label>
                    </div>
                    <div>视频数量: <input type="text" id="videoCount" placeholder="视频数量" style="padding:6px 12px; border:2px solid rgba(0,0,0,0.06); border-radius:8px; background:rgba(255,255,255,0.5);"/></div>
                    <div>图片数量: <input type="text" id="imageCount" placeholder="图片数量" style="padding:6px 12px; border:2px solid rgba(0,0,0,0.06); border-radius:8px; background:rgba(255,255,255,0.5);"/></div>
                    <div>配额数量: <input type="text" id="quota" placeholder="配额数量" style="padding:6px 12px; border:2px solid rgba(0,0,0,0.06); border-radius:8px; background:rgba(255,255,255,0.5);"/></div>
                    <div><strong>【资源预览】：</strong></div>
                    <div><strong>【资源链接】：</strong><input type="text" id="resourceLink" style="width:100%; padding:6px 12px; border:2px solid rgba(0,0,0,0.06); border-radius:8px; background:rgba(255,255,255,0.5);"/></div>
                    <button id="insetBtn" type="button" style="padding:8px 20px; border:none; border-radius:8px; background:linear-gradient(135deg,#f7971e,#ffd200); color:#3d2a1a; cursor:pointer; font-weight:500;">✅ 插入</button>
                </div>
            </div>`;
        document.body.insertAdjacentHTML("beforeend", modalContent);

        document.getElementById("organizeBtn").addEventListener("click", function() {
            document.getElementById("organizeModal").style.display = "block";
            ttttype = "整理";
        });
        document.getElementById("shareBtn").addEventListener("click", function() {
            document.getElementById("organizeModal").style.display = "block";
            ttttype = "自转";
        });

        document.getElementById("insetBtn").addEventListener("click", function() {
            const resourceName = document.getElementById("resourceName").value;
            const resourceType = document.querySelector('input[name="resourceType"]:checked')?.value;
            const censorship = document.querySelector('input[name="censorship"]:checked')?.value;
            const watermark = document.querySelector('input[name="watermark"]:checked')?.value;
            const subtitle = document.querySelector('input[name="subtitle"]:checked')?.value;
            const resourceLink = document.getElementById("resourceLink").value;
            const downType = document.querySelector('input[name="downType"]:checked')?.value;
            const resourceSize = document.getElementById("resourceSize").value;
            const sizeUnit = document.querySelector('input[name="sizeUnit"]:checked').value;
            const videoCount = document.getElementById("videoCount").value;
            const imageCount = document.getElementById("imageCount").value;
            const quota = document.getElementById("quota").value;

            let resourceSizeStr = resourceSize ? `${resourceSize}${sizeUnit}` : "";
            let videoCountStr = videoCount ? `${videoCount}V` : "";
            let imageCountStr = imageCount ? `${imageCount}P` : "";
            let quotaStr = quota ? `${quota}配额` : "";

            const content = `
                【资源名称】：${resourceName}<br>
                【资源类型】：${resourceType}<br>
                【是否有码】：${censorship} @ ${watermark} @ ${subtitle}<br>
                【资源大小】：${resourceSizeStr}/${videoCountStr}/${imageCountStr}/${quotaStr}<br>
                【资源预览】：<br>
                【资源链接】：<div class="blockcode"><blockquote>${resourceLink}</blockquote></div><br>
            `;

            const iframe = document.querySelector(".area iframe");
            if (iframe && iframe.contentDocument) {
                const body = iframe.contentDocument.body;
                if (body && body.isContentEditable) {
                    body.innerHTML = content;
                }
            }

            const title = `【${ttttype}】【${downType}】${resourceName}【${resourceSizeStr}/${videoCountStr}/${imageCountStr}/${quotaStr}】`;
            const subjectInput = document.getElementById("subject");
            if (subjectInput) subjectInput.value = title;

            var selectElement = document.getElementById("typeid");
            if (selectElement) selectElement.setAttribute("selecti", "8");

            var aElement = document.querySelector(".ftid a#typeid_ctrl");
            if (aElement) {
                aElement.textContent = "情色分享";
                aElement.setAttribute("initialized", "true");
            }

            document.getElementById("organizeModal").style.display = "none";
            showToast("✅ 帖子内容已整理", "success");
        });
    }

    function createMenuButton(settings) {
        const menuButton = document.createElement("button");
        menuButton.title = settings.menuButtonIsVisible ? "隐藏工具栏" : "显示工具栏";

        const eyeOpenSVG = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;display:block;">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
            </svg>
        `;

        const eyeCloseSVG = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;display:block;">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
        `;

        const buttonColor = settings.menuButtonIsVisible ? "#f7971e" : "#ff6b6b";

        menuButton.innerHTML = settings.menuButtonIsVisible ? eyeOpenSVG : eyeCloseSVG;

        Object.assign(menuButton.style, {
            position: "fixed",
            zIndex: "1001",
            cursor: "pointer",
            padding: "10px",
            borderRadius: "50%",
            backgroundColor: buttonColor,
            color: "white",
            border: "none",
            boxShadow: "0 4px 20px rgba(247,151,30,0.3)",
            transition: "all 0.3s ease",
            width: "44px",
            height: "44px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: "1",
            outline: "none",
            right: "12px",
        });

        menuButton.addEventListener('mouseenter', () => {
            menuButton.style.transform = 'scale(1.1)';
            menuButton.style.boxShadow = '0 6px 30px rgba(247,151,30,0.5)';
        });
        menuButton.addEventListener('mouseleave', () => {
            menuButton.style.transform = 'scale(1)';
            menuButton.style.boxShadow = '0 4px 20px rgba(247,151,30,0.3)';
        });

        return menuButton;
    }

    function toggleContainer(menuButton, container) {
        const settings = getSettings();
        let isVisible = settings.menuButtonIsVisible;

        const eyeOpenSVG = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;display:block;">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
            </svg>
        `;

        const eyeCloseSVG = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;display:block;">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
        `;

        menuButton.addEventListener("click", () => {
            if (isVisible) {
                container.style.display = "none";
                menuButton.innerHTML = eyeCloseSVG;
                menuButton.title = "显示工具栏";
                menuButton.style.backgroundColor = "#ff6b6b";
                menuButton.style.boxShadow = '0 4px 20px rgba(255,107,107,0.3)';
                isVisible = false;
            } else {
                container.style.display = "flex";
                menuButton.innerHTML = eyeOpenSVG;
                menuButton.title = "隐藏工具栏";
                menuButton.style.backgroundColor = "#f7971e";
                menuButton.style.boxShadow = '0 4px 20px rgba(247,151,30,0.3)';
                isVisible = true;
            }
            GM_setValue("menuButtonIsVisible", isVisible);
        });
    }

    function setMenuButtonPosition(menuButton, container) {
        if (!document.body.contains(menuButton)) {
            document.body.appendChild(menuButton);
        }

        requestAnimationFrame(() => {
            let containerRect = container.getBoundingClientRect();

            if (containerRect.top === 0 && containerRect.bottom === 0) {
                menuButton.style.top = '80px';
                menuButton.style.right = '12px';
                return;
            }

            const buttonHeight = menuButton.offsetHeight || 44;
            const gap = 16;
            let topPos = containerRect.top - buttonHeight - gap;

            if (topPos < 10) {
                topPos = containerRect.top + 10;
            }

            if (topPos + buttonHeight > window.innerHeight - 10) {
                topPos = window.innerHeight - buttonHeight - 10;
            }

            menuButton.style.top = topPos + 'px';
            menuButton.style.right = '12px';
        });
    }

    function createt98tButton(buttonContainer) {
        var t98tButton = createButton("t98tButton", "⚙️ 功能设置", () => createSettingsUI(getSettings()));
        buttonContainer.appendChild(t98tButton);
    }
    // #endregion

    // #region 更新检查 (保持原样)
    function compareVersions(left, right) {
        var a = String(left || "0").split(".").map(function(part) { return parseInt(part, 10) || 0; });
        var b = String(right || "0").split(".").map(function(part) { return parseInt(part, 10) || 0; });
        var length = Math.max(a.length, b.length);
        for (var i = 0; i < length; i++) {
            var difference = (a[i] || 0) - (b[i] || 0);
            if (difference !== 0) return difference;
        }
        return 0;
    }

    // 自维护版：更新源只认这里。留空 = 完全不做更新检查（默认，已断开上游）。
    // 填成自建仓库的 raw meta 地址即可恢复每日检查，例如：
    //   https://raw.githubusercontent.com/<用户名>/<仓库>/main/x98t-plus.meta.js
    const SELF_UPDATE_META_URL = "https://raw.githubusercontent.com/Anyi-lab/x98t-plus/main/x98t-plus.meta.js";
    // raw.githubusercontent.com 的 CDN 会缓存旧内容（实测：push 后 user.js 仍返回旧版，
    // 而 GitHub API / jsDelivr 已是新版）。检查更新时并行探这几个源，任一给出更高版本就提示。
    // jsDelivr 有小时级延迟但内容一致；GitHub API contents 接口命中最新 commit，作最终兜底。
    const SELF_UPDATE_MIRROR_URLS = [
        "https://cdn.jsdelivr.net/gh/Anyi-lab/x98t-plus@main/x98t-plus.meta.js",
        "https://api.github.com/repos/Anyi-lab/x98t-plus/contents/x98t-plus.meta.js?ref=main"
    ];

    async function checkForUpdates() {
        if (!SELF_UPDATE_META_URL) {
            // 上游已断开且未配置自建更新源，什么都不做。
            GM_setValue("lastCheckedUpdate", Date.now());
            return;
        }
        const currentVersion = GM.info.script.version;
        const updateURL = SELF_UPDATE_META_URL;

        var bestVersion = "";
        for (const url of [updateURL].concat(SELF_UPDATE_MIRROR_URLS)) {
            try {
                const response = await fetch(url, { cache: "no-store" });
                let data = await response.text();
                // GitHub API contents 返回 JSON，@version 在 content 字段的 base64 里；
                // 简化处理：直接在整个响应文本里找 @version，两种格式都能命中。
                if (url.indexOf("api.github.com") >= 0) {
                    try {
                        const json = JSON.parse(data);
                        if (json && json.content) data = atob(json.content.replace(/\s/g, ""));
                    } catch (e) {}
                }
                const matchVersion = data.match(/@version\s+([\d.]+)/);
                if (matchVersion && matchVersion[1] &&
                    compareVersions(matchVersion[1], bestVersion || currentVersion) > 0) {
                    bestVersion = matchVersion[1];
                }
            } catch (error) {
                console.error("检查更新出错(" + url + "):", error);
            }
        }

        if (bestVersion && compareVersions(bestVersion, currentVersion) > 0) {
            showUpdateDialog();
        }
        GM_setValue("lastCheckedUpdate", Date.now());
    }

    function showUpdateDialog() {
        // 自维护版：下载地址由自建 meta 地址推导（xxx.meta.js → xxx.user.js），不再指向 sleazyfork。
        const installURL = SELF_UPDATE_META_URL.replace(/\.meta\.js$/, ".user.js");
        const dialogHTML = `
            <div style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); backdrop-filter:blur(12px); z-index:99999; display:flex; justify-content:center; align-items:center;">
                <div style="background:rgba(255,248,235,0.92); backdrop-filter:blur(20px); padding:28px 36px; border-radius:20px; text-align:center; border:1px solid rgba(255,200,150,0.3); box-shadow:0 32px 80px rgba(0,0,0,0.25); max-width:400px;">
                    <div style="font-size:48px; margin-bottom:12px;">🎉</div>
                    <p style="font-size:16px; font-weight:600; color:#4a2e1b; margin-bottom:8px;">有新版本可用！</p>
                    <p style="font-size:13px; color:#666; margin-bottom:20px;">自维护版有新版本，请点击下方按钮更新</p>
                    <a href="${installURL}" target="_blank" rel="noopener noreferrer" style="display:inline-block; padding:10px 32px; background:linear-gradient(135deg,#f7971e,#ffd200); color:#3d2a1a; border-radius:10px; text-decoration:none; font-weight:500; margin-bottom:12px;">🔄 立即更新</a>
                    <br>
                    <button onclick="this.closest('div[style]').parentElement.remove();" style="padding:6px 20px; border:none; background:rgba(0,0,0,0.06); border-radius:8px; cursor:pointer; color:#666; font-size:13px;">关闭</button>
                </div>
            </div>`;

        const tempDiv = document.createElement("div");
        tempDiv.className = "updateDialog";
        tempDiv.innerHTML = dialogHTML;
        document.body.appendChild(tempDiv);
    }
    // #endregion

    // #region 设置界面 (升级版)
    const BACKUP_LEGACY_KEYS = new Set([
        "logoText", "tipsText", "imageSize", "imageUrl", "blockMedals",
        "resizeMedals", "replaceMedals", "displayBlockedTips", "autoPagination",
        "showImageButton", "defaultShowPostImages", "defaultHidePostImages", "enableTitleStyle", "titleStyleSize", "titleStyleWeight",
        "largeResourceThresholdGb",
        "blockedUsers", "followedAuthors", "showAvatar", "maxGradeThread",
        "defaultSwipeToSearch", "displayThreadImages", "previewWheelResizeEnabled",
        "threadPreviewCount", "visitedThreadColor", "displayThreadBuyInfo",
        "isShowWatermarkMessage", "clickEffectStyle", "postImageLazyLoad",
        "postImageLazyBatchSize", "showDown", "showCopyCode",
        "showFastPost", "showFastReply", "showQuickGrade", "showQuickStar",
        "showClickDouble", "showViewRatings", "showPayLog", "showFastCopy",
        "blockingResolved", "isOnlyShowMoney", "blockingIndex", "menuButtonIsVisible",
        "searchCacheEnabled", "searchAutoComplete", "searchHistoryCount",
        "searchResultCount", "searchHotKeys", "searchSort", "forumDefaultSort"
    ]);

    function isVolatileBackupKey(key) {
        return key === "lastCheckedUpdate" ||
            key === "bgshSearchBoardsV474" ||
            key === "bgshAuthorTodayThreadCountCacheV2" ||
            key === "bgshAuthorTodayThreadInfoCacheV3" ||
            key.indexOf("bgsh_cache_") === 0;
    }

    function isImportableBackupKey(key) {
        return typeof key === "string" && !isVolatileBackupKey(key) &&
            (BACKUP_LEGACY_KEYS.has(key) || key.indexOf("bgsh") === 0);
    }

    function createBackupPayload() {
        var keys = typeof GM_listValues === "function" ? GM_listValues() : [];
        var data = {};
        keys.forEach(function(key) {
            if (!isImportableBackupKey(key)) return;
            var value = GM_getValue(key, undefined);
            if (value !== undefined) data[key] = value;
        });
        var scriptVersion = typeof GM !== "undefined" && GM.info && GM.info.script
            ? GM.info.script.version
            : scriptVer.replace("v", "");
        return {
            app: "98T Helper",
            schemaVersion: 1,
            scriptVersion: scriptVersion,
            exportedAt: new Date().toISOString(),
            data: data
        };
    }

    function exportSettingsBackup() {
        var payload = createBackupPayload();
        var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
        var url = URL.createObjectURL(blob);
        var link = document.createElement("a");
        var date = new Date().toISOString().slice(0, 10);
        link.href = url;
        link.download = "98T-helper-backup-" + date + ".json";
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
        return Object.keys(payload.data).length;
    }

    async function importSettingsBackup(file) {
        if (!file) return 0;
        var raw = await file.text();
        var payload = JSON.parse(raw);
        if (!payload || payload.app !== "98T Helper" || payload.schemaVersion !== 1 ||
            !payload.data || typeof payload.data !== "object" || Array.isArray(payload.data)) {
            throw new Error("备份文件格式不正确");
        }
        var entries = Object.entries(payload.data).filter(function(entry) {
            return isImportableBackupKey(entry[0]) && entry[1] !== undefined;
        });
        if (!entries.length) throw new Error("备份中没有可导入的数据");
        if (!window.confirm("将覆盖当前的 " + entries.length + " 项设置/收藏数据，确定继续吗？")) return 0;
        entries.forEach(function(entry) { GM_setValue(entry[0], entry[1]); });
        return entries.length;
    }

    function generateSettingsHTML(settings) {
        return `
            <div class="bgsh-dialog-overlay" id="settingsUIOverlay">
                <div class="bgsh-dialog" id="bgshSettingsDrag">
                    <div class="bgsh-dialog-header" id="bgshSettingsDragHandle">
                        <div class="bgsh-dialog-title">
                            ⚙️ 功能设置 <span class="badge">${scriptVer}</span>
                        </div>
                        <button class="bgsh-dialog-close" id="closeButton">&times;</button>
                    </div>
                    <div style="display:flex;flex:1;overflow:hidden;">
                        <div class="bgsh-settings-tabs">
                            <button class="bgsh-tab-btn active" data-tab="tab-general">📋 通用</button>
                            <button class="bgsh-tab-btn" data-tab="tab-display">🎨 显示</button>
                            <button class="bgsh-tab-btn" data-tab="tab-features">🔧 功能</button>
                            <button class="bgsh-tab-btn" data-tab="tab-search">🔍 搜索</button>
                            <button class="bgsh-tab-btn" data-tab="tab-block">🚫 屏蔽</button>
                            <button class="bgsh-tab-btn" data-tab="tab-data">💾 数据</button>
                        </div>
                        <div class="bgsh-settings-content">
                            <!-- 通用 -->
                            <div class="bgsh-tab-panel active" id="tab-general">
                                <div class="bgsh-setting-group">
                                    <div class="bgsh-setting-item">
                                        <label for="tipsTextInput">💬 提示文字</label>
                                        <input type="text" id="tipsTextInput" value="${settings.tipsText}">
                                    </div>
                                    <div class="bgsh-setting-item">
                                        <label for="logoTextInput">✨ 评分/特效文字</label>
                                        <input type="text" id="logoTextInput" value="${settings.logoText}">
                                    </div>
                                    <div class="bgsh-setting-item">
                                        <label for="maxGradeThread">⭐ 主贴评分最大值</label>
                                        <input type="number" id="maxGradeThread" value="${settings.maxGradeThread}" min="1" max="100">
                                    </div>
                                </div>
                                <div class="bgsh-setting-group">
                                    <div class="bgsh-switch-grid">
                                        <label class="bgsh-switch-label"><input type="checkbox" id="autoPaginationCheckbox" ${settings.autoPagination?'checked':''}><span class="bgsh-switch-slider"></span><span class="bgsh-switch-text">自动翻页</span></label>
                                        <label class="bgsh-switch-label"><input type="checkbox" id="defaultSwipeToSearchCheckbox" ${settings.defaultSwipeToSearch?'checked':''}><span class="bgsh-switch-slider"></span><span class="bgsh-switch-text">划词搜索</span></label>
                                    </div>
                                </div>
                                <div class="bgsh-setting-group">
                                    <div class="bgsh-setting-item">
                                        <label>🗂️ 板块列表默认排序</label>
                                        <div class="bgsh-radio-group">
                                            <label class="bgsh-radio-label"><input type="radio" name="settingsForumSort" value="native" ${settings.forumDefaultSort==="native"?"checked":""}> 网站默认（回复时间）</label>
                                            <label class="bgsh-radio-label"><input type="radio" name="settingsForumSort" value="dateline" ${settings.forumDefaultSort==="dateline"?"checked":""}> 发布时间</label>
                                            <label class="bgsh-radio-label"><input type="radio" name="settingsForumSort" value="lastpost" ${settings.forumDefaultSort==="lastpost"?"checked":""}> 回复时间</label>
                                        </div>
                                        <span class="bgsh-hint">进入板块帖子列表时自动使用的排序，选「发布时间」后新帖优先（仍可用列表页排序按钮临时切换）</span>
                                    </div>
                                </div>
                            </div>
                            <!-- 显示 -->
                            <div class="bgsh-tab-panel" id="tab-display">
                                <div class="bgsh-setting-group">
                                    <div class="bgsh-setting-item">
                                        <label for="imageSizeInput">🏅 勋章尺寸</label>
                                        <input type="text" id="imageSizeInput" value="${settings.imageSize}">
                                    </div>
                                    <div class="bgsh-setting-item">
                                        <label for="imageUrlInput">🖼️ 替换勋章图片链接</label>
                                        <input type="text" id="imageUrlInput" value="${settings.imageUrl}">
                                    </div>
                                </div>
                                <div class="bgsh-setting-group">
                                    <div class="bgsh-setting-item">
                                        <label>🎖️ 勋章隐藏</label>
                                        <div class="bgsh-radio-group">
                                            <label class="bgsh-radio-label"><input type="radio" name="blockMedals" value="0" ${settings.blockMedals===0?'checked':''}> 不隐藏</label>
                                            <label class="bgsh-radio-label"><input type="radio" name="blockMedals" value="1" ${settings.blockMedals===1?'checked':''}> 隐藏所有</label>
                                            <label class="bgsh-radio-label"><input type="radio" name="blockMedals" value="2" ${settings.blockMedals===2?'checked':''}> 隐藏女优勋章</label>
                                        </div>
                                    </div>
                                    <div class="bgsh-setting-item">
                                        <label>📐 修改勋章尺寸</label>
                                        <div class="bgsh-radio-group">
                                            <label class="bgsh-radio-label"><input type="radio" name="resizeMedals" value="0" ${settings.resizeMedals===0?'checked':''}> 不修改</label>
                                            <label class="bgsh-radio-label"><input type="radio" name="resizeMedals" value="1" ${settings.resizeMedals===1?'checked':''}> 修改所有</label>
                                            <label class="bgsh-radio-label"><input type="radio" name="resizeMedals" value="2" ${settings.resizeMedals===2?'checked':''}> 修改女优勋章</label>
                                        </div>
                                    </div>
                                    <div class="bgsh-setting-item">
                                        <label>🔄 替换勋章</label>
                                        <div class="bgsh-radio-group">
                                            <label class="bgsh-radio-label"><input type="radio" name="replaceMedals" value="0" ${settings.replaceMedals===0?'checked':''}> 不替换</label>
                                            <label class="bgsh-radio-label"><input type="radio" name="replaceMedals" value="1" ${settings.replaceMedals===1?'checked':''}> 替换所有</label>
                                            <label class="bgsh-radio-label"><input type="radio" name="replaceMedals" value="2" ${settings.replaceMedals===2?'checked':''}> 替换女优勋章</label>
                                        </div>
                                    </div>
                                </div>
                                <div class="bgsh-setting-group">
                                    <div class="bgsh-setting-item">
                                        <label for="titleStyleSizeInput">📏 标题字体大小</label>
                                        <input type="text" id="titleStyleSizeInput" value="${settings.titleStyleSize}">
                                    </div>
                                    <div class="bgsh-setting-item">
                                        <label for="titleStyleWeightInput">💪 标题字体粗细</label>
                                        <input type="text" id="titleStyleWeightInput" value="${settings.titleStyleWeight}">
                                    </div>
                                    <div class="bgsh-setting-item">
                                        <label for="largeResourceThresholdInput">📦 超大合集 大体积标题阈值：大于 <strong id="largeResourceThresholdValue">${settings.largeResourceThresholdGb}G</strong></label>
                                        <input type="range" id="largeResourceThresholdInput" value="${settings.largeResourceThresholdGb}" min="1" max="500" step="1" style="width:100%;">
                                        <span class="bgsh-hint">标题中识别到 G/GB/GiB 数值且超过该阈值时，显示橙色粗体。默认 50G，可自行调到 100G。</span>
                                    </div>
                                    <div class="bgsh-setting-item">
                                        <label for="threadPreviewCountInput">🖼️ 每个主题预览图数量</label>
                                        <input type="number" id="threadPreviewCountInput" value="${settings.threadPreviewCount}" min="1" max="12">
                                        <span class="bgsh-hint">适用于板块列表和搜索结果，范围 1–12 张</span>
                                    </div>
                                    <div class="bgsh-setting-item">
                                        <label for="visitedThreadColorInput">🎨 已查看主题颜色</label>
                                        <input type="color" id="visitedThreadColorInput" value="${settings.visitedThreadColor}">
                                        <span class="bgsh-hint">修改浏览器已访问主题链接的标题颜色</span>
                                    </div>
                                    <div class="bgsh-setting-item">
                                        <label for="largeResourceTitleColorInput">📦 超大合集 大体积标题颜色</label>
                                        <input type="color" id="largeResourceTitleColorInput" value="${settings.largeResourceTitleColor}">
                                        <span class="bgsh-hint">资源大小超过阈值的主题标题颜色</span>
                                    </div>
                                </div>
                                <div class="bgsh-setting-group">
                                    <div class="bgsh-switch-grid">
                                        <label class="bgsh-switch-label"><input type="checkbox" id="enableTitleStyleCheckbox" ${settings.enableTitleStyle?'checked':''}><span class="bgsh-switch-slider"></span><span class="bgsh-switch-text">启用帖子标题样式</span></label>
                                        <label class="bgsh-switch-label"><input type="checkbox" id="showAvatarCheckbox" ${settings.showAvatar?'checked':''}><span class="bgsh-switch-slider"></span><span class="bgsh-switch-text">显示用户头像</span></label>
                                        <label class="bgsh-switch-label"><input type="checkbox" id="defaultHidePostImagesCheckbox" ${settings.defaultHidePostImages?'checked':''}><span class="bgsh-switch-slider"></span><span class="bgsh-switch-text">进入帖子默认隐藏图片</span></label>
                                        <label class="bgsh-switch-label"><input type="checkbox" id="displayThreadImagesCheckbox" ${settings.displayThreadImages?'checked':''}><span class="bgsh-switch-slider"></span><span class="bgsh-switch-text">图片预览</span></label>
                                        <label class="bgsh-switch-label"><input type="checkbox" id="previewWheelResizeEnabledCheckbox" ${settings.previewWheelResizeEnabled?'checked':''}><span class="bgsh-switch-slider"></span><span class="bgsh-switch-text">预览图滚轮调节</span></label>
                                        <label class="bgsh-switch-label"><input type="checkbox" id="displayThreadBuyInfoCheckbox" ${settings.displayThreadBuyInfo?'checked':''}><span class="bgsh-switch-slider"></span><span class="bgsh-switch-text">全站显示已售人数</span></label>
                                        <label class="bgsh-switch-label"><input type="checkbox" id="isShowWatermarkMessageCheckbox" ${settings.isShowWatermarkMessage?'checked':''}><span class="bgsh-switch-slider"></span><span class="bgsh-switch-text">点击特效</span></label>
                                    </div>
                                    <div class="bgsh-setting-item" style="margin-top:12px;">
                                        <label for="clickEffectStyleSelect">✨ 点击特效样式</label>
                                        <select id="clickEffectStyleSelect">
                                            <option value="ripple" ${settings.clickEffectStyle==='ripple'?'selected':''}>涟漪光圈</option>
                                            <option value="heart" ${settings.clickEffectStyle==='heart'?'selected':''}>爱心飞散</option>
                                            <option value="sparkle" ${settings.clickEffectStyle==='sparkle'?'selected':''}>星光闪烁</option>
                                            <option value="firework" ${settings.clickEffectStyle==='firework'?'selected':''}>彩色烟花</option>
                                        </select>
                                        <span class="bgsh-hint">开启“点击特效”后，点击页面任意位置都会显示所选效果。</span>
                                    </div>
                                </div>
                                <div class="bgsh-setting-group">
                                    <div class="bgsh-setting-item">
                                        <label class="bgsh-switch-label">
                                            <input type="checkbox" id="customBackgroundEnabledCheckbox" ${settings.customBackgroundEnabled?'checked':''}>
                                            <span class="bgsh-switch-slider"></span>
                                            <span class="bgsh-switch-text">🖼️ 启用自定义背景图</span>
                                        </label>
                                    </div>
                                    <div class="bgsh-setting-item" style="margin-top:12px;">
                                        <label for="customBackgroundImageInput">🔗 背景图片网址</label>
                                        <input type="text" id="customBackgroundImageInput" value="${escapeSearchHtml(settings.customBackgroundImage || '')}" placeholder="https://example.com/background.jpg">
                                        <span class="bgsh-hint">支持 HTTP/HTTPS 图片网址，也可以选择本地图片。背景只作用于页面底层，不遮挡文字和按钮。</span>
                                    </div>
                                    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;">
                                        <button type="button" class="bgsh-customBtn" id="chooseCustomBackgroundFile" style="width:auto;">📁 选择本地图片</button>
                                        <button type="button" class="bgsh-customBtn" id="clearCustomBackground" style="width:auto;background:linear-gradient(135deg,#ff6b6b,#ee5a24);color:#fff;">🧹 清除背景</button>
                                        <input type="file" id="customBackgroundFileInput" accept="image/*" hidden>
                                    </div>
                                    <div class="bgsh-setting-item" style="margin-top:12px;">
                                        <label for="customBackgroundOpacityInput">🌫️ 背景图可见度：<strong id="customBackgroundOpacityValue">${settings.customBackgroundOpacity}%</strong></label>
                                        <input type="range" id="customBackgroundOpacityInput" value="${settings.customBackgroundOpacity}" min="0" max="100" step="1" style="width:100%;">
                                        <span class="bgsh-hint">数值越低背景越淡；推荐 15%～25%，可保证文字清晰。</span>
                                    </div>
                                    <div class="bgsh-setting-item" style="margin-top:12px;">
                                        <label for="customBackgroundBlurInput">🫧 背景模糊度：<strong id="customBackgroundBlurValue">${settings.customBackgroundBlur}px</strong></label>
                                        <input type="range" id="customBackgroundBlurInput" value="${settings.customBackgroundBlur}" min="0" max="10" step="1" style="width:100%;">
                                        <span class="bgsh-hint">范围 0～10px；滑动时通过 backdrop-filter 实时调整背景模糊效果。</span>
                                    </div>
                                    <div id="customBackgroundPreview" style="position:relative;height:110px;margin-top:12px;border:1px dashed rgba(247,151,30,.55);border-radius:10px;display:flex;align-items:center;justify-content:center;color:#9a6a35;font-size:12px;overflow:hidden;">
                                        <div id="customBackgroundPreviewLayer" style="position:absolute;inset:-12px;background-position:center;background-size:cover;pointer-events:none;"></div>
                                        <span id="customBackgroundPreviewText" style="position:relative;z-index:1;">背景预览</span>
                                    </div>
                                </div>
                                <div class="bgsh-setting-group">
                                    <div class="bgsh-setting-item">
                                        <label class="bgsh-switch-label">
                                            <input type="checkbox" id="textRenderingEnhancementEnabledCheckbox" ${settings.textRenderingEnhancementEnabled?'checked':''}>
                                            <span class="bgsh-switch-slider"></span>
                                            <span class="bgsh-switch-text">🔤 文字锐化与亮度适配</span>
                                        </label>
                                        <span class="bgsh-hint">启用自定义背景图时会强制开启并锁定，以保证透明和模糊背景上的文字清晰度；关闭背景后可单独调整。</span>
                                    </div>
                                    <div class="bgsh-setting-item" style="margin-top:12px;">
                                        <label class="bgsh-switch-label">
                                            <input type="checkbox" id="customTextColorEnabledCheckbox" ${settings.customTextColorEnabled?'checked':''}>
                                            <span class="bgsh-switch-slider"></span>
                                            <span class="bgsh-switch-text">🎨 启用全局文字颜色（默认关闭）</span>
                                        </label>
                                    </div>
                                    <div class="bgsh-setting-group" style="margin-top:12px;">
                                        <div class="bgsh-setting-item">
                                            <label for="customTextColorInput">🖌️ 文字颜色</label>
                                            <input type="color" id="customTextColorInput" value="${settings.customTextColor}">
                                        </div>
                                        <div class="bgsh-setting-item">
                                            <label for="customTextContrastModeSelect">🛡️ 对比增强</label>
                                            <select id="customTextContrastModeSelect">
                                                <option value="stroke" ${settings.customTextContrastMode==='stroke'?'selected':''}>1px 对比色描边（默认）</option>
                                                <option value="stroke12" ${settings.customTextContrastMode==='stroke12'?'selected':''}>1.2px 适中描边</option>
                                                <option value="stroke2" ${settings.customTextContrastMode==='stroke2'?'selected':''}>2px 强对比黑描边</option>
                                                <option value="shadow" ${settings.customTextContrastMode==='shadow'?'selected':''}>半透明对比色阴影</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div id="customTextColorPreview" style="height:72px;margin-top:10px;border:1px solid rgba(247,151,30,.35);border-radius:10px;background:linear-gradient(90deg,#f4f4f4 0 50%,#292929 50% 100%);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;">
                                        自定义文字效果预览
                                    </div>
                                    <span class="bgsh-hint">描边/阴影会根据所选文字颜色自动使用黑色或白色，启用后将暂停逐行黑白自动切换。</span>
                                </div>
                            </div>
                            <!-- 功能 -->
                            <div class="bgsh-tab-panel" id="tab-features">
                                <div class="bgsh-setting-group">
                                    <div class="bgsh-switch-grid">
                                        <label class="bgsh-switch-label"><input type="checkbox" id="showDownCheckbox" ${settings.showDown?'checked':''}><span class="bgsh-switch-slider"></span><span class="bgsh-switch-text">下载附件</span></label>
                                        <label class="bgsh-switch-label"><input type="checkbox" id="showCopyCodeCheckbox" ${settings.showCopyCode?'checked':''}><span class="bgsh-switch-slider"></span><span class="bgsh-switch-text">复制代码</span></label>
                                        <label class="bgsh-switch-label"><input type="checkbox" id="showFastPostCheckbox" ${settings.showFastPost?'checked':''}><span class="bgsh-switch-slider"></span><span class="bgsh-switch-text">快速发帖</span></label>
                                        <label class="bgsh-switch-label"><input type="checkbox" id="showFastReplyCheckbox" ${settings.showFastReply?'checked':''}><span class="bgsh-switch-slider"></span><span class="bgsh-switch-text">快速回复</span></label>
                                        <label class="bgsh-switch-label"><input type="checkbox" id="showQuickGradeCheckbox" ${settings.showQuickGrade?'checked':''}><span class="bgsh-switch-slider"></span><span class="bgsh-switch-text">一键评分</span></label>
                                        <label class="bgsh-switch-label"><input type="checkbox" id="showQuickStarCheckbox" ${settings.showQuickStar?'checked':''}><span class="bgsh-switch-slider"></span><span class="bgsh-switch-text">快速收藏</span></label>
                                        <label class="bgsh-switch-label"><input type="checkbox" id="showClickDoubleCheckbox" ${settings.showClickDouble?'checked':''}><span class="bgsh-switch-slider"></span><span class="bgsh-switch-text">一键二连</span></label>
                                        <label class="bgsh-switch-label"><input type="checkbox" id="showViewRatingsCheckbox" ${settings.showViewRatings?'checked':''}><span class="bgsh-switch-slider"></span><span class="bgsh-switch-text">查看评分</span></label>
                                        <label class="bgsh-switch-label"><input type="checkbox" id="showPayLogCheckbox" ${settings.showPayLog?'checked':''}><span class="bgsh-switch-slider"></span><span class="bgsh-switch-text">购买记录</span></label>
                                        <label class="bgsh-switch-label"><input type="checkbox" id="showFastCopyCheckbox" ${settings.showFastCopy?'checked':''}><span class="bgsh-switch-slider"></span><span class="bgsh-switch-text">复制帖子</span></label>
                                        <label class="bgsh-switch-label"><input type="checkbox" id="blockingIndexCheckbox" ${settings.blockingIndex?'checked':''}><span class="bgsh-switch-slider"></span><span class="bgsh-switch-text">屏蔽首页热门</span></label>
                                    </div>
                                </div>
                                <div class="bgsh-setting-group">
                                    <div class="bgsh-setting-item">
                                        <label>🛒 出售主题工具</label>
                                        <div id="bgshSyncSaleThreadsSettingsMount" style="margin-top:10px;"></div>
                                        <span class="bgsh-hint">同步当前页面已加载出售主题的购买人数和“已购买”状态。</span>
                                    </div>
                                </div>
                                <div class="bgsh-setting-group">
                                    <div class="bgsh-switch-grid">
                                        <label class="bgsh-switch-label"><input type="checkbox" id="postImageLazyLoadCheckbox" ${settings.postImageLazyLoad?'checked':''}><span class="bgsh-switch-slider"></span><span class="bgsh-switch-text">帖子图片分批懒加载</span></label>
                                    </div>
                                    <div class="bgsh-setting-item" style="margin-top:12px;">
                                        <label for="postImageLazyBatchSizeInput">🖼️ 每批加载图片数</label>
                                        <input type="number" id="postImageLazyBatchSizeInput" value="${settings.postImageLazyBatchSize}" min="1" max="20">
                                        <span class="bgsh-hint">图片进入可视区附近后按批加载，可在楼内图片上点击“查看原图”。</span>
                                    </div>
                                </div>
                                <div class="bgsh-setting-group">
                                    <div class="bgsh-setting-item">
                                        <label for="followedAuthorsList">👤 关注作者（每行一个作者名）</label>
                                        <textarea id="followedAuthorsList" rows="6" placeholder="例如：作者甲&#10;作者乙">${escapeSearchHtml((settings.followedAuthors || []).join("\n"))}</textarea>
                                        <span class="bgsh-hint">可手动维护名单，也可在主题页面点击“关注作者”按钮添加</span>
                                    </div>
                                </div>
                            </div>
                            <!-- 搜索 -->
                            <div class="bgsh-tab-panel" id="tab-search">
                                <div class="bgsh-setting-group">
                                    <div class="bgsh-switch-grid">
                                        <label class="bgsh-switch-label">
                                            <input type="checkbox" id="searchCacheEnabled" ${settings.searchCacheEnabled?'checked':''}>
                                            <span class="bgsh-switch-slider"></span>
                                            <span class="bgsh-switch-text">⚡ 搜索缓存</span>
                                        </label>
                                        <label class="bgsh-switch-label">
                                            <input type="checkbox" id="searchAutoComplete" ${settings.searchAutoComplete?'checked':''}>
                                            <span class="bgsh-switch-slider"></span>
                                            <span class="bgsh-switch-text">📝 自动补全</span>
                                        </label>
                                        <label class="bgsh-switch-label">
                                            <input type="checkbox" id="searchHotKeys" ${settings.searchHotKeys?'checked':''}>
                                            <span class="bgsh-switch-slider"></span>
                                            <span class="bgsh-switch-text">⌨️ 快捷键 (Ctrl+Shift+F)</span>
                                        </label>
                                    </div>
                                </div>
                                <div class="bgsh-setting-group">
                                    <div class="bgsh-setting-item">
                                        <label>🔢 默认排序方式</label>
                                        <div class="bgsh-radio-group">
                                            <label class="bgsh-radio-label"><input type="radio" name="settingsSearchSort" value="native" ${settings.searchSort==="native"?"checked":""}> 网站默认</label>
                                            <label class="bgsh-radio-label"><input type="radio" name="settingsSearchSort" value="dateline" ${settings.searchSort==="dateline"?"checked":""}> 发布时间</label>
                                            <label class="bgsh-radio-label"><input type="radio" name="settingsSearchSort" value="lastpost" ${settings.searchSort==="lastpost"?"checked":""}> 回复时间</label>
                                        </div>
                                        <span class="bgsh-hint">设置搜索时的默认排序方式</span>
                                    </div>
                                </div>
                                <div class="bgsh-setting-group">
                                    <div class="bgsh-setting-item">
                                        <label for="searchHistoryCount">📊 保存历史数量</label>
                                        <input type="number" id="searchHistoryCount" value="${settings.searchHistoryCount}" min="5" max="50">
                                        <span class="bgsh-hint">保存的搜索历史条目数</span>
                                    </div>
                                </div>
                                <div class="bgsh-setting-group">
                                    <button class="bgsh-customBtn" id="clearSearchCache" style="width:auto;background:linear-gradient(135deg,#ff6b6b,#ee5a24);color:#fff;">🗑️ 清空搜索缓存</button>
                                    <button class="bgsh-customBtn" id="clearSearchHistory" style="width:auto;background:linear-gradient(135deg,#ff6b6b,#ee5a24);color:#fff;">🗑️ 清空搜索历史</button>
                                </div>
                            </div>
                            <!-- 屏蔽 -->
                            <div class="bgsh-tab-panel" id="tab-block">
                                <div class="bgsh-setting-group">
                                    <div class="bgsh-setting-item">
                                        <label for="blockedUsersList">🚫 黑名单用户名（每行一个）</label>
                                        <textarea id="blockedUsersList" rows="4">${settings.blockedUsers.join("\n")}</textarea>
                                        <span class="bgsh-hint">输入需要屏蔽的用户名，每行一个</span>
                                    </div>
                                    <label class="bgsh-switch-label">
                                        <input type="checkbox" id="displayBlockedTipsCheckbox" ${settings.displayBlockedTips?'checked':''}>
                                        <span class="bgsh-switch-slider"></span>
                                        <span class="bgsh-switch-text">显示屏蔽提示</span>
                                    </label>
                                </div>
                            </div>
                            <!-- 数据 -->
                            <div class="bgsh-tab-panel" id="tab-data">
                                <div class="bgsh-setting-group">
                                    <div class="bgsh-setting-item">
                                        <label>📦 设置与收藏备份</label>
                                        <span class="bgsh-hint">导出包含功能设置、关注作者、黑名单、搜索条件和本地收藏目录；不包含临时搜索缓存。</span>
                                    </div>
                                    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;">
                                        <button class="bgsh-customBtn" id="exportSettingsData" style="width:auto;">⬇️ 导出备份</button>
                                        <button class="bgsh-customBtn" id="importSettingsData" style="width:auto;background:linear-gradient(135deg,#4facfe,#00f2fe);color:#fff;">⬆️ 导入备份</button>
                                        <input type="file" id="importSettingsFile" accept="application/json,.json" hidden>
                                    </div>
                                </div>
                                <div class="bgsh-setting-group">
                                    <span class="bgsh-hint">导入前会要求确认；导入成功后页面将自动刷新，使新设置立即生效。</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="bgsh-dialog-footer">
                        <button class="bgsh-customBtn" id="resetButton" style="width:auto;background:rgba(255,255,255,0.5);color:#666;">🔄 重置默认</button>
                        <button class="bgsh-customBtn" id="saveButton" style="width:auto;">💾 保存设置</button>
                    </div>
                </div>
            </div>
        `;
    }

    function createSettingsUI(settings) {
        const existingContainer = document.getElementById("settingsUIContainer");
        if (existingContainer) {
            existingContainer.remove();
        }

        applyTheme(getTheme());

        const containerHTML = generateSettingsHTML(settings);
        const container = document.createElement("div");
        container.id = "settingsUIContainer";
        container.innerHTML = containerHTML;
        document.body.appendChild(container);
        mountSyncSaleThreadsButtonInSettings(settings, container);

        const dialog = document.getElementById("bgshSettingsDrag");
        const handle = document.getElementById("bgshSettingsDragHandle");
        let cleanupDrag = function() {};
        if (dialog && handle) {
            cleanupDrag = makeDraggable(dialog, handle);
        }

        const saveButton = document.getElementById("saveButton");
        const closeButton = document.getElementById("closeButton");
        const resetButton = document.getElementById("resetButton");

        const closeSettings = function() {
            cleanupDrag();
            document.removeEventListener('keydown', escHandler);
            container.remove();
        };

        const clearCacheBtn = document.getElementById("clearSearchCache");
        if (clearCacheBtn) {
            clearCacheBtn.addEventListener("click", function() {
                const keys = typeof GM_listValues === "function" ? GM_listValues() : [];
                let count = 0;
                keys.forEach(key => {
                    if (key.startsWith('bgsh_cache_') || key === 'bgshSearchBoardsV474') {
                        GM_deleteValue(key);
                        count++;
                    }
                });
                showToast("🗑️ 已清空 " + count + " 条搜索缓存", "success");
            });
        }

        const clearHistoryBtn = document.getElementById("clearSearchHistory");
        if (clearHistoryBtn) {
            clearHistoryBtn.addEventListener("click", function() {
                GM_setValue('bgshSearchHistory', JSON.stringify([]));
                showToast("🗑️ 搜索历史已清空", "success");
            });
        }

        const largeResourceThresholdInput = document.getElementById("largeResourceThresholdInput");
        const largeResourceThresholdValue = document.getElementById("largeResourceThresholdValue");
        if (largeResourceThresholdInput) {
            largeResourceThresholdInput.addEventListener("input", function() {
                var threshold = Math.max(1, Math.min(500,
                    parseInt(largeResourceThresholdInput.value, 10) || 50));
                if (largeResourceThresholdValue) largeResourceThresholdValue.textContent = threshold + "G";
                setupLargeResourceTitleHighlights({ largeResourceThresholdGb: threshold });
            });
        }

        const backgroundEnabledInput = document.getElementById("customBackgroundEnabledCheckbox");
        const backgroundImageInput = document.getElementById("customBackgroundImageInput");
        const backgroundOpacityInput = document.getElementById("customBackgroundOpacityInput");
        const backgroundOpacityValue = document.getElementById("customBackgroundOpacityValue");
        const backgroundBlurInput = document.getElementById("customBackgroundBlurInput");
        const backgroundBlurValue = document.getElementById("customBackgroundBlurValue");
        const backgroundPreview = document.getElementById("customBackgroundPreview");
        const backgroundPreviewLayer = document.getElementById("customBackgroundPreviewLayer");
        const backgroundPreviewText = document.getElementById("customBackgroundPreviewText");
        const backgroundFileInput = document.getElementById("customBackgroundFileInput");
        const chooseBackgroundFile = document.getElementById("chooseCustomBackgroundFile");
        const clearBackgroundButton = document.getElementById("clearCustomBackground");
        const textRenderingEnhancementInput = document.getElementById("textRenderingEnhancementEnabledCheckbox");

        function syncForcedTextRenderingEnhancement() {
            if (!textRenderingEnhancementInput || !backgroundEnabledInput) return;
            if (backgroundEnabledInput.checked) {
                textRenderingEnhancementInput.checked = true;
                textRenderingEnhancementInput.disabled = true;
                textRenderingEnhancementInput.title = "启用自定义背景时强制开启";
            } else {
                textRenderingEnhancementInput.disabled = false;
                textRenderingEnhancementInput.title = "";
            }
        }

        function updateCustomBackgroundPreview() {
            if (!backgroundPreview || !backgroundPreviewLayer || !backgroundImageInput ||
                !backgroundOpacityInput || !backgroundBlurInput) return;
            var image = normalizeCustomBackgroundImage(backgroundImageInput.value);
            var opacity = Math.max(0, Math.min(100, parseInt(backgroundOpacityInput.value, 10) || 0));
            var blur = Math.max(0, Math.min(10, parseInt(backgroundBlurInput.value, 10) || 0));
            if (backgroundOpacityValue) backgroundOpacityValue.textContent = opacity + "%";
            if (backgroundBlurValue) backgroundBlurValue.textContent = blur + "px";
            document.documentElement.style.setProperty("--bgsh-custom-background-blur", blur + "px");
            backgroundPreviewLayer.style.filter = "blur(" + blur + "px)";
            backgroundPreview.style.setProperty("backdrop-filter", "blur(" + blur + "px)");
            backgroundPreview.style.setProperty("-webkit-backdrop-filter", "blur(" + blur + "px)");
            if (!image) {
                backgroundPreviewLayer.style.backgroundImage = "none";
                if (backgroundPreviewText) {
                    backgroundPreviewText.textContent = backgroundImageInput.value.trim()
                        ? "图片地址无效" : "背景预览";
                }
                return;
            }
            var escaped = image.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n\f]/g, "");
            var overlay = (1 - opacity / 100).toFixed(2);
            backgroundPreviewLayer.style.backgroundImage =
                "linear-gradient(rgba(255,248,235," + overlay + "),rgba(255,248,235," + overlay + ")),url(\"" + escaped + "\")";
            if (backgroundPreviewText) backgroundPreviewText.textContent = "";
        }

        if (backgroundOpacityInput) backgroundOpacityInput.addEventListener("input", updateCustomBackgroundPreview);
        if (backgroundBlurInput) backgroundBlurInput.addEventListener("input", updateCustomBackgroundPreview);
        if (backgroundImageInput) backgroundImageInput.addEventListener("input", updateCustomBackgroundPreview);
        if (backgroundEnabledInput) {
            backgroundEnabledInput.addEventListener("change", function() {
                syncForcedTextRenderingEnhancement();
                updateCustomBackgroundPreview();
            });
        }
        if (chooseBackgroundFile && backgroundFileInput) {
            chooseBackgroundFile.addEventListener("click", function() {
                backgroundFileInput.value = "";
                backgroundFileInput.click();
            });
            backgroundFileInput.addEventListener("change", function() {
                var file = backgroundFileInput.files && backgroundFileInput.files[0];
                if (!file) return;
                if (!/^image\//i.test(file.type || "")) {
                    showToast("请选择图片文件", "warning");
                    return;
                }
                if (file.size > 5 * 1024 * 1024) {
                    showToast("本地背景图不能超过 5 MB", "warning");
                    return;
                }
                var reader = new FileReader();
                reader.onload = function() {
                    backgroundImageInput.value = String(reader.result || "");
                    if (backgroundEnabledInput) backgroundEnabledInput.checked = true;
                    syncForcedTextRenderingEnhancement();
                    updateCustomBackgroundPreview();
                    showToast("✅ 已载入本地背景图，点击保存后生效", "success");
                };
                reader.onerror = function() { showToast("读取图片失败", "error"); };
                reader.readAsDataURL(file);
            });
        }
        if (clearBackgroundButton) {
            clearBackgroundButton.addEventListener("click", function() {
                if (backgroundImageInput) backgroundImageInput.value = "";
                if (backgroundEnabledInput) backgroundEnabledInput.checked = false;
                syncForcedTextRenderingEnhancement();
                updateCustomBackgroundPreview();
            });
        }
        syncForcedTextRenderingEnhancement();
        updateCustomBackgroundPreview();

        const customTextEnabledInput = document.getElementById("customTextColorEnabledCheckbox");
        const customTextColorInput = document.getElementById("customTextColorInput");
        const customTextModeSelect = document.getElementById("customTextContrastModeSelect");
        const customTextPreview = document.getElementById("customTextColorPreview");

        function updateCustomTextPreview() {
            if (!customTextColorInput || !customTextModeSelect || !customTextPreview) return;
            var color = normalizeTextColor(customTextColorInput.value);
            customTextPreview.style.setProperty("color", color, "important");
            customTextPreview.style.opacity = customTextEnabledInput && !customTextEnabledInput.checked ? "0.62" : "1";
            if (customTextModeSelect.value === "shadow") {
                var shadow = getContrastingTextEffectColor(color, 0.74);
                customTextPreview.style.setProperty("-webkit-text-stroke", "0 transparent", "important");
                customTextPreview.style.setProperty("text-shadow",
                    "0 1px 0.85px " + shadow, "important");
            } else if (customTextModeSelect.value === "stroke12") {
                customTextPreview.style.setProperty("-webkit-text-stroke",
                    "1.2px " + getContrastingTextEffectColor(color, 0.96), "important");
                customTextPreview.style.setProperty("text-shadow", "none", "important");
            } else if (customTextModeSelect.value === "stroke2") {
                customTextPreview.style.setProperty("-webkit-text-stroke", "2px #000000", "important");
                customTextPreview.style.setProperty("text-shadow", "none", "important");
            } else {
                customTextPreview.style.setProperty("-webkit-text-stroke",
                    "1px " + getContrastingTextEffectColor(color, 0.96), "important");
                customTextPreview.style.setProperty("text-shadow", "none", "important");
            }
        }
        if (customTextEnabledInput) customTextEnabledInput.addEventListener("change", updateCustomTextPreview);
        if (customTextColorInput) customTextColorInput.addEventListener("input", updateCustomTextPreview);
        if (customTextModeSelect) customTextModeSelect.addEventListener("change", updateCustomTextPreview);
        updateCustomTextPreview();

        const exportDataBtn = document.getElementById("exportSettingsData");
        if (exportDataBtn) {
            exportDataBtn.addEventListener("click", function() {
                try {
                    var count = exportSettingsBackup();
                    showToast("✅ 已导出 " + count + " 项设置/收藏数据", "success");
                } catch (error) {
                    errorLog("导出备份失败:", error);
                    showToast("❌ 导出备份失败", "error");
                }
            });
        }

        const importDataBtn = document.getElementById("importSettingsData");
        const importDataInput = document.getElementById("importSettingsFile");
        if (importDataBtn && importDataInput) {
            importDataBtn.addEventListener("click", function() {
                importDataInput.value = "";
                importDataInput.click();
            });
            importDataInput.addEventListener("change", async function() {
                try {
                    var count = await importSettingsBackup(importDataInput.files && importDataInput.files[0]);
                    if (!count) return;
                    showToast("✅ 已导入 " + count + " 项数据，即将刷新", "success");
                    setTimeout(function() { location.reload(); }, 900);
                } catch (error) {
                    errorLog("导入备份失败:", error);
                    showToast("❌ " + (error && error.message ? error.message : "导入备份失败"), "error");
                }
            });
        }

        saveButton.addEventListener("click", function() {
            saveSettings(settings);
            closeSettings();
            showToast("✅ 设置已保存", "success");
        });

        closeButton.addEventListener("click", closeSettings);

        resetButton.addEventListener("click", function() {
            if (confirm("确定要重置所有设置为默认值吗？")) {
                resetSettings();
                closeSettings();
                showToast("🔄 已重置为默认值", "warning");
                setTimeout(() => location.reload(), 500);
            }
        });

        const tabBtns = container.querySelectorAll(".bgsh-tab-btn");
        const tabPanels = container.querySelectorAll(".bgsh-tab-panel");

        tabBtns.forEach((btn) => {
            btn.addEventListener("click", function() {
                tabBtns.forEach((b) => b.classList.remove("active"));
                tabPanels.forEach((p) => p.classList.remove("active"));
                this.classList.add("active");
                const targetId = this.dataset.tab;
                document.getElementById(targetId).classList.add("active");
            });
        });

        container.addEventListener("click", function(e) {
            if (e.target && e.target.id === "settingsUIOverlay") {
                closeSettings();
            }
        });

        const escHandler = (e) => {
            if (e.key === 'Escape' && container.isConnected) closeSettings();
        };
        document.addEventListener('keydown', escHandler);
    }

    function makeDraggable(container, handle) {
        let isDragging = false;
        let startX, startY, origX, origY;

        const onMouseDown = (e) => {
            if (e.target.closest('button')) return;
            isDragging = true;
            const rect = container.getBoundingClientRect();
            startX = e.clientX;
            startY = e.clientY;
            origX = rect.left;
            origY = rect.top;
            container.style.transition = 'none';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        };

        const onMouseMove = (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            container.style.left = (origX + dx) + 'px';
            container.style.top = (origY + dy) + 'px';
            container.style.transform = 'none';
        };

        const onMouseUp = () => {
            if (isDragging) {
                isDragging = false;
                container.style.transition = '';
                document.body.style.userSelect = '';
            }
        };

        handle.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        return function() {
            handle.removeEventListener('mousedown', onMouseDown);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.style.userSelect = '';
        };
    }

    function resetSettings() {
        const defaults = {
            logoText: "永久地址 WWW.98T.LA",
            tipsText: "九八堂提醒你",
            imageSize: "50px",
            imageUrl: "/static/image/common/logo.png",
            blockMedals: 0,
            resizeMedals: 0,
            replaceMedals: 0,
            displayBlockedTips: true,
            autoPagination: true,
            showImageButton: "show",
            defaultHidePostImages: true,
            enableTitleStyle: true,
            titleStyleSize: 20,
            titleStyleWeight: 700,
            largeResourceThresholdGb: 50,
            blockedUsers: [],
            followedAuthors: [],
            showAvatar: true,
            maxGradeThread: 10,
            defaultSwipeToSearch: true,
            displayThreadImages: false,
            previewWheelResizeEnabled: true,
            threadPreviewCount: 3,
            bgsh_previewSize: 180,
            visitedThreadColor: "#999999",
            largeResourceTitleColor: "#ff6a00",
            displayThreadBuyInfo: true,
            bgshCustomBackgroundEnabled: false,
            bgshCustomBackgroundImage: "",
            bgshCustomBackgroundOpacity: 25,
            bgshCustomBackgroundBlur: 0,
            bgshTextRenderingEnhancementEnabled: false,
            bgshCustomTextColorEnabled: false,
            bgshCustomTextColor: "#ffffff",
            bgshCustomTextContrastMode: "stroke",
            isShowWatermarkMessage: true,
            clickEffectStyle: "ripple",
            postImageLazyLoad: true,
            postImageLazyBatchSize: 6,
            showDown: true,
            showCopyCode: true,
            showFastPost: true,
            showFastReply: true,
            showQuickGrade: true,
            showQuickStar: true,
            showClickDouble: true,
            showViewRatings: true,
            showPayLog: true,
            showFastCopy: true,
            blockingResolved: true,
            isOnlyShowMoney: false,
            blockingIndex: false,
            menuButtonIsVisible: true,
            searchCacheEnabled: true,
            searchAutoComplete: true,
            searchHistoryCount: 20,
            searchResultCount: 50,
            searchHotKeys: true,
            searchSort: "native",
            forumDefaultSort: "dateline",
            bgshSearchSort: "native",
        };

        for (let key in defaults) {
            GM_setValue(key, defaults[key]);
        }
        GM_deleteValue(FOLLOWED_AUTHOR_SEEN_KEY);
        GM_deleteValue(FOLLOW_AUTHOR_GROUPS_KEY);
        GM_deleteValue(FOLLOW_AUTHOR_CUSTOM_GROUPS_KEY);
        GM_deleteValue("bgshFollowAuthorExpandedGroups");
    }

    function saveSettings(settings) {
        const oldSettings = getSettings();

        settings.imageSize = document.getElementById("imageSizeInput").value;
        settings.logoText = document.getElementById("logoTextInput").value;
        settings.titleStyleSize = document.getElementById("titleStyleSizeInput").value;
        settings.titleStyleWeight = document.getElementById("titleStyleWeightInput").value;
        settings.largeResourceThresholdGb = Math.max(1, Math.min(500,
            parseInt(document.getElementById("largeResourceThresholdInput").value, 10) || 50));
        settings.threadPreviewCount = Math.max(1, Math.min(12, parseInt(document.getElementById("threadPreviewCountInput").value, 10) || 3));
        settings.visitedThreadColor = document.getElementById("visitedThreadColorInput").value || "#999999";
        settings.largeResourceTitleColor = document.getElementById("largeResourceTitleColorInput").value || "#ff6a00";
        settings.tipsText = document.getElementById("tipsTextInput").value;
        settings.showDown = document.getElementById("showDownCheckbox").checked;
        settings.showCopyCode = document.getElementById("showCopyCodeCheckbox").checked;
        settings.showFastPost = document.getElementById("showFastPostCheckbox").checked;
        settings.showFastReply = document.getElementById("showFastReplyCheckbox").checked;
        settings.showQuickGrade = document.getElementById("showQuickGradeCheckbox").checked;
        settings.showQuickStar = document.getElementById("showQuickStarCheckbox").checked;
        settings.showClickDouble = document.getElementById("showClickDoubleCheckbox").checked;
        settings.showViewRatings = document.getElementById("showViewRatingsCheckbox").checked;
        settings.showPayLog = document.getElementById("showPayLogCheckbox").checked;
        settings.showFastCopy = document.getElementById("showFastCopyCheckbox").checked;
        settings.blockingIndex = document.getElementById("blockingIndexCheckbox").checked;
        settings.imageUrl = document.getElementById("imageUrlInput").value;
        settings.displayBlockedTips = document.getElementById("displayBlockedTipsCheckbox").checked;
        settings.blockedUsers = document.getElementById("blockedUsersList").value.split("\n")
            .map(name => name.trim()).filter(user => user.trim() !== "");
        settings.followedAuthors = Array.from(new Set(
            document.getElementById("followedAuthorsList").value.split("\n")
                .map(function(name) { return name.trim(); })
                .filter(Boolean)
        ));
        var followedAuthorNames = new Set(settings.followedAuthors.map(function(name) {
            return name.toLocaleLowerCase();
        }));
        getFollowedAuthors().forEach(function(name) {
            if (!followedAuthorNames.has(name.toLocaleLowerCase())) clearFollowedAuthorSeenUpdate(name);
        });
        syncFollowAuthorGroupAssignments(settings.followedAuthors);
        settings.enableTitleStyle = document.getElementById("enableTitleStyleCheckbox").checked;
        settings.autoPagination = document.getElementById("autoPaginationCheckbox").checked;
        settings.blockMedals = getCheckedRadioValue("blockMedals");
        settings.resizeMedals = getCheckedRadioValue("resizeMedals");
        settings.replaceMedals = getCheckedRadioValue("replaceMedals");
        settings.showAvatar = document.getElementById("showAvatarCheckbox").checked;
        settings.defaultHidePostImages = document.getElementById("defaultHidePostImagesCheckbox").checked;
        settings.displayThreadImages = document.getElementById("displayThreadImagesCheckbox").checked;
        settings.previewWheelResizeEnabled = document.getElementById("previewWheelResizeEnabledCheckbox").checked;
        settings.displayThreadBuyInfo = document.getElementById("displayThreadBuyInfoCheckbox").checked;
        settings.customBackgroundEnabled = document.getElementById("customBackgroundEnabledCheckbox").checked;
        settings.customBackgroundImage = document.getElementById("customBackgroundImageInput").value.trim();
        settings.customBackgroundOpacity = Math.max(0, Math.min(100,
            parseInt(document.getElementById("customBackgroundOpacityInput").value, 10) || 0));
        settings.customBackgroundBlur = Math.max(0, Math.min(10,
            parseInt(document.getElementById("customBackgroundBlurInput").value, 10) || 0));
        settings.textRenderingEnhancementEnabled = settings.customBackgroundEnabled ||
            document.getElementById("textRenderingEnhancementEnabledCheckbox").checked;
        settings.customTextColorEnabled = document.getElementById("customTextColorEnabledCheckbox").checked;
        settings.customTextColor = normalizeTextColor(document.getElementById("customTextColorInput").value);
        var contrastModeValue = document.getElementById("customTextContrastModeSelect").value;
        settings.customTextContrastMode = contrastModeValue === "shadow" ? "shadow" :
            contrastModeValue === "stroke12" ? "stroke12" :
            contrastModeValue === "stroke2" ? "stroke2" : "stroke";
        settings.isShowWatermarkMessage = document.getElementById("isShowWatermarkMessageCheckbox").checked;
        settings.clickEffectStyle = document.getElementById("clickEffectStyleSelect").value;
        settings.postImageLazyLoad = document.getElementById("postImageLazyLoadCheckbox").checked;
        settings.postImageLazyBatchSize = Math.max(1, Math.min(20, parseInt(document.getElementById("postImageLazyBatchSizeInput").value, 10) || 6));
        settings.maxGradeThread = document.getElementById("maxGradeThread").value;
        settings.defaultSwipeToSearch = document.getElementById("defaultSwipeToSearchCheckbox").checked;

        settings.searchCacheEnabled = document.getElementById("searchCacheEnabled").checked;
        settings.searchAutoComplete = document.getElementById("searchAutoComplete").checked;
        settings.searchHistoryCount = Math.max(5, Math.min(50, parseInt(document.getElementById("searchHistoryCount").value, 10) || 20));
        settings.searchHotKeys = document.getElementById("searchHotKeys").checked;
        settings.searchSort = document.querySelector('input[name="settingsSearchSort"]:checked')?.value || 'native';
        settings.forumDefaultSort = document.querySelector('input[name="settingsForumSort"]:checked')?.value || 'dateline';

        const settingsToSave = {
            imageSize: settings.imageSize,
            logoText: settings.logoText,
            tipsText: settings.tipsText,
            imageUrl: settings.imageUrl,
            blockMedals: settings.blockMedals,
            resizeMedals: settings.resizeMedals,
            replaceMedals: settings.replaceMedals,
            displayBlockedTips: settings.displayBlockedTips,
            blockedUsers: settings.blockedUsers,
            followedAuthors: settings.followedAuthors,
            enableTitleStyle: settings.enableTitleStyle,
            titleStyleSize: settings.titleStyleSize,
            titleStyleWeight: settings.titleStyleWeight,
            largeResourceThresholdGb: settings.largeResourceThresholdGb,
            autoPagination: settings.autoPagination,
            showAvatar: settings.showAvatar,
            defaultHidePostImages: settings.defaultHidePostImages,
            maxGradeThread: settings.maxGradeThread,
            defaultSwipeToSearch: settings.defaultSwipeToSearch,
            displayThreadImages: settings.displayThreadImages,
            previewWheelResizeEnabled: settings.previewWheelResizeEnabled,
            threadPreviewCount: settings.threadPreviewCount,
            visitedThreadColor: settings.visitedThreadColor,
            largeResourceTitleColor: settings.largeResourceTitleColor,
            displayThreadBuyInfo: settings.displayThreadBuyInfo,
            bgshCustomBackgroundEnabled: settings.customBackgroundEnabled,
            bgshCustomBackgroundImage: settings.customBackgroundImage,
            bgshCustomBackgroundOpacity: settings.customBackgroundOpacity,
            bgshCustomBackgroundBlur: settings.customBackgroundBlur,
            bgshTextRenderingEnhancementEnabled: settings.textRenderingEnhancementEnabled,
            bgshCustomTextColorEnabled: settings.customTextColorEnabled,
            bgshCustomTextColor: settings.customTextColor,
            bgshCustomTextContrastMode: settings.customTextContrastMode,
            isShowWatermarkMessage: settings.isShowWatermarkMessage,
            clickEffectStyle: settings.clickEffectStyle,
            postImageLazyLoad: settings.postImageLazyLoad,
            postImageLazyBatchSize: settings.postImageLazyBatchSize,
            showDown: settings.showDown,
            showCopyCode: settings.showCopyCode,
            showFastPost: settings.showFastPost,
            showFastReply: settings.showFastReply,
            showQuickGrade: settings.showQuickGrade,
            showQuickStar: settings.showQuickStar,
            showClickDouble: settings.showClickDouble,
            showViewRatings: settings.showViewRatings,
            showPayLog: settings.showPayLog,
            showFastCopy: settings.showFastCopy,
            blockingIndex: settings.blockingIndex,
            searchCacheEnabled: settings.searchCacheEnabled,
            searchAutoComplete: settings.searchAutoComplete,
            searchHistoryCount: settings.searchHistoryCount,
            searchHotKeys: settings.searchHotKeys,
            searchSort: settings.searchSort,
            forumDefaultSort: settings.forumDefaultSort,
        };

        for (let key in settingsToSave) {
            GM_setValue(key, settingsToSave[key]);
        }
        GM_setValue("bgshSearchSort", settings.searchSort);

        manipulateMedals(settings);
        applyVisitedThreadColor(settings);
        applyLargeResourceTitleColor(settings);
        applyTextRenderingEnhancement(settings);
        applyCustomTextAppearance(settings);
        applyCustomBackground(settings);
        setupLargeResourceTitleHighlights(settings);
        if (settings.enableTitleStyle) {
            stylePosts(settings);
        } else {
            undoStylePosts();
        }
        showAvatarEvent();

        if (oldSettings.blockingIndex !== settings.blockingIndex ||
            oldSettings.showFastCopy !== settings.showFastCopy ||
            oldSettings.showViewRatings !== settings.showViewRatings ||
            oldSettings.showPayLog !== settings.showPayLog ||
            oldSettings.showClickDouble !== settings.showClickDouble ||
            oldSettings.showQuickStar !== settings.showQuickStar ||
            oldSettings.showQuickGrade !== settings.showQuickGrade ||
            oldSettings.showFastReply !== settings.showFastReply ||
            oldSettings.showFastPost !== settings.showFastPost ||
            oldSettings.showCopyCode !== settings.showCopyCode ||
            oldSettings.showDown !== settings.showDown ||
            oldSettings.postImageLazyLoad !== settings.postImageLazyLoad ||
            oldSettings.postImageLazyBatchSize !== settings.postImageLazyBatchSize ||
            oldSettings.displayBlockedTips !== settings.displayBlockedTips ||
            oldSettings.defaultHidePostImages !== settings.defaultHidePostImages ||
            oldSettings.displayThreadImages !== settings.displayThreadImages ||
            oldSettings.threadPreviewCount !== settings.threadPreviewCount ||
            oldSettings.displayThreadBuyInfo !== settings.displayThreadBuyInfo ||
            oldSettings.autoPagination !== settings.autoPagination ||
            oldSettings.blockedUsers.toString() !== settings.blockedUsers.toString() ||
            oldSettings.followedAuthors.toString() !== settings.followedAuthors.toString() ||
            oldSettings.defaultSwipeToSearch !== settings.defaultSwipeToSearch ||
            oldSettings.searchCacheEnabled !== settings.searchCacheEnabled ||
            oldSettings.searchHotKeys !== settings.searchHotKeys ||
            oldSettings.searchSort !== settings.searchSort ||
            oldSettings.forumDefaultSort !== settings.forumDefaultSort ||
            settings.replaceMedals === 0 ||
            settings.replaceMedals === 2) {
            location.reload();
        }
    }
    // #endregion

    // #region 主程序
    const BGSH_LAZY_PLACEHOLDER = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect width="320" height="180" fill="#fff7e8"/><text x="160" y="94" text-anchor="middle" font-size="15" fill="#c47a1a">图片懒加载中…</text></svg>'
    );
    let postImageObserver = null;
    let postImageMutationObserver = null;
    let pendingPostImages = [];
    let postImageBatchTimer = null;
    let postImageLoadAllButton = null;

    function isPostContentImage(img) {
        if (!img || img.tagName !== "IMG") return false;
        if (!img.closest(".t_f, [id^='postmessage_'], .pcb, .message")) return false;
        if (img.closest(".smilie, .avatar, .pob, .pi")) return false;
        var source = img.getAttribute("file") || img.getAttribute("zoomfile") ||
            img.getAttribute("data-src") || img.getAttribute("src") || "";
        return !/static\/image\/(?:smiley|common)|avatar|\/uc_server\//i.test(source);
    }

    function getOriginalImageURL(img) {
        if (!img) return "";
        var candidates = [
            img.getAttribute("data-bgsh-original"),
            img.getAttribute("file"),
            img.getAttribute("zoomfile"),
            img.getAttribute("data-original"),
            img.getAttribute("data-src"),
            img.getAttribute("data-bgsh-lazy-src"),
            img.currentSrc,
            img.getAttribute("src")
        ];
        for (var i = 0; i < candidates.length; i++) {
            var value = String(candidates[i] || "").trim();
            if (!value || value === BGSH_LAZY_PLACEHOLDER || /^data:image\/svg\+xml/i.test(value)) continue;
            try { return new URL(value, location.href).href; }
            catch (error) {}
        }
        return "";
    }

    function updateLazyImageButton() {
        var button = postImageLoadAllButton || document.getElementById("bgshLoadAllPostImages");
        if (!button) return;
        var count = document.querySelectorAll("img.bgsh-post-lazy[data-bgsh-lazy-src]").length;
        button.textContent = count > 0 ? "🖼️ 加载全部图片 (" + count + ")" : "✅ 图片已加载";
        button.disabled = count === 0;
    }

    function loadDeferredPostImage(img) {
        if (!img || !img.dataset.bgshLazySrc) return;
        var src = img.dataset.bgshLazySrc;
        var srcset = img.dataset.bgshLazySrcset || "";
        delete img.dataset.bgshLazySrc;
        delete img.dataset.bgshLazySrcset;
        if (srcset) img.setAttribute("srcset", srcset);
        img.addEventListener("load", function onLoad() {
            img.removeEventListener("load", onLoad);
            img.classList.add("bgsh-post-lazy-loaded");
            img.classList.remove("bgsh-post-lazy");
            updateLazyImageButton();
        });
        img.addEventListener("error", function onError() {
            img.removeEventListener("error", onError);
            img.classList.add("bgsh-post-lazy-loaded");
            img.classList.remove("bgsh-post-lazy");
            updateLazyImageButton();
        });
        img.src = src;
    }

    function processPostImageBatch() {
        postImageBatchTimer = null;
        var batchSize = getSettings().postImageLazyBatchSize;
        var batch = pendingPostImages.splice(0, batchSize);
        batch.forEach(loadDeferredPostImage);
        if (pendingPostImages.length) {
            postImageBatchTimer = setTimeout(processPostImageBatch, 90);
        }
    }

    function queuePostImage(img) {
        if (!img || !img.dataset.bgshLazySrc || pendingPostImages.indexOf(img) >= 0) return;
        pendingPostImages.push(img);
        if (!postImageBatchTimer) postImageBatchTimer = setTimeout(processPostImageBatch, 20);
    }

    function ensurePostImageObserver() {
        if (postImageObserver) return postImageObserver;
        if (!("IntersectionObserver" in window)) return null;
        postImageObserver = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (!entry.isIntersecting) return;
                postImageObserver.unobserve(entry.target);
                queuePostImage(entry.target);
            });
        }, { root: null, rootMargin: "900px 0px", threshold: 0.01 });
        return postImageObserver;
    }

    function preparePostImagesForLazyLoad(root, deferBeforeInsert) {
        var settings = getSettings();
        if (!settings.postImageLazyLoad || !root) return;
        var images = [];
        if (root.matches && root.matches("img")) images.push(root);
        if (root.querySelectorAll) images.push.apply(images, root.querySelectorAll("img"));
        var observer = ensurePostImageObserver();
        images.forEach(function(img) {
            if (!isPostContentImage(img) || img.dataset.bgshLazyPrepared === "1") return;
            img.dataset.bgshLazyPrepared = "1";
            img.loading = "lazy";
            img.decoding = "async";
            var original = getOriginalImageURL(img);
            if (original) img.dataset.bgshOriginal = original;
            var displaySource = img.getAttribute("src") || img.getAttribute("data-src") || original;
            var shouldDefer = Boolean(displaySource) &&
                (deferBeforeInsert || (!img.complete && img.getBoundingClientRect().top > window.innerHeight + 500));
            if (!shouldDefer || !observer || /^data:/i.test(displaySource)) return;
            img.dataset.bgshLazySrc = displaySource;
            var srcset = img.getAttribute("srcset");
            if (srcset) {
                img.dataset.bgshLazySrcset = srcset;
                img.removeAttribute("srcset");
            }
            img.classList.add("bgsh-post-lazy");
            img.src = BGSH_LAZY_PLACEHOLDER;
            observer.observe(img);
        });
        updateLazyImageButton();
    }

    function loadAllDeferredPostImages() {
        document.querySelectorAll("img.bgsh-post-lazy[data-bgsh-lazy-src]").forEach(function(img) {
            if (postImageObserver) postImageObserver.unobserve(img);
            queuePostImage(img);
        });
    }

    function setupPostImageLazyLoading(buttonContainer) {
        var settings = getSettings();
        if (!settings.postImageLazyLoad) return;
        preparePostImagesForLazyLoad(document, false);
        if (!document.getElementById("bgshLoadAllPostImages")) {
            var loadAllButton = createButton("bgshLoadAllPostImages", "🖼️ 加载全部图片", loadAllDeferredPostImages);
            postImageLoadAllButton = loadAllButton;
            buttonContainer.appendChild(loadAllButton);
            updateLazyImageButton();
        }
        var postList = document.getElementById("postlist") || document.body;
        if (!postImageMutationObserver) {
            postImageMutationObserver = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    mutation.addedNodes.forEach(function(node) {
                        if (node.nodeType === 1) preparePostImagesForLazyLoad(node, true);
                    });
                });
            });
            postImageMutationObserver.observe(postList, { childList: true, subtree: true });
        }
    }

    function openImageViewer(src) {
        var originalURL = "";
        try { originalURL = new URL(src, location.href).href; }
        catch (error) { return; }
        if (document.querySelector('.bgsh-image-overlay')) return;

        const overlay = document.createElement('div');
        overlay.className = 'bgsh-image-overlay';
        const viewer = document.createElement('div');
        viewer.className = 'bgsh-image-viewer';
        const clonedImg = document.createElement('img');
        clonedImg.src = originalURL;
        clonedImg.alt = '原图预览';
        const actions = document.createElement('div');
        actions.className = 'bgsh-image-actions';
        const originalLink = document.createElement('a');
        originalLink.className = 'bgsh-image-action';
        originalLink.href = originalURL;
        originalLink.target = '_blank';
        originalLink.rel = 'noopener noreferrer';
        originalLink.textContent = '🔎 查看原图';
        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'bgsh-image-action';
        closeButton.textContent = '✕ 关闭';
        actions.append(originalLink, closeButton);
        viewer.appendChild(clonedImg);
        overlay.append(viewer, actions);

        const close = function() {
            document.removeEventListener('keydown', onKeyDown);
            overlay.remove();
        };
        const onKeyDown = function(event) { if (event.key === 'Escape') close(); };
        clonedImg.addEventListener('click', function(event) { event.stopPropagation(); });
        actions.addEventListener('click', function(event) { event.stopPropagation(); });
        closeButton.addEventListener('click', close);
        overlay.addEventListener('click', function(event) {
            if (event.target === overlay || event.target === viewer) close();
        });
        document.addEventListener('keydown', onKeyDown);
        document.body.appendChild(overlay);
    }

    function setupImageZoom() {
        document.addEventListener('click', (e) => {
            const target = e.target;
            if (!target || !target.closest) return;
            const img = target.closest(
                'img.zoom, img[file], .t_f img, [id^="postmessage_"] img, ' +
                '.bgsh-pt > img, .bgsh-favorite-preview > img'
            );
            if (!img) return;

            // 在捕获阶段阻止网站图片查看器和旧的预览图点击监听，
            // 所有图片统一只打开插件的一层预览。
            e.preventDefault();
            e.stopImmediatePropagation();

            const src = getOriginalImageURL(img);
            if (!src) return;
            openImageViewer(src);
        }, true);
    }

    async function baseFunction(settings) {
        if (settings.blockingIndex) removeIndex();
        removeExternalSyncSaleThreadsButton();

        manipulateMedals(settings);
        addStyles();
        setupGlobalClickEffect();
        setupSearchHotKeys();
        setupSelectionSearch(settings);
        applyTheme(getTheme());
        applyTextRenderingEnhancement(settings);
        applyCustomTextAppearance(settings);
        applyCustomBackground(settings);
        applyVisitedThreadColor(settings);
        applyLargeResourceTitleColor(settings);
        setupLargeResourceTitleHighlights(settings);
        setupProfileFollowerCount().catch(function(error) {
            debugLog("个人资料被关注数加载失败", error);
        });
        setupPurchasedThreadRecordListener();
        // 即使关闭“已售人数”，仍记录列表中可见的付费主题和售价，供购买后恢复显示。
        getLoadedSaleThreadLinks();
        initFavorites();
        applyPreviewSize(getPreviewSize());
        setupPreviewWheelScaling();

        setupImageZoom();

        const buttonContainer = createButtonContainer();
        buttonContainer.style.display = settings.menuButtonIsVisible ? "flex" : "none";

        const searchDialogBtn = createButton("bgshSearchDialogBtn", "🔍 搜索", function() {
            showSearchDialog();
        });
        buttonContainer.appendChild(searchDialogBtn);

        // 收藏夹 - 打开收藏管理页面
        const favSearchBtn = createButton("favSearchBtn", "🔖 收藏夹", function() {
            var isFavPage = isFavoritePageURL(window.location.href);
            if (isFavPage) {
                var app = document.getElementById('bgshFavoriteApp');
                if (app) { app.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
                else { initFavorites(); }
            } else {
                window.open(baseURL + "/home.php?mod=space&do=favorite&view=me", "_blank");
            }
        });
        buttonContainer.appendChild(favSearchBtn);

        const followedAuthorsBtn = createButton("followedAuthorsBtn", "👥 关注作者", function() {
            showFollowedAuthorsDialog();
        });
        followedAuthorsBtn.title = "打开已关注作者列表";
        buttonContainer.appendChild(followedAuthorsBtn);

        buttonContainer.appendChild(createPreviewSizeAdjustButton());

        await delegatePageHandlers(settings, buttonContainer);
        if (settings.displayThreadBuyInfo && getLoadedSaleThreadLinks().length > 0) {
            await displayThreadBuyInfo(settings);
        }
        blockContentByUsers(settings);

        if (/search\.php/.test(window.location.href)) {
            setTimeout(() => displayAdvanThreadImages(settings), 500);
        }

        document.body.appendChild(buttonContainer);
        PostContent();
        createt98tButton(buttonContainer);

        const menuButton = createMenuButton(settings);
        setMenuButtonPosition(menuButton, buttonContainer);
        toggleContainer(menuButton, buttonContainer);

        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if (getTheme() === 'auto') applyTheme('auto');
        });

        cleanSearchCache();

        // 初始化板块筛选和主题分类筛选
        var isBoardPage = isBoardListPage();
        var isForumIndex = !isBoardPage && document.querySelectorAll('[id^="forum_"], .fl_tb').length > 0;

        if (isBoardPage) {
            setTimeout(function () { initTopicTypeFilter(); }, 400);
        } else if (isForumIndex) {
            setTimeout(function () { initBoardFilter(); }, 400);
        }
    }

    function isBoardListPage() {
        if (/forum-(\d+)-/.test(window.location.pathname)) return true;
        var url = window.location.href;
        if (/[?&]mod=forumdisplay(&|#|$)/.test(url)) return true;
        if (document.querySelector('#threadlist, .threadlist')) return true;
        return false;
    }

    // 空间「主题 / 回复」列表页判定：/home.php?mod=space&uid=xxx&do=thread&view=me
    // 旧写法是一条长正则，要求 &do=thread&view=me 之后必须再跟一个 &xxx，
    // 所以地址栏里没有 &from=space 的裸链接（直接访问 uid 的帖子列表）会被漏判，
    // 整页既不加载图片预览也不挂无限滚动。这里改为按 URL 参数判断，
    // 参数顺序、是否带 &type=reply / &from=space 都能命中。
    function isSpaceThreadPage(url) {
        var target;
        try {
            target = new URL(url || window.location.href, window.location.href);
        } catch (error) {
            return false;
        }
        if (!/(^|\/)home\.php$/i.test(target.pathname)) return false;
        var params = new URLSearchParams(target.search);
        return params.get("mod") === "space" && params.get("do") === "thread";
    }

    // 导读 / 空间 / 收藏这类列表页的统一判定。
    // 旧写法是一条长正则，要求 URL 里必须有 &view=xxx：
    //     (forum|home)\.php\?mod=(guide|space|misc)&(view=(hot|digest|...)|...)
    // 但 Discuz 导读页的默认地址就是 forum.php?mod=guide，不带 view
    // （服务端按「最新发表」出页）。正则不匹配 → delegatePageHandlers 里
    // 一条分支都进不去 → 预览、无限滚动、已售人数全都不加载，
    // 表现就是「导读页没有图片预览」。
    // 改成按 URL 参数判断，view 缺省、顺序变化、带 page/type 都能命中。
    function isGuideListPage(urlValue) {
        var target;
        try {
            target = new URL(urlValue || window.location.href, window.location.href);
        } catch (error) {
            return false;
        }
        if (!/(^|\/)(forum|home)\.php$/i.test(target.pathname)) return false;
        var params = new URLSearchParams(target.search);
        var mod = params.get("mod");
        if (mod === "guide") return true;                                   // 导读：任何 view，含缺省
        if (mod === "misc" && params.get("action") === "showdarkroom") return true;
        if (mod === "space" && params.get("do") === "favorite") return true;
        if (params.get("do") === "favorite") return true;                   // home.php?mod=space&do=favorite
        return false;
    }

    async function delegatePageHandlers(settings, buttonContainer) {
        const isPostPage = () => /forum\.php\?mod=viewthread|\/thread-\d+-\d+-\d+\.html/.test(window.location.href);
        const isSearchPage = () => /search\.php/.test(window.location.href);
        const isForumDisplayPage = () => /forum\.php\?mod=forumdisplay|\/forum-\d+-\d+\.html/.test(window.location.href);
        const isSpacePage = () => isSpaceThreadPage(window.location.href);
        const isMySpacePage = () => isGuideListPage(window.location.href);
        const isMyfavoritePage = () => isFavoritePageURL(window.location.href);

        if (isPostPage()) {
            handlePostPage(settings, buttonContainer);
        } else if (isSearchPage()) {
            filterSearchResults();
            handleSearchPage(settings);
        } else if (isForumDisplayPage()) {
            await handleForumDisplayPage(settings, buttonContainer);
        } else if (isSpacePage()) {
            await displayThreadBuyInfoOther(settings);
            initInfiniteScroll("isSpacePage");
            setTimeout(function() { displayAdvanThreadImages(settings); }, 500);
        } else if (isMyfavoritePage()) {
            initInfiniteScroll("isMyfavoritePage");
        } else if (isMySpacePage()) {
            await displayThreadBuyInfoOther(settings);
            initInfiniteScroll("isMySpacePage");
            setTimeout(function() { displayAdvanThreadImages(settings); }, 500);
        }
    }



    // ===== 预览图片大小调节 =====
    function getPreviewSize() { return parseInt(GM_getValue('bgsh_previewSize', 180), 10) || 180; }
    function normalizePreviewSize(val) {
        return Math.max(80, Math.min(400, parseInt(val, 10) || 180));
    }
    function syncPreviewBoxSize(box, requestedSize) {
        if (!box || !box.isConnected) return;
        var images = Array.from(box.querySelectorAll(':scope > img')).filter(function(img) {
            return img.style.display !== 'none';
        });
        if (!images.length) return;
        var columns = parseInt(box.dataset.bgshPreviewColumns, 10) ||
            getPreviewColumnCount(images.length);
        var availableWidth = box.clientWidth || box.getBoundingClientRect().width;
        if (!availableWidth) return;
        var gap = 4;
        var maximumCellWidth = Math.max(1, (availableWidth - gap * (columns - 1)) / columns);
        var effectiveSize = Math.max(1, Math.min(normalizePreviewSize(requestedSize), Math.floor(maximumCellWidth)));
        var effectiveHeight = Math.round(effectiveSize * 0.75);
        box.style.setProperty('--bgsh-effective-preview-size', effectiveSize + 'px');
        box.style.setProperty('--bgsh-effective-preview-height', effectiveHeight + 'px');
        box.style.gridTemplateColumns = 'repeat(' + columns + ', minmax(0, ' + effectiveSize + 'px))';
    }
    function syncAllPreviewBoxSizes(val) {
        document.querySelectorAll('.bgsh-pt, .bgsh-favorite-preview').forEach(function(box) {
            syncPreviewBoxSize(box, val);
        });
    }
    function applyPreviewSize(val) {
        val = normalizePreviewSize(val);
        var height = Math.round(val * 0.75);
        document.documentElement.style.setProperty('--bgsh-preview-size', val + 'px');
        document.documentElement.style.setProperty('--bgsh-preview-height', height + 'px');
        requestAnimationFrame(function() {
            syncAllPreviewBoxSizes(val);
        });
    }
    function setPreviewSize(val) {
        val = normalizePreviewSize(val);
        GM_setValue('bgsh_previewSize', val);
        applyPreviewSize(val);
        updatePreviewSizeButton(val);
    }

    function updatePreviewSizeButton(size) {
        var button = document.getElementById('bgshPreviewSizeButton');
        if (!button) return;
        var normalized = normalizePreviewSize(size);
        button.textContent = '🖼️ 预览 ' + normalized + 'px';
        button.title = '调节主题预览图片大小，当前 ' + normalized + 'px';
    }

    function createPreviewSizeAdjustButton() {
        var button = createButton('bgshPreviewSizeButton', '', function() {
            showPreviewSizeAdjustDialog();
        });
        var size = normalizePreviewSize(getPreviewSize());
        button.textContent = '🖼️ 预览 ' + size + 'px';
        button.title = '调节主题预览图片大小，当前 ' + size + 'px';
        return button;
    }

    function showPreviewSizeAdjustDialog() {
        var existing = document.getElementById('bgshPreviewSizeDialog');
        if (existing) {
            if (typeof existing.bgshCloseDialog === 'function') existing.bgshCloseDialog();
            else existing.remove();
        }

        var overlay = createElement('div', {
            className: 'bgsh-dialog-overlay',
            id: 'bgshPreviewSizeDialog'
        });
        var dialog = createElement('div', { className: 'bgsh-dialog' });
        dialog.style.width = 'min(430px, 94vw)';
        dialog.style.maxHeight = 'none';

        var header = createElement('div', { className: 'bgsh-dialog-header' });
        var title = createElement('div', {
            className: 'bgsh-dialog-title',
            text: '🖼️ 调节预览图片大小'
        });
        var closeButton = createElement('button', {
            className: 'bgsh-dialog-close',
            text: '×'
        });
        header.append(title, closeButton);

        var body = createElement('div', { className: 'bgsh-dialog-body' });
        var valueLabel = createElement('div');
        Object.assign(valueLabel.style, {
            marginBottom: '14px',
            textAlign: 'center',
            fontSize: '20px',
            fontWeight: '700',
            color: 'var(--bgsh-primary, #f7971e)'
        });

        var sliderRow = createElement('div');
        Object.assign(sliderRow.style, {
            display: 'grid',
            gridTemplateColumns: '44px minmax(0, 1fr) 44px',
            alignItems: 'center',
            gap: '10px'
        });
        var decreaseButton = createElement('button', {
            className: 'bgsh-customBtn',
            text: '－',
            attrs: { type: 'button', title: '缩小 10px' }
        });
        var rangeInput = createElement('input', {
            attrs: { type: 'range', min: '80', max: '400', step: '10' }
        });
        rangeInput.style.width = '100%';
        var increaseButton = createElement('button', {
            className: 'bgsh-customBtn',
            text: '＋',
            attrs: { type: 'button', title: '放大 10px' }
        });
        [decreaseButton, increaseButton].forEach(function(button) {
            button.style.width = '44px';
            button.style.minWidth = '44px';
            button.style.margin = '0';
            button.style.padding = '7px 0';
            button.style.fontSize = '20px';
        });
        sliderRow.append(decreaseButton, rangeInput, increaseButton);

        var hint = createElement('div', {
            text: '范围 80–400px；修改后立即应用到当前及之后加载的预览图，并自动保存。'
        });
        Object.assign(hint.style, {
            marginTop: '12px',
            color: '#888',
            fontSize: '12px',
            lineHeight: '1.6'
        });

        var wheelToggleWrap = createElement('div', { className: 'bgsh-setting-item' });
        Object.assign(wheelToggleWrap.style, {
            marginTop: '16px',
            paddingTop: '14px',
            borderTop: '1px solid rgba(247,151,30,.22)'
        });
        var wheelToggleLabel = createElement('label', { className: 'bgsh-switch-label' });
        var wheelToggle = createElement('input', {
            id: 'bgshPreviewWheelResizeToggle',
            attrs: { type: 'checkbox' }
        });
        wheelToggle.checked = GM_getValue('previewWheelResizeEnabled', true) !== false;
        var wheelToggleSlider = createElement('span', { className: 'bgsh-switch-slider' });
        var wheelToggleText = createElement('span', {
            className: 'bgsh-switch-text',
            text: '🖱️ 鼠标滚轮调节预览图片大小'
        });
        wheelToggleLabel.append(wheelToggle, wheelToggleSlider, wheelToggleText);
        var wheelToggleHint = createElement('div', {
            text: '开启：悬停预览图时滚轮缩放；关闭：滚轮保持正常页面滚动。'
        });
        Object.assign(wheelToggleHint.style, {
            marginTop: '6px',
            color: '#888',
            fontSize: '12px',
            lineHeight: '1.6'
        });
        wheelToggleWrap.append(wheelToggleLabel, wheelToggleHint);
        body.append(valueLabel, sliderRow, hint, wheelToggleWrap);

        var footer = createElement('div', { className: 'bgsh-dialog-footer' });
        var resetButton = createElement('button', {
            className: 'bgsh-customBtn',
            text: '↺ 恢复 180px',
            attrs: { type: 'button' }
        });
        var doneButton = createElement('button', {
            className: 'bgsh-customBtn',
            text: '完成',
            attrs: { type: 'button' }
        });
        resetButton.style.width = 'auto';
        resetButton.style.background = 'rgba(0,0,0,.07)';
        resetButton.style.color = '#666';
        doneButton.style.width = 'auto';
        footer.append(resetButton, doneButton);
        dialog.append(header, body, footer);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        function applyValue(value) {
            var normalized = normalizePreviewSize(value);
            rangeInput.value = String(normalized);
            valueLabel.textContent = normalized + ' px';
            setPreviewSize(normalized);
        }

        function closeDialog() {
            document.removeEventListener('keydown', handleKeydown);
            overlay.remove();
        }

        function handleKeydown(event) {
            if (event.key === 'Escape') closeDialog();
        }

        overlay.bgshCloseDialog = closeDialog;

        var initialSize = normalizePreviewSize(getPreviewSize());
        rangeInput.value = String(initialSize);
        valueLabel.textContent = initialSize + ' px';
        addSafeEventListener(rangeInput, 'input', function() {
            applyValue(rangeInput.value);
        });
        addSafeEventListener(decreaseButton, 'click', function() {
            applyValue(parseInt(rangeInput.value, 10) - 10);
        });
        addSafeEventListener(increaseButton, 'click', function() {
            applyValue(parseInt(rangeInput.value, 10) + 10);
        });
        addSafeEventListener(wheelToggle, 'change', function() {
            var enabled = wheelToggle.checked;
            GM_setValue('previewWheelResizeEnabled', enabled);
            var settingsToggle = document.getElementById('previewWheelResizeEnabledCheckbox');
            if (settingsToggle) settingsToggle.checked = enabled;
            showToast(enabled ? '已开启鼠标滚轮预览图缩放' : '已关闭鼠标滚轮预览图缩放', 'success', 1400);
        });
        addSafeEventListener(resetButton, 'click', function() { applyValue(180); });
        addSafeEventListener(doneButton, 'click', closeDialog);
        addSafeEventListener(closeButton, 'click', closeDialog);
        addSafeEventListener(overlay, 'click', function(event) {
            if (event.target === overlay) closeDialog();
        });
        document.addEventListener('keydown', handleKeydown);
    }

    function setupPreviewWheelScaling() {
        if (document.documentElement.dataset.bgshPreviewWheel === '1') return;
        document.documentElement.dataset.bgshPreviewWheel = '1';
        var lastWheelTime = 0;
        var lastLimitToast = 0;
        document.addEventListener('wheel', function(event) {
            if (!GM_getValue("previewWheelResizeEnabled", true)) return;
            var target = event.target;
            if (!target || !target.closest) return;
            var hoveredImage = target.closest('.bgsh-pt > img, .bgsh-favorite-preview > img');
            if (!hoveredImage) return;
            var preview = hoveredImage.closest('.bgsh-pt, .bgsh-favorite-preview');
            if (!preview) return;

            event.preventDefault();
            var now = Date.now();
            if (now - lastWheelTime < 55 || event.deltaY === 0) return;
            lastWheelTime = now;

            var effectiveValue = parseFloat(
                getComputedStyle(preview).getPropertyValue('--bgsh-effective-preview-size')
            );
            var firstImage = preview.querySelector(':scope > img');
            var current = Number.isFinite(effectiveValue) && effectiveValue > 0
                ? effectiveValue
                : firstImage
                    ? firstImage.getBoundingClientRect().width
                    : getPreviewSize();
            var step = event.shiftKey ? 5 : 10;
            var next = Math.round(current + (event.deltaY < 0 ? step : -step));
            var columns = parseInt(preview.dataset.bgshPreviewColumns, 10) ||
                getPreviewColumnCount(preview.querySelectorAll(':scope > img').length);
            var maximum = Math.floor(
                (preview.clientWidth - Math.max(0, columns - 1) * 4) / columns
            );
            if (event.deltaY < 0 && maximum > 0 && next > maximum) {
                next = maximum;
                if (now - lastLimitToast > 1200) {
                    lastLimitToast = now;
                    showToast('已达到当前标题栏可容纳的最大尺寸', 'info', 1200);
                }
            }
            setPreviewSize(next);
            requestAnimationFrame(function() {
                var actual = parseFloat(
                    getComputedStyle(preview).getPropertyValue('--bgsh-effective-preview-size')
                ) || getPreviewSize();
                preview.title = '预览图实际尺寸：' + Math.round(actual) + 'px（滚轮继续调节）';
            });
        }, { passive: false });

        var resizeTimer = null;
        window.addEventListener('resize', function() {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function() {
                syncAllPreviewBoxSizes(getPreviewSize());
            }, 120);
        });
    }

    if (typeof GM_addValueChangeListener === 'function') {
        GM_addValueChangeListener('bgsh_previewSize', function(name, oldValue, newValue) {
            applyPreviewSize(newValue);
            updatePreviewSizeButton(newValue);
        });
    }


async function main() {
        var hasFavPage = isFavoritePageURL(window.location.href);
        if (document.title.indexOf("色花堂") == -1 && document.title.indexOf("98堂") == -1 && !hasFavPage) {
            // 站点上 Cloudflare 后，挑战页/跳转页的 title 会变成「不详」「请稍候…」，
            // 仅凭标题会把整份脚本静默拦掉。标题不过关时再看一眼 DOM 指纹。
            if (!looksLikeDiscuzForum(document)) return;
        }

        // 4.11.1：板块列表默认排序由「网站默认(实为回复时间)」改为「按发布时间」。
        // 旧安装存的 native 会一直不再干预，这里做一次性迁移为 dateline，
        // 保证老用户进板块页也自动按发布时间排序；之后手动选「网站默认」不再被改。
        if (GM_getValue("bgshForumSortMigratedToDateline", false) !== true) {
            if (GM_getValue("forumDefaultSort", "native") === "native") {
                GM_setValue("forumDefaultSort", "dateline");
            }
            GM_setValue("bgshForumSortMigratedToDateline", true);
        }

        // 板块列表默认排序：可能触发一次重定向，命中时直接结束本次执行，
        // 避免在即将卸载的页面上做无意义的渲染。放在标题判断之后，
        // 保证不会影响非本站页面（@match 是 *://*/*）。
        if (applyForumDefaultSort()) return;

        // 4.5.1 已移除自动签到与签到提醒，清理旧版遗留设置。
        GM_deleteValue("qiandaoTip");
        // 4.10.0 已移除楼内关键词订阅提醒，清理旧版遗留设置。
        ["keywordSubscriptionEnabled", "keywordSubscriptions", "keywordPollSeconds"].forEach(function(key) {
            GM_deleteValue(key);
        });

        const settings = getSettings();

        const lastCheckedUpdate = settings.lastCheckedUpdate;
        const oneDayInMillis = 24 * 60 * 60 * 1000;
        if (Date.now() - lastCheckedUpdate > oneDayInMillis) {
            checkForUpdates();
        }

        await baseFunction(settings);
    }

    GM_registerMenuCommand("⚙️ 九八堂设置", () => {
        createSettingsUI(getSettings());
    });

    GM_registerMenuCommand("🌓 切换主题", () => {
        const current = getTheme();
        const themes = ['auto', 'light', 'dark'];
        const next = themes[(themes.indexOf(current) + 1) % themes.length];
        setTheme(next);
        showToast(`🌓 主题已切换: ${next === 'auto' ? '跟随系统' : next}`, 'success');
    });

    GM_registerMenuCommand("🖼 重建图片预览", async () => {
        // 预览依赖 fetch 抓帖子页取图。站点加了 18 岁确认页后，
        // fetch 曾经一直拿到确认页（没有 .t_f），预览就永久空着。
        // 这里清掉窗口内状态和缓存，重新扫一遍，方便验证修复是否生效。
        window.__98t_preview_state = {};
        try { GM_setValue("bgsh_preview_cache", "{}"); } catch (e) {}
        document.querySelectorAll(".bgsh-pt").forEach(function(box) {
            var row = box.closest(".bgsh-preview-row");
            if (row) row.remove(); else box.remove();
        });
        await displayAdvanThreadImages(getSettings());
        var count = document.querySelectorAll(".bgsh-pt").length;
        showToast(count ? "预览已重建：" + count + " 处" : "没有可预览的主题（或仍未取到图）",
                  count ? "success" : "warning", 2600);
    });

    GM_registerMenuCommand("🔍 快速搜索", () => {
        showSearchDialog();
    });

    await main();
    // #endregion
})();
