import { Injectable } from '@angular/core';
import { PayoutPeriod, PeriodId } from '../models';
import { LocalStorageService } from '../services/local-storage.service';
import { STORAGE_KEYS } from '../storage-keys';
import { calculateWeeksFromDateRange, deriveStartDateFromEndAndWeeks } from '../utils/period-calculation';

type LegacyPeriod = PayoutPeriod & { lastDate?: string };

@Injectable({ providedIn: 'root' })
export class PeriodsLocalStorageRepository {
  constructor(private readonly storage: LocalStorageService) {}

  getAll(): PayoutPeriod[] {
    const raw = this.storage.getItem<LegacyPeriod[]>(STORAGE_KEYS.periods) ?? [];
    let changed = false;

    const normalized = raw.map((period) => {
      const endDate = period.endDate ?? period.lastDate ?? null;
      const effectiveEndDate = endDate ?? period.startDate;
      const startDate = period.startDate ?? deriveStartDateFromEndAndWeeks(effectiveEndDate, period.weeks ?? 1);
      const weeks = endDate ? calculateWeeksFromDateRange(startDate, endDate) : Math.max(1, period.weeks ?? 1);

      const next: PayoutPeriod = {
        ...period,
        startDate,
        endDate,
        weeks,
      };

      if (!period.startDate || period.endDate !== endDate || (endDate !== null && period.weeks !== weeks) || 'lastDate' in period) {
        changed = true;
      }

      return next;
    });

    if (changed) {
      this.saveAll(normalized);
    }

    return normalized;
  }

  getById(id: PeriodId): PayoutPeriod | undefined {
    return this.getAll().find((period) => period.id === id);
  }

  saveAll(periods: PayoutPeriod[]): void {
    this.storage.setItem(STORAGE_KEYS.periods, periods);
  }

  upsert(period: PayoutPeriod): PayoutPeriod[] {
    const all = this.getAll();
    const index = all.findIndex((item) => item.id === period.id);
    const next = [...all];
    if (index >= 0) {
      next[index] = period;
    } else {
      next.push(period);
    }
    this.saveAll(next);
    return next;
  }

  delete(id: PeriodId): PayoutPeriod[] {
    const next = this.getAll().filter((period) => period.id !== id);
    this.saveAll(next);
    return next;
  }
}
