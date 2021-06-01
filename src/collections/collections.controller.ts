import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { OptionalAuthGuard } from 'src/auth/optional-auth.guard';
import { CollectionsService } from './collections.service';
import { StoreCollectionDTO } from './dto/store-collection.dto';
import { UpdateCollectionDTO } from './dto/update-collection.dto';

@Controller('collections')
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Get()
  getAll() {
    return this.collectionsService.findAll();
  }

  @UseGuards(OptionalAuthGuard)
  @Get('user/:username')
  getAllForUser(@Req() req, @Param('username') username: string) {
    return this.collectionsService.findAllForUser(req.user, username);
  }

  @UseGuards(OptionalAuthGuard)
  @Get('model/:slug')
  getAllForModel(@Req() req, @Param('slug') slug: string) {
    return this.collectionsService.findAllForModel(req.user, slug);
  }

  @UseGuards(OptionalAuthGuard)
  @Get('model/:slug/user/:username')
  getAllForModelForUser(
    @Req() req,
    @Param('slug') slug: string,
    @Param('username') username: string,
  ) {
    return this.collectionsService.findAllForModelForUser(
      req.user,
      slug,
      username,
    );
  }

  @UseGuards(OptionalAuthGuard)
  @Get(':slug')
  getOne(@Req() req, @Param('slug') slug: string) {
    return this.collectionsService.findOne(req.user, slug);
  }

  @UseGuards(OptionalAuthGuard)
  @Get(':slug/models')
  getOneWithModels(@Req() req, @Param('slug') slug: string) {
    return this.collectionsService.findOneWithAuthorAndModels(req.user, slug);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  store(@Req() req, @Body() body: StoreCollectionDTO) {
    return this.collectionsService.store(req.user, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':slug')
  update(@Param('slug') slug: string, @Body() body: UpdateCollectionDTO) {
    return this.collectionsService.update(slug, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':slug')
  remove(@Param('slug') slug: string) {
    return this.collectionsService.remove(slug);
  }
}
