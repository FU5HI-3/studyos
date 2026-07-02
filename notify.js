// StudyOS 通知スクリプト - GitHub Actionsで毎時間実行
const webpush = require('web-push');
// node-fetchはNode18以降不要
const fetch = globalThis.fetch || require('node-fetch');

webpush.setVapidDetails(
  'mailto:studyos-notify@example.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const FIREBASE_URL = 'https://studyos-9fd73-default-rtdb.asia-southeast1.firebasedatabase.app';

async function main() {
  console.log('🔔 通知チェック開始:', new Date().toISOString());

  // Firebaseからデータ取得
  const res = await fetch(`${FIREBASE_URL}/studyos-data.json`);
  const json = await res.json();

  if (!json || !json.data) { console.log('データなし'); return; }
  if (!json.pushSubscription) { console.log('プッシュ購読なし'); return; }

  const { data, pushSubscription } = json;
  const now = new Date();
  const nowJST = new Date(now.getTime() + 9 * 3600000); // JST
  const todayStr = nowJST.toISOString().slice(0, 10);

  const assignments = data.assignments || [];
  const tasks = data.tasks || [];
  const notifHours = parseInt(data.notifHours || '24');
  const notifications = [];

  // 締切通知
  assignments.filter(a => !a.done).forEach(a => {
    const dl = new Date(`${a.date}T${a.time || '23:00'}:00+09:00`);
    const hoursUntil = (dl - now) / 3600000;
    // 設定した時間数の前後30分以内に入ったら通知
    if (hoursUntil > (notifHours - 0.5) && hoursUntil <= (notifHours + 0.5)) {
      notifications.push({
        title: `⏰ ${Math.round(hoursUntil)}時間後に締切: ${a.name}`,
        body: `${a.subject || ''}  ${a.date} ${a.time || '23:59'}まで`
      });
    }
    // 1時間前の追加通知
    if (hoursUntil > 0.5 && hoursUntil <= 1.5) {
      notifications.push({
        title: `🚨 まもなく締切: ${a.name}`,
        body: `1時間以内に締切です！今すぐ確認してください`
      });
    }
  });

  // 朝8時の今日のタスク通知（JST 8:00 = UTC 23:00）
  const utcHour = now.getUTCHours();
  const morningNotif = data.morningNotif !== false;
  if (morningNotif && utcHour === 23) {
    const todayTasks = tasks.filter(t => !t.done && t.date === todayStr);
    const todayAssigns = assignments.filter(a => !a.done && a.date === todayStr);
    if (todayTasks.length > 0 || todayAssigns.length > 0) {
      const items = [...todayAssigns.map(a => `📚 ${a.name}`), ...todayTasks.map(t => `✅ ${t.name}`)];
      notifications.push({
        title: `🌅 今日のスケジュール (${todayStr})`,
        body: items.slice(0, 3).join('\n') + (items.length > 3 ? `\n他 ${items.length - 3}件` : '')
      });
    }
  }

  if (notifications.length === 0) { console.log('送る通知なし'); return; }

  // 通知を送信
  for (const notif of notifications) {
    try {
      await webpush.sendNotification(
        pushSubscription,
        JSON.stringify(notif),
        { TTL: 3600 }
      );
      console.log('✅ 送信:', notif.title);
    } catch (e) {
      console.error('❌ 送信失敗:', e.statusCode, e.body);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
