import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import fp from 'fastify-plugin';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import ws from 'ws';

async function supabasePlugin(fastify: FastifyInstance, opts: FastifyPluginOptions) {
  const supabase = createClient(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_KEY,
    {
      auth: {
        persistSession: false,
      },
      realtime: {
        transport: ws as any,
      },
    }
  );

  fastify.decorate('supabase', supabase as any);
}

declare module 'fastify' {
  interface FastifyInstance {
    supabase: SupabaseClient;
  }
}

export default fp(supabasePlugin);
