import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { buildValidationPipe } from './middleware/validate.middleware';
import { AllExceptionsFilter } from './middleware/errorHandler.middleware';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableCors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' });
  app.useGlobalPipes(buildValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
