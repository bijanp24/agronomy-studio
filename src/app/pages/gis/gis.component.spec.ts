import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter } from '@angular/router';
import { GisComponent } from './gis.component';
import { GeoJsonFeature } from '../../models/field-intelligence.models';

const makeFeature = (cropType: string, irrigationZone: string, id = 'b1'): GeoJsonFeature => ({
  type: 'Feature',
  id,
  geometry: { type: 'Polygon', coordinates: [[]] },
  properties: {
    blockId: id,
    cropType,
    soilType: 'clay',
    irrigationZone,
    elevationM: 100,
    centerLat: 36.7,
    centerLon: -119.8,
  },
});

describe('GisComponent filter', () => {
  let component: GisComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GisComponent],
      providers: [
        provideRouter([]),
        provideAnimationsAsync(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(GisComponent);
    component = fixture.componentInstance;
  });

  it('returns all features when no filters are set', () => {
    component.features.set([
      makeFeature('almond', 'zone-a', 'b1'),
      makeFeature('grape',  'zone-b', 'b2'),
    ]);
    expect(component.filteredAll().length).toBe(2);
  });

  it('filters by irrigation zone', () => {
    component.features.set([
      makeFeature('almond', 'zone-a', 'b1'),
      makeFeature('grape',  'zone-b', 'b2'),
    ]);
    component.selectedZone.set('zone-a');
    expect(component.filteredAll().length).toBe(1);
    expect(component.filteredAll()[0].id).toBe('b1');
  });

  it('filters by crop type', () => {
    component.features.set([
      makeFeature('almond', 'zone-a', 'b1'),
      makeFeature('grape',  'zone-a', 'b2'),
      makeFeature('almond', 'zone-b', 'b3'),
    ]);
    component.selectedCrop.set('grape');
    expect(component.filteredAll().length).toBe(1);
    expect(component.filteredAll()[0].id).toBe('b2');
  });

  it('combines zone and crop filters', () => {
    component.features.set([
      makeFeature('almond', 'zone-a', 'b1'),
      makeFeature('grape',  'zone-a', 'b2'),
      makeFeature('grape',  'zone-b', 'b3'),
    ]);
    component.selectedZone.set('zone-a');
    component.selectedCrop.set('grape');
    expect(component.filteredAll().length).toBe(1);
    expect(component.filteredAll()[0].id).toBe('b2');
  });

  it('filteredCount matches filteredAll length', () => {
    component.features.set([
      makeFeature('almond', 'zone-a', 'b1'),
      makeFeature('grape',  'zone-b', 'b2'),
    ]);
    component.selectedZone.set('zone-a');
    expect(component.filteredCount()).toBe(component.filteredAll().length);
  });

  it('caps filtered to 150', () => {
    const features = Array.from({ length: 200 }, (_, i) =>
      makeFeature('almond', 'zone-a', `b${i}`)
    );
    component.features.set(features);
    expect(component.filtered().length).toBe(150);
    expect(component.filteredCount()).toBe(200);
  });
});
