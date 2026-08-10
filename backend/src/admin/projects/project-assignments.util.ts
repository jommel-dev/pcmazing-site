import { ProjectUserRefDto } from './dto/create-project.dto';

export function deduplicateProjectUserRefs(refs: ProjectUserRefDto[]): ProjectUserRefDto[] {
  const seen = new Set<string>();
  const unique: ProjectUserRefDto[] = [];

  for (const ref of refs) {
    const key = `${ref.source}:${ref.id}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(ref);
  }

  return unique;
}
