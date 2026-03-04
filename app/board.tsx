import { SafeAreaView, View, StyleSheet, Text, ScrollView, Pressable, Switch, ActivityIndicator, useWindowDimensions, TextInput, Image, Animated, Easing } from 'react-native';
import Svg, { Rect, Circle, Line, Path, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import PlayerIcon from '../components/PlayerIcon';
import useFootballTactics from '../hooks/useFootballTactics';
import {
  TEAM_DATABASE,
  TeamDatabaseItem,
  DEFAULT_LEAGUE_FILTER,
  TEAMS_BY_LEAGUE,
  LeagueKey,
} from '../constants/commandCenterTeams';

const FORMATION_OPTIONS = ['4-4-2', '3-5-2'] as const;

type DrawPoint = {
  x: number;
  y: number;
};

type DrawPathShape = {
  id: string;
  points: DrawPoint[];
};

type LineupPlayer = {
  id: number | string;
  name: string;
  pos?: string;
  photo?: string;
  rating?: number;
  energy?: number;
  coordinates: { top: string; left: string };
};

const pointsToSvgPath = (points: DrawPoint[]) => {
  if (points.length === 0) return '';
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
};

export default function BoardScreen() {
  const { width } = useWindowDimensions();
  const isCompact = width < 1024;
  const { team } = useLocalSearchParams<{ team: string }>();
  const resolvedTeamName = team && typeof team === 'string' ? team.trim().toLowerCase() : '';
  const initialTeam =
    TEAM_DATABASE.find((item) => item.name.toLowerCase() === resolvedTeamName) ?? TEAM_DATABASE[0];

  const [currentFormation, setCurrentFormation] = useState<(typeof FORMATION_OPTIONS)[number]>(
    initialTeam.defaultFormation
  );
  const [fieldAreaSize, setFieldAreaSize] = useState({ width: 0, height: 0 });
  const [isFreeDrawMode, setIsFreeDrawMode] = useState(false);
  const [drawPaths, setDrawPaths] = useState<DrawPathShape[]>([]);
  const [activeDrawPoints, setActiveDrawPoints] = useState<DrawPoint[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedLeague, setSelectedLeague] = useState<LeagueKey>(DEFAULT_LEAGUE_FILTER);
  const [activeTeamId, setActiveTeamId] = useState<number | null>(initialTeam.id);
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
    setActiveTeamId(teamItem.id);
    setCurrentFormation(teamItem.defaultFormation);
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

  const activeTeam = activeTeamId ? TEAM_DATABASE.find((item) => item.id === activeTeamId) ?? null : null;
  const shouldShowCurrentSelection =
    !!activeTeam &&
    selectedLeague !== DEFAULT_LEAGUE_FILTER &&
    activeTeam.league !== selectedLeague;

  const tacticsHook = useFootballTactics as (options?: {
    fixtureId?: string;
    developmentMode?: boolean;
    defaultFormation?: string;
  }) => {
    data: {
      lineups?: Array<{
        players?: Array<{
          id: number | string;
          name: string;
          coordinates: { top: string; left: string };
        }>;
      }>;
    } | null;
    loading: boolean;
  };

  const { data, loading } = tacticsHook({
    fixtureId: activeTeam?.fixtureId,
    defaultFormation: activeTeam?.defaultFormation,
  });
  const lineupPlayers = useMemo(
    () => (data?.lineups?.[0]?.players ?? []) as LineupPlayer[],
    [data]
  );
  const [boardPlayers, setBoardPlayers] = useState<LineupPlayer[]>([]);

  useEffect(() => {
    setBoardPlayers([]);
  }, [activeTeamId]);

  useEffect(() => {
    if (loading) {
      setBoardPlayers([]);
      return;
    }
    setBoardPlayers(lineupPlayers);
  }, [loading, lineupPlayers]);

  const hasLineupData = !!activeTeam && !loading && boardPlayers.length > 0;

  const pitchRatio = 1.48;
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
  const fieldWidth = pitchWidth - pitchMargin * 2;
  const fieldHeight = pitchHeight - pitchMargin * 2;
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
                      setCurrentFormation(FORMATION_OPTIONS[0]);
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
                    style={[styles.squadCard, activeTeamId === teamItem.id && styles.squadCardActive]}
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
            <View style={[styles.pitchGlow, { width: pitchWidth, height: pitchHeight }]}> 
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
                x1={pitchMargin}
                y1={pitchHeight / 2}
                x2={pitchWidth - pitchMargin}
                y2={pitchHeight / 2}
                stroke={lineColor}
                strokeWidth={5}
                opacity={lineShadowOpacity}
              />

              <Line
                x1={pitchMargin}
                y1={pitchHeight / 2}
                x2={pitchWidth - pitchMargin}
                y2={pitchHeight / 2}
                stroke={lineColor}
                strokeWidth={2}
                opacity={lineMainOpacity}
              />

              <Circle
                cx={pitchWidth / 2}
                cy={pitchHeight / 2}
                r={fieldWidth * 0.12}
                fill="none"
                stroke={lineColor}
                strokeWidth={5}
                opacity={lineShadowOpacity}
              />

              <Circle
                cx={pitchWidth / 2}
                cy={pitchHeight / 2}
                r={fieldWidth * 0.12}
                fill="none"
                stroke={lineColor}
                strokeWidth={2}
                opacity={lineMainOpacity}
              />

              <Circle cx={pitchWidth / 2} cy={pitchHeight / 2} r={3} fill={lineColor} opacity={lineMainOpacity} />

              <Rect
                x={(pitchWidth - penaltyAreaWidth) / 2}
                y={pitchMargin}
                width={penaltyAreaWidth}
                height={penaltyAreaDepth}
                fill="none"
                stroke={lineColor}
                strokeWidth={5}
                opacity={lineShadowOpacity}
              />

              <Rect
                x={(pitchWidth - penaltyAreaWidth) / 2}
                y={pitchMargin}
                width={penaltyAreaWidth}
                height={penaltyAreaDepth}
                fill="none"
                stroke={lineColor}
                strokeWidth={2}
                opacity={lineMainOpacity}
              />

              <Path
                d={`M ${pitchWidth / 2 - arcDxTop} ${topPenaltyLineY} A ${penaltyArcRadius} ${penaltyArcRadius} 0 0 0 ${pitchWidth / 2 + arcDxTop} ${topPenaltyLineY}`}
                fill="none"
                stroke={lineColor}
                strokeWidth={2}
                opacity={lineMainOpacity}
              />

              <Circle
                cx={pitchWidth / 2}
                cy={topPenaltySpotY}
                r={3}
                fill={lineColor}
                opacity={lineMainOpacity}
              />

              <Rect
                x={(pitchWidth - penaltyAreaWidth) / 2}
                y={pitchMargin + fieldHeight - penaltyAreaDepth}
                width={penaltyAreaWidth}
                height={penaltyAreaDepth}
                fill="none"
                stroke={lineColor}
                strokeWidth={5}
                opacity={lineShadowOpacity}
              />

              <Rect
                x={(pitchWidth - penaltyAreaWidth) / 2}
                y={pitchMargin + fieldHeight - penaltyAreaDepth}
                width={penaltyAreaWidth}
                height={penaltyAreaDepth}
                fill="none"
                stroke={lineColor}
                strokeWidth={2}
                opacity={lineMainOpacity}
              />

              <Path
                d={`M ${pitchWidth / 2 - arcDxBottom} ${bottomPenaltyLineY} A ${penaltyArcRadius} ${penaltyArcRadius} 0 0 1 ${pitchWidth / 2 + arcDxBottom} ${bottomPenaltyLineY}`}
                fill="none"
                stroke={lineColor}
                strokeWidth={2}
                opacity={lineMainOpacity}
              />

              <Circle
                cx={pitchWidth / 2}
                cy={bottomPenaltySpotY}
                r={3}
                fill={lineColor}
                opacity={lineMainOpacity}
              />

              <Rect
                x={(pitchWidth - goalAreaWidth) / 2}
                y={pitchMargin}
                width={goalAreaWidth}
                height={goalAreaDepth}
                fill="none"
                stroke={lineColor}
                strokeWidth={5}
                opacity={lineShadowOpacity}
              />

              <Rect
                x={(pitchWidth - goalAreaWidth) / 2}
                y={pitchMargin}
                width={goalAreaWidth}
                height={goalAreaDepth}
                fill="none"
                stroke={lineColor}
                strokeWidth={2}
                opacity={lineMainOpacity}
              />

              <Rect
                x={(pitchWidth - goalAreaWidth) / 2}
                y={pitchMargin + fieldHeight - goalAreaDepth}
                width={goalAreaWidth}
                height={goalAreaDepth}
                fill="none"
                stroke={lineColor}
                strokeWidth={5}
                opacity={lineShadowOpacity}
              />

              <Rect
                x={(pitchWidth - goalAreaWidth) / 2}
                y={pitchMargin + fieldHeight - goalAreaDepth}
                width={goalAreaWidth}
                height={goalAreaDepth}
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
              </Svg>

              <Svg width={pitchWidth} height={pitchHeight} style={styles.drawSvg} pointerEvents="none">
                {drawPaths.map((path) => (
                  <Path
                    key={path.id}
                    d={pointsToSvgPath(path.points)}
                    fill="none"
                    stroke="#4FD1ED"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.95}
                  />
                ))}
                {activeDrawPoints.length > 1 ? (
                  <Path
                    d={pointsToSvgPath(activeDrawPoints)}
                    fill="none"
                    stroke="#4FD1ED"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.95}
                  />
                ) : null}
              </Svg>

              <View
                style={styles.drawGestureLayer}
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
                  setActiveDrawPoints((previous) => [...previous, { x: moveX, y: moveY }]);
                }}
                onResponderRelease={() => {
                  if (!isFreeDrawMode) return;
                  setActiveDrawPoints((previous) => {
                    if (previous.length > 1) {
                      setDrawPaths((paths) => [
                        ...paths,
                        { id: `draw-${Date.now()}-${paths.length}`, points: previous },
                      ]);
                    }
                    return [];
                  });
                }}
                onResponderTerminate={() => {
                  if (!isFreeDrawMode) return;
                  setActiveDrawPoints((previous) => {
                    if (previous.length > 1) {
                      setDrawPaths((paths) => [
                        ...paths,
                        { id: `draw-${Date.now()}-${paths.length}`, points: previous },
                      ]);
                    }
                    return [];
                  });
                }}
              />

              <View style={styles.playersLayer} pointerEvents={isFreeDrawMode ? 'none' : 'auto'}>
                {(hasLineupData ? boardPlayers : []).map((player, index: number) => (
                  <PlayerIcon
                    key={`team-${activeTeamId ?? 'none'}-slot-${index}`}
                    label={player.name}
                    position={player.pos}
                    photoUrl={player.photo}
                    rating={player.rating}
                    energy={player.energy}
                    coordinates={player.coordinates}
                    boundsWidth={pitchWidth}
                    boundsHeight={pitchHeight}
                    draggableEnabled={!isFreeDrawMode}
                  />
                ))}
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
            <Text style={styles.panelTitle}>TACTIC CONTROLS</Text>
            <View style={styles.tacticButtonsWrap}>
              {FORMATION_OPTIONS.map((key) => (
                <Pressable
                  key={key}
                  style={[styles.tacticButtonCard, currentFormation === key && styles.tacticButtonCardActive]}
                  onPress={() => setCurrentFormation(key)}
                >
                  <Text style={[styles.tacticButtonText, currentFormation === key && styles.tacticButtonTextActive]}>{key}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.ctaWrap}>
              <Pressable style={styles.ctaButton}>
                <Text style={styles.ctaButtonText}>COMPARE TACTICS</Text>
              </Pressable>
            </View>

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
              style={styles.clearDrawButton}
              onPress={() => {
                setDrawPaths([]);
                setActiveDrawPoints([]);
              }}
            >
              <Text style={styles.clearDrawButtonText}>CLEAR DRAWINGS</Text>
            </Pressable>
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
  },
  drawSvg: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  drawGestureLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 15,
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
  },
  panelTitle: {
    color: '#E6EDF3',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: 0.8,
  },
  tacticButtonsWrap: {
    marginBottom: 18,
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
  tacticButtonTextActive: {
    color: '#4FD1ED',
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
  ctaButtonText: {
    color: '#0D1117',
    fontWeight: '800',
    fontSize: 13,
    textAlign: 'center',
    letterSpacing: 0.8,
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
  clearDrawButton: {
    width: '100%',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#4FD1ED',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginTop: 2,
  },
  clearDrawButtonText: {
    color: '#4FD1ED',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.6,
  },
});
