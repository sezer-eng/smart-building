import { getStore } from '@netlify/blobs';
import mqtt from 'mqtt';
import webpush from 'web-push';

const NAMES = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس'];

function getReading(topicBase) {
  return new Promise((resolve, reject) => {
    let done = false;
    const client = mqtt.connect(process.env.MQTT_URL, {
      username: process.env.MQTT_USER || undefined,
      password: process.env.MQTT_PASS || undefined,
      clientId: 'netlify-check-' + Math.random().toString(16).slice(2),
      connectTimeout: 8000,
      clean: true,
      reconnectPeriod: 0,
    });

    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      client.end(true);
      reject(new Error('انتهت المهلة — ما وصلت أي بيانات من الوسيط خلال 9 ثوانٍ'));
    }, 9000);

    client.on('connect', () => {
      client.subscribe(topicBase + '/data', { qos: 1 }, (err) => {
        if (err && !done) {
          done = true;
          clearTimeout(timer);
          client.end(true);
          reject(err);
        }
      });
    });

    client.on('message', (topic, message) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try {
        const data = JSON.parse(message.toString());
        client.end(true);
        resolve(data);
      } catch (e) {
        client.end(true);
        reject(e);
      }
    });

    client.on('error', (err) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      client.end(true);
      reject(err);
    });
  });
}

export default async (req) => {
  const minV = parseFloat(process.env.MIN_V || '2');
  const minI = parseFloat(process.env.MIN_I || '5');
  const topic = process.env.MQTT_TOPIC;
  const vapidPublic = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

  if (!topic || !process.env.MQTT_URL) {
    return new Response(
      JSON.stringify({ ok: false, error: 'إعدادات MQTT ناقصة — تأكد من MQTT_URL و MQTT_TOPIC بمتغيرات البيئة' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  if (!vapidPublic || !vapidPrivate) {
    return new Response(
      JSON.stringify({ ok: false, error: 'مفاتيح VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY غير موجودة بمتغيرات البيئة' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  let data;
  try {
    data = await getReading(topic);
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const floors = data.floors || data.f || [];
  const roof = data.roof || data.r || {};
  const issues = [];

  floors.forEach((f, k) => {
    if (!f) return;
    const v = +f.v || 0, i = +f.i || 0;
    if (v < minV) issues.push(`الطابق ${NAMES[k]}: فولتية منخفضة (${v.toFixed(2)} V)`);
    if (i < minI) issues.push(`الطابق ${NAMES[k]}: تيار منخفض (${i.toFixed(1)} mA)`);
  });
  if (roof && (roof.v !== undefined || roof.i !== undefined)) {
    const v = +roof.v || 0, i = +roof.i || 0;
    if (v < minV) issues.push(`السطح: فولتية منخفضة (${v.toFixed(2)} V)`);
    if (i < minI) issues.push(`السطح: تيار منخفض (${i.toFixed(1)} mA)`);
  }

  const stateStore = getStore('alert-state');
  const prev = (await stateStore.get('last', { type: 'json' })) || { hadIssue: false };
  const hasIssueNow = issues.length > 0;

  let notifiedCount = 0;
  if (hasIssueNow && !prev.hadIssue) {
    const subsStore = getStore('push-subscriptions');
    const { blobs } = await subsStore.list();
    const payload = JSON.stringify({
      title: 'تنبيه من مبنى الطاقة',
      body: issues.slice(0, 3).join(' — '),
    });
    for (const b of blobs) {
      const sub = await subsStore.get(b.key, { type: 'json' });
      if (!sub) continue;
      try {
        await webpush.sendNotification(sub, payload);
        notifiedCount++;
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) {
          await subsStore.delete(b.key);
        }
      }
    }
  }

  await stateStore.setJSON('last', { hadIssue: hasIssueNow, at: Date.now(), issues });

  return new Response(
    JSON.stringify({ ok: true, hasIssueNow, issues, notifiedCount }),
    { headers: { 'Content-Type': 'application/json' } }
  );
};

export const config = { path: '/api/check-alerts' };
