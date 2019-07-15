import React from 'react';
import queryString from 'query-string';
import intersectionBy from 'lodash/intersectionBy';
import isNull from 'lodash/isNull';
import styled from '@emotion/styled';

import { Alert } from 'reactstrap';

import { MAIN_NAV_ROUTES } from '../constants/routes';
import { flattenGatsbyGraphQL } from '../utils/dataHelpers';
import { SEARCH } from '../messages';

import Layout from '../hoc/Layout';
import { ResourcePreview, Masthead, TopicsContainer } from '../components/Home';
import withResourceQuery from '../hoc/withResourceQuery';
import Aux from '../hoc/auxillary';

import { useSearch } from '../utils/hooks';
import {
  selectTopicsWithResourcesGroupedByType,
  selectResourcesGroupedByType,
} from '../utils/selectors';
import { isQueryEmpty } from '../utils/search';
import { SEARCH_QUERY_PARAM } from '../constants/search';
import { SPACING } from '../constants/designTokens';
import uniqBy from 'lodash/uniqBy';
import { formatEvents, formatMeetUps } from '../templates/events';
import { RESOURCE_TYPES } from '../constants/ui';
var converter = require('number-to-words');

const Main = styled.main`
  margin-bottom: ${SPACING['1x']};
  margin-top: ${SPACING['2x']};
  padding: 0 ${SPACING['2x']};
`;

/**
 * returns topics container component so aslong as a search is not being done
 * @param {Array} topics list of topics also known as topics
 * @param {Boolean} searchResultsExist
 */
const getTopicPreviews = (topics, searchResultsExist) => {
  const topicsSelector = selectTopicsWithResourcesGroupedByType();
  return (
    !searchResultsExist && (
      <TopicsContainer topics={topicsSelector(topics)} link={MAIN_NAV_ROUTES.TOPICS} />
    )
  );
};

/**
 * returns the resources but without duplicates, based on title as the same resource in different topics will have different id's
 * there is one exception to when we do want resources with the same title though, that being events - thus events are return unchanged
 */
const getUniqueResources = resources => {
  let events = resources.filter(resource => resource.resource.type === RESOURCE_TYPES.EVENTS);
  let allButEvents = resources.filter(resource => resource.resource.type !== RESOURCE_TYPES.EVENTS);
  allButEvents = uniqBy(allButEvents, 'unfurl.title');
  return allButEvents.concat(events);
};

/**
 * returns the text and path being used for the link in the ResourcePreview below
 * the text will be reflective of the resourceType and is sensitive to different search result # cases
 * the link takes you to the corresponding resource type page but with the search active on that page
 */
const getTextAndLink = (resourceType, resourcesByType) => {
  // The resourceSearchPath will give you the string of the query as its used in the URL
  // ex: '?q=Open%20Shift' so that we can use it in the link for each resourceType result
  // This opperates under the assumption that there will be 3 occurences of '/' before such a string
  let resourceSearchPath = window.location.href.split('/');
  resourceSearchPath = resourceSearchPath[3];

  const numOfResults = converter.toWords(resourcesByType[resourceType].length);
  //default values
  let textAndPath = {
    to: `${MAIN_NAV_ROUTES[resourceType].to}${resourceSearchPath}`,
    text: `${numOfResults} ${resourceType} found`,
  };

  //these statements catch exceptions for the default values involving pluralization
  if (resourcesByType[resourceType].length === 1 && resourceType !== RESOURCE_TYPES.DOCUMENTATION) {
    if (resourceType === RESOURCE_TYPES.REPOSITORIES) {
      textAndPath.text = `${numOfResults} respository found`;
    } else {
      //remove the 's' off the resource type name
      textAndPath.text = `${numOfResults} ${resourceType.slice(0, -1)} found`;
    }
  } else if (resourceType === RESOURCE_TYPES.DOCUMENTATION) {
    if (resourcesByType[resourceType].length === 1) {
      textAndPath.text = `${numOfResults} piece of ${resourceType} found`;
    } else {
      textAndPath.text = `${numOfResults} pieces of ${resourceType} found`;
    }
  }

  return textAndPath;
};

