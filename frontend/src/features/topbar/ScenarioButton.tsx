import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteScenario, fetchScenarios } from '../../api/mapSave';
import { queryKeys } from '../../api/queries';
import './ScenarioButton.css';

export type ScenarioButtonProps = {
  /** Подпись кнопки (например, «Сценарии») */
  label: string;
  /** Открыть сценарий по id (загрузка снимка из БД в domain layer) */
  onOpen?: (scenarioId: string, name: string) => void;
};

/**
 * Кнопка «Сценарии»: выпадающий список сохранённых проектов.
 * Клик по элементу открывает сценарий (загрузка снимка из БД).
 */
export function ScenarioButton({ label, onOpen }: ScenarioButtonProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.scenarios,
    queryFn: fetchScenarios,
    enabled: open,
    staleTime: 10_000,
  });

  // Удаление сценария: подтверждение → DELETE → перечитать список.
  const remove = useMutation({
    mutationFn: (id: string) => deleteScenario(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.scenarios });
    },
  });

  const handleDelete = (id: string, name: string) => {
    if (!window.confirm(`Удалить сценарий «${name}»? Действие необратимо.`)) return;
    remove.mutate(id);
  };

  // Закрытие меню по клику вне и по Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="scenario-menu" ref={rootRef}>
      <button
        type="button"
        className="topbar__button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
      </button>

      {open && (
        <div className="scenario-menu__list" role="listbox" aria-label="Сохранённые сценарии">
          {isLoading && <span className="scenario-menu__hint">Загрузка…</span>}
          {isError && (
            <span className="scenario-menu__hint scenario-menu__hint--error">Ошибка загрузки списка</span>
          )}
          {!isLoading && !isError && (data?.length ?? 0) === 0 && (
            <span className="scenario-menu__hint">Нет сохранённых сценариев</span>
          )}
          {data?.map((s) => (
            <div key={s.id} className="scenario-menu__row">
              <button
                type="button"
                className="scenario-menu__item"
                role="option"
                aria-selected={false}
                onClick={() => {
                  setOpen(false);
                  onOpen?.(s.id, s.name);
                }}
              >
                {s.name}
              </button>
              <button
                type="button"
                className="scenario-menu__delete"
                title={`Удалить «${s.name}»`}
                aria-label={`Удалить сценарий ${s.name}`}
                disabled={remove.isPending}
                onClick={() => handleDelete(s.id, s.name)}
              >
                Удалить
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
