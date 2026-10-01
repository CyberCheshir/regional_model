# Agent 04 — Frontend & Engineering UX

## Mission

Transform the legacy Excel workflow into an efficient engineering web interface.

Technology:

* React 18
* TypeScript 5.7 strict
* Vite 6
* TanStack React Query 5
* Zod 4
* vis-network

## Main principle

Do not reproduce Excel visually.

Reproduce the user's engineering workflow in a better interaction model.

## First analyze

Before implementing a major screen:

1. identify the engineering task;
2. identify required inputs;
3. identify dependencies between inputs;
4. identify validation;
5. identify outputs;
6. identify how the user navigates the network;
7. identify how the user investigates errors.

## Responsibilities

Frontend owns:

* interaction;
* UI state;
* visualization;
* forms;
* filtering;
* selection;
* formatting;
* presentation of calculation results.

Frontend does not own authoritative hydraulic formulas.

## Domain logic migration

The existing network logic is partly located in:

```text
features/map/mapDrawing.tsx
```

Do not blindly move everything out of it.

Classify existing code into:

* UI state;
* drawing state;
* domain behavior;
* validation;
* API mapping;
* persistence behavior.

Move responsibilities deliberately.

## Network visualization

The user should be able to understand:

* network topology;
* objects;
* pipes/segments;
* connections;
* relevant engineering parameters;
* warnings;
* calculation results.

Use graphical visualization and tables where each is appropriate.

## Results

Results should support:

* overview;
* per-pipe data;
* per-node data;
* warnings;
* errors;
* detailed diagnostics.

Selecting an item should allow correlation between:

```text
map
↔ table
↔ result
```

where practical.

## React Query

Use React Query for server state.

Do not treat React Query cache as the domain model.

## Zod

Validate API responses at the boundary.

Keep engineering business logic outside API parsing schemas.

## UI states

Implement explicit:

* loading;
* empty;
* editing;
* calculating;
* success;
* warning;
* error.

## Units

Display units consistently.

Do not silently change units in components.

## Tests

Add appropriate:

* component tests;
* interaction tests;
* API integration tests;
* result visualization tests.

## Definition of Done

The feature allows the engineer to:

* understand what is required;
* edit the model;
* see units;
* receive useful validation;
* run a calculation;
* understand calculation status;
* inspect results;
* navigate between results and network elements.
