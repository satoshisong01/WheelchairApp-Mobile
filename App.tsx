// WheelchairApp/App.tsx

import React, { useRef, useEffect, useState } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Vibration,
  Alert,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';
import Sound from 'react-native-sound'; // 🔊 추가된 라이브러리

const WEB_URL = 'https://wheelchair2-front.vercel.app/mobile-view';

const App = () => {
  const webViewRef = useRef(null);

  // 소리 객체를 상태로 관리 (꺼야 하니까)
  const [soundPlayer, setSoundPlayer] = useState<Sound | null>(null);

  useEffect(() => {
    // 0. 사운드 라이브러리 초기 설정
    // 'Playback': 미디어 볼륨 사용 (매너모드에서도 소리 남)
    // 'Alarm': 알람 볼륨 사용 (가장 강력함, 추천)
    Sound.setCategory('Alarm');

    // 1. 초기 설정
    const setupNotification = async () => {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled && Platform.OS === 'android') {
        // ⭐️ 중요: 소리는 이제 Sound 라이브러리가 담당하므로, 채널에서는 소리를 뺍니다.
        // (안 그러면 소리가 두 번 겹치거나 벨소리 볼륨을 따라감)
        await notifee.createChannel({
          id: 'emergency-silent', // ID 변경 (소리 없는 채널)
          name: '긴급 알림 (화면용)',
          importance: AndroidImportance.HIGH,
          sound: undefined, // 🔇 채널 자체 소리는 끔
          vibration: true,
        });
        console.log('✅ 알림 채널 생성 완료: emergency-silent');
      }
    };

    setupNotification();

    // 2. 메시지 수신 처리
    const unsubscribe = messaging().onMessage(async remoteMessage => {
      console.log('🚨 긴급 메시지 도착!', remoteMessage);

      // (1) 🔊 소리 직접 재생 (미디어/알람 볼륨 사용)
      // alarm.mp3 파일은 android/app/src/main/res/raw/ 에 있어야 함
      const alarm = new Sound('alarm.mp3', Sound.MAIN_BUNDLE, error => {
        if (error) {
          console.log('소리 로딩 실패', error);
          return;
        }
        // 무한 반복 설정 (-1)
        alarm.setNumberOfLoops(-1);
        // 재생 시작
        alarm.play(success => {
          if (!success) console.log('재생 실패');
        });
      });

      // 나중에 끄기 위해 state에 저장
      setSoundPlayer(alarm);

      // (2) 진동 무한 시작
      Vibration.vibrate([0, 1000, 500, 1000, 500], true);

      // (3) 상단 알림 배너 띄우기 (소리 없이 화면만)
      await notifee.displayNotification({
        title: remoteMessage.notification?.title || '🚨 긴급 알림',
        body: remoteMessage.notification?.body || '위험이 감지되었습니다!',
        android: {
          channelId: 'emergency-silent', // 소리 없는 채널 사용
          smallIcon: 'ic_launcher',
          pressAction: { id: 'default' },
        },
      });

      // (4) 팝업 띄우기
      Alert.alert(
        remoteMessage.notification?.title || '🚨 긴급 상황',
        remoteMessage.notification?.body || '확인 버튼을 눌러 알림을 끄세요.',
        [
          {
            text: '확인 (알림 끄기)',
            onPress: async () => {
              // 1. 진동 끄기
              Vibration.cancel();

              // 2. 알림 배너 삭제
              await notifee.cancelAllNotifications();

              // 3. 🔊 소리 끄기 (핵심!)
              if (alarm) {
                alarm.stop(() => {
                  alarm.release(); // 메모리 해제
                });
              }
              setSoundPlayer(null); // 상태 초기화

              console.log('🔕 모든 알림 종료');
            },
            style: 'destructive',
          },
        ],
        { cancelable: false },
      );
    });

    return unsubscribe;
  }, []);

  // 웹뷰 통신 (기존 유지)
  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'VIBRATE') Vibration.vibrate(500);
      if (data.type === 'ALERT') Alert.alert('알림', data.message);
    } catch (error) {}
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <WebView
        ref={webViewRef}
        source={{ uri: WEB_URL }}
        style={styles.webview}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  webview: { flex: 1 },
});

export default App;
