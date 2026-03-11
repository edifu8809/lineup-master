import { memo, useEffect, useState } from 'react';
import { Image, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

type PlayerIconProps = {
  playerId: number | string;
  label: string;
  position?: string;
  orientation?: 'vertical' | 'horizontal';
  x?: number;
  y?: number;
  coordinates?: {
    top: string;
    left: string;
  };
  photoUrl?: string;
  energy?: number;
  rating?: number;
  boundsWidth?: number;
  boundsHeight?: number;
  onPositionChange?: (playerId: number | string, coordinates: { top: string; left: string }) => void;
  onPositionDrag?: (playerId: number | string, coordinates: { top: string; left: string }) => void;
  onDragStateChange?: (playerId: number | string, isDragging: boolean) => void;
  draggableEnabled?: boolean;
  minimal?: boolean;
  ghostOpacity?: number;
  forceAccentColor?: string;
  hidePhoto?: boolean;
  dashedBorder?: boolean;
  minimalMarkerText?: string;
  showLabelWhenMinimal?: boolean;
  showMinimalMarker?: boolean;
  isRival?: boolean;
};

const ROLE_OPTIONS = ['Poacher', 'False 9', 'Deep Lying Maker'] as const;

function PlayerIcon({
  playerId,
  label,
  position,
  orientation = 'vertical',
  x,
  y,
  coordinates,
  photoUrl,
  energy = 0.72,
  rating,
  boundsWidth,
  boundsHeight,
  onPositionChange,
  onPositionDrag,
  onDragStateChange,
  draggableEnabled = true,
  minimal = false,
  ghostOpacity,
  forceAccentColor,
  hidePhoto = false,
  dashedBorder = false,
  minimalMarkerText,
  showLabelWhenMinimal = false,
  showMinimalMarker = true,
  isRival = false,
}: PlayerIconProps) {
  const size = minimal ? 30 : 44;
  const innerSize = minimal ? 24 : 38;
  const clampedEnergy = Math.max(0, Math.min(1, energy));
  const normalizedPosition = (position || 'M').toUpperCase();
  const normalizedRating =
    typeof rating === 'number' && Number.isFinite(rating)
      ? Math.max(0, Math.min(10, rating))
      : Number((clampedEnergy * 10).toFixed(1));
  const ratingText = normalizedRating.toFixed(1);

  const positionAccentMap: Record<string, string> = {
    G: '#FACC15',
    D: '#3B82F6',
    M: '#22C55E',
    F: '#EF4444',
  };

  const rivalAccentMap: Record<string, string> = {
    G: '#3B82F6',
    D: '#3B82F6',
    M: '#22C55E',
    F: '#EF4444',
  };

  const accentColor = isRival
    ? rivalAccentMap[normalizedPosition] ?? '#3B82F6'
    : forceAccentColor ?? positionAccentMap[normalizedPosition] ?? '#4FD1ED';

  const ratingBarColor =
    normalizedRating > 7 ? '#22C55E' : normalizedRating >= 6 ? '#FACC15' : '#EF4444';

  const toRgba = (hex: string, alpha: number) => {
    const safeHex = hex.replace('#', '');
    if (safeHex.length !== 6) return `rgba(79, 209, 237, ${alpha})`;
    const r = Number.parseInt(safeHex.slice(0, 2), 16);
    const g = Number.parseInt(safeHex.slice(2, 4), 16);
    const b = Number.parseInt(safeHex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };
  const initials = label
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const compactRoleText = normalizedPosition.charAt(0) || 'M';
  const compactMarkerText = (minimalMarkerText || compactRoleText).slice(0, 2).toUpperCase();
  const topPercent = coordinates?.top ? Number.parseFloat(coordinates.top) : undefined;
  const leftPercent = coordinates?.left ? Number.parseFloat(coordinates.left) : undefined;

  const resolvedX =
    typeof x === 'number'
      ? x
      : typeof leftPercent === 'number' && Number.isFinite(leftPercent) && typeof boundsWidth === 'number'
      ? (leftPercent / 100) * boundsWidth
      : 0;

  const resolvedY =
    typeof y === 'number'
      ? y
      : typeof topPercent === 'number' && Number.isFinite(topPercent) && typeof boundsHeight === 'number'
      ? (topPercent / 100) * boundsHeight
      : 0;

  const [dragPosition, setDragPosition] = useState({ x: resolvedX, y: resolvedY });
  const [isDragging, setIsDragging] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [role, setRole] = useState<(typeof ROLE_OPTIONS)[number]>('Poacher');

  const translateX = useSharedValue(resolvedX);
  const translateY = useSharedValue(resolvedY);
  const scale = useSharedValue(1);

  useEffect(() => {
    translateX.value = withTiming(resolvedX, {
      duration: 500,
      easing: Easing.inOut(Easing.ease),
    });
    translateY.value = withTiming(resolvedY, {
      duration: 500,
      easing: Easing.inOut(Easing.ease),
    });
    setDragPosition({ x: resolvedX, y: resolvedY });
  }, [resolvedX, resolvedY, translateX, translateY]);

  const maxX = boundsWidth ?? Number.MAX_SAFE_INTEGER;
  const maxY = boundsHeight ?? Number.MAX_SAFE_INTEGER;
  const webNoSelectStyle =
    Platform.OS === 'web'
      ? ({
          userSelect: 'none',
          WebkitUserSelect: 'none',
          MozUserSelect: 'none',
          msUserSelect: 'none',
        } as any)
      : null;
  const webDraggableFalseProps = Platform.OS === 'web' ? ({ draggable: false } as any) : undefined;

  const panGesture = Gesture.Pan()
    .enabled(!menuVisible && draggableEnabled)
    .onStart(() => {
      if (onDragStateChange) {
        runOnJS(onDragStateChange)(playerId, true);
      }
      runOnJS(setIsDragging)(true);
      scale.value = withSpring(1.06, { damping: 12, stiffness: 180 });
    })
    .onUpdate((event) => {
      const nextX = dragPosition.x + event.translationX;
      const nextY = dragPosition.y + event.translationY;

      const boundedX = Math.max(size / 2, Math.min(maxX - size / 2, nextX));
      const boundedY = Math.max(size / 2, Math.min(maxY - size / 2, nextY));

      translateX.value = boundedX;
      translateY.value = boundedY;

      if (onPositionDrag && typeof boundsWidth === 'number' && typeof boundsHeight === 'number') {
        const topPercent = Math.max(0, Math.min(100, (boundedY / boundsHeight) * 100));
        const leftPercent = Math.max(0, Math.min(100, (boundedX / boundsWidth) * 100));
        runOnJS(onPositionDrag)(playerId, {
          top: `${topPercent.toFixed(2)}%`,
          left: `${leftPercent.toFixed(2)}%`,
        });
      }
    })
    .onEnd(() => {
      scale.value = withSpring(1, { damping: 10, stiffness: 220 });
      translateX.value = withSpring(translateX.value, { damping: 14, stiffness: 180 });
      translateY.value = withSpring(translateY.value, { damping: 14, stiffness: 180 });
      runOnJS(setIsDragging)(false);
      runOnJS(setDragPosition)({ x: translateX.value, y: translateY.value });
      if (onPositionChange && typeof boundsWidth === 'number' && typeof boundsHeight === 'number') {
        const topPercent = Math.max(0, Math.min(100, (translateY.value / boundsHeight) * 100));
        const leftPercent = Math.max(0, Math.min(100, (translateX.value / boundsWidth) * 100));
        runOnJS(onPositionChange)(playerId, {
          top: `${topPercent.toFixed(2)}%`,
          left: `${leftPercent.toFixed(2)}%`,
        });
      }
      if (onDragStateChange) {
        runOnJS(onDragStateChange)(playerId, false);
      }
    })
    .onFinalize(() => {
      runOnJS(setIsDragging)(false);
      if (onDragStateChange) {
        runOnJS(onDragStateChange)(playerId, false);
      }
    });

  const longPressGesture = Gesture.LongPress()
    .enabled(!menuVisible && draggableEnabled)
    .minDuration(350)
    .onStart(() => {
      runOnJS(setMenuVisible)(true);
    });

  const iconGesture = Gesture.Race(panGesture, longPressGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value - size / 2 },
      { translateY: translateY.value - size / 2 },
      { scale: scale.value },
    ],
  }));

  return (
    <>
      <GestureDetector gesture={iconGesture}>
        <Animated.View
          style={[
            styles.container,
            {
              width: size,
              opacity: typeof ghostOpacity === 'number' ? ghostOpacity : 1,
              zIndex: isDragging ? 90 : draggableEnabled ? 40 : 10,
              elevation: isDragging ? 16 : draggableEnabled ? 8 : 2,
            },
            animatedStyle,
          ]}
          pointerEvents={draggableEnabled ? 'auto' : 'none'}
          {...webDraggableFalseProps}
        >
          <View
            style={[
              styles.avatarRing,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                borderColor: accentColor,
                borderStyle: dashedBorder ? 'dashed' : 'solid',
                ...(minimal && hidePhoto
                  ? {}
                  : {
                      boxShadow: [
                        {
                          offsetX: 0,
                          offsetY: 0,
                          blurRadius: 10,
                          spreadDistance: 0,
                          color: toRgba(accentColor, 0.45),
                        },
                      ],
                    }),
              },
            ]}
          >
            <View style={[styles.avatarClip, { width: innerSize, height: innerSize, borderRadius: innerSize / 2 }]}>
              {minimal && hidePhoto ? (
                <View style={[styles.minimalSolidDot, styles.minimalMarkerDot, { backgroundColor: accentColor }]}> 
                  {showMinimalMarker ? (
                    <Text
                      style={[styles.minimalMarkerText, isRival ? styles.minimalMarkerTextRival : null, webNoSelectStyle]}
                      selectable={false}
                      {...webDraggableFalseProps}
                    >
                      {compactMarkerText}
                    </Text>
                  ) : null}
                </View>
              ) : !hidePhoto && photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.avatarImage} {...webDraggableFalseProps} />
              ) : (
                <View style={styles.initialsFallback}>
                  <Text style={[styles.initialsText, webNoSelectStyle]} selectable={false} {...webDraggableFalseProps}>{initials}</Text>
                </View>
              )}
            </View>
          </View>

          {!minimal ? (
            <>
              <View style={styles.energyRow}>
                <View style={styles.energyTrack}>
                  <View style={[styles.energyFill, { width: `${clampedEnergy * 100}%`, backgroundColor: ratingBarColor }]} />
                </View>
                <Text style={[styles.ratingText, { color: ratingBarColor }, webNoSelectStyle]} selectable={false} {...webDraggableFalseProps}>{ratingText}</Text>
              </View>

              <Text style={[styles.playerName, webNoSelectStyle]} numberOfLines={1} selectable={false} {...webDraggableFalseProps}>
                {label}
              </Text>
              <Text
                style={[
                  styles.roleBadge,
                  {
                    backgroundColor: toRgba(accentColor, 0.2),
                    color: accentColor,
                    borderColor: toRgba(accentColor, 0.6),
                  },
                  webNoSelectStyle,
                  orientation === 'horizontal' ? styles.horizontalReadableText : null,
                ]}
                numberOfLines={1}
                selectable={false}
                {...webDraggableFalseProps}
              >
                {normalizedPosition}
              </Text>
            </>
          ) : showLabelWhenMinimal ? (
            <Text
              style={[styles.minimalLabel, isRival ? styles.minimalLabelRival : null, webNoSelectStyle]}
              numberOfLines={1}
              selectable={false}
              {...webDraggableFalseProps}
            >
              {label}
            </Text>
          ) : null}
        </Animated.View>
      </GestureDetector>

      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setMenuVisible(false)}>
          <Pressable style={styles.roleMenuCard} onPress={() => {}}>
            <Text style={styles.roleMenuTitle}>PLAYER ROLE</Text>
            {ROLE_OPTIONS.map((option) => (
              <Pressable
                key={option}
                style={[styles.roleOption, role === option && styles.roleOptionActive]}
                onPress={() => {
                  setRole(option);
                  setMenuVisible(false);
                }}
              >
                <Text style={[styles.roleOptionText, role === option && styles.roleOptionTextActive]}>{option}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export default memo(PlayerIcon);

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignItems: 'center',
    left: 0,
    top: 0,
    zIndex: 10,
    pointerEvents: 'auto',
  },
  avatarRing: {
    borderWidth: 2,
    backgroundColor: '#0D1117',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarClip: {
    overflow: 'hidden',
    backgroundColor: '#374151',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    backgroundColor: '#1F2937',
  },
  initialsFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  minimalSolidDot: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
  },
  minimalMarkerDot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  minimalMarkerText: {
    color: '#0D1117',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  minimalMarkerTextRival: {
    color: '#F9FAFB',
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  initialsText: {
    color: '#E5E7EB',
    fontSize: 12,
    fontWeight: '800',
  },
  minimalLabel: {
    marginTop: 3,
    color: '#E5E7EB',
    fontSize: 9,
    fontWeight: '700',
    maxWidth: 72,
    textAlign: 'center',
  },
  minimalLabelRival: {
    color: '#FFFFFF',
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  energyRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  energyTrack: {
    width: 28,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#4B5563',
    overflow: 'hidden',
  },
  energyFill: {
    height: '100%',
    borderRadius: 2,
  },
  ratingText: {
    fontSize: 8,
    fontWeight: '800',
    minWidth: 20,
    textAlign: 'left',
  },
  playerName: {
    marginTop: 3,
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    maxWidth: 56,
    textAlign: 'center',
  },
  roleBadge: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: '700',
    maxWidth: 72,
    textAlign: 'center',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  horizontalReadableText: {
    transform: [{ rotate: '0deg' }],
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.28)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  roleMenuCard: {
    width: 220,
    backgroundColor: '#0F1723',
    borderWidth: 1,
    borderColor: '#4FD1ED',
    borderRadius: 12,
    padding: 12,
  },
  roleMenuTitle: {
    color: '#E6EDF3',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 10,
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  roleOption: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A3240',
    backgroundColor: '#111827',
    paddingVertical: 9,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  roleOptionActive: {
    borderColor: '#4FD1ED',
  },
  roleOptionText: {
    color: '#C9D1D9',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  roleOptionTextActive: {
    color: '#4FD1ED',
  },
});
