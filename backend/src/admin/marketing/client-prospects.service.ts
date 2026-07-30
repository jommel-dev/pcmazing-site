import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import {
  buildPagination,
  buildPaginationMeta,
  tableExists,
} from '../common/admin-table.util';
import { hasAdminMeetingOutcomeAccess, hasMarketingFullAccess, hasSuperAdminAccess, isSameUserId } from './marketing-access.util';
import { CreateClientAppointmentDto } from './dto/create-client-appointment.dto';
import { CreateClientProspectDto } from './dto/create-client-prospect.dto';
import { CreateClientResponseDto } from './dto/create-client-response.dto';
import { UpdateClientProspectDto } from './dto/update-client-prospect.dto';
import { UpdateClientProspectStatusDto } from './dto/update-client-prospect-status.dto';
import {
  followUpMethodLabel,
  hasReachedFollowUpLimit,
  isFollowUpIncrementStatus,
  mapFollowUpMethodToProspectStatus,
  MAX_PROSPECT_FOLLOW_UPS,
} from './prospect-follow-up.util';
import { CurrencyExchangeService } from './currency-exchange.service';
import { isPhpCurrency, normalizeCurrencyCode } from './prospect-deal.util';
import { ProspectDealFieldsDto } from './dto/prospect-deal-fields.dto';
import {
  buildProspectImportPreview,
  parseProspectImportContent,
  PROSPECT_IMPORT_TEMPLATE_CSV,
  ProspectImportPreview,
} from './prospect-import.util';

