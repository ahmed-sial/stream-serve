import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Length } from 'class-validator';
import { IsValidStringOptions } from '.';

export function IsValidString(options: IsValidStringOptions = {}) {
  const { min = 2, max = 256 } = options;
  return applyDecorators(
    IsString(),
    Transform(({ value }) =>
      typeof value === 'string' ? value.trim() : value,
    ),
    IsNotEmpty(),
    Length(min, max),
  );
}
