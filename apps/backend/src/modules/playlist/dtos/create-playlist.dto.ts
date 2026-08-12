import { IsValidOptionalString } from 'src/decorators/string/is-valid-optional-string.decorator';
import { IsValidString } from 'src/decorators/string/is-valid-string.decorator';

export class CreatePlaylistDto {
  @IsValidString({ min: 2, max: 32 })
  name!: string;
  @IsValidOptionalString({ min: 2, max: 256 })
  description?: string;
}
