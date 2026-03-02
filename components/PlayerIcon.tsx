import { Circle, Text } from 'react-native-svg';

type PlayerIconProps = {
  label: string;
  x: number;
  y: number;
  radius?: number;
  fillColor?: string;
  textColor?: string;
};

export default function PlayerIcon({
  label,
  x,
  y,
  radius = 18,
  fillColor = '#fff',
  textColor = '#1a1a1a',
}: PlayerIconProps) {
  return (
    <>
      <Circle cx={x} cy={y} r={radius} fill={fillColor} opacity={0.9} />
      <Text
        x={x}
        y={y + 5}
        textAnchor="middle"
        fontSize={11}
        fontWeight="bold"
        fill={textColor}
      >
        {label}
      </Text>
    </>
  );
}
