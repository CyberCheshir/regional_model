import { AppIcon } from '../components/AppIcon';
import { ICON_NAMES } from '../components/IconRegistry';

const PALETTE_TOKENS = [
  '--color-primary',
  '--bg-activity-bar',
  '--marker-wellpad',
  '--marker-processing',
  '--marker-delivery',
  '--pipeline-oil',
  '--pipeline-gas',
  '--pipeline-water',
  '--status-working-dot',
  '--status-working-bg',
] as const;

/**
 * Временная страница-витрина Этапа 1: проверка дизайн-токенов,
 * типографики и реестра иконок в рантайме.
 * Будет удалена после реализации AppShell (Этап 2).
 */
export function DevShowcase() {
  return (
    <main style={{ padding: 32, maxWidth: 900 }}>
      <p className="eyebrow">Этап 1 — фундамент проекта</p>
      <h1 className="object-title">Дизайн-токены и AppIcon</h1>
      <p className="text-secondary">
        Временно: витрина токенов и реестра иконок. На Этапе 2 будет заменено
        каркасом AppShell.
      </p>

      <section style={{ marginTop: 32 }}>
        <p className="eyebrow">Палитра</p>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            marginTop: 12,
          }}
        >
          {PALETTE_TOKENS.map((token) => (
            <div
              key={token}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                padding: '6px 10px',
              }}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 'var(--radius-sm)',
                  background: `var(${token})`,
                }}
              />
              <code className="text-secondary">{token}</code>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 32 }}>
        <p className="eyebrow">Реестр иконок</p>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            marginTop: 12,
          }}
        >
          {ICON_NAMES.map((name) => (
            <div
              key={name}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                width: 96,
                padding: 10,
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
              }}
              title={name}
            >
              <AppIcon name={name} size={20} color="var(--color-primary)" />
              <code className="text-secondary" style={{ fontSize: 10 }}>
                {name}
              </code>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
