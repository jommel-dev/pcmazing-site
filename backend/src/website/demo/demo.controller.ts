import { Body, Controller, Post } from '@nestjs/common';
import { CreateDemoDto } from './dto/create-demo.dto';
import { DemoService } from './demo.service';

@Controller('demo')
export class DemoController {
  constructor(private readonly demoService: DemoService) {}

  @Post()
  create(@Body() dto: CreateDemoDto) {
    return this.demoService.create(dto);
  }
}
