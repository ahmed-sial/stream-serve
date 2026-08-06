import { Module } from '@nestjs/common';
import { ApiKeyController } from 'src/controllers/api-key.controller';
import { ApiKeyService } from 'src/services/api-key.service';

@Module({
  imports: [],
  controllers: [ApiKeyController],
  providers: [ApiKeyService],
  exports: [],
})
export class ApiKeyModule {}
