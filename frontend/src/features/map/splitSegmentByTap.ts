import type { DrawVertex, DrawnSegment } from './drawingTypes';

// DrawVertex используется ниже в tapEnd (создание конца ребра, привязанного к врезке).

/** Результат разреза сегмента врезкой. */
export type SplitByTapResult = {
  /** Новый список сегментов (вместо исходного segId — два: левый и правый) */
  segments: DrawnSegment[];
  /** id сегмента ДО врезки (from исходного → врезка) */
  leftId: string;
  /** id сегмента ПОСЛЕ врезки (врезка → to исходного) */
  rightId: string;
};

/**
 * Разрезать сегмент врезкой на ДВА сегмента (чистая функция, без React).
 *
 * Врезка, установленная на сегмент, делит его на левый (from → врезка) и правый
 * (врезка → to). Оба конца привязываются к врезке (`type: 'tap'`), и врезка
 * становится ТОЧКОЙ СОЕДИНЕНИЯ этих двух сегментов. Трубопровод (pipelineId)
 * при этом НЕ меняется — оба сегмента остаются в том же трубопроводе.
 *
 * @param segments   текущие сегменты
 * @param segId      id разрезаемого сегмента
 * @param tapId      id новой врезки
 * @param leftId     id нового ЛЕВОГО сегмента
 * @param rightId    id нового ПРАВОГО сегмента
 * @param newVidLeft vid конца левого сегмента, привязанного к врезке
 * @param newVidRight vid конца правого сегмента, привязанного к врезке
 * @param tapPoint  координаты врезки (точка разреза)
 */
export function splitSegmentByTap(
  segments: readonly DrawnSegment[],
  segId: string,
  tapId: string,
  leftId: string,
  rightId: string,
  newVidLeft: string,
  newVidRight: string,
  /** Мировая точка врезки — место разреза сегмента */
  tapPoint: { x: number; y: number },
): SplitByTapResult | null {
  const target = segments.find((s) => s.id === segId);
  if (!target) return null;

  // Конец, привязанный к врезке, — в самой ТОЧКЕ ВРЕЗКИ (tapPoint), а НЕ в конце
  // исходного сегмента. Иначе left/right совпали бы с целым исходным ребром.
  const tapEnd = (vid: string): DrawVertex => ({
    type: 'tap',
    vid,
    x: tapPoint.x,
    y: tapPoint.y,
    tapId,
  });

  // Имя сегмента наследуется обеими половинами: разрез НЕ меняет наименование
  // (имя закреплено за сегментом и меняется только пользователем).
  const left: DrawnSegment = {
    id: leftId,
    from: target.from,
    to: tapEnd(newVidLeft),
    pipelineId: target.pipelineId,
    fluid: target.fluid,
    pipelineClass: target.pipelineClass,
    label: target.label,
  };
  const right: DrawnSegment = {
    id: rightId,
    from: tapEnd(newVidRight),
    to: target.to,
    pipelineId: target.pipelineId,
    fluid: target.fluid,
    pipelineClass: target.pipelineClass,
    label: target.label,
  };

  const next: DrawnSegment[] = [];
  for (const s of segments) {
    if (s.id === segId) {
      next.push(left, right);
    } else {
      next.push(s);
    }
  }

  return { segments: next, leftId, rightId };
}
