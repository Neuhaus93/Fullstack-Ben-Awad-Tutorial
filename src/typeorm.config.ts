import { ConnectionOptions } from 'typeorm';
import { Post } from './entities/Post';
import { User } from './entities/User';
import path from 'path';

export default {
  type: 'postgres',
  database: 'lireddit2',
  username: 'postgres',
  password: 'PASSWORD',
  logging: true,
  synchronize: true,
  migrations: [path.join(__dirname, './migrations/*')],
  entities: [Post, User],
} as ConnectionOptions;
