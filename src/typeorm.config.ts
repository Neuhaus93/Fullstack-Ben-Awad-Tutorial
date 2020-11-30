import { ConnectionOptions } from 'typeorm';
import { Post } from './entities/Post';
import { User } from './entities/User';

export default {
  type: 'postgres',
  database: 'lireddit2',
  username: 'postgres',
  password: 'PASSWORD',
  logging: true,
  synchronize: true,
  entities: [Post, User],
} as ConnectionOptions;
