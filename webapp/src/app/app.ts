import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'ag-root',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  readonly navItems = [
    { path: '/', label: 'Dashboard' },
    { path: '/agronomy', label: 'Agronomy' },
    { path: '/ask', label: 'Ask' },
    { path: '/diagnostics', label: 'Diagnostics' }
  ];
}
