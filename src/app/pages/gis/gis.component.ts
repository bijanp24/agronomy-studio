import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTableModule } from '@angular/material/table';

import { FieldIntelligenceService } from '../../services/field-intelligence.service';
import { GeoJsonFeature } from '../../models/field-intelligence.models';

@Component({
  selector: 'app-gis',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatProgressBarModule,
    MatIconModule,
    MatChipsModule,
    MatTableModule,
  ],
  templateUrl: './gis.component.html',
  styleUrl: './gis.component.scss',
})
export class GisComponent implements OnInit {
  private service = inject(FieldIntelligenceService);

  features = signal<GeoJsonFeature[]>([]);
  loading = true;
  error = '';

  readonly selectedZone = signal('');
  readonly selectedCrop = signal('');

  zones = signal<string[]>([]);
  crops  = signal<string[]>([]);

  readonly displayedColumns = ['blockId', 'cropType', 'soilType', 'irrigationZone', 'elevationM', 'center'];

  readonly filteredAll = computed(() =>
    this.features().filter(f =>
      (!this.selectedZone() || f.properties.irrigationZone === this.selectedZone()) &&
      (!this.selectedCrop()  || f.properties.cropType       === this.selectedCrop())
    )
  );

  readonly filtered = computed(() => this.filteredAll().slice(0, 150));

  ngOnInit() {
    this.service.getGisBlocks().subscribe({
      next: fc => {
        this.features.set(fc.features);
        this.zones.set([...new Set(fc.features.map(f => f.properties.irrigationZone))].sort());
        this.crops.set([...new Set(fc.features.map(f => f.properties.cropType))].sort());
        this.loading = false;
      },
      error: () => { this.error = 'Could not load GIS blocks from :4302'; this.loading = false; },
    });
  }

  get filteredCount(): number {
    return this.filteredAll().length;
  }
}
