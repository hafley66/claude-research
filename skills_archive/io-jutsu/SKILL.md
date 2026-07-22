---
name: io-jutsu
description: Document I/O boundaries, external calls, security properties, and data flow for any codebase
license: MIT
compatibility: opencode
metadata:
  audience: security-engineers, developers
  workflow: security-documentation
---

## What I do

I generate comprehensive **I/O Bill of Materials** documentation for codebases. This captures:

- All external system calls (CLI, HTTP, syscalls)
- Filesystem read/write operations
- Network endpoints and protocols
- Database schema and query patterns
- Security boundaries and data sensitivity
- Audit trails and logging

## When to use me

Use this skill when:
- Auditing a codebase for security review
- Onboarding developers to understand system boundaries
- Documenting compliance requirements (SOC2, GDPR)
- Creating threat models
- Reviewing third-party integrations
- Preparing for security audits

## Output format

I produce markdown tables organized by category:

### 1. External CLI Calls
| Command | Purpose | Source Location |
|---------|---------|-----------------|
| `gh api <endpoint>` | REST API access | `src/gh.rs:177` |
| `git clone <url>` | Repository checkout | `src/checkout.rs:173` |

### 2. HTTP/RPC Endpoints
| Method | Endpoint | Body | Response | Source |
|--------|----------|------|----------|--------|
| `GET` | `/events` | — | SSE stream | `src/cmd.rs:320` |
| `POST` | `/subscribe` | JSON | `{"path":"..."}` | `src/cmd.rs:333` |

### 3. REST APIs Called
| Endpoint | Purpose | Source |
|----------|---------|--------|
| `/repos/{owner}/{name}/events` | Activity feed | `src/sync/events.rs:16` |
| `/notifications` | User inbox | `src/sync/notifications.rs:8` |

### 4. Filesystem Operations
| Path | Operation | Purpose | Source |
|------|-----------|---------|--------|
| `~/.config/app/config.toml` | Read | Config loading | `src/config.rs:110` |
| `{staging}/{owner}/{repo}/` | Read/Write | Git checkouts | `src/checkout.rs` |

### 5. Database Schema
| Table | Purpose | Write Pattern |
|-------|---------|---------------|
| `call_log` | API audit trail | `INSERT` (append-only) |
| `pull_request` | PR metadata | `INSERT ... ON CONFLICT DO UPDATE` |

### 6. Data Leaving the Machine
| Data | Destination | Trigger |
|------|-------------|---------|
| API requests | `api.github.com` | Sync operations |
| SSE events | `127.0.0.1:7748` | `change_log` inserts |

### 7. Security Properties
- **No tokens stored** -- auth delegated to `gh` CLI
- **Loopback-only HTTP** -- binds `127.0.0.1`, not externally routable
- **Append-only logs** -- `call_log`, `change_log` are immutable

## How I work

### Step 1: Identify I/O categories
Scan the codebase for:
- Process spawning (`Command::new`, `spawn`, `exec`)
- Network bindings (`TcpListener::bind`, `hyper::serve`)
- HTTP clients (`reqwest::Client`, `curl`)
- Filesystem ops (`std::fs::`, `tokio::fs::`)
- Database connections (`sqlx::connect`, `postgres::Client`)
- Socket operations (`UnixStream`, `TcpStream`)

### Step 2: Trace to source locations
For each I/O operation, record:
- File path and line number
- Function/method name
- Input parameters (especially user-controlled)
- Return values and error handling

### Step 3: Classify data sensitivity
| Level | Examples |
|-------|----------|
| **High** | Source code, credentials, PII, secrets |
| **Medium** | API responses, metadata, logs |
| **Low** | Public data, cached responses, timestamps |

### Step 4: Document security boundaries
- Where does auth happen?
- What data leaves the machine?
- What is stored locally and where?
- What are the trust boundaries?

### Step 5: Identify audit trails
- Append-only logs
- Idempotent operations (`INSERT OR IGNORE`)
- Change tracking tables
- Request/response logging

## Patterns to recognize

### CLI invocation patterns
```rust
// Rust
Command::new("gh").args(["api", endpoint]).output().await?;
Command::new("git").args(["-C", &path, "fetch"]).status().await?;

// Go
exec.Command("gh", "api", endpoint).Output()

// Python
subprocess.run(["gh", "api", endpoint], capture_output=True)
```

### HTTP server patterns
```rust
// Tokio + manual
TcpListener::bind("127.0.0.1:7748").await?;

// Hyper
hyper::Server::bind(&addr).serve(make_svc);

// Actix
actix_web::HttpServer::new(|| ...).bind("127.0.0.1:8080")?;
```

### Database patterns
```rust
// Upsert pattern
sqlx::query("INSERT ... ON CONFLICT DO UPDATE")
    .bind(...)
    .execute(&pool).await?;

// Append-only
sqlx::query("INSERT INTO call_log (...) VALUES (...)")
    .execute(&pool).await?;

// Idempotent insert
sqlx::query("INSERT OR IGNORE INTO repo_event (...)")
    .execute(&pool).await?;
```

### Filesystem patterns
```rust
// Config loading
dirs::config_dir().join("app").join("config.toml");

// Staging area
staging.join(owner).join(repo);

// Pidfile for instance lock
db_path.parent().join("gh.pid");
```

## Questions to answer

When documenting a codebase, answer:

1. **External dependencies**
   - What CLI binaries are invoked?
   - What HTTP APIs are called?
   - What databases are connected to?

2. **Data persistence**
   - What files are written?
   - What is stored in databases?
   - What is cached vs. computed fresh?

3. **Network exposure**
   - What ports are bound?
   - Loopback-only or externally routable?
   - What authentication is required?

4. **Auth & secrets**
   - Where do credentials come from?
   - Are tokens stored or delegated?
   - How is auth refreshed?

5. **Audit & compliance**
   - What operations are logged?
   - Are logs immutable?
   - Can operations be replayed/reconstructed?

6. **Data sensitivity**
   - What is the most sensitive data handled?
   - Where is it stored?
   - Who/what can access it?

## Example invocation

User: "document all I/O and security boundaries for this repo"

I will:
1. Search for CLI invocations, HTTP servers, database ops, filesystem ops
2. Trace each to source locations
3. Classify data sensitivity
4. Produce markdown tables matching the format above
5. Add security properties summary

## Related patterns

- **Threat modeling**: Use I/O boundaries to identify attack surfaces
- **Compliance docs**: Map data flows to GDPR/SOC2 requirements
- **Incident response**: Audit trails enable forensics
- **Code review**: Spot-check new I/O against documented boundaries
