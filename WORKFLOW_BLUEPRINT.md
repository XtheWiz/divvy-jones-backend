# Divvy-Jones Workflow Blueprint

## Overview

This document provides a comprehensive guide to the Agile multi-agent workflow system used for developing Divvy-Jones. The workflow enables parallel development through git worktrees with four specialized agent roles working in concert.

---

## Quick Start

### Starting a New Sprint

```bash
# 1. Ensure you're on develop branch
git checkout develop

# 2. Copy templates to new sprint folder
cp -r Sprints/templates Sprints/sprint-XXX/
mv Sprints/sprint-XXX/SPRINT_TEMPLATE.md Sprints/sprint-XXX/SPRINT.md
# ... rename other templates

# 3. PO fills out SPRINT.md with features and acceptance criteria
# 4. Lead Dev conducts planning and populates PLANNING.md, TASKS.md
```

### Working in a Worktree

```bash
# Navigate to your designated worktree
cd .worktrees/backend-dev

# Create feature branch
git checkout -b sprint-001/TASK-001-user-authentication

# Do your work...

# Commit and push
git add .
git commit -m "Implement user authentication"
git push -u origin sprint-001/TASK-001-user-authentication
```

---

## Team Roles

### Project Owner (PO)

**Responsibilities:**
- Define sprint goals and priorities
- Write acceptance criteria for features
- Manage product backlog (`Sprints/BACKLOG.md`)
- Sign off on completed features

**Key Documents:**
- `Sprints/BACKLOG.md` - Maintains this
- `Sprints/sprint-XXX/SPRINT.md` - Creates this

**Workflow:**
1. Review backlog and prioritize features
2. Select features for upcoming sprint
3. Write clear acceptance criteria
4. Participate in sprint planning
5. Review completed work against acceptance criteria
6. Participate in retrospective

---

### Lead Developer

**Responsibilities:**
- Technical architecture decisions
- Break down features into tasks
- Assign tasks to developers
- Conduct code reviews
- Ensure code quality and standards

**Worktree:** `.worktrees/lead-dev`

**Key Documents:**
- `Sprints/sprint-XXX/PLANNING.md` - Creates this
- `Sprints/sprint-XXX/TASKS.md` - Manages this
- `Sprints/sprint-XXX/REVIEW_LOG.md` - Updates this

**Workflow:**
1. Participate in sprint planning with PO
2. Analyze features and identify technical approach
3. Break features into implementation tasks
4. Estimate task complexity
5. Assign tasks to Backend Developer
6. Review submitted code
7. Pass approved code to QA
8. Facilitate retrospective

---

### Backend Developer

**Responsibilities:**
- Implement assigned tasks
- Write unit tests
- Follow coding standards
- Create pull requests
- Address review feedback

**Worktree:** `.worktrees/backend-dev`

**Key Documents:**
- `Sprints/sprint-XXX/tasks/TASK-XXX.md` - Updates status
- Task-specific documentation

**Workflow:**
1. Pick up assigned task from TASKS.md
2. Update task status to "In Progress"
3. Create feature branch: `sprint-XXX/TASK-XXX-description`
4. Implement the feature
5. Write tests
6. Submit for review (update status to "In Review")
7. Address review feedback
8. Hand off to QA when approved

---

### QA Engineer

**Responsibilities:**
- Write test cases from acceptance criteria
- Execute manual and automated tests
- Document bugs and issues
- Sign off on quality

**Worktree:** `.worktrees/qa`

**Key Documents:**
- `Sprints/sprint-XXX/QA_REPORT.md` - Creates and maintains

**Workflow:**
1. Review acceptance criteria
2. Create test cases
3. Execute tests when code is ready
4. Document results (pass/fail)
5. Report bugs with reproduction steps
6. Verify bug fixes
7. Sign off when all criteria met

---

## Sprint Lifecycle

### Phase 1: Sprint Initiation

