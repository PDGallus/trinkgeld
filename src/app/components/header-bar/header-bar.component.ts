import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-header-bar',
  templateUrl: './header-bar.component.html',
  styleUrl: './header-bar.component.css',
})
export class HeaderBarComponent {
  readonly title = input.required<string>();
  readonly status = input<string>('');

  readonly exportBackup = output<void>();
  readonly importBackup = output<Event>();

  onFileChange(event: Event): void {
    this.importBackup.emit(event);
  }
}
