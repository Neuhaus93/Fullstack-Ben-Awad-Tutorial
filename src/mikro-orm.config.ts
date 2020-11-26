import { __prod__ } from './constants';
import { MikroORM } from '@mikro-orm/core';
import path from 'path';

export default {
  migrations: {
    path: path.join(__dirname, './migrations'),
    pattern: /^[\w-]+\d+\.[tj]s$/,
  },
  entities: ['./dist/entities'],
  entitiesTs: ['./src/entities'],
  baseDir: process.cwd(),
  dbName: 'lireddit',
  type: 'postgresql',
  debug: !__prod__,
  user: 'postgres',
  password: 'PASSWORD',
} as Parameters<typeof MikroORM.init>[0];
