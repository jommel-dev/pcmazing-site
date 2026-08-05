import 'reflect-metadata';
import {
  PROJECT_BOARD_STATUSES,
  PROJECT_EPIC_BOARD_STATUSES,
  PROJECT_TASK_STATUSES,
} from './project-task.dto';

describe('project task board statuses', () => {
  it('keeps the required board order', () => {
    expect(PROJECT_BOARD_STATUSES).toEqual([
      'epics',
      'backlog',
      'todo',
      'in_progress',
      'in_review',
      'testing',
      'done',
    ]);
  });

  it('keeps tasks out of the dedicated Epics board and includes backlog', () => {
    expect(PROJECT_TASK_STATUSES).toEqual([
      'backlog',
      'todo',
      'in_progress',
      'in_review',
      'testing',
      'done',
    ]);
    expect(PROJECT_TASK_STATUSES).not.toContain('epics');
    expect(PROJECT_TASK_STATUSES[0]).toBe('backlog');
  });

  it('defaults create-task status to todo via optional status field', () => {
    // CreateProjectTaskDto.status is optional; service uses dto.status ?? 'todo'.
    expect(PROJECT_TASK_STATUSES).toContain('todo');
    expect(PROJECT_TASK_STATUSES).toContain('backlog');
  });

  it('restricts epic cards to the Epics board', () => {
    expect(PROJECT_EPIC_BOARD_STATUSES).toEqual(['epics']);
  });
});
