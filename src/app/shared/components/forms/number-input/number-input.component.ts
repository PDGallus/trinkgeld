import { Component, input, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-number-input',
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
          type="number" 
          min="0"
          [placeholder]="placeholder()" 
          [(ngModel)]="value"
          (keydown)="onKeyDown($event)"
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
export class NumberInputComponent {
  label = input<string>('');
  placeholder = input<string>('');
  icon = input<string>('');
  
  value = model<number | null>(null);

  onKeyDown(event: KeyboardEvent): void {
    // Prevent typing specific characters like minus, e, +, etc.
    const forbiddenKeys = ['-', 'e', 'E', '+'];
    if (forbiddenKeys.includes(event.key)) {
      event.preventDefault();
    }
  }
}
