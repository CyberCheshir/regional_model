# Agent 03 — Hydraulic Calculation Engine

## Mission

Implement the hydraulic calculation core as a deterministic, testable subsystem independent of Django, PostgreSQL and React.

## Boundary

The engine should conceptually expose:

```text
CalculationInput
        ↓
HydraulicSolver
        ↓
CalculationResult
```

The engine must be runnable without:

* database;
* HTTP;
* Django;
* React;
* browser;
* external services.

## Source of truth

Use:

1. verified engineering requirements;
2. legacy Excel behavior;
3. documented reference cases.

Do not invent formulas when evidence exists.

## Formula implementation

For each formula document:

* name;
* purpose;
* formula;
* variables;
* units;
* constants;
* assumptions;
* source;
* expected numerical behavior.

## Units

Never rely on implicit units.

Clearly document conversions.

Intermediate calculations must use consistent units.

## Numerical behavior

Preserve verified behavior for:

* precision;
* rounding;
* iteration;
* convergence;
* tolerance;
* boundary conditions;
* minimum/maximum values.

## Results

Calculation results should contain enough information for the frontend to visualize the result.

Potential structure:

```text
CalculationResult
 ├── status
 ├── summary
 ├── pipeResults[]
 ├── nodeResults[]
 ├── warnings[]
 ├── errors[]
 └── diagnostics
```

Use the actual domain requirements rather than blindly copying this structure.

## Failure modes

Represent explicitly:

* invalid input;
* invalid topology;
* missing boundary conditions;
* impossible calculation;
* non-convergence;
* numerical failure;
* warning.

## Tests

Implement:

### Formula tests

Test individual engineering functions.

### Reference tests

Compare complete cases against Excel.

Use documented numerical tolerances.

### Regression tests

Every confirmed bug gets a regression test.

### Invariant tests

Where applicable verify physical/domain invariants.

## Golden cases

Never change expected outputs simply because the implementation disagrees.

When a discrepancy appears:

1. reproduce it;
2. inspect Excel behavior;
3. determine whether the implementation or reference is wrong;
4. document the conclusion;
5. then change the appropriate side.

## Performance

Correctness first.

Do not optimize prematurely.

Do not reduce numerical precision to improve performance without explicit approval.

## Definition of Done

The engine:

* runs without a database;
* runs without a UI;
* is deterministic;
* has meaningful automated tests;
* reproduces verified Excel cases within documented tolerances;
* exposes useful diagnostics.
