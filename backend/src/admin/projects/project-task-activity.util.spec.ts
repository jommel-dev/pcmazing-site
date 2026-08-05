import {
  actorDisplayName,
  buildTaskActivityPhaseFilter,
  buildTaskActivitySummary,
  mapTaskActivityRow,
  matchesTaskActivityPhaseFilter,
  parseTaskActivityMeta,
  serializeTaskActivityMeta,
  statusLabel,
} from './project-task-activity.util';

describe('project-task-activity.util', () => {
  describe('serialize/parse meta', () => {
    it('round-trips plain objects', () => {
      const meta = { fileName: 'shot.png', fileSize: 1200 };
      const serialized = serializeTaskActivityMeta(meta);
      expect(serialized).toBe(JSON.stringify(meta));
      expect(parseTaskActivityMeta(serialized)).toEqual(meta);
    });

    it('returns null for empty or invalid meta', () => {
      expect(serializeTaskActivityMeta(null)).toBeNull();
      expect(serializeTaskActivityMeta({})).toBeNull();
      expect(parseTaskActivityMeta(null)).toBeNull();
      expect(parseTaskActivityMeta('not-json')).toBeNull();
      expect(parseTaskActivityMeta(['x'])).toBeNull();
    });

    it('accepts already-parsed objects', () => {
      expect(parseTaskActivityMeta({ kind: 'screenshot' })).toEqual({ kind: 'screenshot' });
    });
  });

  describe('buildTaskActivitySummary', () => {
    it('describes create, edit, move, and delete', () => {
      expect(
        buildTaskActivitySummary({ actionType: 'created', taskTitle: 'Login API' }),
      ).toBe('Created “Login API”');
      expect(
        buildTaskActivitySummary({ actionType: 'edited', taskTitle: 'Login API' }),
      ).toBe('Edited “Login API”');
      expect(
        buildTaskActivitySummary({
          actionType: 'moved',
          taskTitle: 'Login API',
          fromStatus: 'todo',
          toStatus: 'in_progress',
        }),
      ).toBe('Moved “Login API” from To Do to In Progress');
      expect(
        buildTaskActivitySummary({ actionType: 'deleted', taskTitle: 'Login API' }),
      ).toBe('Deleted “Login API”');
    });

    it('describes comments and attachments', () => {
      expect(
        buildTaskActivitySummary({ actionType: 'comment_added', taskTitle: 'Login API' }),
      ).toBe('Commented on “Login API”');
      expect(
        buildTaskActivitySummary({
          actionType: 'attachment_added',
          taskTitle: 'Login API',
          meta: { fileName: 'wire.png' },
        }),
      ).toBe('Attached “wire.png” to “Login API”');
      expect(
        buildTaskActivitySummary({
          actionType: 'attachment_deleted',
          taskTitle: 'Login API',
          meta: { fileName: 'wire.png' },
        }),
      ).toBe('Removed “wire.png” from “Login API”');
    });
  });

  describe('mapTaskActivityRow', () => {
    it('serializes actor, status, and summary for history responses', () => {
      const item = mapTaskActivityRow({
        id: 9,
        projectId: 1,
        phaseId: 4,
        taskId: 12,
        taskTitle: 'Login API',
        epicId: 3,
        epicTitle: 'Auth',
        actionType: 'moved',
        actorUserId: 7,
        actorUserSource: 'pcmazing_admin_users',
        actorName: 'Jane Doe',
        fromStatus: 'backlog',
        toStatus: 'todo',
        details: null,
        metaJson: null,
        createdAt: '2026-08-05T01:00:00.000Z',
      });

      expect(item).toMatchObject({
        id: 9,
        taskId: 12,
        actionType: 'moved',
        fromStatus: 'backlog',
        toStatus: 'todo',
        actor: {
          userId: 7,
          source: 'pcmazing_admin_users',
          name: 'Jane Doe',
        },
        summary: 'Moved “Login API” from Backlog to To Do',
      });
    });
  });

  describe('history phase filtering', () => {
    it('matches only the selected phase', () => {
      const rows = [
        { phaseId: 1 },
        { phaseId: 2 },
        { phaseId: null },
      ];
      expect(rows.filter((row) => matchesTaskActivityPhaseFilter(row, 2))).toEqual([
        { phaseId: 2 },
      ]);
    });

    it('builds SQL filter params for project + phase', () => {
      expect(buildTaskActivityPhaseFilter(10, 22)).toEqual({
        whereSql: 'project_id = $1 AND phase_id = $2',
        params: [10, 22],
      });
    });

    it('scopes to task only when taskId is set (ignores phase)', () => {
      expect(buildTaskActivityPhaseFilter(10, 22, 55)).toEqual({
        whereSql: 'project_id = $1 AND task_id = $2',
        params: [10, 55],
      });
      expect(buildTaskActivityPhaseFilter(10, null, 55)).toEqual({
        whereSql: 'project_id = $1 AND task_id = $2',
        params: [10, 55],
      });
    });
  });

  describe('actor and status helpers', () => {
    it('prefers fullName over username', () => {
      expect(actorDisplayName({ fullName: 'Jane', username: 'jane' })).toBe('Jane');
      expect(actorDisplayName({ fullName: '  ', username: 'jane' })).toBe('jane');
      expect(actorDisplayName(null)).toBeNull();
    });

    it('maps known status labels', () => {
      expect(statusLabel('backlog')).toBe('Backlog');
      expect(statusLabel('todo')).toBe('To Do');
      expect(statusLabel('custom')).toBe('custom');
    });
  });
});
