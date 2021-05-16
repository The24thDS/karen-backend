import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Post,
  Request,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { multerOptions } from 'src/utils/multer-options';
import { promises as fs } from 'fs';
import { ModelsService } from 'src/models/models.service';

@Controller('assets')
export class AssetsController {
  allowedAssetTypes = ['images', 'models', 'gltf'];
  constructor(private readonly modelsService: ModelsService) {}

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

  @Get('models/inline/:modelAuthor/:modelSlug/:name')
  @Header('Content-Type', 'text/plain')
  getInlineModelFile(
    @Param('name') fileName: string,
    @Param('modelAuthor') modelAuthor: string,
    @Param('modelSlug') modelSlug: string,
    @Res() res,
  ) {
    const modelFilesPath = `${process.env.UPLOAD_DIRECTORY}/${modelAuthor}/${modelSlug}/files`;
    return res.sendFile(fileName, {
      root: modelFilesPath,
      headers: {
        'Content-Disposition': `inline; filename="${fileName}"`,
      },
    });
  }

  @Get('gltf/inline/:modelAuthor/:modelSlug/:name')
  @Header('Content-Type', 'text/plain')
  getGltfFile(
    @Param('name') fileName: string,
    @Param('modelAuthor') modelAuthor: string,
    @Param('modelSlug') modelSlug: string,
    @Res() res,
  ) {
    const modelFilesPath = `${process.env.UPLOAD_DIRECTORY}/${modelAuthor}/${modelSlug}/gltf`;
    return res.sendFile(fileName, {
      root: modelFilesPath,
      headers: {
        'Content-Disposition': `inline; filename="${fileName}"`,
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

  @UseGuards(JwtAuthGuard)
  @Delete(':type/:modelAuthor/:modelSlug/:name')
  @Header('Content-Type', 'text/plain')
  async removeFile(
    @Request() req,
    @Param('type') type: string,
    @Param('modelAuthor') modelAuthor: string,
    @Param('modelSlug') modelSlug: string,
    @Param('name') name: string,
  ) {
    if (this.allowedAssetTypes.includes(type)) {
      if (type === 'models') {
        type = 'files';
      }
      const author = await this.modelsService.findModelAuthor(modelSlug);
      if (author.id === req.user.id) {
        const filePath = `${process.env.UPLOAD_DIRECTORY}/${modelAuthor}/${modelSlug}/${type}/${name}`;
        const model = await this.modelsService.findOne(modelSlug);
        switch (type) {
          case 'images':
            const { images } = model;
            const newImages = images.filter((image) => image !== name);
            await this.modelsService.setModelImages(modelSlug, newImages);
            break;
          case 'files':
            const { files } = model;
            const newFiles = files.filter(
              (file) => JSON.parse(file).name !== name,
            );
            await this.modelsService.setModelFiles(modelSlug, newFiles);
            break;
          case 'gltf':
            await this.modelsService.removeModelGltf(modelSlug);
            break;
          default:
            break;
        }
        try {
          if (type === 'gltf') {
            const gltfDir = filePath.split('/').slice(0, -1).join('/');
            const files = await fs.readdir(gltfDir);
            for (const file of files) {
              await fs.unlink(`${gltfDir}/${file}`);
            }
          } else {
            await fs.unlink(filePath);
          }
          return { success: true };
        } catch (err) {
          console.log(err);
          throw new InternalServerErrorException("Couldn't delete the file.");
        }
      } else {
        throw new UnauthorizedException();
      }
    } else {
      throw new NotFoundException(`Can't find ${type} type.`);
    }
  }
}
