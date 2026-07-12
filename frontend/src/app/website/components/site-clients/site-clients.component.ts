import { Component } from '@angular/core';
import { clients } from '../../data/site.data';

@Component({
  selector: 'app-site-clients',
  templateUrl: './site-clients.component.html',
})
export class SiteClientsComponent {
  readonly clients = clients;
}
