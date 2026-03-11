import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Polygon } from 'react-native-svg';

type ToolId = 'attack' | 'pass' | 'rival' | 'zone';

type DrawingToolbarProps = {
  visible: boolean;
  activeToolId: ToolId;
  onSelectTool: (toolId: ToolId) => void;
  onUndo: () => void;
  onClear: () => void;
  undoDisabled: boolean;
  clearDisabled: boolean;
  boardWidth: number;
  boardHeight: number;
};

const TOOLBAR_WIDTH = 52;
const TOOL_BUTTON_SIZE = 30;
const HANDLE_HEIGHT = 10;
const CONTENT_PADDING = 5;
const CONTENT_GAP = 4;

const TOOL_IDS: ToolId[] = ['attack', 'pass', 'rival', 'zone'];

const getToolbarHeight = () =>
  CONTENT_PADDING * 2 + HANDLE_HEIGHT + CONTENT_GAP + TOOL_IDS.length * TOOL_BUTTON_SIZE + CONTENT_GAP * 2 + TOOL_BUTTON_SIZE * 2;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function DragHandleIcon() {
  return (
    <Svg width={20} height={10} viewBox="0 0 20 10">
      <Circle cx={4} cy={3} r={1.2} fill="#9CA3AF" opacity={0.9} />
      <Circle cx={10} cy={3} r={1.2} fill="#9CA3AF" opacity={0.9} />
      <Circle cx={16} cy={3} r={1.2} fill="#9CA3AF" opacity={0.9} />
      <Circle cx={4} cy={7} r={1.2} fill="#9CA3AF" opacity={0.9} />
      <Circle cx={10} cy={7} r={1.2} fill="#9CA3AF" opacity={0.9} />
      <Circle cx={16} cy={7} r={1.2} fill="#9CA3AF" opacity={0.9} />
    </Svg>
  );
}

function ToolIcon({ toolId, color }: { toolId: ToolId; color: string }) {
  if (toolId === 'attack') {
    return (
      <Svg width={18} height={18} viewBox="0 0 18 18">
        <Line x1="3" y1="15" x2="12" y2="6" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
        <Line x1="12" y1="6" x2="8.5" y2="6" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
        <Line x1="12" y1="6" x2="12" y2="9.5" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      </Svg>
    );
  }

  if (toolId === 'pass') {
    return (
      <Svg width={18} height={18} viewBox="0 0 18 18">
        <Line
          x1="2"
          y1="9"
          x2="16"
          y2="9"
          stroke={color}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeDasharray="3.5 2.4"
        />
      </Svg>
    );
  }

  if (toolId === 'rival') {
    return (
      <Svg width={18} height={18} viewBox="0 0 18 18">
        <Polygon points="9,3 15,14 3,14" fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      </Svg>
    );
  }

  return (
    <Svg width={18} height={18} viewBox="0 0 18 18">
      <Line x1="4" y1="9" x2="14" y2="9" stroke={color} strokeWidth="8" strokeLinecap="round" opacity="0.4" />
    </Svg>
  );
}

function UndoIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path
        d="M9 8L5 12L9 16"
        fill="none"
        stroke={color}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M5 12H13.5C16.5 12 19 14.5 19 17.5"
        fill="none"
        stroke={color}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function TrashIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path
        d="M4 7H20"
        fill="none"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9 7V5.5C9 4.7 9.7 4 10.5 4H13.5C14.3 4 15 4.7 15 5.5V7"
        fill="none"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M6.5 7L7.3 18.2C7.4 19.2 8.2 20 9.2 20H14.8C15.8 20 16.6 19.2 16.7 18.2L17.5 7"
        fill="none"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line x1="10" y1="10" x2="10" y2="16" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <Line x1="14" y1="10" x2="14" y2="16" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    </Svg>
  );
}

const tooltipProps = (title: string) =>
  Platform.OS === 'web'
    ? ({ title } as any)
    : undefined;

