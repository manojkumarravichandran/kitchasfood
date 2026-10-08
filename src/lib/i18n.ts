import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

// English is the complete reference set. Tamil/Hindi are intentionally left as TODO
// stubs here rather than guessed-at translations — fill them in incrementally per
// the working agreement (never invent content, including translations, silently).
const resources = {
  en: {
    translation: {
      nav: { menu: 'Menu', subscriptions: 'Subscriptions', preorder: 'Pre-order', catering: 'Catering' },
      common: { login: 'Login', signOut: 'Sign out', loading: 'Loading…' },
    },
  },
  ta: { translation: {} },
  hi: { translation: {} },
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  })

export default i18n
