declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

interface ImportMeta {
  readonly main?: boolean;
}

declare module "https://deno.land/std@0.168.0/http/server.ts" {
  export function serve(
    handler: (req: Request) => Response | Promise<Response>
  ): void;
}

declare module "https://esm.sh/@supabase/supabase-js@2.49.8" {
  export { createClient } from "@supabase/supabase-js";
}
