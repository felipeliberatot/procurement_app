/**
 * SignaturePad — Componente de assinatura digital cross-platform
 *
 * Web: usa <canvas> HTML nativo com eventos de mouse/touch.
 * Mobile: usa PanResponder + react-native-svg.
 *
 * Props:
 *   onSave(svgDataUrl: string) — chamado quando o usuário confirma a assinatura
 *   onClear()                 — chamado quando o usuário limpa
 *   height                    — altura do canvas (default: 180)
 */
import React, { useRef, useState, useCallback, useEffect } from "react";
import {
  View,
  PanResponder,
  StyleSheet,
  TouchableOpacity,
  Text,
  Platform,
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

// ─── Implementação Web (canvas HTML) ─────────────────────────────────────────
function SignaturePadWeb({ onSave, onClear, height = 180 }: SignaturePadProps) {
  const colors = useColors();
  const canvasRef = useRef<any>(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  const getPos = (e: any, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    if (e.touches) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  useEffect(() => {
    const canvas = canvasRef.current as HTMLCanvasElement | null;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Configurar canvas
    canvas.width = canvas.offsetWidth;
    canvas.height = height;
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const startDraw = (e: any) => {
      e.preventDefault();
      isDrawingRef.current = true;
      const pos = getPos(e, canvas);
      lastPosRef.current = pos;
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      setIsEmpty(false);
    };

    const draw = (e: any) => {
      e.preventDefault();
      if (!isDrawingRef.current) return;
      const pos = getPos(e, canvas);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      lastPosRef.current = pos;
    };

    const endDraw = (e: any) => {
      e.preventDefault();
      isDrawingRef.current = false;
      lastPosRef.current = null;
    };

    canvas.addEventListener("mousedown", startDraw);
    canvas.addEventListener("mousemove", draw);
    canvas.addEventListener("mouseup", endDraw);
    canvas.addEventListener("mouseleave", endDraw);
    canvas.addEventListener("touchstart", startDraw, { passive: false });
    canvas.addEventListener("touchmove", draw, { passive: false });
    canvas.addEventListener("touchend", endDraw);

    return () => {
      canvas.removeEventListener("mousedown", startDraw);
      canvas.removeEventListener("mousemove", draw);
      canvas.removeEventListener("mouseup", endDraw);
      canvas.removeEventListener("mouseleave", endDraw);
      canvas.removeEventListener("touchstart", startDraw);
      canvas.removeEventListener("touchmove", draw);
      canvas.removeEventListener("touchend", endDraw);
    };
  }, [height]);

  const handleClear = () => {
    const canvas = canvasRef.current as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
    onClear?.();
  };

  const handleSave = () => {
    const canvas = canvasRef.current as HTMLCanvasElement | null;
    if (!canvas || isEmpty) return;
    const dataUrl = canvas.toDataURL("image/png");
    onSave(dataUrl);
  };

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.canvas,
          { height, borderColor: colors.border, backgroundColor: "#ffffff" },
        ]}
      >
        {/* @ts-ignore — canvas é elemento HTML nativo, válido na web */}
        <canvas
          ref={canvasRef}
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            touchAction: "none",
            cursor: "crosshair",
          }}
        />
        {isEmpty && (
          <View style={styles.placeholder} pointerEvents="none">
            <Text style={styles.placeholderText}>Assine aqui</Text>
          </View>
        )}
        <View style={[styles.baseLine, { borderTopColor: colors.border }]} pointerEvents="none" />
      </View>
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

// ─── Implementação Mobile (PanResponder + SVG) ────────────────────────────────
function SignaturePadNative({ onSave, onClear, height = 180 }: SignaturePadProps) {
  const colors = useColors();
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const strokesRef = useRef<Stroke[]>([]);
  const currentStrokeRef = useRef<Stroke>([]);
  const [renderKey, setRenderKey] = useState(0); // força re-render
  const [width, setWidth] = useState(300);

  const handleLayout = (e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        currentStrokeRef.current = [{ x: locationX, y: locationY }];
        setRenderKey((k) => k + 1);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        currentStrokeRef.current = [...currentStrokeRef.current, { x: locationX, y: locationY }];
        setRenderKey((k) => k + 1);
      },
      onPanResponderRelease: () => {
        if (currentStrokeRef.current.length > 0) {
          strokesRef.current = [...strokesRef.current, currentStrokeRef.current];
          setStrokes([...strokesRef.current]);
        }
        currentStrokeRef.current = [];
        setRenderKey((k) => k + 1);
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
    strokesRef.current = [];
    currentStrokeRef.current = [];
    setStrokes([]);
    setRenderKey((k) => k + 1);
    onClear?.();
  };

  const handleSave = () => {
    const allStrokes = [...strokesRef.current];
    if (currentStrokeRef.current.length > 0) allStrokes.push(currentStrokeRef.current);
    if (allStrokes.length === 0) return;

    const paths = allStrokes
      .map((s) => strokeToPath(s))
      .filter(Boolean)
      .map((d) => `<path d="${d}" stroke="#1a1a1a" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`)
      .join("\n");

    const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="background:white">\n${paths}\n</svg>`;
    const base64 = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgString)))}`;
    onSave(base64);
  };

  const allStrokes = [...strokes];
  const currentStroke = currentStrokeRef.current;
  const isEmpty = allStrokes.length === 0 && currentStroke.length === 0;

  return (
    <View style={styles.container}>
      <View
        onLayout={handleLayout}
        style={[styles.canvas, { height, borderColor: colors.border, backgroundColor: "#ffffff" }]}
        {...panResponder.panHandlers}
      >
        <Svg width={width} height={height} key={renderKey}>
          {allStrokes.map((stroke, i) => (
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
        {isEmpty && (
          <View style={styles.placeholder} pointerEvents="none">
            <Text style={styles.placeholderText}>Assine aqui</Text>
          </View>
        )}
        <View style={[styles.baseLine, { borderTopColor: colors.border }]} pointerEvents="none" />
      </View>
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

// ─── Export: escolhe implementação por plataforma ─────────────────────────────
export function SignaturePad(props: SignaturePadProps) {
  if (Platform.OS === "web") {
    return <SignaturePadWeb {...props} />;
  }
  return <SignaturePadNative {...props} />;
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
