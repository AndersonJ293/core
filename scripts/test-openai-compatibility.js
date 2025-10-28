#!/usr/bin/env node

/**
 * Script para testar compatibilidade com diferentes URLs OpenAI-compatible
 * Uso: node scripts/test-openai-compatibility.js [baseURL]
 */

const { createRequire } = require('module');
const require = createRequire(import.meta.url);

// Carrega variáveis de ambiente
require('dotenv').config();

async function testOpenAICompatibility() {
  const baseURL = process.argv[2] || process.env.OPENAI_BASE_URL;
  const apiKey = process.env.OPENAI_API_KEY;

  console.log('🧪 Testando compatibilidade OpenAI...\n');

  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY não encontrada nas variáveis de ambiente');
    process.exit(1);
  }

  console.log(`📡 URL Base: ${baseURL || 'Padrão (api.openai.com)'}`);
  console.log(`🔑 API Key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 5)}\n`);

  try {
    // Importa dinamicamente para evitar problemas com ES modules
    const { openai } = await import('@ai-sdk/openai');
    
    // Testa criação do modelo
    const model = baseURL 
      ? openai('gpt-3.5-turbo', { baseURL })
      : openai('gpt-3.5-turbo');
    
    console.log('✅ Modelo criado com sucesso');

    // Testa uma chamada simples
    const { generateText } = await import('ai');
    
    const result = await generateText({
      model,
      prompt: 'Responda com apenas "OK" para teste de conexão.',
      maxTokens: 10,
    });

    console.log('✅ Chamada à API bem-sucedida');
    console.log(`📝 Resposta: "${result.text.trim()}"`);

    // Testa embeddings se disponível
    try {
      const { embed } = await import('ai');
      const embeddingModel = baseURL
        ? openai.embedding('text-embedding-3-small', { baseURL })
        : openai.embedding('text-embedding-3-small');

      const { embedding } = await embed({
        model: embeddingModel,
        value: 'teste de embedding',
      });

      console.log('✅ Embedding gerado com sucesso');
      console.log(`📊 Dimensões: ${embedding.length}`);
    } catch (embeddingError) {
      console.log('⚠️  Embeddings não disponíveis ou falharam:', embeddingError.message);
    }

    console.log('\n🎉 Todos os testes passaram! A configuração está funcionando corretamente.');

  } catch (error) {
    console.error('❌ Erro durante o teste:');
    console.error('Mensagem:', error.message);
    
    if (error.cause) {
      console.error('Causa:', error.cause);
    }

    console.log('\n💡 Dicas para solução:');
    console.log('- Verifique se o baseURL está correto e acessível');
    console.log('- Confirme se a API key é válida para o provedor');
    console.log('- Verifique se o modelo especificado está disponível');
    console.log('- Teste a conexão com curl ou Postman primeiro');

    process.exit(1);
  }
}

// Função para testar diferentes provedores
async function testMultipleProviders() {
  const providers = [
    {
      name: 'OpenAI (Padrão)',
      baseURL: undefined,
    },
    {
      name: 'LocalAI',
      baseURL: 'http://localhost:8080/v1',
    },
    {
      name: 'Ollama',
      baseURL: 'http://localhost:11434/v1',
    },
    {
      name: 'Together AI',
      baseURL: 'https://api.together.xyz/v1',
    },
    {
      name: 'Groq',
      baseURL: 'https://api.groq.com/openai/v1',
    },
  ];

  console.log('🔄 Testando múltiplos provedores...\n');

  for (const provider of providers) {
    console.log(`\n📡 Testando: ${provider.name}`);
    if (provider.baseURL) {
      console.log(`   URL: ${provider.baseURL}`);
    }

    try {
      process.env.OPENAI_BASE_URL = provider.baseURL;
      await testOpenAICompatibility();
      console.log(`✅ ${provider.name}: Funcionando`);
    } catch (error) {
      console.log(`❌ ${provider.name}: Falhou - ${error.message}`);
    }
  }
}

// Execução principal
if (process.argv.includes('--multiple')) {
  testMultipleProviders();
} else {
  testOpenAICompatibility();
}