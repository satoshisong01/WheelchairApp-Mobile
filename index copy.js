import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import messaging from '@react-native-firebase/messaging';
import notifee, {
  AndroidImportance,
  AndroidVisibility,
} from '@notifee/react-native';
// ✅ 소리 강제 재생을 위해 다시 추가
import Sound from 'react-native-sound';

// 백그라운드 이벤트 (필수)
notifee.onBackgroundEvent(async ({ type, detail }) => {
  console.log('백그라운드 이벤트:', type);
});

messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('💀 백그라운드 알림 수신 -> 소리 강제 재생');

  // 1. [핵심] 무음 모드 뚫는 소리 재생
  Sound.setCategory('Alarm'); // 알람 채널 사용 (무음 무시)
  const alarm = new Sound('alarm.mp3', Sound.MAIN_BUNDLE, error => {
    if (!error) {
      alarm.setVolume(1.0);
      alarm.play();
      // 4초 뒤 소리 끄기
      setTimeout(() => {
        alarm.stop(() => alarm.release());
      }, 4000);
    }
  });

  // 2. 채널 생성
  await notifee.createChannel({
    id: 'emergency-v6', // 기존 v6 유지
    name: '긴급 알림 v6',
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    sound: 'alarm',
    vibration: true,
  });

  // 3. 배너 띄우기
  await notifee.displayNotification({
    id: 'emergency_alert',
    title: remoteMessage.data?.title || '🚨 긴급 상황',
    body: remoteMessage.data?.body || '확인하세요',
    android: {
      channelId: 'emergency-v6',
      importance: AndroidImportance.HIGH,
      sound: 'alarm',
      pressAction: { id: 'default', launchActivity: 'default' },
      autoCancel: true,
    },
  });

  // 아이콘 배지 1 (확인 안 함 표시)
  await notifee.setBadgeCount(1);
});

AppRegistry.registerComponent(appName, () => App);
