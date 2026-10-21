import { formatDateShort, todayInLisbon } from '@prazometro/engine';
import { LegalNotice } from '../components/LegalNotice';
import type { Purchase, WaitRequest } from '../db';
import { letterDeadline } from '../modules/cartas/rules';
import { GARANTIA_RULES } from '../modules/garantia/rules';
import { warrantyStatus } from '../modules/garantia/warranty';
import { SNS_RULES } from '../modules/sns/rules';
import { waitStatus } from '../modules/sns/waiting';
import { Link, usePageHeading } from '../router';

// Página de apresentação. As datas dos exemplos são calculadas na hora pelo motor, com as
// regras reais: nunca escritas à mão.

const PURCHASE: Purchase = {
  id: 'exemplo',
  produto: 'Máquina de lavar roupa',
  loja: 'Loja de eletrodomésticos',
  data_compra: '2025-03-10',
  data_entrega: '2025-03-12',
  estado: 'novo',
  tipo_vendedor: 'profissional',
  uso: 'pessoal',
  criado_em: '2025-03-12',
};

const REQUEST: WaitRequest = {
  id: 'exemplo',
  tipo: 'consulta_hospitalar',
  descricao: 'Primeira consulta de Ortopedia',
  area: 'geral',
  prioridade: 'normal',
  data_pedido: '2026-06-01',
  criado_em: '2026-06-01',
};

function Example({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li>
      <h3>{title}</h3>
      {children}
    </li>
  );
}

export function About() {
  const heading = usePageHeading<HTMLHeadingElement>('Como funciona');
  const today = todayInLisbon();
  const garantia = warrantyStatus(PURCHASE, GARANTIA_RULES, today).fim;
  const sns = waitStatus(REQUEST, SNS_RULES, today).prazo;
  const multa = letterDeadline(
    { tipo: 'contraordenacao_transito', data_carta: '2026-12-01' },
    today,
  )?.result.prazo;

  return (
    <>
      <nav className="crumbs" aria-label="Caminho">
        <Link to="/">Início</Link>
      </nav>
      <h1 ref={heading} tabIndex={-1}>
        Como funciona
      </h1>
      <p className="lead">
        O Prazómetro diz-lhe até quando pode agir e o que fazer, em palavras simples. É gratuito,
        não tem publicidade e não precisa de conta.
      </p>

      <section aria-labelledby="exemplos">
        <h2 id="exemplos">Três exemplos</h2>
        <ul className="cards">
          <Example title="A máquina de lavar avariou">
            <p>
              Comprou-a numa loja a 10/03/2025 e foi entregue a 12/03/2025. A garantia legal de 3
              anos dura até <strong>{garantia ? formatDateShort(garantia) : '—'}</strong>. A app
              avisa antes do fim e prepara a carta de reclamação para a loja.
            </p>
          </Example>
          <Example title="Há meses à espera de uma consulta no hospital">
            <p>
              O centro de saúde pediu uma primeira consulta de Ortopedia a 01/06/2026, com
              prioridade normal. O tempo máximo garantido acaba a{' '}
              <strong>{sns ? formatDateShort(sns) : '—'}</strong>. Se passar, a app prepara a
              reclamação.
            </p>
          </Example>
          <Example title="Chegou uma multa de trânsito">
            <p>
              Notificado a 01/12/2026, tem até{' '}
              <strong>{multa ? formatDateShort(multa) : '—'}</strong> para pagar ou apresentar
              defesa: são 15 dias úteis, sem contar fins de semana nem o feriado de 8 de dezembro.
              Basta fotografar a carta.
            </p>
          </Example>
        </ul>
      </section>

      <section aria-labelledby="principios">
        <h2 id="principios">O que pode esperar</h2>
        <ul>
          <li>
            <strong>Os seus dados ficam no seu telemóvel.</strong> A cópia na nuvem e a partilha com
            a família são opcionais e vão cifradas.
          </li>
          <li>
            <strong>Cada prazo tem fonte.</strong> Cada regra indica a lei, com ligação, e a data em
            que foi verificada.
          </li>
          <li>
            <strong>
              Os prazos são calculados por regras fixas, nunca por inteligência artificial.
            </strong>{' '}
            Na dúvida, a app mostra a data mais cedo.
          </li>
          <li>
            <strong>Letra grande e alto contraste</strong>, nos botões no topo de cada página.
          </li>
        </ul>
      </section>

      <div className="actions">
        <Link to="/" className="button primary">
          Começar
        </Link>
        <Link to="/opiniao" className="button">
          Dar a sua opinião
        </Link>
      </div>

      <LegalNotice />
    </>
  );
}
