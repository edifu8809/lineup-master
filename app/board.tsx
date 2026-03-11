import { SafeAreaView, View, StyleSheet, Text, ScrollView, Pressable, Switch, ActivityIndicator, useWindowDimensions, TextInput, Image, Animated, Easing, Platform } from 'react-native';
import Svg, { Rect, Circle, Line, Path, Defs, RadialGradient, Stop, G, Text as SvgText } from 'react-native-svg';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import PlayerIcon from '../components/PlayerIcon';
import DrawingToolbar from '../components/DrawingToolbar';
import SquadBench from '../components/SquadBench';
import FormationsDropdown from '../components/FormationsDropdown';
import useFootballTactics from '../hooks/useFootballTactics';
import { FORMATION_PHASES } from '../constants/formations';
import {
  TEAM_DATABASE,
  TeamDatabaseItem,
  DEFAULT_LEAGUE_FILTER,
  TEAMS_BY_LEAGUE,
  LeagueKey,
} from '../constants/commandCenterTeams';

const BASE_FORMATION_OPTIONS = ['4-4-2', '3-5-2', '4-3-3', '4-2-3-1', '5-3-2', '3-4-3'] as const;
const CUSTOM_TACTIC_NAME = 'CUSTOM 1';
const CUSTOM_TACTIC_NAME_2 = 'CUSTOM 2';
const CUSTOM_TACTIC_NAMES = [CUSTOM_TACTIC_NAME, CUSTOM_TACTIC_NAME_2] as const;
const DRAW_TOOL_OPTIONS = ['attack', 'pass', 'rival', 'zone'] as const;

type DrawToolId = (typeof DRAW_TOOL_OPTIONS)[number];

type DrawLineStyle = 'solid' | 'dashed';

type DrawToolConfig = {
  id: DrawToolId;
  label: string;
  color: string;
  lineStyle: DrawLineStyle;
  withArrow: boolean;
  strokeWidth: number;
  glowWidth: number;
  opacity: number;
  icon: string;
};

type DrawPoint = {
  x: number;
  y: number;
};

type DrawPathShape = {
  id: string;
  toolId: DrawToolId;
  lineStyle: DrawLineStyle;
  color: string;
  strokeWidth: number;
  glowWidth: number;
  opacity: number;
  withArrow: boolean;
  points: DrawPoint[];
  anchor?: {
    startPlayerId?: number | string;
    endPlayerId?: number | string;
    startPoint: DrawPoint;
    endPoint: DrawPoint;
  };
};

const DRAW_TOOLS: DrawToolConfig[] = [
  {
    id: 'attack',
    label: 'Ataque',
    color: '#4FD1ED',
    lineStyle: 'solid',
    withArrow: true,
    strokeWidth: 3,
    glowWidth: 6,
    opacity: 0.96,
    icon: '➤',
  },
  {
    id: 'pass',
    label: 'Pase',
    color: '#FFFFFF',
    lineStyle: 'dashed',
    withArrow: false,
    strokeWidth: 3,
    glowWidth: 6,
    opacity: 0.95,
    icon: '⋯',
  },
  {
    id: 'rival',
    label: 'Rival',
    color: '#EF4444',
    lineStyle: 'solid',
    withArrow: true,
    strokeWidth: 3,
    glowWidth: 6,
    opacity: 0.95,
    icon: '➤',
  },
  {
    id: 'zone',
    label: 'Zona',
    color: '#FACC15',
    lineStyle: 'solid',
    withArrow: false,
    strokeWidth: 14,
    glowWidth: 20,
    opacity: 0.3,
    icon: '▮',
  },
];

type LineupPlayer = {
  id: number | string;
  name: string;
  pos?: string;
  photo?: string;
  rating?: number;
  energy?: number;
  coordinates: { top: string; left: string };
};

type BenchPlayer = Omit<LineupPlayer, 'coordinates'> & {
  coordinates?: { top: string; left: string };
};

type BoardOrientation = 'vertical' | 'horizontal';
type TacticalPhase = 'attack' | 'defense';

type SavedPhaseTactic = {
  order?: Array<{ top: string; left: string }>;
  byPlayerId?: Record<string, { top: string; left: string }>;
  lineup?: LineupPlayer[];
  bench?: BenchPlayer[];
};

type CustomTacticsMap = Partial<
  Record<
    string,
    {
      attack?: SavedPhaseTactic | Array<{ top: string; left: string }>;
      defense?: SavedPhaseTactic | Array<{ top: string; left: string }>;
    }
  >
>;

const pointsToSvgPath = (points: DrawPoint[]) => {
  if (points.length === 0) return '';
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
};

const filterJitterPoints = (points: DrawPoint[], minDistance = 2.2) => {
  if (points.length < 2) return points;

  const reduced = [points[0]];
  for (let index = 1; index < points.length; index += 1) {
    const current = points[index];
    const previous = reduced[reduced.length - 1];
    const deltaX = current.x - previous.x;
    const deltaY = current.y - previous.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    if (distance >= minDistance) {
      reduced.push(current);
    }
  }

  const last = points[points.length - 1];
  const tail = reduced[reduced.length - 1];
  if (tail.x !== last.x || tail.y !== last.y) {
    reduced.push(last);
  }

  return reduced;
};

const toSmoothPath = (points: DrawPoint[]) => {
  if (points.length === 0) return '';
  if (points.length < 3) return pointsToSvgPath(points);

  let smoothPath = `M ${points[0].x} ${points[0].y}`;

  for (let index = 1; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const midX = (current.x + next.x) / 2;
    const midY = (current.y + next.y) / 2;
    smoothPath += ` Q ${current.x} ${current.y} ${midX} ${midY}`;
  }

  const last = points[points.length - 1];
  smoothPath += ` L ${last.x} ${last.y}`;
  return smoothPath;
};

const getArrowHeadPoints = (points: DrawPoint[], size = 14, spread = Math.PI / 7) => {
  if (points.length < 2) return [];

  const tip = points[points.length - 1];
  let base = points[points.length - 2];

  for (let index = points.length - 2; index >= 0; index -= 1) {
    const candidate = points[index];
    const deltaX = tip.x - candidate.x;
    const deltaY = tip.y - candidate.y;
    const segmentLength = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    if (segmentLength > 0.5) {
      base = candidate;
      break;
    }
  }

  const angle = Math.atan2(tip.y - base.y, tip.x - base.x);
  const left = {
    x: tip.x - size * Math.cos(angle - spread),
    y: tip.y - size * Math.sin(angle - spread),
  };
  const right = {
    x: tip.x - size * Math.cos(angle + spread),
    y: tip.y - size * Math.sin(angle + spread),
  };

  return [left, tip, right];
};

