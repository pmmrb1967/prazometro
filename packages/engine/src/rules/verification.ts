import { addMonths, type IsoDate } from '../date';

// Princípio 4: regras com mais de 6 meses sem verificação aparecem como "a verificar".
export const VERIFICATION_MAX_MONTHS = 6;

export type VerificationStatus = 'verificada' | 'a_verificar' | 'a_rever';

export function verificationStatus(
  rule: { verificado_em: IsoDate; estado: 'publicada' | 'a_rever' },
  today: IsoDate,
): VerificationStatus {
  if (rule.estado === 'a_rever') return 'a_rever';
  return today > addMonths(rule.verificado_em, VERIFICATION_MAX_MONTHS)
    ? 'a_verificar'
    : 'verificada';
}
