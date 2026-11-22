import { createHash } from 'node:crypto';

export const PUBLIC_POST_QUERY = /* GraphQL */ `
  query PublicPost($username: String!, $slug: String!) {
    post(username: $username, slug: $slug) {
      username
      slug
      title
      description
      contentHtml
    }
  }
`;

export const PUBLIC_POST_QUERY_ID = createHash('sha256').update(PUBLIC_POST_QUERY).digest('hex');

export const PUBLIC_FEED_QUERY = /* GraphQL */ `
  query PublicFeed($limit: Int = 12) {
    feed(limit: $limit) {
      username
      slug
      title
      description
    }
  }
`;

export const VIEWER_QUERY = /* GraphQL */ `
  query Viewer {
    viewer {
      username
      name
      avatar
      hasEditorRole
    }
  }
`;

export const PUBLIC_FEED_QUERY_ID = createHash('sha256').update(PUBLIC_FEED_QUERY).digest('hex');
export const VIEWER_QUERY_ID = createHash('sha256').update(VIEWER_QUERY).digest('hex');

export const registeredOperations = {
  [PUBLIC_POST_QUERY_ID]: PUBLIC_POST_QUERY,
  [PUBLIC_FEED_QUERY_ID]: PUBLIC_FEED_QUERY,
  [VIEWER_QUERY_ID]: VIEWER_QUERY,
};

export const schema = /* GraphQL */ `
  type Query {
    post(username: String!, slug: String!): PublicPost
    feed(limit: Int): [PostExcerpt!]!
    viewer: Viewer
  }

  type PublicPost {
    username: String!
    slug: String!
    title: String!
    description: String!
    contentHtml: String!
  }

  type PostExcerpt {
    username: String!
    slug: String!
    title: String!
    description: String!
  }

  type Viewer {
    username: String!
    name: String!
    avatar: String!
    hasEditorRole: Boolean!
  }
`;