const arrowPointsToPath = (points: DrawPoint[]) => {
  if (points.length !== 3) return '';
  return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y} L ${points[2].x} ${points[2].y}`;
};

const percentToNumber = (value: string, fallback = 50) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

const mirrorCoordinatesForFacing = (coordinates: { top: string; left: string }) => {
  const mirroredTop = 100 - percentToNumber(coordinates.top, 50);
  return {
    top: `${clampPercent(mirroredTop).toFixed(2)}%`,
    left: `${clampPercent(percentToNumber(coordinates.left, 50)).toFixed(2)}%`,
  };
};

const closestPlayerToPoint = (
  point: DrawPoint,
  players: Array<{ id: number | string; coordinates: { top: string; left: string } }>,
  width: number,
  height: number,
  maxDistance = Number.POSITIVE_INFINITY
) => {
  if (players.length === 0) return undefined;
  let nearestId: number | string | undefined;
  let minDistance = Number.POSITIVE_INFINITY;

  players.forEach((player) => {
    const playerX = (percentToNumber(player.coordinates.left) / 100) * width;
    const playerY = (percentToNumber(player.coordinates.top) / 100) * height;
    const deltaX = point.x - playerX;
    const deltaY = point.y - playerY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    if (distance < minDistance) {
      minDistance = distance;
      nearestId = player.id;
    }
  });

  if (minDistance > maxDistance) {
    return undefined;
  }

  return nearestId;
};

const mapDisplayToVerticalCoordinates = (
  coordinates: { top: string; left: string },
  orientation: BoardOrientation
) => {
  if (orientation === 'vertical') {
    return coordinates;
  }

  return {
    top: coordinates.left,
    left: coordinates.top,
  };
};

const mapCoordinatesByOrientationFallback = (
  coordinates: { top: string; left: string },
  orientation: BoardOrientation
) => {
  if (!coordinates || typeof coordinates.top !== 'string' || typeof coordinates.left !== 'string') {
    return { top: '50%', left: '50%' };
  }

  if (orientation !== 'horizontal') {
    return coordinates;
  }

  const topRaw = Number.parseFloat(coordinates.top);
  const leftRaw = Number.parseFloat(coordinates.left);
  const safeTop = Number.isFinite(topRaw) ? topRaw : 50;
  const safeLeft = Number.isFinite(leftRaw) ? leftRaw : 50;

  return {
    top: `${Math.max(8, Math.min(92, safeLeft)).toFixed(2)}%`,
    left: `${Math.max(8, Math.min(92, safeTop)).toFixed(2)}%`,
  };
};

const sameCoordinates = (
  first: { top: string; left: string } | undefined,
  second: { top: string; left: string } | undefined
) => {
  if (!first || !second) return false;
  return first.top === second.top && first.left === second.left;
};

const samePlayerOrderById = (
  first: Array<{ id: number | string }> | undefined,
  second: Array<{ id: number | string }> | undefined
) => {
  if (!first || !second) return false;
  if (first.length !== second.length) return false;

  for (let index = 0; index < first.length; index += 1) {
    if (String(first[index]?.id) !== String(second[index]?.id)) {
      return false;
    }
  }

  return true;
};

const isCustomFormationName = (formationName: string) =>
  CUSTOM_TACTIC_NAMES.includes(formationName as (typeof CUSTOM_TACTIC_NAMES)[number]);

const formationToId = (formationName: string) => {
  if (formationName === CUSTOM_TACTIC_NAME) return 'custom_1';
  if (formationName === CUSTOM_TACTIC_NAME_2) return 'custom_2';
  return `base_${formationName}`;
};

const customIdToFormation = (formationId: string) => {
  if (formationId === 'custom_1') return CUSTOM_TACTIC_NAME;
  if (formationId === 'custom_2') return CUSTOM_TACTIC_NAME_2;
  return null;
};

export default function BoardScreen() {
  const { width } = useWindowDimensions();
  const isCompact = width < 1024;
  const { team } = useLocalSearchParams<{ team: string }>();
  const resolvedTeamName = team && typeof team === 'string' ? team.trim().toLowerCase() : '';
  const initialTeam =
    TEAM_DATABASE.find((item) => item.name.toLowerCase() === resolvedTeamName) ?? TEAM_DATABASE[0];

  const [currentFormation, setCurrentFormation] = useState<string>(initialTeam.defaultFormation);
  const [activeFormationId, setActiveFormationId] = useState<string>(formationToId(initialTeam.defaultFormation));
  const [fieldAreaSize, setFieldAreaSize] = useState({ width: 0, height: 0 });
  const pitchGlowRef = useRef<View | null>(null);
  const [pitchWindowBounds, setPitchWindowBounds] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [isFreeDrawMode, setIsFreeDrawMode] = useState(false);
  const [drawPaths, setDrawPaths] = useState<DrawPathShape[]>([]);
  const [activeDrawPoints, setActiveDrawPoints] = useState<DrawPoint[]>([]);
  const [activeToolId, setActiveToolId] = useState<DrawToolId>('attack');
  const [orientation, setOrientation] = useState<BoardOrientation>('vertical');
  const [phase, setPhase] = useState<TacticalPhase>('defense');
  const [customTactics, setCustomTactics] = useState<CustomTacticsMap>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedLeague, setSelectedLeague] = useState<LeagueKey>(DEFAULT_LEAGUE_FILTER);
  const [activeTeamId, setActiveTeamId] = useState<number | null>(initialTeam.id);
  const [rivalTeamId, setRivalTeamId] = useState<number | null>(null);
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [compareFormation, setCompareFormation] = useState<string>(initialTeam.defaultFormation);
  const [comparePhase, setComparePhase] = useState<TacticalPhase>('defense');
  const [compareWithRival, setCompareWithRival] = useState(false);
  const [showRivalNames, setShowRivalNames] = useState(false);
  const [isAutoTracking, setIsAutoTracking] = useState(true);
  const [rivalTrackingOffsets, setRivalTrackingOffsets] = useState<Record<string, { x: number; y: number }>>({});
  const [activeTrackingLine, setActiveTrackingLine] = useState<{
    teamPlayerId: string;
    rivalPlayerId: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);
  const dragAnchorRef = useRef<Record<string, { x: number; y: number }>>({});
  const activeMatchByTeamRef = useRef<Record<string, string | undefined>>({});
  const [teamsList, setTeamsList] = useState<TeamDatabaseItem[]>(() => TEAMS_BY_LEAGUE[DEFAULT_LEAGUE_FILTER] ?? []);
  const [cachedLeagues, setCachedLeagues] = useState<Partial<Record<LeagueKey, TeamDatabaseItem[]>>>(() => ({
    [DEFAULT_LEAGUE_FILTER]: TEAMS_BY_LEAGUE[DEFAULT_LEAGUE_FILTER],
  }));
  const [isLeagueLoading, setIsLeagueLoading] = useState(false);
  const [isExternalSearchLoading, setIsExternalSearchLoading] = useState(false);
  const [externalSearchResults, setExternalSearchResults] = useState<TeamDatabaseItem[] | null>(null);
  const pulseAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 650,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.45,
          duration: 650,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
    return () => {
      loop.stop();
    };
  }, [pulseAnim]);

  const leagues = useMemo(
    () => (Object.keys(TEAMS_BY_LEAGUE) as LeagueKey[]).filter((leagueKey) => leagueKey !== DEFAULT_LEAGUE_FILTER),
    []
  );

  useEffect(() => {
    setExternalSearchResults(null);
  }, [debouncedSearchQuery, selectedLeague]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const selectedTeam = activeTeamId ? TEAM_DATABASE.find((item) => item.id === activeTeamId) ?? null : null;
    const teamStorageId = String(selectedTeam?.fixtureId ?? activeTeamId ?? 'default');

    try {
      const nextCustomTactics: CustomTacticsMap = {};
      const customOneRaw = localStorage.getItem(`team_${teamStorageId}_custom_1`);
      const customTwoRaw = localStorage.getItem(`team_${teamStorageId}_custom_2`);

      if (customOneRaw) {
        const parsedCustomOne = JSON.parse(customOneRaw) as CustomTacticsMap[string];
        if (parsedCustomOne && typeof parsedCustomOne === 'object') {
          nextCustomTactics[CUSTOM_TACTIC_NAME] = parsedCustomOne;
        }
      }

      if (customTwoRaw) {
        const parsedCustomTwo = JSON.parse(customTwoRaw) as CustomTacticsMap[string];
        if (parsedCustomTwo && typeof parsedCustomTwo === 'object') {
          nextCustomTactics[CUSTOM_TACTIC_NAME_2] = parsedCustomTwo;
        }
      }

      setCustomTactics(nextCustomTactics);
    } catch {
      setCustomTactics({});
    }
  }, [activeTeamId]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const selectedTeam = activeTeamId ? TEAM_DATABASE.find((item) => item.id === activeTeamId) ?? null : null;
    const teamStorageId = String(selectedTeam?.fixtureId ?? activeTeamId ?? 'default');

    try {
      const customOne = customTactics[CUSTOM_TACTIC_NAME];
      if (customOne) {
        localStorage.setItem(`team_${teamStorageId}_custom_1`, JSON.stringify(customOne));
      } else {
        localStorage.removeItem(`team_${teamStorageId}_custom_1`);
      }

      const customTwo = customTactics[CUSTOM_TACTIC_NAME_2];
      if (customTwo) {
        localStorage.setItem(`team_${teamStorageId}_custom_2`, JSON.stringify(customTwo));
      } else {
        localStorage.removeItem(`team_${teamStorageId}_custom_2`);
      }
    } catch {
      return;
    }
  }, [activeTeamId, customTactics]);

  const leagueOptions = useMemo(
    () =>
      leagues
        .map((league) => {
          const leagueTeam = TEAM_DATABASE.find((item) => item.league === league);
          return {
            league,
            leagueLogo: leagueTeam?.leagueLogo ?? '',
          };
        }),
    [leagues]
  );

  const normalizedQuery = debouncedSearchQuery.trim().toLowerCase();

  const localSearchMatches = useMemo(() => {
    if (normalizedQuery.length === 0) return [];
    return teamsList.filter(
      (item) =>
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.league.toLowerCase().includes(normalizedQuery)
    );
  }, [normalizedQuery, teamsList]);

  const displayedTeams = useMemo(() => {
    if (normalizedQuery.length === 0) {
      return teamsList;
    }

    if (localSearchMatches.length > 0) {
      return localSearchMatches;
    }

    return externalSearchResults ?? [];
  }, [externalSearchResults, localSearchMatches, normalizedQuery, teamsList]);

  const shouldShowSearchMoreButton =
    normalizedQuery.length > 0 &&
    localSearchMatches.length === 0 &&
    !isExternalSearchLoading &&
    externalSearchResults === null;

  const shouldShowNoExternalResults =
    normalizedQuery.length > 0 &&
    localSearchMatches.length === 0 &&
    !isExternalSearchLoading &&
    Array.isArray(externalSearchResults) &&
    externalSearchResults.length === 0;

  const selectTeam = (teamItem: TeamDatabaseItem) => {
    if (isCompareMode && compareWithRival && activeTeamId && teamItem.id !== activeTeamId) {
      setRivalTeamId(teamItem.id);
      return;
    }

    setActiveTeamId(teamItem.id);
    setRivalTeamId(null);
    setCurrentFormation(teamItem.defaultFormation);
    setActiveFormationId(formationToId(teamItem.defaultFormation));
    setCompareFormation(teamItem.defaultFormation);
  };

  const handleLeagueChange = (league: LeagueKey) => {
    if (league === selectedLeague) {
      setSearchQuery('');
      setDebouncedSearchQuery('');
      return;
    }

    setSelectedLeague(league);
    setSearchQuery('');
    setDebouncedSearchQuery('');

    const existing = cachedLeagues[league];
    if (existing) {
      setTeamsList(existing);
      return;
    }

    setIsLeagueLoading(true);
    setTimeout(() => {
      const nextTeams = TEAMS_BY_LEAGUE[league] ?? [];
      setCachedLeagues((previous) => ({
        ...previous,
        [league]: nextTeams,
      }));
      setTeamsList(nextTeams);
      setIsLeagueLoading(false);
    }, 1500);
  };

  const handleSearchMoreTeams = () => {
    if (normalizedQuery.length === 0) return;

    setIsExternalSearchLoading(true);
    setTimeout(() => {
      const localIds = new Set(teamsList.map((team) => team.id));
      const externalMatches = TEAM_DATABASE.filter(
        (item) =>
          !localIds.has(item.id) &&
          (item.name.toLowerCase().includes(normalizedQuery) || item.league.toLowerCase().includes(normalizedQuery))
      );

      setExternalSearchResults(externalMatches);
      setIsExternalSearchLoading(false);
    }, 1500);
  };

  useEffect(() => {
    if (!isCompareMode) {
      setCompareWithRival(false);
      setRivalTeamId(null);
      setShowRivalNames(false);
      return;
    }

    if (!compareWithRival) {
      setRivalTeamId(null);
      setShowRivalNames(false);
    }
  }, [compareWithRival, isCompareMode]);

  const activeTeam = activeTeamId ? TEAM_DATABASE.find((item) => item.id === activeTeamId) ?? null : null;
  const rivalTeam = rivalTeamId ? TEAM_DATABASE.find((item) => item.id === rivalTeamId) ?? null : null;
  const shouldShowCurrentSelection =
    !!activeTeam &&
    selectedLeague !== DEFAULT_LEAGUE_FILTER &&
    activeTeam.league !== selectedLeague;

  const tacticsHook = useFootballTactics as (options?: {
    fixtureId?: string;
    developmentMode?: boolean;
    defaultFormation?: string;
    skip?: boolean;
  }) => {
    data: {
      lineups?: Array<{
        formation?: string;
        players?: Array<{
          id: number | string;
          name: string;
          pos?: string;
          photo?: string;
          rating?: number;
          energy?: number;
          coordinates: { top: string; left: string };
        }>;
        benchPlayers?: Array<{
          id: number | string;
          name: string;
          pos?: string;
          photo?: string;
          rating?: number;
          energy?: number;
        }>;
      }>;
    } | null;
    loading: boolean;
  };

  const { data, loading } = tacticsHook({
    fixtureId: activeTeam?.fixtureId,
    defaultFormation: activeTeam?.defaultFormation,
  });
  const { data: rivalData, loading: rivalLoading } = tacticsHook({
    fixtureId: rivalTeam?.fixtureId,
    defaultFormation: rivalTeam?.defaultFormation,
    skip: !isCompareMode || !compareWithRival || !rivalTeam,
  });
  const activeLiveFormation = data?.lineups?.[0]?.formation ?? activeTeam?.defaultFormation ?? currentFormation;
  const rivalLiveFormation = rivalData?.lineups?.[0]?.formation ?? rivalTeam?.defaultFormation ?? compareFormation;
  const shouldMirrorRivalFormation =
    isCompareMode &&
    compareWithRival &&
    !!rivalTeam &&
    String(activeLiveFormation || '').trim().toLowerCase() === String(rivalLiveFormation || '').trim().toLowerCase();
  const lineupPlayers = useMemo(
    () => (data?.lineups?.[0]?.players ?? []) as LineupPlayer[],
    [data]
  );
  const lineupBenchPlayers = useMemo(
    () => (data?.lineups?.[0]?.benchPlayers ?? []) as BenchPlayer[],
    [data]
  );
  const rivalLineupPlayers = useMemo(
    () => (rivalData?.lineups?.[0]?.players ?? []) as LineupPlayer[],
    [rivalData]
  );
  const [boardPlayers, setBoardPlayers] = useState<LineupPlayer[]>([]);
  const [benchPlayers, setBenchPlayers] = useState<BenchPlayer[]>([]);

  const refreshPitchWindowBounds = useCallback(() => {
    if (!pitchGlowRef.current || typeof pitchGlowRef.current.measureInWindow !== 'function') {
      return;
    }

    pitchGlowRef.current.measureInWindow((x, y, width, height) => {
      if (![x, y, width, height].every((value) => Number.isFinite(value))) {
        return;
      }

      setPitchWindowBounds((previous) => {
        if (previous.x === x && previous.y === y && previous.width === width && previous.height === height) {
          return previous;
        }

        return { x, y, width, height };
      });
    });
  }, []);

  useEffect(() => {
    setBoardPlayers([]);
    setBenchPlayers([]);
  }, [activeTeamId]);

  useEffect(() => {
    if (loading) {
      setBoardPlayers([]);
      setBenchPlayers([]);
      return;
    }
    setBoardPlayers(lineupPlayers);
    setBenchPlayers(lineupBenchPlayers);
  }, [lineupBenchPlayers, loading, lineupPlayers]);

  const resolvedPresetCoordinates = useMemo(() => {
    const customForFormation = customTactics[currentFormation]?.[phase];
    if (Array.isArray(customForFormation) && customForFormation.length > 0) {
      return customForFormation;
    }

    if (customForFormation && !Array.isArray(customForFormation)) {
      const byPlayerId = customForFormation.byPlayerId ?? {};
      const basePlayers = lineupPlayers;
      const mappedById = basePlayers.map((player) => byPlayerId[String(player.id)]).filter(Boolean) as Array<{
        top: string;
        left: string;
      }>;

      if (mappedById.length === basePlayers.length && mappedById.length > 0) {
        return mappedById;
      }

      if (customForFormation.order && customForFormation.order.length > 0) {
        return customForFormation.order;
      }
    }

    const formationPhase = FORMATION_PHASES[currentFormation]?.[phase] ?? FORMATION_PHASES['4-4-2']?.[phase] ?? [];
    return formationPhase.map((position) => ({
      top: `${(position.y * 100).toFixed(2)}%`,
      left: `${(position.x * 100).toFixed(2)}%`,
    }));
  }, [currentFormation, customTactics, lineupPlayers, phase]);

  const resolvedPresetLineup = useMemo(() => {
    const customForFormation = customTactics[currentFormation]?.[phase];
    if (!customForFormation || Array.isArray(customForFormation)) {
      return null;
    }

    return Array.isArray(customForFormation.lineup) && customForFormation.lineup.length > 0
      ? customForFormation.lineup
      : null;
  }, [currentFormation, customTactics, phase]);

  const resolvedPresetBench = useMemo(() => {
    const customForFormation = customTactics[currentFormation]?.[phase];
    if (!customForFormation || Array.isArray(customForFormation)) {
      return null;
    }

    return Array.isArray(customForFormation.bench) ? customForFormation.bench : null;
  }, [currentFormation, customTactics, phase]);

  const formationOptions = useMemo(() => [...BASE_FORMATION_OPTIONS], []);
  const compareFormationOptions = useMemo(() => {
    const customOptions = CUSTOM_TACTIC_NAMES.filter((name) =>
      !!customTactics[name]?.attack || !!customTactics[name]?.defense
    );
    return [...BASE_FORMATION_OPTIONS, ...customOptions];
  }, [customTactics]);

  useEffect(() => {
    setBoardPlayers((previousPlayers) => {
      const sourcePlayers =
        isCustomFormationName(currentFormation) && resolvedPresetLineup && resolvedPresetLineup.length > 0
          ? resolvedPresetLineup
          : previousPlayers.length > 0
          ? previousPlayers
          : lineupPlayers;
      if (sourcePlayers.length === 0) return sourcePlayers;

      const nextPlayers = sourcePlayers.map((player, index) => ({
        ...player,
        coordinates: resolvedPresetCoordinates[index] ?? player.coordinates,
      }));

      const hasRealChange =
        !samePlayerOrderById(nextPlayers, sourcePlayers) ||
        nextPlayers.some(
          (player, index) =>
            String(player.id) !== String(sourcePlayers[index]?.id) ||
            !sameCoordinates(player.coordinates, sourcePlayers[index]?.coordinates)
        );
      return hasRealChange ? nextPlayers : sourcePlayers;
    });
  }, [currentFormation, lineupPlayers, phase, resolvedPresetCoordinates, resolvedPresetLineup]);

  useEffect(() => {
    if (!isCustomFormationName(currentFormation) || !resolvedPresetBench) {
      return;
    }

    setBenchPlayers((previousBench) => {
      if (samePlayerOrderById(previousBench, resolvedPresetBench)) {
        return previousBench;
      }
      return resolvedPresetBench;
    });
  }, [currentFormation, resolvedPresetBench]);

  useEffect(() => {
    setDrawPaths([]);
    setActiveDrawPoints([]);
  }, [orientation]);

  const mapCoordinatesForOrientation = useCallback(
    (coordinates: { top: string; left: string }) => mapCoordinatesByOrientationFallback(coordinates, orientation),
    [orientation]
  );

  const comparePresetCoordinates = useMemo(() => {
    if (!isCompareMode) return [] as Array<{ top: string; left: string }>;

    const compareCustom = customTactics[compareFormation]?.[comparePhase];
    if (compareCustom && !Array.isArray(compareCustom)) {
      if (Array.isArray(compareCustom.order) && compareCustom.order.length > 0) {
        return compareCustom.order;
      }
      if (Array.isArray(compareCustom.lineup) && compareCustom.lineup.length > 0) {
        return compareCustom.lineup.map((player) => player.coordinates);
      }
    }

    const fallbackPhase = FORMATION_PHASES[compareFormation]?.[comparePhase] ?? FORMATION_PHASES['4-4-2']?.[comparePhase] ?? [];
    return fallbackPhase.map((position) => ({
      top: `${(position.y * 100).toFixed(2)}%`,
      left: `${(position.x * 100).toFixed(2)}%`,
    }));
  }, [compareFormation, comparePhase, customTactics, isCompareMode]);

  const orientedPlayers = useMemo(
    () =>
      boardPlayers.map((player) => ({
        ...player,
        coordinates: mapCoordinatesForOrientation(player.coordinates),
      })),
    [boardPlayers, mapCoordinatesForOrientation]
  );

  const compareGhostPlayers = useMemo(
    () =>
      comparePresetCoordinates.map((coordinates, index) => {
        const referencePlayer = boardPlayers[index];
        return {
          id: `ghost-${index}`,
          name: referencePlayer?.name ?? `P${index + 1}`,
          pos: referencePlayer?.pos ?? 'M',
          coordinates: mapCoordinatesForOrientation(coordinates),
        };
      }),
    [boardPlayers, comparePresetCoordinates, mapCoordinatesForOrientation]
  );

  const rivalOverlayPlayers = useMemo(
    () =>
      rivalLineupPlayers.map((player, index) => ({
        ...player,
        markerText: (player.pos || '').trim().charAt(0).toUpperCase() || `${index + 1}`,
        id: `rival-${String(player.id ?? index)}`,
        coordinates: mapCoordinatesForOrientation(
          shouldMirrorRivalFormation ? mirrorCoordinatesForFacing(player.coordinates) : player.coordinates
        ),
      })),
    [mapCoordinatesForOrientation, rivalLineupPlayers, shouldMirrorRivalFormation]
  );

  const hasLineupData = !!activeTeam && !loading && orientedPlayers.length > 0;

  const pitchRatio = orientation === 'horizontal' ? 68 / 105 : 1.48;
  const availableWidth = Math.max(0, fieldAreaSize.width - 16);
  const availableHeight = Math.max(0, fieldAreaSize.height - 16);
  const widthByHeight = availableHeight / pitchRatio;
  const pitchWidth = Math.max(220, Math.min(availableWidth, widthByHeight || availableWidth));
  const pitchHeight = pitchWidth * pitchRatio;

  const pitchStripeCount = 12;
  const pitchStripeHeight = pitchHeight / pitchStripeCount;
  const lineColor = '#F1F8F3';
  const lineShadowOpacity = 0.14;
  const lineMainOpacity = 0.78;
  const pitchMargin = 12;
  const centerX = pitchWidth / 2;
  const centerY = pitchHeight / 2;
  const fieldWidth = pitchWidth - pitchMargin * 2;
  const fieldHeight = pitchHeight - pitchMargin * 2;
  const centerCircleRadius = Math.min(fieldWidth, fieldHeight) * 0.12;

  const verticalPenaltyAreaWidth = fieldWidth * 0.6;
  const verticalPenaltyAreaDepth = fieldHeight * 0.16;
  const verticalGoalAreaWidth = fieldWidth * 0.24;
  const verticalGoalAreaDepth = fieldHeight * 0.055;
  const verticalPenaltySpotOffset = fieldHeight * 0.11;
  const verticalPenaltyArcRadius = fieldHeight * 0.087;

  const horizontalPenaltyAreaDepth = fieldWidth * 0.16;
  const horizontalPenaltyAreaWidth = fieldHeight * 0.6;
  const horizontalGoalAreaDepth = fieldWidth * 0.055;
  const horizontalGoalAreaWidth = fieldHeight * 0.24;
  const horizontalPenaltySpotOffset = fieldWidth * 0.11;
  const horizontalPenaltyArcRadius = fieldWidth * 0.087;

  const penaltyAreaWidth = fieldWidth * 0.6;
  const penaltyAreaDepth = fieldHeight * 0.16;
  const goalAreaWidth = fieldWidth * 0.24;
  const goalAreaDepth = fieldHeight * 0.055;
  const penaltySpotOffset = fieldHeight * 0.11;
  const penaltyArcRadius = fieldHeight * 0.087;
  const cornerArcRadius = Math.max(14, Math.min(26, fieldWidth * 0.045));
  const topPenaltySpotY = pitchMargin + penaltySpotOffset;
  const topPenaltyLineY = pitchMargin + penaltyAreaDepth;
  const bottomPenaltySpotY = pitchMargin + fieldHeight - penaltySpotOffset;
  const bottomPenaltyLineY = pitchMargin + fieldHeight - penaltyAreaDepth;
  const arcDyTop = topPenaltyLineY - topPenaltySpotY;
  const arcDxTop = Math.sqrt(Math.max(0, penaltyArcRadius * penaltyArcRadius - arcDyTop * arcDyTop));
  const arcDyBottom = bottomPenaltySpotY - bottomPenaltyLineY;
  const arcDxBottom = Math.sqrt(Math.max(0, penaltyArcRadius * penaltyArcRadius - arcDyBottom * arcDyBottom));
  const goalWidth = goalAreaWidth * 0.4;
  const goalDepth = 10;
  const goalX = (pitchWidth - goalWidth) / 2;

  const leftPenaltySpotX = pitchMargin + horizontalPenaltySpotOffset;
  const leftPenaltyLineX = pitchMargin + horizontalPenaltyAreaDepth;
  const rightPenaltySpotX = pitchMargin + fieldWidth - horizontalPenaltySpotOffset;
  const rightPenaltyLineX = pitchMargin + fieldWidth - horizontalPenaltyAreaDepth;
  const arcDxLeft = leftPenaltyLineX - leftPenaltySpotX;
  const arcDyLeft = Math.sqrt(
    Math.max(0, horizontalPenaltyArcRadius * horizontalPenaltyArcRadius - arcDxLeft * arcDxLeft)
  );
  const arcDxRight = rightPenaltySpotX - rightPenaltyLineX;
  const arcDyRight = Math.sqrt(
    Math.max(0, horizontalPenaltyArcRadius * horizontalPenaltyArcRadius - arcDxRight * arcDxRight)
  );
  const horizontalGoalSpan = horizontalGoalAreaWidth * 0.4;
  const horizontalGoalY = (pitchHeight - horizontalGoalSpan) / 2;
  const magneticSnapRadius = Math.max(28, Math.min(58, Math.min(pitchWidth, pitchHeight) * 0.08));

  const rivalBasePositionById = useMemo(() => {
    const positionMap = new Map<string, { x: number; y: number; coordinates: { top: string; left: string } }>();
    rivalOverlayPlayers.forEach((player) => {
      const key = String(player.id);
      positionMap.set(key, {
        x: (percentToNumber(player.coordinates.left) / 100) * pitchWidth,
        y: (percentToNumber(player.coordinates.top) / 100) * pitchHeight,
        coordinates: player.coordinates,
      });
    });
    return positionMap;
  }, [pitchHeight, pitchWidth, rivalOverlayPlayers]);

  const rivalTrackedOverlayPlayers = useMemo(
    () =>
      rivalOverlayPlayers.map((player) => {
        const key = String(player.id);
        const basePoint = rivalBasePositionById.get(key);
        if (!basePoint) {
          return player;
        }

        const offset = rivalTrackingOffsets[key];
        const nextX = basePoint.x + (offset?.x ?? 0);
        const nextY = basePoint.y + (offset?.y ?? 0);

        const clampedX = Math.max(0, Math.min(pitchWidth, nextX));
        const clampedY = Math.max(0, Math.min(pitchHeight, nextY));

        return {
          ...player,
          coordinates: {
            top: `${((clampedY / Math.max(1, pitchHeight)) * 100).toFixed(2)}%`,
            left: `${((clampedX / Math.max(1, pitchWidth)) * 100).toFixed(2)}%`,
          },
        };
      }),
    [pitchHeight, pitchWidth, rivalBasePositionById, rivalOverlayPlayers, rivalTrackingOffsets]
  );

  const handlePlayerDragStateChange = useCallback(
    (playerId: number | string, isDragging: boolean) => {
      const teamKey = String(playerId);
      if (!isDragging) {
        delete dragAnchorRef.current[teamKey];
        delete activeMatchByTeamRef.current[teamKey];
        setActiveTrackingLine((previous) => (previous?.teamPlayerId === teamKey ? null : previous));
        return;
      }

      const player = orientedPlayers.find((item) => String(item.id) === teamKey);
      if (!player) {
        return;
      }

      dragAnchorRef.current[teamKey] = {
        x: (percentToNumber(player.coordinates.left) / 100) * pitchWidth,
        y: (percentToNumber(player.coordinates.top) / 100) * pitchHeight,
      };
    },
    [orientedPlayers, pitchHeight, pitchWidth]
  );

  const handlePlayerPositionDrag = useCallback(
    (playerId: number | string, coordinates: { top: string; left: string }) => {
      if (!isAutoTracking || !isCompareMode || !compareWithRival || !rivalTeam || rivalLoading) {
        return;
      }

      const teamKey = String(playerId);
      const nextX = (percentToNumber(coordinates.left) / 100) * pitchWidth;
      const nextY = (percentToNumber(coordinates.top) / 100) * pitchHeight;

      const previousPoint = dragAnchorRef.current[teamKey] ?? { x: nextX, y: nextY };
      const deltaX = nextX - previousPoint.x;
      const deltaY = nextY - previousPoint.y;
      dragAnchorRef.current[teamKey] = { x: nextX, y: nextY };

      if (Math.abs(deltaX) < 0.01 && Math.abs(deltaY) < 0.01) {
        return;
      }

      let nearestId: string | undefined;
      let nearestDistance = Number.POSITIVE_INFINITY;

      rivalTrackedOverlayPlayers.forEach((rival) => {
        const rivalX = (percentToNumber(rival.coordinates.left) / 100) * pitchWidth;
        const rivalY = (percentToNumber(rival.coordinates.top) / 100) * pitchHeight;
        const dx = nextX - rivalX;
        const dy = nextY - rivalY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestId = String(rival.id);
        }
      });

      const trackingLimit = 100;
      const previouslyMatched = activeMatchByTeamRef.current[teamKey];

      if (!nearestId || nearestDistance > trackingLimit) {
        if (previouslyMatched) {
          setRivalTrackingOffsets((previous) => {
            const next = { ...previous };
            delete next[previouslyMatched];
            return next;
          });
        }
        delete activeMatchByTeamRef.current[teamKey];
        setActiveTrackingLine((previous) => (previous?.teamPlayerId === teamKey ? null : previous));
        return;
      }

      if (previouslyMatched && previouslyMatched !== nearestId) {
        setRivalTrackingOffsets((previous) => {
          const next = { ...previous };
          delete next[previouslyMatched];
          return next;
        });
      }

      activeMatchByTeamRef.current[teamKey] = nearestId;

      const followFactor = 0.3;
      const basePoint = rivalBasePositionById.get(nearestId);
      if (!basePoint) {
        return;
      }

      setRivalTrackingOffsets((previous) => {
        const currentOffset = previous[nearestId!] ?? { x: 0, y: 0 };
        const nextOffsetX = currentOffset.x + deltaX * followFactor;
        const nextOffsetY = currentOffset.y + deltaY * followFactor;

        const boundedX = Math.max(-basePoint.x, Math.min(pitchWidth - basePoint.x, nextOffsetX));
        const boundedY = Math.max(-basePoint.y, Math.min(pitchHeight - basePoint.y, nextOffsetY));

        return {
          ...previous,
          [nearestId!]: {
            x: boundedX,
            y: boundedY,
          },
        };
      });

      const currentOffset = rivalTrackingOffsets[nearestId] ?? { x: 0, y: 0 };
      setActiveTrackingLine({
        teamPlayerId: teamKey,
        rivalPlayerId: nearestId,
        x1: nextX,
        y1: nextY,
        x2: basePoint.x + currentOffset.x + deltaX * followFactor,
        y2: basePoint.y + currentOffset.y + deltaY * followFactor,
      });
    },
    [
      compareWithRival,
      isAutoTracking,
      isCompareMode,
      pitchHeight,
      pitchWidth,
      rivalBasePositionById,
      rivalLoading,
      rivalTeam,
      rivalTrackedOverlayPlayers,
      rivalTrackingOffsets,
    ]
  );

  useEffect(() => {
    if (!isCompareMode || !compareWithRival || !isAutoTracking) {
      setRivalTrackingOffsets({});
      setActiveTrackingLine(null);
      activeMatchByTeamRef.current = {};
      dragAnchorRef.current = {};
    }
  }, [compareWithRival, isAutoTracking, isCompareMode]);

  useEffect(() => {
    setRivalTrackingOffsets({});
    setActiveTrackingLine(null);
    activeMatchByTeamRef.current = {};
    dragAnchorRef.current = {};
  }, [activeTeamId, rivalTeamId, shouldMirrorRivalFormation]);
  const compareInsights = useMemo(() => {
    if (!isCompareMode || !compareWithRival || !rivalTeam || rivalLoading) {
      return {
        pairingLines: [] as Array<{ id: string; x1: number; y1: number; x2: number; y2: number }>,
        superiorityZones: [] as Array<{ id: string; x: number; y: number; radius: number }>,
        dangerZones: [] as Array<{ id: string; x: number; y: number }>,
      };
    }

    const teamPoints = orientedPlayers.map((player, index) => ({
      id: `team-${player.id ?? index}`,
      x: (percentToNumber(player.coordinates.left) / 100) * pitchWidth,
      y: (percentToNumber(player.coordinates.top) / 100) * pitchHeight,
    }));

    const rivalPoints = rivalTrackedOverlayPlayers.map((player, index) => ({
      id: `rival-${player.id ?? index}`,
      x: (percentToNumber(player.coordinates.left) / 100) * pitchWidth,
      y: (percentToNumber(player.coordinates.top) / 100) * pitchHeight,
    }));

    if (teamPoints.length === 0 || rivalPoints.length === 0) {
      return {
        pairingLines: [] as Array<{ id: string; x1: number; y1: number; x2: number; y2: number }>,
        superiorityZones: [] as Array<{ id: string; x: number; y: number; radius: number }>,
        dangerZones: [] as Array<{ id: string; x: number; y: number }>,
      };
    }

    const pairingLines = teamPoints.map((teamPoint) => {
      let nearest = rivalPoints[0];
      let nearestDistance = Number.POSITIVE_INFINITY;

      rivalPoints.forEach((rivalPoint) => {
        const dx = teamPoint.x - rivalPoint.x;
        const dy = teamPoint.y - rivalPoint.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = rivalPoint;
        }
      });

      return {
        id: `${teamPoint.id}-${nearest.id}`,
        x1: teamPoint.x,
        y1: teamPoint.y,
        x2: nearest.x,
        y2: nearest.y,
      };
    });

    const superiorityRadius = Math.min(pitchWidth, pitchHeight) * 0.16;
    const superiorityZones = rivalPoints
      .map((rivalPoint, rivalIndex) => {
        const closeTeamPlayers = teamPoints.filter((teamPoint) => {
          const dx = teamPoint.x - rivalPoint.x;
          const dy = teamPoint.y - rivalPoint.y;
          return Math.sqrt(dx * dx + dy * dy) <= superiorityRadius;
        });

        if (closeTeamPlayers.length < 2) {
          return null;
        }

        const centroid = closeTeamPlayers.reduce(
          (accumulator, teamPoint) => ({
            x: accumulator.x + teamPoint.x,
            y: accumulator.y + teamPoint.y,
          }),
          { x: 0, y: 0 }
        );

        return {
          id: `sup-${rivalIndex}`,
          x: centroid.x / closeTeamPlayers.length,
          y: centroid.y / closeTeamPlayers.length,
          radius: Math.max(18, Math.min(30, superiorityRadius * 0.44)),
        };
      })
      .filter(Boolean) as Array<{ id: string; x: number; y: number; radius: number }>;

    const dangerThreshold = Math.min(pitchWidth, pitchHeight) * 0.3;
    const dangerCandidates: Array<{ id: string; x: number; y: number; distance: number }> = [];
    for (let i = 0; i < rivalPoints.length; i += 1) {
      for (let j = i + 1; j < rivalPoints.length; j += 1) {
        const first = rivalPoints[i];
        const second = rivalPoints[j];
        const dx = first.x - second.x;
        const dy = first.y - second.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance >= dangerThreshold) {
          dangerCandidates.push({
            id: `danger-${i}-${j}`,
            x: (first.x + second.x) / 2,
            y: (first.y + second.y) / 2,
            distance,
          });
        }
      }
    }

    const minDangerSpacing = Math.min(pitchWidth, pitchHeight) * 0.18;
    const dangerZones = dangerCandidates
      .sort((a, b) => b.distance - a.distance)
      .reduce<Array<{ id: string; x: number; y: number }>>((accumulator, candidate) => {
        if (accumulator.length >= 2) {
          return accumulator;
        }

        const isTooClose = accumulator.some((existing) => {
          const dx = existing.x - candidate.x;
          const dy = existing.y - candidate.y;
          return Math.sqrt(dx * dx + dy * dy) < minDangerSpacing;
        });

        if (isTooClose) {
          return accumulator;
        }

        accumulator.push({ id: candidate.id, x: candidate.x, y: candidate.y });
        return accumulator;
      }, []);

    return {
      pairingLines,
      superiorityZones,
      dangerZones,
    };
  }, [
    compareWithRival,
    isCompareMode,
    orientedPlayers,
    pitchHeight,
    pitchWidth,
    rivalLoading,
    rivalTrackedOverlayPlayers,
    rivalTeam,
  ]);
  const hasAnchoredDrawPaths = useMemo(
    () => drawPaths.some((drawPath) => !!drawPath.anchor?.startPlayerId && !!drawPath.anchor?.endPlayerId),
    [drawPaths]
  );

  const playerDisplayIndexById = useMemo(() => {
    if (!hasAnchoredDrawPaths) {
      return new Map<number | string, { x: number; y: number }>();
    }

    const map = new Map<number | string, { x: number; y: number }>();
    orientedPlayers.forEach((player) => {
      map.set(player.id, {
        x: (percentToNumber(player.coordinates.left) / 100) * pitchWidth,
        y: (percentToNumber(player.coordinates.top) / 100) * pitchHeight,
      });
    });
    return map;
  }, [hasAnchoredDrawPaths, orientedPlayers, pitchHeight, pitchWidth]);

  const renderedDrawPaths = useMemo(() => {
    if (!hasAnchoredDrawPaths) {
      return drawPaths.map((drawPath) => ({
        ...drawPath,
        renderedPoints: drawPath.points,
      }));
    }

    return drawPaths.map((drawPath) => {
      if (!drawPath.anchor?.startPlayerId || !drawPath.anchor?.endPlayerId) {
        return {
          ...drawPath,
          renderedPoints: drawPath.points,
        };
      }

      const startCurrent = playerDisplayIndexById.get(drawPath.anchor.startPlayerId);
      const endCurrent = playerDisplayIndexById.get(drawPath.anchor.endPlayerId);

      if (!startCurrent || !endCurrent) {
        return {
          ...drawPath,
          renderedPoints: drawPath.points,
        };
      }

      const startDx = startCurrent.x - drawPath.anchor.startPoint.x;
      const startDy = startCurrent.y - drawPath.anchor.startPoint.y;
      const endDx = endCurrent.x - drawPath.anchor.endPoint.x;
      const endDy = endCurrent.y - drawPath.anchor.endPoint.y;
      const maxIndex = Math.max(1, drawPath.points.length - 1);

      const adjusted = drawPath.points.map((point, index) => {
        const factor = index / maxIndex;
        const nextDx = startDx * (1 - factor) + endDx * factor;
        const nextDy = startDy * (1 - factor) + endDy * factor;
        return {
          x: point.x + nextDx,
          y: point.y + nextDy,
        };
      });

      return {
        ...drawPath,
        renderedPoints: adjusted,
      };
    });
  }, [drawPaths, hasAnchoredDrawPaths, playerDisplayIndexById]);

  const renderedDrawArtifacts = useMemo(
    () =>
      renderedDrawPaths.map((drawPath) => {
        const pathD = toSmoothPath(drawPath.renderedPoints);
        const arrowHead = drawPath.withArrow ? getArrowHeadPoints(drawPath.renderedPoints) : [];
        return {
          drawPath,
          pathD,
          arrowHead,
        };
      }),
    [renderedDrawPaths]
  );

  const handlePlayerPositionChange = useCallback((playerId: number | string, coordinates: { top: string; left: string }) => {
    const verticalCoordinates = mapDisplayToVerticalCoordinates(coordinates, orientation);
    setBoardPlayers((previousPlayers) =>
      previousPlayers.map((player) =>
        player.id === playerId
          ? {
              ...player,
              coordinates: verticalCoordinates,
            }
          : player
      )
    );
  }, [orientation]);

  const captureCurrentFormation = useCallback((): SavedPhaseTactic => {
    const byPlayerId = boardPlayers.reduce<Record<string, { top: string; left: string }>>((accumulator, player) => {
      accumulator[String(player.id)] = {
        top: player.coordinates.top,
        left: player.coordinates.left,
      };
      return accumulator;
    }, {});

    return {
      order: boardPlayers.map((player) => ({
        top: player.coordinates.top,
        left: player.coordinates.left,
      })),
      byPlayerId,
      lineup: boardPlayers.map((player) => ({
        id: player.id,
        name: player.name,
        pos: player.pos,
        photo: player.photo,
        rating: player.rating,
        energy: player.energy,
        coordinates: {
          top: player.coordinates.top,
          left: player.coordinates.left,
        },
      })),
      bench: benchPlayers.map((player) => ({
        id: player.id,
        name: player.name,
        pos: player.pos,
        photo: player.photo,
        rating: player.rating,
        energy: player.energy,
      })),
    };
  }, [benchPlayers, boardPlayers]);

  const handleSaveCurrentPreset = useCallback(() => {
    const customOneExists = !!customTactics[CUSTOM_TACTIC_NAME]?.attack || !!customTactics[CUSTOM_TACTIC_NAME]?.defense;
    const targetCustomName =
      isCustomFormationName(currentFormation)
        ? currentFormation
        : !customOneExists
        ? CUSTOM_TACTIC_NAME
        : CUSTOM_TACTIC_NAME_2;

    const snapshot = captureCurrentFormation();

    setCustomTactics((previous) => ({
      ...previous,
      [targetCustomName]: {
        ...previous[targetCustomName],
        [phase]: {
          order: snapshot.order,
          byPlayerId: snapshot.byPlayerId,
          lineup: snapshot.lineup,
          bench: snapshot.bench,
        },
      },
    }));
    setCurrentFormation(targetCustomName);
    setActiveFormationId(formationToId(targetCustomName));
  }, [captureCurrentFormation, currentFormation, customTactics, phase]);

  const isCustomFormationSaved = useCallback(
    (formationName: string) => !!customTactics[formationName]?.attack || !!customTactics[formationName]?.defense,
    [customTactics]
  );

  const handleSelectFormation = useCallback((formationName: string) => {
    setCurrentFormation(formationName);
    setActiveFormationId(formationToId(formationName));
  }, []);

  const customSlotCards = useMemo(
    () => [
      {
        id: 'custom_1',
        label: CUSTOM_TACTIC_NAME,
        formation: CUSTOM_TACTIC_NAME,
      },
      {
        id: 'custom_2',
        label: CUSTOM_TACTIC_NAME_2,
        formation: CUSTOM_TACTIC_NAME_2,
      },
    ],
    []
  );

  const handleSelectCustomSlot = useCallback(
    (slotId: string) => {
      const formationName = customIdToFormation(slotId);
      if (!formationName || !isCustomFormationSaved(formationName)) {
        return;
      }
      setCurrentFormation(formationName);
      setActiveFormationId(slotId);
    },
    [isCustomFormationSaved]
  );

  const handleResetCustomSlot = useCallback(
    (slotId: string) => {
      const formationName = customIdToFormation(slotId);
      if (!formationName) return;

      setCustomTactics((previous) => {
        const next = { ...previous };
        delete next[formationName];
        return next;
      });

      if (currentFormation === formationName) {
        const fallbackFormation = BASE_FORMATION_OPTIONS[0];
        setCurrentFormation(fallbackFormation);
        setActiveFormationId(formationToId(fallbackFormation));
      }
    },
    [currentFormation]
  );

  const substitutionSnapRadius = useMemo(
    () => Math.max(26, Math.min(48, Math.min(pitchWidth, pitchHeight) * 0.06)),
    [pitchHeight, pitchWidth]
  );

  const handleSubstitution = useCallback((benchPlayer: BenchPlayer, targetStarterId: number | string) => {
    setBoardPlayers((previousPlayers) => {
      const targetIndex = previousPlayers.findIndex((player) => String(player.id) === String(targetStarterId));
      if (targetIndex < 0) {
        return previousPlayers;
      }

      const replacedStarter = previousPlayers[targetIndex];

      setBenchPlayers((previousBench) => {
        const filteredBench = previousBench.filter((player) => String(player.id) !== String(benchPlayer.id));
        const returnedStarter: BenchPlayer = {
          id: replacedStarter.id,
          name: replacedStarter.name,
          pos: replacedStarter.pos,
          photo: replacedStarter.photo,
          rating: replacedStarter.rating,
          energy: replacedStarter.energy,
        };

        const withoutReturned = filteredBench.filter((player) => String(player.id) !== String(returnedStarter.id));
        return [...withoutReturned, returnedStarter];
      });

      const nextPlayers = [...previousPlayers];
      nextPlayers[targetIndex] = {
        id: benchPlayer.id,
        name: benchPlayer.name,
        pos: benchPlayer.pos,
        photo: benchPlayer.photo,
        rating: benchPlayer.rating,
        energy: benchPlayer.energy,
        coordinates: replacedStarter.coordinates,
      };

      return nextPlayers;
    });
  }, []);

  const handleBenchPlayerDrop = useCallback(
    (benchPlayer: BenchPlayer, dropPoint: { x: number; y: number }) => {
      if (!hasLineupData || pitchWindowBounds.width <= 0 || pitchWindowBounds.height <= 0) {
        return;
      }

      let nearestPlayerId: number | string | undefined;
      let nearestDistance = Number.POSITIVE_INFINITY;

      orientedPlayers.forEach((player) => {
        const playerWindowX = pitchWindowBounds.x + (percentToNumber(player.coordinates.left) / 100) * pitchWidth;
        const playerWindowY = pitchWindowBounds.y + (percentToNumber(player.coordinates.top) / 100) * pitchHeight;
        const deltaX = dropPoint.x - playerWindowX;
        const deltaY = dropPoint.y - playerWindowY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestPlayerId = player.id;
        }
      });

      if (!nearestPlayerId || nearestDistance > substitutionSnapRadius) {
        return;
      }

      handleSubstitution(benchPlayer, nearestPlayerId);
    },
    [handleSubstitution, hasLineupData, orientedPlayers, pitchHeight, pitchWidth, pitchWindowBounds, substitutionSnapRadius]
  );

  const handleUndoDrawing = useCallback(() => {
    if (activeDrawPoints.length > 0) {
      setActiveDrawPoints([]);
      return;
    }

    setDrawPaths((previous) => {
      if (previous.length === 0) return previous;
      return previous.slice(0, -1);
    });
  }, [activeDrawPoints.length]);

  const handleClearDrawings = useCallback(() => {
    setDrawPaths([]);
    setActiveDrawPoints([]);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const isUndoCombo = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z';
      if (!isUndoCombo) return;

      event.preventDefault();
      handleUndoDrawing();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleUndoDrawing]);
  const webDrawCursorStyle =
    Platform.OS === 'web'
      ? ({
          cursor: 'crosshair',
        } as any)
      : null;
  const activeTool = useMemo(
    () => DRAW_TOOLS.find((tool) => tool.id === activeToolId) ?? DRAW_TOOLS[0],
    [activeToolId]
  );
  const activeReducedPoints = useMemo(() => filterJitterPoints(activeDrawPoints), [activeDrawPoints]);
  const activePath = useMemo(() => toSmoothPath(activeReducedPoints), [activeReducedPoints]);
  const activeArrowHead = useMemo(
    () => (activeTool.withArrow ? getArrowHeadPoints(activeReducedPoints) : []),
    [activeReducedPoints, activeTool.withArrow]
  );
  const playerIcons = useMemo(
    () =>
      (hasLineupData ? orientedPlayers : []).map((player, index: number) => (
        <PlayerIcon
          playerId={player.id}
          key={`team-${activeTeamId ?? 'none'}-slot-${index}`}
          label={player.name}
          position={player.pos}
          photoUrl={player.photo}
          rating={player.rating}
          energy={player.energy}
          coordinates={player.coordinates}
          boundsWidth={pitchWidth}
          boundsHeight={pitchHeight}
          orientation={orientation}
          onPositionChange={handlePlayerPositionChange}
          onPositionDrag={handlePlayerPositionDrag}
          onDragStateChange={handlePlayerDragStateChange}
          draggableEnabled={!isFreeDrawMode}
        />
      )),
    [
      activeTeamId,
      handlePlayerPositionChange,
      hasLineupData,
      isFreeDrawMode,
      orientation,
      orientedPlayers,
      handlePlayerPositionDrag,
      handlePlayerDragStateChange,
      pitchHeight,
      pitchWidth,
    ]
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.root}>
        {!isCompact && (
          <View style={styles.sidebar}>
            <Text style={styles.sidebarTitle}>COMMAND CENTER</Text>

            <View style={styles.searchInputWrap}>
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search teams... (egl. Man City)"
                placeholderTextColor="#7D8590"
                style={styles.searchInput}
              />
            </View>

            <View style={styles.topLeaguesSection}>
              <Text style={styles.sidebarSectionTitle}>TOP LEAGUES</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.topLeaguesScroll}
                contentContainerStyle={styles.topLeaguesRow}
              >
                <Pressable
                  style={[
                    styles.leagueLogoButton,
                    selectedLeague === DEFAULT_LEAGUE_FILTER && styles.leagueLogoButtonActive,
                  ]}
                  onPress={() => handleLeagueChange(DEFAULT_LEAGUE_FILTER)}
                >
                  <Text
                    style={[
                      styles.leagueLogoFallback,
                      selectedLeague === DEFAULT_LEAGUE_FILTER && styles.leagueLogoFallbackActive,
                    ]}
                  >
                    G
                  </Text>
                </Pressable>

                {leagueOptions.map((option) => (
                  <Pressable
                    key={option.league}
                    style={[styles.leagueLogoButton, selectedLeague === option.league && styles.leagueLogoButtonActive]}
                    onPress={() => handleLeagueChange(option.league as LeagueKey)}
                  >
                    <Image source={{ uri: option.leagueLogo }} style={styles.leagueLogoImage} />
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {shouldShowCurrentSelection && activeTeam ? (
              <View style={styles.currentSelectionCard}>
                <View style={styles.currentSelectionHeader}>
                  <View style={styles.currentSelectionBadge}>
                    <Animated.View
                      style={[
                        styles.onBoardDot,
                        {
                          opacity: pulseAnim,
                          transform: [{ scale: pulseAnim }],
                        },
                      ]}
                    />
                    <Text style={styles.currentSelectionBadgeText}>ON BOARD</Text>
                  </View>
                  <Pressable
                    style={styles.currentSelectionClose}
                    onPress={() => {
                      setActiveTeamId(null);
                        setCurrentFormation(BASE_FORMATION_OPTIONS[0]);
                        setActiveFormationId(formationToId(BASE_FORMATION_OPTIONS[0]));
                    }}
                  >
                    <Text style={styles.currentSelectionCloseText}>✕</Text>
                  </Pressable>
                </View>

                <View style={styles.currentSelectionBody}>
                  <Image source={{ uri: activeTeam.teamLogo }} style={styles.teamLogoImage} />
                  <View>
                    <Text style={styles.currentSelectionTitle}>{activeTeam.name.toUpperCase()}</Text>
                    <Text style={styles.currentSelectionMeta}>{activeTeam.league}</Text>
                  </View>
                </View>
              </View>
            ) : null}

            <View style={styles.recentSquadsSection}>
              <Text style={styles.sidebarSectionTitle}>RECENT SQUADS</Text>

              {isLeagueLoading ? (
                <View style={styles.teamsLoadingWrap}>
                  <ActivityIndicator size="small" color="#4FD1ED" />
                  <Text style={styles.teamsLoadingText}>Cargando equipos...</Text>
                </View>
              ) : (
                <ScrollView
                  style={styles.recentSquadsList}
                  scrollEnabled
                  showsVerticalScrollIndicator
                  contentContainerStyle={styles.sidebarScroll}
                >
                {displayedTeams.map((teamItem) => (
                  <Pressable
                    key={teamItem.id}
                    onPress={() => selectTeam(teamItem)}
                    style={[
                      styles.squadCard,
                      activeTeamId === teamItem.id && styles.squadCardActive,
                      isCompareMode && compareWithRival && rivalTeamId === teamItem.id && styles.squadCardRivalActive,
                    ]}
                  >
                    <View style={styles.squadHeaderRow}>
                      <View style={styles.squadMainInfo}>
                        <Image source={{ uri: teamItem.teamLogo }} style={styles.teamLogoImage} />
                        <View>
                          <Text style={[styles.squadName, activeTeamId === teamItem.id && styles.squadNameActive]}>
                            {teamItem.name.toUpperCase()}
                          </Text>
                          <Text style={styles.squadMeta}>{teamItem.seasonLabel}</Text>
                        </View>
                      </View>
                      <Image source={{ uri: teamItem.leagueLogo }} style={styles.squadLeagueLogo} />
                    </View>
                  </Pressable>
                ))}

                  {shouldShowSearchMoreButton ? (
                    <Pressable style={styles.searchMoreButton} onPress={handleSearchMoreTeams}>
                      <Text style={styles.searchMoreButtonText}>Buscar más equipos...</Text>
                    </Pressable>
                  ) : null}

                  {isExternalSearchLoading ? (
                    <View style={styles.teamsLoadingWrapCompact}>
                      <ActivityIndicator size="small" color="#4FD1ED" />
                      <Text style={styles.teamsLoadingText}>Buscando más equipos...</Text>
                    </View>
                  ) : null}

                  {shouldShowNoExternalResults ? <Text style={styles.noResultsText}>Sin resultados externos</Text> : null}

                  {!shouldShowNoExternalResults && displayedTeams.length === 0 ? (
                    <Text style={styles.noResultsText}>Sin resultados</Text>
                  ) : null}
                </ScrollView>
              )}
            </View>
          </View>
        )}

        <View style={styles.centerColumn}>
          <Text style={styles.teamLabel}>{activeTeam?.name ?? 'BOARD CLEARED'}</Text>
          <View
            style={styles.fieldArea}
            onLayout={(event) => {
              const { width: layoutWidth, height: layoutHeight } = event.nativeEvent.layout;
              setFieldAreaSize((prev) => {
                if (prev.width === layoutWidth && prev.height === layoutHeight) {
                  return prev;
                }
                return { width: layoutWidth, height: layoutHeight };
              });
            }}
          >
            <View
              ref={pitchGlowRef}
              onLayout={() => refreshPitchWindowBounds()}
              style={[styles.pitchGlow, { width: pitchWidth, height: pitchHeight }]}
            > 
              <View pointerEvents="none" style={styles.pitchOuterFrame} />
              <Svg width={pitchWidth} height={pitchHeight} style={styles.pitchSvg}>
              <Defs>
                <RadialGradient id="grassRadialGlow" cx="50%" cy="50%" r="68%">
                  <Stop offset="0%" stopColor="#9AD65C" stopOpacity={0.2} />
                  <Stop offset="55%" stopColor="#7DBE46" stopOpacity={0.1} />
                  <Stop offset="100%" stopColor="#0E2A12" stopOpacity={0.18} />
                </RadialGradient>
              </Defs>
              <Rect x={0} y={0} width={pitchWidth} height={pitchHeight} fill="#1A2F1A" />
              {Array.from({ length: pitchStripeCount }).map((_, stripeIndex) => (
                <Rect
                  key={`stripe-${stripeIndex}`}
                  x={0}
                  y={stripeIndex * pitchStripeHeight}
                  width={pitchWidth}
                  height={pitchStripeHeight}
                  fill={stripeIndex % 2 === 0 ? '#1A2F1A' : '#1E3A1E'}
                  opacity={0.8}
                />
              ))}
              <Rect x={0} y={0} width={pitchWidth} height={pitchHeight} fill="url(#grassRadialGlow)" />

              <Rect
                x={pitchMargin}
                y={pitchMargin}
                width={fieldWidth}
                height={fieldHeight}
                fill="none"
                stroke={lineColor}
                strokeWidth={5}
                opacity={lineShadowOpacity}
              />

              <Rect
                x={pitchMargin}
                y={pitchMargin}
                width={fieldWidth}
                height={fieldHeight}
                fill="none"
                stroke={lineColor}
                strokeWidth={2}
                opacity={lineMainOpacity}
              />

              <Path
                d={`M ${pitchMargin} ${pitchMargin + cornerArcRadius} A ${cornerArcRadius} ${cornerArcRadius} 0 0 0 ${pitchMargin + cornerArcRadius} ${pitchMargin}`}
                fill="none"
                stroke={lineColor}
                strokeWidth={2}
                opacity={lineMainOpacity}
              />
              <Path
                d={`M ${pitchWidth - pitchMargin - cornerArcRadius} ${pitchMargin} A ${cornerArcRadius} ${cornerArcRadius} 0 0 0 ${pitchWidth - pitchMargin} ${pitchMargin + cornerArcRadius}`}
                fill="none"
                stroke={lineColor}
                strokeWidth={2}
                opacity={lineMainOpacity}
              />
              <Path
                d={`M ${pitchMargin} ${pitchHeight - pitchMargin - cornerArcRadius} A ${cornerArcRadius} ${cornerArcRadius} 0 0 1 ${pitchMargin + cornerArcRadius} ${pitchHeight - pitchMargin}`}
                fill="none"
                stroke={lineColor}
                strokeWidth={2}
                opacity={lineMainOpacity}
              />
              <Path
                d={`M ${pitchWidth - pitchMargin - cornerArcRadius} ${pitchHeight - pitchMargin} A ${cornerArcRadius} ${cornerArcRadius} 0 0 1 ${pitchWidth - pitchMargin} ${pitchHeight - pitchMargin - cornerArcRadius}`}
                fill="none"
                stroke={lineColor}
                strokeWidth={2}
                opacity={lineMainOpacity}
              />

              <Line
                x1={orientation === 'horizontal' ? centerX : pitchMargin}
                y1={orientation === 'horizontal' ? pitchMargin : centerY}
                x2={orientation === 'horizontal' ? centerX : pitchWidth - pitchMargin}
                y2={orientation === 'horizontal' ? pitchHeight - pitchMargin : centerY}
                stroke={lineColor}
                strokeWidth={5}
                opacity={lineShadowOpacity}
              />

              <Line
                x1={orientation === 'horizontal' ? centerX : pitchMargin}
                y1={orientation === 'horizontal' ? pitchMargin : centerY}
                x2={orientation === 'horizontal' ? centerX : pitchWidth - pitchMargin}
                y2={orientation === 'horizontal' ? pitchHeight - pitchMargin : centerY}
                stroke={lineColor}
                strokeWidth={2}
                opacity={lineMainOpacity}
              />

              <Circle
                cx={centerX}
                cy={centerY}
                r={centerCircleRadius}
                fill="none"
                stroke={lineColor}
                strokeWidth={5}
                opacity={lineShadowOpacity}
              />

              <Circle
                cx={centerX}
                cy={centerY}
                r={centerCircleRadius}
                fill="none"
                stroke={lineColor}
                strokeWidth={2}
                opacity={lineMainOpacity}
              />

              <Circle cx={centerX} cy={centerY} r={3} fill={lineColor} opacity={lineMainOpacity} />

              {orientation === 'vertical' ? (
                <>
                  <Rect
                    x={(pitchWidth - verticalPenaltyAreaWidth) / 2}
                    y={pitchMargin}
                    width={verticalPenaltyAreaWidth}
                    height={verticalPenaltyAreaDepth}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth={5}
                    opacity={lineShadowOpacity}
                  />

                  <Rect
                    x={(pitchWidth - verticalPenaltyAreaWidth) / 2}
                    y={pitchMargin}
                    width={verticalPenaltyAreaWidth}
                    height={verticalPenaltyAreaDepth}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth={2}
                    opacity={lineMainOpacity}
                  />

                  <Path
                    d={`M ${centerX - arcDxTop} ${topPenaltyLineY} A ${verticalPenaltyArcRadius} ${verticalPenaltyArcRadius} 0 0 0 ${centerX + arcDxTop} ${topPenaltyLineY}`}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth={2}
                    opacity={lineMainOpacity}
                  />

                  <Circle cx={centerX} cy={topPenaltySpotY} r={3} fill={lineColor} opacity={lineMainOpacity} />

                  <Rect
                    x={(pitchWidth - verticalPenaltyAreaWidth) / 2}
                    y={pitchMargin + fieldHeight - verticalPenaltyAreaDepth}
                    width={verticalPenaltyAreaWidth}
                    height={verticalPenaltyAreaDepth}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth={5}
                    opacity={lineShadowOpacity}
                  />

                  <Rect
                    x={(pitchWidth - verticalPenaltyAreaWidth) / 2}
                    y={pitchMargin + fieldHeight - verticalPenaltyAreaDepth}
                    width={verticalPenaltyAreaWidth}
                    height={verticalPenaltyAreaDepth}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth={2}
                    opacity={lineMainOpacity}
                  />

                  <Path
                    d={`M ${centerX - arcDxBottom} ${bottomPenaltyLineY} A ${verticalPenaltyArcRadius} ${verticalPenaltyArcRadius} 0 0 1 ${centerX + arcDxBottom} ${bottomPenaltyLineY}`}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth={2}
                    opacity={lineMainOpacity}
                  />

                  <Circle cx={centerX} cy={bottomPenaltySpotY} r={3} fill={lineColor} opacity={lineMainOpacity} />

                  <Rect
                    x={(pitchWidth - verticalGoalAreaWidth) / 2}
                    y={pitchMargin}
                    width={verticalGoalAreaWidth}
                    height={verticalGoalAreaDepth}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth={5}
                    opacity={lineShadowOpacity}
                  />

                  <Rect
                    x={(pitchWidth - verticalGoalAreaWidth) / 2}
                    y={pitchMargin}
                    width={verticalGoalAreaWidth}
                    height={verticalGoalAreaDepth}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth={2}
                    opacity={lineMainOpacity}
                  />

                  <Rect
                    x={(pitchWidth - verticalGoalAreaWidth) / 2}
                    y={pitchMargin + fieldHeight - verticalGoalAreaDepth}
                    width={verticalGoalAreaWidth}
                    height={verticalGoalAreaDepth}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth={5}
                    opacity={lineShadowOpacity}
                  />

                  <Rect
                    x={(pitchWidth - verticalGoalAreaWidth) / 2}
                    y={pitchMargin + fieldHeight - verticalGoalAreaDepth}
                    width={verticalGoalAreaWidth}
                    height={verticalGoalAreaDepth}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth={2}
                    opacity={lineMainOpacity}
                  />

                  <Rect
                    x={goalX}
                    y={pitchMargin - goalDepth}
                    width={goalWidth}
                    height={goalDepth}
                    fill="rgba(255,255,255,0.05)"
                    stroke={lineColor}
                    strokeWidth={1.5}
                    opacity={lineMainOpacity}
                  />

                  <Rect
                    x={goalX}
                    y={pitchHeight - pitchMargin}
                    width={goalWidth}
                    height={goalDepth}
                    fill="rgba(255,255,255,0.05)"
                    stroke={lineColor}
                    strokeWidth={1.5}
                    opacity={lineMainOpacity}
                  />
                </>
              ) : (
                <>
                  <Rect
                    x={pitchMargin}
                    y={(pitchHeight - horizontalPenaltyAreaWidth) / 2}
                    width={horizontalPenaltyAreaDepth}
                    height={horizontalPenaltyAreaWidth}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth={5}
                    opacity={lineShadowOpacity}
                  />

                  <Rect
                    x={pitchMargin}
                    y={(pitchHeight - horizontalPenaltyAreaWidth) / 2}
                    width={horizontalPenaltyAreaDepth}
                    height={horizontalPenaltyAreaWidth}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth={2}
                    opacity={lineMainOpacity}
                  />

                  <Path
                    d={`M ${leftPenaltyLineX} ${centerY - arcDyLeft} A ${horizontalPenaltyArcRadius} ${horizontalPenaltyArcRadius} 0 0 1 ${leftPenaltyLineX} ${centerY + arcDyLeft}`}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth={2}
                    opacity={lineMainOpacity}
                  />

                  <Circle cx={leftPenaltySpotX} cy={centerY} r={3} fill={lineColor} opacity={lineMainOpacity} />

                  <Rect
                    x={pitchMargin + fieldWidth - horizontalPenaltyAreaDepth}
                    y={(pitchHeight - horizontalPenaltyAreaWidth) / 2}
                    width={horizontalPenaltyAreaDepth}
                    height={horizontalPenaltyAreaWidth}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth={5}
                    opacity={lineShadowOpacity}
                  />

                  <Rect
                    x={pitchMargin + fieldWidth - horizontalPenaltyAreaDepth}
                    y={(pitchHeight - horizontalPenaltyAreaWidth) / 2}
                    width={horizontalPenaltyAreaDepth}
                    height={horizontalPenaltyAreaWidth}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth={2}
                    opacity={lineMainOpacity}
                  />

                  <Path
                    d={`M ${rightPenaltyLineX} ${centerY - arcDyRight} A ${horizontalPenaltyArcRadius} ${horizontalPenaltyArcRadius} 0 0 0 ${rightPenaltyLineX} ${centerY + arcDyRight}`}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth={2}
                    opacity={lineMainOpacity}
                  />

                  <Circle cx={rightPenaltySpotX} cy={centerY} r={3} fill={lineColor} opacity={lineMainOpacity} />

                  <Rect
                    x={pitchMargin}
                    y={(pitchHeight - horizontalGoalAreaWidth) / 2}
                    width={horizontalGoalAreaDepth}
                    height={horizontalGoalAreaWidth}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth={5}
                    opacity={lineShadowOpacity}
                  />

                  <Rect
                    x={pitchMargin}
                    y={(pitchHeight - horizontalGoalAreaWidth) / 2}
                    width={horizontalGoalAreaDepth}
                    height={horizontalGoalAreaWidth}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth={2}
                    opacity={lineMainOpacity}
                  />

                  <Rect
                    x={pitchMargin + fieldWidth - horizontalGoalAreaDepth}
                    y={(pitchHeight - horizontalGoalAreaWidth) / 2}
                    width={horizontalGoalAreaDepth}
                    height={horizontalGoalAreaWidth}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth={5}
                    opacity={lineShadowOpacity}
                  />

                  <Rect
                    x={pitchMargin + fieldWidth - horizontalGoalAreaDepth}
                    y={(pitchHeight - horizontalGoalAreaWidth) / 2}
                    width={horizontalGoalAreaDepth}
                    height={horizontalGoalAreaWidth}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth={2}
                    opacity={lineMainOpacity}
                  />

                  <Rect
                    x={pitchMargin - goalDepth}
                    y={horizontalGoalY}
                    width={goalDepth}
                    height={horizontalGoalSpan}
                    fill="rgba(255,255,255,0.05)"
                    stroke={lineColor}
                    strokeWidth={1.5}
                    opacity={lineMainOpacity}
                  />

                  <Rect
                    x={pitchWidth - pitchMargin}
                    y={horizontalGoalY}
                    width={goalDepth}
                    height={horizontalGoalSpan}
                    fill="rgba(255,255,255,0.05)"
                    stroke={lineColor}
                    strokeWidth={1.5}
                    opacity={lineMainOpacity}
                  />
                </>
              )}
              </Svg>

              <Svg width={pitchWidth} height={pitchHeight} style={styles.drawSvg} pointerEvents="none">
                {renderedDrawArtifacts.map(({ drawPath: path, pathD: renderedPath, arrowHead: renderedArrowHead }) => {

                  return (
                  <G key={path.id}>
                    <Path
                      d={renderedPath}
                      fill="none"
                      stroke={path.color}
                      strokeWidth={path.glowWidth}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={path.lineStyle === 'dashed' ? '10 8' : undefined}
                      opacity={0.2}
                    />
                    <Path
                      d={renderedPath}
                      fill="none"
                      stroke={path.color}
                      strokeWidth={path.strokeWidth}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={path.lineStyle === 'dashed' ? '10 8' : undefined}
                      opacity={path.opacity}
                    />
                    {path.withArrow && renderedArrowHead.length === 3 ? (
                      <>
                        <Path
                          d={arrowPointsToPath(renderedArrowHead)}
                          fill="none"
                          stroke={path.color}
                          strokeWidth={path.glowWidth}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          opacity={0.2}
                        />
                        <Path
                          d={arrowPointsToPath(renderedArrowHead)}
                          fill="none"
                          stroke={path.color}
                          strokeWidth={path.strokeWidth}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          opacity={path.opacity}
                        />
                      </>
                    ) : null}
                  </G>
                )})}
                {activeReducedPoints.length > 1 ? (
                  <>
                    <Path
                      d={activePath}
                      fill="none"
                      stroke={activeTool.color}
                      strokeWidth={activeTool.glowWidth}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={activeTool.lineStyle === 'dashed' ? '10 8' : undefined}
                      opacity={0.2}
                    />
                    <Path
                      d={activePath}
                      fill="none"
                      stroke={activeTool.color}
                      strokeWidth={activeTool.strokeWidth}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={activeTool.lineStyle === 'dashed' ? '10 8' : undefined}
                      opacity={activeTool.opacity}
                    />
                    {activeTool.withArrow && activeArrowHead.length === 3 ? (
                      <>
                        <Path
                          d={arrowPointsToPath(activeArrowHead)}
                          fill="none"
                          stroke={activeTool.color}
                          strokeWidth={activeTool.glowWidth}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          opacity={0.2}
                        />
                        <Path
                          d={arrowPointsToPath(activeArrowHead)}
                          fill="none"
                          stroke={activeTool.color}
                          strokeWidth={activeTool.strokeWidth}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          opacity={activeTool.opacity}
                        />
                      </>
                    ) : null}
                  </>
                ) : null}
              </Svg>

              <View
                style={[
                  styles.drawGestureLayer,
                  isFreeDrawMode ? webDrawCursorStyle : null,
                ]}
                pointerEvents={isFreeDrawMode ? 'auto' : 'none'}
                onStartShouldSetResponder={() => isFreeDrawMode}
                onMoveShouldSetResponder={() => isFreeDrawMode}
                onResponderGrant={(event) => {
                  if (!isFreeDrawMode) return;
                  const startX = Math.max(0, Math.min(pitchWidth, event.nativeEvent.locationX));
                  const startY = Math.max(0, Math.min(pitchHeight, event.nativeEvent.locationY));
                  setActiveDrawPoints([{ x: startX, y: startY }]);
                }}
                onResponderMove={(event) => {
                  if (!isFreeDrawMode) return;
                  const moveX = Math.max(0, Math.min(pitchWidth, event.nativeEvent.locationX));
                  const moveY = Math.max(0, Math.min(pitchHeight, event.nativeEvent.locationY));
                  setActiveDrawPoints((previous) => {
                    const last = previous[previous.length - 1];
                    if (!last) {
                      return [{ x: moveX, y: moveY }];
                    }
                    const deltaX = moveX - last.x;
                    const deltaY = moveY - last.y;
                    if (Math.sqrt(deltaX * deltaX + deltaY * deltaY) < 1.4) {
                      return previous;
                    }
                    return [...previous, { x: moveX, y: moveY }];
                  });
                }}
                onResponderRelease={() => {
                  if (!isFreeDrawMode) return;
                  setActiveDrawPoints((previous) => {
                    const reducedPoints = filterJitterPoints(previous);
                    if (reducedPoints.length > 1) {
                      const first = reducedPoints[0];
                      const last = reducedPoints[reducedPoints.length - 1];
                      const startPlayerId = closestPlayerToPoint(
                        first,
                        orientedPlayers,
                        pitchWidth,
                        pitchHeight,
                        magneticSnapRadius
                      );
                      const endPlayerId = closestPlayerToPoint(
                        last,
                        orientedPlayers,
                        pitchWidth,
                        pitchHeight,
                        magneticSnapRadius
                      );

                      setDrawPaths((paths) => [
                        ...paths,
                        {
                          id: `draw-${Date.now()}-${paths.length}`,
                          toolId: activeTool.id,
                          lineStyle: activeTool.lineStyle,
                          color: activeTool.color,
                          strokeWidth: activeTool.strokeWidth,
                          glowWidth: activeTool.glowWidth,
                          opacity: activeTool.opacity,
                          withArrow: activeTool.withArrow,
                          points: reducedPoints,
                          anchor:
                            startPlayerId && endPlayerId
                              ? {
                                  startPlayerId,
                                  endPlayerId,
                                  startPoint: first,
                                  endPoint: last,
                                }
                              : undefined,
                        },
                      ]);
                    }
                    return [];
                  });
                }}
                onResponderTerminate={() => {
                  if (!isFreeDrawMode) return;
                  setActiveDrawPoints((previous) => {
                    const reducedPoints = filterJitterPoints(previous);
                    if (reducedPoints.length > 1) {
                      const first = reducedPoints[0];
                      const last = reducedPoints[reducedPoints.length - 1];
                      const startPlayerId = closestPlayerToPoint(
                        first,
                        orientedPlayers,
                        pitchWidth,
                        pitchHeight,
                        magneticSnapRadius
                      );
                      const endPlayerId = closestPlayerToPoint(
                        last,
                        orientedPlayers,
                        pitchWidth,
                        pitchHeight,
                        magneticSnapRadius
                      );

                      setDrawPaths((paths) => [
                        ...paths,
                        {
                          id: `draw-${Date.now()}-${paths.length}`,
                          toolId: activeTool.id,
                          lineStyle: activeTool.lineStyle,
                          color: activeTool.color,
                          strokeWidth: activeTool.strokeWidth,
                          glowWidth: activeTool.glowWidth,
                          opacity: activeTool.opacity,
                          withArrow: activeTool.withArrow,
                          points: reducedPoints,
                          anchor:
                            startPlayerId && endPlayerId
                              ? {
                                  startPlayerId,
                                  endPlayerId,
                                  startPoint: first,
                                  endPoint: last,
                                }
                              : undefined,
                        },
                      ]);
                    }
                    return [];
                  });
                }}
              />

              <DrawingToolbar
                visible={isFreeDrawMode}
                activeToolId={activeToolId}
                onSelectTool={(toolId) => setActiveToolId(toolId)}
                onUndo={handleUndoDrawing}
                onClear={handleClearDrawings}
                undoDisabled={drawPaths.length === 0}
                clearDisabled={drawPaths.length === 0 && activeDrawPoints.length === 0}
                boardWidth={pitchWidth}
                boardHeight={pitchHeight}
              />

              {isCompareMode ? (
                <View style={styles.compareGhostLayer} pointerEvents="none">
                  {compareGhostPlayers.map((player, index) => (
                    <PlayerIcon
                      key={`compare-ghost-${index}`}
                      playerId={player.id}
                      label={player.name}
                      position={player.pos}
                      coordinates={player.coordinates}
                      boundsWidth={pitchWidth}
                      boundsHeight={pitchHeight}
                      orientation={orientation}
                      draggableEnabled={false}
                      minimal
                      hidePhoto
                      ghostOpacity={0.32}
                      forceAccentColor="#7DD3FC"
                    />
                  ))}
                </View>
              ) : null}

              {isCompareMode && compareWithRival && rivalTeam && !rivalLoading ? (
                <View style={styles.rivalGhostLayer} pointerEvents="none">
                  {rivalTrackedOverlayPlayers.map((player, index) => (
                    <PlayerIcon
                      key={`rival-ghost-${index}`}
                      playerId={player.id}
                      label={player.name}
                      position={player.pos}
                      coordinates={player.coordinates}
                      boundsWidth={pitchWidth}
                      boundsHeight={pitchHeight}
                      orientation={orientation}
                      draggableEnabled={false}
                      minimal
                      hidePhoto
                      isRival
                      dashedBorder
                      ghostOpacity={0.5}
                      showMinimalMarker={showRivalNames}
                      minimalMarkerText={showRivalNames ? player.markerText : ''}
                      showLabelWhenMinimal={showRivalNames}
                    />
                  ))}
                </View>
              ) : null}

              {isCompareMode && compareWithRival && rivalTeam && !rivalLoading ? (
                <View style={styles.compareInsightsLayer} pointerEvents="none">
                  <Svg width={pitchWidth} height={pitchHeight}>
                    {isAutoTracking && activeTrackingLine ? (
                      <Line
                        x1={activeTrackingLine.x1}
                        y1={activeTrackingLine.y1}
                        x2={activeTrackingLine.x2}
                        y2={activeTrackingLine.y2}
                        stroke="#E5E7EB"
                        strokeWidth={1}
                        strokeDasharray="3 3"
                        opacity={0.1}
                      />
                    ) : null}

                    {compareInsights.pairingLines.map((pairingLine) => (
                      <Line
                        key={pairingLine.id}
                        x1={pairingLine.x1}
                        y1={pairingLine.y1}
                        x2={pairingLine.x2}
                        y2={pairingLine.y2}
                        stroke="#E5E7EB"
                        strokeWidth={1}
                        strokeDasharray="4 4"
                        opacity={0.2}
                      />
                    ))}

                    {compareInsights.superiorityZones.map((zone) => (
                      <G key={zone.id}>
                        <Circle cx={zone.x} cy={zone.y} r={zone.radius + 8} fill="#22C55E" opacity={0.08} />
                        <Circle cx={zone.x} cy={zone.y} r={zone.radius} fill="#22C55E" opacity={0.16} />
                      </G>
                    ))}

                    {compareInsights.dangerZones.map((zone) => (
                      <G key={zone.id}>
                        <Circle
                          cx={zone.x}
                          cy={zone.y}
                          r={12}
                          fill="none"
                          stroke="#FACC15"
                          strokeWidth={1}
                          strokeDasharray="3 3"
                          opacity={0.3}
                        />
                        <SvgText
                          x={zone.x}
                          y={zone.y + 4}
                          fill="#FACC15"
                          fontSize="9"
                          fontWeight="700"
                          textAnchor="middle"
                          opacity={0.55}
                        >
                          Z
                        </SvgText>
                      </G>
                    ))}
                  </Svg>
                </View>
              ) : null}

              <View style={styles.playersLayer} pointerEvents={isFreeDrawMode ? 'none' : 'auto'}>
                {playerIcons}
              </View>

              {activeTeam && loading ? (
                <View style={styles.pitchLoadingOverlay} pointerEvents="none">
                  <View style={styles.pitchLoadingCard}>
                    <ActivityIndicator size="small" color="#4FD1ED" />
                    <Text style={styles.pitchLoadingText}>Loading lineup...</Text>
                  </View>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {!isCompact && (
          <View style={styles.panel}>
            <ScrollView
              style={styles.panelScroll}
              contentContainerStyle={styles.panelScrollContent}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
            <Text style={styles.panelTitle}>TACTIC CONTROLS</Text>
            <View style={styles.tacticButtonsWrap}>
              <FormationsDropdown
                value={currentFormation}
                options={formationOptions}
                onSelect={handleSelectFormation}
              />

              <View style={styles.customSlotsWrap}>
                {customSlotCards.filter((slot) => isCustomFormationSaved(slot.formation)).map((slot) => {
                  const hasSaved = isCustomFormationSaved(slot.formation);
                  const isActive = activeFormationId === slot.id;
                  return (
                    <Pressable
                      key={slot.id}
                      style={styles.customSlotRow}
                    >
                      <Pressable
                        style={[
                          styles.tacticButtonCard,
                          styles.customSlotButton,
                          hasSaved && styles.tacticButtonCardSaved,
                          isActive && styles.tacticButtonCardActive,
                        ]}
                        onPress={() => handleSelectCustomSlot(slot.id)}
                      >
                        <Text
                          style={[
                            styles.tacticButtonText,
                            hasSaved && styles.tacticButtonTextSaved,
                            isActive && styles.tacticButtonTextActive,
                          ]}
                        >
                          {slot.label}
                        </Text>
                      </Pressable>

                      <Pressable
                        style={[styles.resetCustomButton, !hasSaved && styles.resetCustomButtonDisabled]}
                        disabled={!hasSaved}
                        onPress={() => handleResetCustomSlot(slot.id)}
                      >
                        <Text style={styles.resetCustomButtonText}>✕</Text>
                      </Pressable>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.phaseToggleWrap}>
              <Pressable
                style={[styles.phaseToggleButton, phase === 'attack' && styles.phaseToggleButtonActive]}
                onPress={() => setPhase('attack')}
              >
                <Text style={[styles.phaseToggleText, phase === 'attack' && styles.phaseToggleTextActive]}>ATAQUE</Text>
              </Pressable>
              <Pressable
                style={[styles.phaseToggleButton, phase === 'defense' && styles.phaseToggleButtonActive]}
                onPress={() => setPhase('defense')}
              >
                <Text style={[styles.phaseToggleText, phase === 'defense' && styles.phaseToggleTextActive]}>DEFENSA</Text>
              </Pressable>
            </View>

            <Pressable style={styles.saveCurrentButton} onPress={() => handleSaveCurrentPreset()}>
              <Text style={styles.saveCurrentButtonText}>SAVE CURRENT</Text>
            </Pressable>

            <View style={styles.ctaWrap}>
              <Pressable
                style={[styles.ctaButton, isCompareMode && styles.ctaButtonActive]}
                onPress={() => {
                  setIsCompareMode((previous) => !previous);
                }}
              >
                <Text style={styles.ctaButtonText}>{isCompareMode ? 'EXIT COMPARE' : 'COMPARE TACTICS'}</Text>
              </Pressable>
            </View>

            {isCompareMode ? (
              <View style={styles.comparePanel}>
                <Text style={styles.compareTitle}>SECOND FORMATION</Text>
                <FormationsDropdown
                  value={compareFormation}
                  options={compareFormationOptions}
                  onSelect={(formation) => setCompareFormation(formation)}
                />

                <View style={styles.phaseToggleWrap}>
                  <Pressable
                    style={[styles.phaseToggleButton, comparePhase === 'attack' && styles.phaseToggleButtonActive]}
                    onPress={() => setComparePhase('attack')}
                  >
                    <Text style={[styles.phaseToggleText, comparePhase === 'attack' && styles.phaseToggleTextActive]}>ATAQUE</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.phaseToggleButton, comparePhase === 'defense' && styles.phaseToggleButtonActive]}
                    onPress={() => setComparePhase('defense')}
                  >
                    <Text style={[styles.phaseToggleText, comparePhase === 'defense' && styles.phaseToggleTextActive]}>DEFENSA</Text>
                  </Pressable>
                </View>

                <View style={styles.proCardRow}>
                  <Text style={styles.proCardText}>CARGAR RIVAL</Text>
                  <Switch
                    value={compareWithRival}
                    onValueChange={setCompareWithRival}
                    trackColor={{ false: '#2A3240', true: '#EF4444' }}
                    thumbColor={compareWithRival ? '#111827' : '#9CA3AF'}
                  />
                </View>

                <View style={styles.compareMiniRow}>
                  <Text style={styles.compareMiniText}>Mostrar Nombres Rival</Text>
                  <Switch
                    value={showRivalNames}
                    onValueChange={setShowRivalNames}
                    disabled={!compareWithRival}
                    trackColor={{ false: '#2A3240', true: '#4FD1ED' }}
                    thumbColor={showRivalNames ? '#0D1117' : '#9CA3AF'}
                  />
                </View>

                <View style={styles.compareMiniRow}>
                  <Text style={styles.compareMiniText}>Auto-Tracking</Text>
                  <Switch
                    value={isAutoTracking}
                    onValueChange={setIsAutoTracking}
                    disabled={!compareWithRival}
                    trackColor={{ false: '#2A3240', true: '#22C55E' }}
                    thumbColor={isAutoTracking ? '#0D1117' : '#9CA3AF'}
                  />
                </View>

                {compareWithRival ? (
                  <Text style={styles.compareHint}>
                    Selecciona otro equipo en Command Center para cargar rival.
                  </Text>
                ) : null}
              </View>
            ) : null}

            <Text style={styles.panelSectionTitle}>PRO FEATURES</Text>
            <View style={styles.proCard}>
              <Text style={styles.proCardText}>EXPORT HD IMAGE</Text>
            </View>
            <View style={styles.proCardRow}>
              <Text style={styles.proCardText}>FREE DRAW MODE</Text>
              <Switch
                value={isFreeDrawMode}
                onValueChange={setIsFreeDrawMode}
                trackColor={{ false: '#2A3240', true: '#4FD1ED' }}
                thumbColor={isFreeDrawMode ? '#0D1117' : '#9CA3AF'}
              />
            </View>
            <Pressable
              style={styles.orientationButton}
              onPress={() => {
                setOrientation((previous) => (previous === 'vertical' ? 'horizontal' : 'vertical'));
              }}
            >
              <Text style={styles.orientationButtonText}>SWITCH ORIENTATION</Text>
              <Text style={styles.orientationMetaText}>{orientation.toUpperCase()}</Text>
            </Pressable>

            <SquadBench
              players={benchPlayers}
              disabled={loading || isFreeDrawMode || !hasLineupData}
              onPlayerDrop={handleBenchPlayerDrop}
            />

            </ScrollView>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0D1117',
    overflow: 'hidden',
  },
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#0D1117',
    overflow: 'hidden',
  },
  sidebar: {
    flex: 2,
    backgroundColor: '#161B22',
    borderRightWidth: 1,
    borderRightColor: '#21262D',
    paddingHorizontal: 14,
    paddingVertical: 18,
    height: '100%',
  },
  sidebarTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    letterSpacing: 0.8,
  },
  searchInputWrap: {
    marginTop: 4,
    marginBottom: 14,
  },
  searchInput: {
    height: 40,
    borderRadius: 10,
    backgroundColor: '#0F1723',
    borderWidth: 1,
    borderColor: '#2F6E8D',
    color: '#E6EDF3',
    fontSize: 13,
    paddingHorizontal: 12,
    fontWeight: '600',
  },
  sidebarSectionTitle: {
    color: '#E6EDF3',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  topLeaguesSection: {
    flexShrink: 0,
  },
  topLeaguesRow: {
    gap: 10,
    alignItems: 'center',
    paddingVertical: 4,
    paddingRight: 8,
  },
  topLeaguesScroll: {
    height: 56,
    marginBottom: 6,
  },
  leagueLogoButton: {
    width: 44,
    height: 44,
    flexShrink: 0,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#2A3240',
    backgroundColor: '#101A29',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leagueLogoButtonActive: {
    borderColor: '#4FD1ED',
    shadowColor: '#4FD1ED',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  leagueLogoImage: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  leagueLogoFallback: {
    color: '#9AA4AF',
    fontSize: 16,
    fontWeight: '800',
  },
  leagueLogoFallbackActive: {
    color: '#4FD1ED',
  },
  sidebarScroll: {
    paddingBottom: 16,
  },
  recentSquadsSection: {
    flex: 1,
    minHeight: 0,
  },
  teamsLoadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  teamsLoadingWrapCompact: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    marginBottom: 6,
  },
  teamsLoadingText: {
    color: '#8B949E',
    fontSize: 12,
    fontWeight: '600',
  },
  recentSquadsList: {
    flex: 1,
    minHeight: 0,
    overflow: 'scroll',
  },
  searchMoreButton: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#4FD1ED',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  searchMoreButtonText: {
    color: '#4FD1ED',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.4,
  },
  squadCard: {
    backgroundColor: '#0F1723',
    borderWidth: 1,
    borderColor: '#212D3A',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 10,
  },
  squadCardActive: {
    borderColor: '#4FD1ED',
  },
  squadCardRivalActive: {
    borderColor: '#EF4444',
  },
  squadHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  squadMainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  teamLogoImage: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  squadLeagueLogo: {
    width: 18,
    height: 18,
    borderRadius: 9,
    opacity: 0.9,
  },
  squadName: {
    color: '#E6EDF3',
    fontSize: 12,
    fontWeight: '700',
  },
  squadNameActive: {
    color: '#4FD1ED',
  },
  squadMeta: {
    color: '#7D8590',
    fontSize: 11,
    marginTop: 2,
  },
  noResultsText: {
    color: '#7D8590',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 12,
  },
  currentSelectionCard: {
    backgroundColor: '#0F1723',
    borderWidth: 1,
    borderColor: '#4FD1ED',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 10,
  },
  currentSelectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  currentSelectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  onBoardDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4FD1ED',
  },
  currentSelectionBadgeText: {
    color: '#4FD1ED',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  currentSelectionClose: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#2A3240',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
  },
  currentSelectionCloseText: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '700',
  },
  currentSelectionBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currentSelectionTitle: {
    color: '#E6EDF3',
    fontSize: 12,
    fontWeight: '700',
  },
  currentSelectionMeta: {
    color: '#7D8590',
    fontSize: 11,
    marginTop: 1,
  },
  centerColumn: {
    flex: 6,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: '#0D1117',
    overflow: 'hidden',
  },
  fieldArea: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  teamLabel: {
    color: '#E6EDF3',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
    letterSpacing: 0.8,
  },
  pitchGlow: {
    borderRadius: 0,
    shadowColor: '#4FD1ED',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 22,
    elevation: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  pitchOuterFrame: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: '#4FD1ED',
    zIndex: 40,
  },
  pitchSvg: {
    borderRadius: 0,
  },
  playersLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    zIndex: 30,
    elevation: 8,
  },
  drawSvg: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  drawGestureLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 35,
  },
  compareGhostLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 22,
    elevation: 2,
  },
  rivalGhostLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 24,
    elevation: 3,
  },
  compareInsightsLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 26,
    elevation: 4,
  },
  pitchLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pitchLoadingCard: {
    minWidth: 180,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#4FD1ED',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#4FD1ED',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  pitchLoadingText: {
    color: '#E6EDF3',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  panel: {
    flex: 2,
    backgroundColor: '#161B22',
    borderLeftWidth: 1,
    borderLeftColor: '#21262D',
    paddingHorizontal: 14,
    paddingVertical: 18,
    height: '100%',
    overflow: 'visible',
    zIndex: 20,
  },
  panelScroll: {
    flex: 1,
    minHeight: 0,
    overflow: 'visible',
  },
  panelScrollContent: {
    paddingBottom: 24,
  },
  panelTitle: {
    color: '#E6EDF3',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: 0.8,
  },
  tacticButtonsWrap: {
    marginBottom: 10,
  },
  customSlotsWrap: {
    gap: 8,
  },
  customSlotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customSlotButton: {
    flex: 1,
    marginBottom: 0,
  },
  resetCustomButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A3240',
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetCustomButtonDisabled: {
    opacity: 0.35,
  },
  resetCustomButtonText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 16,
  },
  tacticButtonCard: {
    backgroundColor: '#0F1723',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A3240',
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  tacticButtonCardSaved: {
    borderColor: '#4FD1ED',
    shadowColor: '#4FD1ED',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
  },
  tacticButtonCardActive: {
    borderColor: '#4FD1ED',
  },
  tacticButtonText: {
    color: '#8B949E',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  tacticButtonTextSaved: {
    color: '#7DD3FC',
  },
  tacticButtonTextActive: {
    color: '#4FD1ED',
  },
  phaseToggleWrap: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  phaseToggleButton: {
    flex: 1,
    backgroundColor: '#0F1723',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A3240',
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseToggleButtonActive: {
    borderColor: '#4FD1ED',
    backgroundColor: '#4FD1ED',
  },
  phaseToggleText: {
    color: '#8B949E',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  phaseToggleTextActive: {
    color: '#0D1117',
  },
  saveCurrentButton: {
    width: '100%',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#2A8FB8',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  saveCurrentButtonText: {
    color: '#7DD3FC',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.6,
  },
  ctaWrap: {
    marginBottom: 16,
  },
  ctaButton: {
    backgroundColor: '#4FD1ED',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    shadowColor: '#4FD1ED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  ctaButtonActive: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
  },
  ctaButtonText: {
    color: '#0D1117',
    fontWeight: '800',
    fontSize: 13,
    textAlign: 'center',
    letterSpacing: 0.8,
  },
  comparePanel: {
    marginTop: -6,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#2A3240',
    borderRadius: 10,
    backgroundColor: '#0F1723',
    padding: 10,
  },
  compareTitle: {
    color: '#C9D1D9',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  compareHint: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '600',
    marginTop: -2,
  },
  compareMiniRow: {
    width: '100%',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#2A3240',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 9,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  compareMiniText: {
    color: '#C9D1D9',
    fontSize: 11,
    fontWeight: '700',
  },
  panelSectionTitle: {
    color: '#E6EDF3',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
    marginTop: 6,
  },
  proCard: {
    width: '100%',
    backgroundColor: '#0F1723',
    borderWidth: 1,
    borderColor: '#2A3240',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  proCardRow: {
    width: '100%',
    backgroundColor: '#0F1723',
    borderWidth: 1,
    borderColor: '#2A3240',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  proCardText: {
    color: '#C9D1D9',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orientationButton: {
    width: '100%',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#4FD1ED',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  orientationButtonText: {
    color: '#4FD1ED',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.6,
  },
  orientationMetaText: {
    color: '#8B949E',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
    letterSpacing: 0.6,
  },
});
