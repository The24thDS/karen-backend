import { Controller, Get, Param, Res } from '@nestjs/common';

@Controller('assets')
export class AssetsController {
  @Get('images/:name')
  getImage(@Param('name') imageName: string, @Res() res) {
    return res.sendFile(imageName, { root: 'uploads' });
  }

  @Get('models/:name')
  getModel(@Param('name') modelName: string, @Res() res) {
    return res.sendFile(modelName, { root: 'uploads' });
  }
}
