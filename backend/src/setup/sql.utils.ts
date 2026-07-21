export function describeSqlStatement(statement: string): string {
  const normalized = statement.replace(/\s+/g, ' ').trim();

  const insertMatch = normalized.match(/^INSERT\s+INTO\s+"?([^"\s(]+)"?/i);
  if (insertMatch) {
    return `Inserting into ${insertMatch[1]}`;
  }

  const copyMatch = normalized.match(/^COPY\s+"?([^"\s(]+)"?/i);
  if (copyMatch) {
    return `Copying data into ${copyMatch[1]}`;
  }

  const createTableMatch = normalized.match(/^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"?([^"\s(]+)"?/i);
  if (createTableMatch) {
    return `Creating table ${createTableMatch[1]}`;
  }

  const alterMatch = normalized.match(/^ALTER\s+TABLE\s+"?([^"\s(]+)"?/i);
  if (alterMatch) {
    return `Altering table ${alterMatch[1]}`;
  }

  const createIndexMatch = normalized.match(/^CREATE\s+(?:UNIQUE\s+)?INDEX\s+"?([^"\s(]+)"?/i);
  if (createIndexMatch) {
    return `Creating index ${createIndexMatch[1]}`;
  }

  return normalized.slice(0, 80);
}

export function previewSqlStatement(statement: string, maxLength = 220): string {
  return statement.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

export function containsCopyFromStdin(sql: string): boolean {
  return /\bCOPY\b[\s\S]*?\bFROM\s+STDIN\b/i.test(sql);
}

export function requiresPsqlExecution(sql: string): boolean {
  return containsCopyFromStdin(sql) || /^\\[a-z]/im.test(sql);
}

export function shouldPreferPsqlExecution(sql: string, statementCount: number): boolean {
  return requiresPsqlExecution(sql) || statementCount >= 5000;
}

export function splitSqlStatements(sql: string): string[] {
  const normalized = sql.replace(/\r\n/g, '\n');
  const statements: string[] = [];
  let current = '';
  let index = 0;
  let inCopyData = false;

  while (index < normalized.length) {
    if (inCopyData) {
      const remaining = normalized.slice(index);
      const terminatorMatch = remaining.match(/^\\\.(\n|$)/);

      if (terminatorMatch) {
        current += '\\.';
        index += 2;

        if (normalized[index] === '\n') {
          index += 1;
        }

        pushStatement(statements, current);
        current = '';
        inCopyData = false;
        continue;
      }

      current += normalized[index];
      index += 1;
      continue;
    }

    const dollarQuote = readDollarQuote(normalized, index);
    if (dollarQuote) {
      current += dollarQuote.value;
      index = dollarQuote.nextIndex;
      continue;
    }

    const character = normalized[index];

    if (isStringLiteralStart(normalized, index)) {
      const literal = readSingleQuotedLiteral(normalized, index);
      current += literal.value;
      index = literal.nextIndex;
      continue;
    }

    if (character === '/' && normalized[index + 1] === '*') {
      const commentEnd = normalized.indexOf('*/', index + 2);
      const end = commentEnd === -1 ? normalized.length : commentEnd + 2;
      current += normalized.slice(index, end);
      index = end;
      continue;
    }

    if (character === '-' && normalized[index + 1] === '-') {
      const lineEnd = normalized.indexOf('\n', index);
      const end = lineEnd === -1 ? normalized.length : lineEnd + 1;
      current += normalized.slice(index, end);
      index = end;
      continue;
    }

    if (character === ';') {
      current += character;
      const pendingStatement = current;
      pushStatement(statements, pendingStatement);

      if (isCopyFromStdinStatement(pendingStatement)) {
        inCopyData = true;
        current = statements.pop() ?? pendingStatement;
      } else {
        current = '';
      }

      index += 1;
      continue;
    }

    current += character;
    index += 1;
  }

  pushStatement(statements, current);
  return statements;
}

export function prepareMigrationStatements(sql: string): string[] {
  const trimmed = sql.trim();
  if (!trimmed) {
    return [];
  }

  const statements = splitSqlStatements(trimmed);
  if (statements.length === 0) {
    return [];
  }

  const hasBrokenDollarQuotes = statements.some(
    (statement) => hasUnterminatedDollarQuote(statement) || hasUnterminatedSingleQuote(statement),
  );

  if (hasBrokenDollarQuotes) {
    return [trimmed];
  }

  return statements;
}

export function isForeignKeyError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = (error as { code?: string }).code;
  return code === '23503';
}

