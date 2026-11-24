import { IconLock, IconMail } from "@tabler/icons-react";
import { useState } from "react";

import { Field } from "@/components/shared/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabaseBrowser } from "@/lib/supabase-client";

export function meta() {
  return [{ title: "Masuk - CTRL Coffee" }];
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const { error: authError } = await supabaseBrowser().auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      window.location.assign("/");
    } catch (e) {
      setError(e instanceof Error && /Invalid login/i.test(e.message) ? "Email atau kata sandi salah." : e instanceof Error ? e.message : "Gagal masuk");
      setPending(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-background text-foreground lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden border-r border-border bg-secondary p-12 text-primary lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full border border-primary/10" />
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 size-64 rounded-full border border-primary/15" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-16 size-80 rounded-full bg-accent/60" />
        <div aria-hidden className="pointer-events-none absolute bottom-24 left-24 size-24 rounded-full border border-accent/30" />
        <div className="relative flex items-center gap-2.5">
          <img src="/ctrl-coffee-logo-hd.png" alt="" className="h-9 w-auto shrink-0" />
          <p className="text-[15px] font-semibold leading-none tracking-tight">CTRL + Coffee</p>
        </div>
        <div className="relative max-w-md">
          <p className="text-3xl font-semibold leading-tight tracking-tight">
            Supply chain harian, dalam satu dashboard.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Pantau stok, pesanan pembelian, penerimaan barang, dan pembayaran supplier dari satu tempat.
          </p>
        </div>
        <p className="relative text-xs text-muted-foreground">Internal CTRL Coffee</p>
      </aside>

      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <img src="/ctrl-coffee-logo-hd.png" alt="" className="h-9 w-auto shrink-0" />
            <p className="text-[15px] font-semibold leading-none tracking-tight">CTRL + Coffee</p>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-primary">Masuk</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Gunakan akun tim untuk mengakses dashboard.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
            <Field id="login-email" label="Email">
              <div className="relative">
                <IconMail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="nama@ctrlcoffee.id"
                  className="h-10 pl-9"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </Field>

            <Field id="login-password" label="Kata sandi">
              <div className="relative">
                <IconLock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="h-10 pl-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </Field>

            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

            <Button type="submit" className="h-10 w-full" disabled={pending}>
              {pending ? "Memproses…" : "Masuk"}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Akun dibuat oleh Admin/Owner. Hak akses ditentukan oleh peran akun.
          </p>
        </div>
      </main>
    </div>
  );
}
