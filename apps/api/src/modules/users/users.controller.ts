import { Body, Controller, Get, HttpStatus, Patch } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Authenticated, CurrentIdentity } from '../../common/decorators/auth.decorators';
import { AppError } from '../../common/errors/app-error';
import { publicUser } from '../../common/serializers/user.serializer';
import { Identity } from '../../common/types/identity';
import { PrismaService } from '../../prisma/prisma.service';
import { ChangePasswordDto, UpdateProfileDto } from './dto/profile.dto';

@Authenticated()
@Controller('me')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async me(@CurrentIdentity() id: Identity) {
    const [jobs, completed] = await Promise.all([
      this.prisma.conversionJob.count({ where: { userId: id.user!.id } }),
      this.prisma.conversionJob.count({ where: { userId: id.user!.id, status: 'COMPLETED' } }),
    ]);
    return { user: publicUser(id.user!), stats: { jobs, completed } };
  }

  @Patch()
  async update(@CurrentIdentity() id: Identity, @Body() dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: id.user!.id },
      data: {
        name: dto.name?.trim(),
        telegram: dto.telegram === undefined ? undefined : dto.telegram.replace(/^@/, '') || null,
      },
    });
    return { user: publicUser(user) };
  }

  @Patch('password')
  async password(@CurrentIdentity() id: Identity, @Body() dto: ChangePasswordDto) {
    if (!(await bcrypt.compare(dto.currentPassword, id.user!.passwordHash))) {
      throw new AppError('BAD_PASSWORD', 'ពាក្យសម្ងាត់បច្ចុប្បន្នមិនត្រឹមត្រូវ', HttpStatus.BAD_REQUEST);
    }
    await this.prisma.user.update({ where: { id: id.user!.id }, data: { passwordHash: await bcrypt.hash(dto.newPassword, 12) } });
    return { ok: true };
  }
}
