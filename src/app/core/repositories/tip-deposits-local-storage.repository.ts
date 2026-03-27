import { Injectable } from '@angular/core';
import { PeriodId, TipDeposit } from '../models';
import { LocalStorageService } from '../services/local-storage.service';
import { STORAGE_KEYS } from '../storage-keys';

type LegacyTipDeposit = TipDeposit & { amount: number | string };

@Injectable({ providedIn: 'root' })
export class TipDepositsLocalStorageRepository {
  constructor(private readonly storage: LocalStorageService) {}

  getAll(): TipDeposit[] {
    const raw = this.storage.getItem<LegacyTipDeposit[]>(STORAGE_KEYS.deposits) ?? [];
    return raw
      .map((deposit) => {
        const amount = deposit.amount;
        return {
          ...deposit,
          amount: Number.isFinite(amount) ? amount : 0,
        };
      })
      .filter((deposit) => Number.isFinite(deposit.amount) && deposit.amount !== 0);
  }

  saveAll(deposits: TipDeposit[]): void {
    this.storage.setItem(STORAGE_KEYS.deposits, deposits);
  }

  getByPeriodId(periodId: PeriodId): TipDeposit[] {
    return this.getAll()
      .filter((deposit) => deposit.periodId === periodId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  add(deposit: TipDeposit): TipDeposit[] {
    const next = [...this.getAll(), deposit];
    this.saveAll(next);
    return this.getByPeriodId(deposit.periodId);
  }

  deleteById(id: string): TipDeposit | null {
    const all = this.getAll();
    const target = all.find((deposit) => deposit.id === id);
    if (!target) {
      return null;
    }
    this.saveAll(all.filter((deposit) => deposit.id !== id));
    return target;
  }

  deleteByPeriodId(periodId: PeriodId): void {
    this.saveAll(this.getAll().filter((deposit) => deposit.periodId !== periodId));
  }
}
