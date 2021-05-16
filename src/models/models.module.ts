import { forwardRef, Module } from '@nestjs/common';

import { AssetsModule } from './../assets/assets.module';
import { ModelsController } from './models.controller';
import { ModelsService } from './models.service';

@Module({
  imports: [forwardRef(() => AssetsModule)],
  controllers: [ModelsController],
  providers: [ModelsService],
  exports: [ModelsService],
})
export class ModelsModule {}
