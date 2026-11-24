import { Global, Module } from '@nestjs/common';
import { DefaultUserService } from './default-user.service';

@Global()
@Module({
  providers: [DefaultUserService],
  exports: [DefaultUserService],
})
export class CommonModule {}
