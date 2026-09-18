# Project Task Email Notifications (Resend)

**Date:** 2026-09-18  
**Status:** Approved design — pending implementation  
**Provider:** Resend (free tier)

## Goal

Notify people by email when project tasks are assigned or when task status changes, without blocking or rolling back task mutations if email fails.

## Scope

### In scope

1. **Task created with an assignee** → email the assignee.
2. **Task status changed** (kanban drag/move **or** edit form) → email project manager + all team members, excluding the actor.
3. Resend-backed `MailService` + project-specific notification helper.
4. Env-based configuration; no-op when API key is missing (dev-safe).

### Out of scope

- In-app / push notifications
- Per-user email preference UI
- Emails for title/description/priority/due-date/assignee-only edits (unless status also changed)
- Comment notifications
- Queues / background workers

## Architecture

```
ProjectsService.createTask / updateTask / moveTask
        │
        ▼ (after successful DB write)
ProjectTaskNotificationService
        │
        ▼
MailService  ──►  Resend API
```

### Components

| Unit | Responsibility |
|------|----------------|
| `MailService` | Send a single email via Resend; read `RESEND_API_KEY`, `MAIL_FROM`; log and swallow failures |
| `ProjectTaskNotificationService` | Resolve recipients, build subject/body, call `MailService`; never throw to callers |
| `ProjectsService` hooks | After successful create / status-changing update / status-changing move, fire notifications without awaiting failure |

Prefer fire-and-forget (`void notify...().catch(...)`) or internal try/catch so HTTP responses are unchanged.

## Triggers & recipients

### A. Task created

**When:** `ProjectsService.createTask` succeeds and the task has an assignee.

**Recipient:** Assignee only.

**Skip when:**

- No assignee
- Assignee has no email
- Actor is the same person as the assignee (same `id` + `source`)

### B. Status changed

**When:**

- `ProjectsService.moveTask` and previous status ≠ new status, **or**
- `ProjectsService.updateTask` and `status` is in the payload and differs from previous status

**Recipients:** Project manager + all `teamMembers` from the project (deduped by `source:id`).

**Skip when:**

- Recipient has no email
- Recipient is the actor who made the change

**Do not** treat sort-order-only moves as status notifications.

## Email content

Keep plain HTML + text; no template engine required for v1.

### Assignment (create)

- **Subject:** `New task assigned: {taskTitle}`
- **Body:** Project name, task title, status label, priority, due date (if any), who assigned it, link to the project tasks board when `APP_ADMIN_URL` is set.

### Status change

- **Subject:** `{taskTitle} moved to {New Status}`
- **Body:** Project name, task title, `{Old Status} → {New Status}`, who moved it, link to the board when `APP_ADMIN_URL` is set.

Reuse existing `statusLabel` helpers from `project-task-activity.util.ts` for human-readable status names.

### Deep link

If `APP_ADMIN_URL` is set (e.g. `https://admin.example.com` or `http://localhost:4200`):

`{APP_ADMIN_URL}/admin/projects/{projectId}/tasks`  
(Exact path must match the existing Angular admin route.)

If unset, omit the link.

## Configuration

| Env var | Required | Purpose |
|---------|----------|---------|
| `RESEND_API_KEY` | For sending | Resend API key |
| `MAIL_FROM` | Recommended | e.g. `PCMazing <onboarding@resend.dev>` for testing, or verified domain |
| `APP_ADMIN_URL` | Optional | Base URL for board links |

Behavior when `RESEND_API_KEY` is missing: log a warning once per send attempt (or once at module init) and return without throwing.

Document vars in `.env.example` if the repo has one; do **not** commit real secrets.

## Error handling

- Email failures must not fail the API request or undo the task write.
- Log Resend errors with task/project ids for debugging.
- Invalid/missing recipient emails are skipped silently (debug log optional).

## Testing / verification

1. With no `RESEND_API_KEY`: create/move task still works; logs show skip.
2. With Resend test key + `MAIL_FROM`: create assigned task → assignee receives mail.
3. Move or edit status → PM + members (except actor) receive mail; actor does not.
4. Create with no assignee → no mail.
5. Sort-order-only move → no status mail.

## Implementation notes

- Add `resend` dependency to `backend/package.json`.
- Wire `MailModule` / providers into `ProjectsModule` (or `AdminModule` so mail is reusable).
- Resolve project participants via existing `getById` / member loading already used by projects.
- Resolve assignee email from existing `ProjectUserSummary.email`.
