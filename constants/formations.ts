/**
 * Football formation coordinate objects.
 * Coordinates are expressed as fractions of pitch width (x) and height (y),
 * so values range from 0 to 1 and scale to any pitch size.
 *
 * Convention: y=0 is the top of the pitch, y=1 is the bottom.
 * The goalkeeper is placed near y=0.93 (bottom, defensive end).
 */

export type PlayerPosition = {
  id: string;
  label: string;
  /** Fractional x position (0 = left edge, 1 = right edge) */
  x: number;
  /** Fractional y position (0 = top, 1 = bottom) */
  y: number;
};

export type Formation = PlayerPosition[];

export type FormationPhases = {
  attack: Formation;
  defense: Formation;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const advanceForAttack = (formation: Formation): Formation =>
  formation.map((position, index) => {
    if (index === 0 || position.label === 'GK') {
      return {
        ...position,
        y: clamp(position.y - 0.04, 0.08, 0.95),
      };
    }

    if (position.label.includes('B') || position.label === 'CB') {
      return {
        ...position,
        y: clamp(position.y - 0.08, 0.08, 0.95),
      };
    }

    if (position.label.includes('M') || position.label.includes('W')) {
      return {
        ...position,
        y: clamp(position.y - 0.1, 0.08, 0.95),
      };
    }

    return {
      ...position,
      y: clamp(position.y - 0.12, 0.08, 0.95),
    };
  });

const DEFENSIVE_FORMATIONS: Record<string, Formation> = {
  '4-4-2': [
    { id: 'gk', label: 'GK', x: 0.5, y: 0.93 },
    { id: 'lb', label: 'LB', x: 0.15, y: 0.78 },
    { id: 'cb1', label: 'CB', x: 0.37, y: 0.78 },
    { id: 'cb2', label: 'CB', x: 0.63, y: 0.78 },
    { id: 'rb', label: 'RB', x: 0.85, y: 0.78 },
    { id: 'lm', label: 'LM', x: 0.15, y: 0.56 },
    { id: 'cm1', label: 'CM', x: 0.37, y: 0.56 },
    { id: 'cm2', label: 'CM', x: 0.63, y: 0.56 },
    { id: 'rm', label: 'RM', x: 0.85, y: 0.56 },
    { id: 'st1', label: 'ST', x: 0.37, y: 0.3 },
    { id: 'st2', label: 'ST', x: 0.63, y: 0.3 },
  ],
  '4-3-3': [
    { id: 'gk', label: 'GK', x: 0.5, y: 0.93 },
    { id: 'lb', label: 'LB', x: 0.15, y: 0.78 },
    { id: 'cb1', label: 'CB', x: 0.37, y: 0.78 },
    { id: 'cb2', label: 'CB', x: 0.63, y: 0.78 },
    { id: 'rb', label: 'RB', x: 0.85, y: 0.78 },
    { id: 'cm1', label: 'CM', x: 0.25, y: 0.55 },
    { id: 'cm2', label: 'CM', x: 0.5, y: 0.55 },
    { id: 'cm3', label: 'CM', x: 0.75, y: 0.55 },
    { id: 'lw', label: 'LW', x: 0.18, y: 0.28 },
    { id: 'cf', label: 'CF', x: 0.5, y: 0.22 },
    { id: 'rw', label: 'RW', x: 0.82, y: 0.28 },
  ],
  '4-2-3-1': [
    { id: 'gk', label: 'GK', x: 0.5, y: 0.93 },
    { id: 'lb', label: 'LB', x: 0.15, y: 0.78 },
    { id: 'cb1', label: 'CB', x: 0.37, y: 0.78 },
    { id: 'cb2', label: 'CB', x: 0.63, y: 0.78 },
    { id: 'rb', label: 'RB', x: 0.85, y: 0.78 },
    { id: 'dm1', label: 'DM', x: 0.37, y: 0.63 },
    { id: 'dm2', label: 'DM', x: 0.63, y: 0.63 },
    { id: 'lam', label: 'LAM', x: 0.2, y: 0.45 },
    { id: 'cam', label: 'CAM', x: 0.5, y: 0.42 },
    { id: 'ram', label: 'RAM', x: 0.8, y: 0.45 },
    { id: 'st', label: 'ST', x: 0.5, y: 0.24 },
  ],
  '3-5-2': [
    { id: 'gk', label: 'GK', x: 0.5, y: 0.93 },
    { id: 'cb1', label: 'CB', x: 0.25, y: 0.78 },
    { id: 'cb2', label: 'CB', x: 0.5, y: 0.78 },
    { id: 'cb3', label: 'CB', x: 0.75, y: 0.78 },
    { id: 'lwb', label: 'LWB', x: 0.1, y: 0.58 },
    { id: 'cm1', label: 'CM', x: 0.3, y: 0.55 },
    { id: 'cm2', label: 'CM', x: 0.5, y: 0.52 },
    { id: 'cm3', label: 'CM', x: 0.7, y: 0.55 },
    { id: 'rwb', label: 'RWB', x: 0.9, y: 0.58 },
    { id: 'st1', label: 'ST', x: 0.37, y: 0.3 },
    { id: 'st2', label: 'ST', x: 0.63, y: 0.3 },
  ],
  '5-3-2': [
    { id: 'gk', label: 'GK', x: 0.5, y: 0.93 },
    { id: 'lwb', label: 'LWB', x: 0.08, y: 0.76 },
    { id: 'cb1', label: 'CB', x: 0.28, y: 0.79 },
    { id: 'cb2', label: 'CB', x: 0.5, y: 0.81 },
    { id: 'cb3', label: 'CB', x: 0.72, y: 0.79 },
    { id: 'rwb', label: 'RWB', x: 0.92, y: 0.76 },
    { id: 'cm1', label: 'CM', x: 0.3, y: 0.56 },
    { id: 'cm2', label: 'CM', x: 0.5, y: 0.53 },
    { id: 'cm3', label: 'CM', x: 0.7, y: 0.56 },
    { id: 'st1', label: 'ST', x: 0.4, y: 0.31 },
    { id: 'st2', label: 'ST', x: 0.6, y: 0.31 },
  ],
  '3-4-3': [
    { id: 'gk', label: 'GK', x: 0.5, y: 0.93 },
    { id: 'cb1', label: 'CB', x: 0.25, y: 0.79 },
    { id: 'cb2', label: 'CB', x: 0.5, y: 0.81 },
    { id: 'cb3', label: 'CB', x: 0.75, y: 0.79 },
    { id: 'lm', label: 'LM', x: 0.14, y: 0.56 },
    { id: 'cm1', label: 'CM', x: 0.38, y: 0.54 },
    { id: 'cm2', label: 'CM', x: 0.62, y: 0.54 },
    { id: 'rm', label: 'RM', x: 0.86, y: 0.56 },
    { id: 'lw', label: 'LW', x: 0.18, y: 0.3 },
    { id: 'cf', label: 'CF', x: 0.5, y: 0.24 },
    { id: 'rw', label: 'RW', x: 0.82, y: 0.3 },
  ],
};

export const FORMATION_PHASES: Record<string, FormationPhases> = Object.fromEntries(
  Object.entries(DEFENSIVE_FORMATIONS).map(([formationKey, defensiveShape]) => [
    formationKey,
    {
      defense: defensiveShape,
      attack: advanceForAttack(defensiveShape),
    },
  ])
) as Record<string, FormationPhases>;

export const FORMATIONS: Record<string, Formation> = {
  '4-4-2': FORMATION_PHASES['4-4-2'].defense,
  '4-3-3': FORMATION_PHASES['4-3-3'].defense,
  '4-2-3-1': FORMATION_PHASES['4-2-3-1'].defense,
  '3-5-2': FORMATION_PHASES['3-5-2'].defense,
  '5-3-2': FORMATION_PHASES['5-3-2'].defense,
  '3-4-3': FORMATION_PHASES['3-4-3'].defense,
};