export function isDuplicateCatalogError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = (error as { code?: string }).code;
  const message = (error as { message?: string }).message ?? '';

  return (
    code === '23505' &&
    (message.includes('pg_type_typname_nsp_index') ||
      message.includes('pg_class_relname_nsp_index'))
  );
}

function isCopyFromStdinStatement(statement: string): boolean {
  return /\bCOPY\b[\s\S]*\bFROM\s+STDIN\b/i.test(statement);
}

function pushStatement(statements: string[], rawStatement: string): void {
  const statement = stripLeadingComments(rawStatement.trim());
  if (statement.length > 0) {
    statements.push(statement);
  }
}

function stripLeadingComments(statement: string): string {
  const lines = statement.split('\n');
  const contentLines: string[] = [];
  let foundContent = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!foundContent && (trimmed.length === 0 || trimmed.startsWith('--'))) {
      continue;
    }

    foundContent = true;
    contentLines.push(line);
  }

  return contentLines.join('\n').trim();
}

function readDollarQuote(
  input: string,
  startIndex: number,
): { value: string; nextIndex: number } | null {
  if (input[startIndex] !== '$') {
    return null;
  }

  const openerMatch = input.slice(startIndex).match(/^\$([A-Za-z0-9_]*)\$/);
  if (!openerMatch) {
    return null;
  }

  const tag = openerMatch[1];
  const opener = openerMatch[0];
  const bodyStart = startIndex + opener.length;
  const closer = `$${tag}$`;
  const closeIndex = input.indexOf(closer, bodyStart);

  if (closeIndex === -1) {
    return {
      value: input.slice(startIndex),
      nextIndex: input.length,
    };
  }

  return {
    value: input.slice(startIndex, closeIndex + closer.length),
    nextIndex: closeIndex + closer.length,
  };
}

function isStringLiteralStart(input: string, index: number): boolean {
  if (input[index] === "'") {
    return true;
  }

  const character = input[index];
  return (character === 'E' || character === 'e') && input[index + 1] === "'";
}

function readSingleQuotedLiteral(
  input: string,
  startIndex: number,
): { value: string; nextIndex: number } {
  let index = startIndex;

  if (input[index] === 'E' || input[index] === 'e') {
    index += 2;
  } else {
    index += 1;
  }

  let value = input.slice(startIndex, index);

  while (index < input.length) {
    const character = input[index];
    value += character;

    if (character === '\\') {
      if (index + 1 < input.length) {
        index += 1;
        value += input[index];
        index += 1;
        continue;
      }
    }

    if (character === "'") {
      if (input[index + 1] === "'") {
        value += input[index + 1];
        index += 2;
        continue;
      }

      return { value, nextIndex: index + 1 };
    }

    index += 1;
  }

  return { value, nextIndex: index };
}

function hasUnterminatedDollarQuote(statement: string): boolean {
  let index = 0;

  while (index < statement.length) {
    const dollarQuote = readDollarQuote(statement, index);
    if (!dollarQuote) {
      index += 1;
      continue;
    }

    if (dollarQuote.nextIndex >= statement.length && !dollarQuote.value.endsWith('$')) {
      return true;
    }

    index = dollarQuote.nextIndex;
  }

  return false;
}

function hasUnterminatedSingleQuote(statement: string): boolean {
  let index = 0;

  while (index < statement.length) {
    if (isStringLiteralStart(statement, index)) {
      const literal = readSingleQuotedLiteral(statement, index);
      if (literal.nextIndex <= index) {
        return true;
      }

      index = literal.nextIndex;
      continue;
    }

    const dollarQuote = readDollarQuote(statement, index);
    if (dollarQuote) {
      index = dollarQuote.nextIndex;
      continue;
    }

    index += 1;
  }

  return false;
}
