import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
  },
  {
    path: 'fields',
    loadComponent: () =>
      import('./pages/fields/fields.component').then(m => m.FieldsComponent),
  },
  {
    path: 'entropy',
    loadComponent: () =>
      import('./pages/entropy/entropy.component').then(m => m.EntropyComponent),
  },
  {
    path: 'gis',
    loadComponent: () =>
      import('./pages/gis/gis.component').then(m => m.GisComponent),
  },
  {
    path: 'query',
    loadComponent: () =>
      import('./pages/query/query.component').then(m => m.QueryComponent),
  },
  { path: '**', redirectTo: 'dashboard' },
];
