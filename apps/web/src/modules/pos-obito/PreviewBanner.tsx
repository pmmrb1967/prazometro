import { useState } from 'react';
import { navigate } from '../../router';
import { disablePreview } from './preview';

/** Aviso permanente enquanto o módulo não tiver revisão jurídica. */
export function PreviewBanner() {
  const [closing, setClosing] = useState(false);
  return (
    <div className="notice" role="note">
      <p>
        <strong>Pré-visualização.</strong> Este módulo ainda está a ser revisto por um jurista. Os
        prazos e os textos podem mudar: não os use ainda para decisões reais.
      </p>
      <button
        type="button"
        className="link-button"
        disabled={closing}
        onClick={() => {
          setClosing(true);
          disablePreview();
          navigate('/', { replace: true });
        }}
      >
        Sair da pré-visualização
      </button>
    </div>
  );
}
