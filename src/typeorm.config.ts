import dotenv from 'dotenv';
import path from 'path';
import { ConnectionOptions } from 'typeorm';
import { __prod__ } from './constants';
import { Post } from './entities/Post';
import { Updoot } from './entities/Updoot';
import { User } from './entities/User';

dotenv.config();

export default {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  logging: true,
  synchronize: !__prod__,
  migrations: [path.join(__dirname, './migrations/*')],
  entities: [Post, User, Updoot],
} as ConnectionOptions;
