import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
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
  standalone: true,
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
  readonly title = 'Field Intelligence OS';
  readonly subtitle = 'California Agronomy Platform';

  readonly navItems: NavItem[] = [
    { label: 'Dashboard',  icon: 'dashboard',   route: '/dashboard' },
    { label: 'Fields',     icon: 'agriculture', route: '/fields'    },
    { label: 'Entropy',    icon: 'grain',       route: '/entropy'   },
    { label: 'GIS Blocks', icon: 'map',         route: '/gis'       },
  ];
}
