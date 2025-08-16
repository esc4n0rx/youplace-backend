const admin = require('firebase-admin');
const { firebase: config } = require('./environment');

if (!config.project_id || !config.private_key || !config.client_email) {
  throw new Error('Missing Firebase configuration. Check your environment variables.');
}

// Função para validar e normalizar a chave privada
function normalizePrivateKey(privateKey) {
  if (!privateKey) {
    throw new Error('Private key is null or undefined');
  }

  let normalizedKey = privateKey;

  // Se a chave não começar com -----BEGIN, pode estar codificada em base64
  if (!normalizedKey.startsWith('-----BEGIN')) {
    try {
      // Tentar decodificar de base64
      normalizedKey = Buffer.from(normalizedKey, 'base64').toString('utf8');
    } catch (error) {
      console.warn('Chave privada não é base64 válido, tentando usar diretamente');
    }
  }

  // Normalizar quebras de linha e caracteres especiais
  normalizedKey = normalizedKey
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')  
    .replace(/\r\n/g, '\n')
    .replace(/"/g, '')
    .trim();

  // Validar formato PEM
  if (!normalizedKey.includes('-----BEGIN PRIVATE KEY-----') && 
      !normalizedKey.includes('-----BEGIN RSA PRIVATE KEY-----')) {
    throw new Error('Invalid PEM format: missing BEGIN PRIVATE KEY header');
  }

  if (!normalizedKey.includes('-----END PRIVATE KEY-----') && 
      !normalizedKey.includes('-----END RSA PRIVATE KEY-----')) {
    throw new Error('Invalid PEM format: missing END PRIVATE KEY footer');
  }

  return normalizedKey;
}

try {
  // Normalizar a chave privada antes de usar
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
  console.log('🔥 Inicializando Firebase Admin SDK...');
  console.log(`   Project ID: ${config.project_id}`);
  console.log(`   Client Email: ${config.client_email}`);
  console.log(`   Private Key format: ${normalizedPrivateKey.substring(0, 30)}...`);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: config.project_id
  });

  console.log('✅ Firebase Admin SDK inicializado com sucesso');

} catch (error) {
  console.error('❌ Erro ao inicializar Firebase Admin SDK:', error.message);
  
  // Debug adicional para troubleshooting
  console.error('Debug info:');
  console.error('- NODE_ENV:', process.env.NODE_ENV);
  console.error('- Platform:', process.platform);
  console.error('- Private key length:', config.private_key ? config.private_key.length : 'null');
  console.error('- Private key starts with:', config.private_key ? config.private_key.substring(0, 20) + '...' : 'null');
  
  throw error;
}

module.exports = admin;