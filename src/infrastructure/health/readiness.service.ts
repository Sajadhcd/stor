import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CacheService } from '../cache/cache.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { TenantPrismaService } from '../database/tenant-prisma.service.js';

type CheckStatus = 'UP' | 'DOWN';

export interface ReadinessCheck {
  status: CheckStatus;
  message?: string;
  [key: string]: unknown;
}

export interface ReadinessReport {
  status: CheckStatus;
  timestamp: string;
  details: {
    postgres: ReadinessCheck;
    schema: ReadinessCheck;
    prisma: ReadinessCheck;
    redis: ReadinessCheck;
    migrations: ReadinessCheck;
  };
}

interface SchemaColumn {
  table_name: string;
  column_name: string;
}

interface SchemaEnum {
  typname: string;
}

interface MigrationRow {
  migration_name: string;
  finished_at: Date | null;
  rolled_back_at: Date | null;
}

@Injectable()
export class ReadinessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly cache: CacheService,
  ) {}

  async check(): Promise<ReadinessReport> {
    const [postgres, schema, prisma, redis, migrations] = await Promise.all([
      this.checkPostgres(),
      this.checkSchema(),
      this.checkPrisma(),
      this.checkRedis(),
      this.checkMigrations(),
    ]);
    const details = { postgres, schema, prisma, redis, migrations };

    return {
      status: Object.values(details).every((check) => check.status === 'UP') ? 'UP' : 'DOWN',
      timestamp: new Date().toISOString(),
      details,
    };
  }

  private async checkPostgres(): Promise<ReadinessCheck> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'UP' };
    } catch {
      return { status: 'DOWN', message: 'PostgreSQL connection failed' };
    }
  }

  private async checkSchema(): Promise<ReadinessCheck> {
    try {
      const [columns, enums] = await Promise.all([
        this.prisma.$queryRaw<SchemaColumn[]>`
          SELECT table_name, column_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
        `,
        this.prisma.$queryRaw<SchemaEnum[]>`
          SELECT type.typname
          FROM pg_catalog.pg_type AS type
          INNER JOIN pg_catalog.pg_namespace AS namespace
            ON namespace.oid = type.typnamespace
          WHERE namespace.nspname = 'public'
            AND type.typtype = 'e'
        `,
      ]);

      const actualColumns = new Set(
        columns.map(({ table_name, column_name }) => `${table_name}.${column_name}`),
      );
      const expectedTables = new Set<string>();
      const expectedColumns = new Set<string>();

      for (const model of Prisma.dmmf.datamodel.models) {
        const tableName = model.dbName ?? model.name;
        expectedTables.add(tableName);
        for (const field of model.fields) {
          if (field.kind !== 'object') {
            expectedColumns.add(`${tableName}.${field.dbName ?? field.name}`);
          }
        }
      }

      const actualTables = new Set(columns.map(({ table_name }) => table_name));
      const missingTables = [...expectedTables].filter((table) => !actualTables.has(table));
      const missingColumns = [...expectedColumns].filter((column) => !actualColumns.has(column));
      const actualEnums = new Set(enums.map(({ typname }) => typname));
      const missingEnums = Prisma.dmmf.datamodel.enums
        .map((schemaEnum) => schemaEnum.dbName ?? schemaEnum.name)
        .filter((schemaEnum) => !actualEnums.has(schemaEnum));

      if (missingTables.length > 0 || missingColumns.length > 0 || missingEnums.length > 0) {
        return {
          status: 'DOWN',
          message: 'Required database schema objects are missing',
          missingTables,
          missingColumns,
          missingEnums,
        };
      }

      return {
        status: 'UP',
        tables: expectedTables.size,
        columns: expectedColumns.size,
        enums: Prisma.dmmf.datamodel.enums.length,
      };
    } catch {
      return { status: 'DOWN', message: 'Database schema validation failed' };
    }
  }

  private async checkPrisma(): Promise<ReadinessCheck> {
    try {
      await Promise.all([
        this.prisma.$transaction([
          this.prisma.tenant.count(),
          this.prisma.store.count(),
          this.prisma.product.count(),
        ]),
        this.tenantPrisma.ping(),
      ]);
      return { status: 'UP', adminClient: 'UP', rlsClient: 'UP' };
    } catch {
      return { status: 'DOWN', message: 'Prisma query failed' };
    }
  }

  private async checkRedis(): Promise<ReadinessCheck> {
    try {
      return (await this.cache.ping())
        ? { status: 'UP' }
        : { status: 'DOWN', message: 'Redis ping failed' };
    } catch {
      return { status: 'DOWN', message: 'Redis connection failed' };
    }
  }

  private async checkMigrations(): Promise<ReadinessCheck> {
    try {
      const migrationsDirectory = join(process.cwd(), 'prisma', 'migrations');
      const entries = await readdir(migrationsDirectory, { withFileTypes: true });
      const localMigrationNames = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();

      const rows = await this.prisma.$queryRaw<MigrationRow[]>`
        SELECT migration_name, finished_at, rolled_back_at
        FROM "_prisma_migrations"
        ORDER BY started_at
      `;
      const appliedRows = rows.filter(
        (row) => row.finished_at !== null && row.rolled_back_at === null,
      );
      const appliedByName = new Map(appliedRows.map((row) => [row.migration_name, row]));
      const failed = rows
        .filter((row) => row.finished_at === null && row.rolled_back_at === null)
        .map((row) => row.migration_name);
      const pending = localMigrationNames.filter((name) => !appliedByName.has(name));
      const unknown = [...appliedByName.keys()].filter(
        (name) => !localMigrationNames.includes(name),
      );

      if (failed.length > 0 || pending.length > 0 || unknown.length > 0) {
        return {
          status: 'DOWN',
          message: 'Prisma migration history is not deployable',
          failed,
          pending,
          unknown,
        };
      }

      return {
        status: 'UP',
        applied: appliedRows.length,
        latest: localMigrationNames.at(-1) ?? null,
      };
    } catch {
      return { status: 'DOWN', message: 'Migration status validation failed' };
    }
  }
}
