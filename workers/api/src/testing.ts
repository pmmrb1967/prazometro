import { encodeCBOR } from '@levischuck/tiny-cbor';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { convertV4MiniflareOptions, Miniflare } from 'miniflare';
import app from './index';
import { toB64url } from './lib';

// Apoio aos testes: base D1 local com as migrações reais e um autenticador WebAuthn de software.

export const ORIGIN = 'https://app.prazometro.workers.dev';
const RP_ID = 'app.prazometro.workers.dev';

export async function testDb(): Promise<{ DB: D1Database; dispose: () => Promise<void> }> {
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      workers: [
        {
          name: 'teste',
          modules: true,
          script: 'export default { fetch() { return new Response(null) } }',
          d1Databases: { DB: `test-${crypto.randomUUID()}` },
        },
      ],
    }),
  );
  const DB = (await mf.getD1Database('DB', 'teste')) as unknown as D1Database;
  const dir = join(fileURLToPath(import.meta.url), '../../../../db/migrations');
  for (const file of readdirSync(dir).sort()) {
    const sql = readFileSync(join(dir, file), 'utf8')
      .split('\n')
      .filter((l) => !l.trim().startsWith('--'))
      .join('\n');
    for (const stmt of sql
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)) {
      await DB.prepare(stmt).run();
    }
  }
  return { DB, dispose: () => mf.dispose() };
}

/** Cliente HTTP de teste que guarda o cookie de sessão, como faria o navegador. */
export class Client {
  cookie = '';
  constructor(
    private DB: D1Database,
    private origin = ORIGIN,
  ) {}

  async call(
    path: string,
    init: {
      method?: string;
      json?: unknown;
      body?: BodyInit;
      headers?: Record<string, string>;
    } = {},
  ) {
    const headers: Record<string, string> = { 'x-prazometro': '1', ...init.headers };
    if (this.cookie) headers.cookie = this.cookie;
    let body = init.body;
    if (init.json !== undefined) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(init.json);
    }
    const res = await app.request(
      `${this.origin}/api${path}`,
      { method: init.method ?? (body ? 'POST' : 'GET'), headers, body },
      { DB: this.DB },
    );
    const set = res.headers.get('set-cookie');
    if (set) {
      const [pair] = set.split(';');
      this.cookie = pair!.endsWith('=') ? '' : pair!;
    }
    return res;
  }

  async json<T = Record<string, unknown>>(path: string, init?: Parameters<Client['call']>[1]) {
    const res = await this.call(path, init);
    return { status: res.status, data: (await res.json()) as T };
  }
}

const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) {
    out.set(p, i);
    i += p.length;
  }
  return out;
};
const sha256 = async (b: Uint8Array) =>
  new Uint8Array(await crypto.subtle.digest('SHA-256', b as BufferSource));
const u32 = (n: number) =>
  new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);

/** Assinatura ECDSA em bruto (r||s) para DER, como as passkeys a enviam. */
function derSignature(raw: Uint8Array) {
  const int = (b: Uint8Array) => {
    let i = 0;
    while (i < b.length - 1 && b[i] === 0) i++;
    let v = b.slice(i);
    if (v[0]! & 0x80) v = concat(new Uint8Array([0]), v);
    return concat(new Uint8Array([0x02, v.length]), v);
  };
  const body = concat(int(raw.slice(0, 32)), int(raw.slice(32)));
  return concat(new Uint8Array([0x30, body.length]), body);
}

type Options = { challenge: string };

/** Autenticador de software (ES256, atestação "none"), para testar o servidor de ponta a ponta. */
export class FakeAuthenticator {
  readonly credentialId = crypto.getRandomValues(new Uint8Array(16));
  counter = 0;
  private constructor(private keys: CryptoKeyPair) {}

  static async create() {
    const keys = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
      'sign',
      'verify',
    ])) as CryptoKeyPair;
    return new FakeAuthenticator(keys);
  }

  get id() {
    return toB64url(this.credentialId);
  }

  private clientData(type: string, challenge: string, origin: string) {
    return new TextEncoder().encode(
      JSON.stringify({ type, challenge, origin, crossOrigin: false }),
    );
  }

  async register(options: Options, origin = ORIGIN) {
    const raw = new Uint8Array(
      (await crypto.subtle.exportKey('raw', this.keys.publicKey)) as ArrayBuffer,
    );
    const cose = encodeCBOR(
      new Map<number, number | Uint8Array>([
        [1, 2],
        [3, -7],
        [-1, 1],
        [-2, raw.slice(1, 33)],
        [-3, raw.slice(33)],
      ]),
    );
    const authData = concat(
      await sha256(new TextEncoder().encode(RP_ID)),
      new Uint8Array([0x45]), // UP | UV | AT
      u32(this.counter),
      new Uint8Array(16), // aaguid
      new Uint8Array([0, this.credentialId.length]),
      this.credentialId,
      cose,
    );
    const attestationObject = encodeCBOR(
      new Map<string, string | Uint8Array | Map<string, string>>([
        ['fmt', 'none'],
        ['attStmt', new Map<string, string>()],
        ['authData', authData],
      ]),
    );
    return {
      id: this.id,
      rawId: this.id,
      type: 'public-key',
      response: {
        clientDataJSON: toB64url(this.clientData('webauthn.create', options.challenge, origin)),
        attestationObject: toB64url(attestationObject),
        transports: ['internal'],
      },
      clientExtensionResults: {},
      authenticatorAttachment: 'platform',
    };
  }

  async login(options: Options, origin = ORIGIN) {
    this.counter++;
    const clientData = this.clientData('webauthn.get', options.challenge, origin);
    const authData = concat(
      await sha256(new TextEncoder().encode(RP_ID)),
      new Uint8Array([0x05]), // UP | UV
      u32(this.counter),
    );
    const signed = concat(authData, await sha256(clientData));
    const raw = new Uint8Array(
      await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        this.keys.privateKey,
        signed as BufferSource,
      ),
    );
    return {
      id: this.id,
      rawId: this.id,
      type: 'public-key',
      response: {
        clientDataJSON: toB64url(clientData),
        authenticatorData: toB64url(authData),
        signature: toB64url(derSignature(raw)),
      },
      clientExtensionResults: {},
    };
  }
}

export const b64 = (n: number) => toB64url(crypto.getRandomValues(new Uint8Array(n)));

/** Chaves cifradas de exemplo: o servidor só as guarda, nunca as interpreta. */
export const sampleWraps = () => [
  { kind: 'recovery', salt: b64(16), iv: b64(12), wrapped: b64(48) },
];

/** Cria uma conta completa e devolve o cliente com sessão, o autenticador e o verificador. */
export async function registerAccount(DB: D1Database) {
  const client = new Client(DB);
  const authenticator = await FakeAuthenticator.create();
  const recoveryVerifier = b64(32);
  const opts = await client.json<{ challengeId: string; options: Options }>(
    '/auth/register/options',
    {
      json: {},
    },
  );
  const res = await client.json('/auth/register/verify', {
    json: {
      challengeId: opts.data.challengeId,
      response: await authenticator.register(opts.data.options),
      recoveryVerifier,
      wraps: sampleWraps(),
    },
  });
  if (res.status !== 200) throw new Error(`registo falhou: ${JSON.stringify(res.data)}`);
  return { client, authenticator, recoveryVerifier };
}
