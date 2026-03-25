import { Injectable } from '@angular/core';
import { PayoutShare, PeriodId } from '../models';
import { LocalStorageService } from '../services/local-storage.service';
import { STORAGE_KEYS } from '../storage-keys';

@Injectable({ providedIn: 'root' })
export class SharesLocalStorageRepository {
  constructor(private readonly storage: LocalStorageService) {}

  getAll(): PayoutShare[] {
    return this.storage.getItem<PayoutShare[]>(STORAGE_KEYS.shares) ?? [];
  }

  getByPeriodId(periodId: PeriodId): PayoutShare[] {
    return this.getAll().filter((share) => share.periodId === periodId);
  }

  saveForPeriod(periodId: PeriodId, shares: PayoutShare[]): void {
    const remaining = this.getAll().filter((share) => share.periodId !== periodId);
    this.storage.setItem(STORAGE_KEYS.shares, [...remaining, ...shares]);
  }

  saveAll(shares: PayoutShare[]): void {
    this.storage.setItem(STORAGE_KEYS.shares, shares);
  }
}
