const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

// 토큰 확인 필수!
const YOUR_DEVICE_TOKEN =
  'e2K8ITd-QVKFT_m4fIG0BB:APA91bHZrRe1VRgvdd7hwJqCL671CiGlvE4_5B6sGzwL1akZ4C44vBRL8Q04ykh7wFujPTLlCkcQ3s_FpIgkx30JhZxgT5l3ByYIE6TalND9mNB4r8kIDRE';

const message = {
  data: {
    title: '🚨 긴급 상황 발생',
    body: '전동 휠체어 이상 감지! 즉시 확인하세요.',
    timestamp: String(Date.now()), // 👈 여기가 중요합니다. 현재 시간을 보냄.
  },
  android: {
    priority: 'high',
  },
  token: YOUR_DEVICE_TOKEN,
};

admin
  .messaging()
  .send(message)
  .then(response => {
    console.log('✅ 전송 성공:', response);
    process.exit(0);
  })
  .catch(error => {
    console.log('❌ 실패:', error);
    process.exit(1);
  });
