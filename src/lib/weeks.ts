/**
 * Semanas de postagem (segunda a domingo). As datas de postagem são gravadas ao
 * meio-dia UTC (T12:00:00Z), então as partes UTC já são o dia certo no Brasil.
 */

export const NO_DATE = "sem-data";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function toKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function fromKey(key: string): Date {
  return new Date(`${key}T12:00:00.000Z`);
}

/** Chave da semana (data da segunda-feira, "YYYY-MM-DD") ou NO_DATE. */
export function weekKey(date: Date | string | null | undefined): string {
  if (!date) return NO_DATE;
  const d = new Date(date);
  if (isNaN(d.getTime())) return NO_DATE;
  const offset = (d.getUTCDay() + 6) % 7; // segunda = 0
  return toKey(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - offset, 12)));
}

/** Chave da semana atual (fuso de São Paulo). */
export function currentWeekKey(): string {
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }); // YYYY-MM-DD
  return weekKey(fromKey(hoje));
}

/** Os 7 dias da semana ("YYYY-MM-DD"), de segunda a domingo. */
export function weekDays(key: string): string[] {
  const start = fromKey(key);
  return Array.from({ length: 7 }, (_, i) => toKey(new Date(start.getTime() + i * 86400000)));
}

/** Chave do dia ("YYYY-MM-DD") de uma data de postagem. */
export function dayKey(date: Date | string): string {
  return toKey(new Date(date));
}

/** "20 a 26/out" ou "27/out a 2/nov". */
export function weekLabel(key: string): string {
  if (key === NO_DATE) return "Sem data definida";
  const days = weekDays(key);
  const a = fromKey(days[0]);
  const b = fromKey(days[6]);
  const ma = MESES[a.getUTCMonth()];
  const mb = MESES[b.getUTCMonth()];
  return ma === mb
    ? `${a.getUTCDate()} a ${b.getUTCDate()}/${mb}`
    : `${a.getUTCDate()}/${ma} a ${b.getUTCDate()}/${mb}`;
}

/** "Esta semana", "Próxima semana", "Semana passada" ou null. */
export function weekRelative(key: string, current = currentWeekKey()): string | null {
  if (key === NO_DATE) return null;
  const diff = Math.round((fromKey(key).getTime() - fromKey(current).getTime()) / (7 * 86400000));
  if (diff === 0) return "Esta semana";
  if (diff === 1) return "Próxima semana";
  if (diff === -1) return "Semana passada";
  return null;
}

/** "Seg 20/10" para um dia "YYYY-MM-DD". */
export function dayLabel(day: string): { dow: string; date: string } {
  const d = fromKey(day);
  return {
    dow: DIAS_SEMANA[(d.getUTCDay() + 6) % 7],
    date: `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
  };
}

/** Ordena chaves de semana: datas em ordem crescente, "sem data" por último. */
export function compareWeekKeys(a: string, b: string): number {
  if (a === b) return 0;
  if (a === NO_DATE) return 1;
  if (b === NO_DATE) return -1;
  return a < b ? -1 : 1;
}
