const validateRequest = (schema) => {
    return (req, res, next) => {
      try {
        const validatedData = schema.parse(req.body);
        req.body = validatedData;
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