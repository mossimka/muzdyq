import {
  CloudUploadOutlined,
  DeleteOutlined,
  DisconnectOutlined,
  PictureOutlined,
  ReloadOutlined,
  SyncOutlined,
} from '@ant-design/icons'
import {
  Alert,
  Button,
  Card,
  Empty,
  List,
  Popconfirm,
  Progress,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { useSettings } from '../context/SettingsContext'
import { formatBytes, formatDateLong } from '../lib/format'
import { useOnlineStatus } from '../lib/network'
import { removeQueueItem } from '../lib/queue'
import { syncQueue } from '../lib/sync'
import type { QueueItem } from '../lib/types'
import { useQueue } from '../lib/useQueue'

const { Paragraph, Title } = Typography

function QueueThumbnail({ item }: { item: QueueItem }) {
  const url = useMemo(() => (item.thumb ? URL.createObjectURL(item.thumb) : null), [item.thumb])
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [url])

  if (!url) {
    return (
      <div className="grid h-16 w-20 place-items-center rounded-lg bg-[var(--mz-surface-2)] text-xl text-[var(--mz-muted)]">
        <PictureOutlined aria-hidden="true" />
      </div>
    )
  }
  return (
    <img
      src={url}
      alt=""
      className="h-16 w-20 rounded-lg object-cover"
      width={80}
      height={64}
    />
  )
}

function StatusTag({ item }: { item: QueueItem }) {
  const { t } = useTranslation()
  if (item.status === 'uploading') {
    return (
      <Tag color="processing" icon={<SyncOutlined spin />}>
        {t('queue.uploading')}
      </Tag>
    )
  }
  if (item.status === 'failed') {
    return <Tag color="error">{t('queue.failed')}</Tag>
  }
  return <Tag color="default">{t('queue.pending')}</Tag>
}

export function QueuePage() {
  const { t } = useTranslation()
  const { locale } = useSettings()
  const online = useOnlineStatus()
  const queue = useQueue()
  const [syncing, setSyncing] = useState(false)

  const runSync = async (force = false, ids?: string[]) => {
    setSyncing(true)
    try {
      await syncQueue({ force, ids })
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-7 sm:px-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Title level={1} className="!mb-1 !text-2xl sm:!text-3xl">
            {t('queue.title')}
          </Title>
          <Paragraph className="!mb-0 !text-sm !text-[var(--mz-muted)]">
            {t('queue.savedCount', { count: queue.items.length })} · {t('queue.storageNote')}
          </Paragraph>
        </div>
        <Space wrap>
          <Button
            type="primary"
            icon={<CloudUploadOutlined />}
            loading={syncing}
            disabled={!online || !queue.items.length}
            onClick={() => void runSync(true)}
          >
            {t('queue.syncNow')}
          </Button>
          <Link to="/">
            <Button>{t('capture.backToMap')}</Button>
          </Link>
        </Space>
      </div>

      {!online ? (
        <Alert
          className="!mb-4"
          type="warning"
          showIcon
          icon={<DisconnectOutlined />}
          title={t('common.offline')}
          description={t('map.offlineOnly')}
        />
      ) : null}

      {queue.failed > 0 ? (
        <Alert
          className="!mb-4"
          type="error"
          showIcon
          title={t('queue.failedCount', { count: queue.failed })}
          description={t('queue.offlineNote')}
        />
      ) : null}

      {queue.loading ? (
        <div className="grid place-items-center py-16">
          <Spin size="large" />
        </div>
      ) : !queue.items.length ? (
        <Card className="!rounded-2xl !border-[var(--mz-line)]">
          <Empty description={t('queue.empty')}>
            <Link to="/">
              <Button type="primary">{t('capture.backToMap')}</Button>
            </Link>
          </Empty>
        </Card>
      ) : (
        <List
          dataSource={queue.items}
          rowKey={(item) => item.id}
          renderItem={(item) => (
            <List.Item className="!items-start">
              <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-start">
                <QueueThumbnail item={item} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold">{item.pointName}</span>
                    <StatusTag item={item} />
                  </div>
                  <p className="mt-1 text-xs text-[var(--mz-muted)]">
                    {t('queue.itemMeta', {
                      date: formatDateLong(item.takenAt, locale),
                      kb: Math.round(item.bytes / 1024),
                      attempts: item.attempts,
                    })}
                  </p>
                  {item.lastError ? (
                    <p className="mt-1 text-xs font-semibold text-[var(--mz-danger)]">
                      {t('queue.failedReason', { reason: item.lastError })}
                    </p>
                  ) : null}
                  {item.status === 'uploading' ? (
                    <Progress className="!mt-1 !mb-0" percent={100} status="active" showInfo={false} size="small" />
                  ) : null}
                </div>
                <Space wrap>
                  <Button
                    size="small"
                    icon={<ReloadOutlined />}
                    disabled={!online}
                    onClick={() => void runSync(true, [item.id])}
                  >
                    {t('queue.retry')}
                  </Button>
                  <Popconfirm
                    title={t('queue.removeConfirm')}
                    okText={t('queue.remove')}
                    cancelText={t('common.cancel')}
                    onConfirm={() => void removeQueueItem(item.id)}
                  >
                    <Button size="small" danger icon={<DeleteOutlined />}>
                      {t('queue.remove')}
                    </Button>
                  </Popconfirm>
                </Space>
              </div>
            </List.Item>
          )}
        />
      )}

      <Alert
        className="!mt-4"
        type="info"
        showIcon
        title={t('queue.offlineNote')}
        description={`${t('queue.storageNote')} · ${formatBytes(
          queue.items.reduce((sum, item) => sum + item.bytes, 0),
        )}`}
      />
    </div>
  )
}