```
┌─────────────────────────────────────────────────────────────┐
│                    SPRINT INITIATION                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  PO Actions:                                                 │
│  ├── Review previous RETROSPECTIVE.md                       │
│  ├── Select features from BACKLOG.md                        │
│  ├── Write SPRINT.md                                        │
│  │   ├── Sprint goal                                        │
│  │   ├── Features to deliver                                │
│  │   └── Acceptance criteria                                │
│  └── Schedule planning session                              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Phase 2: Sprint Planning

```
┌─────────────────────────────────────────────────────────────┐
│                    SPRINT PLANNING                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Lead Dev Actions:                                           │
│  ├── Review SPRINT.md with team                             │
│  ├── Discuss technical approach                             │
│  ├── Identify risks and dependencies                        │
│  ├── Break features into tasks                              │
│  ├── Estimate complexity (XS/S/M/L/XL)                      │
│  ├── Document in PLANNING.md                                │
│  ├── Create tasks in TASKS.md                               │
│  └── Assign tasks to Backend Dev                            │
│                                                              │
│  All Roles:                                                  │
│  └── Sign off on planning                                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Phase 3: Development

```
┌─────────────────────────────────────────────────────────────┐
│                    DEVELOPMENT CYCLE                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Backend Dev:                                                │
│  ├── cd .worktrees/backend-dev                              │
│  ├── git checkout -b sprint-XXX/TASK-XXX-desc               │
│  ├── Implement feature                                      │
│  ├── Write unit tests                                       │
│  ├── Commit changes                                         │
│  └── Update TASKS.md → "In Review"                          │
│                                                              │
│  Lead Dev:                                                   │
│  ├── cd .worktrees/lead-dev                                 │
│  ├── Review code                                            │
│  ├── Document in REVIEW_LOG.md                              │
│  │   ├── Approved → Pass to QA                              │
│  │   └── Changes Requested → Back to Dev                    │
│  └── Update TASKS.md → "QA"                                 │
│                                                              │
│  QA:                                                         │
│  ├── cd .worktrees/qa                                       │
│  ├── Execute test cases                                     │
│  ├── Document results in QA_REPORT.md                       │
│  │   ├── Pass → Update TASKS.md → "Done"                    │
│  │   └── Fail → Log bug, back to Dev                        │
│  └── Sign off when all tests pass                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Phase 4: Sprint Close

```
┌─────────────────────────────────────────────────────────────┐
│                    SPRINT CLOSE                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  All Roles:                                                  │
│  ├── Conduct retrospective                                  │
│  ├── Document in RETROSPECTIVE.md                           │
│  │   ├── What went well                                     │
│  │   ├── What didn't go well                                │
│  │   └── Action items                                       │
│  ├── Merge completed features to develop                    │
│  └── Update BACKLOG.md                                      │
│                                                              │
│  Lead Dev:                                                   │
│  ├── Merge feature branches to develop                      │
│  ├── Tag release if applicable                              │
│  └── Update CURRENT_SPRINT.md for next sprint               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Git Workflow Details

### Branch Structure

```
main                              # Production releases only
│
└── develop                       # Integration branch
    │
    ├── lead-dev/workspace        # Lead Dev worktree branch
    ├── backend-dev/workspace     # Backend Dev worktree branch
    ├── qa/workspace              # QA worktree branch
    │
    ├── sprint-001/TASK-001-user-auth
    ├── sprint-001/TASK-002-group-crud
    └── sprint-001/TASK-003-expense-add
```

### Common Git Commands

```bash
# Check worktree status
git worktree list

# Update worktree from develop
cd .worktrees/backend-dev
git fetch origin
git rebase origin/develop

# Create feature branch
git checkout -b sprint-001/TASK-001-description

# After code review approval, merge to develop
git checkout develop
git merge sprint-001/TASK-001-description

# Clean up merged branch
git branch -d sprint-001/TASK-001-description
```

### Merge Strategy

1. **Feature → Develop:** Squash merge with meaningful commit message
2. **Develop → Main:** Merge commit (preserves history)
3. **Hotfix:** Cherry-pick to main, then merge main to develop

---

## Document Reference

### Directory Structure

```
Sprints/
├── BACKLOG.md                    # All pending features
├── CURRENT_SPRINT.md             # Points to active sprint
├── templates/
│   ├── SPRINT_TEMPLATE.md
│   ├── TASK_TEMPLATE.md
│   ├── PLANNING_TEMPLATE.md
│   ├── REVIEW_TEMPLATE.md
│   ├── QA_TEMPLATE.md
│   └── RETRO_TEMPLATE.md
└── sprint-001/
    ├── SPRINT.md                 # Sprint scope (PO)
    ├── PLANNING.md               # Technical plan (Lead Dev)
    ├── TASKS.md                  # Task board (Lead Dev)
    ├── REVIEW_LOG.md             # Code reviews (Lead Dev)
    ├── QA_REPORT.md              # Test results (QA)
    ├── RETROSPECTIVE.md          # Sprint reflection (All)
    └── tasks/                    # Detailed task specs
        └── TASK-001.md
```

