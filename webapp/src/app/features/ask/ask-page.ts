import { DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AgronomyApi } from '../../core/agronomy-api';
import { AgronomySearchResult } from '../../core/models';

@Component({
  selector: 'ag-ask-page',
  standalone: true,
  imports: [DecimalPipe, FormsModule],
  templateUrl: './ask-page.html',
  styleUrl: './ask-page.css'
})
export class AskPage {
  private readonly api = inject(AgronomyApi);

  readonly query = signal('How much should I irrigate almonds near Fresno this week?');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly result = signal<AgronomySearchResult | null>(null);

  submit(): void {
    const question = this.query().trim();
    if (!question) {
      this.error.set('Enter an agronomy question.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.api.search({
      query: question,
      latitude: 36.7378,
      longitude: -119.7871,
      cropName: 'almond'
    }).subscribe({
      next: (result) => {
        this.result.set(result);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Unable to run the agronomy search contract.');
        this.loading.set(false);
      }
    });
  }
}
