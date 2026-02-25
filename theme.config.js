/** @type {const} */
// Cores baseadas na identidade visual CGS Agrícola
// Verde: #3DB84B (folha + texto "AGRÍCOLA")
// Amarelo/dourado: #F5C842 (sol)
// Marrom escuro: #3D2F2A (texto "CGS")
const themeColors = {
  primary:    { light: '#3DB84B', dark: '#4DCB5C' },   // Verde CGS
  background: { light: '#F7FAF7', dark: '#0F1A0F' },   // Fundo levemente esverdeado
  surface:    { light: '#FFFFFF', dark: '#1A2B1A' },   // Cards/superfícies
  foreground: { light: '#3D2F2A', dark: '#F1F5F9' },   // Texto principal (marrom CGS)
  muted:      { light: '#6B7B6B', dark: '#94A89A' },   // Texto secundário
  border:     { light: '#D4E8D4', dark: '#2A3D2A' },   // Bordas esverdeadas
  success:    { light: '#2E9E3A', dark: '#3DB84B' },   // Sucesso (verde escuro)
  warning:    { light: '#C9A000', dark: '#F5C842' },   // Aviso (amarelo CGS)
  error:      { light: '#DC2626', dark: '#EF4444' },   // Erro (vermelho padrão)
  tint:       { light: '#3DB84B', dark: '#4DCB5C' },   // Tint (alias de primary)
};

module.exports = { themeColors };