### Document Ownership

| Document | Creator | Updaters | Approvers |
|----------|---------|----------|-----------|
| BACKLOG.md | PO | PO, Lead Dev | PO |
| SPRINT.md | PO | PO | All |
| PLANNING.md | Lead Dev | Lead Dev | All |
| TASKS.md | Lead Dev | All | Lead Dev |
| REVIEW_LOG.md | Lead Dev | Lead Dev | - |
| QA_REPORT.md | QA | QA | QA |
| RETROSPECTIVE.md | Lead Dev | All | All |

---

## Status Definitions

### Task Status

| Status | Description | Owner |
|--------|-------------|-------|
| **Todo** | Task created, not started | - |
| **In Progress** | Developer actively working | Backend Dev |
| **In Review** | Submitted for code review | Lead Dev |
| **Changes Requested** | Review feedback to address | Backend Dev |
| **QA** | Passed review, testing in progress | QA |
| **Done** | QA approved, ready for merge | - |
| **Blocked** | Cannot proceed, dependency issue | - |

### Sprint Status

| Status | Description |
|--------|-------------|
| **Planning** | Sprint scope being defined |
| **In Progress** | Development actively happening |
| **Review** | All tasks in review/QA |
| **Completed** | Sprint closed, retro done |

---

## Best Practices

### For All Roles

1. **Always check previous retrospective** before starting new sprint
2. **Update documents in real-time** - don't batch updates
3. **Be specific** in acceptance criteria and bug reports
4. **Communicate blockers immediately** via task status

### For Backend Developers

1. **One task at a time** - complete before picking up next
2. **Write tests first** when possible (TDD)
3. **Small, focused commits** with clear messages
4. **Self-review before submitting** for code review

### For Lead Developers

1. **Review within 24 hours** of submission
2. **Be constructive** in feedback
3. **Document decisions** in PLANNING.md
4. **Keep TASKS.md current** at all times

### For QA Engineers

1. **Write test cases before development** starts
2. **Document exact reproduction steps** for bugs
3. **Verify fixes thoroughly** before signing off
4. **Include evidence** (screenshots, logs) in reports

---

## Troubleshooting

### Worktree Issues

```bash
# Worktree shows incorrect branch
git worktree repair

# Remove and recreate worktree
git worktree remove .worktrees/backend-dev
git worktree add .worktrees/backend-dev -b backend-dev/workspace develop

# Fix detached HEAD in worktree
cd .worktrees/backend-dev
git checkout backend-dev/workspace
```

### Merge Conflicts

```bash
# When rebasing feature branch
git checkout sprint-001/TASK-001-desc
git fetch origin
git rebase origin/develop
# Resolve conflicts
git add .
git rebase --continue
```

---

## Quick Reference Card

```
╔════════════════════════════════════════════════════════════════╗
║                    WORKFLOW QUICK REFERENCE                     ║
╠════════════════════════════════════════════════════════════════╣
║                                                                 ║
║  START SPRINT:                                                  ║
║    PO → SPRINT.md → Lead Dev → PLANNING.md, TASKS.md           ║
║                                                                 ║
║  DEVELOPMENT:                                                   ║
║    Backend Dev → Feature Branch → Code → PR → Review → QA      ║
║                                                                 ║
║  END SPRINT:                                                    ║
║    Retrospective → Merge → Tag → Next Sprint                   ║
║                                                                 ║
║  BRANCH NAMING:                                                 ║
║    sprint-XXX/TASK-XXX-short-description                       ║
║                                                                 ║
║  WORKTREES:                                                     ║
║    Lead Dev:    .worktrees/lead-dev                            ║
║    Backend Dev: .worktrees/backend-dev                         ║
║    QA:          .worktrees/qa                                  ║
║                                                                 ║
║  KEY DOCUMENTS:                                                 ║
║    Sprints/sprint-XXX/SPRINT.md     - What to build            ║
║    Sprints/sprint-XXX/TASKS.md      - Task board               ║
║    Sprints/sprint-XXX/REVIEW_LOG.md - Code reviews             ║
║    Sprints/sprint-XXX/QA_REPORT.md  - Test results             ║
║                                                                 ║
╚════════════════════════════════════════════════════════════════╝
```

---

## Version

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-20 | Team | Initial workflow blueprint |
