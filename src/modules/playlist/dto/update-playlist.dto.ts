import { CreatePlaylistDto } from './create-playlist.dto';
import { PartialType } from '@nestjs/mapped-types';

export class UpdatePlaylistDto extends PartialType(CreatePlaylistDto) {}