/**
 * returns a resource preview components
 * @param {Array} resources the list of siphon resources
 * @param {Array} results the list of searched resources
 * @param {string} query the search query
 */
const getResourcePreviews = (resources, query, results = []) => {
  const resourcesSelector = selectResourcesGroupedByType();
  let resourcesToGroup = resources;
  if (!isNull(results) && results.length > 0) {
    // diff out resources by id
    resourcesToGroup = intersectionBy(resources, results, 'id');
  }
  resourcesToGroup = getUniqueResources(resourcesToGroup);

  // select resources grouped by type using relesect memoization https://github.com/reduxjs/reselect/issues/30
  let resourcesByType = resourcesSelector(resourcesToGroup);
  const siphonResources = Object.keys(resourcesByType).map(resourceType => {
    if (resourcesByType[resourceType].length > 0) {
      const linkWithCounter = getTextAndLink(resourceType, resourcesByType);
      return (
        <ResourcePreview
          key={resourceType}
          title={resourceType}
          resources={resourcesByType[resourceType]}
          link={linkWithCounter}
        />
      );
    }
    return null;
  });

  return siphonResources;
};

export const TEST_IDS = {
  alert: 'home-test-alert',
};

export const Index = ({
  data: {
    allDevhubTopic,
    allDevhubSiphon,
    allEventbriteEvents,
    allMeetupGroup,
    siteSearchIndex: { index },
  },
  location,
}) => {
  const queryParam = queryString.parse(location.search);
  let query = [];
  let results = [];
  let windowHasQuery = Object.prototype.hasOwnProperty.call(queryParam, SEARCH_QUERY_PARAM);

  if (windowHasQuery) {
    query = decodeURIComponent(queryParam[SEARCH_QUERY_PARAM]);
  } else {
    query = '';
  }

  results = useSearch(query, index);

  const allEvents = flattenGatsbyGraphQL(allEventbriteEvents.edges);
  const currentEvents = formatEvents(allEvents.filter(e => e.start.daysFromNow <= 0));
  const allMeetups = formatMeetUps(
    flattenGatsbyGraphQL(allMeetupGroup.edges).flatMap(meetups => {
      return meetups.childrenMeetupEvent;
    }),
  );
  const currentMeetups = allMeetups.filter(e => e.start.daysFromNow <= 0);
  const eventsAndMeetups = currentEvents.concat(currentMeetups);

  // this is defined by ?q='' or ?q=''&q=''..etc
  // if query is empty we prevent the search results empty from being rendered
  // in addition the topics container is prevented from not rendering because
  // the query is present
  const queryIsEmpty = isQueryEmpty(query);

  let content = null;

  const siphonResources = getResourcePreviews(
    flattenGatsbyGraphQL(allDevhubSiphon.edges).concat(eventsAndMeetups),
    query,
    results,
  );

  const resourcesNotFound = !queryIsEmpty && (!results || (results.length === 0 && windowHasQuery));
  if (queryIsEmpty) {
    content = (
      <Aux>
        {getTopicPreviews(
          flattenGatsbyGraphQL(allDevhubTopic.edges),
          windowHasQuery && !queryIsEmpty,
        )}
      </Aux>
    );
  } else if (resourcesNotFound) {
    content = (
      <Alert style={{ margin: '10px auto' }} color="info" data-testid={TEST_IDS.alert}>
        {SEARCH.results.empty.defaultMessage}
      </Alert>
    );
  } else {
    content = (
      <Aux>
        {getTopicPreviews(
          flattenGatsbyGraphQL(allDevhubTopic.edges),
          windowHasQuery && !queryIsEmpty,
        )}
        {siphonResources}
      </Aux>
    );
  }

  return (
    <Layout showHamburger>
      <Masthead query={query} />
      <Main>{content}</Main>
    </Layout>
  );
};

export default withResourceQuery(Index)();
