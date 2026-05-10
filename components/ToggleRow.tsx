import React from "react";
import {
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import { MedLibColors } from "@/hooks/useColors";

type Props = {
  label: string;
  subtitle?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  colors: MedLibColors;
  last?: boolean;
  disabled?: boolean;
};

export default function ToggleRow({
  label,
  subtitle,
  value,
  onChange,
  colors,
  last,
  disabled,
}: Props) {
  const s = makeStyles(colors);
  return (
    <View
      style={[
        s.container,
        last && { borderBottomWidth: 0 },
        disabled && { opacity: 0.45 },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={s.label}>{label}</Text>
        {subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor="#FFF"
        disabled={disabled}
      />
    </View>
  );
}

function makeStyles(colors: MedLibColors) {
  return StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    label: {
      fontSize: 15,
      fontFamily: "Inter_500Medium",
      color: colors.foreground,
    },
    subtitle: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      marginTop: 2,
    },
  });
}
