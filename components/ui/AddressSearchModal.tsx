import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { Colors, Spacing } from '@/constants/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (address: string) => void;
}

// 다음(카카오) 우편번호 서비스 — API 키 없이 쓸 수 있는 무료 주소 검색 위젯.
// https://postcode.map.daum.net
const POSTCODE_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    html, body, #wrap { margin: 0; padding: 0; width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="wrap"></div>
  <script>
    window.onerror = function (message, source, lineno, colno, error) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: 'onerror: ' + message + ' @' + lineno + ':' + colno }));
    };
  </script>
  <script src="https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"></script>
  <script>
    try {
      if (typeof daum === 'undefined' || !daum.Postcode) {
        throw new Error('daum.Postcode 스크립트를 불러오지 못했어요.');
      }
      new daum.Postcode({
        oncomplete: function (data) {
          var address = data.roadAddress || data.jibunAddress || data.address;
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'addressSelected', address: address }));
        },
        width: '100%',
        height: '100%',
      }).embed(document.getElementById('wrap'));
    } catch (e) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: String(e && e.message ? e.message : e) }));
    }
  </script>
</body>
</html>
`;

// WebView의 source는 참조가 바뀌면 (내용이 같아도) 재로드된다.
// 인라인 객체 리터럴로 넘기면 부모가 리렌더될 때마다(키보드 표시 등) 매번 새 객체가 되어
// 타이핑 중에도 페이지가 새로고침되므로, 컴포넌트 바깥에 고정된 참조로 둔다.
const POSTCODE_SOURCE = { html: POSTCODE_HTML, baseUrl: 'https://t1.daumcdn.net/' };

export default function AddressSearchModal({ visible, onClose, onSelect }: Props) {
  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'addressSelected' && data.address) {
        onSelect(data.address);
      } else if (data.type === 'error') {
        console.error('[AddressSearchModal]', data.message);
      }
    } catch (_) {}
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={s.safeArea}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={s.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>주소 검색</Text>
        </View>
        <WebView
          style={s.webview}
          source={POSTCODE_SOURCE}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          onMessage={handleMessage}
        />
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    gap: 12,
  },
  backArrow: { fontSize: 22, color: Colors.textBody1, lineHeight: 28 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.textBody1 },
  webview: { flex: 1 },
});
