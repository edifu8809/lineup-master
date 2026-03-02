import { View, StyleSheet, Dimensions, Text } from 'react-native';
import Svg, { Rect, Circle, Line } from 'react-native-svg';
import { useLocalSearchParams } from 'expo-router';
import PlayerIcon from '../components/PlayerIcon';
import { FORMATIONS } from '../constants/formations';

const { width } = Dimensions.get('window');
const PITCH_WIDTH = width - 32;
const PITCH_HEIGHT = PITCH_WIDTH * 1.5;

const FORMATION_KEY = '4-4-2';
const formation = FORMATIONS[FORMATION_KEY];

export default function BoardScreen() {
  const { team } = useLocalSearchParams<{ team: string }>();

  return (
    <View style={styles.container}>
      {team ? <Text style={styles.teamLabel}>{team}</Text> : null}
      <Svg width={PITCH_WIDTH} height={PITCH_HEIGHT}>
        {/* Pitch background */}
        <Rect
          x={0}
          y={0}
          width={PITCH_WIDTH}
          height={PITCH_HEIGHT}
          fill="#2d8a4e"
          rx={4}
        />

        {/* Pitch border */}
        <Rect
          x={12}
          y={12}
          width={PITCH_WIDTH - 24}
          height={PITCH_HEIGHT - 24}
          fill="none"
          stroke="#fff"
          strokeWidth={2}
        />

        {/* Halfway line */}
        <Line
          x1={12}
          y1={PITCH_HEIGHT / 2}
          x2={PITCH_WIDTH - 12}
          y2={PITCH_HEIGHT / 2}
          stroke="#fff"
          strokeWidth={2}
        />

        {/* Centre circle */}
        <Circle
          cx={PITCH_WIDTH / 2}
          cy={PITCH_HEIGHT / 2}
          r={PITCH_WIDTH * 0.12}
          fill="none"
          stroke="#fff"
          strokeWidth={2}
        />

        {/* Centre spot */}
        <Circle
          cx={PITCH_WIDTH / 2}
          cy={PITCH_HEIGHT / 2}
          r={3}
          fill="#fff"
        />

        {/* Top penalty box */}
        <Rect
          x={PITCH_WIDTH * 0.2}
          y={12}
          width={PITCH_WIDTH * 0.6}
          height={PITCH_HEIGHT * 0.15}
          fill="none"
          stroke="#fff"
          strokeWidth={2}
        />

        {/* Bottom penalty box */}
        <Rect
          x={PITCH_WIDTH * 0.2}
          y={PITCH_HEIGHT - 12 - PITCH_HEIGHT * 0.15}
          width={PITCH_WIDTH * 0.6}
          height={PITCH_HEIGHT * 0.15}
          fill="none"
          stroke="#fff"
          strokeWidth={2}
        />

        {/* Top goal */}
        <Rect
          x={PITCH_WIDTH * 0.38}
          y={4}
          width={PITCH_WIDTH * 0.24}
          height={12}
          fill="none"
          stroke="#fff"
          strokeWidth={2}
        />

        {/* Bottom goal */}
        <Rect
          x={PITCH_WIDTH * 0.38}
          y={PITCH_HEIGHT - 16}
          width={PITCH_WIDTH * 0.24}
          height={12}
          fill="none"
          stroke="#fff"
          strokeWidth={2}
        />

        {/* Player icons */}
        {formation.map((player) => (
          <PlayerIcon
            key={player.id}
            label={player.label}
            x={player.x * PITCH_WIDTH}
            y={player.y * PITCH_HEIGHT}
          />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  teamLabel: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
});
