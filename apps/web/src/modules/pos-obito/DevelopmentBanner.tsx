/**
 * Aviso permanente enquanto o módulo não tiver revisão jurídica (CLAUDE.md: não divulgar o
 * pós-óbito sem essa revisão). Sai quando as regras passarem a "publicada".
 */
export function DevelopmentBanner() {
  return (
    <div className="notice" role="note">
      <p>
        <strong>Em desenvolvimento.</strong> Este conteúdo ainda não foi revisto por um jurista.
        Confirme os prazos junto das entidades (Finanças, Segurança Social, conservatória) antes de
        decidir.
      </p>
    </div>
  );
}
