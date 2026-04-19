import { Component, EventEmitter, Input, Output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  format
} from 'date-fns';
import { de } from 'date-fns/locale';

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.css']
})
export class CalendarComponent {
  @Input() set selectedDate(date: Date | null) {
    if (date) {
      this.currentMonth.set(startOfMonth(date));
      this.selected.set(date);
    }
  }

  @Output() dateSelected = new EventEmitter<Date>();

  currentMonth = signal<Date>(startOfMonth(new Date()));
  selected = signal<Date | null>(null);

  weekDays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  monthName = computed(() => {
    return format(this.currentMonth(), 'MMMM yyyy', { locale: de });
  });

  calendarDays = computed<CalendarDay[]>(() => {
    const monthStart = startOfMonth(this.currentMonth());
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const days: CalendarDay[] = [];

    let day = startDate;
    const today = new Date();
    const currentSelected = this.selected();

    while (day <= endDate) {
      days.push({
        date: day,
        isCurrentMonth: isSameMonth(day, monthStart),
        isSelected: currentSelected ? isSameDay(day, currentSelected) : false,
        isToday: isSameDay(day, today)
      });
      day = addDays(day, 1);
    }
    return days;
  });

  prevMonth() {
    this.currentMonth.update(d => subMonths(d, 1));
  }

  nextMonth() {
    this.currentMonth.update(d => addMonths(d, 1));
  }

  selectDate(day: CalendarDay) {
    this.selected.set(day.date);
    this.dateSelected.emit(day.date);
  }
}
