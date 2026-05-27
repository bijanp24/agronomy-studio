import {
  Component, ChangeDetectionStrategy, OnInit, OnDestroy, AfterViewInit,
  inject, signal, computed, effect, ElementRef, ViewChild,
} from '@angular/core';
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
import * as L from 'leaflet';

import { FieldIntelligenceService } from '../../services/field-intelligence.service';
import { GeoJsonFeature } from '../../models/field-intelligence.models';

const CROP_PALETTE: Record<string, string> = {
  almond:  '#d97706', grape:   '#7c3aed', tomato:  '#dc2626',
  cotton:  '#6b7280', wheat:   '#ca8a04', corn:    '#16a34a',
  pistachio: '#65a30d', walnut: '#92400e', citrus: '#ea580c',
};

function cropColor(crop: string): string {
  return CROP_PALETTE[crop.toLowerCase()] ?? '#3b82f6';
}

@Component({
  selector: 'app-gis',
  changeDetection: ChangeDetectionStrategy.OnPush,
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
export class GisComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapEl') mapEl!: ElementRef<HTMLDivElement>;

  private service = inject(FieldIntelligenceService);

  readonly features  = signal<GeoJsonFeature[]>([]);
  readonly loading   = signal(true);
  readonly hasError  = signal(false);

  readonly selectedZone = signal('');
  readonly selectedCrop = signal('');

  readonly zones = signal<string[]>([]);
  readonly crops  = signal<string[]>([]);

  readonly displayedColumns = ['blockId', 'cropType', 'soilType', 'irrigationZone', 'elevationM', 'center'];

  readonly filteredAll = computed(() =>
    this.features().filter(f =>
      (!this.selectedZone() || f.properties.irrigationZone === this.selectedZone()) &&
      (!this.selectedCrop()  || f.properties.cropType       === this.selectedCrop())
    )
  );

  readonly filtered = computed(() => this.filteredAll().slice(0, 150));

  readonly filteredCount = computed(() => this.filteredAll().length);

  private map?: L.Map;
  private layerGroup = L.layerGroup();

  constructor() {
    effect(() => {
      const features = this.filteredAll();
      if (this.map) this.renderLayers(features);
    });
  }

  ngOnInit() {
    this.service.getGisBlocks().subscribe({
      next: fc => {
        this.features.set(fc.features);
        this.zones.set([...new Set(fc.features.map(f => f.properties.irrigationZone))].sort());
        this.crops.set([...new Set(fc.features.map(f => f.properties.cropType))].sort());
        this.loading.set(false);
      },
      error: () => { this.hasError.set(true); this.loading.set(false); },
    });
  }

  ngAfterViewInit() {
    this.map = L.map(this.mapEl.nativeElement, { zoomControl: true })
      .setView([36.7, -119.8], 9);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(this.map);

    this.layerGroup.addTo(this.map);
  }

  ngOnDestroy() {
    this.map?.remove();
  }

  private renderLayers(features: GeoJsonFeature[]) {
    this.layerGroup.clearLayers();
    for (const f of features) {
      const coords = f.geometry.coordinates[0].map(
        ([lng, lat]) => [lat, lng] as L.LatLngTuple
      );
      if (!coords.length) continue;

      L.polygon(coords, {
        color: cropColor(f.properties.cropType),
        weight: 1,
        fillOpacity: 0.45,
      })
        .bindPopup(
          `<strong>${f.id}</strong><br>
           Crop: ${f.properties.cropType}<br>
           Soil: ${f.properties.soilType}<br>
           Zone: ${f.properties.irrigationZone}<br>
           Elev: ${f.properties.elevationM} m`
        )
        .addTo(this.layerGroup);
    }
  }
}
