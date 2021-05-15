import { Module } from '@nestjs/common';

import { AssetsModule } from './../assets/assets.module';
import { ModelsController } from './models.controller';
import { ModelsService } from './models.service';

@Module({
  imports: [AssetsModule],
  controllers: [ModelsController],
  providers: [ModelsService],
})
export class ModelsModule {}
