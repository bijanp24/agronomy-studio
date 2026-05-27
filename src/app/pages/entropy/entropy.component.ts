import { Component, ChangeDetectionStrategy, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';

import { WeatherService } from '../../services/weather.service';
import { AtmosphericSnapshot, EntropyReading, EntropyHistory } from '../../models/weather.models';

const FIELD_META = [
  { key: 'precip1Hour',       label: 'Precip 1hr',  unit: 'in',   max: 2.0  },
  { key: 'pressureAltimeter', label: 'Pressure',    unit: 'inHg', max: 31.5, min: 28.0 },
  { key: 'relativeHumidity',  label: 'Humidity',    unit: '%',    max: 100  },
  { key: 'windSpeed',         label: 'Wind',        unit: 'mph',  max: 60   },
  { key: 'temperature',       label: 'Temperature', unit: '°F',   max: 120, min: -20 },
] as const;

type FieldMetaKey = (typeof FIELD_META)[number]['key'];

@Component({
  selector: 'app-entropy',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatSlideToggleModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './entropy.component.html',
  styleUrl: './entropy.component.scss',
})
export class EntropyComponent implements OnInit, OnDestroy {
  private service = inject(WeatherService);

  readonly fieldMeta: ReadonlyArray<{
    key: FieldMetaKey;
    label: string;
    unit: string;
    max: number;
    min?: number;
  }> = FIELD_META;

  readonly current    = signal<EntropyReading | null>(null);
  readonly history    = signal<EntropyHistory | null>(null);
  readonly loading    = signal(false);
  readonly hasError   = signal(false);
  readonly autoRefresh = signal(false);
  readonly postalCode = signal('93650');

  readonly entropyPct = computed(() => {
    const c = this.current();
    return c ? Math.round(c.entropy * 100) : 0;
  });

  readonly coinFlip = computed(() => {
    const c = this.current();
    if (!c) return '—';
    return c.entropy >= 0.5 ? 'Heads' : 'Tails';
  });

  readonly d6 = computed(() => {
    const c = this.current();
    if (!c) return '—';
    return Math.floor(c.entropy * 6) + 1;
  });

  readonly d20 = computed(() => {
    const c = this.current();
    if (!c) return '—';
    return Math.floor(c.entropy * 20) + 1;
  });

  readonly percent = computed(() => {
    const c = this.current();
    if (!c) return '—';
    return (c.entropy * 100).toFixed(1) + '%';
  });

  private timer: ReturnType<typeof setInterval> | null = null;

  ngOnInit() {
    this.fetch();
  }

  ngOnDestroy() {
    this.clearTimer();
  }

  fetch() {
    this.loading.set(true);
    this.hasError.set(false);
    this.service.getEntropyCurrent(this.postalCode()).subscribe({
      next: r => { this.current.set(r); this.loading.set(false); this.loadHistory(); },
      error: () => { this.hasError.set(true); this.loading.set(false); },
    });
  }

  loadHistory() {
    this.service.getEntropyHistory().subscribe({
      next: h => { this.history.set(h); },
    });
  }

  toggleAuto(on: boolean) {
    this.autoRefresh.set(on);
    if (on) {
      this.timer = setInterval(() => this.fetch(), 5000);
    } else {
      this.clearTimer();
    }
  }

  private clearTimer() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  vectorPct(v: number): number {
    return Math.round(v * 100);
  }

  atmosphericVal(atmospheric: AtmosphericSnapshot, key: FieldMetaKey): number | string {
    return atmospheric[key];
  }

  sparklinePath(records: EntropyReading[]): string {
    if (!records.length) return '';
    const w = 600, h = 80, pad = 4;
    const step = (w - pad * 2) / Math.max(records.length - 1, 1);
    return records.map((r, i) => {
      const x = pad + i * step;
      const y = h - pad - (r.entropy * (h - pad * 2));
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
  }

  meanLine(h: EntropyHistory): string {
    const y = 80 - 4 - (h.stats.meanEntropy * (80 - 8));
    return `M 4 ${y.toFixed(1)} L 596 ${y.toFixed(1)}`;
  }
}
