const cron = require('node-cron');
const CreditService = require('../domain/services/credit-service');

class DailyBonusJob {
  constructor() {
    this.creditService = new CreditService();
    this.isRunning = false;
  }

  start() {
    // Executar todo dia às 00:00 (meia-noite)
    cron.schedule('0 0 * * *', async () => {
      if (this.isRunning) {
        console.log('⏳ Job de bônus diário já está executando, pulando...');
        return;
      }

      this.isRunning = true;
      console.log('🎁 Iniciando processamento de bônus diário...');
      
      try {
        const results = await this.creditService.processDailyBonusForAllUsers();
        
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        
        console.log(`✅ Bônus diário processado com sucesso!`);
        console.log(`   👥 Usuários processados: ${results.length}`);
        console.log(`   ✅ Sucessos: ${successful}`);
        console.log(`   ❌ Falhas: ${failed}`);
        
        // Log de falhas se houver
        if (failed > 0) {
          const failures = results.filter(r => !r.success);
          console.log('   🔍 Detalhes das falhas:');
          failures.forEach(f => {
            console.log(`     - Usuário ${f.userId}: ${f.error}`);
          });
        }
        
      } catch (error) {
        console.error('❌ Erro no job de bônus diário:', error);
      } finally {
        this.isRunning = false;
      }
    });

    // Executar também a cada 6 horas como backup (para casos de falha)
    cron.schedule('0 */6 * * *', async () => {
      if (this.isRunning) return;
      
      console.log('🔄 Verificação de bônus diário (backup)...');
      try {
        // Processar apenas usuários que ainda não receberam bônus hoje
        const results = await this.creditService.processDailyBonusForAllUsers();
        const eligible = results.filter(r => r.success).length;
        
        if (eligible > 0) {
          console.log(`🎁 Processamento backup: ${eligible} usuários receberam bônus`);
        } else {
          console.log('✅ Todos os usuários já receberam bônus hoje');
        }
      } catch (error) {
        console.error('❌ Erro no backup de bônus diário:', error);
      }
    });

    console.log('🤖 Job de bônus diário iniciado!');
    console.log('   ⏰ Agendado para: Todo dia às 00:00');
    console.log('   🔄 Backup: A cada 6 horas');
  }

  // Método para executar manualmente (útil para testes)
  async runManually() {
    if (this.isRunning) {
      throw new Error('Job já está executando');
    }

    this.isRunning = true;
    console.log('🎁 Executando bônus diário manualmente...');
    
    try {
      const results = await this.creditService.processDailyBonusForAllUsers();
      return {
        success: true,
        processed: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results
      };
    } finally {
      this.isRunning = false;
    }
  }

  stop() {
    cron.destroy();
    console.log('🛑 Job de bônus diário parado');
  }
}

module.exports = DailyBonusJob;