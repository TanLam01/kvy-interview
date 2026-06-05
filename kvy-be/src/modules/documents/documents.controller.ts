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
  ServiceUnavailableException,
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
        const allowedExts = ['.pdf', '.png', '.jpg', '.jpeg'];
        const allowedMimeTypes = ['application/pdf', 'image/png', 'image/jpeg'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (
          !allowedExts.includes(ext) ||
          !allowedMimeTypes.includes(file.mimetype)
        ) {
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
      await fs.promises.unlink(file.path).catch(() => undefined);
      throw new BadRequestException('documentType is required');
    }

    const allowedTypes = ['business_license', 'tax_registration'];

    if (!allowedTypes.includes(documentType)) {
      await fs.promises.unlink(file.path).catch(() => undefined);
      throw new BadRequestException(
        'Invalid documentType. Must be business_license or tax_registration',
      );
    }

    if (!(await hasAllowedFileSignature(file.path))) {
      await fs.promises.unlink(file.path).catch(() => undefined);
      throw new BadRequestException('Document content does not match its type');
    }

    const sellerId = req.user.id;

    try {
      return await this.documentsService.uploadAndQueue({
        sellerId,
        fileName: file.filename,
        documentType,
      });
    } catch (error) {
      if (!(error instanceof ServiceUnavailableException)) {
        await fs.promises.unlink(file.path).catch(() => undefined);
      }
      throw error;
    }
  }

  @Get('status')
  async getStatus(@Req() req: AuthenticatedRequest) {
    const sellerId = req.user.id;
    return this.documentsService.getVerificationStatus(sellerId);
  }
}

async function hasAllowedFileSignature(filePath: string): Promise<boolean> {
  const handle = await fs.promises.open(filePath, 'r');

  try {
    const buffer = Buffer.alloc(4);
    await handle.read(buffer, 0, buffer.length, 0);
    const hex = buffer.toString('hex');
    const ascii = buffer.toString('ascii');

    return (
      ascii.startsWith('%PDF') ||
      hex.startsWith('89504e47') ||
      hex.startsWith('ffd8ff')
    );
  } finally {
    await handle.close();
  }
}
