// Paleta y tipografía tomadas de las capturas de Emergent (docs/diseno/).

export const colors = {
  bg: '#111216',          // fondo casi negro
  card: '#1A1D24',        // tarjetas
  cardRaised: '#22262F',  // inputs, chips, hoja inferior
  border: '#262A33',
  text: '#FFFFFF',
  textMuted: '#8A8F98',
  textFaint: '#5C616B',
  accent: '#D9603B',      // naranja
  accentSoft: 'rgba(217, 96, 59, 0.15)',
  success: '#3BA55C',     // check de hecho
  danger: '#E5534B',
  free: '#3A4150',        // «Tiempo libre» (trazo discontinuo)
} as const;

export const fonts = {
  // Títulos condensados (fecha, «Rutina base», horas de la línea de tiempo)
  display: 'BarlowCondensed_700Bold',
  displaySemi: 'BarlowCondensed_600SemiBold',
  // Texto normal
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;
