/**
 * Вкладка «Общие параметры»: идентификация объекта, состояние модели (готовность)
 * и связи (входящие/исходящие потоки — кликабельные ссылки на объекты).
 */
import { useEffect, useRef, useState } from 'react';
import { AppIcon } from '../../components/AppIcon';
import type {
  EntityDetails,
  ParameterPanelData,
  PipelineClass,
  PipelineInstallation,
  PipelineOwner,
  PipelineRouteCondition,
  PipelineStatus,
  PipelineType,
} from '../../domain/types';
import {
  PIPELINE_CLASS_LABELS,
  PIPELINE_INSTALLATION_LABELS,
  PIPELINE_OWNER_LABELS,
  PIPELINE_ROUTE_CONDITION_LABELS,
  PIPELINE_STATUS_LABELS,
  PIPELINE_TYPE_LABELS,
} from '../../domain/schemas';
import { ChecklistRow, PanelSection, PropertyRow } from './parts';

export function GeneralTab({
  data,
  onRename,
  onPipelineTypeChange,
  onPipelineClassChange,
  onPipelineLengthChange,
  onPipelineOuterDiameterChange,
  onPipelineWallThicknessChange,
  onPipelineRoughnessChange,
  onPipelineAdvancedChange,
  onNavigateToRelation,
}: {
  data: ParameterPanelData;
  onRename?: (nextLabel: string) => void;
  onPipelineTypeChange?: (pipelineType: PipelineType) => void;
  onPipelineClassChange?: (pipelineClass: PipelineClass) => void;
  onPipelineLengthChange?: (lengthKm: number) => void;
  onPipelineOuterDiameterChange?: (diameterMm: number) => void;
  onPipelineWallThicknessChange?: (thicknessMm: number) => void;
  onPipelineRoughnessChange?: (roughnessMm: number) => void;
  onPipelineAdvancedChange?: (patch: {
    installation?: PipelineInstallation;
    depthM?: number;
    routeCondition?: PipelineRouteCondition;
    additivesEfficiency?: boolean;
    pipelineStatus?: PipelineStatus;
    owner?: PipelineOwner;
  }) => void;
  onNavigateToRelation: (id: string) => void;
}) {
  const { entity } = data;
  return (
    <>
      <SectionIdentification
        entity={entity}
        onRename={onRename}
        onPipelineTypeChange={onPipelineTypeChange}
        onPipelineClassChange={onPipelineClassChange}
        onPipelineLengthChange={onPipelineLengthChange}
        onPipelineOuterDiameterChange={onPipelineOuterDiameterChange}
        onPipelineWallThicknessChange={onPipelineWallThicknessChange}
        onPipelineRoughnessChange={onPipelineRoughnessChange}
        onPipelineAdvancedChange={onPipelineAdvancedChange}
      />
      <PanelSection title="Состояние модели">
        {entity.modelStatus.length === 0 ? (
          <p className="pp-muted">Состояние модели не задано.</p>
        ) : (
          entity.modelStatus.map((item) => (
            <ChecklistRow
              key={item.label}
              level={item.ok ? 'ok' : 'none'}
              label={item.label}
              value={item.value}
            />
          ))
        )}
      </PanelSection>
      <SectionConnections entity={entity} onNavigateToRelation={onNavigateToRelation} />
    </>
  );
}

/* ---------------------------------------------------------------- */

