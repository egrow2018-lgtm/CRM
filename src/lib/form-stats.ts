import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { APP_TIMEZONE, utcToZoned, zonedToUtc } from "./timezone";

export type DailyPoint = { day: string; views: number; submissions: number };

/** Rango de fechas (YYYY-MM-DD, hora de Ecuador) de la URL; por defecto, los últimos 30 días. */
export function periodFrom(sp: { from?: string; to?: string }) {
  const valid = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const today = utcToZoned(new Date()).date;
  const to = valid(sp.to) ? sp.to! : today;
  const from = valid(sp.from) ? sp.from! : utcToZoned(new Date(zonedToUtc(to, "00:00").getTime() - 29 * 86400000)).date;
  return { from, to, start: zonedToUtc(from, "00:00"), end: new Date(zonedToUtc(to, "00:00").getTime() + 86400000) };
}

/** Visitas y envíos por día (hora de Ecuador) de un formulario en el período. */
export async function dailyFormStats(formId: string, start: Date, end: Date): Promise<DailyPoint[]> {
  const count = (table: "FormView" | "FormSubmission") =>
    prisma.$queryRaw<{ day: string; n: bigint }[]>`
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${APP_TIMEZONE}, 'YYYY-MM-DD') AS day, COUNT(*) AS n
      FROM ${Prisma.raw(`"${table}"`)}
      WHERE "formId" = ${formId} AND "createdAt" >= ${start} AND "createdAt" < ${end}
      GROUP BY 1`;
  const [views, subs] = await Promise.all([count("FormView"), count("FormSubmission")]);
  const v = new Map(views.map((r) => [r.day, Number(r.n)]));
  const s = new Map(subs.map((r) => [r.day, Number(r.n)]));
  const points: DailyPoint[] = [];
  for (let t = start.getTime(); t < end.getTime(); t += 86400000) {
    const day = utcToZoned(new Date(t)).date;
    if (points.at(-1)?.day === day) continue;
    points.push({ day, views: v.get(day) ?? 0, submissions: s.get(day) ?? 0 });
  }
  return points;
}

export function conversionRate(submissions: number, views: number) {
  return views > 0 ? `${((submissions / views) * 100).toLocaleString("es-EC", { maximumFractionDigits: 2 })} %` : "—";
}
