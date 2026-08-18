import { ValidationPipe } from '@nestjs/common';

/** Shape/type validation at the API layer (Blueprint Part 11.4, first pass). */
export function buildValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });
}
