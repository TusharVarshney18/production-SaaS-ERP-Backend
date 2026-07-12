import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../authorization/guards/permission.guard';
import { Permissions } from '../authorization/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inventory/organizations/:orgId')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  // ─── Categories ───────────────────────────

  @Post('categories')
  @UseGuards(PermissionGuard)
  @Permissions('category:create')
  @ApiOperation({ summary: 'Create a new category' })
  createCategory(
    @Param('orgId') orgId: string,
    @Body() dto: CreateCategoryDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.products.createCategory(orgId, dto, user.sub, req.requestId);
  }

  @Get('categories')
  @UseGuards(PermissionGuard)
  @Permissions('category:read')
  @ApiOperation({ summary: 'List all categories' })
  findAllCategories(@Param('orgId') orgId: string) {
    return this.products.findAllCategories(orgId);
  }

  @Get('categories/:id')
  @UseGuards(PermissionGuard)
  @Permissions('category:read')
  @ApiOperation({ summary: 'Get category details' })
  findOneCategory(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.products.findOneCategory(orgId, id);
  }

  @Patch('categories/:id')
  @UseGuards(PermissionGuard)
  @Permissions('category:update')
  @ApiOperation({ summary: 'Update category' })
  updateCategory(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.products.updateCategory(orgId, id, dto, user.sub, req.requestId);
  }

  @Delete('categories/:id')
  @UseGuards(PermissionGuard)
  @Permissions('category:delete')
  @ApiOperation({ summary: 'Delete category (hard delete)' })
  deleteCategory(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.products.deleteCategory(orgId, id, user.sub, req.requestId);
  }

  // ─── Units ────────────────────────────────

  @Post('units')
  @UseGuards(PermissionGuard)
  @Permissions('unit:create')
  @ApiOperation({ summary: 'Create a new unit of measure' })
  createUnit(
    @Param('orgId') orgId: string,
    @Body() dto: CreateUnitDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.products.createUnit(orgId, dto, user.sub, req.requestId);
  }

  @Get('units')
  @UseGuards(PermissionGuard)
  @Permissions('unit:read')
  @ApiOperation({ summary: 'List all units of measure' })
  findAllUnits(@Param('orgId') orgId: string) {
    return this.products.findAllUnits(orgId);
  }

  @Get('units/:id')
  @UseGuards(PermissionGuard)
  @Permissions('unit:read')
  @ApiOperation({ summary: 'Get unit details' })
  findOneUnit(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.products.findOneUnit(orgId, id);
  }

  @Patch('units/:id')
  @UseGuards(PermissionGuard)
  @Permissions('unit:update')
  @ApiOperation({ summary: 'Update unit' })
  updateUnit(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateUnitDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.products.updateUnit(orgId, id, dto, user.sub, req.requestId);
  }

  @Delete('units/:id')
  @UseGuards(PermissionGuard)
  @Permissions('unit:delete')
  @ApiOperation({ summary: 'Delete unit (hard delete)' })
  deleteUnit(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.products.deleteUnit(orgId, id, user.sub, req.requestId);
  }

  // ─── Products ─────────────────────────────

  @Post('products')
  @UseGuards(PermissionGuard)
  @Permissions('product:create')
  @ApiOperation({ summary: 'Create a new product' })
  create(
    @Param('orgId') orgId: string,
    @Body() dto: CreateProductDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.products.create(orgId, dto, user.sub, req.requestId);
  }

  @Get('products')
  @UseGuards(PermissionGuard)
  @Permissions('product:read')
  @ApiOperation({ summary: 'List products with search, filter, pagination' })
  findAll(@Param('orgId') orgId: string, @Query() query: ProductQueryDto) {
    return this.products.findAll(orgId, query);
  }

  @Get('products/:id')
  @UseGuards(PermissionGuard)
  @Permissions('product:read')
  @ApiOperation({ summary: 'Get product details' })
  findOne(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.products.findOne(orgId, id);
  }

  @Patch('products/:id')
  @UseGuards(PermissionGuard)
  @Permissions('product:update')
  @ApiOperation({ summary: 'Update product' })
  update(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.products.update(orgId, id, dto, user.sub, req.requestId);
  }

  @Post('products/:id/archive')
  @UseGuards(PermissionGuard)
  @Permissions('product:update')
  @ApiOperation({ summary: 'Archive product (set inactive)' })
  archive(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.products.archive(orgId, id, user.sub, req.requestId);
  }

  @Post('products/:id/restore')
  @UseGuards(PermissionGuard)
  @Permissions('product:update')
  @ApiOperation({ summary: 'Restore product (set active)' })
  restore(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.products.restore(orgId, id, user.sub, req.requestId);
  }

  @Delete('products/:id')
  @UseGuards(PermissionGuard)
  @Permissions('product:delete')
  @ApiOperation({ summary: 'Soft delete product' })
  delete(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.products.delete(orgId, id, user.sub, req.requestId);
  }
}
