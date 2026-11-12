// Crawlable creator pages: https://brandzy.app/<username>
//
// The interactive store lives at /app/#/<username>, which search engines can't index (the part
// after # never reaches a server, and /app/ is noindex). This function answers /<username> with a
// plain HTML page built from the same public data the app shows, so a creator's name can rank on
// Google and AI search, and links people to the full store.
//
// Static files always win: a real page (/pricing, /linktree-alternative, ...) is served as usual,
// and only a path that would otherwise 404 is looked up as a username.
//
// /sitemap-creators.xml lists every published creator page.

const SUPABASE_URL = "https://onypzbtzzilpxhleikgd.supabase.co";
// Public anon key: it already ships in the web app, and row-level security only lets it read
// published, active creator pages.
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ueXB6YnR6emlscHhobGVpa2dkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwODMzODYsImV4cCI6MjEwNTY1OTM4Nn0.BCmsjCa6qH7tjVMcPQx8Z-vZjFEznCmy5gMmQRWs9dI";
const SITE = "https://brandzy.app";

const CREATOR_COLUMNS =
  "id,username,name,bio,niche,pitch_tagline,location,primary_platform,currency," +
  "rate_card_reel,rate_card_post,rate_card_video,rate_card_story,rate_card_retainer,show_rate_card," +
  "avatar_url,show_past_deals";

// Accounts made for Google Play and Meta app review: real pages, but not for search results.
const NOINDEX_USERNAMES = new Set(["metareview", "metareviewdemo", "playreview"]);

const USERNAME_RE = /^[a-z0-9_.-]{2,40}$/i;
const FILE_LIKE_RE = /\.(html?|php|xml|txt|json|js|css|png|jpe?g|gif|svg|ico|webp|map|wasm|env|zip)$/i;

export async function onRequest(context) {
  const { request, params } = context;
  if (request.method !== "GET" && request.method !== "HEAD") return context.next();

  const slug = String(params.slug || "");
  if (slug === "sitemap-creators.xml") return creatorsSitemap();

  const res = await context.next();
  if (res.status !== 404) return res;
  if (!USERNAME_RE.test(slug) || FILE_LIKE_RE.test(slug) || slug.startsWith(".")) return res;

  try {
    const creator = await fetchCreator(slug);
    if (!creator) return res;

    // A different capitalisation of the username: send it to the one true address.
    if (creator.username !== slug) {
      return Response.redirect(`${SITE}/${encodeURIComponent(creator.username)}`, 301);
    }

    const [products, stats, deals] = await Promise.all([
      rest(`public_products?creator_id=eq.${creator.id}&is_active=eq.true&order=sort_order.asc,created_at.desc&select=title,description,type,price,currency,price_usd,billing_period`).catch(() => []),
      rest(`social_stats?creator_id=eq.${creator.id}&select=platform,handle,follower_count`).catch(() => []),
      creator.show_past_deals
        ? rest(`public_deals?creator_id=eq.${creator.id}&order=created_at.desc&select=brand_name`).catch(() => [])
        : Promise.resolve([]),
    ]);

    const html = renderPage(creator, products || [], stats || [], deals || [], sourceQuery(request.url));
    return new Response(request.method === "HEAD" ? null : html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    // The database couldn't be reached: ask crawlers to come back rather than drop the page.
    return new Response("Brandzy is busy right now. Please try again in a minute.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Retry-After": "120", "Cache-Control": "no-store" },
    });
  }
}

