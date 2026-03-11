export type FootballCoordinates = {
  top: string;
  left: string;
};

export type FootballPlayer = {
  id: number | string;
  name: string;
  number?: number;
  pos?: string;
  grid?: string;
  photo?: string;
  rating?: number;
  energy?: number;
  coordinates: FootballCoordinates;
};

export type FootballLineup = {
  team?: {
    id?: number;
    name?: string;
    logo?: string;
  };
  formation?: string;
  coach?: {
    id?: number;
    name?: string;
    photo?: string;
  };
  players: FootballPlayer[];
  playersPositions?: Record<string, FootballCoordinates | undefined>;
  benchPlayers?: Array<Omit<FootballPlayer, 'coordinates'> & { coordinates?: FootballCoordinates }>;
  substitutes: unknown[];
};

export type FootballTacticsData = {
  raw: unknown;
  lineups: FootballLineup[];
};

export function convertToCoordinates(
  grid: string,
  options?: { maxRows?: number; rowMax?: number }
): FootballCoordinates;

export function mapCoordinatesByOrientation(
  coordinates: FootballCoordinates,
  orientation?: 'vertical' | 'horizontal'
): FootballCoordinates;

export const DEVELOPMENT_MODE: boolean;

declare function useFootballTactics(options?: {
  fixtureId?: string;
  developmentMode?: boolean;
  defaultFormation?: string;
  skip?: boolean;
}): {
  data: FootballTacticsData | null;
  loading: boolean;
  error: Error | null;
  convertToCoordinates: typeof convertToCoordinates;
  refetch: () => Promise<void>;
};

export default useFootballTactics;
