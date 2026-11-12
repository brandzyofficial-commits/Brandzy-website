// brandzy.app/get?utm_source=creator_page&utm_medium=badge — the "get the app" link.
// Android phones go to the Play Store listing with the utm_* values as the install referrer (so
// Play Console's acquisition reports show where installs came from); everyone else goes to sign-up
// on the web app, which reads the same utm_* values.
const PLAY = "https://play.google.com/store/apps/details?id=com.brandzy.app";

export async function onRequest({ request }) {
  const url = new URL(request.url);
  const utm = new URLSearchParams();
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content"]) {
    const v = url.searchParams.get(key);
    if (v) utm.set(key, v.slice(0, 100));
  }
  if (!utm.has("utm_source")) utm.set("utm_source", "brandzy_get");

  const ua = request.headers.get("user-agent") || "";
  const target = /Android/i.test(ua)
    ? `${PLAY}&referrer=${encodeURIComponent(utm.toString())}`
    : `/app/?signup&${utm.toString()}`;
  return new Response(null, { status: 302, headers: { Location: target, "Cache-Control": "no-store", Vary: "User-Agent" } });
}
