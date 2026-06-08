import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { AgronomyApi } from '../../core/agronomy-api';
import { ServiceHealth } from '../../core/models';

@Component({
  selector: 'ag-diagnostics-page',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './diagnostics-page.html',
  styleUrl: './diagnostics-page.css'
})
export class DiagnosticsPage {
  private readonly api = inject(AgronomyApi);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly services = signal<ServiceHealth[]>([]);

  constructor() {
    this.check();
  }

  check(): void {
    this.loading.set(true);
    this.error.set(null);

    forkJoin([this.api.agronomyHealth(), this.api.aiHealth()]).subscribe({
      next: (services) => {
        this.services.set(services);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('One or more local mock services did not respond.');
        this.loading.set(false);
      }
    });
  }
}
