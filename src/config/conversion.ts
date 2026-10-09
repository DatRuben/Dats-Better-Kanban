const rawBlendConverterUrl =
  import.meta.env
    .VITE_BLEND_CONVERTER_URL

export const BLEND_CONVERTER_URL =
  typeof rawBlendConverterUrl ===
    'string'
    ? rawBlendConverterUrl.trim()
    : ''

export const isBlendConverterConfigured =
  BLEND_CONVERTER_URL.length > 0