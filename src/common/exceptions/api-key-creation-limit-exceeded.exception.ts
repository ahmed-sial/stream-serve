import { BadRequestException } from '@nestjs/common';

export class ApiKeyCreationLimitExceededException extends BadRequestException {
  constructor(msg: string) {
    super(msg);
  }
}
