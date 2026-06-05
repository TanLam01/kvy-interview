import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class WebhookDto {
  @IsUUID()
  verificationId!: string;

  @IsUUID()
  documentId!: string;

  @IsIn(['verified', 'rejected', 'inconclusive'])
  status!: 'verified' | 'rejected' | 'inconclusive';

  @IsOptional()
  @IsString()
  reason?: string;
}
