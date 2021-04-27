import { Controller, Get, Param, Query, Res } from '@nestjs/common';

@Controller('assets')
export class AssetsController {
  @Get('images/:name')
  getImage(
    @Param('name') imageName: string,
    @Query('modelAuthor') modelAuthor: string,
    @Query('modelSlug') modelSlug: string,
    @Res() res,
  ) {
    const modelImagesPath = `${process.env.UPLOAD_DIRECTORY}/${modelAuthor}/${modelSlug}/images`;
    return res.sendFile(imageName, { root: modelImagesPath });
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

  @Get('models/:name')
  getModel(
    @Param('name') fileName: string,
    @Query('modelAuthor') modelAuthor: string,
    @Query('modelSlug') modelSlug: string,
    @Res() res,
  ) {
    const modelFilesPath = `${process.env.UPLOAD_DIRECTORY}/${modelAuthor}/${modelSlug}/files`;
    return res.sendFile(fileName, { root: modelFilesPath });
  }
}
