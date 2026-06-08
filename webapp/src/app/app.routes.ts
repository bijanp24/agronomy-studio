import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/dashboard/dashboard-page').then((m) => m.DashboardPage)
  },
  {
    path: 'agronomy',
    loadComponent: () => import('./features/agronomy/agronomy-page').then((m) => m.AgronomyPage)
  },
  {
    path: 'ask',
    loadComponent: () => import('./features/ask/ask-page').then((m) => m.AskPage)
  },
  {
    path: 'diagnostics',
    loadComponent: () => import('./features/diagnostics/diagnostics-page').then((m) => m.DiagnosticsPage)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
