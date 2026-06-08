import { DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AgronomyApi } from '../../core/agronomy-api';
import { AgronomyLocationSummary } from '../../core/models';

@Component({
  selector: 'ag-dashboard-page',
  standalone: true,
  imports: [DatePipe, DecimalPipe, PercentPipe, RouterLink],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.css'
})
export class DashboardPage {
  private readonly api = inject(AgronomyApi);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly summary = signal<AgronomyLocationSummary | null>(null);
  readonly recommendation = computed(() => this.summary()?.irrigation ?? null);
  readonly riskLevel = computed(() => {
    const rec = this.recommendation();
    if (!rec) {
      return 'Pending';
    }

    return rec.heatRisk ? 'Heat watch' : 'Normal';
  });

  constructor() {
    this.refresh();
  }

  refresh(): void {
    this.loading.set(true);
    this.error.set(null);

    this.api.locationSummary({ latitude: 36.7378, longitude: -119.7871, crop: 'almond' }).subscribe({
      next: (summary) => {
        this.summary.set(summary);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('The local agronomy mock API is not responding.');
        this.loading.set(false);
      }
    });
  }
}
