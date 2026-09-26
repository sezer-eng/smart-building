import { getStore } from '@netlify/blobs';

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  try {
    const sub = await req.json();
    if (!sub || !sub.endpoint) {
      return new Response(JSON.stringify({ ok: false, error: 'اشتراك غير صالح' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const store = getStore('push-subscriptions');
    // مفتاح فريد لكل جهاز/متصفح مبني من رابط الاشتراك نفسه
    const key = Buffer.from(sub.endpoint).toString('base64').slice(0, 180);
    await store.setJSON(key, sub);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e && e.message || e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const config = { path: '/api/subscribe' };
