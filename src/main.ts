require('dotenv').config();
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as fs from 'fs';

import { AppModule } from './app.module';

async function bootstrap() {
  let app;
  if (process.env.SSL === 'true') {
    const httpsOptions = {
      key: fs.readFileSync(process.env.SSL_KEY_PATH),
      cert: fs.readFileSync(process.env.SSL_CERT_PATH),
    };
    app = await NestFactory.create(AppModule, {
      cors: true,
      httpsOptions,
    });
  } else {
    app = await NestFactory.create(AppModule, { cors: true });
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
    }),
  );

  await app.listen(process.env.PORT);
  Logger.log(`Application started to port ${process.env.PORT}`);
}
bootstrap();
