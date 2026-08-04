import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import { AdminJwtPayload, JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../rbac/roles.guard';
import { CreateProjectDto, ProjectUserRefDto } from './dto/create-project.dto';
import {
  CreateProjectTaskDto,
  MoveProjectEpicDto,
  MoveProjectTaskDto,
  SetCurrentPhaseDto,
  UpdateProjectTaskDto,
} from './dto/project-task.dto';
import { CreateProjectTaskCommentDto } from './dto/task-activity.dto';
import { ProjectActor, ProjectsService } from './projects.service';

@Controller('admin/projects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  private actorFrom(req: Request & { user?: AdminJwtPayload }): ProjectActor | null {
    const userId = Number(req.user?.sub);
    if (!Number.isFinite(userId) || userId <= 0 || !req.user?.source) {
      return null;
    }
    return {
      userId,
      source: req.user.source,
      role: req.user.role,
    };
  }

  @Get()
  list(@Req() req: Request & { user?: AdminJwtPayload }) {
    return this.projectsService.list(this.actorFrom(req)).then((data) => ({
      success: true,
      data,
    }));
  }

  @Get('assignees')
  assignees(@Query('role') role?: string) {
    return this.projectsService.listAssignees(role).then((data) => ({
      success: true,
      data,
    }));
  }

  @Get('by-prospect/:prospectId')
  byProspect(@Param('prospectId', ParseIntPipe) prospectId: number) {
    return this.projectsService.getByProspectId(prospectId).then((data) => ({
      success: true,
      data,
    }));
  }

  @Get(':id/tasks')
  async listTasks(
    @Param('id', ParseIntPipe) id: number,
    @Query('phaseId') phaseId: string | undefined,
    @Req() req: Request & { user?: AdminJwtPayload },
  ) {
    await this.projectsService.assertCanAccessProject(id, this.actorFrom(req));
    const parsedPhaseId = phaseId ? Number(phaseId) : undefined;
    return this.projectsService
      .listTasks(id, Number.isFinite(parsedPhaseId) ? parsedPhaseId : undefined)
      .then((data) => ({
        success: true,
        data,
      }));
  }

  @Patch(':id/current-phase')
  async setCurrentPhase(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetCurrentPhaseDto,
    @Req() req: Request & { user?: AdminJwtPayload },
  ) {
    await this.projectsService.assertCanAccessProject(id, this.actorFrom(req));
    return this.projectsService.setCurrentPhase(id, dto).then((data) => ({
      success: true,
      message: 'Current phase updated.',
      data,
    }));
  }

  @Patch(':id/epics/:epicId/move')
  async moveEpic(
    @Param('id', ParseIntPipe) id: number,
    @Param('epicId', ParseIntPipe) epicId: number,
    @Body() dto: MoveProjectEpicDto,
    @Req() req: Request & { user?: AdminJwtPayload },
  ) {
    await this.projectsService.assertCanAccessProject(id, this.actorFrom(req));
    return this.projectsService.moveEpic(id, epicId, dto).then((data) => ({
      success: true,
      message: 'Epic moved.',
      data,
    }));
  }

  @Post(':id/tasks')
  async createTask(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateProjectTaskDto,
    @Req() req: Request & { user?: AdminJwtPayload },
  ) {
    await this.projectsService.assertCanAccessProject(id, this.actorFrom(req));
    const userId = Number(req.user?.sub);
    return this.projectsService.createTask(id, dto, userId).then((data) => ({
      success: true,
      message: 'Task created.',
      data,
    }));
  }

  @Get(':id/tasks/:taskId')
  async getTaskDetail(
    @Param('id', ParseIntPipe) id: number,
    @Param('taskId', ParseIntPipe) taskId: number,
    @Req() req: Request & { user?: AdminJwtPayload },
  ) {
    await this.projectsService.assertCanAccessProject(id, this.actorFrom(req));
    return this.projectsService.getTaskDetail(id, taskId).then((data) => ({
      success: true,
      data,
    }));
  }

  @Patch(':id/tasks/:taskId')
  async updateTask(
    @Param('id', ParseIntPipe) id: number,
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() dto: UpdateProjectTaskDto,
    @Req() req: Request & { user?: AdminJwtPayload },
  ) {
    await this.projectsService.assertCanAccessProject(id, this.actorFrom(req));
    return this.projectsService.updateTask(id, taskId, dto).then((data) => ({
      success: true,
      message: 'Task updated.',
      data,
    }));
  }

  @Patch(':id/tasks/:taskId/move')
  async moveTask(
    @Param('id', ParseIntPipe) id: number,
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() dto: MoveProjectTaskDto,
    @Req() req: Request & { user?: AdminJwtPayload },
  ) {
    await this.projectsService.assertCanAccessProject(id, this.actorFrom(req));
    return this.projectsService.moveTask(id, taskId, dto).then((data) => ({
      success: true,
      message: 'Task moved.',
      data,
    }));
  }

  @Post(':id/tasks/:taskId/comments')
  async addTaskComment(
    @Param('id', ParseIntPipe) id: number,
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() dto: CreateProjectTaskCommentDto,
    @Req() req: Request & { user?: AdminJwtPayload },
  ) {
    await this.projectsService.assertCanAccessProject(id, this.actorFrom(req));
    const userId = Number(req.user?.sub);
    return this.projectsService
      .addTaskComment(id, taskId, dto.body, userId)
      .then((data) => ({
        success: true,
        message: 'Comment added.',
        data,
      }));
  }

  @Post(':id/tasks/:taskId/attachments')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async uploadTaskAttachment(
    @Param('id', ParseIntPipe) id: number,
    @Param('taskId', ParseIntPipe) taskId: number,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request & { user?: AdminJwtPayload },
  ) {
    await this.projectsService.assertCanAccessProject(id, this.actorFrom(req));
    const userId = Number(req.user?.sub);
    return this.projectsService
      .uploadTaskAttachment(id, taskId, file, userId)
      .then((data) => ({
        success: true,
        message: 'Attachment uploaded.',
        data,
      }));
  }

  @Delete(':id/tasks/:taskId/attachments/:attachmentId')
  async deleteTaskAttachment(
    @Param('id', ParseIntPipe) id: number,
    @Param('taskId', ParseIntPipe) taskId: number,
    @Param('attachmentId', ParseIntPipe) attachmentId: number,
    @Req() req: Request & { user?: AdminJwtPayload },
  ) {
    await this.projectsService.assertCanAccessProject(id, this.actorFrom(req));
    return this.projectsService.deleteTaskAttachment(id, taskId, attachmentId).then(() => ({
      success: true,
      message: 'Attachment deleted.',
    }));
  }

  @Delete(':id/tasks/:taskId')
  async deleteTask(
    @Param('id', ParseIntPipe) id: number,
    @Param('taskId', ParseIntPipe) taskId: number,
    @Req() req: Request & { user?: AdminJwtPayload },
  ) {
    await this.projectsService.assertCanAccessProject(id, this.actorFrom(req));
    return this.projectsService.deleteTask(id, taskId).then(() => ({
      success: true,
      message: 'Task deleted.',
    }));
  }

  @Get(':id')
  async getById(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { user?: AdminJwtPayload },
  ) {
    await this.projectsService.assertCanAccessProject(id, this.actorFrom(req));
    return this.projectsService.getById(id).then((data) => ({
      success: true,
      data,
    }));
  }

  @Post()
  create(@Body() dto: CreateProjectDto, @Req() req: Request & { user?: AdminJwtPayload }) {
    const userId = Number(req.user?.sub);
    return this.projectsService.create(dto, userId).then((data) => ({
      success: true,
      message: 'Project created.',
      data,
    }));
  }

  @Patch(':id/assignments')
  async updateAssignments(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { projectManager: ProjectUserRefDto; teamMembers: ProjectUserRefDto[] },
    @Req() req: Request & { user?: AdminJwtPayload },
  ) {
    await this.projectsService.assertCanAccessProject(id, this.actorFrom(req));
    return this.projectsService.updateAssignments(id, dto).then((data) => ({
      success: true,
      message: 'Project assignments updated.',
      data,
    }));
  }
}
