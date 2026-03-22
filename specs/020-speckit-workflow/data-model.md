# Data Model: stack-template.md Schema

**Feature**: Spec-Kit Workflow Update (020-speckit-workflow)  
**Schema Version**: 1.0  
**Purpose**: Defines the canonical field set for any project's `stack.md` file, versioned so new fields can be appended without invalidating existing entries.

---

## Schema Structure

The `stack-template.md` file is a Markdown document with a `schema_version` field and standard sections. When a speckit agent reads an existing `stack.md`, it compares the `schema_version` to the template's current version and prompts only for missing fields.

### Meta Section

| Field | Type | Required | Auto-detectable | Description |
|-------|------|----------|----------------|-------------|
| `schema_version` | string (semver) | Yes | No — set by template | Template version; used for upgrade detection |
| `last_updated` | date (YYYY-MM-DD) | Yes | Yes — set on write | Date last modified |
| `updated_by` | string | Yes | Yes — set on write | Agent or user who last updated |

### Packaging Section

| Field | Type | Required | Auto-detectable | Detection source |
|-------|------|----------|----------------|-----------------|
| `tool` | string | Yes | Yes | Presence of `pnpm-lock.yaml`, `yarn.lock`, `package-lock.json`, `Pipfile.lock`, `Cargo.lock`, etc. |
| `workspace_file` | string | No | Yes | `pnpm-workspace.yaml`, `lerna.json`, etc. |
| `lock_file` | string | Yes | Yes | File name of detected lock file |
| `install_cmd` | string | Yes | Yes | Inferred from `tool` |
| `add_dep_cmd` | string | Yes | Yes | Inferred from `tool` |

### Version Constraints Section

| Field | Type | Required | Auto-detectable | Detection source |
|-------|------|----------|----------------|-----------------|
| `node_version` | string | No | Yes | `.nvmrc`, `engines` in `package.json` |
| `package_manager_version` | string | No | Yes | `packageManager` in `package.json` |
| `language_version` | string | No | Yes | `tsconfig.json`, `pyproject.toml`, `.ruby-version`, etc. |

### Linting Section

| Field | Type | Required | Auto-detectable | Detection source |
|-------|------|----------|----------------|-----------------|
| `tool` | string | Yes | Yes | `eslint.config.*`, `.eslintrc*`, `.pylintrc`, `rubocop.yml`, etc. |
| `config_file` | string | No | Yes | First matching config file found |
| `lint_cmd` | string | Yes | Yes | From `package.json` scripts or inferred |
| `fix_cmd` | string | No | Yes | From `package.json` scripts or inferred |

### Testing Section

| Field | Type | Required | Auto-detectable | Detection source |
|-------|------|----------|----------------|-----------------|
| `backend_framework` | string | Yes | Yes | From `package.json` devDependencies (vitest, jest, pytest, rspec, etc.) |
| `backend_run_cmd` | string | Yes | Yes | From `package.json` test script |
| `backend_contract_cmd` | string | No | Yes | From `package.json` test:contract script |
| `frontend_unit_cmd` | string | No | Yes | From frontend `package.json` test script |
| `frontend_e2e_framework` | string | No | Yes | From devDependencies (playwright, cypress, etc.) |
| `frontend_e2e_cmd` | string | No | Yes | From `package.json` test:e2e script |
| `e2e_requires_servers` | boolean | No | Yes | If `playwright` detected, default `true` |

### Build Section

| Field | Type | Required | Auto-detectable | Detection source |
|-------|------|----------|----------------|-----------------|
| `build_cmd` | string | Yes | Yes | From root `package.json` build script |
| `backend_build_cmd` | string | No | Yes | From backend `package.json` |
| `frontend_build_cmd` | string | No | Yes | From frontend `package.json` |

### Infrastructure Section

| Field | Type | Required | Auto-detectable | Detection source |
|-------|------|----------|----------------|-----------------|
| `local_dev_cmd` | string | No | Yes | From `package.json` dev script |
| `required_services` | string[] | No | Partial | From `docker-compose.yml` service names |
| `infra_start_cmd` | string | No | Yes | `docker compose up -d` if `docker-compose.yml` present |

### Database Section (include only if DB detected)

| Field | Type | Required | Auto-detectable | Detection source |
|-------|------|----------|----------------|-----------------|
| `orm` | string | No | Yes | From dependencies (prisma, typeorm, drizzle, sqlalchemy, etc.) |
| `schema_file` | string | No | Yes | `prisma/schema.prisma`, etc. |
| `migrate_cmd` | string | No | Yes | From `package.json` prisma:migrate script |
| `generate_cmd` | string | No | Yes | From `package.json` prisma:generate script |

### Project Type Section

| Field | Type | Required | Auto-detectable | Detection source |
|-------|------|----------|----------------|-----------------|
| `type` | enum | Yes | Yes | `web-service` / `mobile-app` / `library` / `cli` / `desktop-app` / `monorepo` |
| `platforms` | string[] | No | Yes | From directory structure, Capacitor config, Tauri config |

### Commit Convention Section

| Field | Type | Required | Auto-detectable | Detection source |
|-------|------|----------|----------------|-----------------|
| `format` | string | Yes | No — copy from constitution | Conventional Commits format string |
| `phase_commit_formats` | table | Yes | No — copy from constitution | Phase → message format mapping |

### Regression Test Commands Section

| Field | Type | Required | Auto-detectable | Detection source |
|-------|------|----------|----------------|-----------------|
| `lint_cmd` | string | Yes | Yes | Same as Linting.lint_cmd |
| `test_cmd` | string | Yes | Yes | Same as Testing.backend_run_cmd |
| `e2e_cmd` | string | No | Yes | Same as Testing.frontend_e2e_cmd |
| `e2e_requires` | string | No | Yes | Note about server startup if `e2e_requires_servers` is true |

---

## Version Upgrade Procedure

When `schema_version` in an existing `stack.md` is lower than the template's current version:

1. Agent reads existing `stack.md` and notes the `schema_version`
2. Agent reads `stack-template.md` and identifies all fields not present in existing file
3. For each missing field: attempt auto-detect first; if not detectable, prompt developer
4. Append missing fields to existing `stack.md` under their correct sections
5. Update `schema_version`, `last_updated`, `updated_by`
6. Commit updated `stack.md` using `conventional-commit` skill

**Invariant**: Fields already present in `stack.md` are NEVER overwritten during a version upgrade.

---

## State Transitions

```
stack.md absent
      │
      ▼
[Offer: auto-detect | manual entry]
      │
      ├── auto-detect → inspect repo files → populate all detectable fields → prompt for non-detectable
      │
      └── manual entry → prompt for each required field in section order
      │
      ▼
stack.md created (schema_version: 1.0)
      │
      ▼
[Future: template schema_version 1.1 released]
      │
      ▼
[Detect version mismatch on next speckit run]
      │
      ▼
[Prompt only for new fields, append, update schema_version]
      │
      ▼
stack.md upgraded (schema_version: 1.1)
```
