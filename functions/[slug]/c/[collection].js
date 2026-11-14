// brandzy.app/<username>/c/<collection>: a shareable link to one of the creator's collections.
// Opens it in the app (/app/#/<username>/c/<collection>) straight away, keeping ?src= etc. for analytics.
import { sourceQuery } from "../../[slug].js";

const USERNAME_RE = /^[a-z0-9_-]{2,40}$/i;
const COLLECTION_RE = /^[a-z0-9][a-z0-9-]{0,39}$/i;

export async function onRequest(context) {
  const slug = String(context.params.slug || "");
  const collection = String(context.params.collection || "").toLowerCase();
  if (!USERNAME_RE.test(slug) || !COLLECTION_RE.test(collection)) return context.next();
  const target = `/app/${sourceQuery(context.request.url)}#/${encodeURIComponent(slug)}/c/${collection}`;
  return new Response(null, { status: 302, headers: { Location: target, "Cache-Control": "no-store" } });
}
