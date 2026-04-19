import { Component, input, output, ElementRef, viewChild, effect, Inject, OnDestroy, HostListener } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';

@Component({
  selector: 'app-action-sheet',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './action-sheet.component.html',
  styleUrls: ['./action-sheet.component.css']
})
export class ActionSheetComponent implements OnDestroy {
  isOpen = input<boolean>(false);
  title = input<string>('');
  subtitle = input<string>('');

  closed = output<void>();

  sheetPanel = viewChild<ElementRef>('sheetPanel');

  private startY = 0;
  currentY = 0;
  isDragging = false;

  constructor(@Inject(DOCUMENT) private readonly document: Document) {
    effect(() => {
      if (this.isOpen()) {
        this.document.body.style.overflow = 'hidden';
      } else {
        this.document.body.style.overflow = '';
      }
    });
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.isOpen()) {
      this.close();
    }
  }

  ngOnDestroy(): void {
    // Ensure scroll is restored if the component is destroyed while open
    this.document.body.style.overflow = '';
  }

  get transformY(): string {
    if (!this.isOpen()) {
      return 'translateY(calc(100% + 50px))';
    }
    const yVal = Math.max(0, this.currentY);
    return `translateY(${yVal}px)`;
  }

  get transitionStyle(): string {
    return this.isDragging ? 'none' : 'transform 300ms cubic-bezier(0.32, 0.72, 0, 1)';
  }

  close(): void {
    this.closed.emit();
  }

  onBackdropClick(): void {
    this.close();
  }

  onTouchStart(event: TouchEvent): void {
    this.startY = event.touches[0].clientY;
    this.isDragging = true;
  }

  onTouchMove(event: TouchEvent): void {
    if (!this.isDragging) return;
    const y = event.touches[0].clientY;
    this.currentY = Math.max(0, y - this.startY);
  }

  onTouchEnd(): void {
    if (!this.isDragging) return;
    this.isDragging = false;

    // Close threshold
    if (this.currentY > 100) {
      this.close();
    }

    this.currentY = 0;
  }
}
