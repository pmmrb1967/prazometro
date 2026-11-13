import { runMonitor, type MonitorEnv } from './monitor';

// Worker monitor: sem rotas públicas, só o Cron Trigger de hora a hora.

export default {
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(
      runMonitor(env, Math.floor(Date.now() / 1000)).then((r) => {
        // Só números agregados: nunca dados pessoais.
        console.log('monitor', r.date, JSON.stringify(r.values), r.alerts.length, r.savings);
        if (r.whatsapp) console.log('monitor: whatsapp', r.whatsapp);
        if (r.analyticsError)
          console.error('monitor: estatísticas indisponíveis', r.analyticsError);
      }),
    );
  },
} satisfies ExportedHandler<MonitorEnv>;
