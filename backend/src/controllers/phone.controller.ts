import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Phone, PhoneStatus } from '@prisma/client';
import { AuthenticatedUser, CurrentUser, JwtAuthGuard } from '../middleware/auth.middleware';
import { RolesGuard } from '../middleware/role.middleware';
import { PhoneService } from '../services/phone.service';
import { CreatePhoneDto } from '../models/dto/create-phone.dto';
import { UpdatePhoneDto } from '../models/dto/update-phone.dto';

@Controller('phones')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PhoneController {
  constructor(private readonly phoneService: PhoneService) {}

  /** Available stock is a live query: phones where status = In Stock (Blueprint 3.2). */
  @Get()
  findAll(
    @Query('status', new ParseEnumPipe(PhoneStatus, { optional: true }))
    status?: PhoneStatus,
  ): Promise<Phone[]> {
    return this.phoneService.listPhones(status);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Phone> {
    return this.phoneService.getPhone(id);
  }

  /** Manual add outside a purchase — still requires supplier + purchase price (Blueprint 3.1). */
  @Post()
  create(
    @Body() dto: CreatePhoneDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Phone> {
    return this.phoneService.addPhone(dto, user.userId);
  }

  /** Only selling price, color, and controlled status transitions are editable (Blueprint 3.1). */
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePhoneDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Phone> {
    return this.phoneService.updatePhone(id, dto, user.userId);
  }
}
