import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
  Query,
} from '@nestjs/common';

import { CreateModelDto } from './dto/create-model.dto';
import { UpdateModelDto } from './dto/update-model.dto';
import { ModelsService } from './models.service';
import { VoteModelDto } from './dto/vote-model.dto';
import { OptionalAuthGuard } from 'src/auth/optional-auth.guard';

@Controller('models')
export class ModelsController {
  constructor(private readonly modelsService: ModelsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Request() req: any, @Body() createModelDto: CreateModelDto) {
    return this.modelsService.create(req.user, createModelDto);
  }

  @Get()
  async findAll(@Query() query) {
    const models = await this.modelsService.findAllWithUsername(query);
    return models;
  }

  @UseGuards(OptionalAuthGuard)
  @Get('user/:username')
  getAllForUser(@Query() query, @Param('username') username: string) {
    return this.modelsService.findAllForUser(query, username);
  }

  @Get('search')
  async findFromSearch(@Query() query) {
    const models = await this.modelsService.findBySearchTerm(query);
    return models;
  }

  @Get('formats')
  findAvailableFormats() {
    return this.modelsService.getAvailableFormats();
  }

  @UseGuards(OptionalAuthGuard)
  @Get(':slug')
  findOne(@Request() req, @Param('slug') slug: string) {
    this.modelsService.incrementViews(slug);
    return this.modelsService.findOneWithUser(slug, req.user?.id);
  }

  @Get(':slug/recommended')
  async findRecommendations(@Param('slug') slug: string) {
    return this.modelsService.findRecommendedModels(slug);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':slug/vote')
  vote(
    @Request() req,
    @Param('slug') slug: string,
    @Body() voteModelDto: VoteModelDto,
  ) {
    if (voteModelDto.voteType === 'up') {
      return this.modelsService.upvote(slug, req.user.id);
    } else if (voteModelDto.voteType === 'down') {
      return this.modelsService.downvote(slug, req.user.id);
    } else {
      throw new BadRequestException('Vote type incorrect');
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post(':modelSlug/collections/:collectionSlug')
  addToCollection(
    @Param('modelSlug') modelSlug: string,
    @Param('collectionSlug') collectionSlug: string,
  ) {
    return this.modelsService.addToCollection(modelSlug, collectionSlug);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':modelSlug/collections/:collectionSlug')
  removeFromCollection(
    @Param('modelSlug') modelSlug: string,
    @Param('collectionSlug') collectionSlug: string,
  ) {
    return this.modelsService.removeFromCollection(modelSlug, collectionSlug);
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
  @Delete(':slug')
  remove(@Param('slug') slug: string) {
    return this.modelsService.remove(slug);
  }
}
