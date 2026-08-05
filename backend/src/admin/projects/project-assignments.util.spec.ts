import { ProjectUserRefDto } from './dto/create-project.dto';
import { deduplicateProjectUserRefs } from './project-assignments.util';

describe('deduplicateProjectUserRefs', () => {
  it('removes duplicate references while preserving the first occurrence order', () => {
    const refs = [
      { id: 10, source: 'pcmazing_admin_users' },
      { id: 20, source: 'tblusers' },
      { id: 10, source: 'pcmazing_admin_users' },
    ] as ProjectUserRefDto[];

    expect(deduplicateProjectUserRefs(refs)).toEqual([
      { id: 10, source: 'pcmazing_admin_users' },
      { id: 20, source: 'tblusers' },
    ]);
  });
});
