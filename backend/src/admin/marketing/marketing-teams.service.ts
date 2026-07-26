import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { tableExists } from '../common/admin-table.util';
import { AddTeamMemberDto } from './dto/add-team-member.dto';
import { CreateMarketingTeamDto } from './dto/create-marketing-team.dto';

export interface MarketingTeamMember {
  id: number;
  userId: number;
  memberRole: string;
  userName: string | null;
}

export interface MarketingTeamNode {
  id: number;
  name: string;
  parentTeamId: number | null;
  createdByUserId: number;
  members: MarketingTeamMember[];
  children: MarketingTeamNode[];
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class MarketingTeamsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async ensureTables(): Promise<void> {
    if (!(await tableExists(this.databaseService, 'pcmazing_marketing_teams'))) {
      throw new ServiceUnavailableException('Marketing team tables are not available. Run migration 007.');
    }
  }

  async listTree(): Promise<MarketingTeamNode[]> {
    await this.ensureTables();

    const teamsResult = await this.databaseService.query<{
      id: number;
      name: string;
      parent_team_id: number | null;
      created_by_user_id: number;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, name, parent_team_id, created_by_user_id, created_at::text, updated_at::text
       FROM pcmazing_marketing_teams
       ORDER BY name ASC`,
    );

    const membersResult = await this.databaseService.query<{
      id: number;
      team_id: number;
      user_id: number;
      member_role: string;
    }>(
      `SELECT id, team_id, user_id, member_role
       FROM pcmazing_marketing_team_members
       ORDER BY id ASC`,
    );

    const userNames = await this.loadUserNames(
      membersResult.rows.map((row) => row.user_id),
    );

    const teamMap = new Map<number, MarketingTeamNode>();

    for (const team of teamsResult.rows) {
      teamMap.set(team.id, {
        id: team.id,
        name: team.name,
        parentTeamId: team.parent_team_id,
        createdByUserId: team.created_by_user_id,
        members: [],
        children: [],
        createdAt: team.created_at,
        updatedAt: team.updated_at,
      });
    }

    for (const member of membersResult.rows) {
      const team = teamMap.get(member.team_id);
      if (!team) {
        continue;
      }
      team.members.push({
        id: member.id,
        userId: member.user_id,
        memberRole: member.member_role,
        userName: userNames.get(member.user_id) ?? null,
      });
    }

    const roots: MarketingTeamNode[] = [];
    for (const team of teamMap.values()) {
      if (team.parentTeamId && teamMap.has(team.parentTeamId)) {
        teamMap.get(team.parentTeamId)!.children.push(team);
      } else {
        roots.push(team);
      }
    }

    return roots;
  }

  async createTeam(dto: CreateMarketingTeamDto, userId: number): Promise<MarketingTeamNode> {
    await this.ensureTables();

    const result = await this.databaseService.query<{ id: number }>(
      `INSERT INTO pcmazing_marketing_teams (name, parent_team_id, created_by_user_id)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [dto.name.trim(), dto.parentTeamId ?? null, userId],
    );

    const teamId = result.rows[0]?.id;
    if (!teamId) {
      throw new BadRequestException('Unable to create marketing team.');
    }

    const memberRole = dto.parentTeamId ? 'sub_marketing' : 'lead_marketing';
    await this.databaseService.query(
      `INSERT INTO pcmazing_marketing_team_members (team_id, user_id, member_role)
       VALUES ($1, $2, $3)
       ON CONFLICT (team_id, user_id) DO UPDATE SET member_role = EXCLUDED.member_role`,
      [teamId, dto.managerUserId ?? userId, memberRole],
    );

    const tree = await this.listTree();
    const flat = this.flattenTree(tree);
    const created = flat.find((team) => team.id === teamId);
    if (!created) {
      throw new NotFoundException('Created team was not found.');
    }
    return created;
  }

