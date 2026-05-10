import React from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { MedLibColors } from "@/hooks/useColors";

type Props = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  colors: MedLibColors;
};

export default function TimeInput({ label, value, onChange, colors }: Props) {
  const s = makeStyles(colors);
  return (
    <View style={s.container}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="HH:MM"
        placeholderTextColor={colors.mutedForeground}
        style={s.input}
      />
    </View>
  );
}

function makeStyles(colors: MedLibColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    label: {
      fontSize: 11,
      color: colors.mutedForeground,
      marginBottom: 4,
      fontFamily: "Inter_500Medium",
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 8,
      color: colors.foreground,
      fontFamily: "Inter_500Medium",
      backgroundColor: colors.background,
    },
  });
}
