import type { ServiceCalendar, ServiceCalendarException, WeekdayKey } from '../../src/models/operations';

export interface BusinessTimePolicy {
  calendar: ServiceCalendar;
  exceptions: ServiceCalendarException[];
}

type LocalParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };
const WEEKDAYS: WeekdayKey[] = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];

function localParts(date: Date, timeZone: string): LocalParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes): number => Number(parts.find((item) => item.type === type)?.value ?? '0');
  return { year: read('year'), month: read('month'), day: read('day'), hour: read('hour'), minute: read('minute'), second: read('second') };
}

function dateKey(parts: Pick<LocalParts,'year'|'month'|'day'>): string {
  return `${String(parts.year).padStart(4,'0')}-${String(parts.month).padStart(2,'0')}-${String(parts.day).padStart(2,'0')}`;
}

function parseDateKey(value: string): { year: number; month: number; day: number } {
  const [year, month, day] = value.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) throw new Error('Data local inválida.');
  return { year, month, day };
}

function addLocalDays(value: string, days: number): string {
  const { year, month, day } = parseDateKey(value);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12));
  return date.toISOString().slice(0,10);
}

function offsetMs(date: Date, timeZone: string): number {
  const p = localParts(date, timeZone);
  const utcLike = Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second);
  return utcLike - Math.floor(date.getTime()/1000)*1000;
}

export function zonedLocalToDate(date: string, time: string, timeZone: string): Date {
  const { year, month, day } = parseDateKey(date);
  const [hour, minute] = time.split(':').map(Number);
  if (hour === undefined || minute === undefined) throw new Error('Horário local inválido.');
  const utcGuess = Date.UTC(year,month-1,day,hour,minute,0);
  let result = new Date(utcGuess);
  for (let i=0;i<3;i+=1) result = new Date(utcGuess - offsetMs(result,timeZone));
  return result;
}

function weekdayForDate(date: string): WeekdayKey {
  const { year,month,day } = parseDateKey(date);
  return WEEKDAYS[new Date(Date.UTC(year,month-1,day,12)).getUTCDay()] ?? 'SUNDAY';
}

function scheduleFor(date: string, policy: BusinessTimePolicy): { open: boolean; start: string; end: string } {
  const exception = policy.exceptions.find((item) => item.date === date);
  if (exception !== undefined) {
    if (exception.closed) return { open: false, start: '00:00', end: '00:00' };
    if (exception.start !== undefined && exception.end !== undefined) return { open: true, start: exception.start, end: exception.end };
  }
  return policy.calendar.weekly[weekdayForDate(date)];
}

function localDateKey(date: Date, timeZone: string): string { return dateKey(localParts(date,timeZone)); }

export function addBusinessMinutes(start: Date, minutes: number, policy: BusinessTimePolicy): Date {
  if (minutes <= 0) return new Date(start);
  const tz = policy.calendar.timezone;
  let cursor = new Date(start);
  let remaining = Math.ceil(minutes);
  let dayKey = localDateKey(cursor,tz);
  for (let guard=0; guard<3700; guard+=1) {
    const schedule = scheduleFor(dayKey,policy);
    if (schedule.open) {
      const open = zonedLocalToDate(dayKey,schedule.start,tz);
      const close = zonedLocalToDate(dayKey,schedule.end,tz);
      const effective = cursor < open ? open : cursor;
      if (effective < close) {
        const available = Math.floor((close.getTime()-effective.getTime())/60000);
        if (remaining <= available) return new Date(effective.getTime()+remaining*60000);
        remaining -= available;
      }
    }
    dayKey = addLocalDays(dayKey,1);
    cursor = zonedLocalToDate(dayKey,'00:00',tz);
  }
  throw new Error('O cálculo de horas úteis excedeu o limite seguro de calendário.');
}

export function businessMinutesBetween(start: Date, end: Date, policy: BusinessTimePolicy): number {
  if (end <= start) return 0;
  const tz = policy.calendar.timezone;
  let dayKey = localDateKey(start,tz);
  const endKey = localDateKey(end,tz);
  let total = 0;
  for (let guard=0; guard<3700; guard+=1) {
    const schedule = scheduleFor(dayKey,policy);
    if (schedule.open) {
      const open = zonedLocalToDate(dayKey,schedule.start,tz);
      const close = zonedLocalToDate(dayKey,schedule.end,tz);
      const from = start > open ? start : open;
      const to = end < close ? end : close;
      if (to > from) total += Math.floor((to.getTime()-from.getTime())/60000);
    }
    if (dayKey === endKey) break;
    dayKey = addLocalDays(dayKey,1);
  }
  return Math.max(0,total);
}

export function remainingBusinessMinutes(now: Date, dueAt: Date, policy: BusinessTimePolicy): number {
  return dueAt >= now ? businessMinutesBetween(now,dueAt,policy) : -businessMinutesBetween(dueAt,now,policy);
}
