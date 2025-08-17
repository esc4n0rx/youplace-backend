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

// Função para normalizar apenas os escapes da chave privada PEM
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

  // Normalizar apenas os escapes - SEM tentar decodificar base64
  normalizedKey = normalizedKey
    .replace(/\\\\n/g, '\n')  // Escapes duplos \\n -> \n
    .replace(/\\n/g, '\n')    // Escapes simples \n -> \n
    .replace(/\\\\r/g, '\r')  // Escapes duplos \\r -> \r
    .replace(/\\r/g, '\r')    // Escapes simples \r -> \r
    .replace(/\r\n/g, '\n')   // CRLF -> LF
    .replace(/\\"/g, '"')     // Aspas escapadas
    .replace(/\\\\/g, '\\')   // Barras duplas
    .trim();

  console.log('🔑 Chave após normalização:', {
    length: normalizedKey.length,
    startsCorrectly: normalizedKey.startsWith('-----BEGIN PRIVATE KEY-----'),
    hasProperLineBreaks: normalizedKey.includes('\n'),
    lineCount: normalizedKey.split('\n').length,
    firstLine: normalizedKey.split('\n')[0],
    lastLine: normalizedKey.split('\n').pop()
  });

  // Validar estrutura PEM
  const lines = normalizedKey.split('\n').filter(line => line.trim().length > 0);
  
  console.log('🔍 Estrutura PEM:', {
    totalLines: lines.length,
    firstLine: lines[0],
    lastLine: lines[lines.length - 1],
    hasValidHeader: lines[0] === '-----BEGIN PRIVATE KEY-----',
    hasValidFooter: lines[lines.length - 1] === '-----END PRIVATE KEY-----'
  });

  // Validar cabeçalho
  if (!normalizedKey.includes('-----BEGIN PRIVATE KEY-----')) {
    console.error('❌ Cabeçalho PEM não encontrado');
    console.error('   Primeira linha:', lines[0]);
    throw new Error('Invalid PEM format: missing BEGIN PRIVATE KEY header');
  }

  // Validar rodapé
  if (!normalizedKey.includes('-----END PRIVATE KEY-----')) {
    console.error('❌ Rodapé PEM não encontrado');
    console.error('   Última linha:', lines[lines.length - 1]);
    throw new Error('Invalid PEM format: missing END PRIVATE KEY footer');
  }

  // Garantir formatação limpa
  const cleanedKey = lines.join('\n');

  console.log('✅ Chave PEM validada e normalizada:', {
    length: cleanedKey.length,
    lines: lines.length,
    valid: true
  });

  return cleanedKey;
}

try {
  console.log('🔥 Inicializando Firebase Admin SDK...');
  console.log('🔍 Chave privada original:', {
    length: config.private_key ? config.private_key.length : 0,
    startsWithBegin: config.private_key ? config.private_key.startsWith('-----BEGIN') : false,
    hasEscapes: config.private_key ? config.private_key.includes('\\n') : false,
    sample: config.private_key ? config.private_key.substring(0, 50) + '...' : 'null'
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

  console.log('✅ Service Account preparado:', {
    project_id: config.project_id,
    client_email: config.client_email,
    private_key_id: config.private_key_id,
    hasValidKey: !!normalizedPrivateKey
  });

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: config.project_id
  });

  console.log('✅ Firebase Admin SDK inicializado com sucesso');
  module.exports = admin;
  module.exports.initialized = true;

} catch (error) {
  console.error('❌ Erro ao inicializar Firebase Admin SDK:', error.message);
  
  console.error('🔍 Debug detalhado:');
  console.error('   - Tipo do erro:', error.constructor.name);
  console.error('   - Código do erro:', error.errorInfo ? error.errorInfo.code : 'N/A');
  console.error('   - NODE_ENV:', process.env.NODE_ENV);
  
  if (config.private_key) {
    console.error('   - Sample da chave original:', config.private_key.substring(0, 100) + '...');
  }
  
  // Em produção, não crashar a aplicação
  if (process.env.NODE_ENV === 'production') {
    console.error('🚨 Continuando sem Firebase em produção...');
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
    throw error;
  }
}