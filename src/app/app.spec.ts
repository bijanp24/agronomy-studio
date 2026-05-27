import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { describe, it, expect, beforeEach } from 'vitest';
import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        provideAnimationsAsync(),
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('exposes the correct nav routes', () => {
    const fixture = TestBed.createComponent(App);
    const navRoutes = fixture.componentInstance.navItems.map(n => n.route);
    expect(navRoutes).toEqual(['/dashboard', '/fields', '/entropy', '/gis', '/query']);
  });
});
