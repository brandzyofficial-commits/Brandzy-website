/*
 * Notifications in the browser (Web Push): iPhone once Brandzy is added to the home screen
 * (iOS 16.4+), and Chrome / Edge / Firefox on computers and Android.
 *
 * The Kotlin app (DevicePush.wasmJs.kt) calls these:
 *   brandzyPushState()        "unsupported" | "needs-install" | "default" | "granted" | "denied"
 *   brandzyPushEnable()       asks for permission and subscribes; call it straight from a tap (iPhone requires that)
 *   brandzyPushSubscription() this browser's subscription as JSON, or "" (the app registers it with the account)
 *   brandzyPushCount()        how many pushes arrived while the app was open (the app reloads its data)
 *
 * The site's /sw.js shows each push and opens the app when one is tapped.
 */
(function () {
    // Public half of the VAPID key pair; send-push signs with the private half (VAPID_PRIVATE_KEY).
    var VAPID_PUBLIC_KEY = 'BLabUxs3G2bVuc7hELQ5Ltj0wjzOMDGljC81PW5B7I6WzBhVHfnYXOuAiiM5ZgcgzIVpAAQDISyPPgqfZvf60co';
    var subscription = '';
    var received = 0;

    function supported() {
        return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    }
    function isIos() {
        var ua = navigator.userAgent || '';
        return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    }
    function standalone() {
        return window.navigator.standalone === true ||
            (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    }
    function keyBytes(base64url) {
        var b64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
        var raw = atob(b64 + '==='.slice((b64.length + 3) % 4));
        var out = new Uint8Array(raw.length);
        for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
        return out;
    }
    function registration() {
        // install.js registers /sw.js; register here too in case it hasn't run yet (same file, same scope).
        return navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(function () {
            return navigator.serviceWorker.ready;
        });
    }
    function subscribe() {
        return registration().then(function (reg) {
            return reg.pushManager.getSubscription().then(function (existing) {
                return existing || reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: keyBytes(VAPID_PUBLIC_KEY)
                });
            });
        }).then(function (sub) {
            subscription = sub ? JSON.stringify(sub.toJSON()) : '';
        });
    }

    window.brandzyPushState = function () {
        // On iPhone, Push exists only in the app opened from the home screen.
        if (!supported()) return isIos() && !standalone() ? 'needs-install' : 'unsupported';
        return Notification.permission;
    };
    window.brandzyPushEnable = function () {
        if (!supported()) return;
        // requestPermission must be the first thing the tap does, or Safari ignores it.
        var asked = Notification.requestPermission();
        Promise.resolve(asked).then(function (permission) {
            if (permission === 'granted') return subscribe();
        }).catch(function () {});
    };
    window.brandzyPushSubscription = function () { return subscription; };
    window.brandzyPushCount = function () { return received; };

    if (supported()) {
        navigator.serviceWorker.addEventListener('message', function (e) {
            if (e.data === 'brandzy-push') received++;
        });
        // Already allowed: pick up (or renew) this browser's subscription so the app can register it.
        if (Notification.permission === 'granted') subscribe().catch(function () {});
    }
})();
