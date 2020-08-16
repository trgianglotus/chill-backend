import express from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import formidable from 'formidable';
import { graphqlExpress, graphiqlExpress } from 'apollo-server-express';
import { makeExecutableSchema } from 'graphql-tools';
import { fileLoader, mergeTypes, mergeResolvers } from 'merge-graphql-schemas';
import { createServer } from 'http';
import { execute, subscribe } from 'graphql';
import { SubscriptionServer } from 'subscriptions-transport-ws';
import DataLoader from 'dataloader';

import models from './models';
import { refreshTokens } from './auth';
import { channelBatcher } from './batchFunction';

const SECRET = 'oMqUT2jQCG2Sy6KPrzl4BWVbL5pVHSyc';
const SECRET2 = 'LMXKhayiCr0oTWSwk6xPzzZiOzfFFGpe';

const typeDefs = mergeTypes(fileLoader(path.join(__dirname, './schemas')));

const resolvers = mergeResolvers(
  fileLoader(path.join(__dirname, './resolvers'))
);

const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

const app = express();
app.use(cors('*'));

const addUser = async (req, res, next) => {
  const token = req.headers['x-token'];
  if (token) {
    try {
      const { user } = jwt.verify(token, SECRET);
      req.user = user;
    } catch (err) {
      const refreshToken = req.headers['x-refresh-token'];
      const newTokens = await refreshTokens(
        token,
        refreshToken,
        models,
        SECRET,
        SECRET2
      );
      if (newTokens.token && newTokens.refreshToken) {
        res.set('Access-Control-Expose-Headers', 'x-token, x-refresh-token');
        res.set('x-token', newTokens.token);
        res.set('x-refresh-token', newTokens.refreshToken);
      }
      req.user = newTokens.user;
    }
  }
  next();
};

const uploadDir = 'files';

const fileMiddleware = (req, res, next) => {
  if (!req.is('multipart/form-data')) {
    return next();
  }

  const form = formidable.IncomingForm({
    uploadDir,
  });

  form.parse(req, (error, { operations }, files) => {
    if (error) {
      console.log(error);
    }

    const document = JSON.parse(operations);

    if (Object.keys(files).length) {
      const {
        file: { type, path: filePath },
      } = files;
      console.log(type);
      console.log(filePath);
      document.variables.file = {
        type,
        path: filePath,
      };
    }

    req.body = document;
    next();
  });
};

app.use(addUser);

const graphqlEndpoint = '/graphql';

// bodyParser is needed just for POST.
app.use(
  graphqlEndpoint,
  bodyParser.json(),
  fileMiddleware,
  graphqlExpress((req) => ({
    schema,
    context: {
      models,
      user: req.user,
      SECRET,
      SECRET2,
      channelLoader: new DataLoader((ids) =>
        channelBatcher(ids, models, req.user)
      ),
      serverUrl: `${req.protocol}://${req.get('host')}`,
    },
  }))
);

app.use('/files', express.static('files'));

app.use(
  '/graphiql',
  graphiqlExpress({
    endpointURL: graphqlEndpoint,
    subscriptionsEndpoint: 'ws://localhost:8080/subscriptions',
  })
);

const server = createServer(app);

// Add { force: true } sync to drop tables on restart
models.sequelize.sync({ force: false }).then(() => {
  server.listen(8080, () => {
    // eslint-disable-next-line no-new
    new SubscriptionServer(
      {
        execute,
        subscribe,
        schema,
        onConnect: async ({ token, refreshToken }, webSocket) => {
          if (token && refreshToken) {
            try {
              const { user } = jwt.verify(token, SECRET);
              return { models, user };
            } catch (err) {
              const newTokens = await refreshTokens(
                token,
                refreshToken,
                models,
                SECRET,
                SECRET2
              );
              return { models, user: newTokens.user };
            }
          }
          return { models };
        },
      },
      {
        server,
        path: '/subscriptions',
      }
    );
  });
});