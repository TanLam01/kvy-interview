import { IsIn, IsOptional, IsString } from 'class-validator';

export class AdminDecisionDto {
  @IsIn(['verify', 'reject'])
  action!: 'verify' | 'reject';

  @IsOptional()
  @IsString()
  reason?: string;
}
