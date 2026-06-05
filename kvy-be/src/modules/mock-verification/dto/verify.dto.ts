import { IsIn, IsUrl, IsUUID } from 'class-validator';

export class VerifyDto {
  @IsUUID()
  verificationId!: string;

  @IsUUID()
  documentId!: string;

  @IsIn(['business_license', 'tax_registration'])
  documentType!: string;

  @IsUrl({ require_tld: false })
  callbackUrl!: string;
}
