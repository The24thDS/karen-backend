import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';

import { CreateModelDto } from './dto/create-model.dto';
import { UpdateModelDto } from './dto/update-model.dto';
import { ModelsService } from './models.service';
import { SearchModelDto } from './dto/search-model-dto';

@Controller('models')
export class ModelsController {
  constructor(private readonly modelsService: ModelsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Request() req: any, @Body() createModelDto: CreateModelDto) {
    return this.modelsService.create(req.user, createModelDto);
  }

  @Get()
  async findAll() {
    const models = await this.modelsService.findAllWithUsername();
    return models;
  }

  @Post('/search')
  async findFromSearch(@Body() searchModelsDto: SearchModelDto) {
    const models = await this.modelsService.findBySearchTerm(
      searchModelsDto.searchString,
    );
    return models;
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    this.modelsService.incrementViews(slug);
    return this.modelsService.findOneWithUserAndTags(slug);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':slug')
  update(
    @Request() req,
    @Param('slug') slug: string,
    @Body() updateModelDto: UpdateModelDto,
  ) {
    return this.modelsService.update(slug, updateModelDto, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.modelsService.remove(id);
  }
}
