import type { ReactNode } from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import CodeBlock from '@theme/CodeBlock';

import styles from './index.module.css';

// Feature data
const features = [
  {
    title: '🛡️ Reliable',
    description: (
      <>
        Built-in fault tolerance and automatic recovery ensure your workflows
        complete successfully, even when individual tasks fail. Checkpoint and
        resume from any point in your pipeline.
      </>
    ),
  },
  {
    title: '🔍 Explainable',
    description: (
      <>
        Full visibility into every step of your workflow execution. Detailed
        logs, lineage tracking, and clear error messages make debugging and
        auditing straightforward.
      </>
    ),
  },
  {
    title: '🚀 Scalable',
    description: (
      <>
        Seamlessly scale from local development to production clusters.
        Distributed execution handles massive workloads without changing your
        workflow definitions.
      </>
    ),
  },
];

// Sample workflow code
const workflowExample = `# workflow.yaml
name: data-pipeline
tasks:
  - name: extract
    image: python:3.11
    script: |
      python extract_data.py --source=db

  - name: transform
    depends_on: [extract]
    image: python:3.11
    script: |
      python transform.py --input=raw --output=clean

  - name: load
    depends_on: [transform]
    image: python:3.11
    script: |
      python load_data.py --dest=warehouse`;

function Feature({ title, description }: { title: string; description: ReactNode }) {
  return (
    <div className={clsx('col col--4', styles.feature)}>
      <Heading as="h3">{title}</Heading>
      <p>{description}</p>
    </div>
  );
}

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--dark', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">
          Build <strong>reliable</strong>, <strong>explainable</strong>, and{' '}
          <strong>scalable</strong> workflows with ease.
        </p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs/getting-started/introduction">
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}

function FeaturesSection() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {features.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}

function WorkflowExampleSection() {
  return (
    <section className={styles.exampleSection}>
      <div className="container">
        <div className="row">
          <div className={clsx('col col--6')}>
            <Heading as="h2">Define Your Workflow</Heading>
            <p>
              Simple YAML configuration lets you define complex data pipelines
              with dependencies, error handling, and parallel execution.
            </p>
            <CodeBlock language="yaml" title="workflow.yaml">
              {workflowExample}
            </CodeBlock>
            <Link className={styles.seeMoreLink} to="/docs/getting-started/hello-world">
              See more examples →
            </Link>
          </div>
          <div className={clsx('col col--6', styles.videoContainer)}>
            <Heading as="h2">Watch It Run</Heading>
            <p>
              See how Graflow executes your workflow with real-time progress
              tracking and detailed logging.
            </p>
            <div className={styles.videoPlaceholder}>
              <div className={styles.placeholderContent}>
                <span>Workflow Demo Video</span>
                <small>Coming soon</small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function IntroVideoSection() {
  return (
    <section className={styles.introVideoSection}>
      <div className="container">
        <div className="row">
          <div className={clsx('col col--6')}>
            <Heading as="h2">Learn More About Graflow</Heading>
            <div className={styles.youtubeWrapper}>
              <iframe
                className={styles.youtubeEmbed}
                src="https://www.youtube.com/embed/OkJlpmdCCAg"
                title="Graflow Introduction"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
          <div className={clsx('col col--6', styles.introDescription)}>
            <Heading as="h2">Why Graflow?</Heading>
            <p>
              Graflow is designed to simplify complex data workflows while
              providing full transparency and reliability at scale.
            </p>
            <ul>
              <li>Easy-to-understand YAML configuration</li>
              <li>Built-in monitoring and observability</li>
              <li>Seamless integration with existing tools</li>
              <li>Production-ready from day one</li>
            </ul>
            <Link className={styles.seeMoreLink} to="/docs/getting-started/introduction">
              Read the documentation →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title={siteConfig.title}
      description="Reliable, Explainable, and Scalable workflow engine">
      <HomepageHeader />
      <main>
        <FeaturesSection />
        <WorkflowExampleSection />
        <IntroVideoSection />
      </main>
    </Layout>
  );
}
