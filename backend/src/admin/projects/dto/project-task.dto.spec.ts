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
      'todo',
      'in_progress',
      'in_review',
      'testing',
      'done',
    ]);
  });

  it('keeps tasks out of the dedicated Epics board', () => {
    expect(PROJECT_TASK_STATUSES).toEqual([
      'todo',
      'in_progress',
      'in_review',
      'testing',
      'done',
    ]);
    expect(PROJECT_TASK_STATUSES).not.toContain('epics');
  });

  it('restricts epic cards to the Epics board', () => {
    expect(PROJECT_EPIC_BOARD_STATUSES).toEqual(['epics']);
  });
});
