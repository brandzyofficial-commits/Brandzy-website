// brandzy.app/<username>/store: the creator's shareable store link. Opens the interactive store
// (/app/#/<username>/store) straight away, keeping ?src= etc. for the store's analytics.
import { sourceQuery } from "../[slug].js";

const USERNAME_RE = /^[a-z0-9_-]{2,40}$/i;

export async function onRequest(context) {
  const slug = String(context.params.slug || "");
  if (!USERNAME_RE.test(slug)) return context.next();
  const target = `/app/${sourceQuery(context.request.url)}#/${encodeURIComponent(slug)}/store`;
  return new Response(null, { status: 302, headers: { Location: target, "Cache-Control": "no-store" } });
}
