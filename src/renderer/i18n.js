import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import enTranslation from '../locales/en/translation.json'
import viTranslation from '../locales/vi/translation.json'
import jaTranslation from '../locales/ja/translation.json'

const resources = {
  en: { translation: enTranslation },
  vi: { translation: viTranslation },
  ja: { translation: jaTranslation }
}

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en', // Default, will be updated via settings
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  })

export default i18n
