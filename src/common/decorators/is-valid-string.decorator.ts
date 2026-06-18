import { applyDecorators } from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { IsValidStringOptions } from './is-valid-string-options.type';

export function IsValidString({
  min = 3,
  max = 50,
  message = 'Invalid string value',
}: IsValidStringOptions = {}) {
  return applyDecorators(
    IsString({ message }),
    MinLength(min, { message: `Must be at least ${min} characters long` }),
    MaxLength(max, { message: `Must be at most ${max} characters long` }),
  );
}
