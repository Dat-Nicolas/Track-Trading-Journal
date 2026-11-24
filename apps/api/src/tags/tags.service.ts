import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateTagInput, UpdateTagInput } from '@trackdailytrade/shared';
import { PrismaService } from '../prisma/prisma.service';
import { DefaultUserService } from '../common/default-user.service';

@Injectable()
export class TagsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly defaultUser: DefaultUserService,
  ) {}

  async findAll() {
    const user = await this.defaultUser.getDefaultUser();
    const tags = await this.prisma.tag.findMany({
      where: { userId: user.id },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { trades: true },
        },
      },
    });

    return tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
      tradeCount: tag._count.trades,
      createdAt: tag.createdAt.toISOString(),
    }));
  }

  async create(input: CreateTagInput) {
    const user = await this.defaultUser.getDefaultUser();

    try {
      const tag = await this.prisma.tag.create({
        data: {
          userId: user.id,
          name: input.name,
          color: input.color,
        },
      });
      return {
        id: tag.id,
        name: tag.name,
        color: tag.color,
        tradeCount: 0,
        createdAt: tag.createdAt.toISOString(),
      };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(`Tag "${input.name}" already exists`);
      }
      throw err;
    }
  }

  async update(id: string, input: UpdateTagInput) {
    const existing = await this.prisma.tag.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Tag ${id} not found`);
    }

    try {
      const updated = await this.prisma.tag.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.color !== undefined ? { color: input.color } : {}),
        },
      });
      return {
        id: updated.id,
        name: updated.name,
        color: updated.color,
        createdAt: updated.createdAt.toISOString(),
      };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(`Tag "${input.name}" already exists`);
      }
      throw err;
    }
  }

  async remove(id: string) {
    const existing = await this.prisma.tag.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Tag ${id} not found`);
    }
    await this.prisma.tag.delete({ where: { id } });
    return { deleted: true, id };
  }
}
