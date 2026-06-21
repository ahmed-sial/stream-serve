import { Controller } from '@nestjs/common';
import { UploadService } from './upload.service';

@Controller({
  path: 'uploads',
  version: '1',
})
export class UploadController {
  constructor(private readonly service: UploadService) {}
}
