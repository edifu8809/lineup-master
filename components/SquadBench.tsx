import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type BenchPlayer = {
  id: number | string;
  name: string;
  pos?: string;
  number?: number;
};

type SquadBenchProps = {
  players: BenchPlayer[];
  disabled?: boolean;
  onPlayerDrop: (player: BenchPlayer, dropPoint: { x: number; y: number }) => void;
};

const getPositionColor = (position?: string) => {
  const normalized = (position || 'M').toUpperCase();
  if (normalized.startsWith('G')) return '#FACC15';
  if (normalized.startsWith('D')) return '#3B82F6';
  if (normalized.startsWith('M')) return '#22C55E';
  return '#EF4444';
};

type BenchChipProps = {
  player: BenchPlayer;
  disabled: boolean;
  width?: number;
  onDrop: (player: BenchPlayer, dropPoint: { x: number; y: number }) => void;
};

const getPlayerLastName = (name: string) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Player';
  return parts[parts.length - 1];
};

const BenchChip = memo(function BenchChip({ player, disabled, width, onDrop }: BenchChipProps) {
  const translate = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const [isDragging, setIsDragging] = useState(false);
  const [dragPoint, setDragPoint] = useState({ x: 0, y: 0 });

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponder: () => !disabled,
        onPanResponderMove: (_event, gestureState) => {
          translate.setValue({ x: gestureState.dx, y: gestureState.dy });
          setDragPoint({ x: gestureState.moveX, y: gestureState.moveY });
        },
        onPanResponderGrant: (_event, gestureState) => {
          setIsDragging(true);
          setDragPoint({ x: gestureState.x0, y: gestureState.y0 });
        },
        onPanResponderRelease: (_event, gestureState) => {
          onDrop(player, { x: gestureState.moveX, y: gestureState.moveY });
          setIsDragging(false);
          Animated.spring(translate, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
            speed: 24,
            bounciness: 6,
          }).start();
        },
        onPanResponderTerminate: () => {
          setIsDragging(false);
          Animated.spring(translate, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
            speed: 24,
            bounciness: 6,
          }).start();
        },
      }),
    [disabled, onDrop, player, translate]
  );

  const accent = getPositionColor(player.pos);
  const positionInitial = (player.pos || 'M').toUpperCase().slice(0, 1);
  const lastName = getPlayerLastName(player.name);
  const webNoSelectStyle =
    Platform.OS === 'web'
      ? ({
          userSelect: 'none',
          WebkitUserSelect: 'none',
        } as any)
      : null;

  return (
    <>
      <Animated.View
        style={[
          styles.chip,
          {
            borderColor: accent,
            width,
            transform: [{ translateX: translate.x }, { translateY: translate.y }],
            opacity: disabled ? 0.45 : isDragging ? 0.08 : 1,
            zIndex: isDragging ? 120 : 1,
            elevation: isDragging ? 12 : 0,
          },
        ]}
        {...(disabled ? {} : panResponder.panHandlers)}
      >
        <Pressable disabled={disabled} style={styles.chipBody}>
          <View style={[styles.posCircle, { backgroundColor: accent }]}> 
            <Text style={[styles.posInitial, webNoSelectStyle]} selectable={false}>
              {positionInitial}
            </Text>
          </View>
          <Text style={[styles.nameText, webNoSelectStyle]} numberOfLines={1} selectable={false}>
            {lastName}
          </Text>
        </Pressable>
      </Animated.View>

      {isDragging ? (
        <Modal transparent animationType="none" visible>
          <View pointerEvents="none" style={styles.dragGhostLayer}>
            <View
              style={[
                styles.dragGhost,
                {
                  borderColor: accent,
                  width,
                  left: dragPoint.x - ((width ?? 110) / 2),
                  top: dragPoint.y - 14,
                },
              ]}
            >
              <View style={styles.chipBody}>
                <View style={[styles.posCircle, { backgroundColor: accent }]}> 
                  <Text style={[styles.posInitial, webNoSelectStyle]} selectable={false}>
                    {positionInitial}
                  </Text>
                </View>
                <Text style={[styles.nameText, webNoSelectStyle]} numberOfLines={1} selectable={false}>
                  {lastName}
                </Text>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
});

function SquadBench({ players, disabled = false, onPlayerDrop }: SquadBenchProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const expandAnim = useRef(new Animated.Value(1)).current;
  const columns = containerWidth >= 330 ? 3 : 2;
  const gap = 8;
  const chipWidth =
    containerWidth > 0 ? Math.max(86, Math.floor((containerWidth - gap * (columns - 1)) / columns)) : undefined;
  const webScrollStyle =
    Platform.OS === 'web'
      ? ({
          overflowY: 'auto',
          scrollbarWidth: 'thin',
        } as any)
      : null;

  useEffect(() => {
    Animated.timing(expandAnim, {
      toValue: collapsed ? 0 : 1,
      duration: collapsed ? 180 : 240,
      useNativeDriver: false,
    }).start();
  }, [collapsed, expandAnim]);

  const animatedListStyle = {
    maxHeight: expandAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 200] }),
    opacity: expandAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
    transform: [
      {
        translateY: expandAnim.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }),
      },
    ],
  };

  const handleContainerLayout = (event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    if (!Number.isFinite(nextWidth) || nextWidth <= 0) return;
    setContainerWidth((previous) => (previous === nextWidth ? previous : nextWidth));
  };

  return (
    <View style={styles.container} onLayout={handleContainerLayout}>
      <Pressable style={styles.headerButton} onPress={() => setCollapsed((previous) => !previous)}>
        <Text style={styles.title}>SQUAD BENCH</Text>
        <Text style={styles.chevron}>{collapsed ? '▸' : '▾'}</Text>
      </Pressable>

      <Animated.View style={[styles.listAnimatedWrap, animatedListStyle]} pointerEvents={collapsed ? 'none' : 'auto'}>
        <ScrollView
          style={[styles.list, webScrollStyle]}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator
          nestedScrollEnabled
        >
          {players.length === 0 ? (
            <Text style={styles.emptyText}>No hay suplentes disponibles</Text>
          ) : (
            <View style={styles.grid}>
              {players.map((player) => (
                <BenchChip
                  key={`bench-${player.id}`}
                  player={player}
                  disabled={disabled}
                  width={chipWidth}
                  onDrop={onPlayerDrop}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

export default memo(SquadBench);

const styles = StyleSheet.create({
  container: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#2A3240',
    paddingTop: 10,
    zIndex: 8,
    overflow: 'visible',
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    color: '#E6EDF3',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  chevron: {
    color: '#8B949E',
    fontSize: 13,
    fontWeight: '800',
  },
  listAnimatedWrap: {
    overflow: 'visible',
  },
  list: {
    maxHeight: 200,
    overflow: 'visible',
  },
  listContent: {
    paddingTop: 2,
    paddingBottom: 4,
    overflow: 'visible',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    overflow: 'visible',
  },
  chip: {
    borderWidth: 1,
    backgroundColor: '#0F1723',
    borderRadius: 999,
    overflow: 'visible',
  },
  chipBody: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  posCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  posInitial: {
    color: '#0D1117',
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 10,
  },
  nameText: {
    flex: 1,
    color: '#C9D1D9',
    fontSize: 10,
    fontWeight: '700',
  },
  emptyText: {
    color: '#7D8590',
    fontSize: 11,
    fontWeight: '600',
    paddingVertical: 6,
  },
  dragGhostLayer: {
    flex: 1,
  },
  dragGhost: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: 999,
    backgroundColor: '#0F1723',
    shadowColor: '#4FD1ED',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 18,
  },
});
