import {
  containsCopyFromStdin,
  prepareMigrationStatements,
  requiresPsqlExecution,
  shouldPreferPsqlExecution,
} from './sql.utils';

describe('sql.utils', () => {
  it('keeps COPY data blocks in a single statement', () => {
    const sql = `
CREATE TABLE demo (id int, created_at timestamptz);
COPY public.demo (id, created_at) FROM stdin;
1	2026-06-29T00:00:00.000+09:00
2	2026-06-30T00:00:00.000Z
\\.
`;

    const statements = prepareMigrationStatements(sql);

    expect(statements).toHaveLength(2);
    expect(statements[0]).toMatch(/^CREATE TABLE demo/i);
    expect(statements[1]).toMatch(/^COPY public\.demo/i);
    expect(statements[1]).toContain('2026-06-29T00:00:00.000+09:00');
    expect(statements[1]).toMatch(/\\\.(\s*)$/);
  });

  it('does not split INSERT statements on semicolons inside escaped strings', () => {
    const sql = `
SET standard_conforming_strings = off;
INSERT INTO "tblsales_order_payments" ("reference_no", "payment_date")
VALUES ('REF\\'; note; split-here', '2026-06-29T00:00:00.000+09:00');
`;

    const statements = prepareMigrationStatements(sql);

    expect(statements).toHaveLength(2);
    expect(statements[1]).toContain("note; split-here");
    expect(statements[1]).toContain('2026-06-29T00:00:00.000+09:00');
  });

  it('detects pgAdmin dumps that require psql', () => {
    const sql = 'COPY public.users FROM stdin;\n1\tadmin\n\\.\n';

    expect(containsCopyFromStdin(sql)).toBe(true);
    expect(requiresPsqlExecution(sql)).toBe(true);
  });

  it('prefers psql for very large dumps', () => {
    expect(shouldPreferPsqlExecution('SELECT 1;', 30883)).toBe(true);
    expect(shouldPreferPsqlExecution('SELECT 1;', 10)).toBe(false);
  });
});
