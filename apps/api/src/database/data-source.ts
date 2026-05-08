import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
  database: process.env.DATABASE_NAME ?? 'taxipool',
  username: process.env.DATABASE_USER ?? 'postgres',
  password: process.env.DATABASE_PASSWORD ?? 'postgres',
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  entities: [path.join(__dirname, '/../**/*.entity{.ts,.js}')],
  migrations: [path.join(__dirname, '/migrations/*{.ts,.js}')],
  synchronize: false,
  logging: false,
});

export default AppDataSource;
