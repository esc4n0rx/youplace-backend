const validateRequest = (schema, source = 'body') => {
  return (req, res, next) => {
    try {
      const dataToValidate = source === 'query' ? req.query : 
                           source === 'params' ? req.params : 
                           req.body;
      
      console.log(`🔍 Validando ${source}:`, JSON.stringify(dataToValidate, null, 2));
      
      const validatedData = schema.parse(dataToValidate);
      
      console.log(`✅ Dados validados com sucesso:`, JSON.stringify(validatedData, null, 2));
      
      if (source === 'query') {
        req.query = validatedData;
      } else if (source === 'params') {
        req.params = validatedData;
      } else {
        req.body = validatedData;
      }
      
      next();
    } catch (error) {
      console.log(`❌ Erro de validação em ${source}:`, error);
      
      if (error.errors) {
        // Erro de validação do Zod
        console.log(`📋 Detalhes dos erros:`, JSON.stringify(error.errors, null, 2));
        
        const messages = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          received: err.received
        }));
        
        return res.status(400).json({
          success: false,
          error: 'Dados inválidos',
          details: messages,
          received: dataToValidate // 🔍 Incluir dados recebidos para debug
        });
      }
      
      return res.status(400).json({
        success: false,
        error: 'Erro de validação',
        details: error.message
      });
    }
  };
};

module.exports = { validateRequest };