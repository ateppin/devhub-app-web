'use strict';
require('dotenv').config();
const algoliasearch = require('algoliasearch');


module.exports = async settings => {
  const client = algoliasearch(process.env.ALGOLIA_APP_ID, process.env.ALGOLIA_ADMIN_KEY);
  const { suffix } = settings.options;
  return await client.deleteIndex(`Devhub-Algolia-${suffix}`);
};
