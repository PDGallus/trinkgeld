import { Component, input, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-text-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="form-group">
      @if (label()) {
        <label class="input-label">{{ label() }}</label>
      }
      <div class="input-wrapper">
        <input
          class="input-field"
          type="text"
          [placeholder]="placeholder()"
          [(ngModel)]="value"
          (blur)="onBlur()"
        />
        @if (icon()) {
          <div class="input-icon-wrapper">
            <span class="material-symbols-outlined input-icon">{{ icon() }}</span>
          </div>
        }
      </div>
    </div>
  `
})
export class TextInputComponent {
  label = input<string>('');
  placeholder = input<string>('');
  icon = input<string>('');

  // Model input provides a two-way binding API
  value = model<string>('');

  onBlur(): void {
    const currentVal = this.value();
      this.value.set(currentVal.trim());
  }
}
