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
} from '@nestjs/common';

import { CreateModelDto } from './dto/create-model.dto';
import { UpdateModelDto } from './dto/update-model.dto';
import { ModelsService } from './models.service';
import { SearchModelDto } from './dto/search-model-dto';
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

  @UseGuards(OptionalAuthGuard)
  @Get(':slug')
  findOne(@Request() req, @Param('slug') slug: string) {
    this.modelsService.incrementViews(slug);
    return this.modelsService.findOneWithUser(slug, req.user?.id);
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
