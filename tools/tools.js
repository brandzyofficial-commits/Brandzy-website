/* Shared helpers for the free tools. Everything runs in the browser; nothing typed is sent anywhere. */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const num = (v) => { const n = parseFloat(String(v == null ? "" : v).replace(/[,₹\s]/g, "")); return isFinite(n) ? n : 0; };
  const inr = (n, dp) => "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: dp || 0, maximumFractionDigits: dp || 0 });
  const roundNice = (n) => { if (n < 1000) return Math.round(n / 50) * 50; if (n < 10000) return Math.round(n / 100) * 100; if (n < 100000) return Math.round(n / 500) * 500; return Math.round(n / 1000) * 1000; };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Indian-system amount in words: 1,25,000 -> "One lakh twenty-five thousand".
  const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
    "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  function two(n) { return n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? "-" + ONES[n % 10] : ""); }
  function three(n) { const h = Math.floor(n / 100), r = n % 100; return (h ? ONES[h] + " hundred" + (r ? " " : "") : "") + (r ? two(r) : ""); }
  function words(n) {
    n = Math.floor(n); if (n === 0) return "zero";
    const parts = []; const cr = Math.floor(n / 1e7); n %= 1e7; const lk = Math.floor(n / 1e5); n %= 1e5;
    const th = Math.floor(n / 1000); n %= 1000;
    if (cr) parts.push(words(cr) + " crore"); if (lk) parts.push(two(lk) + " lakh"); if (th) parts.push(two(th) + " thousand"); if (n) parts.push(three(n));
    return parts.join(" ");
  }
  function rupeesInWords(amount) {
    const r = Math.floor(amount + 1e-9), p = Math.round((amount - r) * 100);
    const s = "Rupees " + words(r) + (p ? " and " + two(p) + " paise" : "") + " only";
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // Remember what someone typed on this device (convenience only; works without it).
  function remember(key, form) {
    const k = "brandzy-tool-" + key;
    try { const saved = JSON.parse(localStorage.getItem(k) || "{}"); $$("[name]", form).forEach((el) => {
      if (!(el.name in saved) || el.type === "file") return; if (el.type === "checkbox") el.checked = !!saved[el.name]; else el.value = saved[el.name]; }); } catch (e) {}
    form.addEventListener("input", () => { try { const o = {}; $$("[name]", form).forEach((el) => {
      if (el.type === "file") return; o[el.name] = el.type === "checkbox" ? el.checked : el.value; }); localStorage.setItem(k, JSON.stringify(o)); } catch (e) {} });
  }
  function track(name) { try { window.gtag && gtag("event", name, { tool: document.body.dataset.tool || "" }); } catch (e) {} }

  // Copy text, then flash "Copied" on the button that asked.
  function copy(text, btn) {
    const done = () => { if (!btn) return; const t = btn.textContent; btn.textContent = "Copied ✓"; setTimeout(() => { btn.textContent = t; }, 1400); };
    try { navigator.clipboard.writeText(text).then(done, () => fallback(text, done)); } catch (e) { fallback(text, done); }
  }
  function fallback(text, done) {
    const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); done(); } catch (e) {} ta.remove();
  }
  // Click a [data-copy="#id"] button to copy that element's text (or value).
  document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest("[data-copy]"); if (!b) return;
    const el = document.querySelector(b.getAttribute("data-copy")); if (!el) return;
    copy("value" in el && el.tagName !== "DIV" ? el.value : el.innerText, b); track("tool_copy");
  });

  window.BT = { $, $$, num, inr, roundNice, esc, rupeesInWords, remember, track, copy };
})();
