import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-settings-shell-page',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './settings-shell-page.component.html',
})
export class SettingsShellPageComponent {}
