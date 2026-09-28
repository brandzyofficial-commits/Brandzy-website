/*
 * "Add Brandzy to Home Screen"
 *  - Chrome / Edge / Samsung on Android and desktop: shows the browser's own install dialog.
 *  - iPhone / iPad: Safari has no install API, so we show the two-step Share -> Add to Home Screen guide.
 *  - Already installed (opened from the home screen): nothing is shown.
 *
 * Include with <script src="/install.js" defer></script>.
 * Add data-floating-button to the script tag to show a floating "Add to Home Screen" button.
 * Any element with [data-brandzy-install] also opens the installer, and the web app calls
 * window.brandzyInstall() from Settings.
 */
(function () {
    var BASE = '/';
    var deferredPrompt = null;
    var script = document.currentScript;
    var wantsFloating = !!(script && script.hasAttribute('data-floating-button'));

    function isStandalone() {
        return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
            window.navigator.standalone === true;
    }
    function isIos() {
        var ua = navigator.userAgent || '';
        return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    }
    function isMobile() {
        return isIos() || /Android|Mobi/i.test(navigator.userAgent || '');
    }

    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
        navigator.serviceWorker.register(BASE + 'sw.js', { scope: BASE }).catch(function () {});
    }

    window.addEventListener('beforeinstallprompt', function (e) {
        e.preventDefault();
        deferredPrompt = e;
        updateButton();
    });
    window.addEventListener('appinstalled', function () {
        deferredPrompt = null;
        closeGuide();
        updateButton();
    });

    // ---------- styles ----------
    var css = '' +
        '.bz-install-fab{position:fixed;z-index:2147483000;right:16px;bottom:16px;display:flex;align-items:center;gap:10px;' +
        'padding:10px 18px 10px 10px;border:0;border-radius:999px;background:#FF5B37;color:#fff;font:600 15px/1.2 "Plus Jakarta Sans",system-ui,sans-serif;' +
        'box-shadow:0 10px 30px rgba(232,67,31,.35);cursor:pointer;-webkit-tap-highlight-color:transparent}' +
        '.bz-install-fab img{width:32px;height:32px;border-radius:50%;display:block}' +
        '.bz-install-fab .bz-x{margin-left:4px;opacity:.8;font-size:18px;line-height:1;padding:0 2px}' +
        '@media (max-width:640px){.bz-install-fab{left:16px;right:16px;justify-content:center;bottom:max(16px,env(safe-area-inset-bottom))}}' +
        '.bz-guide-backdrop{position:fixed;inset:0;z-index:2147483001;background:rgba(10,12,16,.6);display:flex;align-items:flex-end;justify-content:center}' +
        '@media (min-width:641px){.bz-guide-backdrop{align-items:center}}' +
        '.bz-guide{width:100%;max-width:420px;box-sizing:border-box;background:#fff;color:#0f172a;border-radius:20px 20px 0 0;padding:22px 20px calc(20px + env(safe-area-inset-bottom));' +
        'font:400 15px/1.5 "Plus Jakarta Sans",system-ui,sans-serif;box-shadow:0 -10px 40px rgba(0,0,0,.25)}' +
        '@media (min-width:641px){.bz-guide{border-radius:20px;margin:16px}}' +
        '.bz-guide-head{display:flex;align-items:center;gap:12px;margin-bottom:14px}' +
        '.bz-guide-head img{width:52px;height:52px;border-radius:12px}' +
        '.bz-guide-head b{display:block;font-size:17px}' +
        '.bz-guide-head span{color:#64748b;font-size:13px}' +
        '.bz-guide ol{margin:0 0 16px;padding-left:22px}' +
        '.bz-guide li{margin:8px 0}' +
        '.bz-guide .bz-ico{display:inline-block;vertical-align:-4px;width:20px;height:20px}' +
        '.bz-guide button{width:100%;padding:12px;border:0;border-radius:12px;background:#FF5B37;color:#fff;font:600 15px system-ui,sans-serif;cursor:pointer}';
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    var shareIcon = '<svg class="bz-ico" viewBox="0 0 24 24" fill="none" stroke="#0A84FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';
    var menuIcon = '<svg class="bz-ico" viewBox="0 0 24 24" fill="#334155"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>';

    // ---------- guide sheet ----------
    var guide = null;
    function closeGuide() {
        if (guide) { guide.remove(); guide = null; }
    }
    function showGuide() {
        closeGuide();
        var steps;
        if (isIos()) {
            steps = '<li>Tap the <b>Share</b> button ' + shareIcon + ' in Safari’s toolbar.</li>' +
                '<li>Scroll down and tap <b>Add to Home Screen</b>.</li>' +
                '<li>Tap <b>Add</b>. Brandzy appears on your home screen like an app.</li>';
        } else if (isMobile()) {
            steps = '<li>Open your browser menu ' + menuIcon + ' (top-right).</li>' +
                '<li>Tap <b>Install app</b> or <b>Add to Home screen</b>.</li>' +
                '<li>Tap <b>Install</b>. Brandzy appears on your home screen like an app.</li>';
        } else {
            steps = '<li>In Chrome or Edge, click the <b>install</b> icon at the right end of the address bar, or open the browser menu and choose <b>Install Brandzy</b>.</li>' +
                '<li>To get it on your phone, open this page on your phone and tap <b>Add to Home Screen</b>.</li>';
        }
        guide = document.createElement('div');
        guide.className = 'bz-guide-backdrop';
        guide.innerHTML = '<div class="bz-guide" role="dialog" aria-modal="true" aria-label="Add Brandzy to your home screen">' +
            '<div class="bz-guide-head"><img src="' + BASE + 'assets/pwa-maskable-192.png" alt=""><div><b>Add Brandzy to your home screen</b>' +
            '<span>Opens full screen, no app store needed</span></div></div>' +
            '<ol>' + steps + '</ol><button type="button">Got it</button></div>';
        guide.addEventListener('click', function (e) {
            if (e.target === guide || e.target.tagName === 'BUTTON') closeGuide();
        });
        document.body.appendChild(guide);
    }

    function install() {
        if (isStandalone()) return;
        if (deferredPrompt) {
            var p = deferredPrompt;
            deferredPrompt = null;
            p.prompt();
            p.userChoice.finally(updateButton);
        } else {
            showGuide();
        }
    }
    window.brandzyInstall = install;
    window.brandzyCanInstall = function () { return !isStandalone(); };

    // ---------- floating button ----------
    var fab = null;
    var DISMISS_KEY = 'bzInstallDismissed';
    function dismissed() {
        try { return sessionStorage.getItem(DISMISS_KEY) === '1'; } catch (e) { return false; }
    }
    function updateButton() {
        if (!wantsFloating) return;
        var show = !isStandalone() && !dismissed() && (isMobile() || deferredPrompt);
        if (show && !fab) {
            fab = document.createElement('button');
            fab.type = 'button';
            fab.className = 'bz-install-fab';
            fab.setAttribute('aria-label', 'Add Brandzy to Home Screen');
            fab.innerHTML = '<img src="' + BASE + 'assets/pwa-192.png" alt="">' +
                '<span>Add to Home Screen</span><span class="bz-x" aria-label="Hide" role="button">×</span>';
            fab.addEventListener('click', function (e) {
                if (e.target.classList.contains('bz-x')) {
                    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch (err) {}
                    updateButton();
                    return;
                }
                install();
            });
            document.body.appendChild(fab);
        } else if (!show && fab) {
            fab.remove();
            fab = null;
        }
    }

    document.addEventListener('click', function (e) {
        var t = e.target && e.target.closest && e.target.closest('[data-brandzy-install]');
        if (t) { e.preventDefault(); install(); }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updateButton);
    } else {
        updateButton();
    }
})();
