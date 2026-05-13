import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import PagePreviewModal from "@/components/PagePreviewModal";
import { useColors } from "@/hooks/useColors";

interface Props {
  fileId: string;
  fileName: string;
  pageNum: number | null;
}

export default function CitationChip({ fileId, fileName, pageNum }: Props) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const label =
    pageNum !== null && pageNum > 0
      ? `${fileName} · sayfa ${pageNum}`
      : fileName;
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={6}
        style={({ pressed }) => [
          styles.chip,
          {
            backgroundColor: colors.primary + "14",
            borderColor: colors.primary + "40",
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Feather name="file-text" size={12} color={colors.primary} />
        <Text
          style={[styles.chipText, { color: colors.primary }]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Pressable>
      <PagePreviewModal
        visible={open}
        onClose={() => setOpen(false)}
        fileId={fileId}
        fileName={fileName}
        pageNum={pageNum}
      />
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 6,
    marginRight: 6,
    alignSelf: "flex-start",
    maxWidth: "100%",
  },
  chipText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    flexShrink: 1,
    maxWidth: 220,
  },
});
