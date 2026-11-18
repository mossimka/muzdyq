import {
  EyeInvisibleOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { Alert, Card, Space, Tag, Typography } from 'antd'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

const { Paragraph, Text, Title } = Typography

export function EthicsPage() {
  const { t } = useTranslation()

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-5">
      <Title level={1} className="!mb-2 !text-3xl sm:!text-4xl">
        {t('ethics.title')}
      </Title>
      <Paragraph className="!text-lg !text-[var(--mz-muted)]">{t('ethics.lead')}</Paragraph>
      <Space wrap className="!mb-6">
        <Tag icon={<SafetyCertificateOutlined />} color="green">
          {t('ethics.safetyTitle')}
        </Tag>
        <Tag icon={<EyeInvisibleOutlined />}>{t('ethics.privacyTitle')}</Tag>
        <Tag icon={<LockOutlined />}>{t('common.noAccount')}</Tag>
        <Tag icon={<TeamOutlined />}>{t('common.privacy')}</Tag>
      </Space>

      <Title level={2} className="!mb-3 !text-2xl">
        {t('ethics.principlesTitle')}
      </Title>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="!rounded-2xl !border-[var(--mz-line)]" title={t('ethics.safetyTitle')}>
          <Paragraph className="!mb-0">{t('ethics.safetyBody')}</Paragraph>
        </Card>
        <Card className="!rounded-2xl !border-[var(--mz-line)]" title={t('ethics.noGamificationTitle')}>
          <Paragraph className="!mb-0">{t('ethics.noGamificationBody')}</Paragraph>
        </Card>
        <Card className="!rounded-2xl !border-[var(--mz-line)]" title={t('ethics.doNoHarmTitle')}>
          <Paragraph className="!mb-0">{t('ethics.doNoHarmBody')}</Paragraph>
        </Card>
        <Card className="!rounded-2xl !border-[var(--mz-line)]" title={t('ethics.accessibilityTitle')}>
          <Paragraph className="!mb-0">{t('ethics.accessibilityBody')}</Paragraph>
        </Card>
      </div>

      <Card
        id="privacy"
        className="!mt-6 !rounded-2xl !border-[var(--mz-line)]"
        title={t('ethics.privacyTitle')}
        extra={<Text className="!text-xs !text-[var(--mz-muted)]">{t('ethics.privacyUpdated')}</Text>}
      >
        <Title level={4} className="!mb-2 !text-base">
          {t('ethics.collectedTitle')}
        </Title>
        <Paragraph>{t('ethics.collected')}</Paragraph>
        <Title level={4} className="!mb-2 !text-base">
          {t('ethics.notCollectedTitle')}
        </Title>
        <Paragraph>{t('ethics.notCollected')}</Paragraph>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Title level={4} className="!mb-2 !text-base">
              {t('ethics.exifTitle')}
            </Title>
            <Paragraph className="!mb-0 !text-sm">{t('ethics.exifBody')}</Paragraph>
          </div>
          <div>
            <Title level={4} className="!mb-2 !text-base">
              {t('ethics.faceTitle')}
            </Title>
            <Paragraph className="!mb-0 !text-sm">{t('ethics.faceBody')}</Paragraph>
          </div>
          <div>
            <Title level={4} className="!mb-2 !text-base">
              {t('ethics.analyticsTitle')}
            </Title>
            <Paragraph className="!mb-0 !text-sm">{t('ethics.analyticsBody')}</Paragraph>
          </div>
          <div>
            <Title level={4} className="!mb-2 !text-base">
              {t('ethics.retentionTitle')}
            </Title>
            <Paragraph className="!mb-0 !text-sm">{t('ethics.retentionBody')}</Paragraph>
          </div>
        </div>
        <Alert
          className="!mt-4"
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          title={t('ethics.moderationTitle')}
          description={t('ethics.moderationBody')}
        />
        <Alert
          className="!mt-3"
          type="info"
          showIcon
          title={t('ethics.contactTitle')}
          description={t('ethics.contactBody')}
        />
        <Paragraph className="!mb-0 !mt-4 !text-sm">
          <Text code>docs/ETHICS.md</Text> · <Link to="/data">{t('footer.data')}</Link>
        </Paragraph>
      </Card>

      <Alert
        className="!mt-6"
        type="warning"
        showIcon
        icon={<SafetyCertificateOutlined />}
        title={t('contribute.safetyTitle')}
        description={t('contribute.safetyBody')}
      />
    </div>
  )
}
