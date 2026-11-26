import { Body, Controller, Delete, Get, Headers, Param, Post } from '@nestjs/common';
import {
  CreateSoloChallengeInput,
  CreateSoloChallengeSchema,
  JoinSoloChallengeInput,
  JoinSoloChallengeSchema,
  SoloOrderInput,
  SoloOrderSchema,
} from '@trackdailytrade/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SoloService } from './solo.service';

// Token người chơi nhận khi tạo/vào phòng, gửi lại qua header để đặt/đóng lệnh của chính mình.
const TOKEN = 'x-solo-token';

@Controller('solo')
export class SoloController {
  constructor(private readonly solo: SoloService) {}

  @Get()
  list() {
    return this.solo.list();
  }

  @Post()
  create(@Body(new ZodValidationPipe(CreateSoloChallengeSchema)) body: CreateSoloChallengeInput) {
    return this.solo.create(body);
  }

  @Get(':code')
  scoreboard(@Param('code') code: string, @Headers(TOKEN) token?: string) {
    return this.solo.scoreboard(code, token);
  }

  @Post(':code/join')
  join(
    @Param('code') code: string,
    @Body(new ZodValidationPipe(JoinSoloChallengeSchema)) body: JoinSoloChallengeInput,
  ) {
    return this.solo.join(code, body);
  }

  @Post(':code/orders')
  order(
    @Param('code') code: string,
    @Headers(TOKEN) token: string | undefined,
    @Body(new ZodValidationPipe(SoloOrderSchema)) body: SoloOrderInput,
  ) {
    return this.solo.placeOrder(code, token, body);
  }

  @Post(':code/positions/:id/close')
  close(@Param('code') code: string, @Param('id') id: string, @Headers(TOKEN) token?: string) {
    return this.solo.closeManually(code, token, id);
  }

  @Delete(':code')
  cancel(@Param('code') code: string, @Headers(TOKEN) token?: string) {
    return this.solo.cancel(code, token);
  }
}
