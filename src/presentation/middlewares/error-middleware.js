const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);
  
    // Erro conhecido da aplicação
    if (err.message) {
      return res.status(400).json({
        success: false,
        error: err.message
      });
    }
  
    // Erro genérico
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  };
  
  const notFoundHandler = (req, res) => {
    res.status(404).json({
      success: false,
      error: 'Endpoint não encontrado'
    });
  };
  
  module.exports = {
    errorHandler,
    notFoundHandler
  };