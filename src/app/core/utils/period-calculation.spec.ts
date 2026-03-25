import {
  buildPeriod,
  buildSharesForPeriod,
  calculateAdjustedFactor,
  calculateTrend,
  recalculateShares,
} from './period-calculation';

describe('period-calculation', () => {
  it('builds shares and rounds payouts down to 5-euro steps', () => {
    const period = buildPeriod(
      {
        id: 'period-1',
        totalTip: 1200,
        carryOverIncluded: 1000,
        startDate: '2026-03-01',
        endDate: '2026-03-28',
        payoutDate: null,
      },
      undefined,
    );

    const shares = buildSharesForPeriod(
      period.id,
      [
        {
          id: 'a',
          name: 'A',
          weeklyHours: 40,
          baseFactor: 1,
          active: true,
          createdAt: '2026-03-25T00:00:00.000Z',
          updatedAt: '2026-03-25T00:00:00.000Z',
        },
        {
          id: 'b',
          name: 'B',
          weeklyHours: 20,
          baseFactor: 0.5,
          active: true,
          createdAt: '2026-03-25T00:00:00.000Z',
          updatedAt: '2026-03-25T00:00:00.000Z',
        },
      ],
      period.carryOverIncluded,
    );

    const result = recalculateShares(period, shares);
    expect(result.totalAdjustedFactor).toBe(1.5);
    expect(result.shares[0].amount).toBe(665);
    expect(result.shares[1].amount).toBe(330);
    expect(result.controlSum).toBe(995);
    expect(result.remainder).toBe(5);
  });

  it('reduces adjusted factor from sick units based on period weeks', () => {
    expect(calculateAdjustedFactor(1, 4, 1)).toBe(0.75);
    expect(calculateAdjustedFactor(1, 4, 4)).toBe(0);
    expect(calculateAdjustedFactor(1, 4, 6)).toBe(0);
  });

  it('returns trend icon from previous period comparison', () => {
    const trend = calculateTrend(150, 100);
    expect(trend.percent).toBe(50);
    expect(trend.icon).toBe('up');
  });
});
