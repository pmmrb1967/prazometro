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
      <p>
        Os prazos foram confirmados a 14/11/2026 por pesquisa do Claude, assistente de inteligência
        artificial da Anthropic, nas leis (Diário da República) e nos sites oficiais (gov.pt,
        Segurança Social, Caixa Geral de Aposentações, Portal das Finanças). As fontes de cada
        prazo, com ligação, estão em «De onde vêm estas datas», na página de cada processo.
      </p>
    </div>
  );
}
