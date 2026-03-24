const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const targetTopic = process.argv[2];

if (!targetTopic) {
  console.error('❌ 에러: 아이디를 입력하지 않았습니다!');
  console.error('👉 사용법: node send-test.js [보낼아이디]');
  process.exit(1);
}

console.log(`🚀 전송 시작! 대상(Topic): ${targetTopic}`);

// ✅ 고유 알림 ID 생성 (UUID 대신 타임스탬프 + 랜덤)
const notificationId = `${Date.now()}_${Math.random()
  .toString(36)
  .substr(2, 9)}`;

const message = {
  data: {
    title: '🚨 긴급 상황 발생',
    body: '전동 휠체어 이상 감지! 즉시 확인하세요.',
    timestamp: String(Date.now()),
    notificationId: notificationId, // ✅ 추가: 고유 ID
  },
  android: {
    priority: 'high',
  },
  topic: targetTopic,
};

console.log(`📩 알림 ID: ${notificationId}`);

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
