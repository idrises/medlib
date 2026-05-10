import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import React, { useEffect, useRef } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { BiometricLockGate } from "@/components/BiometricLockGate";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { FloatingAIButton } from "@/components/FloatingAIButton";
import { AppProvider } from "@/contexts/AppContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { SourceListProvider } from "@/contexts/SourceListContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const handledColdStartRef = useRef(false);

  useEffect(() => {
    if (isLoading) return;
    const inLogin = segments[0] === "login";
    if (!user && !inLogin) {
      router.replace("/login" as never);
    } else if (user && inLogin) {
      router.replace("/(tabs)/" as never);
    }
  }, [user, isLoading, segments]);

  useEffect(() => {
    if (!user) return;

    const navigateForData = (data: any) => {
      if (!data) return;
      if (data.type === "dm" && data.conversationId) {
        router.push(`/conversation/${data.conversationId}` as never);
      }
    };

    if (!handledColdStartRef.current) {
      handledColdStartRef.current = true;
      Notifications.getLastNotificationResponseAsync().then((resp) => {
        if (resp?.notification?.request?.content?.data) {
          navigateForData(resp.notification.request.content.data);
        }
      }).catch(() => {});
    }

    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      navigateForData(resp.notification?.request?.content?.data);
    });

    return () => sub.remove();
  }, [user]);

  if (isLoading) return null;

  const inAiChat = segments[0] === "ai-chat" || segments[0] === "ai-realtime";
  const showFab = !!user && !!user.aiAccess && !inAiChat;

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="journals/[journalId]" options={{ headerShown: false }} />
        <Stack.Screen name="journals/[journalId]/issues/[issueId]" options={{ headerShown: false }} />
        <Stack.Screen name="articles/[articleId]" options={{ headerShown: false }} />
        <Stack.Screen name="books/[bookId]" options={{ headerShown: false }} />
        <Stack.Screen name="chapters/[chapterId]" options={{ headerShown: false }} />
        <Stack.Screen name="videos/[videoId]" options={{ headerShown: false }} />
        <Stack.Screen name="videosets/[videoSetId]" options={{ headerShown: false }} />
        <Stack.Screen name="bookvideos/[bookId]" options={{ headerShown: false }} />
        <Stack.Screen name="messages" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="conversation/[conversationId]" options={{ headerShown: false }} />
        <Stack.Screen name="ai-chat/index" options={{ headerShown: false }} />
        <Stack.Screen name="ai-chat/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="ai-realtime" options={{ headerShown: false }} />
      </Stack>
      {showFab && <FloatingAIButton />}
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <SettingsProvider>
            <AuthProvider>
              <AppProvider>
                <SourceListProvider>
                  <GestureHandlerRootView>
                    <KeyboardProvider>
                      <BiometricLockGate>
                        <RootLayoutNav />
                      </BiometricLockGate>
                    </KeyboardProvider>
                  </GestureHandlerRootView>
                </SourceListProvider>
              </AppProvider>
            </AuthProvider>
          </SettingsProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
