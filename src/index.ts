import 'reflect-metadata';
import express from 'express';
import { MikroORM } from '@mikro-orm/core';
import { ApolloServer } from 'apollo-server-express';
import { buildSchema } from 'type-graphql';
import redis from 'redis';
import session from 'express-session';
import connectRedis from 'connect-redis';
import cors from 'cors';

import microConfig from './mikro-orm.config';
import { HelloResolver } from './resolvers/hello';
import { PostResolver } from './resolvers/post';
import { UserResolver } from './resolvers/user';
import { COOKIE_NAME, __prod__ } from './constants';
import { MyContext } from './types';

declare module 'express-session' {
  interface SessionData {
    userId: number;
  }
}

const main = async () => {
  const orm = await MikroORM.init(microConfig);
  await orm.getMigrator().up();

  const app = express();

  const RedisStore = connectRedis(session);
  const redisClient = redis.createClient();

  redisClient.on('connect', function () {
    console.log('        Connected to Redis 🚀🚀');
    console.log('=========================================');
  });

  redisClient.on('error', function (err) {
    console.log('Redis error: ' + err);
  });

  app.use(
    cors({
      origin: 'http://localhost:3000',
      credentials: true,
    })
  );
  app.use(
    session({
      name: COOKIE_NAME,
      store: new RedisStore({
        client: redisClient,
        disableTouch: true,
      }),
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 365 * 10, // 10 Years
        httpOnly: true,
        sameSite: 'lax', // csrf
        secure: __prod__, // Cookie only works in https
      },
      saveUninitialized: false,
      secret: 'my really really secret key',
      resave: false,
    })
  );

  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [HelloResolver, PostResolver, UserResolver],
      validate: false,
    }),
    context: ({ req, res }): MyContext => ({ em: orm.em, req, res }),
  });

  apolloServer.applyMiddleware({
    app,
    cors: false,
  });

  app.listen(4000, () => {
    console.log('=========================================');
    console.log('  Server started on localhost:4000 🚀🚀');
    console.log('=========================================');
  });
};

main().catch((err) => {
  console.error(err);
});
