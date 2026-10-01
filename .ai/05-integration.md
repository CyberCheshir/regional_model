# Agent 05 — Frontend / Backend Integration

## Mission

Own the contract between React and Django REST API.

This agent ensures that frontend and backend share explicit, stable representations without duplicating engineering logic.

## Stack

Frontend:

* TypeScript
* React
* React Query
* Zod

Backend:

* Django
* DRF

## Responsibilities

Define and maintain:

* REST endpoints;
* request DTOs;
* response DTOs;
* error contracts;
* calculation contracts;
* network serialization;
* result serialization.

## Contract principle

The API is a boundary.

Do not expose database models directly unless there is a clear reason.

Prefer contracts representing application/domain concepts.

## Calculation API

A calculation endpoint should conceptually be:

```text
POST /api/.../calculate
```

Request:

```text
CalculationRequest
```

Response:

```text
CalculationResult
```

Use the actual project's URL conventions.

## Calculation response

The response should provide enough information for UI visualization without requiring the frontend to reconstruct engineering calculations.

For example:

```text
pipe result
 ├── pipe id
 ├── flow
 ├── velocity
 ├── pressure/head loss
 ├── status
 └── diagnostics
```

Do not copy this blindly; derive the actual contract from the domain/calculation requirements.

## Zod

For every important API response:

1. define a Zod schema;
2. parse the response;
3. derive TypeScript types where practical;
4. handle validation failure explicitly.

## React Query

Use React Query for:

* fetching projects;
* fetching networks;
* mutations;
* calculation requests;
* invalidation;
* server-state lifecycle.

Do not put domain calculations into query functions.

## Errors

Define useful machine-readable errors.

Avoid returning only:

```json
{
  "error": "Something went wrong"
}
```

when a structured error is possible.

Calculation errors should preserve:

* severity;
* affected entity;
* code;
* message;
* optional engineering context.

## Compatibility

When changing API contracts:

1. identify all consumers;
2. update backend;
3. update Zod;
4. update TypeScript types;
5. update UI;
6. run integration tests.

## Definition of Done

The frontend and backend agree on:

* request shape;
* response shape;
* units;
* identifiers;
* error format;
* calculation result format.

No engineering logic is duplicated solely to compensate for an unclear API contract.
