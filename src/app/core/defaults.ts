import { Employee, Settings } from './models';
import { calculateBaseFactorFromHours } from './utils/period-calculation';

export const DEFAULT_SETTINGS: Settings = {
  referenceWeeklyHours: 40,
  currency: 'EUR',
  locale: 'de-DE',
};

const DEFAULT_EMPLOYEE_TEMPLATE: Array<Pick<Employee, 'id' | 'name' | 'weeklyHours' | 'baseFactor'>> = [
  { id: 'angi', name: 'Angi', weeklyHours: 40, baseFactor: 1 },
  { id: 'frank', name: 'Frank', weeklyHours: 38.5, baseFactor: 0.9625 },
  { id: 'paola', name: 'Paola', weeklyHours: 30, baseFactor: 0.75 },
  { id: 'concetta', name: 'Concetta', weeklyHours: 20, baseFactor: 0.5 },
  { id: 'vanessa', name: 'Vanessa', weeklyHours: 20, baseFactor: 0.5 },
  { id: 'kimi', name: 'Kimi', weeklyHours: 20, baseFactor: 0.5 },
];

export function defaultEmployees(nowIso: string = new Date().toISOString()): Employee[] {
  return DEFAULT_EMPLOYEE_TEMPLATE.map((item) => ({
    ...item,
    baseFactor: calculateBaseFactorFromHours(item.weeklyHours, 40),
    active: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  }));
}