async function rest(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    cf: { cacheTtl: 120, cacheEverything: true },
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}`);
  return r.json();
}

async function fetchCreator(slug) {
  // ilike without wildcards = a case-insensitive exact match; escape the characters ilike treats specially.
  const pattern = slug.replace(/[%_\\]/g, (c) => "\\" + c);
  const rows = await rest(
    `creators?username=ilike.${encodeURIComponent(pattern)}&select=${CREATOR_COLUMNS}&limit=1`
  );
  return rows && rows[0] ? rows[0] : null;
}

async function creatorsSitemap() {
  let rows = [];
  try {
    rows = await rest("creators?select=username,bio,pitch_tagline&order=username.asc&limit=5000");
  } catch (err) {
    return new Response("", { status: 503, headers: { "Retry-After": "300" } });
  }
  const urls = rows
    .filter((c) => c.username && USERNAME_RE.test(c.username) && !NOINDEX_USERNAMES.has(c.username.toLowerCase()))
    .map((c) => `  <url><loc>${SITE}/${xmlEscape(encodeURIComponent(c.username))}</loc><changefreq>weekly</changefreq></url>`)
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}

/** "?src=..." with only the traffic-source parameters of the visited URL, or "". */
export function sourceQuery(url) {
  const from = new URL(url).searchParams;
  const keep = new URLSearchParams();
  for (const key of ["src", "utm_source", "utm_medium", "utm_campaign", "ref"]) {
    const v = from.get(key);
    if (v) keep.set(key, v.slice(0, 100));
  }
  const q = keep.toString();
  return q ? "?" + q : "";
}

// ---------- rendering ----------

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
const xmlEscape = esc;

function jsonLd(obj) {
  // Keep "</script>" (and friends) from ending the block early.
  return JSON.stringify(obj).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

function clip(s, n) {
  s = String(s || "").replace(/\s+/g, " ").trim();
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

const SYMBOLS = { INR: "₹", USD: "$", EUR: "€", GBP: "£", AED: "AED ", SGD: "S$", AUD: "A$", CAD: "C$" };
function money(amount, currency) {
  const n = Number(amount);
  if (!isFinite(n) || n <= 0) return "";
  const cur = String(currency || "INR").toUpperCase();
  const locale = cur === "INR" ? "en-IN" : "en-US";
  const num = n.toLocaleString(locale, { maximumFractionDigits: n % 1 === 0 ? 0 : 2 });
  return (SYMBOLS[cur] ?? cur + " ") + num;
}

function followers(n) {
  n = Number(n) || 0;
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, "") + "K";
  return String(n);
}

const TYPE_LABELS = {
  digital_download: "Digital download",
  coaching: "1:1 call",
  course: "Course",
  affiliate: "Recommended",
  membership: "Membership",
  link: "Link",
};
function typeLabel(t) {
  if (!t) return "";
  return TYPE_LABELS[t] || t.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

function productPrice(p) {
  const main = money(p.price, p.currency);
  const usd = p.price_usd && String(p.currency).toUpperCase() !== "USD" ? money(p.price_usd, "USD") : "";
  if (!main && !usd) return p.type === "affiliate" ? "" : "Free";
  const per = p.billing_period === "monthly" ? " / month" : p.billing_period === "yearly" ? " / year" : "";
  return [main, usd].filter(Boolean).join(" · ") + per;
}

function renderPage(c, products, stats, deals, query) {
  const username = c.username;
  const name = (c.name || "").trim() || username;
  // Buttons carry ?src= / ?utm_source= / ?ref= on to the store, where its analytics read them.
  const appUrl = `/app/${query}#/${encodeURIComponent(username)}`;
  const canonical = `${SITE}/${encodeURIComponent(username)}`;
  const image = c.avatar_url && /^https:\/\//.test(c.avatar_url) ? c.avatar_url : `${SITE}/og-image.png`;

  const statsShown = stats.filter((s) => s.platform && Number(s.follower_count) > 0)
    .sort((a, b) => Number(b.follower_count) - Number(a.follower_count));
  const totalFollowers = statsShown.reduce((t, s) => t + Number(s.follower_count), 0);

  const descBits = [];
  if (c.pitch_tagline) descBits.push(c.pitch_tagline);
  if (c.bio) descBits.push(c.bio);
  if (!descBits.length) {
    const what = [c.niche && `${c.niche} creator`, c.location && `based in ${c.location}`].filter(Boolean).join(" ");
    descBits.push(`${name} (@${username})${what ? ", " + what : ""}.`);
  }
  if (products.length) descBits.push(`Shop ${products.length} product${products.length > 1 ? "s" : ""}: ${products.slice(0, 3).map((p) => p.title).join(", ")}.`);
  const description = clip(descBits.join(" "), 158);

  const thin = !c.bio && !c.pitch_tagline && !products.length && !statsShown.length;
  const robots = NOINDEX_USERNAMES.has(username.toLowerCase()) || thin ? "noindex, follow" : "index, follow, max-image-preview:large";

  const rates = c.show_rate_card
    ? [
        ["Instagram Reel", c.rate_card_reel],
        ["Feed post", c.rate_card_post],
        ["YouTube video", c.rate_card_video],
        ["Story", c.rate_card_story],
        ["Monthly retainer", c.rate_card_retainer],
      ].filter(([, v]) => Number(v) > 0)
    : [];

  const brands = [...new Set(deals.map((d) => (d.brand_name || "").trim()).filter(Boolean))].slice(0, 20);

  const ld = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "@id": canonical,
    url: canonical,
    name: `${name} (@${username})`,
    description,
    isPartOf: { "@type": "WebSite", name: "Brandzy", url: SITE },
    mainEntity: {
      "@type": "Person",
      name,
      alternateName: "@" + username,
      identifier: username,
      url: canonical,
      image,
      description: clip(c.bio || c.pitch_tagline || description, 300),
      ...(c.niche ? { knowsAbout: c.niche } : {}),
      ...(c.location ? { homeLocation: { "@type": "Place", name: c.location } } : {}),
      ...(statsShown.length
        ? {
            interactionStatistic: statsShown.map((s) => ({
              "@type": "InteractionCounter",
              interactionType: "https://schema.org/FollowAction",
              userInteractionCount: Number(s.follower_count),
              name: s.platform,
            })),
          }
        : {}),
      ...(products.length
        ? {
            makesOffer: products.slice(0, 30).map((p) => ({
              "@type": "Offer",
              name: p.title,
              ...(Number(p.price) > 0 ? { price: Number(p.price), priceCurrency: String(p.currency || "INR").toUpperCase() } : {}),
              url: `${SITE}/app/#/${encodeURIComponent(username)}`,
            })),
          }
        : {}),
    },
  };

  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Brandzy", item: SITE + "/" },
      { "@type": "ListItem", position: 2, name, item: canonical },
    ],
  };

  const sub = [c.niche && `${c.niche} creator`, c.location].filter(Boolean).join(" · ");

  return `<!doctype html>
<html lang="en-IN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(name)} (@${esc(username)}) · Brandzy</title>
<meta name="description" content="${esc(description)}" />
<meta name="robots" content="${robots}" />
<link rel="canonical" href="${esc(canonical)}" />
<meta property="og:type" content="profile" />
<meta property="og:site_name" content="Brandzy" />
<meta property="og:title" content="${esc(name)} (@${esc(username)})" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${esc(canonical)}" />
<meta property="og:image" content="${esc(image)}" />
<meta property="profile:username" content="${esc(username)}" />
<meta name="twitter:card" content="summary" />
<meta name="twitter:title" content="${esc(name)} (@${esc(username)})" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="${esc(image)}" />
<link rel="icon" type="image/png" href="/assets/favicon.png" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/compare.css" />
<style>
  .profile { display: flex; gap: 18px; align-items: center; margin-bottom: 18px; }
  .avatar { width: 96px; height: 96px; border-radius: 50%; object-fit: cover; flex: none; background: var(--bg-soft); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 38px; font-weight: 800; color: var(--brand-dark); }
  .profile h1 { margin-bottom: 2px; }
  .handle { color: var(--text-faint); font-weight: 600; }
  .stats { display: flex; flex-wrap: wrap; gap: 10px; margin: 18px 0 6px; padding: 0; list-style: none; }
  .stats li { border: 1px solid var(--border); border-radius: 12px; padding: 8px 14px; margin: 0; font-size: 14px; }
  .stats strong { font-size: 17px; margin-right: 4px; }
  .products { list-style: none; margin: 12px 0; padding: 0; display: grid; gap: 12px; }
  .products li { border: 1px solid var(--border); border-radius: 16px; padding: 16px 18px; margin: 0; }
  .products .row { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; }
  .products h3 { margin: 0; font-size: 17px; }
  .products .price { font-weight: 800; color: var(--text); white-space: nowrap; }
  .products .kind { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--brand-dark); }
  .products p { margin: 6px 0 0; font-size: 15px; }
  .brands { display: flex; flex-wrap: wrap; gap: 8px; list-style: none; margin: 10px 0; padding: 0; }
  .brands li { background: var(--bg-soft); border-radius: 999px; padding: 6px 14px; margin: 0; font-size: 14px; font-weight: 600; color: var(--text); }
  @media (max-width: 400px) { .nav-links .btn { padding: 8px 12px; font-size: 13px; } .logo { font-size: 17px; } }
  .open { margin: 22px 0 6px; display: flex; flex-wrap: wrap; gap: 10px; }
  @media (max-width: 480px) { .avatar { width: 72px; height: 72px; font-size: 28px; } .products .row { flex-direction: column; gap: 2px; } }
</style>
<script type="application/ld+json">${jsonLd(ld)}</script>
<script type="application/ld+json">${jsonLd(breadcrumbs)}</script>
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-5C2B6BQRZX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-5C2B6BQRZX');
</script>
</head>
<body>
<header>
  <nav>
    <a class="logo" href="/"><img src="/assets/logo-mark.png" alt="" />Brandzy</a>
    <div class="nav-links">
      <a class="hide-sm" href="/pricing">Pricing</a>
      <a class="btn" href="/get?utm_source=creator_page&amp;utm_medium=header" style="white-space:nowrap">Get the app</a>
    </div>
  </nav>
</header>
<main>
  <div class="profile">
    ${image.endsWith("/og-image.png")
      ? `<div class="avatar" aria-hidden="true">${esc(name.charAt(0).toUpperCase())}</div>`
      : `<img class="avatar" src="${esc(image)}" alt="${esc(name)}" width="96" height="96" />`}
    <div>
      <h1>${esc(name)}</h1>
      <div class="handle">@${esc(username)}${sub ? " · " + esc(sub) : ""}</div>
    </div>
  </div>
  ${c.pitch_tagline ? `<p class="lede">${esc(c.pitch_tagline)}</p>` : ""}
  ${c.bio ? c.bio.split(/\n{2,}/).map((para) => `<p>${esc(para).replace(/\n/g, "<br />")}</p>`).join("\n  ") : ""}
  ${statsShown.length
    ? `<ul class="stats">
    ${statsShown.map((s) => `<li><strong>${followers(s.follower_count)}</strong>${esc(s.platform)} followers${s.handle ? ` <span class="handle">${esc(s.handle.startsWith("@") ? s.handle : "@" + s.handle)}</span>` : ""}</li>`).join("\n    ")}
    ${statsShown.length > 1 ? `<li><strong>${followers(totalFollowers)}</strong>total audience</li>` : ""}
  </ul>`
    : ""}
  <div class="open">
    <a class="btn" href="${esc(appUrl)}">${products.length ? "Open the store" : "Open the full page"}</a>
    ${c.show_rate_card || brands.length ? `<a class="btn btn-ghost" href="${esc(appUrl)}">Work with ${esc(name.split(" ")[0])}</a>` : ""}
  </div>

  ${products.length
    ? `<h2>Products by ${esc(name)}</h2>
  <ul class="products">
    ${products.slice(0, 50).map((p) => {
      const price = productPrice(p);
      return `<li>
      <div class="kind">${esc(typeLabel(p.type))}</div>
      <div class="row"><h3><a href="${esc(appUrl)}">${esc(p.title)}</a></h3>${price ? `<span class="price">${esc(price)}</span>` : ""}</div>
      ${p.description ? `<p>${esc(clip(p.description, 240))}</p>` : ""}
    </li>`;
    }).join("\n    ")}
  </ul>`
    : ""}

  ${rates.length
    ? `<h2>Brand collaboration rates</h2>
  <div class="table-wrap"><table style="min-width:0">
    <tbody>
      ${rates.map(([label, v]) => `<tr><td>${esc(label)}</td><td>${esc(money(v, c.currency))}</td></tr>`).join("\n      ")}
    </tbody>
  </table></div>
  <p class="note">Starting rates. Send an enquiry from the <a href="${esc(appUrl)}">full page</a> for a quote.</p>`
    : ""}

  ${brands.length
    ? `<h2>Brands ${esc(name.split(" ")[0])} has worked with</h2>
  <ul class="brands">${brands.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`
    : ""}

  <section class="cta">
    <h2>Make a page like this, free</h2>
    <p>Brandzy is a link in bio store for creators: sell digital products, courses, 1:1 calls and memberships, and send brands your media kit, with 0% Brandzy fees.</p>
    <a class="btn" href="/get?utm_source=creator_page&amp;utm_medium=cta&amp;utm_campaign=${esc(encodeURIComponent(username))}">Get the Brandzy app</a>
    <a class="btn btn-ghost" href="/?utm_source=creator_page&amp;utm_medium=cta">See how it works</a>
  </section>
  <p class="note" style="text-align:center;margin-top:18px"><a href="/get?utm_source=creator_page&amp;utm_medium=footer&amp;utm_campaign=${esc(encodeURIComponent(username))}">Made with Brandzy · Get the app</a></p>
</main>
<footer>
  <div class="footer-wrap">
    <span>© Brandzy</span>
    <a href="/">Home</a>
    <a href="/pricing">Pricing</a>
    <a href="/linktree-alternative">Linktree alternative</a>
    <a href="/stan-store-alternative">Stan Store alternative</a>
    <a href="/privacy">Privacy</a>
    <a href="/terms">Terms</a>
  </div>
</footer>
</body>
</html>`;
}
