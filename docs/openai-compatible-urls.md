# Usando URLs OpenAI-Compatible

Este projeto agora suporta o uso de qualquer API compatível com OpenAI através da variável de ambiente `OPENAI_BASE_URL`.

## Configuração

### Variáveis de Ambiente

```bash
# API Key do provedor (obrigatório)
OPENAI_API_KEY=sua_api_key

# URL base personalizada (opcional)
OPENAI_BASE_URL=https://sua-api-compativel.com/v1
```

### Exemplos de Configuração

#### 1. OpenAI (Padrão)
```bash
OPENAI_API_KEY=sk-xxx...
# OPENAI_BASE_URL não é necessário, usa o padrão
```

#### 2. Azure OpenAI
```bash
OPENAI_API_KEY=sua_azure_api_key
OPENAI_BASE_URL=https://seu-resource.openai.azure.com/
```

#### 3. LocalAI
```bash
OPENAI_API_KEY=not_required
OPENAI_BASE_URL=http://localhost:8080/v1
```

#### 4. Ollama com API OpenAI-Compatible
```bash
OPENAI_API_KEY=ollama
OPENAI_BASE_URL=http://localhost:11434/v1
```

#### 5. Together AI
```bash
OPENAI_API_KEY=sua_together_api_key
OPENAI_BASE_URL=https://api.together.xyz/v1
```

#### 6. Groq
```bash
OPENAI_API_KEY=sua_groq_api_key
OPENAI_BASE_URL=https://api.groq.com/openai/v1
```

#### 7. Perplexity
```bash
OPENAI_API_KEY=sua_perplexity_api_key
OPENAI_BASE_URL=https://api.perplexity.ai
```

## Modelos Suportados

A configuração funciona com qualquer modelo que seja compatível com a API OpenAI. Alguns exemplos:

### Para OpenAI
- `gpt-4`
- `gpt-4-turbo`
- `gpt-3.5-turbo`
- `text-embedding-3-small`

### Para Outros Provedores
Verifique a documentação do seu provedor para os nomes corretos dos modelos.

## Uso no Código

### Modelos de Chat
```typescript
// A função getModel() usará automaticamente o OPENAI_BASE_URL configurado
const model = getModel("gpt-4");
const response = await makeModelCall(false, messages, onFinish);
```

### Embeddings
```typescript
// Para embeddings com text-embedding-3-small
const embedding = await getEmbedding("seu texto aqui");
```

### Batch Processing
```typescript
// O OpenAIBatchProvider usará automaticamente o OPENAI_BASE_URL
const provider = new OpenAIBatchProvider();
const batch = await provider.createBatch(params);
```

## Arquivos Modificados

1. **apps/webapp/app/env.server.ts**: Adicionada variável `OPENAI_BASE_URL`
2. **apps/webapp/app/lib/model.server.ts**: Modificado para usar baseURL configurável
3. **apps/webapp/app/lib/batch/providers/openai.ts**: Modificado para usar baseURL configurável

## Notas Importantes

- Se `OPENAI_BASE_URL` não for definido, o sistema usará o URL padrão da OpenAI
- A `OPENAI_API_KEY` ainda é obrigatória para a maioria dos provedores
- Alguns provedores locais (como LocalAI) podem aceitar qualquer valor na API key
- Verifique a documentação do seu provedor para garantir compatibilidade completa

## Testando a Configuração

1. Configure as variáveis de ambiente
2. Inicie o aplicativo
3. Faça uma chamada para testar se a conexão está funcionando
4. Verifique os logs para confirmar que o URL correto está sendo usado

## Troubleshooting

### Erro de Conexão
- Verifique se o `OPENAI_BASE_URL` está correto e acessível
- Confirme se a API key é válida para o provedor

### Modelo Não Encontrado
- Verifique se o nome do modelo é compatível com o provedor
- Consulte a documentação do provedor para os modelos disponíveis

### Problemas de Autenticação
- Confirme se a API key está correta
- Verifique se há headers adicionais necessários para o provedor