import {
  Controller,
  Post,
  Body,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }

  @Get('seeds')
  getSeeds() {
    if (process.env.SHOW_SEED_CREDENTIALS !== 'true') {
      throw new NotFoundException();
    }
    return this.authService.getSeedUsers();
  }
}
