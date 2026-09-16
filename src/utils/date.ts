export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

export function formatHours(value: number | null): string {
  if (value === null) {
    return 'Sem base suficiente';
  }
  if (value < 1) {
    return `${Math.round(value * 60)} min`;
  }
  return `${value.toFixed(1).replace('.', ',')} h`;
}
