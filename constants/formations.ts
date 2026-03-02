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

export const FORMATIONS: Record<string, Formation> = {
  '4-4-2': [
    // Goalkeeper
    { id: 'gk', label: 'GK', x: 0.5, y: 0.93 },
    // Defenders
    { id: 'lb', label: 'LB', x: 0.15, y: 0.78 },
    { id: 'cb1', label: 'CB', x: 0.37, y: 0.78 },
    { id: 'cb2', label: 'CB', x: 0.63, y: 0.78 },
    { id: 'rb', label: 'RB', x: 0.85, y: 0.78 },
    // Midfielders
    { id: 'lm', label: 'LM', x: 0.15, y: 0.56 },
    { id: 'cm1', label: 'CM', x: 0.37, y: 0.56 },
    { id: 'cm2', label: 'CM', x: 0.63, y: 0.56 },
    { id: 'rm', label: 'RM', x: 0.85, y: 0.56 },
    // Forwards
    { id: 'st1', label: 'ST', x: 0.37, y: 0.3 },
    { id: 'st2', label: 'ST', x: 0.63, y: 0.3 },
  ],

  '4-3-3': [
    // Goalkeeper
    { id: 'gk', label: 'GK', x: 0.5, y: 0.93 },
    // Defenders
    { id: 'lb', label: 'LB', x: 0.15, y: 0.78 },
    { id: 'cb1', label: 'CB', x: 0.37, y: 0.78 },
    { id: 'cb2', label: 'CB', x: 0.63, y: 0.78 },
    { id: 'rb', label: 'RB', x: 0.85, y: 0.78 },
    // Midfielders
    { id: 'cm1', label: 'CM', x: 0.25, y: 0.55 },
    { id: 'cm2', label: 'CM', x: 0.5, y: 0.55 },
    { id: 'cm3', label: 'CM', x: 0.75, y: 0.55 },
    // Forwards
    { id: 'lw', label: 'LW', x: 0.18, y: 0.28 },
    { id: 'cf', label: 'CF', x: 0.5, y: 0.22 },
    { id: 'rw', label: 'RW', x: 0.82, y: 0.28 },
  ],

  '4-2-3-1': [
    // Goalkeeper
    { id: 'gk', label: 'GK', x: 0.5, y: 0.93 },
    // Defenders
    { id: 'lb', label: 'LB', x: 0.15, y: 0.78 },
    { id: 'cb1', label: 'CB', x: 0.37, y: 0.78 },
    { id: 'cb2', label: 'CB', x: 0.63, y: 0.78 },
    { id: 'rb', label: 'RB', x: 0.85, y: 0.78 },
    // Defensive midfielders
    { id: 'dm1', label: 'DM', x: 0.37, y: 0.63 },
    { id: 'dm2', label: 'DM', x: 0.63, y: 0.63 },
    // Attacking midfielders
    { id: 'lam', label: 'LAM', x: 0.2, y: 0.45 },
    { id: 'cam', label: 'CAM', x: 0.5, y: 0.42 },
    { id: 'ram', label: 'RAM', x: 0.8, y: 0.45 },
    // Forward
    { id: 'st', label: 'ST', x: 0.5, y: 0.24 },
  ],

  '3-5-2': [
    // Goalkeeper
    { id: 'gk', label: 'GK', x: 0.5, y: 0.93 },
    // Defenders (3)
    { id: 'cb1', label: 'CB', x: 0.25, y: 0.78 },
    { id: 'cb2', label: 'CB', x: 0.5, y: 0.78 },
    { id: 'cb3', label: 'CB', x: 0.75, y: 0.78 },
    // Midfielders (5)
    { id: 'lwb', label: 'LWB', x: 0.1, y: 0.58 },
    { id: 'cm1', label: 'CM', x: 0.3, y: 0.55 },
    { id: 'cm2', label: 'CM', x: 0.5, y: 0.52 },
    { id: 'cm3', label: 'CM', x: 0.7, y: 0.55 },
    { id: 'rwb', label: 'RWB', x: 0.9, y: 0.58 },
    // Forwards (2)
    { id: 'st1', label: 'ST', x: 0.37, y: 0.3 },
    { id: 'st2', label: 'ST', x: 0.63, y: 0.3 },
  ],
};
