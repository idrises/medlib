import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import { Dimensions, FlatList, Image, NativeScrollEvent, NativeSyntheticEvent, Pressable, Text, View } from "react-native";

const SCREEN_W = Dimensions.get("window").width;
const ITEM_W = Math.round(SCREEN_W * 0.6);
const ITEM_H = Math.round(ITEM_W * 1.05);
const GAP = 12;
const SIDE_PAD = (SCREEN_W - ITEM_W) / 2;
const SNAP = ITEM_W + GAP;

import { useSourceList } from "@/contexts/SourceListContext";

type Variant = "dark" | "light";

export function SourceCarousel({
  currentId,
  variant = "light",
  onChange,
}: {
  currentId: string;
  variant?: Variant;
  onChange?: (item: { id: string; type: "video" | "article"; kind?: "book" | "entry" }) => void;
}) {
  const router = useRouter();
  const { items, label } = useSourceList();
  const listRef = useRef<FlatList<any>>(null);
  const lastNavId = useRef<string>(currentId);

  const accent = "#F59E0B";
  const fg = variant === "dark" ? "#FFFFFF" : "#0F172A";
  const muted = variant === "dark" ? "rgba(255,255,255,0.55)" : "#64748B";
  const cardBg = variant === "dark" ? "#1F2937" : "#E5E7EB";

  useEffect(() => {
    lastNavId.current = currentId;
    if (!items.length) return;
    const idx = items.findIndex((i) => i.id === currentId);
    if (idx >= 0) {
      const t = setTimeout(() => {
        listRef.current?.scrollToOffset({ offset: idx * SNAP, animated: false });
      }, 50);
      return () => clearTimeout(t);
    }
    return;
  }, [items, currentId]);

  if (!items.length) return null;

  const navigateTo = (item: typeof items[number]) => {
    if (item.id === lastNavId.current) return;
    lastNavId.current = item.id;
    if (onChange) {
      onChange({ id: item.id, type: item.type, kind: item.kind });
      return;
    }
    if (item.type === "video") {
      const qs = item.kind === "entry" ? "?kind=entry" : "";
      router.replace(`/videos/${item.id}${qs}` as never);
    } else {
      router.replace(`/articles/${item.id}` as never);
    }
  };

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / SNAP);
    const clamped = Math.max(0, Math.min(items.length - 1, idx));
    const item = items[clamped];
    if (item) navigateTo(item);
  };

  return (
    <View style={{ marginTop: 18, marginBottom: 8 }}>
      <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
        <Text style={{ fontSize: 17, fontFamily: "Inter_700Bold", color: fg }}>
          More from this source
        </Text>
        {label ? (
          <Text
            numberOfLines={2}
            style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: muted, marginTop: 4 }}
          >
            {label}
          </Text>
        ) : null}
      </View>

      <FlatList
        ref={listRef}
        horizontal
        data={items}
        keyExtractor={(i) => `${i.type}:${i.id}`}
        contentContainerStyle={{ paddingHorizontal: SIDE_PAD }}
        showsHorizontalScrollIndicator={false}
        snapToInterval={SNAP}
        snapToAlignment="start"
        decelerationRate="fast"
        getItemLayout={(_, index) => ({ length: SNAP, offset: SNAP * index, index })}
        onScrollToIndexFailed={({ index }) => {
          setTimeout(() => listRef.current?.scrollToOffset({ offset: index * SNAP, animated: false }), 50);
        }}
        onMomentumScrollEnd={onMomentumEnd}
        renderItem={({ item }) => {
          const isCurrent = item.id === currentId;
          return (
            <Pressable
              onPress={() => {
                const idx = items.findIndex((x) => x.id === item.id);
                if (idx >= 0) listRef.current?.scrollToOffset({ offset: idx * SNAP, animated: true });
                navigateTo(item);
              }}
              style={({ pressed }) => ({
                width: ITEM_W,
                marginRight: GAP,
                opacity: pressed ? 0.85 : isCurrent ? 1 : 0.6,
                transform: [{ scale: isCurrent ? 1 : 0.92 }],
              })}
            >
              <View
                style={{
                  width: ITEM_W,
                  height: ITEM_H,
                  borderRadius: 14,
                  backgroundColor: cardBg,
                  overflow: "hidden",
                  borderWidth: isCurrent ? 2 : 0,
                  borderColor: accent,
                }}
              >
                {item.thumbUrl ? (
                  <Image source={{ uri: item.thumbUrl }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                ) : (
                  <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <Feather
                      name={item.type === "article" ? "file-text" : "play-circle"}
                      size={42}
                      color={muted}
                    />
                  </View>
                )}
                <View
                  style={{
                    position: "absolute",
                    left: 0, right: 0, bottom: 0,
                    paddingHorizontal: 12,
                    paddingTop: 22,
                    paddingBottom: 12,
                    backgroundColor: "rgba(0,0,0,0.55)",
                  }}
                >
                  <Text
                    numberOfLines={2}
                    style={{
                      fontSize: 13,
                      fontFamily: "Inter_700Bold",
                      color: "#FFFFFF",
                      lineHeight: 17,
                    }}
                  >
                    {item.title}
                  </Text>
                  {item.subtitle ? (
                    <Text
                      numberOfLines={2}
                      style={{
                        fontSize: 11,
                        fontFamily: "Inter_400Regular",
                        color: "rgba(255,255,255,0.75)",
                        marginTop: 2,
                        lineHeight: 14,
                      }}
                    >
                      {item.subtitle}
                    </Text>
                  ) : null}
                </View>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
