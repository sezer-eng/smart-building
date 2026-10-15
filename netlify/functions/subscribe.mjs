import { getStore } from '@netlify/blobs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async (req) => {
‎  // المتصفح يرسل طلب "OPTIONS" تمهيدي قبل أي طلب من موقع بمجال مختلف — نرد عليه بالسماح
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  }
  try {
    const sub = await req.json();
    if (!sub || !sub.endpoint) {
      return new Response(JSON.stringify({ ok: false, error: 'اشتراك غير صالح' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
    const store = getStore('push-subscriptions');
    const key = Buffer.from(sub.endpoint).toString('base64').slice(0, 180);
    await store.setJSON(key, sub);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e && e.message || e) }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
};

export const config = { path: '/api/subscribe' };
