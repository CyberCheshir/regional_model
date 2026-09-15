// Одноразовый скрипт: патчит src/App.tsx для Этапа 9.5
// (проброс loading/error/refetch из useEntityDetailsQuery в InspectorPanel).
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'src', 'App.tsx');
let src = fs.readFileSync(file, 'utf8');

const oldQuery = `  const { data: entityDetails } = useEntityDetailsQuery(selectedId);`;
const newQuery = `  const {
    data: entityDetails,
    isLoading: entityLoading,
    error: entityError,
    refetch: refetchEntity,
  } = useEntityDetailsQuery(selectedId);`;

const oldPanel = `        <InspectorPanel
          entity={entityDetails}
          activeTab={inspectorTab}`;
const newPanel = `        <InspectorPanel
          entity={entityDetails}
          loading={entityLoading}
          error={entityError}
          onRetry={refetchEntity}
          activeTab={inspectorTab}`;

if (!src.includes(oldQuery) || !src.includes(oldPanel)) {
  console.error('App.tsx: anchors not found — file already patched or changed');
  process.exit(1);
}
src = src.replace(oldQuery, newQuery).replace(oldPanel, newPanel);
fs.writeFileSync(file, src, 'utf8');
console.log('App.tsx patched: query + InspectorPanel props updated');
