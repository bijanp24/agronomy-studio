import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { isValidCoordinate } from '../../core/api-params';
import { AgronomyApi } from '../../core/agronomy-api';
import { AgronomyLocationSummary } from '../../core/models';

@Component({
  selector: 'ag-agronomy-page',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule],
  templateUrl: './agronomy-page.html',
  styleUrl: './agronomy-page.css'
})
export class AgronomyPage {
  private readonly api = inject(AgronomyApi);

  readonly latitude = signal(36.7378);
  readonly longitude = signal(-119.7871);
  readonly crop = signal('almond');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly summary = signal<AgronomyLocationSummary | null>(null);
  readonly canSubmit = computed(() => isValidCoordinate(this.latitude(), this.longitude()) && this.crop().trim().length > 0);
  readonly hasWarnings = computed(() => Object.keys(this.summary()?.warnings ?? {}).length > 0);

  constructor() {
    this.loadSummary();
  }

  loadSummary(): void {
    if (!this.canSubmit()) {
      this.error.set('Enter a valid latitude, longitude, and crop.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.api.locationSummary({
      latitude: this.latitude(),
      longitude: this.longitude(),
      crop: this.crop()
    }).subscribe({
      next: (summary) => {
        this.summary.set(summary);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Unable to load the agronomy summary from the local mock API.');
        this.loading.set(false);
      }
    });
  }
}
