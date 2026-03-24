import React, { useEffect, useRef } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Alert,
  Platform,
  Vibration,
  PermissionsAndroid,
  AppState,
  LogBox,
} from 'react-native';
import { WebView } from 'react-native-webview';
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';
import Sound from 'react-native-sound';
// ✅ [추가] 저장소 사용을 위해 import
import AsyncStorage from '@react-native-async-storage/async-storage';

LogBox.ignoreLogs(['Firebase Messaging: This method is deprecated']);

const WEB_URL = 'https://wheelchair2-front.vercel.app/mobile-view';

const App = () => {
  const appState = useRef(AppState.currentState);

  // ✅ [추가] 웹(Next.js)에서 보낸 로그인 정보를 받는 함수
  const handleWebMessage = async event => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      // 웹에서 "LOGIN_SUCCESS"라는 신호가 왔을 때 실행
      if (data.type === 'LOGIN_SUCCESS' && data.userId) {
        console.log(`📥 웹에서 로그인 정보 수신: ${data.userId}`);

        // 1. Firebase 주제 구독 (이름표 부착)
        await messaging().subscribeToTopic(data.userId);

        // 2. 앱 내부 저장소에 아이디 저장 (나중에 앱 껐다 켜도 기억하게)
        await AsyncStorage.setItem('USER_ID', data.userId);

        Alert.alert('연동 완료', '알림 설정이 완료되었습니다.');
      }
    } catch (e) {
      console.log('메시지 처리 중 에러:', e);
    }
  };

  useEffect(() => {
    const setupApp = async () => {
      // 1. 초기화 (배너 삭제, 배지 0)
      await notifee.cancelAllNotifications();
      await notifee.setBadgeCount(0);

      // 2. 권한 요청
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );
      }
      await messaging().requestPermission();

      // 3. 토큰 확인 (로그용)
      const token = await messaging().getToken();
      console.log('=== DEVICE TOKEN ===', token);

      // ✅ [추가] 앱 켤 때, 예전에 로그인했던 기록이 있는지 확인하고 재구독
      const savedUserId = await AsyncStorage.getItem('USER_ID');
      if (savedUserId) {
        console.log(
          `💾 기존 로그인 정보 발견: ${savedUserId} (자동 구독 갱신)`,
        );
        await messaging().subscribeToTopic(savedUserId);
      }

      // 4. 채널 생성
      if (Platform.OS === 'android') {
        await notifee.createChannel({
          id: 'emergency-v6',
          name: '긴급 알림 v6',
          importance: AndroidImportance.HIGH,
          sound: 'alarm',
          vibration: true,
        });
      }
    };
    setupApp();

    const handleAppStateChange = async nextAppState => {
      // 앱으로 돌아오면 배너/배지 삭제
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        await notifee.cancelAllNotifications();
        await notifee.setBadgeCount(0);
      }
      appState.current = nextAppState;
    };
    const appStateListener = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );

    // 5. 메시지 수신 (3초 컷 + 무음 뚫기)
    const unsubscribe = messaging().onMessage(async remoteMessage => {
      const now = Date.now();
      const sentTime = remoteMessage.data?.timestamp
        ? Number(remoteMessage.data.timestamp)
        : now;
      const timeDiff = now - sentTime;

      console.log(`⏱️ 메시지 나이: ${timeDiff}ms`);

      // 🚨 [시간차 방어] 3초 지난 메시지는 무시
      if (timeDiff > 3000) {
        console.log('🗑️ 3초 지난 알림이라 버림 (앱 켜질 때 유령 알림 차단)');
        return;
      }

      console.log('⚡ 싱싱한 알림! 소리 재생 시작');

      // ✅ 무음 모드 뚫는 소리 재생
      Sound.setCategory('Alarm');
      const alarm = new Sound('alarm.mp3', Sound.MAIN_BUNDLE, error => {
        if (!error) {
          alarm.setVolume(1.0);
          alarm.play();
          setTimeout(() => {
            alarm.stop(() => alarm.release());
          }, 4000);
        }
      });

      // 진동
      Vibration.vibrate([0, 500, 200, 500]);

      // 팝업
      Alert.alert(
        remoteMessage.data?.title ?? '🚨 긴급',
        remoteMessage.data?.body ?? '확인하세요',
        [{ text: '확인', onPress: () => Vibration.cancel() }],
      );
    });

    return () => {
      unsubscribe();
      appStateListener.remove();
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <WebView
        source={{ uri: WEB_URL }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        // ✅ [중요] 웹에서 보내는 메시지를 여기서 받습니다!
        onMessage={handleWebMessage}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  webview: { flex: 1 },
});
export default App;
