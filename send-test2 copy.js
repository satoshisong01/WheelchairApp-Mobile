const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

// 1. 명령어 뒤에 적은 아이디를 가져옵니다.
// 사용법: node send-test.js [아이디]
const targetTopic = process.argv[2];

if (!targetTopic) {
  console.error('❌ 에러: 아이디를 입력하지 않았습니다!');
  console.error('👉 사용법: node send-test.js [보낼아이디]');
  process.exit(1);
}

console.log(`🚀 전송 시작! 대상(Topic): ${targetTopic}`);

const message = {
  data: {
    title: '🚨 긴급 상황 발생',
    body: '전동 휠체어 이상 감지! 즉시 확인하세요.',
    timestamp: String(Date.now()), // 3초 룰 통과용 시간
  },
  android: {
    priority: 'high',
  },
  // ✅ [핵심] 토큰(token)을 지우고 토픽(topic)을 넣었습니다.
  topic: targetTopic,
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
