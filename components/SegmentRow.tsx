import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { MedLibColors } from "@/hooks/useColors";

type Option<T extends string> = { k: T; l: string };

type Props<T extends string> = {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  colors: MedLibColors;
};

export default function SegmentRow<T extends string>({
  label,
  options,
  value,
  onChange,
  colors,
}: Props<T>) {
  const s = makeStyles(colors);
  return (
    <View style={s.container}>
      <Text style={s.label}>{label}</Text>
      <View style={s.segmentWrap}>
        {options.map((o) => {
          const active = value === o.k;
          return (
            <Pressable
              key={o.k}
              onPress={() => onChange(o.k)}
              style={[s.segmentBtn, active && { backgroundColor: colors.primary }]}
            >
              <Text style={[s.segmentText, active && s.segmentTextActive]}>{o.l}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function makeStyles(colors: MedLibColors) {
  return StyleSheet.create({
    container: {
      flexDirection: "column",
      alignItems: "stretch",
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      gap: 10,
    },
    label: {
      fontSize: 15,
      color: colors.foreground,
      fontFamily: "Inter_500Medium",
    },
    segmentWrap: {
      flexDirection: "row",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      overflow: "hidden",
    },
    segmentBtn: {
      flex: 1,
      paddingVertical: 9,
      alignItems: "center",
      backgroundColor: colors.background,
    },
    segmentText: {
      fontSize: 12,
      color: colors.foreground,
      fontFamily: "Inter_500Medium",
    },
    segmentTextActive: {
      color: "#FFF",
      fontFamily: "Inter_600SemiBold",
    },
  });
}
