# AI Development Instructions

## Project

This is an engineering web application for hydraulic calculations.

The legacy workflow is implemented in Excel. The new application uses:

* Frontend: React 18, TypeScript 5.7, Vite 6
* Server state: TanStack React Query 5
* Runtime validation: Zod 4
* Graph visualization: vis-network
* Excel import/export: SheetJS
* Backend: Python 3.12, Django 5.2, Django REST Framework 3.16
* Database: PostgreSQL 16
* Infrastructure: Docker Compose

## Mission

The goal is to replace the legacy Excel workflow with a maintainable web application while preserving verified engineering behavior.

The application must provide:

1. a convenient engineering workflow;
2. a clear domain model;
3. a maintainable backend architecture;
4. deterministic hydraulic calculations;
5. visualization of the hydraulic network;
6. clear calculation results and diagnostics;
7. regression protection against changes to engineering behavior.

## Critical engineering rule

The Excel implementation is an important source of truth.

Do not invent engineering formulas when the corresponding behavior can be recovered from the legacy workbook.

Do not silently change:

* formulas;
* constants;
* units;
* rounding;
* tolerances;
* iteration methods;
* default values;
* validation rules.

Any intentional deviation must be explicitly documented and approved.

## Architecture

The target architecture is conceptually:

```text
React / TypeScript
        |
        | REST / JSON
        v
Django REST API
        |
        v
Application Layer
        |
        +----------------+
        |                |
        v                v
     Domain       Calculation Engine
        |                |
        +-------+--------+
                |
          Repository Layer
                |
                v
           PostgreSQL
```

### Frontend

Responsible for:

* UI;
* user interaction;
* visualization;
* local UI state;
* server-state management;
* input presentation;
* result presentation;
* formatting.

Frontend must not contain authoritative hydraulic formulas.

### Application layer

Responsible for:

* use cases;
* orchestration;
* loading domain data;
* validation;
* calculation invocation;
* persistence coordination;
* API DTO mapping.

### Domain layer

Responsible for:

* engineering concepts;
* entities;
* value objects;
* invariants;
* domain rules.

The domain must not directly access the database.

### Calculation engine

Responsible for:

* hydraulic formulas;
* numerical algorithms;
* convergence;
* calculation diagnostics.

The calculation engine must not depend on Django, HTTP, PostgreSQL or React.

### Infrastructure

Responsible for:

* database access;
* repositories;
* Django ORM;
* external integrations;
* persistence models.

## Database rule

Do not query PostgreSQL from inside:

* domain entities;
* domain services;
* hydraulic formulas;
* solver iterations.

For a calculation, load the required project/network into an in-memory calculation snapshot.

Then perform the calculation without further database access.

## Existing frontend domain logic

The current application contains network/domain logic in the frontend, including `features/map/mapDrawing.tsx`.

Do not simply delete or duplicate this logic.

Before moving responsibilities, identify:

* actual domain logic;
* UI state;
* drawing state;
* API DTOs;
* persistence representation.

Then migrate responsibilities deliberately.

## React Query

TanStack React Query is server-state management.

Do not treat React Query cache as the hydraulic domain model.

## Zod

Use Zod to validate external API data at the frontend boundary.

Do not duplicate engineering business rules in Zod schemas unless those rules are specifically input-validation rules.

## Units

Every engineering quantity must have an explicit unit.

Never silently convert units.

Avoid ambiguous names such as:

```text
pressure
flow
length
diameter
```

when the unit is not obvious from the type or surrounding contract.

Prefer explicit documentation/types such as:

```text
pressurePa
pressureBar
flowM3s
flowM3h
lengthM
diameterMm
```

where appropriate for the project conventions.

## Calculation results

Calculation results should be structured and machine-readable.

They should distinguish between:

* successful result;
* warning;
* validation error;
* numerical error;
* non-convergence;
* inconsistent network.

Avoid a generic:

```text
calculation failed
```

when a more useful diagnostic is possible.

## Agent roles

Role playbooks are located directly in `.ai/`:

| Role file | Use for |
|-----------|---------|
| `.ai/01-legacy-domain.md` | recovering domain and business rules from the legacy Excel project |
| `.ai/02-domain-architecture.md` | domain, application layer and backend architecture |
| `.ai/03-hydraulic-engine.md` | hydraulic calculation engine, solver, convergence |
| `.ai/04-frontend-ux.md` | frontend UI, engineering UX, network visualization |
| `.ai/05-integration.md` | React ↔ Django REST API contract |
| `.ai/06-verification.md` | independent review and verification |
| `.ai/07-migration.md` | migrating domain logic out of the React application |

If the user names a role, read that file and follow it in addition to this document.
If no role is named, choose the relevant role(s) by the nature of the task.

## Development workflow

For every non-trivial task:

1. Read the relevant agent playbook in `.ai/` (see "Agent roles").
2. Inspect the existing implementation.
3. Identify dependencies and affected layers.
4. Make a short plan.
5. Implement the smallest coherent change.
6. Run relevant tests and static checks.
7. Fix failures.
8. Inspect the final diff.
9. Check for unrelated modifications.
10. Update documentation/tests when behavior or architecture changes.

## Autonomy

Work autonomously when requirements are sufficiently clear.

Do not stop after writing code if the task requires verification.

Run appropriate:

* backend tests;
* frontend tests;
* TypeScript checks;
* ESLint;
* build;
* calculation reference cases.

Ask for clarification only when:

* requirements are genuinely ambiguous;
* a destructive operation is required;
* credentials or external authorization are required;
* multiple incompatible engineering interpretations exist.

## Never

Never:

* remove tests to make them pass;
* weaken validation to hide errors;
* disable TypeScript strictness;
* disable ESLint to hide errors;
* silently alter engineering formulas;
* modify unrelated files;
* introduce dependencies without justification;
* put database access into calculation code;
* put hydraulic formulas into React components;
* claim engineering correctness without reference verification.

## Git

Do not create commits unless explicitly requested.

Before finishing a task inspect:

```bash
git diff
git status
```

and verify that unrelated files were not modified.

## Definition of Done

A task is complete only when:

* requirements are satisfied;
* architecture boundaries are respected;
* relevant tests pass;
* calculation behavior is verified where applicable;
* units are explicit;
* no unrelated changes were introduced;
* the final diff has been reviewed.
