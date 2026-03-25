import { Injectable } from '@angular/core';
import { DEFAULT_SETTINGS } from '../defaults';
import { Settings } from '../models';
import { LocalStorageService } from '../services/local-storage.service';
import { STORAGE_KEYS } from '../storage-keys';

@Injectable({ providedIn: 'root' })
export class SettingsLocalStorageRepository {
  constructor(private readonly storage: LocalStorageService) {}

  get(): Settings {
    return this.storage.getItem<Settings>(STORAGE_KEYS.settings) ?? DEFAULT_SETTINGS;
  }

  save(settings: Settings): void {
    this.storage.setItem(STORAGE_KEYS.settings, settings);
  }
}
