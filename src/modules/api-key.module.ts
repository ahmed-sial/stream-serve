import { Module } from '@nestjs/common';
import { ApiKeyController } from 'src/controllers/api-key.controller';
import { ApiKeyService } from 'src/services/api-key.service';

@Module({
  controllers: [ApiKeyController],
  providers: [ApiKeyService],
})
export class ApiKeyModule {}
