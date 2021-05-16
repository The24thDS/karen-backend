import { forwardRef, Module } from '@nestjs/common';
import { ModelsModule } from 'src/models/models.module';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';

@Module({
  imports: [forwardRef(() => ModelsModule)],
  controllers: [AssetsController],
  providers: [AssetsService],
  exports: [AssetsService],
})
export class AssetsModule {}
