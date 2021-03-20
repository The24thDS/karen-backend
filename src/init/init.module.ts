import { Module } from '@nestjs/common';

import { InitController } from './init.controller';

@Module({
  controllers: [InitController]
})
export class InitModule {}
