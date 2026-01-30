// send-test.js
const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

const YOUR_DEVICE_TOKEN =
  'dadGvb08RSCLYVleVlT0AY:APA91bHVJ0lwUN1VYctvEgDjSHoXxr7SJajy63g4Xpgpegmx-0hU4BgVyw84vTTz_ul2w64K_w3VnA9XmnDXrbQEwQSs5gbuC3Sl1pgny9rfDhcINs3WK9o';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// ... (위쪽 설정 동일)
const message = {
  notification: {
    title: '🔊 볼륨 테스트',
    body: '벨소리를 끄고 미디어 볼륨만 켜보세요. 소리가 나야 합니다!',
  },
  android: {
    notification: {
      channelId: 'emergency-silent', // 👈 앱에서 만든 '소리 없는 채널' ID
      priority: 'high',
      visibility: 'public',
      // sound: 'alarm'  <-- ❌ 이거 뺍니다! (앱이 직접 재생하니까요)
    },
  },
  token: YOUR_DEVICE_TOKEN,
};
// ... (전송 코드 동일)

admin
  .messaging()
  .send(message)
  .then(response => {
    console.log('✅ 성공! 메시지 전송 완료:', response);
    process.exit(0);
  })
  .catch(error => {
    console.log('❌ 실패:', error);
    process.exit(1);
  });
