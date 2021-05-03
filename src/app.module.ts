import { Neo4jModule } from 'nest-neo4j/dist';

import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { InitModule } from './init/init.module';
import { ModelsModule } from './models/models.module';
import { TagsModule } from './tags/tags.module';
import { UsersModule } from './users/users.module';
import { AssetsModule } from './assets/assets.module';

@Module({
  imports: [
    Neo4jModule.forRoot({
      scheme: 'neo4j',
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
    }),
    ModelsModule,
    TagsModule,
    AuthModule,
    UsersModule,
    InitModule,
    AssetsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
