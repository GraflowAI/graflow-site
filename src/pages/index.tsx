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
const workflowExample = `@task(inject_context=True)
def extract(ctx: TaskExecutionContext): ...

@task
def filter_pass(data): ...

@task
def assign_grade(data): ...

@task
def load(data): ...

with workflow("hello_etl") as wf:
    _ = extract >> (filter_pass | assign_grade).set_group_name("transforms") >> load
    wf.execute("extract")`;

function Feature({
  title,
  description,
}: {
  title: string;
  description: ReactNode;
}) {
  return (
    <div className={clsx('col col--4', styles.feature)}>
      <Heading as='h3'>{title}</Heading>
      <p>{description}</p>
    </div>
  );
}

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--dark', styles.heroBanner)}>
      <div className='container'>
        <Heading as='h1' className='hero__title'>
          {siteConfig.title}
        </Heading>
        <p className='hero__subtitle'>
          Build <strong>reliable</strong>, <strong>explainable</strong>, and{' '}
          <strong>scalable</strong> workflows with ease.
        </p>
        <div className={styles.buttons}>
          <Link
            className='button button--secondary button--lg'
            to='/docs/getting-started/introduction'
          >
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
      <div className='container'>
        <div className='row'>
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
      <div className='container'>
        <div className='row'>
          <div className={clsx('col col--6')}>
            <Heading as='h2'>Define Your Workflow</Heading>
            <p>Intuitive Python DSLs let you define complex data pipelines.</p>
            <CodeBlock language='python'>{workflowExample}</CodeBlock>
            <div className={styles.badgeRow}>
              <a
                href='https://colab.research.google.com/github/GraflowAI/graflow-examples/blob/main/examples/notebooks/simple_etl.ipynb'
                target='_blank'
                rel='noopener noreferrer'
              >
                <img
                  src='https://colab.research.google.com/assets/colab-badge.svg'
                  alt='Open In Colab'
                />
              </a>
            </div>
            <a
              className={styles.seeMoreLink}
              href='https://github.com/GraflowAI/graflow/tree/main/examples'
              target='_blank'
              rel='noopener noreferrer'
            >
              See more examples →
            </a>
          </div>
          <div className={clsx('col col--6', styles.videoContainer)}>
            <Heading as='h2'>Learn More About Graflow</Heading>
            <div className={styles.youtubeWrapper}>
              <iframe
                className={styles.youtubeEmbed}
                src='https://www.youtube.com/embed/OkJlpmdCCAg'
                title='Graflow Introduction'
                allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
                allowFullScreen
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function WhyGraflowSection() {
  return (
    <section className={styles.introVideoSection}>
      <div className='container'>
        <div className={clsx('col col--8', styles.introDescription)}>
          <Heading as='h2'>Why Graflow?</Heading>
          <p>
            Graflow is designed to simplify complex data workflows while
            providing full transparency and reliability at scale.
          </p>
          <ul>
            <li>Intuitive Python API for workflow definitions</li>
            <li>Built-in monitoring and observability</li>
            <li>Seamless integration with existing tools</li>
            <li>Production-ready from day one</li>
          </ul>
          <Link
            className={styles.seeMoreLink}
            to='/docs/getting-started/introduction'
          >
            Read the documentation →
          </Link>
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
      description='Reliable, Explainable, and Scalable workflow engine'
    >
      <HomepageHeader />
      <main>
        <FeaturesSection />
        <WorkflowExampleSection />
        <WhyGraflowSection />
      </main>
    </Layout>
  );
}
