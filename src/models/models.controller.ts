import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { multerOptions } from 'src/utils/multer-options';

import { CreateModelDto } from './dto/create-model.dto';
import { UpdateModelDto } from './dto/update-model.dto';
import { ModelsService } from './models.service';

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
  create(@Body() createModelDto: CreateModelDto, @UploadedFiles() files: any) {
    console.log(createModelDto);
    const modelFilesPaths = files['models'].map((file) => file.path);
    const modelImagesPaths = files['images'].map((file) => file.path);
    return this.modelsService.create(
      createModelDto,
      modelFilesPaths,
      modelImagesPaths,
    );
  }

  @Get()
  findAll() {
    return this.modelsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.modelsService.findOne(id, true);
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
