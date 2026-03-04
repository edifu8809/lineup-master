import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
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
  label: string;
  position?: string;
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
  draggableEnabled?: boolean;
};

const ROLE_OPTIONS = ['Poacher', 'False 9', 'Deep Lying Maker'] as const;

export default function PlayerIcon({
  label,
  position,
  x,
  y,
  coordinates,
  photoUrl,
  energy = 0.72,
  rating,
  boundsWidth,
  boundsHeight,
  draggableEnabled = true,
}: PlayerIconProps) {
  const size = 44;
  const innerSize = 38;
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

  const accentColor = positionAccentMap[normalizedPosition] ?? '#4FD1ED';

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

  const panGesture = Gesture.Pan()
    .enabled(!menuVisible && draggableEnabled)
    .onStart(() => {
      scale.value = withSpring(1.06, { damping: 12, stiffness: 180 });
    })
    .onUpdate((event) => {
      const nextX = dragPosition.x + event.translationX;
      const nextY = dragPosition.y + event.translationY;

      const boundedX = Math.max(size / 2, Math.min(maxX - size / 2, nextX));
      const boundedY = Math.max(size / 2, Math.min(maxY - size / 2, nextY));

      translateX.value = boundedX;
      translateY.value = boundedY;
    })
    .onEnd(() => {
      scale.value = withSpring(1, { damping: 10, stiffness: 220 });
      translateX.value = withSpring(translateX.value, { damping: 14, stiffness: 180 });
      translateY.value = withSpring(translateY.value, { damping: 14, stiffness: 180 });
      runOnJS(setDragPosition)({ x: translateX.value, y: translateY.value });
    });

  const longPressGesture = Gesture.LongPress()
    .enabled(!menuVisible)
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
        <Animated.View style={[styles.container, { width: size }, animatedStyle]}>
          <View
            style={[
              styles.avatarRing,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                borderColor: accentColor,
                boxShadow: [
                  {
                    offsetX: 0,
                    offsetY: 0,
                    blurRadius: 10,
                    spreadDistance: 0,
                    color: toRgba(accentColor, 0.45),
                  },
                ],
              },
            ]}
          >
            <View style={[styles.avatarClip, { width: innerSize, height: innerSize, borderRadius: innerSize / 2 }]}>
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.avatarImage} />
              ) : (
                <View style={styles.initialsFallback}>
                  <Text style={styles.initialsText}>{initials}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.energyRow}>
            <View style={styles.energyTrack}>
              <View style={[styles.energyFill, { width: `${clampedEnergy * 100}%`, backgroundColor: ratingBarColor }]} />
            </View>
            <Text style={[styles.ratingText, { color: ratingBarColor }]}>{ratingText}</Text>
          </View>

          <Text style={styles.playerName} numberOfLines={1}>
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
            ]}
            numberOfLines={1}
          >
            {normalizedPosition}
          </Text>
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
  initialsText: {
    color: '#E5E7EB',
    fontSize: 12,
    fontWeight: '800',
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