  async addMember(teamId: number, dto: AddTeamMemberDto): Promise<MarketingTeamMember> {
    await this.ensureTables();

    const teamExists = await this.databaseService.query<{ id: number }>(
      `SELECT id FROM pcmazing_marketing_teams WHERE id = $1 LIMIT 1`,
      [teamId],
    );
    if (teamExists.rowCount === 0) {
      throw new NotFoundException(`Team ${teamId} was not found.`);
    }

    const result = await this.databaseService.query<{
      id: number;
      user_id: number;
      member_role: string;
    }>(
      `INSERT INTO pcmazing_marketing_team_members (team_id, user_id, member_role)
       VALUES ($1, $2, $3)
       ON CONFLICT (team_id, user_id) DO UPDATE SET member_role = EXCLUDED.member_role
       RETURNING id, user_id, member_role`,
      [teamId, dto.userId, dto.memberRole ?? 'member'],
    );

    const row = result.rows[0];
    const userNames = await this.loadUserNames([row.user_id]);

    return {
      id: row.id,
      userId: row.user_id,
      memberRole: row.member_role,
      userName: userNames.get(row.user_id) ?? null,
    };
  }

  async listAssignableUsers(): Promise<Array<{ id: number; fullName: string; role: string }>> {
    if (await tableExists(this.databaseService, 'tblusers')) {
      const result = await this.databaseService.query<{
        id: number;
        fullname: string | null;
        username: string;
        role: string | null;
      }>(
        `SELECT
          u.id,
          COALESCE(
            to_jsonb(u)->>'fullName',
            to_jsonb(u)->>'full_name',
            to_jsonb(u)->>'name',
            u.username
          ) AS fullname,
          u.username,
          COALESCE(to_jsonb(u)->>'role', 'staff') AS role
         FROM tblusers u
         ORDER BY fullname ASC`,
      );

      return result.rows.map((row) => ({
        id: row.id,
        fullName: row.fullname ?? row.username,
        role: row.role ?? 'staff',
      }));
    }

    if (await tableExists(this.databaseService, 'pcmazing_admin_users')) {
      const result = await this.databaseService.query<{
        id: number;
        full_name: string;
        role: string;
      }>(
        `SELECT id, full_name, role
         FROM pcmazing_admin_users
         WHERE is_active = TRUE
         ORDER BY full_name ASC`,
      );

      return result.rows.map((row) => ({
        id: row.id,
        fullName: row.full_name,
        role: row.role,
      }));
    }

    return [];
  }

  private flattenTree(nodes: MarketingTeamNode[]): MarketingTeamNode[] {
    const items: MarketingTeamNode[] = [];
    for (const node of nodes) {
      items.push(node);
      items.push(...this.flattenTree(node.children));
    }
    return items;
  }

  private async loadUserNames(userIds: number[]): Promise<Map<number, string>> {
    const uniqueIds = [...new Set(userIds.filter((id) => Number.isFinite(id)))];
    const map = new Map<number, string>();
    if (uniqueIds.length === 0) {
      return map;
    }

    if (await tableExists(this.databaseService, 'tblusers')) {
      const result = await this.databaseService.query<{
        id: number;
        fullname: string | null;
        username: string;
      }>(
        `SELECT
          u.id,
          COALESCE(
            to_jsonb(u)->>'fullName',
            to_jsonb(u)->>'full_name',
            to_jsonb(u)->>'name',
            u.username
          ) AS fullname,
          u.username
         FROM tblusers u
         WHERE u.id = ANY($1::bigint[])`,
        [uniqueIds],
      );

      for (const row of result.rows) {
        map.set(row.id, row.fullname ?? row.username);
      }
      return map;
    }

    if (await tableExists(this.databaseService, 'pcmazing_admin_users')) {
      const result = await this.databaseService.query<{ id: number; full_name: string }>(
        `SELECT id, full_name FROM pcmazing_admin_users WHERE id = ANY($1::bigint[])`,
        [uniqueIds],
      );
      for (const row of result.rows) {
        map.set(row.id, row.full_name);
      }
    }

    return map;
  }
}
