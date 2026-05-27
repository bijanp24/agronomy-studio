import { Component, ChangeDetectionStrategy, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatTableModule } from '@angular/material/table';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

import { FieldIntelligenceService } from '../../services/field-intelligence.service';
import { FieldSummary } from '../../models/field-intelligence.models';

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatChipsModule,
    MatTableModule,
    MatProgressBarModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private service = inject(FieldIntelligenceService);

  readonly fields   = signal<FieldSummary[]>([]);
  readonly loading  = signal(true);
  readonly hasError = signal(false);

  readonly displayedColumns = ['fieldName', 'crop', 'stress', 'yield', 'confidence'];

  readonly criticalCount = computed(() =>
    this.fields().filter(f => f.stressLabel === 'critical' || f.stressLabel === 'high').length
  );

  readonly avgYield = computed(() => {
    const fs = this.fields();
    if (!fs.length) return '—';
    const avg = fs.reduce((s, f) => s + f.predictedYieldKgPerHa, 0) / fs.length;
    return (avg / 1000).toFixed(2);
  });

  ngOnInit() {
    this.service.getDashboardSummary().subscribe({
      next: res => { this.fields.set(res.fields); this.loading.set(false); },
      error: () => { this.hasError.set(true); this.loading.set(false); },
    });
  }

  yieldTonnes(kgPerHa: number): string {
    return (kgPerHa / 1000).toFixed(2);
  }
}
