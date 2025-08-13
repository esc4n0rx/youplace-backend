const validateRequest = (schema, source = 'body') => {
    return (req, res, next) => {
      try {
        const dataToValidate = source === 'query' ? req.query : 
                             source === 'params' ? req.params : 
                             req.body;
        
        const validatedData = schema.parse(dataToValidate);
        
        if (source === 'query') {
          req.query = validatedData;
        } else if (source === 'params') {
          req.params = validatedData;
        } else {
          req.body = validatedData;
        }
        
        next();
      } catch (error) {
        if (error.errors) {
          // Erro de validação do Zod
          const messages = error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }));
          
          return res.status(400).json({
            success: false,
            error: 'Dados inválidos',
            details: messages
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