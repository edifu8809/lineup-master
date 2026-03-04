import { useCallback, useEffect, useMemo, useState } from 'react';
import mockLineup_100 from '../constants/mockLineup_100.json';
import mockLineup_101 from '../constants/mockLineup_101.json';
import mockLineup_102 from '../constants/mockLineup_102.json';
import mockLineup_103 from '../constants/mockLineup_103.json';
import mockLineup_105 from '../constants/mockLineup_105.json';
import mockLineup_215662 from '../constants/mockLineup_215662.json';
import mockLineup_215663 from '../constants/mockLineup_215663.json';
import mockLineup_215664 from '../constants/mockLineup_215664.json';
import mockLineup_215665 from '../constants/mockLineup_215665.json';
import mockLineup_215666 from '../constants/mockLineup_215666.json';
import mockLineup_999 from '../constants/mockLineup_999.json';
import { FORMATIONS } from '../constants/formations';

export const DEVELOPMENT_MODE = true;

const LINEUPS_ENDPOINT = 'https://v3.football.api-sports.io/fixtures/lineups';
const API_SPORTS_HOST = 'v3.football.api-sports.io';

const MOCK_DATA = {
  '100': mockLineup_100,
  '101': mockLineup_101,
  '102': mockLineup_102,
  '103': mockLineup_103,
  '105': mockLineup_105,
  '215662': mockLineup_215662,
  '215663': mockLineup_215663,
  '215664': mockLineup_215664,
  '215665': mockLineup_215665,
  '215666': mockLineup_215666,
  '999': mockLineup_999,
};

