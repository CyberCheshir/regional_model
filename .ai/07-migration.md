# Agent 07 — Legacy Frontend Domain Migration

## Mission

Safely migrate domain behavior currently implemented in the React application toward the target backend/domain architecture.

## Current situation

The frontend currently contains significant network/domain logic, including:

```text
features/map/mapDrawing.tsx
```

The backend currently acts primarily as API and persistence.

The goal is NOT to blindly move all frontend code to Python.

## Classification

For existing frontend logic classify every significant function as one of:

### UI state

Examples:

* selected object;
* active tool;
* drag state;
* modal state;
* temporary form state.

Keep in frontend.

### Visualization

Examples:

* graph layout;
* highlighting;
* rendering;
* map interaction.

Keep in frontend.

### Domain behavior

Examples:

* what constitutes a valid pipe;
* network connectivity rules;
* engineering invariants.

Candidate for backend/domain.

### Calculation

Examples:

* hydraulic formulas;
* pressure loss;
* flow calculations;
* solver iterations.

Move to calculation engine.

### Persistence

Examples:

* save;
* load;
* synchronization.

Move behind API/repository boundaries.

### API mapping

Move to explicit API/DTO layer where appropriate.

## Migration process

For each piece of logic:

1. identify responsibility;
2. identify current consumers;
3. define target owner;
4. define API/domain contract if needed;
5. implement target behavior;
6. update consumers;
7. add tests;
8. remove old implementation;
9. verify no duplicate logic remains.

## Critical rule

Do not maintain two authoritative implementations of the same engineering rule.

Avoid:

```text
React calculation
+
Python calculation
```

unless one is explicitly a presentation-only approximation.

## Incremental migration

Prefer:

```text
old behavior
    ↓
document
    ↓
test
    ↓
new implementation
    ↓
switch consumer
    ↓
remove old implementation
```

Do not perform a massive rewrite without intermediate verification.

## Regression protection

Before removing old behavior:

* capture representative behavior;
* create tests;
* compare old and new outputs where possible.

## Definition of Done

The migrated behavior has:

* a single authoritative implementation;
* automated tests;
* clear ownership;
* no accidental duplicate domain logic;
* unchanged verified engineering behavior.
