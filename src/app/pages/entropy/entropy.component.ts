import { Component, OnInit, OnDestroy, inject } from '@angular/core';
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
import { EntropyReading, EntropyHistory } from '../../models/weather.models';

const FIELD_META = [
  { key: 'precip1Hour',       label: 'Precip 1hr',  unit: 'in',   max: 2.0  },
  { key: 'pressureAltimeter', label: 'Pressure',    unit: 'inHg', max: 31.5, min: 28.0 },
  { key: 'relativeHumidity',  label: 'Humidity',    unit: '%',    max: 100  },
  { key: 'windSpeed',         label: 'Wind',        unit: 'mph',  max: 60   },
  { key: 'temperature',       label: 'Temperature', unit: '°F',   max: 120, min: -20 },
] as const;

@Component({
  selector: 'app-entropy',
  standalone: true,
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

  readonly fieldMeta = FIELD_META;

  current: EntropyReading | null = null;
  history: EntropyHistory | null = null;
  loading = false;
  error = '';
  autoRefresh = false;
  postalCode = '93650';

  private timer: ReturnType<typeof setInterval> | null = null;

  ngOnInit() {
    this.fetch();
    this.loadHistory();
  }

  ngOnDestroy() {
    this.clearTimer();
  }

  fetch() {
    this.loading = true;
    this.service.getEntropyCurrent(this.postalCode).subscribe({
      next: r => { this.current = r; this.loading = false; this.loadHistory(); },
      error: () => { this.error = 'Could not reach weather-intelligence-app on :4300'; this.loading = false; },
    });
  }

  loadHistory() {
    this.service.getEntropyHistory().subscribe({
      next: h => { this.history = h; },
    });
  }

  toggleAuto(on: boolean) {
    this.autoRefresh = on;
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

  entropyPct(): number {
    return this.current ? Math.round(this.current.entropy * 100) : 0;
  }

  coinFlip(): string {
    if (!this.current) return '—';
    return this.current.entropy >= 0.5 ? 'Heads' : 'Tails';
  }

  d6(): number | string {
    if (!this.current) return '—';
    return Math.floor(this.current.entropy * 6) + 1;
  }

  d20(): number | string {
    if (!this.current) return '—';
    return Math.floor(this.current.entropy * 20) + 1;
  }

  percent(): string {
    if (!this.current) return '—';
    return (this.current.entropy * 100).toFixed(1) + '%';
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
