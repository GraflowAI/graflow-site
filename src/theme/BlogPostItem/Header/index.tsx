import React from 'react';
import Header from '@theme-original/BlogPostItem/Header';
import type HeaderType from '@theme/BlogPostItem/Header';
import type {WrapperProps} from '@docusaurus/types';
import {useBlogPost} from '@docusaurus/plugin-content-blog/client';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import ShareButtons from '@site/src/components/ShareButtons';

type Props = WrapperProps<typeof HeaderType>;

export default function HeaderWrapper(props: Props): React.ReactElement {
  const {metadata, isBlogPostPage} = useBlogPost();
  const {siteConfig} = useDocusaurusContext();

  return (
    <>
      <Header {...props} />
      {isBlogPostPage && (
        <ShareButtons
          url={`${siteConfig.url}${metadata.permalink}`}
          title={metadata.title}
        />
      )}
    </>
  );
}
