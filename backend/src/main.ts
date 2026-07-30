import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { ApiErrorResponseInterceptor } from './common/interceptors/api-error-response.interceptor';
import { ensureUploadsRoot, getUploadsRoot } from './common/uploads-path.util';

async function bootstrap() {
  console.log('Starting PCmazing Site Backend...');
  console.log('PORT:', process.env.PORT || '3000');
  console.log('NODE_ENV:', process.env.NODE_ENV || 'development');
  console.log('DATABASE_URL present:', !!process.env.DATABASE_URL);
  console.log('CORS_ORIGINS:', process.env.CORS_ORIGINS || 'http://localhost:4200');

  const uploadsRoot = ensureUploadsRoot();
  console.log('UPLOADS_DIR:', uploadsRoot);

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useStaticAssets(getUploadsRoot(), {
    prefix: '/uploads/',
  });

  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new ApiErrorResponseInterceptor());

  const corsOrigins = String(process.env.CORS_ORIGINS || 'http://localhost:4200')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-staff-gate', 'x-setup-key'],
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`PCmazing API listening on port ${port}`);
}

bootstrap().catch((error) => {
  console.error('Bootstrap failed:', error);
  process.exit(1);
});
