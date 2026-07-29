import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';
import { CompleteContractSigningDto, ProspectContractDto } from '../admin/marketing/dto/prospect-contract.dto';
import {
  assertDealContractReadyForSigning,
  buildMilestoneCode,
  buildModuleCode,
  buildPaymentCode,
} from '../admin/marketing/deal-contract-validation.util';

const SIGNING_TOKEN_BYTES = 32;
const SIGNING_EXPIRY_DAYS = 14;

@Injectable()
export class ContractSigningService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getSigningDetails(token: string) {
    const result = await this.databaseService.query<{
      prospect_id: number;
      client_name: string;
      company: string | null;
      contract_id: number;
      system_name: string;
      system_type: string;
      signing_status: string;
      signature_verified_at: string | null;
      expires_at: string;
      prospect_status: string;
    }>(
      `SELECT
        s.prospect_id,
        p.client_name,
        p.company,
        s.contract_id,
        ds.system_name,
        ds.system_type,
        c.signing_status,
        s.signature_verified_at::text,
        s.expires_at::text,
        p.status AS prospect_status
       FROM pcmazing_deal_contract_signing s
       JOIN pcmazing_client_prospects p ON p.id = s.prospect_id
       JOIN pcmazing_client_contracts c ON c.id = s.contract_id
       LEFT JOIN pcmazing_deal_systems ds ON ds.prospect_id = s.prospect_id
       WHERE s.signing_token = $1
       LIMIT 1`,
      [token],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException('Contract signing link was not found.');
    }

    if (row.prospect_status === 'contract_signed' || row.signature_verified_at) {
      return {
        alreadySigned: true,
        clientName: row.client_name,
        company: row.company,
        systemName: row.system_name,
        systemType: row.system_type,
        signedAt: row.signature_verified_at,
      };
    }

    if (new Date(row.expires_at).getTime() < Date.now()) {
      throw new BadRequestException('This contract signing link has expired.');
    }

