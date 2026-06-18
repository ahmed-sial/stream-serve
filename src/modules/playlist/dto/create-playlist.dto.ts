import { IsValidString } from '../../../common/decorators/is-valid-string.decorator';
import { IsValidOptionalString } from '../../../common/decorators/is-valid-optional-string.decorator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePlaylistDto {
  @IsValidString()
  name!: string;

  @ApiPropertyOptional()
  @IsValidOptionalString({ min: 10, max: 100 })
  description?: string;
}
