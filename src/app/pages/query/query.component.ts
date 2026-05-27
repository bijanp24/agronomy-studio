import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

import { QueryService } from '../../services/query.service';
import { LlmProvider, QueryResponse, QueryHistoryEntry } from '../../models/query.models';

const HISTORY_KEY = 'agronomy_query_history';

@Component({
  selector: 'app-query',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatTableModule,
    MatProgressBarModule,
    MatChipsModule,
    MatTooltipModule,
    MatSlideToggleModule,
  ],
  templateUrl: './query.component.html',
  styleUrl: './query.component.scss',
})
export class QueryComponent {
  private queryService = inject(QueryService);

  readonly question = signal('');
  readonly provider = signal<LlmProvider>('mock');
  readonly loading = signal(false);
  readonly result = signal<QueryResponse | null>(null);
  readonly error = signal<string | null>(null);
  readonly showSql = signal(false);
  readonly history = signal<QueryHistoryEntry[]>(this.loadHistory());

  readonly columns = computed(() => this.result()?.columns.map(c => c.name) ?? []);

  submit(): void {
    const q = this.question().trim();
    if (!q || this.loading()) return;

    this.loading.set(true);
    this.error.set(null);
    this.result.set(null);

    this.queryService.query(q, this.provider()).subscribe({
      next: res => {
        this.result.set(res);
        this.loading.set(false);
        this.addToHistory(q, res.rowCount);
      },
      error: err => {
        this.error.set(err?.error?.error ?? 'An unexpected error occurred. Please try again.');
        this.loading.set(false);
      },
    });
  }

  selectHistory(entry: QueryHistoryEntry): void {
    this.question.set(entry.question);
  }

  clearHistory(): void {
    this.history.set([]);
    localStorage.removeItem(HISTORY_KEY);
  }

  private addToHistory(question: string, rowCount: number): void {
    const entry: QueryHistoryEntry = {
      question,
      timestamp: new Date().toISOString(),
      rowCount,
    };
    const updated = [entry, ...this.history().filter(h => h.question !== question)].slice(0, 20);
    this.history.set(updated);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  }

  private loadHistory(): QueryHistoryEntry[] {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
}
