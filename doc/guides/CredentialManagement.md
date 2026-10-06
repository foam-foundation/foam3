# Credentials & Vaults

This document describes how FOAM models **credentials**, how their secrets are resolved through
**vaults**, and how LLM and embedding providers are wired in this application.

- [Credentials](#credentials)
  - [The base model](#the-base-model)
  - [APIKeyCredential](#apikeyexcredential)
  - [The credential family](#the-credential-family)
- [Vaults](#vaults)
  - [How a credential uses a vault](#how-a-credential-uses-a-vault)
  - [The vault interface](#the-vault-interface)
  - [Backends](#backends)
  - [Wiring vaultSecrets](#wiring-vaultsecrets)
  - [Resolution flow](#resolution-flow)
- [How providers resolve their API key](#how-providers-resolve-their-api-key)
- [credentials.jrl](#credentialsjrl)
- [Local development](#local-development)
- [Adding a new provider](#adding-a-new-provider)
- [Reference: file map](#reference-file-map)

---

# Credentials

A credential captures everything needed to authenticate to one external service. Credentials are
persisted as rows in `credentialDAO`.

## The base model

`foam.core.auth.Credential` is the root of all credentials.

It mixes in **`KeyStoreAware`**, which gives every credential two things:

- **`vault`** — the name of a `CSpec` service implementing `KeyStoreManager`.
- **`resolveSecret(x, secretId)`** — if `vault` is set, delegates to `vault.getSecret(x, secretId)`;
  if `vault` is empty, **returns `secretId` unchanged** (the literal is the secret).

That passthrough rule is the key: a field holds either a literal secret (no vault configured) or a
vault alias (vault set), and the same code reads both. Rollout is per-credential and non-breaking.

Base properties:

| Property | Notes |
|---|---|
| `id` | String; the credential's lookup key in `credentialDAO` |
| `type` | Derived, read-only — the credential's class name |
| `enabled` | Boolean, defaults `true` |
| `serviceName` | Human-readable label for the service this authenticates to |
| `vault` | CSpec name of the vault; empty means resolve as literal |

## APIKeyCredential

`foam.core.auth.APIKeyCredential` extends `Credential` and covers every auth scheme that reduces to
a single opaque string:

```javascript
foam.CLASS({
  package: 'foam.core.auth',
  name: 'APIKeyCredential',
  extends: 'foam.core.auth.Credential',

  properties: [
    { class: 'String', name: 'apiKey', includeInDigest: true }
  ],

  methods: [{
    name: 'getApiKeySecret',
    type: 'String',
    args: 'Context x',
    javaCode: 'return resolveSecret(x, getApiKey());'
  }]
});
```

The `apiKey` field holds either a literal API key (dev shortcut, no vault) or a vault alias.
Callers always use `getApiKeySecret(x)` — never `getApiKey()` directly — so the vault passthrough
fires transparently.

## The credential family

Subclasses of `Credential` specialize by auth scheme. `APIKeyCredential` sits alongside the others:

| Credential | Auth scheme | Distinctive fields |
|---|---|---|
| `BasicAuthCredential` | HTTP Basic | uses base `username` / `password` |
| `BearerCredential` | Bearer token | `token`, `expiry` |
| **`APIKeyCredential`** | Single API key | `apiKey` → `getApiKeySecret(x)` |

`APIKeyCredential` is the right base for any provider that presents one opaque string (LLM
providers, embedding providers, webhook shared secrets, etc.).

---

# Vaults

A vault is a service that returns secret material by alias. The abstraction has two halves: the
**consumer side** (`KeyStoreAware`, on every credential) and the **provider side** (`KeyStoreManager`
and its backends).

## How a credential uses a vault

Set `vault` to the CSpec name of the backend, and put the secret's **alias** in the field:

```javascript
c({ "class": "foam.core.auth.APIKeyCredential",
    "id":          "foam/llm/claude",
    "serviceName": "ClaudeLLMService",
    "vault":       "vaultSecrets",         // which vault CSpec to use
    "apiKey":      "foam/llm/claude/api-key" })  // alias, not the literal key
```

At runtime `getApiKeySecret(x)` calls `resolveSecret(x, "foam/llm/claude/api-key")`, which routes
to `vaultSecrets.getSecret(x, "foam/llm/claude/api-key")` and returns the real key.

**Without a vault** (literal shortcut for local testing only):

```javascript
c({ "class": "foam.core.auth.APIKeyCredential",
    "id":    "foam/llm/claude",
    "apiKey": "sk-ant-api03-..." })   // literal — vault property absent
```

`resolveSecret` returns the value unchanged, so `getApiKeySecret(x)` returns the literal.

## The vault interface

`foam.core.security.KeyStoreManager` is the provider contract. The one method credentials care about:

- **`getSecret(x, alias) → String`** — returns the secret string for the given alias.

## Backends

| Backend | What it is | Use |
|---|---|---|
| **`FileKeyStoreManager`** | Reads `KEY=VALUE` lines from a plain file; hot-reloads on every `getSecret` call | Local development |
| **`AWSSecretsManager`** | Fetches a secret string from AWS Secrets Manager | ECS / production |
| `CachingKeyStoreManager` | Decorator over another backend; memoizes results; `reload()` clears cache | Optional wrapper |
| `EmptyKeyStoreManager` | Returns `""` — no-op | Testing |

### FileKeyStoreManager

`FileKeyStoreManager` is the **local-development vault**. Secrets file format:

```sh
# One KEY=VALUE per line.  Lines starting with # are comments; blank lines ignored.
# Split on the FIRST '='.  Values may contain '='.  Key and value are trimmed.
foam/llm/claude/api-key=sk-ant-api03-REAL_KEY_HERE
foam/llm/openai/api-key=sk-REAL_KEY_HERE
foam/llm/deepseek/api-key=sk-REAL_KEY_HERE
```

- The file is **gitignored**; never commit it.
- Hot-reloads on every `getSecret` call — edits are picked up without a server restart.
- If the file is missing at boot the manager logs a warning and starts with an empty map; the app
  still boots, but the first credential lookup for an absent alias throws `Secret not found: <alias>`.

## Wiring vaultSecrets

The vault is registered as a `CSpec` whose `name` matches the credentials' `vault` property. This
application uses the environment-agnostic name **`vaultSecrets`** so that the same
`credentials.jrl` works with any backend — only the `services.jrl` entry changes per deployment.

**Local development** (`deployment/dev/services.jrl`):

```javascript
p({
  "class": "foam.core.boot.CSpec",
  "name":  "vaultSecrets",
  "lazy":  false,
  "serviceScript": """
    return new foam.core.security.FileKeyStoreManager.Builder(x)
      .setSecretsPath("dev-secrets.env")
      .build();
  """
})
```

**ECS / production** — replace the body with `AWSSecretsManager`, optionally wrapped in
`CachingKeyStoreManager`:

```javascript
p({
  "class": "foam.core.boot.CSpec",
  "name":  "vaultSecrets",
  "lazy":  false,
  "serviceScript": """
    return new foam.core.security.CachingKeyStoreManager(
      new com.example.security.AWSSecretsManager.Builder(x)
        .setRegionId("us-east-1")
        .build());
  """
})
```

No other file changes. `credentials.jrl` references `"vault":"vaultSecrets"` in both environments.

## Resolution flow

```
  Credential (vault="vaultSecrets", apiKey holds an alias)
        │  getApiKeySecret(x)
        │    resolveSecret(x, "foam/llm/claude/api-key")
        ▼
  vault set?  ──no──▶  return alias unchanged  (literal API key)
        │ yes
        ▼
  x.get("vaultSecrets") : KeyStoreManager
        │  getSecret(x, "foam/llm/claude/api-key")
        ▼
  FileKeyStoreManager          ──▶  reads dev-secrets.env  (local dev)
  AWSSecretsManager            ──▶  AWS API call            (ECS / prod)
        │
        ▼
  real API key string  ◀── returned to provider's javaFactory
```

---

# How providers resolve their API key

LLM providers do **not** implement `KeyStoreAware` — they don't need to. The credential object
handles vault resolution. Providers use two properties and a `javaFactory`:

```javascript
properties: [
  {
    class: 'String',
    name:  'credentialId',
    value: 'foam/llm/claude'       // which row to find in credentialDAO
  },
  {
    class: 'String',
    name:  'apiKey',
    javaFactory: `
      foam.core.auth.APIKeyCredential cred = (foam.core.auth.APIKeyCredential)
        ((foam.dao.DAO) getX().get("credentialDAO")).find(getCredentialId());
      if ( cred == null )
        throw new RuntimeException("LLM credential not found: " + getCredentialId());
      return cred.getApiKeySecret(getX());
    `
  }
]
```

- `credentialId` names the credential row (matches the `id` field in `credentials.jrl`).
- The `javaFactory` on `apiKey` runs **once**, lazily, on the first `getApiKey()` call. It looks up
  the credential and delegates to `getApiKeySecret(x)`, which triggers vault resolution.
- All four providers (`ClaudeLLMService`, `OpenAILLMService`, `DeepSeekLLMService`,
  `OllamaLLMService`) follow this pattern. DeepSeek and Ollama extend `OpenAILLMService` and
  inherit the factory; they only override `credentialId` (and `baseURL` / `defaultModel`).

---

# credentials.jrl

`deployment/docker/credentials.jrl` declares the credentials for all AI providers. The `vault` name
must match the CSpec registered in `services.jrl`; the `apiKey` value is the alias the vault will
resolve:

```javascript
// deployment/docker/credentials.jrl

// LLM providers
c({ "class":"foam.core.auth.APIKeyCredential", "id":"foam/llm/claude",
    "serviceName":"ClaudeLLMService",   "vault":"vaultSecrets", "apiKey":"foam/llm/claude/api-key"   })
c({ "class":"foam.core.auth.APIKeyCredential", "id":"foam/llm/openai",
    "serviceName":"OpenAILLMService",   "vault":"vaultSecrets", "apiKey":"foam/llm/openai/api-key"   })
c({ "class":"foam.core.auth.APIKeyCredential", "id":"foam/llm/deepseek",
    "serviceName":"DeepSeekLLMService", "vault":"vaultSecrets", "apiKey":"foam/llm/deepseek/api-key" })
// OllamaLLMService: local, no credential needed

// Vector / embedding providers
// Ollama embedding runs locally — no credential needed.
// Add entries here when a cloud embedding provider (e.g. OpenAI) is introduced.
```

### Alias naming convention

Aliases use a hierarchical path: `<namespace>/<subsystem>/<provider>/<field>`.

| Provider | Alias |
|---|---|
| Claude | `foam/llm/claude/api-key` |
| OpenAI | `foam/llm/openai/api-key` |
| DeepSeek | `foam/llm/deepseek/api-key` |
| (future) OpenAI embedding | `foam/embedding/openai/api-key` |

The `foam/` prefix identifies secrets that live in the `foam3` layer (not application-specific).

---

# Local development

**1. Copy the template and fill in real keys:**

```bash
cp foam3/deployment/ai/dev-secrets.env.template ../var/dev-secrets.env
# Edit ../var/dev-secrets.env — replace each REPLACE_ME with a real key.
```

The file lives in the application folder under `/opt` (outside the code tree) and is never committed.

**2. Format:**

```sh
# AI provider API keys — fill in real values.
# dev-secrets.env is gitignored; never commit it.

# LLM providers
foam/llm/claude/api-key=sk-ant-api03-REAL_KEY_HERE
foam/llm/openai/api-key=sk-REAL_KEY_HERE
foam/llm/deepseek/api-key=sk-REAL_KEY_HERE
# Ollama: local, no key needed
```

**3. Ensure the `vaultSecrets` CSpec is loaded** by including `deployment/dev/services.jrl` in your
build journals (`-J` flag). The `FileKeyStoreManager` points at `dev-secrets.env` (resolved
relative to the working directory).

**4. Hot reload:** edits to `dev-secrets.env` are picked up without a server restart — the manager
re-reads the file on each `getSecret` call.

---

# Adding a new provider

Adding an LLM or embedding provider that requires an API key takes four steps.

**1. Choose an alias.** Follow the naming convention: `foam/<subsystem>/<provider>/api-key`.
For example, a Cohere embedding provider: `foam/embedding/cohere/api-key`.

**2. Add a credential entry** to `deployment/docker/credentials.jrl`:

```javascript
c({ "class":"foam.core.auth.APIKeyCredential", "id":"foam/embedding/cohere",
    "serviceName":"CohereEmbeddingService", "vault":"vaultSecrets",
    "apiKey":"foam/embedding/cohere/api-key" })
```

**3. Wire the provider class.** In the provider's `.js` file, add `credentialId` and `apiKey`
properties with the same `javaFactory` pattern (see [How providers resolve their API key](#how-providers-resolve-their-api-key)).
If the provider extends an existing one that already has the factory, only override `credentialId`.

**4. Add the alias to `../var/dev-secrets.env`** (and add a placeholder to the template):

```sh
foam/embedding/cohere/api-key=REAL_KEY_HERE
```

That's all. The vault resolves the new alias in all environments — only the backend CSpec
(`FileKeyStoreManager` vs. `AWSSecretsManager`) differs.

---

# Reference: file map

| Concern | File |
|---|---|
| Credential base class | `foam3/src/foam/core/auth/Credential.js` |
| API-key credential | `foam3/src/foam/core/auth/APIKeyCredential.js` |
| Secret-resolution interface (`resolveSecret`) | `foam3/src/foam/core/security/KeyStoreAware.js` |
| KeyStore manager interface (`getSecret`) | `foam3/src/foam/core/security/KeyStoreManager.js` |
| Local dev vault (file-backed) | `foam3/src/foam/core/security/FileKeyStoreManager.js` |
| Caching decorator | `foam3/src/foam/core/security/CachingKeyStoreManager.js` |
| LLM provider classes | `foam3/src/foam/core/ai/llm/provider/` |
| Credential journal (all environments) | `deployment/docker/credentials.jrl` |
| Local dev vault CSpec | `foam3/deployment/ai/services.jrl` |
| Secrets file template | `foam3/deployment/ai/dev-secrets.env.template` |
| LLM service CSpec (provider selection) | `foam3/src/foam/core/ai/services.jrl` |
