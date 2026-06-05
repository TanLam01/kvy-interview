import {
  Controller,
  Post,
  Get,
  UploadedFile,
  UseInterceptors,
  Body,
  BadRequestException,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { DocumentsService } from './documents.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request';

// Ensure uploads directory exists
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

@UseGuards(AuthGuard, RolesGuard)
@Roles('SELLER')
@Controller('seller/documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadDir,
        filename: (req, file, callback) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = path.extname(file.originalname);
          callback(null, `${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        // Accept only PDF, PNG, JPG, JPEG
        const allowedExts = ['.pdf', '.png', '.jpg', '.jpeg'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (!allowedExts.includes(ext)) {
          return callback(
            new BadRequestException(
              'Only PDF, PNG, JPG, JPEG documents are allowed',
            ),
            false,
          );
        }
        callback(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
      },
    }),
  )
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body('documentType') documentType: string,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!file) {
      throw new BadRequestException('Document file is required');
    }

    if (!documentType) {
      throw new BadRequestException('documentType is required');
    }

    const allowedTypes = ['business_license', 'tax_registration'];

    if (!allowedTypes.includes(documentType)) {
      throw new BadRequestException(
        'Invalid documentType. Must be business_license or tax_registration',
      );
    }

    const sellerId = req.user.id;

    return this.documentsService.uploadAndQueue({
      sellerId,
      fileName: file.filename, // Store unique saved filename
      documentType,
    });
  }

  @Get('status')
  async getStatus(@Req() req: AuthenticatedRequest) {
    const sellerId = req.user.id;
    return this.documentsService.getVerificationStatus(sellerId);
  }
}
