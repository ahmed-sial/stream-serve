import { Module } from '@nestjs/common';
import { ApiKeyController } from 'src/modules/api-key/api-key.controller';
import { ApiKeyService } from 'src/modules/api-key/api-key.service';

@Module({
  imports: [],
  controllers: [ApiKeyController],
  providers: [ApiKeyService],
  exports: [],
})
export class ApiKeyModule {}
