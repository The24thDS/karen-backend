import { Module } from '@nestjs/common';

import { ModelsController } from './models.controller';
import { ModelsService } from './models.service';

@Module({
  imports: [],
  controllers: [ModelsController],
  providers: [ModelsService],
})
export class ModelsModule {}
