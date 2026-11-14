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
        Os prazos, os custos e as indicações dos passos foram confirmados a 14/11/2026 por pesquisa
        do Claude, assistente de inteligência artificial da Anthropic, nas leis (Diário da
        República) e nos sites oficiais (gov.pt, Segurança Social, Caixa Geral de Aposentações,
        Portal das Finanças, Banco de Portugal, ASF e IRN). As fontes de cada prazo estão em «De
        onde vêm estas datas» e as de cada passo nas ligações do próprio passo, na página de cada
        processo.
      </p>
    </div>
  );
}
