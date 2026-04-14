/**
 * SignaturePad — Componente de assinatura digital
 *
 * Usa PanResponder + react-native-svg para capturar traços de toque.
 * Converte os traços em SVG path e exporta como string SVG base64.
 *
 * Props:
 *   onSave(svgDataUrl: string) — chamado quando o usuário confirma a assinatura
 *   onClear()                 — chamado quando o usuário limpa
 *   width / height            — dimensões do canvas (default: 300 x 160)
 */
import React, { useRef, useState } from "react";
import {
  View,
  PanResponder,
  StyleSheet,
  TouchableOpacity,
  Text,
  type LayoutChangeEvent,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { useColors } from "@/hooks/use-colors";

type Point = { x: number; y: number };
type Stroke = Point[];

interface SignaturePadProps {
  onSave: (svgDataUrl: string) => void;
  onClear?: () => void;
  height?: number;
}

export function SignaturePad({ onSave, onClear, height = 180 }: SignaturePadProps) {
  const colors = useColors();
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke>([]);
  const [width, setWidth] = useState(300);
  const viewRef = useRef<View>(null);
  const offsetRef = useRef({ x: 0, y: 0 });

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width: w } = e.nativeEvent.layout;
    setWidth(w);
    viewRef.current?.measure((_fx, _fy, _w, _h, px, py) => {
      offsetRef.current = { x: px, y: py };
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentStroke([{ x: locationX, y: locationY }]);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentStroke((prev) => [...prev, { x: locationX, y: locationY }]);
      },
      onPanResponderRelease: () => {
        setStrokes((prev) => {
          const updated = [...prev, currentStroke];
          return updated;
        });
        setCurrentStroke([]);
      },
    })
  ).current;

  const strokeToPath = (stroke: Stroke): string => {
    if (stroke.length === 0) return "";
    if (stroke.length === 1) {
      const { x, y } = stroke[0];
      return `M ${x} ${y} L ${x + 0.1} ${y + 0.1}`;
    }
    let d = `M ${stroke[0].x.toFixed(1)} ${stroke[0].y.toFixed(1)}`;
    for (let i = 1; i < stroke.length; i++) {
      d += ` L ${stroke[i].x.toFixed(1)} ${stroke[i].y.toFixed(1)}`;
    }
    return d;
  };

  const handleClear = () => {
    setStrokes([]);
    setCurrentStroke([]);
    onClear?.();
  };

  const handleSave = () => {
    const allStrokes = [...strokes];
    if (currentStroke.length > 0) allStrokes.push(currentStroke);
    if (allStrokes.length === 0) return;

    // Gerar SVG como string
    const paths = allStrokes
      .map((s) => strokeToPath(s))
      .filter(Boolean)
      .map((d) => `<path d="${d}" stroke="#1a1a1a" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`)
      .join("\n");

    const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="background:white">\n${paths}\n</svg>`;
    const base64 = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgString)))}`;
    onSave(base64);
  };

  const isEmpty = strokes.length === 0 && currentStroke.length === 0;

  return (
    <View style={styles.container}>
      {/* Canvas de assinatura */}
      <View
        ref={viewRef}
        onLayout={handleLayout}
        style={[
          styles.canvas,
          {
            height,
            borderColor: colors.border,
            backgroundColor: "#ffffff",
          },
        ]}
        {...panResponder.panHandlers}
      >
        <Svg width={width} height={height}>
          {/* Traços finalizados */}
          {strokes.map((stroke, i) => (
            <Path
              key={i}
              d={strokeToPath(stroke)}
              stroke="#1a1a1a"
              strokeWidth={2.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {/* Traço atual */}
          {currentStroke.length > 0 && (
            <Path
              d={strokeToPath(currentStroke)}
              stroke="#1a1a1a"
              strokeWidth={2.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </Svg>
        {/* Placeholder */}
        {isEmpty && (
          <View style={styles.placeholder} pointerEvents="none">
            <Text style={styles.placeholderText}>Assine aqui</Text>
          </View>
        )}
        {/* Linha de base */}
        <View style={[styles.baseLine, { borderTopColor: colors.border }]} pointerEvents="none" />
      </View>

      {/* Botões */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionBtn, { borderColor: colors.border }]}
          onPress={handleClear}
          activeOpacity={0.7}
        >
          <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600" }}>Limpar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.actionBtn,
            {
              backgroundColor: isEmpty ? colors.border : "#22C55E",
              borderColor: isEmpty ? colors.border : "#22C55E",
            },
          ]}
          onPress={handleSave}
          disabled={isEmpty}
          activeOpacity={0.8}
        >
          <Text style={{ color: isEmpty ? colors.muted : "#fff", fontSize: 14, fontWeight: "700" }}>
            Confirmar Assinatura
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    gap: 10,
  },
  canvas: {
    width: "100%",
    borderWidth: 1.5,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  placeholder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: {
    color: "#c0c0c0",
    fontSize: 16,
    fontStyle: "italic",
  },
  baseLine: {
    position: "absolute",
    bottom: 40,
    left: 20,
    right: 20,
    borderTopWidth: 1,
    borderStyle: "dashed",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
  },
});
