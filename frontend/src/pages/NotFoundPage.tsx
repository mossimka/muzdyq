import { Button, Result } from 'antd'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

export function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <Result
      status="404"
      title={t('notFound.title')}
      subTitle={t('notFound.body')}
      extra={
        <Link to="/">
          <Button type="primary" size="large">
            {t('notFound.home')}
          </Button>
        </Link>
      }
    />
  )
}
