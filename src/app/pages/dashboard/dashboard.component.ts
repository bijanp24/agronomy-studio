import { Component, OnInit, inject } from '@angular/core';
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
  standalone: true,
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

  fields: FieldSummary[] = [];
  loading = true;
  error = '';

  readonly displayedColumns = ['fieldName', 'crop', 'stress', 'yield', 'confidence'];

  ngOnInit() {
    this.service.getDashboardSummary().subscribe({
      next: res => { this.fields = res.fields; this.loading = false; },
      error: () => { this.error = 'Could not load dashboard. Is the field-intelligence server running on :4302?'; this.loading = false; },
    });
  }

  stressColor(label: string): string {
    return { low: 'primary', moderate: 'accent', high: 'warn', critical: 'warn' }[label] ?? 'primary';
  }

  stressBarColor(score: number): string {
    if (score < 25) return '#16803c';
    if (score < 50) return '#b45309';
    if (score < 75) return '#dc2626';
    return '#7f1d1d';
  }

  yieldTonnes(kgPerHa: number): string {
    return (kgPerHa / 1000).toFixed(2);
  }

  criticalCount(): number {
    return this.fields.filter(f => f.stressLabel === 'critical' || f.stressLabel === 'high').length;
  }

  avgYield(): string {
    if (!this.fields.length) return '—';
    const avg = this.fields.reduce((s, f) => s + f.predictedYieldKgPerHa, 0) / this.fields.length;
    return (avg / 1000).toFixed(2);
  }
}
