import { ExperimentOutlined, GlobalOutlined, TeamOutlined } from '@ant-design/icons'
import { Alert, Card, Collapse, Space, Tag, Typography } from 'antd'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

const { Paragraph, Title } = Typography

export function AboutPage() {
  const { t } = useTranslation()

  const faq = [
    { key: '1', label: t('about.faq1q'), children: <p>{t('about.faq1a')}</p> },
    { key: '2', label: t('about.faq2q'), children: <p>{t('about.faq2a')}</p> },
    { key: '3', label: t('about.faq3q'), children: <p>{t('about.faq3a')}</p> },
    { key: '4', label: t('about.faq4q'), children: <p>{t('about.faq4a')}</p> },
    { key: '5', label: t('about.faq5q'), children: <p>{t('about.faq5a')}</p> },
  ]

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-5">
      <Title level={1} className="!mb-2 !text-3xl sm:!text-4xl">
        {t('about.title')}
      </Title>
      <Paragraph className="!text-lg !text-[var(--mz-muted)]">{t('about.lead')}</Paragraph>

      <Space wrap className="!mb-6">
        <Tag color="green">{t('hero.sdg13')}</Tag>
        <Tag color="blue">{t('hero.sdg66')}</Tag>
        <Tag>{t('common.openData')}</Tag>
        <Tag>{t('common.noAccount')}</Tag>
      </Space>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="!rounded-2xl !border-[var(--mz-line)]" title={t('about.problemTitle')}>
          <Paragraph className="!mb-0">{t('about.problem')}</Paragraph>
        </Card>
        <Card className="!rounded-2xl !border-[var(--mz-line)]" title={t('about.missionTitle')}>
          <Paragraph className="!mb-0">{t('about.mission')}</Paragraph>
        </Card>
      </div>

      <Card className="!mt-4 !rounded-2xl !border-[var(--mz-line)]" title={t('about.scienceTitle')}>
        <Paragraph className="!mb-2">{t('about.science')}</Paragraph>
        <Alert type="warning" showIcon title={t('sidebar.disclaimerTitle')} description={t('sidebar.disclaimer')} />
      </Card>

      <Title level={2} className="!mb-3 !mt-8 !text-2xl">
        {t('about.sdgTitle')}
      </Title>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="!rounded-2xl !border-[var(--mz-line)]">
          <Tag color="green">{t('about.sdg13title')}</Tag>
          <Paragraph className="!mb-0 !mt-2">{t('about.sdg13body')}</Paragraph>
        </Card>
        <Card className="!rounded-2xl !border-[var(--mz-line)]">
          <Tag color="blue">{t('about.sdg66title')}</Tag>
          <Paragraph className="!mb-0 !mt-2">{t('about.sdg66body')}</Paragraph>
        </Card>
      </div>

      <Card className="!mt-4 !rounded-2xl !border-[var(--mz-line)]" title={t('about.dpgTitle')}>
        <Paragraph className="!mb-2">{t('about.dpgBody')}</Paragraph>
        <Space wrap>
          <Tag icon={<GlobalOutlined />}>{t('common.openData')}</Tag>
          <Tag icon={<ExperimentOutlined />}>{t('common.license')}</Tag>
          <Tag icon={<TeamOutlined />}>{t('common.noAccount')}</Tag>
        </Space>
      </Card>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card className="!rounded-2xl !border-[var(--mz-line)]" title={t('about.openTitle')}>
          <Paragraph className="!mb-0">{t('about.openBody')}</Paragraph>
        </Card>
        <Card className="!rounded-2xl !border-[var(--mz-line)]" title={t('about.usersTitle')}>
          <Paragraph className="!mb-0">{t('about.usersBody')}</Paragraph>
        </Card>
      </div>

      <Title level={2} className="!mb-3 !mt-8 !text-2xl">
        {t('about.faqTitle')}
      </Title>
      <Collapse items={faq} />

      <Card className="!mt-6 !rounded-2xl !border-[var(--mz-line)]" title={t('about.contactTitle')}>
        <Paragraph>{t('about.contactBody')}</Paragraph>
        <Space wrap>
          <Link to="/contribute">{t('nav.contribute')}</Link>
          <Link to="/data">{t('nav.data')}</Link>
          <Link to="/ethics">{t('nav.ethics')}</Link>
        </Space>
      </Card>
    </div>
  )
}
