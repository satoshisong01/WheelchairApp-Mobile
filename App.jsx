import React, { useEffect, useRef, useState } from 'react';
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
  Linking,
  View,
  BackHandler,
} from 'react-native';
import { WebView } from 'react-native-webview';
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';
import Sound from 'react-native-sound';
import AsyncStorage from '@react-native-async-storage/async-storage';
import io from 'socket.io-client';

LogBox.ignoreLogs(['Firebase Messaging: This method is deprecated']);

// ==================================================================
// ⚙️ 환경 설정
// ==================================================================

// ⚠️ 서버 주소 (HTTPS 사용 시 도메인 권장, IP 사용 시 SSL 인증서 문제 주의)
const SOCKET_URL = 'https://broker.firstcorea.com:8080';

// 🌍 웹뷰 주소
const WEB_URL = 'https://wheelchair2-front.vercel.app/mobile-view';

// 📱 현재 앱 버전 (이 숫자가 서버보다 낮으면 업데이트 팝업이 뜸)
const APP_VERSION = '1.7.0';

// 🔐 로그인 유지 만료 시간 (ms) - 현재 3일
const LOGIN_EXPIRE_MS = 3 * 24 * 60 * 60 * 1000;

// ==================================================================

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

const App = () => {
  const appState = useRef(AppState.currentState);
  const [socket, setSocket] = useState(null);

  // 🌐 WebView 메시지 핸들러 (로그인/로그아웃)
  const handleWebMessage = async event => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      // 1️⃣ 로그인 성공 -> 알림 구독 + 로그인 시간 저장
      if (data.type === 'LOGIN_SUCCESS' && data.userId) {
        console.log(`📥 [WebView] 로그인 정보 수신: ${data.userId}`);

        const savedUserId = await AsyncStorage.getItem('USER_ID');

        if (savedUserId !== data.userId) {
          await messaging().subscribeToTopic(data.userId);
          await AsyncStorage.setItem('USER_ID', data.userId);
          await AsyncStorage.setItem('USER_LOGIN_AT', String(Date.now()));
        } else {
          console.log('🔄 이미 구독 중인 ID (팝업 생략)');
        }
      }
      // 2️⃣ 로그아웃 / 세션 만료 -> 구독 취소 + 로그인 정보 제거
      else if (data.type === 'LOGOUT' || data.type === 'SESSION_EXPIRED') {
        const savedUserId = await AsyncStorage.getItem('USER_ID');
        if (savedUserId) {
          console.log(
            `📤 [WebView] 로그아웃/세션만료: ${savedUserId} 구독 취소`,
          );
          await messaging().unsubscribeFromTopic(savedUserId);
          await AsyncStorage.removeItem('USER_ID');
          await AsyncStorage.removeItem('USER_LOGIN_AT');
        }
      } else if (data.type === 'ALERT') {
        Alert.alert(data.title, data.message);
      }
    } catch (e) {
      console.log('메시지 처리 중 에러:', e);
    }
  };

  // 🔌 소켓 연결 & 버전 체크 (업데이트 안내)
  useEffect(() => {
    // 소켓 옵션: 연결 실패 시 재시도 허용, HTTPS 연결 시 보안 경고 무시(개발용)
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket'],
      secure: true,
      rejectUnauthorized: false, // IP로 HTTPS 접속 시 인증서 에러 방지
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('✅ [Socket] 서버 연결됨');
      // 내 버전을 서버에 신고
      newSocket.emit('check_version', APP_VERSION);
    });

    // 🚀 서버에서 "업데이트 하세요" 신호가 오면?
    newSocket.on('force_update', data => {
      console.log('📲 업데이트 요청 받음:', data);
      Alert.alert(
        '업데이트 알림',
        `새로운 버전(${data.latestVersion})이 출시되었습니다.\n원활한 사용을 위해 업데이트해주세요.`,
        [
          {
            text: data.mustUpdate ? '업데이트 (필수)' : '업데이트',
            onPress: () => Linking.openURL(data.url), // 🔗 브라우저 열기 (다운로드)
          },
          // 필수 업데이트가 아니면 '나중에' 버튼 표시
          !data.mustUpdate && { text: '나중에', style: 'cancel' },
        ].filter(Boolean),
        { cancelable: !data.mustUpdate },
      );
    });

    return () => newSocket.disconnect();
  }, []);

  // 🔔 푸시 알림 설정 및 수신
  useEffect(() => {
    const setupApp = async () => {
      await notifee.cancelAllNotifications();
      await notifee.setBadgeCount(0);

      if (Platform.OS === 'android' && Platform.Version >= 33) {
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );
      }
      await messaging().requestPermission();

      // 자동 로그인 처리 (앱 껐다 켜도 구독 유지) - 단, 만료 시간 내에서만
      const savedUserId = await AsyncStorage.getItem('USER_ID');
      const loginAtStr = await AsyncStorage.getItem('USER_LOGIN_AT');

      if (savedUserId && loginAtStr) {
        const loginAt = Number(loginAtStr);
        const now = Date.now();

        if (!Number.isNaN(loginAt) && now - loginAt <= LOGIN_EXPIRE_MS) {
          console.log(`💾 기존 로그인 정보 발견: ${savedUserId} (재구독)`);
          await messaging().subscribeToTopic(savedUserId);
        } else {
          // 만료된 로그인 정보는 정리
          console.log(
            `⌛ 로그인 만료 처리: ${savedUserId} (자동 재구독 안 함)`,
          );
          await AsyncStorage.removeItem('USER_ID');
          await AsyncStorage.removeItem('USER_LOGIN_AT');
        }
      }
    };
    setupApp();

    const appResumedAtRef = { current: 0 };
    const handleAppStateChange = async nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        appResumedAtRef.current = Date.now();
        await notifee.cancelAllNotifications();
        await notifee.setBadgeCount(0);
      }
      appState.current = nextAppState;
    };
    const appStateListener = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );

    // ✅ 포그라운드 알림 수신
    const unsubscribe = messaging().onMessage(async remoteMessage => {
      const messageId =
        remoteMessage.messageId || remoteMessage.data?.notificationId;
      if (!messageId) return;

      const alreadyProcessed = await isAlreadyProcessed(messageId);
      if (alreadyProcessed) return;

      // 앱 복귀 직후 3초간 알림 무시 (백그라운드에서 이미 처리된 알림 중복 방지)
      if (Date.now() - appResumedAtRef.current < 3000) {
        console.log('⏳ 앱 복귀 직후 알림 무시:', messageId);
        await markAsProcessed(messageId);
        return;
      }

      console.log(`✅ [Foreground] 알림 수신: ${remoteMessage.data?.title}`);

      // 소리 & 진동 & 팝업 — 모두 동시에 확실히 실행
      const soundMap = { ding: 'ding.mp3', chair: 'chair.mp3' };
      const soundFile = soundMap[remoteMessage.data?.sound] || 'alarm.mp3';
      const isComplete = remoteMessage.data?.sound === 'ding';
      const title = remoteMessage.data?.title ?? '🚨 긴급';
      const body = remoteMessage.data?.body ?? '확인하세요';

      // 1. 진동 즉시 실행
      Vibration.vibrate(isComplete ? [0, 300] : [0, 500, 200, 500]);

      // 2. 팝업 즉시 실행
      Alert.alert(title, body, [
        { text: '확인', onPress: () => Vibration.cancel() },
      ]);

      // 3. 소리 재생 (로딩 실패해도 팝업/진동은 이미 실행됨)
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
            console.warn('🔊 소리 로딩 실패:', error);
          }
        });
      } catch (e) {
        console.warn('🔊 Sound 초기화 실패:', e);
      }
      await markAsProcessed(messageId);
    });

    return () => {
      unsubscribe();
      appStateListener.remove();
    };
  }, []);

  const webViewRef = useRef(null);
  const canGoBackRef = useRef(false);

  // 안드로이드 뒤로가기 버튼 → WebView 내 뒤로가기
  useEffect(() => {
    const onBackPress = () => {
      if (canGoBackRef.current && webViewRef.current) {
        webViewRef.current.goBack();
        return true; // 기본 동작(앱 종료) 방지
      }
      return false; // 더 뒤로갈 곳 없으면 앱 종료
    };
    BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <WebView
        ref={webViewRef}
        source={{ uri: WEB_URL }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        onMessage={handleWebMessage}
        onNavigationStateChange={(navState) => {
          canGoBackRef.current = navState.canGoBack;
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  webview: { flex: 1 },
});

export default App;