const GENERIC_MOCK_LINEUP = {
  get: 'lineups',
  parameters: { fixture: 'generic' },
  errors: [],
  results: 1,
  paging: { current: 1, total: 1 },
  response: [
    {
      team: {
        id: 0,
        name: 'Generic Squad',
        logo: '',
      },
      formation: '4-4-2',
      coach: {
        id: 0,
        name: 'Generic Coach',
        photo: '',
      },
      startXI: [
        { player: { id: 1, name: 'GK Generic', number: 1, pos: 'G', grid: '1:1', photo: '' } },
        { player: { id: 2, name: 'RB Generic', number: 2, pos: 'D', grid: '2:1', photo: '' } },
        { player: { id: 3, name: 'RCB Generic', number: 3, pos: 'D', grid: '2:2', photo: '' } },
        { player: { id: 4, name: 'LCB Generic', number: 4, pos: 'D', grid: '2:3', photo: '' } },
        { player: { id: 5, name: 'LB Generic', number: 5, pos: 'D', grid: '2:4', photo: '' } },
        { player: { id: 6, name: 'RM Generic', number: 6, pos: 'M', grid: '3:1', photo: '' } },
        { player: { id: 7, name: 'RCM Generic', number: 7, pos: 'M', grid: '3:2', photo: '' } },
        { player: { id: 8, name: 'LCM Generic', number: 8, pos: 'M', grid: '3:3', photo: '' } },
        { player: { id: 9, name: 'LM Generic', number: 9, pos: 'M', grid: '3:4', photo: '' } },
        { player: { id: 10, name: 'RS Generic', number: 10, pos: 'F', grid: '4:2', photo: '' } },
        { player: { id: 11, name: 'LS Generic', number: 11, pos: 'F', grid: '4:3', photo: '' } },
      ],
      substitutes: [],
    },
  ],
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const parseRating = (value) => {
  if (value === null || value === undefined || value === '') {
    return 7.0;
  }

  const numeric = Number.parseFloat(value);
  if (!Number.isFinite(numeric)) {
    return 7.0;
  }

  return clamp(numeric, 0, 10);
};

const randomDemoRating = () => {
  const min = 5;
  const max = 9.8;
  const value = min + Math.random() * (max - min);
  return Number(value.toFixed(1));
};

const formationToCoordinates = (formationKey = '4-4-2') => {
  const template = FORMATIONS[formationKey] ?? FORMATIONS['4-4-2'];

  return template.map((position) => ({
    label: position.label,
    top: `${clamp(position.y * 100, 10, 93).toFixed(2)}%`,
    left: `${clamp(position.x * 100, 8, 92).toFixed(2)}%`,
  }));
};

const inferPositionCode = (label = '') => {
  const normalized = String(label).toUpperCase();
  if (normalized === 'GK') return 'G';
  if (normalized.includes('B') || normalized === 'CB') return 'D';
  if (normalized.includes('M') || normalized.includes('W')) return 'M';
  return 'F';
};

const buildFormationFallbackPayload = (requestedFixture, formationKey = '4-4-2') => {
  const coordinates = formationToCoordinates(formationKey);

  return {
    get: 'fixtures/lineups',
    parameters: { fixture: String(requestedFixture) },
    errors: [],
    results: 1,
    paging: { current: 1, total: 1 },
    response: [
      {
        team: {
          id: 0,
          name: 'Fallback Squad',
          logo: '',
        },
        formation: formationKey,
        coach: {
          id: 0,
          name: 'Fallback Coach',
          photo: '',
        },
        startXI: coordinates.map((coordinate, index) => ({
          player: {
            id: 9000 + index,
            name: `Player ${index + 1}`,
            number: index + 1,
            pos: inferPositionCode(coordinate.label),
            grid: null,
            photo: '',
            coordinates: {
              top: coordinate.top,
              left: coordinate.left,
            },
          },
        })),
        substitutes: [],
      },
    ],
  };
};

const parseGrid = (grid) => {
  if (!grid || typeof grid !== 'string') return { row: 1, col: 1 };
  const [rowRaw, colRaw] = grid.split(':');
  const row = Number.parseInt(rowRaw, 10);
  const col = Number.parseInt(colRaw, 10);
  return {
    row: Number.isFinite(row) && row > 0 ? row : 1,
    col: Number.isFinite(col) && col > 0 ? col : 1,
  };
};

const hasValidGrid = (grid) => {
  if (typeof grid !== 'string') return false;
  const [rowRaw, colRaw] = grid.split(':');
  const row = Number.parseInt(rowRaw, 10);
  const col = Number.parseInt(colRaw, 10);
  return Number.isFinite(row) && Number.isFinite(col) && row > 0 && col > 0;
};

const hasDirectCoordinates = (coordinates) =>
  !!coordinates && typeof coordinates.top === 'string' && typeof coordinates.left === 'string';

export const convertToCoordinates = (grid, options = {}) => {
  const { row, col } = parseGrid(grid);
  const maxRows = options.maxRows && options.maxRows > 1 ? options.maxRows : 4;
  const rowMax = options.rowMax && options.rowMax >= 1 ? options.rowMax : 4;

  const topValue = maxRows === 1 ? 50 : 90 - ((row - 1) / (maxRows - 1)) * 80;
  const leftValue = (col / (rowMax + 1)) * 100;

  return {
    top: `${clamp(topValue, 10, 90).toFixed(2)}%`,
    left: `${clamp(leftValue, 8, 92).toFixed(2)}%`,
  };
};

const normalizeLineup = (lineup, fallbackFormation = '4-4-2') => {
  const players = lineup?.startXI ?? [];
  const effectiveFormation = lineup?.formation || fallbackFormation || '4-4-2';
  const formationCoordinates = formationToCoordinates(effectiveFormation);
  const rowStats = players.reduce(
    (acc, item) => {
      if (!hasValidGrid(item?.player?.grid)) {
        return acc;
      }
      const { row, col } = parseGrid(item?.player?.grid);
      acc.maxRows = Math.max(acc.maxRows, row);
      acc.rowMaxMap[row] = Math.max(acc.rowMaxMap[row] || 0, col);
      return acc;
    },
    { maxRows: 1, rowMaxMap: {} }
  );

  const mappedPlayers = players.map((item, index) => {
    const player = item?.player ?? {};
    const { row } = parseGrid(player.grid);
    const hasApiRating = player.rating !== null && player.rating !== undefined && player.rating !== '';
    const ratingValue = hasApiRating ? parseRating(player.rating) : randomDemoRating();
    const normalizedEnergy = clamp(ratingValue / 10, 0, 1);
    const directCoordinates = player.coordinates;
    const gridCoordinates = hasValidGrid(player.grid)
      ? convertToCoordinates(player.grid, {
          maxRows: rowStats.maxRows,
          rowMax: rowStats.rowMaxMap[row] || 4,
        })
      : null;
    const formationCoordinatesByIndex = formationCoordinates[index]
      ? {
          top: formationCoordinates[index].top,
          left: formationCoordinates[index].left,
        }
      : null;

    return {
      id: player.id,
      name: player.name,
      number: player.number,
      pos: player.pos,
      grid: player.grid,
      photo: player.photo,
      rating: Number(ratingValue.toFixed(1)),
      energy: Number(normalizedEnergy.toFixed(2)),
      coordinates:
        hasDirectCoordinates(directCoordinates)
          ? directCoordinates
          : gridCoordinates || formationCoordinatesByIndex || formationToCoordinates(fallbackFormation || '4-4-2')[index],
    };
  });

  const normalizedLineup = {
    team: {
      ...lineup?.team,
      logo: lineup?.team?.logo,
    },
    formation: lineup?.formation,
    coach: lineup?.coach,
    players: mappedPlayers,
    substitutes: lineup?.substitutes ?? [],
  };

  console.log('🧭 Normalización completada:', {
    team: normalizedLineup?.team?.name ?? 'N/A',
    formation: normalizedLineup?.formation ?? 'N/A',
    mappedPlayers: normalizedLineup?.players?.length ?? 0,
  });

  return normalizedLineup;
};

export default function useFootballTactics({ fixtureId, developmentMode = DEVELOPMENT_MODE, defaultFormation } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLineups = useCallback(async () => {
    try {
      console.log(
        `[useFootballTactics] Iniciando fetchLineups en modo ${developmentMode ? 'DEVELOPMENT_MODE (Mock)' : 'API Real'}`
      );

      setLoading(true);
      setError(null);
      setData(null);

      const apiKey = process.env.EXPO_PUBLIC_FOOTBALL_API_KEY;
      console.log('[useFootballTactics] fixtureId:', fixtureId);
      console.log('[useFootballTactics] API Key detectada: ', !!apiKey);

      const payload = developmentMode
        ? (() => {
            const requestedFixture = String(fixtureId || '215662');
            const selectedMock = MOCK_DATA[requestedFixture];
            console.log('[DEBUG] Buscando archivo: constants/mockLineup_' + requestedFixture + '.json');

            if (!selectedMock) {
              console.warn(
                `[useFootballTactics] mockLineup_${requestedFixture}.json no existe. Se usa fallback de equipo genérico.`
              );
            } else {
              console.log(`📦 Usando datos locales de mock fixture ${requestedFixture}`);
            }

            return selectedMock ?? buildFormationFallbackPayload(requestedFixture, defaultFormation || '4-4-2');
          })()
        : await (async () => {
            if (!apiKey) {
              throw new Error('Missing EXPO_PUBLIC_FOOTBALL_API_KEY in environment variables.');
            }

            if (!fixtureId) {
              throw new Error('fixtureId is required when DEVELOPMENT_MODE is false.');
            }

            const url = `${LINEUPS_ENDPOINT}?fixture=${fixtureId}`;
            console.log('🔗 URL de consulta:', url);
            const response = await fetch(url, {
              method: 'GET',
              headers: {
                'x-apisports-host': API_SPORTS_HOST,
                'x-apisports-key': apiKey,
              },
            });

            console.log('[useFootballTactics] Response status:', response.status);

            if (!response.ok) {
              throw new Error(`SportAPI request failed with status ${response.status}.`);
            }

            const rawJson = await response.json();
            console.log('💎 RESPUESTA CRUDA DE LA API:', JSON.stringify(rawJson, null, 2));
            console.log('[useFootballTactics] Raw API JSON:', rawJson);
            return rawJson;
          })();

      const effectivePayload =
        Array.isArray(payload?.response) && payload.response.length > 0
          ? payload
          : buildFormationFallbackPayload(fixtureId || 'generic', defaultFormation || '4-4-2');

      const normalized = (effectivePayload?.response ?? []).map((lineup) =>
        normalizeLineup(lineup, defaultFormation || '4-4-2')
      );
      setData({
        raw: effectivePayload,
        lineups: normalized,
      });
    } catch (requestError) {
      console.error('[useFootballTactics] Error en fetchLineups:', requestError);
      console.warn('⚠️ La petición falló. Revisa la pestaña Network del navegador para ver el error de red.');
      setError(requestError instanceof Error ? requestError : new Error('Unknown error fetching lineups.'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [defaultFormation, developmentMode, fixtureId]);

  useEffect(() => {
    fetchLineups();
  }, [fetchLineups]);

  const helpers = useMemo(
    () => ({
      convertToCoordinates,
      refetch: fetchLineups,
    }),
    [fetchLineups]
  );

  return {
    data,
    loading,
    error,
    ...helpers,
  };
}
