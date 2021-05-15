import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { multerOptions } from 'src/utils/multer-options';
import { promises as fs } from 'fs';

@Controller('assets')
export class AssetsController {
  @Get('images/:modelAuthor/:modelSlug/:name')
  getImage(
    @Param('name') imageName: string,
    @Param('modelAuthor') modelAuthor: string,
    @Param('modelSlug') modelSlug: string,
    @Res() res,
  ) {
    const modelImagesPath = `${process.env.UPLOAD_DIRECTORY}/${modelAuthor}/${modelSlug}/images`;
    return res.sendFile(imageName, { root: modelImagesPath });
  }

  @Get('images/inline/:modelAuthor/:modelSlug/:name')
  @Header('Content-Type', 'text/plain')
  getInlineImage(
    @Param('name') imageName: string,
    @Param('modelAuthor') modelAuthor: string,
    @Param('modelSlug') modelSlug: string,
    @Res() res,
  ) {
    const modelImagesPath = `${process.env.UPLOAD_DIRECTORY}/${modelAuthor}/${modelSlug}/images`;
    return res.sendFile(imageName, {
      root: modelImagesPath,
      headers: {
        'Content-Disposition': `inline; filename="${imageName}"`,
      },
    });
  }

  @Get([
    'gltf/:modelAuthor/:modelSlug/:name',
    'gltf/:modelAuthor/:modelSlug/textures/:name',
  ])
  getGltfAssets(
    @Param('name') fileName: string,
    @Param('modelAuthor') modelAuthor: string,
    @Param('modelSlug') modelSlug: string,
    @Res() res,
  ) {
    const modelImagesPath = `${process.env.UPLOAD_DIRECTORY}/${modelAuthor}/${modelSlug}/gltf`;
    return res.sendFile(fileName, { root: modelImagesPath });
  }

  @Get('models/:modelAuthor/:modelSlug/:name')
  getModel(
    @Param('name') fileName: string,
    @Param('modelAuthor') modelAuthor: string,
    @Param('modelSlug') modelSlug: string,
    @Res() res,
  ) {
    const modelFilesPath = `${process.env.UPLOAD_DIRECTORY}/${modelAuthor}/${modelSlug}/files`;
    return res.sendFile(fileName, { root: modelFilesPath });
  }

  @UseGuards(JwtAuthGuard)
  @Post('images')
  @Header('Content-Type', 'text/plain')
  @UseInterceptors(
    FileInterceptor('images', multerOptions(process.env.TEMP_UPLOAD_DIRECTORY)),
  )
  uploadImage(@UploadedFile() file: Express.Multer.File) {
    const id = file.filename.replace(`_${file.originalname}`, '');
    return id;
  }

  @UseGuards(JwtAuthGuard)
  @Post('models')
  @Header('Content-Type', 'text/plain')
  @UseInterceptors(
    FileInterceptor('models', multerOptions(process.env.TEMP_UPLOAD_DIRECTORY)),
  )
  uploadModel(@UploadedFile() file: Express.Multer.File) {
    const id = file.filename.replace(`_${file.originalname}`, '');
    return id;
  }

  @UseGuards(JwtAuthGuard)
  @Post('gltf')
  @Header('Content-Type', 'text/plain')
  @UseInterceptors(
    FileInterceptor('gltf', multerOptions(process.env.TEMP_UPLOAD_DIRECTORY)),
  )
  uploadGltf(@UploadedFile() file: Express.Multer.File) {
    const id = file.filename.replace(`_${file.originalname}`, '');
    return id;
  }

  @UseGuards(JwtAuthGuard)
  @Delete('temp')
  @Header('Content-Type', 'text/plain')
  async removeTempFile(@Body() body: { id: string; name: string }) {
    const filePath = process.env.TEMP_UPLOAD_DIRECTORY;
    const fileName = `${body.id}_${body.name}`;
    try {
      await fs.unlink(`${filePath}/${fileName}`);
      return 'OK';
    } catch (err) {
      return 'NOT OK';
    }
  }
}
