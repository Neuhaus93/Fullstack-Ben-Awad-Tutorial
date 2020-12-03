import dotenv from 'dotenv';
import { ApolloServer } from 'apollo-server-express';
import connectRedis from 'connect-redis';
import cors from 'cors';
import express from 'express';
import session from 'express-session';
import Redis from 'ioredis';
import 'reflect-metadata';
import { buildSchema } from 'type-graphql';
import { createConnection } from 'typeorm';
import { COOKIE_NAME, __prod__ } from './constants';
import { HelloResolver } from './resolvers/hello';
import { PostResolver } from './resolvers/post';
import { UserResolver } from './resolvers/user';
import ORMconfig from './typeorm.config';
import { createUpdootLoader } from './utils/createUpdootLoader';
import { createUserLoader } from './utils/createUserLoader';

declare module 'express-session' {
  interface SessionData {
    userId: number;
  }
}

dotenv.config();

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 4000;

const main = async () => {
  const connection = await createConnection(ORMconfig);
  await connection.runMigrations();

  const app = express();

  const redisStore = connectRedis(session);
  const redis = new Redis(process.env.REDIS_URL);

  redis.on('connect', function () {
    console.log('        Connected to Redis 🚀🚀');
    console.log('=========================================');
  });

  redis.on('error', function (err) {
    console.log('Redis error: ' + err);
  });

  app.set('trust proxy', 1);

  app.use(
    cors({
      origin: process.env.CORS_ORIGIN,
      credentials: true,
    })
  );
  app.use(
    session({
      name: COOKIE_NAME,
      store: new redisStore({
        client: redis,
        disableTouch: true,
      }),
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 365 * 10, // 10 Years
        httpOnly: true,
        sameSite: 'lax', // csrf
        secure: __prod__, // Cookie only works in https
      },
      saveUninitialized: false,
      secret: process.env.SESSION_SECRET,
      resave: false,
    })
  );

  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [HelloResolver, PostResolver, UserResolver],
      validate: false,
    }),
    context: ({ req, res }) => ({
      req,
      res,
      redis,
      userLoader: createUserLoader(),
      updootLoader: createUpdootLoader(),
    }),
  });

  apolloServer.applyMiddleware({
    app,
    cors: false,
  });

  app.listen(PORT, () => {
    console.log('=========================================');
    console.log('  Server started on localhost:4000 🚀🚀');
    console.log('=========================================');
  });
};

main().catch((err) => {
  console.error(err);
});
