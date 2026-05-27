import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatTableModule } from '@angular/material/table';
import { forkJoin } from 'rxjs';

import { FieldIntelligenceService } from '../../services/field-intelligence.service';
import { Field, NutrientBalance, YieldPrediction, FieldOperation } from '../../models/field-intelligence.models';

interface FieldDetail {
  field: Field;
  nutrients?: NutrientBalance;
  yield?: YieldPrediction;
  operations?: FieldOperation[];
}

@Component({
  selector: 'app-fields',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatExpansionModule,
    MatProgressBarModule,
    MatIconModule,
    MatDividerModule,
    MatChipsModule,
    MatTableModule,
  ],
  templateUrl: './fields.component.html',
  styleUrl: './fields.component.scss',
})
export class FieldsComponent implements OnInit {
  private service = inject(FieldIntelligenceService);

  details: FieldDetail[] = [];
  loading = true;
  error = '';

  readonly opColumns = ['operationType', 'timestamp', 'notes'];

  ngOnInit() {
    this.service.getFields().subscribe({
      next: res => {
        const fields = res.fields;
        if (!fields.length) { this.loading = false; return; }

        this.details = fields.map(f => ({ field: f }));

        fields.forEach((f, i) => {
          forkJoin({
            nutrients: this.service.getNutrientBalance(f.id),
            yield: this.service.getYieldPrediction(f.id),
            operations: this.service.getOperations(f.id),
          }).subscribe({
            next: d => {
              this.details[i] = {
                field: f,
                nutrients: d.nutrients,
                yield: d.yield,
                operations: d.operations.operations,
              };
            },
          });
        });

        this.loading = false;
      },
      error: () => { this.error = 'Could not load fields from :4302'; this.loading = false; },
    });
  }

  balanceClass(balance: number): string {
    if (balance < 0) return 'danger';
    if (balance < 20) return 'warn';
    return 'ok';
  }

  yieldTonnes(kgPerHa: number): string {
    return (kgPerHa / 1000).toFixed(2);
  }

  factorPct(v: number): number {
    return Math.round(v * 100);
  }
}
