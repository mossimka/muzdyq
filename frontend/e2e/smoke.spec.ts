import { expect, test } from '@playwright/test'

const photoSvg = (label: string, color: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
      <rect width="640" height="480" fill="${color}"/>
      <circle cx="520" cy="90" r="46" fill="#fbbf24"/>
      <path d="M0 420 180 170l90 140 60-80 150 190Z" fill="#0b4f4a"/>
      <path d="M0 460 240 220l90 120 80-60 170 180Z" fill="#dff4ef"/>
      <text x="24" y="452" font-family="sans-serif" font-size="30" fill="#071613">${label}</text>
    </svg>`,
  )}`

const PHOTOS = [
  {
    id: 'photo-2021',
    point_id: 1,
    point_slug: 'tuyuksu-glacier',
    viewpoint_id: 'tuyuksu-glacier-v1',
    taken_at: '2021-07-03T08:00:00Z',
    uploaded_at: '2021-07-04T08:00:00Z',
    width: 1600,
    height: 1200,
    bytes: 180000,
    license: 'CC-BY-4.0',
    tags: { weather: 'clear', snow_cover: 'partial' },
    is_demo: false,
    url: photoSvg('2021', '#204a63'),
    thumb_url: photoSvg('2021', '#204a63'),
    download_url: photoSvg('2021', '#204a63'),
  },
  {
    id: 'photo-2025',
    point_id: 1,
    point_slug: 'tuyuksu-glacier',
    viewpoint_id: 'tuyuksu-glacier-v1',
    taken_at: '2025-08-11T08:00:00Z',
    uploaded_at: '2025-08-12T08:00:00Z',
    width: 1600,
    height: 1200,
    bytes: 170000,
    license: 'CC-BY-4.0',
    tags: { weather: 'partly_cloudy', visibility: 'good' },
    is_demo: false,
    url: photoSvg('2025', '#3c5f52'),
    thumb_url: photoSvg('2025', '#3c5f52'),
    download_url: photoSvg('2025', '#3c5f52'),
  },
]

const POINTS = [
  {
    id: 1,
    slug: 'tuyuksu-glacier',
    type: 'glacier',
    name_i18n: {
      en: 'Tuyuksu Glacier',
      ru: 'Ледник Туюксу',
      kk: 'Тұйықсу мұздығы',
    },
    description_i18n: {
      en: 'A reference view toward the Tuyuksu glacier tongue.',
      ru: 'Контрольный вид на язык ледника Туюксу.',
      kk: 'Тұйықсу мұздық тіліне бақылау көрінісі.',
    },
    safety_note_i18n: {
      en: 'Stay on the marked trail.',
      ru: 'Оставайтесь на отмеченной тропе.',
      kk: 'Белгіленген соқпақта қалыңыз.',
    },
    lat: 43.0417,
    lon: 77.0792,
    elevation_m: 3450,
    coords_verified: false,
    viewpoints: [
      {
        id: 'tuyuksu-glacier-v1',
        heading_deg: 178,
        note_i18n: { en: 'Stand at the marked rock ledge.' },
        reference_photo_url: photoSvg('reference', '#294b42'),
      },
    ],
    photo_count: 2,
    latest_photo_at: '2025-08-11T08:00:00Z',
    latest_thumb_url: photoSvg('2025', '#3c5f52'),
    demo: false,
  },
  {
    id: 2,
    slug: 'big-almaty-lake',
    type: 'water',
    name_i18n: {
      en: 'Big Almaty Lake',
      ru: 'Большое Алматинское озеро',
      kk: 'Үлкен Алматы көлі',
    },
    description_i18n: { en: 'A glacier-fed lake above Almaty.' },
    safety_note_i18n: { en: 'Do not approach the water edge.' },
    lat: 43.0506,
    lon: 76.9855,
    elevation_m: 2511,
    coords_verified: false,
    viewpoints: [],
    photo_count: 0,
    latest_photo_at: null,
    latest_thumb_url: null,
    demo: false,
  },
]

test('map, point panel and language switcher work at phone and desktop widths', async ({
  page,
}) => {
  await page.route('**/api/points', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(POINTS),
    })
  })
  await page.route(/\/api\/points\/[^/]+\/photos/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: PHOTOS, next_cursor: null }),
    })
  })

  await page.goto('/')

  await expect(page.getByRole('heading', { name: /mountains are changing/i })).toBeVisible()
  await expect(page.getByTestId('point-card')).toHaveCount(2)

  await page
    .getByTestId('point-card')
    .filter({ hasText: 'Tuyuksu Glacier' })
    .click()

  await expect(page.getByRole('heading', { name: 'Photo series' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Before / after' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Timelapse' })).toBeVisible()
  await expect(page.getByRole('button', { name: /add photo from this viewpoint/i })).toBeVisible()
  await expect(page.getByText(/observations, not measurements/i).first()).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { name: 'Photo series' })).toBeHidden()

  await page.getByTestId('lang-select').click()
  await page.getByTitle('Русский').click()
  await expect(page.getByRole('heading', { name: 'Точки наблюдения' })).toBeVisible()

  await page.getByRole('button', { name: 'Открыть меню' }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
})