export interface ClientProspectListItem {
  id: number;
  clientName: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  status: string;
  source: string;
  assignedUserId: number | null;
  assignedUserName: string | null;
  pickedUpBy: number | null;
  pickedUpByName: string | null;
  pickedUpAt: string | null;
  responseCount: number;
  latestResponseAt: string | null;
  hasAppointment: boolean;
  followUpCount: number;
  maxFollowUps: number;
  clientType: string;
  currency: string;
  proposedPriceDeal: number | null;
  estimatedPriceDealPhp: number | null;
  exchangeRateUsed: number | null;
  exchangeRateDate: string | null;
  commissionPercent: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProspectDealSummary {
  estimatedProjectDeal: number;
  projectDeal: number;
  commissioned: number;
  totalProjectDeal: number;
}

export interface ClientProspectDetail extends ClientProspectListItem {
  notes: string | null;
  assignedTeamId: number | null;
  contract: {
    id: number;
    projectName: string;
    projectType: string;
    signedAt: string | null;
    remarks: string | null;
    modules: Array<{
      id: number;
      name: string;
      description: string | null;
      features: string | null;
      processFlow: string | null;
    }>;
    milestones: Array<{
      id: number;
      title: string;
      description: string | null;
      dueDate: string | null;
      connectedModuleId: string | null;
    }>;
    paymentSchedule: Array<{
      id: number;
      label: string;
      amount: number;
      description: string | null;
      dueDate: string | null;
      notes: string | null;
      connectedMilestoneId: string | null;
    }>;
  } | null;
  responses: Array<{
    id: number;
    userId: number;
    userName: string | null;
    responseType: string;
    notes: string | null;
    outcome: string | null;
    followUpDate: string | null;
    followUpMethod: string | null;
    remarks: string | null;
    createdAt: string;
  }>;
  appointments: Array<{
    id: number;
    title: string;
    startsAt: string;
    endsAt: string;
    meetingType: string;
    locationOrLink: string | null;
    notes: string | null;
    userId: number;
    userName: string | null;
  }>;
}

@Injectable()
export class ClientProspectsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly currencyExchangeService: CurrencyExchangeService,
  ) {}

  async ensureTables(): Promise<void> {
    if (!(await tableExists(this.databaseService, 'pcmazing_client_prospects'))) {
      throw new ServiceUnavailableException('Lead generation tables are not available. Run migration 007.');
    }
  }

  async list(
    userId: number,
    userRole: string | undefined,
    pageRaw?: string,
    limitRaw?: string,
    search?: string,
    status?: string,
  ) {
    await this.ensureTables();
    const effectiveRole = await this.resolveUserRole(userId, userRole);
    const fullAccess = hasMarketingFullAccess(effectiveRole);
    const { page, limit, offset } = buildPagination(pageRaw, limitRaw);
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (!fullAccess) {
      params.push(userId);
      conditions.push(
        `(p.assigned_user_id = $${params.length}
          OR p.picked_up_by = $${params.length}
          OR p.created_by_user_id = $${params.length})`,
      );
    }

    if (search?.trim()) {
      params.push(`%${search.trim()}%`);
      conditions.push(
        `(p.client_name ILIKE $${params.length}
          OR COALESCE(p.company, '') ILIKE $${params.length}
          OR COALESCE(p.email, '') ILIKE $${params.length}
          OR COALESCE(p.phone, '') ILIKE $${params.length})`,
      );
    }

    if (status?.trim()) {
      params.push(status.trim());
      conditions.push(`p.status = $${params.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await this.databaseService.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM pcmazing_client_prospects p ${whereClause}`,
      params,
    );
    const total = Number(countResult.rows[0]?.count ?? 0);

    const listParams = [...params, limit, offset];
    const limitIndex = params.length + 1;
    const offsetIndex = params.length + 2;

    const result = await this.databaseService.query<{
      id: number;
      client_name: string;
      company: string | null;
      email: string | null;
      phone: string | null;
      address: string | null;
      status: string;
      source: string;
      assigned_user_id: number | null;
      picked_up_by: number | null;
      picked_up_at: string | null;
      created_at: string;
      updated_at: string;
      response_count: string;
      latest_response_at: string | null;
      has_appointment: boolean;
      follow_up_count: number;
      client_type: string;
      currency: string;
      proposed_price_deal: string | null;
      estimated_price_deal_php: string | null;
      commission_percent: string | null;
    }>(
      `SELECT
        p.id,
        p.client_name,
        p.company,
        p.email,
        p.phone,
        p.address,
        p.status,
        p.source,
        p.assigned_user_id,
        p.picked_up_by,
        p.picked_up_at::text,
        p.created_at::text,
        p.updated_at::text,
        COALESCE(p.follow_up_count, 0) AS follow_up_count,
        p.client_type,
        p.currency,
        p.proposed_price_deal::text,
        p.estimated_price_deal_php::text,
        p.commission_percent::text,
        COUNT(r.id)::text AS response_count,
        MAX(r.created_at)::text AS latest_response_at,
        EXISTS (
          SELECT 1 FROM pcmazing_client_appointments a WHERE a.prospect_id = p.id
        ) AS has_appointment
       FROM pcmazing_client_prospects p
       LEFT JOIN pcmazing_client_responses r ON r.prospect_id = p.id
       ${whereClause}
       GROUP BY p.id
       ORDER BY p.updated_at DESC, p.id DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      listParams,
    );

    const userNames = await this.loadUserNames(
      result.rows.flatMap((row) => [row.assigned_user_id, row.picked_up_by]),
    );

    return {
      items: result.rows.map((row) => ({
        id: row.id,
        clientName: row.client_name,
        company: row.company,
        email: row.email,
        phone: row.phone,
        address: row.address,
        status: row.status,
        source: row.source,
        assignedUserId: row.assigned_user_id,
        assignedUserName: row.assigned_user_id ? userNames.get(row.assigned_user_id) ?? null : null,
        pickedUpBy: row.picked_up_by,
        pickedUpByName: row.picked_up_by ? userNames.get(row.picked_up_by) ?? null : null,
        pickedUpAt: row.picked_up_at,
        responseCount: Number(row.response_count),
        latestResponseAt: row.latest_response_at,
        hasAppointment: row.has_appointment,
        followUpCount: Number(row.follow_up_count ?? 0),
        maxFollowUps: MAX_PROSPECT_FOLLOW_UPS,
        ...this.mapDealFields(row),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
      meta: buildPaginationMeta(page, limit, total),
      fullAccess,
    };
  }

  async getById(id: number, userId: number, userRole: string | undefined): Promise<ClientProspectDetail> {
    await this.ensureTables();
    const effectiveRole = await this.resolveUserRole(userId, userRole);
    await this.assertCanAccessProspect(id, userId, effectiveRole);

    const header = await this.getProspectHeader(id);
    const responses = await this.databaseService.query<{
      id: number;
      user_id: number;
      response_type: string;
      notes: string | null;
      outcome: string | null;
      follow_up_date: string | null;
      follow_up_method: string | null;
      remarks: string | null;
      created_at: string;
    }>(
      `SELECT
        id,
        user_id,
        response_type,
        notes,
        outcome,
        follow_up_date::text,
        follow_up_method,
        remarks,
        created_at::text
       FROM pcmazing_client_responses
       WHERE prospect_id = $1
       ORDER BY created_at DESC`,
      [id],
    );

    const appointments = await this.databaseService.query<{
      id: number;
      user_id: number;
      title: string;
      starts_at: string;
      ends_at: string;
      meeting_type: string;
      location_or_link: string | null;
      notes: string | null;
    }>(
      `SELECT id, user_id, title, starts_at::text, ends_at::text, meeting_type, location_or_link, notes
       FROM pcmazing_client_appointments
       WHERE prospect_id = $1
       ORDER BY starts_at ASC`,
      [id],
    );
    const contract = await this.loadProspectContract(id);

    const userNames = await this.loadUserNames([
      header.assigned_user_id,
      header.picked_up_by,
      ...responses.rows.map((row) => row.user_id),
      ...appointments.rows.map((row) => row.user_id),
    ]);

    return {
      ...this.mapListItem(header, userNames),
      address: header.address,
      notes: header.notes,
      assignedTeamId: header.assigned_team_id,
      contract,
      responses: responses.rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        userName: userNames.get(row.user_id) ?? null,
        responseType: row.response_type,
        notes: row.notes,
        outcome: row.outcome,
        followUpDate: row.follow_up_date,
        followUpMethod: row.follow_up_method,
        remarks: row.remarks,
        createdAt: row.created_at,
      })),
      appointments: appointments.rows.map((row) => ({
        id: row.id,
        title: row.title,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        meetingType: row.meeting_type,
        locationOrLink: row.location_or_link,
        notes: row.notes,
        userId: row.user_id,
        userName: userNames.get(row.user_id) ?? null,
      })),
    };
  }

  async create(dto: CreateClientProspectDto, userId: number, userRole?: string) {
    await this.ensureTables();
    const effectiveRole = await this.resolveUserRole(userId, userRole);
    const deal = await this.resolveDealPricing(dto);

    const result = await this.databaseService.query<{ id: number }>(
      `INSERT INTO pcmazing_client_prospects (
        client_name, company, email, phone, address, notes, status, source, created_by_user_id,
        client_type, currency, proposed_price_deal, estimated_price_deal_php, exchange_rate_used, exchange_rate_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'manual', $8, $9, $10, $11, $12, $13, $14)
      RETURNING id`,
      [
        dto.clientName.trim(),
        dto.company?.trim() || null,
        dto.email?.trim() || null,
        dto.phone?.trim() || null,
        dto.address?.trim() || null,
        dto.notes?.trim() || null,
        dto.status ?? 'available',
        userId,
        deal.clientType,
        deal.currency,
        deal.proposedPriceDeal,
        deal.estimatedPriceDealPhp,
        deal.exchangeRateUsed,
        deal.exchangeRateDate,
      ],
    );

    const id = result.rows[0]?.id;
    if (!id) {
      throw new BadRequestException('Unable to create client prospect.');
    }

    return this.getById(id, userId, effectiveRole);
  }

  async pickup(id: number, userId: number, userRole: string | undefined) {
    await this.ensureTables();
    const effectiveRole = await this.resolveUserRole(userId, userRole);

    const prospect = await this.getProspectHeader(id);
    if (prospect.status !== 'available') {
      throw new BadRequestException('Only available prospects can be picked up.');
    }

    if (
      !hasMarketingFullAccess(effectiveRole)
      && prospect.assigned_user_id
      && !isSameUserId(prospect.assigned_user_id, userId)
    ) {
      throw new ForbiddenException('This prospect is assigned to another team member.');
    }

    await this.databaseService.query(
      `UPDATE pcmazing_client_prospects
       SET status = 'picked_up',
           picked_up_by = $1,
           picked_up_at = NOW(),
           assigned_user_id = $1,
           follow_up_count = 0,
           updated_at = NOW()
       WHERE id = $2`,
      [userId, id],
    );

    return this.getById(id, userId, effectiveRole);
  }

  async updateDetails(
    id: number,
    dto: UpdateClientProspectDto,
    userId: number,
    userRole: string | undefined,
  ) {
    await this.ensureTables();
    const effectiveRole = await this.resolveUserRole(userId, userRole);
    const prospect = await this.getProspectHeader(id);

    if (['closed_lost', 'contract_signed'].includes(prospect.status)) {
      throw new BadRequestException('This prospect can no longer be edited.');
    }

    if (prospect.status === 'closed_won') {
      if (!hasSuperAdminAccess(effectiveRole)) {
        throw new BadRequestException('Closed won prospects can only be edited by Super Admin.');
      }
      return this.updateClosedWonProspect(id, dto, userId, prospect, effectiveRole);
    }

    if (prospect.status === 'meeting_set') {
      throw new BadRequestException('Meeting is scheduled. Edit client details after the meeting outcome is recorded.');
    }

    const isAvailable = prospect.status === 'available';
    if (isAvailable) {
      if (!hasMarketingFullAccess(effectiveRole) && !isSameUserId(prospect.created_by_user_id, userId)) {
        throw new ForbiddenException('You can only edit prospects you created.');
      }
    } else {
      await this.assertCanAccessProspect(id, userId, effectiveRole);
    }

    await this.applyProspectDetailsUpdate(id, dto, prospect);
    return this.getById(id, userId, effectiveRole);
  }

  private async applyProspectDetailsUpdate(
    id: number,
    dto: UpdateClientProspectDto,
    prospect: Awaited<ReturnType<typeof this.getProspectHeader>>,
  ) {
    const clientName = dto.clientName?.trim() || prospect.client_name;
    const company = dto.company !== undefined ? dto.company.trim() || null : prospect.company;
    const email = dto.email !== undefined ? dto.email.trim() || null : prospect.email;
    const phone = dto.phone !== undefined ? dto.phone.trim() || null : prospect.phone;
    const address = dto.address !== undefined ? dto.address.trim() || null : prospect.address;
    const notes = dto.notes !== undefined ? dto.notes.trim() || null : prospect.notes;
    const deal = await this.resolveDealPricing({
      clientType: dto.clientType ?? prospect.client_type,
      currency: dto.currency ?? prospect.currency,
      proposedPriceDeal:
        dto.proposedPriceDeal !== undefined
          ? dto.proposedPriceDeal
          : this.toNullableNumber(prospect.proposed_price_deal),
    });

    await this.databaseService.query(
      `UPDATE pcmazing_client_prospects
       SET client_name = $1,
           company = $2,
           email = $3,
           phone = $4,
           address = $5,
           notes = $6,
           client_type = $7,
           currency = $8,
           proposed_price_deal = $9,
           estimated_price_deal_php = $10,
           exchange_rate_used = $11,
           exchange_rate_date = $12,
           updated_at = NOW()
       WHERE id = $13`,
      [
        clientName,
        company,
        email,
        phone,
        address,
        notes,
        deal.clientType,
        deal.currency,
        deal.proposedPriceDeal,
        deal.estimatedPriceDealPhp,
        deal.exchangeRateUsed,
        deal.exchangeRateDate,
        id,
      ],
    );

    return id;
  }

  async getDealSummary(userId: number, userRole: string | undefined): Promise<ProspectDealSummary> {
    await this.ensureTables();
    const effectiveRole = await this.resolveUserRole(userId, userRole);
    if (!hasSuperAdminAccess(effectiveRole)) {
      throw new ForbiddenException('Deal summary is available to Super Admin only.');
    }

    const dealPhpSql = `COALESCE(p.estimated_price_deal_php, p.proposed_price_deal, 0)`;

    const result = await this.databaseService.query<{
      estimated_project_deal: string;
      project_deal: string;
      commissioned_total: string;
    }>(
      `SELECT
        COALESCE(SUM(CASE
          WHEN p.status NOT IN ('closed_won', 'contract_signed', 'closed_lost', 'available') THEN ${dealPhpSql}
          ELSE 0
        END), 0)::text AS estimated_project_deal,
        COALESCE(SUM(CASE
          WHEN p.status IN ('closed_won', 'contract_signed') THEN ${dealPhpSql}
          ELSE 0
        END), 0)::text AS project_deal,
        COALESCE(SUM(CASE
          WHEN p.status IN ('closed_won', 'contract_signed') THEN ${dealPhpSql} * COALESCE(p.commission_percent, 0) / 100.0
          ELSE 0
        END), 0)::text AS commissioned_total
       FROM pcmazing_client_prospects p`,
    );

    const row = result.rows[0];
    const projectDeal = Number(row?.project_deal ?? 0);
    const commissioned = Number(row?.commissioned_total ?? 0);

    return {
      estimatedProjectDeal: Number(row?.estimated_project_deal ?? 0),
      projectDeal,
      commissioned,
      totalProjectDeal: projectDeal - commissioned,
    };
  }

  async convertDealEstimate(fromCurrency: string, amount: number) {
    return this.currencyExchangeService.convertToPhp(amount, fromCurrency);
  }

  private async updateClosedWonProspect(
    id: number,
    dto: UpdateClientProspectDto,
    userId: number,
    prospect: Awaited<ReturnType<typeof this.getProspectHeader>>,
    effectiveRole: string | undefined,
  ) {
    await this.assertCanAccessProspect(id, userId, effectiveRole);

    const clientName = dto.clientName?.trim() || prospect.client_name;
    const company = dto.company !== undefined ? dto.company.trim() || null : prospect.company;
    const email = dto.email !== undefined ? dto.email.trim() || null : prospect.email;
    const phone = dto.phone !== undefined ? dto.phone.trim() || null : prospect.phone;
    const address = dto.address !== undefined ? dto.address.trim() || null : prospect.address;
    const notes = dto.notes !== undefined ? dto.notes.trim() || null : prospect.notes;
    const deal = await this.resolveDealPricing({
      clientType: dto.clientType ?? prospect.client_type,
      currency: dto.currency ?? prospect.currency,
      proposedPriceDeal:
        dto.proposedPriceDeal !== undefined
          ? dto.proposedPriceDeal
          : this.toNullableNumber(prospect.proposed_price_deal),
    });
    const commissionPercent =
      dto.commissionPercent !== undefined
        ? this.parseCommissionPercent(dto.commissionPercent)
        : this.toNullableNumber(prospect.commission_percent);

    await this.databaseService.query(
      `UPDATE pcmazing_client_prospects
       SET client_name = $1,
           company = $2,
           email = $3,
           phone = $4,
           address = $5,
           notes = $6,
           client_type = $7,
           currency = $8,
           proposed_price_deal = $9,
           estimated_price_deal_php = $10,
           exchange_rate_used = $11,
           exchange_rate_date = $12,
           commission_percent = $13,
           updated_at = NOW()
       WHERE id = $14`,
      [
        clientName,
        company,
        email,
        phone,
        address,
        notes,
        deal.clientType,
        deal.currency,
        deal.proposedPriceDeal,
        deal.estimatedPriceDealPhp,
        deal.exchangeRateUsed,
        deal.exchangeRateDate,
        commissionPercent,
        id,
      ],
    );

    return this.getById(id, userId, effectiveRole);
  }

  private async resolveDealPricing(dto: ProspectDealFieldsDto) {
    const clientType = dto.clientType === 'international' ? 'international' : 'local';
    const currency = normalizeCurrencyCode(dto.currency);
    const proposedRaw = dto.proposedPriceDeal;

    if (proposedRaw === undefined || proposedRaw === null) {
      return {
        clientType,
        currency,
        proposedPriceDeal: null,
        estimatedPriceDealPhp: null,
        exchangeRateUsed: null,
        exchangeRateDate: null,
      };
    }

    const proposedPriceDeal = Number(proposedRaw);
    if (!Number.isFinite(proposedPriceDeal) || proposedPriceDeal < 0) {
      throw new BadRequestException('Proposed price deal must be a non-negative number.');
    }

    if (isPhpCurrency(currency)) {
      return {
        clientType,
        currency,
        proposedPriceDeal,
        estimatedPriceDealPhp: null,
        exchangeRateUsed: null,
        exchangeRateDate: null,
      };
    }

    const conversion = await this.currencyExchangeService.convertToPhp(proposedPriceDeal, currency);
    return {
      clientType,
      currency,
      proposedPriceDeal,
      estimatedPriceDealPhp: conversion.convertedAmount,
      exchangeRateUsed: conversion.rate,
      exchangeRateDate: conversion.rateDate,
    };
  }

  private mapDealFields(row: {
    client_type: string;
    currency: string;
    proposed_price_deal: string | null;
    estimated_price_deal_php: string | null;
    exchange_rate_used?: string | null;
    exchange_rate_date?: string | null;
    commission_percent?: string | null;
  }) {
    return {
      clientType: row.client_type,
      currency: row.currency,
      proposedPriceDeal: this.toNullableNumber(row.proposed_price_deal),
      estimatedPriceDealPhp: this.toNullableNumber(row.estimated_price_deal_php),
      exchangeRateUsed: this.toNullableNumber(row.exchange_rate_used ?? null),
      exchangeRateDate: row.exchange_rate_date ?? null,
      commissionPercent: this.toNullableNumber(row.commission_percent ?? null),
    };
  }

  private parseCommissionPercent(value: number | null | undefined): number | null {
    if (value === undefined || value === null) {
      return null;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      throw new BadRequestException('Commission percent must be between 0 and 100.');
    }
    return parsed;
  }

  private toNullableNumber(value: string | number | null | undefined): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  async updateStatus(
    id: number,
    dto: UpdateClientProspectStatusDto,
    userId: number,
    userRole: string | undefined,
  ) {
    await this.ensureTables();
    const effectiveRole = await this.resolveUserRole(userId, userRole);
    await this.assertCanAccessProspect(id, userId, effectiveRole);

    const prospect = await this.getProspectHeader(id);
    if (prospect.status === 'available') {
      throw new BadRequestException('Pick up this prospect before updating progress.');
    }

    if (['closed_lost', 'contract_signed'].includes(prospect.status)) {
      throw new BadRequestException('This prospect is already closed.');
    }

    if (prospect.status === 'closed_won' || prospect.status === 'contract_under_review') {
      if (!hasAdminMeetingOutcomeAccess(effectiveRole)) {
        throw new ForbiddenException('Only Admin can update contract progress for a won prospect.');
      }

      if (prospect.status === 'closed_won' && dto.status === 'contract_under_review') {
        return this.recordContractUnderReview(id, dto, userId, effectiveRole);
      }

      if (dto.status === 'contract_signed') {
        return this.recordContractSigned(id, dto, userId, effectiveRole, prospect);
      }

      throw new BadRequestException(
        prospect.status === 'closed_won'
          ? 'Closed won prospects can move to Contract Under Review or Contract Signed.'
          : 'Contract under review prospects can only move to Contract Signed.',
      );
    }

    if (prospect.status === 'meeting_set') {
      if (!hasAdminMeetingOutcomeAccess(effectiveRole)) {
        throw new ForbiddenException(
          'Meeting is scheduled. Await the meeting outcome before further updates.',
        );
      }

      const meetingOutcomes = ['closed_won', 'closed_lost', 'no_response', 'pending_decision'];
      if (!meetingOutcomes.includes(dto.status)) {
        throw new BadRequestException(
          'After a meeting is scheduled, only Win, Loss, No Response, or Pending Decision can be recorded.',
        );
      }

      if (dto.status === 'no_response' || dto.status === 'pending_decision') {
        return this.resumeFollowUpsAfterMeeting(id, dto, userId, effectiveRole);
      }
    }

    if (dto.status === 'return_to_available') {
      return this.returnProspectToAvailable(id, dto, userId, prospect, effectiveRole);
    }

    if (dto.status === 'follow_up') {
      return this.recordFollowUp(id, dto, userId, prospect, effectiveRole);
    }

    if (dto.status === 'closed_lost' && prospect.status !== 'meeting_set') {
      if (!hasReachedFollowUpLimit(prospect.follow_up_count)) {
        throw new BadRequestException(
          `Loss can only be recorded after ${MAX_PROSPECT_FOLLOW_UPS} follow-ups.`,
        );
      }
    }

    if (isFollowUpIncrementStatus(dto.status)) {
      if (hasReachedFollowUpLimit(prospect.follow_up_count)) {
        throw new BadRequestException(
          `Maximum ${MAX_PROSPECT_FOLLOW_UPS} follow-ups reached. Mark as Loss or return to Available.`,
        );
      }
    }

    if (dto.status === 'meeting_set') {
      if (!dto.startsAt || !dto.endsAt || !dto.title?.trim()) {
        throw new BadRequestException('Meeting title, start time, and end time are required.');
      }

      if (new Date(dto.endsAt) <= new Date(dto.startsAt)) {
        throw new BadRequestException('Appointment end time must be after start time.');
      }

      const conflicts = await this.checkAppointmentConflict(userId, dto.startsAt, dto.endsAt);
      if (conflicts.length > 0) {
        throw new BadRequestException('This time slot conflicts with an existing appointment.');
      }

      await this.databaseService.query(
        `INSERT INTO pcmazing_client_appointments (
          prospect_id, user_id, title, starts_at, ends_at, meeting_type, location_or_link, notes
        ) VALUES ($1, $2, $3, $4::timestamptz, $5::timestamptz, $6, $7, $8)`,
        [
          id,
          userId,
          dto.title.trim(),
          dto.startsAt,
          dto.endsAt,
          dto.meetingType ?? 'face_to_face',
          dto.locationOrLink?.trim() || null,
          dto.notes?.trim() || null,
        ],
      );
    }

    const responseType = this.mapStatusToResponseType(dto.status);
    const nextFollowUpCount = isFollowUpIncrementStatus(dto.status)
      ? prospect.follow_up_count + 1
      : prospect.follow_up_count;

    await this.databaseService.query(
      `INSERT INTO pcmazing_client_responses (prospect_id, user_id, response_type, notes, outcome)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        id,
        userId,
        responseType,
        dto.notes?.trim() || null,
        isFollowUpIncrementStatus(dto.status)
          ? `Follow-up ${nextFollowUpCount}/${MAX_PROSPECT_FOLLOW_UPS} — ${this.mapStatusToOutcomeLabel(dto.status)}`
          : this.mapStatusToOutcomeLabel(dto.status),
      ],
    );

    await this.databaseService.query(
      `UPDATE pcmazing_client_prospects
       SET status = $1,
           follow_up_count = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [dto.status, nextFollowUpCount, id],
    );

    return this.getById(id, userId, effectiveRole);
  }

  private async resumeFollowUpsAfterMeeting(
    id: number,
    dto: UpdateClientProspectStatusDto,
    userId: number,
    effectiveRole: string | undefined,
  ) {
    const outcomeLabel =
      dto.status === 'pending_decision'
        ? 'Meeting — Pending Decision (follow-ups resumed)'
        : 'Meeting — No Response (follow-ups resumed)';

    await this.databaseService.query(
      `INSERT INTO pcmazing_client_responses (prospect_id, user_id, response_type, notes, outcome)
       VALUES ($1, $2, 'other', $3, $4)`,
      [id, userId, dto.notes?.trim() || null, outcomeLabel],
    );

    await this.databaseService.query(
      `UPDATE pcmazing_client_prospects
       SET status = 'picked_up',
           follow_up_count = 0,
           updated_at = NOW()
       WHERE id = $1`,
      [id],
    );

    return this.getById(id, userId, effectiveRole);
  }

  private async recordFollowUp(
    id: number,
    dto: UpdateClientProspectStatusDto,
    userId: number,
    prospect: Awaited<ReturnType<typeof this.getProspectHeader>>,
    effectiveRole: string | undefined,
  ) {
    if (hasReachedFollowUpLimit(prospect.follow_up_count)) {
      throw new BadRequestException(
        `Maximum ${MAX_PROSPECT_FOLLOW_UPS} follow-ups reached. Mark as Loss or return to Available.`,
      );
    }

    if (!dto.followUpDate?.trim() || !dto.followUpMethod?.trim()) {
      throw new BadRequestException('Follow-up date and method are required.');
    }

    const nextFollowUpCount = prospect.follow_up_count + 1;
    const nextStatus = mapFollowUpMethodToProspectStatus(dto.followUpMethod);
    const methodLabel = followUpMethodLabel(dto.followUpMethod);

    await this.databaseService.query(
      `INSERT INTO pcmazing_client_responses (
        prospect_id, user_id, response_type, notes, outcome,
        follow_up_date, follow_up_method, remarks
      ) VALUES ($1, $2, 'follow_up', $3, $4, $5::date, $6, $7)`,
      [
        id,
        userId,
        dto.notes?.trim() || null,
        `Follow-up ${nextFollowUpCount}/${MAX_PROSPECT_FOLLOW_UPS} — ${methodLabel}`,
        dto.followUpDate,
        dto.followUpMethod,
        dto.remarks?.trim() || null,
      ],
    );

    await this.databaseService.query(
      `UPDATE pcmazing_client_prospects
       SET status = $1,
           follow_up_count = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [nextStatus, nextFollowUpCount, id],
    );

    return this.getById(id, userId, effectiveRole);
  }

  private async returnProspectToAvailable(
    id: number,
    dto: UpdateClientProspectStatusDto,
    userId: number,
    prospect: Awaited<ReturnType<typeof this.getProspectHeader>>,
    effectiveRole: string | undefined,
  ) {
    if (!hasReachedFollowUpLimit(prospect.follow_up_count)) {
      throw new BadRequestException(
        `Return to Available requires ${MAX_PROSPECT_FOLLOW_UPS} follow-ups first.`,
      );
    }

    const remarks = dto.notes?.trim();
    if (!remarks) {
      throw new BadRequestException('Remarks are required when returning a prospect to Available.');
    }

    const userNames = await this.loadUserNames([userId, prospect.picked_up_by, prospect.assigned_user_id]);
    const marketerName =
      userNames.get(prospect.picked_up_by ?? prospect.assigned_user_id ?? userId) ?? 'Previous marketer';
    const returnedAt = new Date().toISOString();
    const historyNote = `\n\n--- Returned to pool (${returnedAt}) ---\nPrevious attempt by ${marketerName} — no interest after ${MAX_PROSPECT_FOLLOW_UPS} follow-ups.\nRemarks: ${remarks}`;
    const updatedNotes = `${prospect.notes ?? ''}${historyNote}`.trim();

    await this.databaseService.query(
      `INSERT INTO pcmazing_client_responses (prospect_id, user_id, response_type, notes, outcome)
       VALUES ($1, $2, 'other', $3, $4)`,
      [
        id,
        userId,
        remarks,
        `Returned to Available (previous loss — ${marketerName})`,
      ],
    );

    await this.databaseService.query(
      `UPDATE pcmazing_client_prospects
       SET status = 'available',
           assigned_user_id = NULL,
           assigned_team_id = NULL,
           picked_up_by = NULL,
           picked_up_at = NULL,
           follow_up_count = 0,
           notes = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [updatedNotes, id],
    );

    return this.getById(id, userId, effectiveRole);
  }

  private async recordContractUnderReview(
    id: number,
    dto: UpdateClientProspectStatusDto,
    userId: number,
    effectiveRole: string | undefined,
  ) {
    const reviewNotes = [
      dto.contractReviewRemarks?.trim() || null,
      dto.responseDate ? `Expected response: ${dto.responseDate}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    await this.databaseService.withTransaction(async (client) => {
      await client.query(
        `INSERT INTO pcmazing_client_responses (
          prospect_id, user_id, response_type, notes, outcome, remarks, follow_up_date
        ) VALUES ($1, $2, 'other', $3, $4, $5, $6::date)`,
        [
          id,
          userId,
          reviewNotes || dto.notes?.trim() || null,
          'Contract Under Review',
          dto.contractReviewRemarks?.trim() || null,
          dto.responseDate ?? null,
        ],
      );

      await client.query(
        `UPDATE pcmazing_client_prospects
         SET status = 'contract_under_review',
             updated_at = NOW()
         WHERE id = $1`,
        [id],
      );
    });

    return this.getById(id, userId, effectiveRole);
  }

  private async recordContractSigned(
    id: number,
    dto: UpdateClientProspectStatusDto,
    userId: number,
    effectiveRole: string | undefined,
    prospect: { estimated_price_deal_php: string | null; proposed_price_deal: string | null },
  ) {
    if (!dto.contract) {
      throw new BadRequestException('Contract details are required when marking a prospect as contract signed.');
    }

    const contract = dto.contract;

    const proposedDeal =
      this.toNullableNumber(prospect.estimated_price_deal_php)
      ?? this.toNullableNumber(prospect.proposed_price_deal)
      ?? 0;
    const totalPayments = contract.paymentSchedule.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    if (proposedDeal > 0 && totalPayments > proposedDeal) {
      throw new BadRequestException('Total payments cannot exceed the proposed deal amount.');
    }

    await this.databaseService.withTransaction(async (client) => {
      await client.query(
        `INSERT INTO pcmazing_client_responses (prospect_id, user_id, response_type, notes, outcome, remarks)
         VALUES ($1, $2, 'other', $3, $4, $5)`,
        [
          id,
          userId,
          contract.remarks?.trim() || dto.notes?.trim() || null,
          'Contract Signed',
          contract.remarks?.trim() || null,
        ],
      );

      const contractResult = await client.query<{ id: number }>(
        `INSERT INTO pcmazing_client_contracts (
          prospect_id,
          system_name,
          system_type,
          signed_at,
          remarks,
          created_by_user_id,
          updated_by_user_id
        ) VALUES ($1, $2, $3, $4::date, $5, $6, $6)
        ON CONFLICT (prospect_id) DO UPDATE
        SET system_name = EXCLUDED.system_name,
            system_type = EXCLUDED.system_type,
            signed_at = EXCLUDED.signed_at,
            remarks = EXCLUDED.remarks,
            updated_by_user_id = EXCLUDED.updated_by_user_id,
            updated_at = NOW()
        RETURNING id`,
        [
          id,
          contract.projectName.trim(),
          contract.projectType.trim(),
          contract.signedAt ?? null,
          contract.remarks?.trim() || null,
          userId,
        ],
      );

      const contractId = contractResult.rows[0]?.id;
      if (!contractId) {
        throw new BadRequestException('Unable to save contract details.');
      }

      await client.query(`DELETE FROM pcmazing_client_contract_modules WHERE contract_id = $1`, [contractId]);
      await client.query(`DELETE FROM pcmazing_client_contract_milestones WHERE contract_id = $1`, [contractId]);
      await client.query(`DELETE FROM pcmazing_client_contract_payment_schedules WHERE contract_id = $1`, [contractId]);

      for (const [index, module] of contract.modules.entries()) {
        await client.query(
          `INSERT INTO pcmazing_client_contract_modules (
            contract_id, prospect_id, sort_order, module_name, description, features, process_flow
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            contractId,
            id,
            index,
            module.name.trim(),
            module.description?.trim() || null,
            module.features?.trim() || null,
            module.processFlow?.trim() || null,
          ],
        );
      }

      const milestoneIds: number[] = [];
      for (const [index, milestone] of contract.milestones.entries()) {
        const connectedModuleSortOrders = this.normalizeLinkedSortOrders(milestone.connectedModuleId);
        const milestoneResult = await client.query<{ id: number }>(
          `INSERT INTO pcmazing_client_contract_milestones (
            contract_id, prospect_id, sort_order, title, description, due_date, connected_module_sort_order
          ) VALUES ($1, $2, $3, $4, $5, $6::date, $7)
          RETURNING id`,
          [
            contractId,
            id,
            index,
            milestone.title.trim(),
            milestone.description?.trim() || null,
            milestone.dueDate ?? null,
            connectedModuleSortOrders,
          ],
        );
        milestoneIds.push(milestoneResult.rows[0]?.id ?? 0);
      }

      for (const [index, payment] of contract.paymentSchedule.entries()) {
        const connectedMilestoneSortOrder = this.parseLinkedSortOrder(payment.connectedMilestoneId);
        const milestoneId =
          connectedMilestoneSortOrder !== null ? milestoneIds[connectedMilestoneSortOrder] ?? null : null;

        await client.query(
          `INSERT INTO pcmazing_client_contract_payment_schedules (
            contract_id, prospect_id, sort_order, label, amount, description, due_date, notes, milestone_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8, $9)`,
          [
            contractId,
            id,
            index,
            payment.label.trim(),
            payment.amount,
            payment.description?.trim() || null,
            payment.dueDate ?? null,
            payment.notes?.trim() || null,
            milestoneId,
          ],
        );
      }

      await client.query(
        `UPDATE pcmazing_client_prospects
         SET status = 'contract_signed',
             updated_at = NOW()
         WHERE id = $1`,
        [id],
      );
    });

    return this.getById(id, userId, effectiveRole);
  }

  private parseLinkedSortOrder(value?: string | null): number | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    const first = String(value).split(',')[0]?.trim();
    const parsed = Number(first);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
  }

  private normalizeLinkedSortOrders(value?: string | null): string | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    const orders = String(value)
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part !== '')
      .map((part) => Number(part))
      .filter((part) => Number.isInteger(part) && part >= 0);

    if (!orders.length) {
      return null;
    }

    return [...new Set(orders)].join(',');
  }

  async addResponse(
    id: number,
    dto: CreateClientResponseDto,
    userId: number,
    userRole: string | undefined,
  ) {
    await this.ensureTables();
    const effectiveRole = await this.resolveUserRole(userId, userRole);
    await this.assertCanAccessProspect(id, userId, effectiveRole);

    await this.databaseService.query(
      `INSERT INTO pcmazing_client_responses (prospect_id, user_id, response_type, notes, outcome)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        id,
        userId,
        dto.responseType ?? 'call',
        dto.notes?.trim() || null,
        dto.outcome?.trim() || null,
      ],
    );

    await this.databaseService.query(
      `UPDATE pcmazing_client_prospects SET updated_at = NOW() WHERE id = $1`,
      [id],
    );

    return this.getById(id, userId, effectiveRole);
  }

  getImportTemplate(): string {
    return PROSPECT_IMPORT_TEMPLATE_CSV;
  }

  previewImportFromCsv(content: string): ProspectImportPreview {
    return buildProspectImportPreview(content);
  }

  async importFromCsv(content: string, userId: number) {
    await this.ensureTables();
    const { validRows } = parseProspectImportContent(content);
    if (validRows.length === 0) {
      throw new BadRequestException('No valid client rows found in the uploaded file.');
    }

    let imported = 0;
    for (const row of validRows) {
      const deal = await this.resolveDealPricing({
        clientType: row.clientType,
        currency: row.currency,
        proposedPriceDeal: row.proposedPriceDeal,
      });

      await this.databaseService.query(
        `INSERT INTO pcmazing_client_prospects (
          client_name, company, email, phone, address, notes, status, source, created_by_user_id,
          client_type, currency, proposed_price_deal, estimated_price_deal_php, exchange_rate_used, exchange_rate_date
        ) VALUES ($1, $2, $3, $4, $5, $6, 'available', 'import', $7, $8, $9, $10, $11, $12, $13)`,
        [
          row.clientName,
          row.company,
          row.email,
          row.phone,
          row.address,
          row.notes,
          userId,
          deal.clientType,
          deal.currency,
          deal.proposedPriceDeal,
          deal.estimatedPriceDealPhp,
          deal.exchangeRateUsed,
          deal.exchangeRateDate,
        ],
      );
      imported += 1;
    }

    return { imported, total: validRows.length };
  }

  async listAppointments(userId: number, userRole: string | undefined, start?: string, end?: string) {
    await this.ensureTables();
    const effectiveRole = await this.resolveUserRole(userId, userRole);
    const fullAccess = hasMarketingFullAccess(effectiveRole);
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (!fullAccess) {
      params.push(userId);
      conditions.push(`a.user_id = $${params.length}`);
    }

    if (start?.trim()) {
      params.push(start);
      conditions.push(`a.ends_at >= $${params.length}::timestamptz`);
    }

    if (end?.trim()) {
      params.push(end);
      conditions.push(`a.starts_at <= $${params.length}::timestamptz`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await this.databaseService.query<{
      id: number;
      prospect_id: number;
      user_id: number;
      client_name: string;
      title: string;
      starts_at: string;
      ends_at: string;
      meeting_type: string;
      location_or_link: string | null;
    }>(
      `SELECT
        a.id,
        a.prospect_id,
        a.user_id,
        p.client_name,
        a.title,
        a.starts_at::text,
        a.ends_at::text,
        a.meeting_type,
        a.location_or_link
       FROM pcmazing_client_appointments a
       JOIN pcmazing_client_prospects p ON p.id = a.prospect_id
       ${whereClause}
       ORDER BY a.starts_at ASC`,
      params,
    );

    return result.rows.map((row) => ({
      id: row.id,
      prospectId: row.prospect_id,
      userId: row.user_id,
      clientName: row.client_name,
      title: row.title,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      meetingType: row.meeting_type,
      locationOrLink: row.location_or_link,
    }));
  }

  async checkAppointmentConflict(userId: number, startsAt: string, endsAt: string, excludeId?: number) {
    await this.ensureTables();

    const params: unknown[] = [userId, startsAt, endsAt];
    let excludeClause = '';
    if (excludeId) {
      params.push(excludeId);
      excludeClause = `AND id <> $${params.length}`;
    }

    const result = await this.databaseService.query<{ id: number; title: string; starts_at: string; ends_at: string }>(
      `SELECT id, title, starts_at::text, ends_at::text
       FROM pcmazing_client_appointments
       WHERE user_id = $1
         AND starts_at < $3::timestamptz
         AND ends_at > $2::timestamptz
         ${excludeClause}
       ORDER BY starts_at ASC`,
      params,
    );

    return result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
    }));
  }

  async createAppointment(dto: CreateClientAppointmentDto, userId: number, userRole: string | undefined) {
    await this.ensureTables();
    const effectiveRole = await this.resolveUserRole(userId, userRole);
    await this.assertCanAccessProspect(dto.prospectId, userId, effectiveRole);

    if (new Date(dto.endsAt) <= new Date(dto.startsAt)) {
      throw new BadRequestException('Appointment end time must be after start time.');
    }

    const conflicts = await this.checkAppointmentConflict(userId, dto.startsAt, dto.endsAt);
    if (conflicts.length > 0) {
      throw new BadRequestException('This time slot conflicts with an existing appointment.');
    }

    await this.databaseService.query(
      `INSERT INTO pcmazing_client_appointments (
        prospect_id, user_id, title, starts_at, ends_at, meeting_type, location_or_link, notes
      ) VALUES ($1, $2, $3, $4::timestamptz, $5::timestamptz, $6, $7, $8)`,
      [
        dto.prospectId,
        userId,
        dto.title.trim(),
        dto.startsAt,
        dto.endsAt,
        dto.meetingType,
        dto.locationOrLink?.trim() || null,
        dto.notes?.trim() || null,
      ],
    );

    await this.databaseService.query(
      `UPDATE pcmazing_client_prospects
       SET status = 'meeting_set', updated_at = NOW()
       WHERE id = $1`,
      [dto.prospectId],
    );

    return this.getById(dto.prospectId, userId, effectiveRole);
  }

  private async assertCanAccessProspect(id: number, userId: number, userRole: string | undefined) {
    if (hasMarketingFullAccess(userRole)) {
      return;
    }

    const result = await this.databaseService.query<{
      assigned_user_id: number | null;
      picked_up_by: number | null;
      created_by_user_id: number | null;
    }>(
      `SELECT assigned_user_id, picked_up_by, created_by_user_id
       FROM pcmazing_client_prospects
       WHERE id = $1
       LIMIT 1`,
      [id],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException(`Prospect ${id} was not found.`);
    }

    if (
      !isSameUserId(row.assigned_user_id, userId)
      && !isSameUserId(row.picked_up_by, userId)
      && !isSameUserId(row.created_by_user_id, userId)
    ) {
      throw new ForbiddenException('You can only access prospects assigned to you.');
    }
  }

  private async resolveUserRole(userId: number, jwtRole?: string): Promise<string | undefined> {
    if (!userId) {
      return jwtRole;
    }

    if (await tableExists(this.databaseService, 'tblusers')) {
      const result = await this.databaseService.query<{ rolename: string | null }>(
        `SELECT COALESCE(to_jsonb(r)->>'roleName', to_jsonb(r)->>'rolename', 'staff') AS rolename
         FROM tblusers u
         LEFT JOIN tblrbac r ON r.id = u."roleId"
         WHERE u.id = $1
         LIMIT 1`,
        [userId],
      );

      const dbRole = result.rows[0]?.rolename?.trim();
      if (dbRole) {
        return dbRole;
      }
    }

    if (await tableExists(this.databaseService, 'pcmazing_admin_users')) {
      const result = await this.databaseService.query<{ role: string | null }>(
        `SELECT role FROM pcmazing_admin_users WHERE id = $1 LIMIT 1`,
        [userId],
      );

      const dbRole = result.rows[0]?.role?.trim();
      if (dbRole) {
        return dbRole;
      }
    }

    return jwtRole;
  }

  private async getProspectHeader(id: number) {
    const result = await this.databaseService.query<{
      id: number;
      client_name: string;
      company: string | null;
      email: string | null;
      phone: string | null;
      address: string | null;
      status: string;
      source: string;
      notes: string | null;
      assigned_user_id: number | null;
      assigned_team_id: number | null;
      picked_up_by: number | null;
      picked_up_at: string | null;
      created_by_user_id: number | null;
      follow_up_count: number;
      client_type: string;
      currency: string;
      proposed_price_deal: string | null;
      estimated_price_deal_php: string | null;
      exchange_rate_used: string | null;
      exchange_rate_date: string | null;
      commission_percent: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT
        id, client_name, company, email, phone, address, status, source, notes,
        assigned_user_id, assigned_team_id, picked_up_by, picked_up_at::text,
        created_by_user_id, COALESCE(follow_up_count, 0) AS follow_up_count,
        client_type, currency,
        proposed_price_deal::text,
        estimated_price_deal_php::text,
        exchange_rate_used::text,
        exchange_rate_date::text,
        commission_percent::text,
        created_at::text, updated_at::text
       FROM pcmazing_client_prospects
       WHERE id = $1
       LIMIT 1`,
      [id],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException(`Prospect ${id} was not found.`);
    }
    return row;
  }

  private async loadProspectContract(prospectId: number): Promise<ClientProspectDetail['contract']> {
    const contractResult = await this.databaseService.query<{
      id: number;
      system_name: string;
      system_type: string;
      signed_at: string | null;
      remarks: string | null;
    }>(
      `SELECT id, system_name, system_type, signed_at::text, remarks
       FROM pcmazing_client_contracts
       WHERE prospect_id = $1
       LIMIT 1`,
      [prospectId],
    );

    const contractRow = contractResult.rows[0];
    if (!contractRow) {
      return null;
    }

    const [modulesResult, milestonesResult, paymentScheduleResult] = await Promise.all([
      this.databaseService.query<{
        id: number;
        module_name: string;
        description: string | null;
        features: string | null;
        process_flow: string | null;
      }>(
        `SELECT id, module_name, description, features, process_flow
         FROM pcmazing_client_contract_modules
         WHERE contract_id = $1
         ORDER BY sort_order ASC, id ASC`,
        [contractRow.id],
      ),
      this.databaseService.query<{
        id: number;
        title: string;
        description: string | null;
        due_date: string | null;
        connected_module_sort_order: string | number | null;
        sort_order: number;
      }>(
        `SELECT id, title, description, due_date::text, connected_module_sort_order, sort_order
         FROM pcmazing_client_contract_milestones
         WHERE contract_id = $1
         ORDER BY sort_order ASC, id ASC`,
        [contractRow.id],
      ),
      this.databaseService.query<{
        id: number;
        label: string;
        amount: string;
        description: string | null;
        due_date: string | null;
        notes: string | null;
        milestone_id: number | null;
      }>(
        `SELECT id, label, amount::text, description, due_date::text, notes, milestone_id
         FROM pcmazing_client_contract_payment_schedules
         WHERE contract_id = $1
         ORDER BY sort_order ASC, id ASC`,
        [contractRow.id],
      ),
    ]);

    const milestoneSortOrderById = new Map<number, number>();
    milestonesResult.rows.forEach((row) => {
      milestoneSortOrderById.set(row.id, row.sort_order);
    });

    return {
      id: contractRow.id,
      projectName: contractRow.system_name,
      projectType: contractRow.system_type,
      signedAt: contractRow.signed_at,
      remarks: contractRow.remarks,
      modules: modulesResult.rows.map((row) => ({
        id: row.id,
        name: row.module_name,
        description: row.description,
        features: row.features,
        processFlow: row.process_flow,
      })),
      milestones: milestonesResult.rows.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        dueDate: row.due_date,
        connectedModuleId:
          row.connected_module_sort_order !== null && row.connected_module_sort_order !== undefined
            ? String(row.connected_module_sort_order)
            : null,
      })),
      paymentSchedule: paymentScheduleResult.rows.map((row) => ({
        id: row.id,
        label: row.label,
        amount: Number(row.amount),
        description: row.description,
        dueDate: row.due_date,
        notes: row.notes,
        connectedMilestoneId:
          row.milestone_id != null && milestoneSortOrderById.has(row.milestone_id)
            ? String(milestoneSortOrderById.get(row.milestone_id))
            : null,
      })),
    };
  }

  private mapStatusToResponseType(status: string): string {
    if (status === 'follow_up') return 'follow_up';
    if (status === 'emailed') return 'email';
    if (status === 'texted') return 'sms';
    if (status === 'meeting_set' || status === 'met') return 'meeting';
    if (status === 'called' || status === 'no_response') return 'call';
    if (status === 'closed_won' || status === 'contract_signed' || status === 'closed_lost') return 'other';
    return 'other';
  }

  private mapStatusToOutcomeLabel(status: string): string {
    const labels: Record<string, string> = {
      called: 'Called',
      texted: 'Texted',
      no_response: 'No Response',
      emailed: 'Emailed',
      met: 'Met',
      follow_up: 'Follow-up',
      meeting_set: 'Meeting Scheduled',
      closed_won: 'Win',
      contract_signed: 'Contract Signed',
      closed_lost: 'Loss',
      return_to_available: 'Returned to Available',
    };
    return labels[status] ?? status;
  }

  private mapListItem(
    row: {
      id: number;
      client_name: string;
      company: string | null;
      email: string | null;
      phone: string | null;
      address?: string | null;
      status: string;
      source: string;
      assigned_user_id: number | null;
      picked_up_by: number | null;
      picked_up_at: string | null;
      follow_up_count: number;
      client_type: string;
      currency: string;
      proposed_price_deal: string | null;
      estimated_price_deal_php: string | null;
      exchange_rate_used?: string | null;
      exchange_rate_date?: string | null;
      created_at: string;
      updated_at: string;
    },
    userNames: Map<number, string>,
  ): ClientProspectListItem {
    return {
      id: row.id,
      clientName: row.client_name,
      company: row.company,
      email: row.email,
      phone: row.phone,
      address: row.address ?? null,
      status: row.status,
      source: row.source,
      assignedUserId: row.assigned_user_id,
      assignedUserName: row.assigned_user_id ? userNames.get(row.assigned_user_id) ?? null : null,
      pickedUpBy: row.picked_up_by,
      pickedUpByName: row.picked_up_by ? userNames.get(row.picked_up_by) ?? null : null,
      pickedUpAt: row.picked_up_at,
      responseCount: 0,
      latestResponseAt: null,
      hasAppointment: false,
      followUpCount: Number(row.follow_up_count ?? 0),
      maxFollowUps: MAX_PROSPECT_FOLLOW_UPS,
      ...this.mapDealFields(row),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private async loadUserNames(userIds: Array<number | null>): Promise<Map<number, string>> {
    const uniqueIds = [...new Set(userIds.filter((id): id is number => Number.isFinite(id)))];
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
