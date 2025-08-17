const admin = require('firebase-admin');
const { firebase: config } = require('./environment');

// Verificar se Firebase está configurado
if (!config.project_id || !config.private_key || !config.client_email) {
  console.warn('⚠️  Firebase não configurado - algumas funcionalidades podem não funcionar');
  console.warn('   Variáveis necessárias: FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL');
  
  // Exportar um mock para evitar crashes
  module.exports = {
    auth: () => ({ verifyIdToken: async () => { throw new Error('Firebase não configurado'); } }),
    initialized: false
  };
  return;
}

// Função para validar e normalizar a chave privada
function normalizePrivateKey(privateKey) {
  if (!privateKey) {
    throw new Error('Private key is null or undefined');
  }

  let normalizedKey = privateKey.trim();

  // Remover aspas do início e fim se existirem
  if ((normalizedKey.startsWith('"') && normalizedKey.endsWith('"')) || 
      (normalizedKey.startsWith("'") && normalizedKey.endsWith("'"))) {
    normalizedKey = normalizedKey.slice(1, -1);
  }

  // Normalizar quebras de linha e caracteres especiais
  normalizedKey = normalizedKey
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')  
    .replace(/\r\n/g, '\n')
    .replace(/\\"/g, '"')
    .trim();

  console.log('🔑 Chave após limpeza inicial:', {
    length: normalizedKey.length,
    startsWithBegin: normalizedKey.startsWith('-----BEGIN'),
    firstChars: normalizedKey.substring(0, 50) + '...'
  });

  // Se a chave NÃO começar com -----BEGIN após limpeza, pode estar em base64
  if (!normalizedKey.startsWith('-----BEGIN')) {
    try {
      console.log('🔄 Tentando decodificar de base64...');
      const decodedKey = Buffer.from(normalizedKey, 'base64').toString('utf8');
      
      // Verificar se a decodificação resultou em PEM válido
      if (decodedKey.includes('-----BEGIN PRIVATE KEY-----') || 
          decodedKey.includes('-----BEGIN RSA PRIVATE KEY-----')) {
        normalizedKey = decodedKey;
        console.log('✅ Chave decodificada de base64 com sucesso');
      } else {
        console.log('⚠️  Decodificação base64 não resultou em PEM válido, usando chave original');
      }
    } catch (error) {
      console.log('⚠️  Erro na decodificação base64, usando chave original:', error.message);
    }
  }

  // Normalizar novamente após possível decodificação
  normalizedKey = normalizedKey
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')  
    .replace(/\r\n/g, '\n')
    .trim();

  console.log('🔑 Chave privada final:', {
    length: normalizedKey.length,
    startsWithBegin: normalizedKey.startsWith('-----BEGIN'),
    endsWithEnd: normalizedKey.includes('-----END'),
    firstLine: normalizedKey.split('\n')[0]
  });

  // Validar formato PEM
  if (!normalizedKey.includes('-----BEGIN PRIVATE KEY-----') && 
      !normalizedKey.includes('-----BEGIN RSA PRIVATE KEY-----')) {
    console.error('❌ Formato PEM inválido - cabeçalho não encontrado');
    console.error('   Primeiros 200 caracteres da chave:');
    console.error('  ', normalizedKey.substring(0, 200));
    console.error('   Código dos primeiros caracteres:');
    console.error('  ', normalizedKey.substring(0, 50).split('').map(c => c.charCodeAt(0)).join(' '));
    throw new Error('Invalid PEM format: missing BEGIN PRIVATE KEY header');
  }

  if (!normalizedKey.includes('-----END PRIVATE KEY-----') && 
      !normalizedKey.includes('-----END RSA PRIVATE KEY-----')) {
    console.error('❌ Formato PEM inválido - rodapé não encontrado');
    throw new Error('Invalid PEM format: missing END PRIVATE KEY footer');
  }

  return normalizedKey;
}

try {
  // Normalizar a chave privada antes de usar
  console.log('🔥 Inicializando Firebase Admin SDK...');
  console.log('🔍 Chave privada bruta:', {
    length: config.private_key ? config.private_key.length : 0,
    startsWithQuote: config.private_key ? config.private_key.startsWith('"') : false,
    firstChars: config.private_key ? config.private_key.substring(0, 30) + '...' : 'null'
  });
  
  const normalizedPrivateKey = normalizePrivateKey(config.private_key);

  const serviceAccount = {
    type: config.type,
    project_id: config.project_id,
    private_key_id: config.private_key_id,
    private_key: normalizedPrivateKey,
    client_email: config.client_email,
    client_id: config.client_id,
    auth_uri: config.auth_uri,
    token_uri: config.token_uri,
    auth_provider_x509_cert_url: config.auth_provider_x509_cert_url,
    client_x509_cert_url: config.client_x509_cert_url
  };

  // Log para debug (removendo informações sensíveis)
  console.log('✅ Configuração Firebase preparada:', {
    project_id: config.project_id,
    client_email: config.client_email,
    private_key_id: config.private_key_id,
    hasPrivateKey: !!normalizedPrivateKey,
    keyFirstLine: normalizedPrivateKey.split('\n')[0]
  });

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: config.project_id
  });

  console.log('✅ Firebase Admin SDK inicializado com sucesso');

  // Adicionar flag de inicialização
  module.exports = admin;
  module.exports.initialized = true;

} catch (error) {
  console.error('❌ Erro ao inicializar Firebase Admin SDK:', error.message);
  
  // Debug adicional para troubleshooting
  console.error('🔍 Debug info:');
  console.error('   - NODE_ENV:', process.env.NODE_ENV);
  console.error('   - Platform:', process.platform);
  console.error('   - Private key length:', config.private_key ? config.private_key.length : 'null');
  console.error('   - Raw private key start:', config.private_key ? config.private_key.substring(0, 100) + '...' : 'null');
  
  // Em produção, não deve crashar a aplicação por causa do Firebase
  if (process.env.NODE_ENV === 'production') {
    console.error('🚨 Firebase falhou, mas continuando execução em produção...');
    
    // Exportar um mock para evitar crashes
    module.exports = {
      auth: () => ({ 
        verifyIdToken: async () => { 
          throw new Error('Firebase Admin SDK não inicializado'); 
        } 
      }),
      initialized: false,
      error: error.message
    };
  } else {
    // Em desenvolvimento, pode ser útil crashar para debug
    throw error;
  }
}