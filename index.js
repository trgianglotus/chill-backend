import express from 'express';
import bodyParser from 'body-parser';
import { makeExecutableSchema } from 'graphql-tools';
import { graphqlExpress, graphiqlExpress } from 'apollo-server-express';

import typeDefs from './schema';
import resolvers from './resolvers';
import models from './models';

const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

const app = express();
const graphqlEndpoint = '/graphql';
// bodyParser is needed just for POST.
app.use(graphqlEndpoint, bodyParser.json(), graphqlExpress({ schema }));

app.use('/graphiql', graphiqlExpress({ endpointURL: graphqlEndpoint }));

// Add { force: true } sync to drop tables on restart
models.sequelize.sync().then(() => {
  app.listen(8080);
});
