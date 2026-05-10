import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import { useColors } from "@/hooks/useColors";

interface PDFViewerModalProps {
  visible: boolean;
  url: string;
  title?: string;
  onClose: () => void;
}

export function PDFViewerModal({ visible, url, title, onClose }: PDFViewerModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handleClose = () => {
    setLoading(true);
    setError(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
          <Pressable onPress={handleClose} hitSlop={8} style={styles.closeBtn}>
            <Feather name="x" size={22} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
            {title || "PDF Document"}
          </Text>
          <View style={{ width: 38 }} />
        </View>

        <View style={styles.viewerContainer}>
          {loading && !error && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={{ color: colors.mutedForeground, marginTop: 12, fontFamily: "Inter_400Regular", fontSize: 14 }}>
                Loading document…
              </Text>
            </View>
          )}

          {error ? (
            <View style={styles.errorContainer}>
              <Feather name="alert-circle" size={44} color={colors.mutedForeground} />
              <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 16, marginTop: 12, textAlign: "center" }}>
                Could not load document
              </Text>
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, marginTop: 6, textAlign: "center" }}>
                The file may be unavailable or require authentication.
              </Text>
              <Pressable
                onPress={() => { setError(false); setLoading(true); }}
                style={[styles.retryBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={{ color: colors.primaryForeground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <WebView
              key={url}
              source={{ uri: url }}
              style={styles.webview}
              onLoadStart={() => { setLoading(true); setError(false); }}
              onLoadEnd={() => setLoading(false)}
              onError={() => { setLoading(false); setError(true); }}
              onHttpError={({ nativeEvent }) => {
                if (nativeEvent.statusCode >= 400) {
                  setLoading(false);
                  setError(true);
                }
              }}
              allowsInlineMediaPlayback
              javaScriptEnabled={false}
              scalesPageToFit={Platform.OS === "android"}
              bounces={false}
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
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    paddingHorizontal: 8,
  },
  viewerContainer: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F5F5",
    zIndex: 10,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  retryBtn: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
});
