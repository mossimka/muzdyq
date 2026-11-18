import { DownloadOutlined, FileTextOutlined, LinkOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Card, Space, Table, Tag, Typography } from 'antd'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { exportUrl, getHealth } from '../lib/api'
import type { ExportKind } from '../lib/types'

const { Paragraph, Text, Title } = Typography

interface EndpointRow {
  key: string
  method: string
  path: string
  description: string
}

interface SchemaRow {
  key: string
  field: string
  type: string
  notes: string
}

const DOWNLOADS: Array<{ kind: ExportKind; labelKey: string; description: string }> = [
  { kind: 'csv', labelKey: 'sidebar.csv', description: 'CSV' },
  { kind: 'geojson', labelKey: 'sidebar.geojson', description: 'GeoJSON' },
  { kind: 'json', labelKey: 'sidebar.json', description: 'JSON' },
  { kind: 'zip', labelKey: 'sidebar.zip', description: 'ZIP' },
]

const SCHEMA_FIELDS = [
  'id',
  'point_slug',
  'taken_at',
  'uploaded_at',
  'width_height',
  'bytes',
  'license',
  'tags',
  'phash',
  'url',
  'coordinates',
] as const

export function DataPage() {
  const { t } = useTranslation()
  const health = useQuery({ queryKey: ['health'], queryFn: ({ signal }) => getHealth(signal), retry: false })
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://muzdyq.example'

  const endpoints: EndpointRow[] = [
    { key: 'points', method: 'GET', path: '/api/points', description: t('data.endpoints.listPoints') },
    { key: 'point', method: 'GET', path: '/api/points/{slug}', description: t('data.endpoints.getPoint') },
    { key: 'photos', method: 'GET', path: '/api/points/{slug}/photos', description: t('data.endpoints.listPhotos') },
    { key: 'upload', method: 'POST', path: '/api/points/{slug}/photos', description: t('data.endpoints.upload') },
    { key: 'csv', method: 'GET', path: '/api/export/photos.csv', description: t('data.endpoints.exportCsv') },
    { key: 'geojson', method: 'GET', path: '/api/export/photos.geojson', description: t('data.endpoints.exportGeoJson') },
    { key: 'json', method: 'GET', path: '/api/export/photos.json', description: t('data.endpoints.exportJson') },
    { key: 'zip', method: 'GET', path: '/api/export/photos.zip', description: t('data.endpoints.exportZip') },
    { key: 'health', method: 'GET', path: '/api/health', description: t('data.endpoints.health') },
    { key: 'docs', method: 'GET', path: '/docs', description: t('data.endpoints.docs') },
  ]

  const schema: SchemaRow[] = SCHEMA_FIELDS.map((field) => ({
    key: field,
    field,
    type: t(`data.field.${field}`),
    notes: t(`data.notes.${field}`),
  }))

  const curl = `# Point metadata and photo series
curl -s ${origin}/api/points/tuyuksu-glacier | jq
curl -s "${origin}/api/points/tuyuksu-glacier/photos?year=2025" | jq

# Open data exports (no key, no account)
curl -L -o muzdyq-photos.zip ${origin}/api/export/photos.zip
curl -s ${origin}/api/export/photos.geojson | jq '.features | length'

# Anonymous upload; the client UUID makes retries safe
curl -X POST ${origin}/api/points/tuyuksu-glacier/photos \\
  -F "file=@photo.jpg" \\
  -F "viewpoint_id=tuyuksu-glacier-v1" \\
  -F "taken_at=2026-07-01T09:00:00Z" \\
  -F "client_uuid=$(uuidgen)" \\
  -F 'tags={"weather":"clear","snow_cover":"partial"}'`

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-5">
      <Title level={1} className="!mb-2 !text-3xl sm:!text-4xl">
        {t('data.title')}
      </Title>
      <Paragraph className="!text-lg !text-[var(--mz-muted)]">{t('data.lead')}</Paragraph>

      <Alert
        className="!mb-6"
        type="success"
        showIcon
        title={t('data.licenseTitle')}
        description={t('data.licenseBody')}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="!rounded-2xl !border-[var(--mz-line)]" title={t('data.downloadsTitle')}>
          <Paragraph className="!text-sm !text-[var(--mz-muted)]">{t('data.downloadsBody')}</Paragraph>
          <Space wrap>
            {DOWNLOADS.map((item) => (
              <Button
                key={item.kind}
                icon={<DownloadOutlined />}
                onClick={() => {
                  window.location.href = exportUrl(item.kind)
                }}
              >
                {t(item.labelKey)}
              </Button>
            ))}
          </Space>
        </Card>
        <Card className="!rounded-2xl !border-[var(--mz-line)]" title={t('data.attributionTitle')}>
          <Paragraph className="!mb-0 !text-sm">{t('data.attributionBody')}</Paragraph>
        </Card>
      </div>

      <Card className="!mt-4 !rounded-2xl !border-[var(--mz-line)]" title={t('data.apiTitle')}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Tag color="green">{t('data.noAuth')}</Tag>
          <Tag>{t('data.rateLimit')}</Tag>
          {health.data ? (
            <Tag color={health.data.status === 'ok' ? 'green' : 'orange'}>
              {health.data.status} · v{health.data.version}
            </Tag>
          ) : null}
          <a href="/docs" target="_blank" rel="noreferrer" className="text-sm font-semibold">
            <LinkOutlined aria-hidden="true" className="mr-1" />
            {t('data.docsLink')}
          </a>
        </div>
        <Paragraph className="!text-sm !text-[var(--mz-muted)]">{t('data.apiBody')}</Paragraph>
        <Table<EndpointRow>
          size="small"
          pagination={false}
          scroll={{ x: 640 }}
          dataSource={endpoints}
          columns={[
            {
              title: t('data.method'),
              dataIndex: 'method',
              width: 86,
              render: (method: string) => (
                <Tag color={method === 'POST' ? 'orange' : 'blue'} className="!m-0">
                  {method}
                </Tag>
              ),
            },
            {
              title: t('data.endpoint'),
              dataIndex: 'path',
              render: (path: string) => <Text code>{path}</Text>,
            },
            { title: t('data.description'), dataIndex: 'description' },
          ]}
        />
      </Card>

      <Card className="!mt-4 !rounded-2xl !border-[var(--mz-line)]" title={t('data.curlTitle')}>
        <pre className="mz-code !m-0">{curl}</pre>
      </Card>

      <Card className="!mt-4 !rounded-2xl !border-[var(--mz-line)]" title={t('data.schemaTitle')}>
        <Paragraph className="!text-sm !text-[var(--mz-muted)]">{t('data.schemaBody')}</Paragraph>
        <Table<SchemaRow>
          size="small"
          pagination={false}
          scroll={{ x: 640 }}
          dataSource={schema}
          columns={[
            {
              title: t('data.schemaField'),
              dataIndex: 'field',
              width: 150,
              render: (field: string) => <Text code>{field}</Text>,
            },
            { title: t('data.schemaType'), dataIndex: 'type', width: 140 },
            { title: t('data.schemaNotes'), dataIndex: 'notes' },
          ]}
        />
      </Card>

      <Card className="!mt-4 !rounded-2xl !border-[var(--mz-line)]" title={t('data.scienceTitle')}>
        <Paragraph>{t('data.scienceBody')}</Paragraph>
        <Paragraph className="!mb-0">
          <FileTextOutlined aria-hidden="true" className="mr-2" />
          <Link to="/ethics">{t('nav.ethics')}</Link>
        </Paragraph>
      </Card>

      <Alert
        className="!mt-4"
        type="info"
        showIcon
        title={t('data.contactTitle')}
        description={t('data.contactBody')}
      />
    </div>
  )
}
