import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import React from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/use-colors";

// WebView só existe no nativo — importado dinamicamente para evitar problemas no web
let WebView: any = null;
if (Platform.OS !== "web") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    WebView = require("react-native-webview").WebView;
  } catch {
    WebView = null;
  }
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
  const [loadError, setLoadError] = React.useState(false);
  const [useDirectUrl, setUseDirectUrl] = React.useState(false);
  const loadTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state when URL changes or modal opens
  React.useEffect(() => {
    if (visible) {
      setLoading(true);
      setLoadError(false);
      setUseDirectUrl(false);
    }
  }, [visible, url]);

  // Se WebView não está disponível no nativo, abre externamente
  React.useEffect(() => {
    if (visible && Platform.OS !== "web" && !WebView) {
      WebBrowser.openBrowserAsync(url).then(() => onClose());
    }
  }, [visible, url, onClose]);

  // Para web: tenta Google Docs Viewer primeiro; se falhar, tenta URL direta
  const viewerUrl = Platform.OS === "web"
    ? (useDirectUrl ? url : `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`)
    : `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;

  const handleLoadError = () => {
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    setLoading(false);
    if (!useDirectUrl) {
      setUseDirectUrl(true);
      setLoading(true);
      setLoadError(false);
    } else {
      setLoadError(true);
    }
  };

  // Timeout para detectar falha silenciosa do Google Docs Viewer
  React.useEffect(() => {
    if (visible && loading && !useDirectUrl) {
      loadTimeoutRef.current = setTimeout(() => {
        setUseDirectUrl(true);
        setLoading(true);
      }, 10000);
    }
    return () => {
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    };
  }, [visible, loading, useDirectUrl]);

  // Se WebView não disponível no nativo, não renderiza modal (já abriu externamente)
  if (Platform.OS !== "web" && !WebView) {
    return null;
  }

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
          <TouchableOpacity
            onPress={() => {
              if (Platform.OS !== "web") {
                WebBrowser.openBrowserAsync(url);
              } else {
                Linking.openURL(url);
              }
            }}
            style={styles.openButton}
          >
            <Text style={[styles.openText, { color: colors.primary }]}>↗ Abrir</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
            {title}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={[styles.closeText, { color: colors.primary }]}>Fechar</Text>
          </TouchableOpacity>
        </View>

        {/* Conteúdo */}
        <View style={styles.content}>
          {loading && !loadError && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.muted }]}>Carregando PDF...</Text>
            </View>
          )}

          {loadError ? (
            // Fallback: botão para abrir externamente
            <View style={styles.errorContainer}>
              <Text style={{ fontSize: 40, marginBottom: 16 }}>📄</Text>
              <Text style={[styles.errorTitle, { color: colors.foreground }]}>
                Não foi possível exibir o PDF aqui
              </Text>
              <Text style={[styles.errorSubtitle, { color: colors.muted }]}>
                Toque no botão abaixo para abrir o arquivo no seu navegador ou aplicativo de PDF.
              </Text>
              <TouchableOpacity
                style={[styles.openExternalBtn, { backgroundColor: colors.primary }]}
                onPress={() => {
                  if (Platform.OS !== "web") {
                    WebBrowser.openBrowserAsync(url);
                  } else {
                    Linking.openURL(url);
                  }
                }}
              >
                <Text style={styles.openExternalText}>↗ Abrir PDF externamente</Text>
              </TouchableOpacity>
            </View>
          ) : Platform.OS === "web" ? (
            // Web: iframe (Google Docs Viewer ou URL direta)
            <iframe
              key={viewerUrl}
              src={viewerUrl}
              style={{ width: "100%", height: "100%", border: "none" }}
              onLoad={() => {
                if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
                setLoading(false);
              }}
              onError={handleLoadError}
              title={title}
            />
          ) : (
            // Nativo: WebView com Google Docs Viewer
            <WebView
              source={{ uri: viewerUrl }}
              style={styles.webview}
              onLoad={() => setLoading(false)}
              onError={handleLoadError}
              startInLoadingState={false}
              scalesPageToFit
              javaScriptEnabled
              domStorageEnabled
              allowsInlineMediaPlayback
            />
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
  openButton: {
    width: 60,
    alignItems: "flex-start",
  },
  openText: {
    fontSize: 14,
    fontWeight: "600",
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
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    gap: 12,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  errorSubtitle: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },
  openExternalBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  openExternalText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
});
