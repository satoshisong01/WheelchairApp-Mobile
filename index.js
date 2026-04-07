import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import messaging from '@react-native-firebase/messaging';
import notifee, {
  AndroidImportance,
  AndroidVisibility,
} from '@notifee/react-native';
import Sound from 'react-native-sound';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ✅ 백그라운드에서도 같은 로직 사용
const isAlreadyProcessed = async messageId => {
  try {
    const processed = await AsyncStorage.getItem(`PROCESSED_${messageId}`);
    return processed === 'true';
  } catch (e) {
    return false;
  }
};

const markAsProcessed = async messageId => {
  try {
    await AsyncStorage.setItem(`PROCESSED_${messageId}`, 'true');
    setTimeout(async () => {
      await AsyncStorage.removeItem(`PROCESSED_${messageId}`);
    }, 600000);
  } catch (e) {
    console.log('처리 기록 실패:', e);
  }
};

notifee.onBackgroundEvent(async ({ type, detail }) => {
  console.log('백그라운드 이벤트:', type);
});

messaging().setBackgroundMessageHandler(async remoteMessage => {
  const messageId =
    remoteMessage.messageId || remoteMessage.data?.notificationId;

  if (!messageId) {
    console.log('⚠️ 메시지 ID 없음');
    return;
  }

  // ✅ 이미 처리된 알림이면 무시
  const alreadyProcessed = await isAlreadyProcessed(messageId);
  if (alreadyProcessed) {
    console.log(`🚫 백그라운드 - 이미 처리된 알림: ${messageId}`);
    return;
  }

  console.log(`💀 백그라운드 알림 처리: ${messageId}`);

  // 소리 재생 — sound 필드에 따라 다른 소리 재생
  const soundMap = { ding: 'ding.mp3', chair: 'chair.mp3' };
  const soundFile = soundMap[remoteMessage.data?.sound] || 'alarm.mp3';
  const isComplete = remoteMessage.data?.sound === 'ding';

  try {
    Sound.setCategory('Alarm');
    const alarm = new Sound(soundFile, Sound.MAIN_BUNDLE, error => {
      if (!error) {
        alarm.setVolume(1.0);
        alarm.play();
        setTimeout(() => {
          alarm.stop(() => alarm.release());
        }, isComplete ? 2000 : 4000);
      } else {
        console.warn('🔊 백그라운드 소리 로딩 실패:', error);
      }
    });
  } catch (e) {
    console.warn('🔊 백그라운드 Sound 초기화 실패:', e);
  }

  // 채널 생성 & 배너
  await notifee.createChannel({
    id: 'emergency-v6',
    name: '긴급 알림 v6',
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    sound: 'alarm',
    vibration: true,
  });

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

  await notifee.setBadgeCount(1);

  // ✅ 처리 완료 기록
  await markAsProcessed(messageId);
});

AppRegistry.registerComponent(appName, () => App);
