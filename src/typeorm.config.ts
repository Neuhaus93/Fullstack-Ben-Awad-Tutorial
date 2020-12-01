import path from 'path';
import { ConnectionOptions } from 'typeorm';
import { Post } from './entities/Post';
import { Updoot } from './entities/Updoot';
import { User } from './entities/User';

export default {
  type: 'postgres',
  database: 'lireddit2',
  username: 'postgres',
  password: 'PASSWORD',
  logging: true,
  synchronize: true,
  migrations: [path.join(__dirname, './migrations/*')],
  entities: [Post, User, Updoot],
} as ConnectionOptions;
