# Agent 02 — Domain, Application & Backend Architecture

## Mission

Design the backend architecture that separates engineering domain logic, application orchestration, persistence and API concerns.

Technology:

* Python 3.12
* Django 5.2
* Django REST Framework 3.16
* PostgreSQL 16

## Core principle

The domain is not the database model.

Django ORM models represent persistence.

Domain objects represent engineering concepts.

Keep these responsibilities separate when the complexity of the domain justifies it.

## Target flow

```text
REST API
   |
Application Use Case
   |
Repository
   |
Domain Model
   |
Calculation Engine
   |
Calculation Result
   |
Application DTO
   |
REST API
```

## Calculation snapshot

For hydraulic calculations:

1. load the required network/project;
2. construct a complete in-memory snapshot;
3. validate the snapshot;
4. run calculations;
5. return structured results;
6. persist results explicitly if required.

The solver must not query repositories.

## Domain layer

Define domain concepts based on findings from Agent 01.

Possible concepts include:

```text
Project
Network
Pipe
Node
Connection
Material
Fluid
BoundaryCondition
CalculationScenario
CalculationResult
```

Only implement concepts supported by actual requirements.

## Application layer

Use cases should orchestrate operations such as:

```text
LoadNetwork
CreateNetwork
UpdatePipe
UpdateNode
ValidateNetwork
RunHydraulicCalculation
SaveCalculation
```

Use the project's actual naming conventions.

## Repository layer

Repositories should hide persistence details.

Conceptually:

```python
network = network_repository.get(network_id)
```

The application/domain layer should not depend on Django ORM query details.

## Django

Use Django ORM in infrastructure/persistence code.

Do not put complex hydraulic calculations into:

* Django models;
* serializers;
* views;
* querysets.

## API

The API should expose stable application-level contracts rather than leaking database structure unnecessarily.

## Deliverables

Create/update:

```text
docs/architecture/architecture.md
docs/architecture/data-flow.md
docs/architecture/calculation-boundary.md
```

Implement the architecture incrementally.

## Migration rule

Do not rewrite the entire backend in one operation.

Prefer:

1. define domain model;
2. define application boundary;
3. introduce repository boundary;
4. introduce calculation boundary;
5. migrate existing behavior;
6. remove obsolete paths;
7. test.

## Database performance

Avoid N+1 queries.

When loading a calculation snapshot, load all required data deliberately.

Do not introduce caching until actual access patterns and performance requirements are understood.

## Definition of Done

The architecture clearly shows:

```text
API
 ↓
Application
 ↓
Domain / Calculation
 ↓
Repository
 ↓
Database
```

and no calculation path performs database access from inside solver/domain operations.
