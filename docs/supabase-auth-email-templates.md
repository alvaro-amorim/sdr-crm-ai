# Supabase Auth Email Templates

Use estes textos no painel do Supabase em `Authentication > Emails`. Eles sao templates operacionais para o MVP e nao contem secrets.

## Confirm signup

Assunto:

```text
Confirme seu acesso ao SDR Expert
```

Corpo:

```html
<h2>Confirme seu e-mail</h2>
<p>Ola,</p>
<p>Recebemos uma solicitacao para criar uma conta no SDR Expert.</p>
<p>Para ativar sua conta e acessar seu workspace, confirme seu e-mail pelo botao abaixo:</p>
<p><a href="{{ .ConfirmationURL }}">Confirmar e-mail</a></p>
<p>Se voce nao solicitou este cadastro, ignore esta mensagem.</p>
```

## Reset password

Assunto:

```text
Redefina sua senha do SDR Expert
```

Corpo:

```html
<h2>Redefinicao de senha</h2>
<p>Ola,</p>
<p>Recebemos uma solicitacao para redefinir a senha da sua conta no SDR Expert.</p>
<p>Clique no botao abaixo para criar uma nova senha:</p>
<p><a href="{{ .ConfirmationURL }}">Redefinir senha</a></p>
<p>Se voce nao solicitou esta alteracao, ignore esta mensagem.</p>
```

## Magic link

Assunto:

```text
Seu link de acesso ao SDR Expert
```

Corpo:

```html
<h2>Acesse sua conta</h2>
<p>Ola,</p>
<p>Use o link abaixo para entrar no SDR Expert com seguranca:</p>
<p><a href="{{ .ConfirmationURL }}">Entrar no SDR Expert</a></p>
<p>Se voce nao solicitou este acesso, ignore esta mensagem.</p>
```

## Change email address

Assunto:

```text
Confirme a alteracao de e-mail do SDR Expert
```

Corpo:

```html
<h2>Confirme seu novo e-mail</h2>
<p>Ola,</p>
<p>Recebemos uma solicitacao para alterar o e-mail da sua conta no SDR Expert.</p>
<p>Confirme a alteracao pelo link abaixo:</p>
<p><a href="{{ .ConfirmationURL }}">Confirmar novo e-mail</a></p>
<p>Se voce nao solicitou esta alteracao, ignore esta mensagem.</p>
```

## Invite user

Assunto:

```text
Voce foi convidado para o SDR Expert
```

Corpo:

```html
<h2>Convite para o SDR Expert</h2>
<p>Ola,</p>
<p>Voce recebeu um convite para acessar um workspace no SDR Expert.</p>
<p>Aceite o convite pelo link abaixo:</p>
<p><a href="{{ .ConfirmationURL }}">Aceitar convite</a></p>
<p>Se voce nao reconhece este convite, ignore esta mensagem.</p>
```

## Configuracao obrigatoria

- `Site URL` local: `http://127.0.0.1:5173`
- `Additional Redirect URLs` local:
  - `http://127.0.0.1:5173`
  - `http://localhost:5173`
- Em producao, substituir/adicionar a URL final da Vercel.
- Manter confirmacao de e-mail ativada para cadastro por e-mail e senha.
- Google OAuth deve usar o callback oficial do Supabase em `https://<project-ref>.supabase.co/auth/v1/callback`.