export default function DrawingToolbar({
  visible,
  activeToolId,
  onSelectTool,
  onUndo,
  onClear,
  undoDisabled,
  clearDisabled,
  boardWidth,
  boardHeight,
}: DrawingToolbarProps) {
  const toolbarHeight = useMemo(() => getToolbarHeight(), []);
  const initialX = Math.max(0, boardWidth - TOOLBAR_WIDTH - 10);
  const initialY = 10;

  const [position, setPosition] = useState({ x: initialX, y: initialY });
  const [dragOrigin, setDragOrigin] = useState<{ x: number; y: number } | null>(null);
  const [pointerStart, setPointerStart] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!visible) return;

    const maxX = Math.max(0, boardWidth - TOOLBAR_WIDTH);
    const maxY = Math.max(0, boardHeight - toolbarHeight);

    setPosition({
      x: clamp(initialX, 0, maxX),
      y: clamp(initialY, 0, maxY),
    });
  }, [boardHeight, boardWidth, initialX, initialY, toolbarHeight, visible]);

  if (!visible) return null;

  return (
    <View
      style={[
        styles.toolbar,
        {
          left: position.x,
          top: position.y,
          width: TOOLBAR_WIDTH,
        },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.panel}>
        <View
          style={styles.handle}
          onStartShouldSetResponder={() => true}
          onResponderGrant={(event) => {
            setDragOrigin(position);
            setPointerStart({
              x: event.nativeEvent.pageX,
              y: event.nativeEvent.pageY,
            });
          }}
          onResponderMove={(event) => {
            if (!dragOrigin || !pointerStart) return;

            const deltaX = event.nativeEvent.pageX - pointerStart.x;
            const deltaY = event.nativeEvent.pageY - pointerStart.y;

            const maxX = Math.max(0, boardWidth - TOOLBAR_WIDTH);
            const maxY = Math.max(0, boardHeight - toolbarHeight);

            setPosition({
              x: clamp(dragOrigin.x + deltaX, 0, maxX),
              y: clamp(dragOrigin.y + deltaY, 0, maxY),
            });
          }}
          onResponderRelease={() => {
            setDragOrigin(null);
            setPointerStart(null);
          }}
          onResponderTerminate={() => {
            setDragOrigin(null);
            setPointerStart(null);
          }}
        >
          <DragHandleIcon />
        </View>

        {TOOL_IDS.map((toolId) => {
          const isActive = activeToolId === toolId;
          const iconColor =
            toolId === 'attack' ? '#4FD1ED' : toolId === 'pass' ? '#FFFFFF' : toolId === 'rival' ? '#EF4444' : '#FACC15';

          return (
            <Pressable
              key={toolId}
              style={[styles.toolButton, isActive && styles.toolButtonActive]}
              onPress={() => onSelectTool(toolId)}
              accessibilityLabel={
                toolId === 'attack'
                  ? 'Movimiento / Carrera'
                  : toolId === 'pass'
                  ? 'Trayectoria del balón (Punteada)'
                  : toolId === 'rival'
                  ? 'Acción del oponente'
                  : 'Área de influencia / Bloque'
              }
              {...tooltipProps(
                toolId === 'attack'
                  ? 'Movimiento / Carrera'
                  : toolId === 'pass'
                  ? 'Trayectoria del balón (Punteada)'
                  : toolId === 'rival'
                  ? 'Acción del oponente'
                  : 'Área de influencia / Bloque'
              )}
            >
              <ToolIcon toolId={toolId} color={iconColor} />
            </Pressable>
          );
        })}

        <Pressable
          style={[styles.toolButton, styles.undoButton, undoDisabled && styles.toolButtonDisabled]}
          disabled={undoDisabled}
          onPress={onUndo}
          accessibilityLabel="Deshacer trazo (Ctrl+Z)"
          {...tooltipProps('Deshacer trazo (Ctrl+Z)')}
        >
          <UndoIcon color={undoDisabled ? '#6B7280' : '#7DD3FC'} />
        </Pressable>

        <Pressable
          style={[
            styles.toolButton,
            styles.clearButton,
            clearDisabled && styles.toolButtonDisabled,
          ]}
          disabled={clearDisabled}
          onPress={onClear}
          accessibilityLabel="Borrar todo el dibujo"
          {...tooltipProps('Borrar todo el dibujo')}
        >
          <TrashIcon color={clearDisabled ? '#6B7280' : '#F87171'} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    position: 'absolute',
    zIndex: 100,
  },
  panel: {
    backgroundColor: 'rgba(13, 17, 23, 0.84)',
    borderWidth: 1,
    borderColor: '#2A3240',
    borderRadius: 12,
    padding: CONTENT_PADDING,
    alignItems: 'center',
    gap: CONTENT_GAP,
  },
  handle: {
    width: 22,
    height: HANDLE_HEIGHT,
    borderRadius: 999,
    backgroundColor: '#202B3A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolButton: {
    width: TOOL_BUTTON_SIZE,
    height: TOOL_BUTTON_SIZE,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#2A3240',
    backgroundColor: 'rgba(15, 23, 35, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolButtonActive: {
    borderColor: '#4FD1ED',
    backgroundColor: 'rgba(79, 209, 237, 0.14)',
  },
  undoButton: {
    marginTop: 4,
  },
  clearButton: {
    marginTop: 0,
  },
  toolButtonDisabled: {
    opacity: 0.5,
  },
});
