export type TeamDatabaseItem = {
  id: number;
  name: string;
  league: string;
  leagueKey: 'ARG' | 'ESP' | 'COL' | 'ENG';
  teamLogo: string;
  leagueLogo: string;
  seasonLabel: string;
  fixtureId: string;
  defaultFormation: '4-4-2' | '3-5-2';
  isPopular: boolean;
};

export const DEFAULT_LEAGUE_FILTER = 'POPULAR';

export const POPULAR_LEAGUE_KEY = 'POPULAR' as const;

export type LeagueKey = 'POPULAR' | TeamDatabaseItem['league'];

const LEAGUE_LOGOS = {
  'Liga Profesional Argentina': 'https://media.api-sports.io/football/leagues/128.png',
  LaLiga: 'https://media.api-sports.io/football/leagues/140.png',
  'Liga BetPlay': 'https://media.api-sports.io/football/leagues/239.png',
  'Premier League': 'https://media.api-sports.io/football/leagues/39.png',
} as const;

export const TEAM_DATABASE: TeamDatabaseItem[] = [
  {
    id: 1,
    name: 'River Plate',
    league: 'Liga Profesional Argentina',
    leagueKey: 'ARG',
    teamLogo: 'https://media.api-sports.io/football/teams/435.png',
    leagueLogo: LEAGUE_LOGOS['Liga Profesional Argentina'],
    seasonLabel: '2028',
    fixtureId: '100',
    defaultFormation: '4-4-2',
    isPopular: true,
  },
  {
    id: 2,
    name: 'Boca Juniors',
    league: 'Liga Profesional Argentina',
    leagueKey: 'ARG',
    teamLogo: 'https://media.api-sports.io/football/teams/451.png',
    leagueLogo: LEAGUE_LOGOS['Liga Profesional Argentina'],
    seasonLabel: '2028',
    fixtureId: '101',
    defaultFormation: '4-4-2',
    isPopular: true,
  },
  {
    id: 3,
    name: 'Racing Club',
    league: 'Liga Profesional Argentina',
    leagueKey: 'ARG',
    teamLogo: 'https://media.api-sports.io/football/teams/436.png',
    leagueLogo: LEAGUE_LOGOS['Liga Profesional Argentina'],
    seasonLabel: '2028',
    fixtureId: '215665',
    defaultFormation: '3-5-2',
    isPopular: false,
  },

  {
    id: 4,
    name: 'Barcelona',
    league: 'LaLiga',
    leagueKey: 'ESP',
    teamLogo: 'https://media.api-sports.io/football/teams/529.png',
    leagueLogo: LEAGUE_LOGOS.LaLiga,
    seasonLabel: '2028',
    fixtureId: '999',
    defaultFormation: '4-4-2',
    isPopular: true,
  },
  {
    id: 5,
    name: 'Atletico Madrid',
    league: 'LaLiga',
    leagueKey: 'ESP',
    teamLogo: 'https://media.api-sports.io/football/teams/530.png',
    leagueLogo: LEAGUE_LOGOS.LaLiga,
    seasonLabel: '2028',
    fixtureId: '215663',
    defaultFormation: '3-5-2',
    isPopular: false,
  },
  {
    id: 6,
    name: 'Real Madrid',
    league: 'LaLiga',
    leagueKey: 'ESP',
    teamLogo: 'https://media.api-sports.io/football/teams/541.png',
    leagueLogo: LEAGUE_LOGOS.LaLiga,
    seasonLabel: '2028',
    fixtureId: '215662',
    defaultFormation: '4-4-2',
    isPopular: true,
  },

  {
    id: 7,
    name: 'Atletico Nacional',
    league: 'Liga BetPlay',
    leagueKey: 'COL',
    teamLogo: 'https://media.api-sports.io/football/teams/2392.png',
    leagueLogo: LEAGUE_LOGOS['Liga BetPlay'],
    seasonLabel: '2028',
    fixtureId: '102',
    defaultFormation: '4-4-2',
    isPopular: false,
  },
  {
    id: 8,
    name: 'Millonarios',
    league: 'Liga BetPlay',
    leagueKey: 'COL',
    teamLogo: 'https://media.api-sports.io/football/teams/1133.png',
    leagueLogo: LEAGUE_LOGOS['Liga BetPlay'],
    seasonLabel: '2028',
    fixtureId: '105',
    defaultFormation: '3-5-2',
    isPopular: true,
  },
  {
    id: 9,
    name: 'America de Cali',
    league: 'Liga BetPlay',
    leagueKey: 'COL',
    teamLogo: 'https://media.api-sports.io/football/teams/2391.png',
    leagueLogo: LEAGUE_LOGOS['Liga BetPlay'],
    seasonLabel: '2028',
    fixtureId: '215665',
    defaultFormation: '4-4-2',
    isPopular: false,
  },

  {
    id: 10,
    name: 'Liverpool',
    league: 'Premier League',
    leagueKey: 'ENG',
    teamLogo: 'https://media.api-sports.io/football/teams/40.png',
    leagueLogo: LEAGUE_LOGOS['Premier League'],
    seasonLabel: '2028',
    fixtureId: '103',
    defaultFormation: '4-4-2',
    isPopular: true,
  },
  {
    id: 11,
    name: 'Manchester United',
    league: 'Premier League',
    leagueKey: 'ENG',
    teamLogo: 'https://media.api-sports.io/football/teams/33.png',
    leagueLogo: LEAGUE_LOGOS['Premier League'],
    seasonLabel: '2028',
    fixtureId: '215664',
    defaultFormation: '4-4-2',
    isPopular: false,
  },
  {
    id: 12,
    name: 'Arsenal',
    league: 'Premier League',
    leagueKey: 'ENG',
    teamLogo: 'https://media.api-sports.io/football/teams/42.png',
    leagueLogo: LEAGUE_LOGOS['Premier League'],
    seasonLabel: '2028',
    fixtureId: '215664',
    defaultFormation: '3-5-2',
    isPopular: false,
  },
];

export const TEAMS_BY_LEAGUE: Record<LeagueKey, TeamDatabaseItem[]> = {
  POPULAR: TEAM_DATABASE.filter((team) => team.isPopular),
  'Liga Profesional Argentina': TEAM_DATABASE.filter((team) => team.league === 'Liga Profesional Argentina'),
  LaLiga: TEAM_DATABASE.filter((team) => team.league === 'LaLiga'),
  'Liga BetPlay': TEAM_DATABASE.filter((team) => team.league === 'Liga BetPlay'),
  'Premier League': TEAM_DATABASE.filter((team) => team.league === 'Premier League'),
};
