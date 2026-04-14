import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useColors } from "@/hooks/use-colors";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// WebView só existe no nativo — no web usamos iframe
let WebView: any = null;
if (Platform.OS !== "web") {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  WebView = require("react-native-webview").WebView;
}

interface PdfViewerModalProps {
  visible: boolean;
  url: string;
  title?: string;
  onClose: () => void;
}

export function PdfViewerModal({ visible, url, title = "Visualizar PDF", onClose }: PdfViewerModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = React.useState(true);

  // Reset loading state when URL changes or modal opens
  React.useEffect(() => {
    if (visible) setLoading(true);
  }, [visible, url]);

  // Para web: usa Google Docs Viewer para renderizar o PDF no iframe
  const viewerUrl =
    Platform.OS === "web"
      ? `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`
      : url;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={{ width: 60 }} />
          <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
            {title}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={[styles.closeText, { color: colors.primary }]}>Fechar</Text>
          </TouchableOpacity>
        </View>

        {/* Conteúdo */}
        <View style={styles.content}>
          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.muted }]}>Carregando PDF...</Text>
            </View>
          )}

          {Platform.OS === "web" ? (
            // Web: iframe com Google Docs Viewer
            <iframe
              src={viewerUrl}
              style={{ width: "100%", height: "100%", border: "none" }}
              onLoad={() => setLoading(false)}
              title={title}
            />
          ) : (
            // Nativo: WebView
            WebView && (
              <WebView
                source={{ uri: viewerUrl }}
                style={styles.webview}
                onLoad={() => setLoading(false)}
                onError={() => setLoading(false)}
                startInLoadingState={false}
                scalesPageToFit
                javaScriptEnabled
                domStorageEnabled
              />
            )
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
    marginHorizontal: 8,
  },
  closeButton: {
    width: 60,
    alignItems: "flex-end",
  },
  closeText: {
    fontSize: 15,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    position: "relative",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    zIndex: 10,
  },
  loadingText: {
    fontSize: 14,
  },
  webview: {
    flex: 1,
  },
});
