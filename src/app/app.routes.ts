import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent)
  },
  {
    path: 'team',
    loadComponent: () => import('./pages/team/team.component').then(m => m.TeamComponent)
  },
  {
    path: 'archiv',
    loadComponent: () => import('./pages/archiv/archiv.component').then(m => m.ArchivComponent)
  }
];
