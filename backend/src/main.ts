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

  // 0.0.0.0 so hosted platforms (Render) can detect the open port
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  console.log(`Listening on 0.0.0.0:${port}`);
}

bootstrap().catch((error) => {
  // Fail loudly so hosted platforms surface boot errors instead of a silent port timeout
  console.error('Fatal boot error:', error);
  process.exit(1);
});
