/* First touch: how this visitor first found Brandzy (referrer site, UTM tags, ?ref= code, first page).
   Kept only in this browser (localStorage "bz_ft"); the app sends it once when the visitor creates an account.
   No cookies, nothing sent from here. */
(function () {
  try {
    var q = new URLSearchParams(location.search), host = '';
    try { host = document.referrer ? new URL(document.referrer).hostname : ''; } catch (e) {}
    if (host === location.hostname) host = '';
    var now = {
      ref: (q.get('ref') || '').slice(0, 60),
      utm_source: (q.get('utm_source') || '').slice(0, 60),
      utm_medium: (q.get('utm_medium') || '').slice(0, 60),
      utm_campaign: (q.get('utm_campaign') || '').slice(0, 100),
      referrer: host.slice(0, 120),
      landing: location.pathname.slice(0, 200),
      at: new Date().toISOString()
    };
    var old = null;
    try { old = JSON.parse(localStorage.getItem('bz_ft') || 'null'); } catch (e) {}
    var known = function (o) { return o && (o.ref || o.utm_source || o.referrer); };
    var stale = old && old.at && (Date.now() - Date.parse(old.at) > 90 * 864e5);
    // Keep the first touch; replace it only when it's older than 90 days, or it was a plain direct
    // visit and this one says where the visitor came from.
    if (!old || stale || (!known(old) && known(now))) localStorage.setItem('bz_ft', JSON.stringify(now));
  } catch (e) {}
})();
