($ => {
    "use strict";

    window.AppearanceHelper = function (s) {

        let previews = {
            sidebar: {template: "sidebar", styles: ["sidebar"]},
            general: {template: "sidebar", styles: ["sidebar"]},
            overlay: {template: "overlay", styles: ["overlay"]},
            indicator: {template: "indicator", styles: ["contentBase", "content"]}
        };

        let presets = {
            sidebarHeaderHeight: {xs: 32, s: 36, l: 55},
            bookmarksFontSize: {xs: 11, s: 12, l: 16},
            bookmarksLineHeight: {xs: 20, s: 26, l: 45},
            sidebarWidth: {xs: 250, s: 300, l: 400},
            bookmarksDirIndentation: {xs: 20, s: 22, l: 30},
            bookmarksHorizontalPadding: {xs: 6, s: 10, l: 18},
            bookmarksIconSize: {xs: 12, s: 14, l: 18},
            directoriesIconSize: {xs: 12, s: 14, l: 18},
            scrollBarWidth: {xs: 10, s: 11, l: 12},
            tooltipFontSize: {xs: 9, s: 9, l: 12}
        };

        let lastTooltipChange = null;
        let tooltipTimeout = null;

        /**
         * Initialises the appearance settings
         *
         * @returns {Promise}
         */
        this.init = () => {
            return new Promise((resolve) => {
                initPreviews().then(() => {
                    ["darkMode"].forEach((field) => {
                        let checked = false;
                        if (s.helper.model.getData("a/" + field) === true) {
                            s.opts.elm.checkbox[field].trigger("click");
                            checked = true;
                        }
                        s.opts.elm.checkbox[field].children("input").data("initial", checked);
                    });

                    let customCss = s.helper.model.getData("u/customCss");
                    s.opts.elm.textarea.customCss[0].value = customCss;
                    s.opts.elm.textarea.customCss.data("initial", customCss);
                    s.opts.elm.textarea.customCss.parent().append("<span>" + s.helper.i18n.get("settings_not_synced") + "</span>");

                    let styles = s.helper.model.getData("a/styles");

                    Object.entries(styles).forEach(([key, value]) => {
                        if (s.opts.elm.range[key]) {
                            s.opts.elm.range[key][0].value = value.replace("px", "");
                            s.opts.elm.range[key].data("initial", value.replace("px", ""));
                            s.opts.elm.range[key].trigger("change");
                        } else if (s.opts.elm.color[key]) {
                            changeColorValue(s.opts.elm.color[key], value);
                            s.opts.elm.color[key].data("initial", s.opts.elm.color[key][0].value);
                        } else if (s.opts.elm.select[key]) {
                            if (key === "fontFamily" && s.opts.elm.select[key].children("option[value='" + value + "']").length() === 0) {
                                value = "default";
                            }

                            s.opts.elm.select[key][0].value = value;
                            s.opts.elm.select[key].data("initial", value);
                        } else if (s.opts.elm.radio[key]) {
                            s.opts.elm.radio[key][0].value = value;
                            s.opts.elm.radio[key].trigger("change");
                            s.opts.elm.radio[key].data("initial", value);
                        }
                    });

                    initEvents();

                    $.delay(100).then(() => {
                        updateAllPreviewStyles();
                        resolve();
                    });
                });
            });
        };

        /**
         * Saves the appearance settings
         * @returns {Promise}
         */
        this.save = () => {
            return new Promise((resolve) => {
                let config = getCurrentConfig();

                chrome.storage.sync.set({appearance: config.appearance}, () => {

                    chrome.storage.local.get(["utility"], (obj) => {
                        let utility = obj.utility || {};
                        utility.customCss = config.utility.customCss;

                        chrome.storage.local.set({utility: utility}, () => {
                            s.helper.model.call("reloadIcon");
                            resolve();
                        });
                    });
                });
            });
        };

        /**
         * Changes the value of the color picker
         *
         * @param elm
         * @param value
         */
        let changeColorValue = (elm, value) => {
            let picker = elm.data("picker");
            if (picker) {
                picker.setColor(value);
            }
        };

        /**
         * Updates all previews
         */
        let updateAllPreviewStyles = () => {
            Object.keys(s.opts.elm.preview).forEach((key) => {
                updatePreviewStyle(key);
            });
        };

        /**
         * Updates the given preview
         *
         * @param key
         */
        let updatePreviewStyle = (key) => {
            let config = getCurrentConfig();

            if (s.opts.elm.preview[key]) {
                s.opts.elm.preview[key].find("head > style").remove();

                if (config.appearance.styles.fontFamily === "default") {
                    let fontInfo = s.helper.font.getDefaultFontInfo();
                    config.appearance.styles.fontFamily = fontInfo.name;
                }

                updatePageLayout(key);
                Object.assign(config.appearance.styles, s.helper.font.getFontWeights(config.appearance.styles.fontFamily));

                let css = previews[key].css;
                css += config.utility.customCss;

                Object.keys(config.appearance.styles).forEach((key) => {
                    css = css.replace(new RegExp("\"?%" + key + "\"?", "g"), config.appearance.styles[key]);
                });

                s.opts.elm.preview[key].find("[" + s.opts.attr.style + "]").forEach((elm) => {
                    let style = $(elm).attr(s.opts.attr.style);
                    Object.keys(config.appearance.styles).forEach((key) => {
                        style = style.replace(new RegExp("\"?%" + key + "\"?", "g"), config.appearance.styles[key]);
                    });
                    elm.style.cssText = style;
                });

                s.opts.elm.preview[key].find("[" + s.opts.attr.hideOnFalse + "]").forEach((elm) => {
                    let attr = $(elm).attr(s.opts.attr.hideOnFalse);

                    if (typeof config.appearance[attr] === "undefined" || config.appearance[attr] === false) {
                        $(elm).css("display", "none");
                    } else {
                        $(elm).css("display", "block");
                    }
                });

                s.opts.elm.preview[key].find("head").append("<style>" + css + "</style>");

                if (config.appearance.darkMode) {
                    s.opts.elm.preview[key].find("body").addClass(s.opts.classes.page.darkMode);
                } else {
                    s.opts.elm.preview[key].find("body").removeClass(s.opts.classes.page.darkMode);
                }

                updatePreviewTooltip(s.opts.elm.preview[key]);
                updatePreviewSidebarHeader(s.opts.elm.preview[key]);
                updatePreviewIndicator(s.opts.elm.preview[key]);
            } else if (key === "icon") {
                s.helper.model.call("updateIcon", {
                    name: config.appearance.styles.iconShape,
                    color: config.appearance.styles.iconColor,
                    onlyCurrentTab: true
                });
            }
        };

        /**
         * Updates the preview of the indicator
         *
         * @param {jsu} preview
         */
        let updatePreviewIndicator = (preview) => {
            let indicator = preview.find("div#blockbyte-bs-indicator");

            if (indicator.length() > 0) {
                let height = +s.opts.elm.range.toggleArea_height[0].value;
                let top = +s.opts.elm.range.toggleArea_top[0].value;

                indicator.css({
                    height: height + "%",
                    top: top + "%"
                });

                if (height === 100) {
                    indicator.addClass(s.opts.classes.appearance.preview.fullHeight);
                } else {
                    indicator.removeClass(s.opts.classes.appearance.preview.fullHeight);
                }
            }
        };

        /**
         * Updates the preview of the sidebar header
         *
         * @param {jsu} preview
         */
        let updatePreviewSidebarHeader = (preview) => {
            let sidebar = preview.find("section#sidebar");

            if (sidebar.length() > 0) {
                let sidebarHeader = sidebar.find("> header");
                sidebarHeader.find("> h1").removeClass(s.opts.classes.hidden);
                sidebarHeader.find("> h1 > span").removeClass(s.opts.classes.hidden);

                ["label", "amount"].forEach((type) => {
                    let lastOffset = null;

                    sidebarHeader.children("a").forEach((icon) => {
                        if (lastOffset === null) {
                            lastOffset = icon.offsetTop;
                        } else if (lastOffset !== icon.offsetTop || sidebarHeader.find("> h1")[0].offsetTop === 0) { // header elements  are not in one line anymore -> header to small -> remove some markup
                            if (type === "label") {
                                sidebarHeader.find("> h1 > span").addClass(s.opts.classes.hidden);
                            } else if (type === "amount") {
                                sidebarHeader.find("> h1").addClass(s.opts.classes.hidden);
                            }
                            return false;
                        }
                    });
                });
            }
        };

        /**
         * Updates the preview of the tooltip,
         * shows the tooltip if the last change was within the last 2s
         *
         * @param {jsu} preview
         */
        let updatePreviewTooltip = (preview) => {
            let tooltip = preview.find("div.tooltip");
            let entry = preview.find("li > a.hover");

            if (tooltip.length() > 0 && entry.length() > 0) {
                if (+new Date() - lastTooltipChange < 2000) {
                    let rect = entry[0].getBoundingClientRect();
                    tooltip.addClass(s.opts.classes.visible);

                    let left = rect.x - tooltip[0].offsetWidth;
                    if (s.helper.i18n.isRtl()) {
                        left = rect.x + entry[0].offsetWidth;
                    }

                    tooltip.css({
                        top: (rect.y + entry.realHeight() / 2 - tooltip.realHeight() / 2) + "px",
                        left: left + "px"
                    });
                } else {
                    tooltip.removeClass(s.opts.classes.visible);
                }
            }
        };

        /**
         * Adds a right padding to the content, so the preview doesn't cover the controls,
         * Adds a class to the content if the columns aren't lined next to each other anymore
         *
         * @param {string} key
         */
        let updatePageLayout = (key) => {
            s.opts.elm.content.removeClass(s.opts.classes.small);

            if (s.opts.elm.preview[key]) {
                let padding = "padding-" + (s.helper.i18n.isRtl() ? "left" : "right");
                let config = getCurrentConfig();

                if (s.opts.elm.preview[key][0].offsetParent !== null) { // preview is visible -> if screen is too small it's hidden
                    let headerRightPadding = 0;

                    if (key === "overlay") {
                        s.opts.elm.content.addClass(s.opts.classes.small);
                    } else if (key === "indicator") {
                        headerRightPadding = config.appearance.styles.indicatorWidth;
                    } else if (key === "sidebar" || key === "general") {
                        headerRightPadding = config.appearance.styles.sidebarWidth;
                    }

                    s.opts.elm.header.css(padding, headerRightPadding);
                    s.opts.elm.content.css(padding, headerRightPadding);
                } else {
                    s.opts.elm.header.css(padding, "");
                    s.opts.elm.content.css(padding, "");
                }

                let boxes = s.helper.menu.getPage().find("div." + s.opts.classes.box);

                if (boxes.length() > 1) { // set class for wrapper if there is only one box per row
                    let hasColumns = false;
                    let top = null;

                    s.helper.menu.getPage().find("div." + s.opts.classes.box).forEach((elm) => {
                        if (top === elm.offsetTop) {
                            hasColumns = true;
                            return false;
                        } else {
                            top = elm.offsetTop;
                        }
                    });

                    if (!hasColumns) {
                        s.opts.elm.content.addClass(s.opts.classes.small);
                    }
                }
            }
        };

        /**
         * Returns the current values of the appearance configuration
         *
         * @returns object
         */
        let getCurrentConfig = () => {
            let ret = {
                utility: {
                    customCss: s.opts.elm.textarea.customCss[0].value
                },
                appearance: {
                    darkMode: s.helper.checkbox.isChecked(s.opts.elm.checkbox.darkMode),
                    highContrast: false,
                    showIndicator: true,
                    showIndicatorIcon: true,
                    showBookmarkIcons: true,
                    showDirectoryIcons: true,
                    styles: {}
                }
            };

            let styles = s.helper.model.getData("a/styles");

            Object.keys(styles).forEach((key) => {
                if (s.opts.elm.range[key]) {
                    ret.appearance.styles[key] = s.opts.elm.range[key][0].value + "px";
                } else if (s.opts.elm.color[key]) {
                    let colorValue = getColorValue(key, s.opts.elm.color[key][0].value);
                    ret.appearance.styles[key] = colorValue.color;

                    if (key === "colorScheme") {
                        let lum = colorValue.luminance ? colorValue.luminance : 0;
                        ret.appearance.styles.foregroundColor = s.helper.model.getDefaultColor("foregroundColor", lum > 170 ? "dark" : "light");

                        if (lum > 215) {
                            ret.appearance.highContrast = true;
                        }
                    }
                } else if (s.opts.elm.select[key]) {
                    ret.appearance.styles[key] = s.opts.elm.select[key][0].value;
                } else if (s.opts.elm.radio[key]) {
                    ret.appearance.styles[key] = s.opts.elm.radio[key][0].value;
                }
            });

            Object.entries({
                indicatorWidth: "showIndicator",
                indicatorIconSize: "showIndicatorIcon",
                bookmarksIconSize: "showBookmarkIcons",
                directoriesIconSize: "showDirectoryIcons"
            }).forEach(([field, attr]) => {
                if (parseInt(ret.appearance.styles[field]) === 0) {
                    ret.appearance[attr] = false;
                }
            });

            return ret;
        };

        /**
         * Returns information about the color of the given field
         *
         * @param {string} field
         * @param {string} val
         * @returns {object}
         */
        let getColorValue = (field, val) => {
            let luminance = null;
            let elm = s.opts.elm.color[field];
            let picker = elm.data("picker");

            if (picker) {
                let colorObj = picker.getColorObj();
                if (colorObj.a === 0) {
                    val = "transparent";
                }
                luminance = 0.299 * colorObj.r + 0.587 * colorObj.g + 0.114 * colorObj.b; // based on https://www.w3.org/TR/AERT#color-contrast
            }

            return {
                color: val,
                luminance: luminance
            };
        };

        /**
         * Initialises the previews
         *
         * @returns {Promise}
         */
        let initPreviews = () => {
            return new Promise((resolve) => {
                let previewsLoaded = 0;
                let previewAmount = Object.keys(previews).length;

                Object.keys(previews).forEach((key) => {
                    previews[key].css = "";

                    s.opts.elm.preview[key] = $("<iframe />")
                        .attr(s.opts.attr.appearance, key)
                        .appendTo(s.opts.elm.body);

                    $.xhr(chrome.extension.getURL("html/template/" + previews[key].template + ".html")).then((xhr) => {
                        if (xhr && xhr.responseText) {
                            let html = xhr.responseText;
                            html = html.replace(/__DATE__CREATED__/g, s.helper.i18n.getLocaleDate(new Date("2016-11-25")));
                            html = html.replace(/__POSITION__/g, s.helper.i18n.isRtl() ? "left" : "right");

                            let previewBody = s.opts.elm.preview[key].find("body");
                            previewBody.html(html);
                            previewBody.parent("html").attr("dir", s.helper.i18n.isRtl() ? "rtl" : "ltr");

                            s.helper.i18n.parseHtml(s.opts.elm.preview[key]);
                            s.helper.font.addStylesheet(s.opts.elm.preview[key]);

                            previewsLoaded++;

                            if (previewsLoaded === previewAmount) {
                                resolve();
                            }
                        }
                    });

                    previews[key].styles.forEach((stylesheet) => {
                        $.xhr(chrome.extension.getURL("css/" + stylesheet + ".css")).then((xhr) => {
                            if (xhr && xhr.responseText) {
                                previews[key].css += xhr.responseText;
                            }
                        });
                    });
                });
            });
        };

        /**
         * Initialises the eventhandlers
         */
        let initEvents = () => {
            $(window).on("resize", function () {
                let path = s.helper.menu.getPath();
                if (path && path[1]) {
                    updatePageLayout(path[1]);
                }
            });

            s.opts.elm.appearance.presetWrapper.children("a").on("click", (e) => {
                let type = $(e.currentTarget).attr(s.opts.attr.type);
                let defaults = s.helper.model.getData("a/styles", true);

                Object.entries(presets).forEach(([key, values]) => {
                    if (values[type]) {
                        s.opts.elm.range[key][0].value = values[type];
                    } else {
                        s.opts.elm.range[key][0].value = defaults[key].replace("px", "");
                    }

                    s.opts.elm.range[key].trigger("change");
                });
            });

            s.opts.elm.range.tooltipFontSize.on("change, input", () => { // show tooltip in preview for 2s when changing the font size
                lastTooltipChange = +new Date();
                if (tooltipTimeout) {
                    clearTimeout(tooltipTimeout);
                }

                tooltipTimeout = setTimeout(() => {
                    updatePreviewStyle("sidebar");
                }, 2001);
            });

            s.opts.elm.appearance.content.find("input, textarea, select").on("change input", (e) => {
                let elm = $(e.currentTarget);
                let val = e.currentTarget.value;
                let initialVal = elm.data("initial");

                if (typeof initialVal !== "undefined") {

                    if (elm.attr("type") === "checkbox") {
                        val = e.currentTarget.checked;

                        if ($(elm).parent()[0] === s.opts.elm.checkbox.darkMode[0]) { // darkmode checkbox -> change some other colors, too
                            let textColor = s.helper.model.getDefaultColor("textColor", val ? "dark" : "light");
                            changeColorValue(s.opts.elm.color.textColor, textColor);
                            changeColorValue(s.opts.elm.color.bookmarksDirColor, textColor);

                            ["sidebarMaskColor", "colorScheme", "hoverColor"].forEach((colorName) => {
                                let color = s.helper.model.getDefaultColor(colorName, val ? "dark" : "light");
                                changeColorValue(s.opts.elm.color[colorName], color);
                            });
                        }
                    }

                    let box = $(e.currentTarget).parents("div." + s.opts.classes.box).eq(0);
                    if (val !== initialVal) {
                        if (box.children("a." + s.opts.classes.revert).length() === 0) {
                            $("<a href='#' />").addClass(s.opts.classes.revert).data("elm", box).appendTo(box);
                        }
                    } else {
                        box.children("a." + s.opts.classes.revert).remove();
                    }

                    let path = s.helper.menu.getPath();
                    updatePreviewStyle(path[1]);
                }
            });

            s.opts.elm.appearance.content.on("click", "a." + s.opts.classes.revert, (e) => { // revert the changes of the specific field
                e.preventDefault();
                let box = $(e.currentTarget).parent("div." + s.opts.classes.box);

                box.find("input, select").forEach((elm) => {
                    let elmObj = $(elm);
                    let value = elmObj.data("initial");

                    if (elmObj.data("picker")) {
                        changeColorValue(elmObj, value);
                    } else if (typeof value !== "undefined") {
                        if (elmObj.attr("type") === "checkbox" && typeof value === "boolean") { // revert checkbox
                            if (elm.checked !== value) { // trigger click if value has changed
                                elmObj.parent("div").trigger("click");
                            }
                        } else { // revert any other field
                            elm.value = value;
                            elmObj.trigger("change");
                        }
                    }
                });
            });

            $(document).on(s.opts.events.pageChanged, (e) => {
                if (e.detail.path && e.detail.path[0] === "appearance") {
                    updatePreviewStyle(e.detail.path[1]);
                }
            });
        };
    };

})(jsu);