/** Идентификация: редактируемое наименование, тип, ЛУ, владелец. */
function SectionIdentification({
  entity,
  onRename,
  onPipelineTypeChange,
  onPipelineClassChange,
  onPipelineLengthChange,
  onPipelineOuterDiameterChange,
  onPipelineWallThicknessChange,
  onPipelineRoughnessChange,
  onPipelineAdvancedChange,
}: {
  entity: EntityDetails;
  onRename?: (nextLabel: string) => void;
  onPipelineTypeChange?: (pipelineType: PipelineType) => void;
  onPipelineClassChange?: (pipelineClass: PipelineClass) => void;
  onPipelineLengthChange?: (lengthKm: number) => void;
  onPipelineOuterDiameterChange?: (diameterMm: number) => void;
  onPipelineWallThicknessChange?: (thicknessMm: number) => void;
  onPipelineRoughnessChange?: (roughnessMm: number) => void;
  onPipelineAdvancedChange?: (patch: {
    installation?: PipelineInstallation;
    depthM?: number;
    routeCondition?: PipelineRouteCondition;
    additivesEfficiency?: boolean;
    pipelineStatus?: PipelineStatus;
    owner?: PipelineOwner;
  }) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entity.label);
  const inputRef = useRef<HTMLInputElement>(null);
  const pipelineClass = entity.pipelineClass === 'interfield' || entity.pipelineClass === 'trunk'
    ? entity.pipelineClass
    : 'field';

  useEffect(() => {
    setEditing(false);
    setDraft(entity.label);
  }, [entity.id, entity.label]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = (save: boolean) => {
    setEditing(false);
    if (!save) return;
    const next = draft.trim();
    if (!next || next === entity.label) return;
    onRename?.(next);
  };

  return (
    <PanelSection title="Идентификация">
      <div className="pp-properties-table" role="table" aria-label="Общие параметры элемента">
        <PropertyRow label="Наименование">
          {editing ? (
            <input
              ref={inputRef}
              className="pp-input"
              type="text"
              value={draft}
              spellCheck={false}
              aria-label={`Переименовать «${entity.label}»`}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit(true);
                else if (e.key === 'Escape') commit(false);
              }}
              onBlur={() => commit(true)}
            />
          ) : onRename ? (
            <button
              type="button"
              className="pp-edit"
              title="Изменить наименование"
              onClick={() => {
                setDraft(entity.label);
                setEditing(true);
              }}
            >
              <span className="pp-edit__text">{entity.label}</span>
              <span className="pp-edit__pencil" aria-hidden="true">
                <AppIcon name="pencil" size={13} />
              </span>
            </button>
          ) : (
            entity.label
          )}
        </PropertyRow>
        <PropertyRow label="Тип объекта">{entity.subType ?? entity.kind}</PropertyRow>
        {entity.kind === 'pipeline' && (
          <>
            <PropertyRow label="Тип трубопровода">
            <span className="pp-select-wrap">
              <span className="pp-select__text" aria-hidden="true">
                {PIPELINE_TYPE_LABELS[entity.pipelineType ?? 'npp']}
              </span>
              <select
                className="pp-select"
                value={entity.pipelineType ?? 'npp'}
                onChange={(event) => onPipelineTypeChange?.(event.target.value as PipelineType)}
                disabled={!onPipelineTypeChange}
                aria-label="Тип трубопровода"
              >
                {(Object.keys(PIPELINE_TYPE_LABELS) as PipelineType[]).map((type) => (
                  <option key={type} value={type}>
                    {PIPELINE_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </span>
          </PropertyRow>
          <PropertyRow label="Классификация">
            <span className="pp-select-wrap">
              <span className="pp-select__text" aria-hidden="true">
                {PIPELINE_CLASS_LABELS[pipelineClass]}
              </span>
              <select
                className="pp-select"
                value={pipelineClass}
                onChange={(event) => onPipelineClassChange?.(event.target.value as PipelineClass)}
                disabled={!onPipelineClassChange}
                aria-label="Классификация трубопровода"
              >
                {(Object.keys(PIPELINE_CLASS_LABELS) as PipelineClass[]).map((classification) => (
                  <option key={classification} value={classification}>
                    {PIPELINE_CLASS_LABELS[classification]}
                  </option>
                ))}
              </select>
            </span>
            </PropertyRow>
            <PropertyRow label="Протяженность, км">
              <span className="pp-number-wrap">
                <span className="pp-number-text" aria-hidden="true">
                  {(entity.lengthKm ?? 0).toFixed(2)}
                </span>
                <input
                  className="pp-number-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={entity.lengthKm ?? 0}
                  onChange={(event) => onPipelineLengthChange?.(Math.max(0, Number(event.target.value) || 0))}
                  disabled={!onPipelineLengthChange}
                  aria-label="Протяженность трубопровода, км"
                />
              </span>
            </PropertyRow>
            <PropertyRow label="Наружный диаметр, мм">
              <NumberPropertyInput
                value={entity.outerDiameterMm}
                min={0}
                ariaLabel="Наружный диаметр трубы, мм"
                disabled={!onPipelineOuterDiameterChange}
                onChange={onPipelineOuterDiameterChange}
              />
            </PropertyRow>
            <PropertyRow label="Толщина стенки, мм">
              <NumberPropertyInput
                value={entity.wallThicknessMm}
                min={0}
                ariaLabel="Толщина стенки трубы, мм"
                disabled={!onPipelineWallThicknessChange}
                onChange={onPipelineWallThicknessChange}
              />
            </PropertyRow>
            <PropertyRow label="Шероховатость, мм">
              <NumberPropertyInput
                value={entity.roughnessMm ?? 0}
                min={0}
                step={1}
                ariaLabel="Шероховатость трубы, мм"
                disabled={!onPipelineRoughnessChange}
                onChange={onPipelineRoughnessChange}
              />
            </PropertyRow>
            <PipelineSelectRow
              label="Прокладка"
              value={entity.installation ?? 'overground'}
              labels={PIPELINE_INSTALLATION_LABELS}
              disabled={!onPipelineAdvancedChange}
              onChange={(installation) => onPipelineAdvancedChange?.({ installation })}
            />
            <PropertyRow label="Глубина прокладки, м">
              <NumberPropertyInput
                value={entity.depthM ?? 0}
                min={0}
                step={0.01}
                ariaLabel="Глубина прокладки, м"
                disabled={!onPipelineAdvancedChange}
                onChange={(depthM) => onPipelineAdvancedChange?.({ depthM })}
              />
            </PropertyRow>
            <PipelineSelectRow
              label="Тип прокладки"
              value={entity.routeCondition ?? 'unspecified'}
              labels={PIPELINE_ROUTE_CONDITION_LABELS}
              disabled={!onPipelineAdvancedChange}
              onChange={(routeCondition) => onPipelineAdvancedChange?.({ routeCondition })}
            />
            <PipelineSelectRow
              label="Эффективность присадок"
              value={entity.additivesEfficiency ? 'yes' : 'no'}
              labels={{ yes: 'Да', no: 'Нет' }}
              disabled={!onPipelineAdvancedChange}
              onChange={(value) => onPipelineAdvancedChange?.({ additivesEfficiency: value === 'yes' })}
            />
            <PipelineSelectRow
              label="Статус"
              value={entity.pipelineStatus ?? 'new'}
              labels={PIPELINE_STATUS_LABELS}
              disabled={!onPipelineAdvancedChange}
              onChange={(pipelineStatus) => onPipelineAdvancedChange?.({ pipelineStatus })}
            />
          </>
        )}
        <PropertyRow label="Лицензионный участок">{entity.licenseArea}</PropertyRow>
        {entity.kind === 'pipeline' ? (
          <PipelineSelectRow
            label="Владелец"
            value={Object.keys(PIPELINE_OWNER_LABELS).includes(entity.owner ?? '') ? entity.owner as PipelineOwner : 'unspecified'}
            labels={PIPELINE_OWNER_LABELS}
            disabled={!onPipelineAdvancedChange}
            onChange={(owner) => onPipelineAdvancedChange?.({ owner })}
          />
        ) : (
          <PropertyRow label="Владелец">{entity.owner}</PropertyRow>
        )}
      </div>
    </PanelSection>
  );
}

function PipelineSelectRow<T extends string>({
  label,
  value,
  labels,
  disabled,
  onChange,
}: {
  label: string;
  value: T;
  labels: Record<T, string>;
  disabled: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <PropertyRow label={label}>
      <span className="pp-select-wrap">
        <span className="pp-select__text" aria-hidden="true">{labels[value]}</span>
        <select
          className="pp-select"
          value={value}
          onChange={(event) => onChange(event.target.value as T)}
          disabled={disabled}
          aria-label={label}
        >
          {(Object.keys(labels) as T[]).map((key) => (
            <option key={key} value={key}>{labels[key]}</option>
          ))}
        </select>
      </span>
    </PropertyRow>
  );
}

function NumberPropertyInput({
  value,
  min,
  step = 1,
  ariaLabel,
  disabled,
  onChange,
}: {
  value?: number;
  min: number;
  step?: number;
  ariaLabel: string;
  disabled: boolean;
  onChange?: (value: number) => void;
}) {
  const displayValue = value ?? 0;
  return (
    <span className="pp-number-wrap">
      <span className="pp-number-text" aria-hidden="true">{displayValue}</span>
      <input
        className="pp-number-input"
        type="number"
        min={min}
        step={step}
        value={displayValue}
        onChange={(event) => {
          const rawValue = event.target.value;
          if (rawValue === '') return;
          const parsed = Number(rawValue);
          if (Number.isFinite(parsed)) onChange?.(Math.max(min, parsed));
        }}
        disabled={disabled}
        aria-label={ariaLabel}
      />
    </span>
  );
}

/** Связи: входящие и исходящие потоки (кликабельные ссылки на объекты). */
function SectionConnections({
  entity,
  onNavigateToRelation,
}: {
  entity: EntityDetails;
  onNavigateToRelation: (id: string) => void;
}) {
  const empty = entity.incoming.length === 0 && entity.outgoing.length === 0;
  return (
    <PanelSection title="Связи">
      {empty ? (
        <p className="pp-muted">У объекта нет связей.</p>
      ) : (
        <>
          <FlowGroup
            title="Исходящие потоки"
            items={entity.outgoing}
            emptyText="Нет исходящих потоков"
            onNavigateToRelation={onNavigateToRelation}
          />
          <FlowGroup
            title="Входящие потоки"
            items={entity.incoming}
            emptyText="Для объекта добычи входящие связи не используются"
            onNavigateToRelation={onNavigateToRelation}
          />
        </>
      )}
    </PanelSection>
  );
}

function FlowGroup({
  title,
  items,
  emptyText,
  onNavigateToRelation,
}: {
  title: string;
  items: EntityDetails['outgoing'];
  emptyText: string;
  onNavigateToRelation: (id: string) => void;
}) {
  return (
    <div className="pp-flow-group">
      <h4 className="pp-flow-group__title">{title}</h4>
      {items.length === 0 ? (
        <p className="pp-muted pp-muted--sm">{emptyText}</p>
      ) : (
        items.map((c) => (
          <button
            key={c.id}
            type="button"
            className="pp-link"
            onClick={() => onNavigateToRelation(c.id)}
            title={`Перейти к «${c.targetLabel}»`}
          >
            <span className="pp-link__text">{c.targetLabel}</span>
            {c.isLogicalFlow && (
              <span className="pp-link__badge">Передача флюида без физического трубопровода</span>
            )}
            <AppIcon name="chevron-right" size={13} />
          </button>
        ))
      )}
    </div>
  );
}
