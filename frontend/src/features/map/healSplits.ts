import type { DrawVertex, DrawnSegment } from './drawingTypes';

/**
 * Сшивание сегментов, соединённых через врезку (чистая функция — без React).
 *
 * Когда пользователь рисует ребро «через» врезку, ребро делится на ДВА сегмента:
 * у каждого один конец привязан к врезке (`type: 'tap'`, общий `tapId`). Если такую
 * врезку удалить, эти два сегмента должны снова стать ОДНИМ ребром.
 *
 * @param segments   текущие сегменты
 * @param removedTapIds  id удаляемых врезок
 * @returns новый список сегментов: пары, соединённые через удалённую врезку, слиты
 *          в один; оставшиеся концы, ссылающиеся на удалённую врезку, отвязаны.
 */
export function healRemovedTaps(
  segments: readonly DrawnSegment[],
  removedTapIds: ReadonlySet<string>,
): DrawnSegment[] {
  const isRemovedTap = (v: DrawVertex): boolean =>
    v.type === 'tap' && removedTapIds.has(v.tapId);
  /** Свободный (не-врезковый) конец сегмента; если оба конца — врезки, берём from. */
  const freeEnd = (s: DrawnSegment): DrawVertex =>
    isRemovedTap(s.from) && !isRemovedTap(s.to) ? s.to : s.from;
  const result: DrawnSegment[] = [];
  const consumed = new Set<string>();

  // Группируем сегменты по удаляемой врезке, к которой подключён их конец.
  const byTap = new Map<string, DrawnSegment[]>();
  for (const s of segments) {
    for (const v of [s.from, s.to]) {
      if (v.type === 'tap' && removedTapIds.has(v.tapId)) {
        const list = byTap.get(v.tapId) ?? [];
        list.push(s);
        byTap.set(v.tapId, list);
      }
    }
  }

  for (const [, group] of byTap) {
    // Уникальные ещё не сшитые сегменты этой группы.
    const unique = group.filter((s, i) => group.indexOf(s) === i && !consumed.has(s.id));
    if (unique.length !== 2) continue; // сшиваем только «простую» пару

    const [a, b] = unique;
    // Новое единое ребро — от СВОБОДНОГО конца A до свободного конца B.
    // Порядок from/to для линии не важен (важна длина/направление потока —
    // сохраняем порядок A, лишь бы оба конца были «внешними»).
    const mergedFrom = freeEnd(a);
    const mergedTo = freeEnd(b);

    consumed.add(a.id);
    consumed.add(b.id);
    result.push({
      id: a.id,
      // uid сшитого сегмента — от первого (a): сущность та же.
      uid: a.uid,
      from: mergedFrom,
      to: mergedTo,
      pipelineId: a.pipelineId ?? b.pipelineId,
      fluid: a.fluid,
      pipelineClass: a.pipelineClass,
      // Имя сшитого сегмента берём у первого (a); имя не генерируем заново.
      label: a.label ?? b.label,
    });
  }

  // Остальные сегменты — без изменений, кроме отвязки «висячих» врезковых концов.
  const unfreeze = (v: DrawVertex): DrawVertex =>
    isRemovedTap(v) ? { type: 'free', vid: v.vid, x: v.x, y: v.y } : v;
  for (const s of segments) {
    if (consumed.has(s.id)) continue;
    result.push({ ...s, from: unfreeze(s.from), to: unfreeze(s.to) });
  }
  return result;
}
