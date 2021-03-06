($ => {
    "use strict";

    window.changelog = function () {

        /*
         * ################################
         * PUBLIC
         * ################################
         */

        this.opts = {
            elm: {
                body: $("body"),
                title: $("head > title"),
                infobox: $("section.infobox"),
                close: $("a.close"),
                showChangelog: $("a.showChangelog")
            },
            classes: {
                visible: "visible",
                flipped: "flipped",
                initLoading: "initLoading"
            },
            manifest: chrome.runtime.getManifest()
        };

        /**
         * Constructor
         */
        this.run = () => {
            initHelpers();

            this.helper.model.init().then(() => {
                return this.helper.i18n.init();
            }).then(() => {
                this.opts.elm.body.parent("html").attr("dir", this.helper.i18n.isRtl() ? "rtl" : "ltr");

                this.helper.font.init();
                this.helper.stylesheet.init();
                this.helper.stylesheet.addStylesheets(["changelog"], $(document));

                this.helper.i18n.parseHtml(document);
                this.opts.elm.title.text(this.opts.elm.title.text() + " - " + this.helper.i18n.get("extension_name"));

                initEvents();
                this.opts.elm.infobox.addClass(this.opts.classes.visible);
                this.helper.model.call("trackPageView", {page: "/changelog"});

                $.delay(100).then(() => {
                    this.opts.elm.body.removeClass(this.opts.classes.initLoading);
                });
            });
        };

        /*
         * ################################
         * PRIVATE
         * ################################
         */

        /**
         * Initialises the helper objects
         */
        let initHelpers = () => {
            this.helper = {
                i18n: new window.I18nHelper(this),
                font: new window.FontHelper(this),
                stylesheet: new window.StylesheetHelper(this),
                model: new window.ModelHelper(this)
            };
        };

        /**
         * Initialises the eventhandlers
         */
        let initEvents = () => {
            this.opts.elm.close.on("click", (e) => {
                e.preventDefault();
                window.close();
            });

            this.opts.elm.showChangelog.on("click", (e) => {
                e.preventDefault();
                this.helper.model.call("trackEvent", {
                    category: "changelog",
                    action: "view",
                    label: "view"
                });
                this.opts.elm.infobox.addClass(this.opts.classes.flipped);
            });
        };
    };


    new window.changelog().run();

})(jsu);