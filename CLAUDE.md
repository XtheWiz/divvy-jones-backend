# Divvy-Jones Project Context

## Project Overview
Divvy-Jones is an expense splitting application built with:
- **Runtime:** Bun
- **Framework:** Elysia.js
- **Database:** PostgreSQL with Drizzle ORM
- **Language:** TypeScript

## Agile Multi-Agent Workflow

This project uses a simulated Agile team workflow with Claude playing different roles:

### Team Roles

| Role | Command | Responsibilities |
|------|---------|------------------|
| **Project Owner** | "as project owner" | Define sprints, acceptance criteria, backlog prioritization |
| **Lead Developer** | "as lead developer" | Planning, task breakdown, code review, architecture decisions |
| **Backend Developer** | "as backend developer" | Implementation, unit tests, PRs |
| **QA Engineer** | "as QA" | Test cases, validation, sign-off |

### Sprint Workflow
```
1. PO → Define SPRINT.md with features & acceptance criteria
2. Lead Dev → Create PLANNING.md, break down TASKS.md
3. Backend Dev → Implement in feature branch (worktree)
4. Lead Dev → Code review → REVIEW_LOG.md
5. QA → Test & validate → QA_REPORT.md
6. All → Retrospective → RETROSPECTIVE.md
7. Merge to develop, close sprint
```

### Git Worktrees
The project uses git worktrees for parallel development:
```
.worktrees/
├── lead-dev/    # Planning, reviews
├── backend-dev/ # Implementation
└── qa/          # Testing
```

Branch strategy:
- `main` - Production releases
- `develop` - Integration branch
- `sprint-XXX/TASK-XXX-description` - Feature branches

## Project Structure

```
src/
├── app.ts              # Elysia app setup
├── index.ts            # Entry point
├── routes/             # API route handlers
├── services/           # Business logic
├── middleware/         # Auth, etc.
├── lib/                # Utilities, responses
├── db/                 # Drizzle schema & connection
└── __tests__/          # Bun tests
```

## Code Conventions

### API Responses
Always use the standard format from `src/lib/responses.ts`:
```typescript
// Success
return success({ data });

// Error
return error(ErrorCodes.NOT_FOUND, "Resource not found");
```

### Authentication
- JWT in Authorization header: `Bearer <token>`
- Access tokens: 15 min expiry
- Refresh tokens: 30 days, single-use, rotated

### Validation
- Use TypeBox schemas for request validation
- Password: min 8 chars, uppercase, lowercase, number
- Join codes: 8 chars, uppercase alphanumeric, no ambiguous chars (0/O/1/I/L)

## Sprint Documentation

All sprint artifacts are in `Sprints/sprint-XXX/`:
- `SPRINT.md` - Sprint definition, acceptance criteria
- `PLANNING.md` - Technical decisions, architecture notes
- `TASKS.md` - Task board
- `REVIEW_LOG.md` - Code review findings
- `QA_REPORT.md` - Test results
- `RETROSPECTIVE.md` - What went well, action items

## Current Status

**Last Completed:** Sprint 001
- User Authentication (registration, login, tokens, profile)
- Basic Group Management (create, join, list, members)
- 36/36 acceptance criteria met
- 44/44 tests passing

**Action Items for Next Sprint:**
1. Fix dynamic imports in `src/routes/users.ts`
2. Add JWT secret production check
3. Set up test database for E2E tests
4. Add rate limiting to auth endpoints

## Team Energy & What Works

### Keep Doing
- Clear acceptance criteria before implementation
- Code review catches issues early
- Automated tests provide confidence
- Documentation as we go
- Security-first approach

### Communication Style
- Reference acceptance criteria (AC-X.X) in code comments
- Update todo list frequently for visibility
- Document decisions in sprint artifacts
- Clear handoffs between roles

## Commands Reference

```bash
# Run dev server
bun run dev

# Run tests
bun test

# Build
bun build src/index.ts --outdir ./dist --target bun
```

## Key Files to Check

When starting a new sprint, review:
1. `Sprints/CURRENT_SPRINT.md` - Current status
2. `Sprints/BACKLOG.md` - Feature backlog
3. Previous `RETROSPECTIVE.md` - Action items to address
