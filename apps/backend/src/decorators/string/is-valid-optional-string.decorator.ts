import { applyDecorators, createParamDecorator } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Length, ValidateIf } from 'class-validator';
import { IsValidStringOptions } from '.';

export function IsValidOptionalString(options: IsValidStringOptions = {}) {
  const { min = 2, max = 256 } = options;
  return applyDecorators(
    Transform(({ value }) =>
      typeof value === 'string' ? value.trim() : value,
    ),
    ValidateIf(
      (object, value) => value !== null && value !== undefined && value !== '',
    ),
    IsString(),
    IsNotEmpty(),
    Length(min, max),
  );
}
