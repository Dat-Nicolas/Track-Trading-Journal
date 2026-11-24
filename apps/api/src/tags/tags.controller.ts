import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import {
  CreateTagInput,
  CreateTagSchema,
  UpdateTagInput,
  UpdateTagSchema,
} from '@trackdailytrade/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { TagsService } from './tags.service';

@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  findAll() {
    return this.tagsService.findAll();
  }

  @Post()
  create(@Body(new ZodValidationPipe(CreateTagSchema)) body: CreateTagInput) {
    return this.tagsService.create(body);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateTagSchema)) body: UpdateTagInput,
  ) {
    return this.tagsService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tagsService.remove(id);
  }
}
