import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

interface NavItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private router      = inject(Router);
  private breakpoints = inject(BreakpointObserver);

  readonly isMobile = toSignal(
    this.breakpoints.observe(Breakpoints.Handset).pipe(map(r => r.matches)),
    { initialValue: false }
  );

  readonly title = 'Field Intelligence OS';
  readonly subtitle = 'California Agronomy Platform';

  readonly navItems: NavItem[] = [
    { label: 'Dashboard',  icon: 'dashboard',   route: '/dashboard' },
    { label: 'Fields',     icon: 'agriculture', route: '/fields'    },
    { label: 'Entropy',    icon: 'grain',       route: '/entropy'   },
    { label: 'GIS Blocks', icon: 'map',         route: '/gis'       },
    { label: 'Query',      icon: 'psychology',  route: '/query'     },
  ];

  readonly currentPageTitle = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      startWith(null),
      map(() => this.navItems.find(n => this.router.url.startsWith(n.route))?.label ?? '')
    ),
    { initialValue: '' }
  );
}