    const contract = await this.loadPublicContract(row.contract_id);
    return {
      alreadySigned: false,
      clientName: row.client_name,
      company: row.company,
      contract,
      expiresAt: row.expires_at,
    };
  }

  async completeSigning(token: string, dto: CompleteContractSigningDto, signatureIp?: string) {
    if (!dto.signerName.trim()) {
      throw new BadRequestException('Signer name is required.');
    }
    if (!dto.signerEmail.trim()) {
      throw new BadRequestException('Signer email is required.');
    }
    if (!dto.acceptanceStatement.trim()) {
      throw new BadRequestException('Acceptance statement is required.');
    }

    return this.databaseService.withTransaction(async (client) => {
      const signingResult = await client.query<{
        id: number;
        prospect_id: number;
        contract_id: number;
        signature_verified_at: string | null;
        expires_at: string;
        prospect_status: string;
      }>(
        `SELECT
          s.id,
          s.prospect_id,
          s.contract_id,
          s.signature_verified_at::text,
          s.expires_at::text,
          p.status AS prospect_status
         FROM pcmazing_deal_contract_signing s
         JOIN pcmazing_client_prospects p ON p.id = s.prospect_id
         WHERE s.signing_token = $1
         FOR UPDATE`,
        [token],
      );

      const signing = signingResult.rows[0];
      if (!signing) {
        throw new NotFoundException('Contract signing link was not found.');
      }

      if (signing.prospect_status === 'contract_signed' || signing.signature_verified_at) {
        throw new BadRequestException('This contract has already been signed.');
      }

      if (new Date(signing.expires_at).getTime() < Date.now()) {
        throw new BadRequestException('This contract signing link has expired.');
      }

      if (signing.prospect_status !== 'closed_won') {
        throw new BadRequestException('This deal is not awaiting client contract signature.');
      }

      await this.assertContractReadyForSigning(client, signing.contract_id);

      const signedAt = new Date().toISOString();

      await client.query(
        `UPDATE pcmazing_deal_contract_signing
         SET client_signer_name = $1,
             client_signer_email = $2,
             signature_verified_at = NOW(),
             signature_ip = $3
         WHERE id = $4`,
        [dto.signerName.trim(), dto.signerEmail.trim(), signatureIp ?? null, signing.id],
      );

      await client.query(
        `UPDATE pcmazing_client_contracts
         SET signed_at = CURRENT_DATE,
             signing_status = 'signed',
             updated_at = NOW()
         WHERE id = $1`,
        [signing.contract_id],
      );

      await client.query(
        `INSERT INTO pcmazing_client_responses (prospect_id, user_id, response_type, notes, outcome)
         VALUES ($1, NULL, 'other', $2, $3)`,
        [
          signing.prospect_id,
          `Client signature verified (${dto.signerName.trim()}, ${dto.signerEmail.trim()}). ${dto.acceptanceStatement.trim()}`,
          'Contract Signed — client signature verified',
        ],
      );

      await client.query(
        `INSERT INTO pcmazing_deal_status_audit_log (
          prospect_id, previous_status, new_status, changed_by_user_id, changed_by_process, notes
        ) VALUES ($1, $2, $3, NULL, $4, $5)`,
        [
          signing.prospect_id,
          'closed_won',
          'contract_signed',
          'client_signing',
          `Signature verified for ${dto.signerName.trim()} (${dto.signerEmail.trim()}).`,
        ],
      );

      await client.query(
        `UPDATE pcmazing_client_prospects
         SET status = 'contract_signed',
             updated_at = NOW()
         WHERE id = $1`,
        [signing.prospect_id],
      );

      return {
        prospectId: signing.prospect_id,
        signedAt,
        signerName: dto.signerName.trim(),
        signerEmail: dto.signerEmail.trim(),
      };
    });
  }

  generateSigningToken(): string {
    return randomBytes(SIGNING_TOKEN_BYTES).toString('hex');
  }

  signingExpiryDate(): Date {
    const expires = new Date();
    expires.setDate(expires.getDate() + SIGNING_EXPIRY_DAYS);
    return expires;
  }

  async saveContractDraft(
    client: PoolClient,
    prospectId: number,
    contract: ProspectContractDto,
    userId: number,
    signingStatus: 'draft' | 'pending_signature',
  ): Promise<{ contractId: number; signingToken: string; signingUrlPath: string; expiresAt: string }> {
    assertDealContractReadyForSigning(contract);

    const contractResult = await client.query<{ id: number }>(
      `INSERT INTO pcmazing_client_contracts (
        prospect_id,
        system_name,
        system_type,
        signed_at,
        signing_status,
        created_by_user_id,
        updated_by_user_id
      ) VALUES ($1, $2, $3, NULL, $4, $5, $5)
      ON CONFLICT (prospect_id) DO UPDATE
      SET system_name = EXCLUDED.system_name,
          system_type = EXCLUDED.system_type,
          signing_status = EXCLUDED.signing_status,
          updated_by_user_id = EXCLUDED.updated_by_user_id,
          updated_at = NOW()
      RETURNING id`,
      [
        prospectId,
        contract.systemName.trim(),
        contract.systemType.trim(),
        signingStatus,
        userId,
      ],
    );

    const contractId = contractResult.rows[0]?.id;
    if (!contractId) {
      throw new BadRequestException('Unable to save contract details.');
    }

    await client.query(
      `INSERT INTO pcmazing_deal_systems (prospect_id, system_name, system_type)
       VALUES ($1, $2, $3)
       ON CONFLICT (prospect_id) DO UPDATE
       SET system_name = EXCLUDED.system_name,
           system_type = EXCLUDED.system_type,
           updated_at = NOW()`,
      [prospectId, contract.systemName.trim(), contract.systemType.trim()],
    );

    await client.query(`DELETE FROM pcmazing_client_contract_modules WHERE contract_id = $1`, [contractId]);
    await client.query(`DELETE FROM pcmazing_client_contract_milestones WHERE contract_id = $1`, [contractId]);
    await client.query(`DELETE FROM pcmazing_client_contract_payment_schedules WHERE contract_id = $1`, [contractId]);

    const milestoneDbIds: number[] = [];

    for (const [index, module] of contract.modules.entries()) {
      await client.query(
        `INSERT INTO pcmazing_client_contract_modules (
          contract_id, prospect_id, sort_order, module_code, module_name, description,
          scope_of_work, delivery_timeline, responsible_team, quantity, amount
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          contractId,
          prospectId,
          index,
          buildModuleCode(index, module.moduleId),
          module.name.trim(),
          module.description?.trim() || null,
          module.scopeOfWork.trim(),
          module.deliveryTimeline.trim(),
          module.responsibleTeam.trim(),
          module.quantity ?? null,
          module.amount ?? null,
        ],
      );
    }

    for (const [index, milestone] of contract.milestones.entries()) {
      const milestoneResult = await client.query<{ id: number }>(
        `INSERT INTO pcmazing_client_contract_milestones (
          contract_id, prospect_id, sort_order, milestone_code, title, description,
          due_date, dependencies, success_criteria
        ) VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8, $9)
        RETURNING id`,
        [
          contractId,
          prospectId,
          index,
          buildMilestoneCode(index, milestone.milestoneId),
          milestone.title.trim(),
          milestone.description?.trim() || null,
          milestone.dueDate,
          milestone.dependencies?.trim() || null,
          milestone.successCriteria.trim(),
        ],
      );
      milestoneDbIds.push(milestoneResult.rows[0]?.id ?? 0);
    }

    for (const [index, payment] of contract.paymentSchedule.entries()) {
      const milestoneId =
        payment.associatedMilestoneIndex !== undefined
          ? milestoneDbIds[payment.associatedMilestoneIndex] ?? null
          : null;

      await client.query(
        `INSERT INTO pcmazing_client_contract_payment_schedules (
          contract_id, prospect_id, sort_order, payment_code, milestone_id, label,
          amount, due_date, payment_method, status, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::date, $9, $10, $11)`,
        [
          contractId,
          prospectId,
          index,
          buildPaymentCode(index, payment.paymentId),
          milestoneId,
          payment.label.trim(),
          payment.amount,
          payment.dueDate,
          payment.paymentMethod.trim(),
          payment.status,
          payment.notes?.trim() || null,
        ],
      );
    }

    const signingToken = this.generateSigningToken();
    const expiresAt = this.signingExpiryDate();

    await client.query(
      `INSERT INTO pcmazing_deal_contract_signing (
        prospect_id, contract_id, signing_token, expires_at, created_by_user_id
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (prospect_id) DO UPDATE
      SET contract_id = EXCLUDED.contract_id,
          signing_token = EXCLUDED.signing_token,
          expires_at = EXCLUDED.expires_at,
          client_signer_name = NULL,
          client_signer_email = NULL,
          signature_verified_at = NULL,
          signature_ip = NULL,
          created_by_user_id = EXCLUDED.created_by_user_id`,
      [prospectId, contractId, signingToken, expiresAt.toISOString(), userId],
    );

    return {
      contractId,
      signingToken,
      signingUrlPath: `/contracts/sign/${signingToken}`,
      expiresAt: expiresAt.toISOString(),
    };
  }

  private async assertContractReadyForSigning(client: PoolClient, contractId: number): Promise<void> {
    const [systemResult, modulesResult, milestonesResult, paymentsResult] = await Promise.all([
      client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM pcmazing_deal_systems ds
         JOIN pcmazing_client_contracts c ON c.prospect_id = ds.prospect_id
         WHERE c.id = $1
           AND ds.system_name <> ''
           AND ds.system_type <> ''`,
        [contractId],
      ),
      client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM pcmazing_client_contract_modules
         WHERE contract_id = $1
           AND module_name <> ''
           AND scope_of_work IS NOT NULL
           AND scope_of_work <> ''
           AND delivery_timeline IS NOT NULL
           AND delivery_timeline <> ''
           AND responsible_team IS NOT NULL
           AND responsible_team <> ''`,
        [contractId],
      ),
      client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM pcmazing_client_contract_milestones
         WHERE contract_id = $1
           AND title <> ''
           AND due_date IS NOT NULL
           AND success_criteria IS NOT NULL
           AND success_criteria <> ''`,
        [contractId],
      ),
      client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM pcmazing_client_contract_payment_schedules
         WHERE contract_id = $1
           AND label <> ''
           AND amount IS NOT NULL
           AND due_date IS NOT NULL
           AND payment_method IS NOT NULL
           AND payment_method <> ''
           AND status IS NOT NULL`,
        [contractId],
      ),
    ]);

    if (
      Number(systemResult.rows[0]?.count ?? 0) < 1
      || Number(modulesResult.rows[0]?.count ?? 0) < 1
      || Number(milestonesResult.rows[0]?.count ?? 0) < 1
      || Number(paymentsResult.rows[0]?.count ?? 0) < 1
    ) {
      throw new BadRequestException(
        'Contract is incomplete. Populate system, modules, milestones, and payment schedule before signing.',
      );
    }
  }

  private async loadPublicContract(contractId: number) {
    const contractResult = await this.databaseService.query<{
      system_name: string;
      system_type: string;
    }>(
      `SELECT ds.system_name, ds.system_type
       FROM pcmazing_client_contracts c
       JOIN pcmazing_deal_systems ds ON ds.prospect_id = c.prospect_id
       WHERE c.id = $1
       LIMIT 1`,
      [contractId],
    );

    const header = contractResult.rows[0];
    if (!header) {
      throw new NotFoundException('Contract was not found.');
    }

    const [modules, milestones, payments] = await Promise.all([
      this.databaseService.query(
        `SELECT module_code, module_name, description, scope_of_work, delivery_timeline, responsible_team
         FROM pcmazing_client_contract_modules
         WHERE contract_id = $1
         ORDER BY sort_order ASC, id ASC`,
        [contractId],
      ),
      this.databaseService.query(
        `SELECT milestone_code, title, description, due_date, dependencies, success_criteria
         FROM pcmazing_client_contract_milestones
         WHERE contract_id = $1
         ORDER BY sort_order ASC, id ASC`,
        [contractId],
      ),
      this.databaseService.query(
        `SELECT payment_code, label, amount, due_date, payment_method, status, notes
         FROM pcmazing_client_contract_payment_schedules
         WHERE contract_id = $1
         ORDER BY sort_order ASC, id ASC`,
        [contractId],
      ),
    ]);

    return {
      systemName: header.system_name,
      systemType: header.system_type,
      modules: modules.rows,
      milestones: milestones.rows,
      paymentSchedule: payments.rows,
    };
  }
}
