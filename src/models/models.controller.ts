import Model from 'src/types/model';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { multerOptions } from 'src/utils/multer-options';

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Request,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';

import { CreateModelDto } from './dto/create-model.dto';
import { UpdateModelDto } from './dto/update-model.dto';
import { ModelsService } from './models.service';
import { SearchModelDto } from './dto/search-model-dto';

@Controller('models')
export class ModelsController {
  constructor(private readonly modelsService: ModelsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(
    FileFieldsInterceptor(
      [{ name: 'models' }, { name: 'images' }],
      multerOptions(),
    ),
  )
  create(
    @Request() req: any,
    @Body() createModelDto: CreateModelDto,
    @UploadedFiles() files: any,
  ) {
    console.log(files['models']);
    const modelFilesNames = files['models'].map((file) => file.filename);
    const modelImagesNames = files['images'].map((file) => file.filename);
    return this.modelsService.create(
      req.user.id,
      createModelDto,
      modelFilesNames,
      modelImagesNames,
    );
  }

  @Get()
  async findAll() {
    const models = await this.modelsService.findAll();
    return models;
  }

  @Post('/search')
  async findFromSearch(@Body() searchModelsDto: SearchModelDto) {
    const models = await this.modelsService.findBySearchTerm(
      searchModelsDto.searchString,
    );
    return models;
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.modelsService.findOneWithUserAndTags(id);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  update(@Param('id') id: string, @Body() updateModelDto: UpdateModelDto) {
    return this.modelsService.update(id, updateModelDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.modelsService.remove(id);
  }
}
