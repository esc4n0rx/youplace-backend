const CreditRepository = require('../../data/repositories/credit-repository');

class CreditService {
  constructor() {
    this.creditRepository = new CreditRepository();
  }

  async getUserCredits(userId) {
    return await this.creditRepository.getUserCredits(userId);
  }

  async debitCredits(userId, amount, type, description) {
    const currentCredits = await this.creditRepository.getUserCredits(userId);
    
    if (currentCredits < amount) {
      return false;
    }

    const newAmount = currentCredits - amount;
    
    // Criar transação de débito
    await this.creditRepository.createTransaction({
      userId,
      amount: -amount,
      type,
      description
    });

    // Atualizar saldo do usuário
    await this.creditRepository.updateUserCredits(userId, newAmount);
    
    return true;
  }

  async addCredits(userId, amount, type, description) {
    const currentCredits = await this.creditRepository.getUserCredits(userId);
    const newAmount = currentCredits + amount;
    
    // Criar transação de crédito
    await this.creditRepository.createTransaction({
      userId,
      amount,
      type,
      description
    });

    // Atualizar saldo do usuário
    await this.creditRepository.updateUserCredits(userId, newAmount);
    
    return newAmount;
  }

  async claimDailyBonus(userId) {
    const lastBonus = await this.creditRepository.getLastDailyBonus(userId);
    
    if (lastBonus) {
      const now = new Date();
      const timeDiff = now.getTime() - lastBonus.getTime();
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      
      if (hoursDiff < 24) {
        const hoursRemaining = Math.ceil(24 - hoursDiff);
        throw new Error(`Bônus diário já coletado. Próximo bônus em ${hoursRemaining} horas.`);
      }
    }

    const bonusAmount = 250;
    const newCredits = await this.addCredits(
      userId, 
      bonusAmount, 
      'daily_bonus', 
      'Bônus diário de créditos'
    );

    return {
      credited: bonusAmount,
      totalCredits: newCredits
    };
  }

  async getCreditHistory(userId, limit = 20) {
    return await this.creditRepository.getTransactionHistory(userId, limit);
  }

  // Método melhorado para processar bônus diário
  async processDailyBonusForAllUsers() {
    try {
      const users = await this.creditRepository.getAllUsersForDailyBonus();
      console.log(`🎁 Processando bônus para ${users.length} usuários elegíveis...`);
      
      const results = [];
      let processedCount = 0;

      // Processar em lotes para não sobrecarregar o banco
      const batchSize = 10;
      for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (user) => {
          try {
            const result = await this.claimDailyBonus(user.id);
            processedCount++;
            
            if (processedCount % 50 === 0) {
              console.log(`   📊 Processados: ${processedCount}/${users.length}`);
            }
            
            return {
              userId: user.id,
              success: true,
              credited: result.credited,
              totalCredits: result.totalCredits
            };
          } catch (error) {
            // Se erro é que já coletou hoje, não é erro real
            if (error.message.includes('já coletado')) {
              return {
                userId: user.id,
                success: true,
                credited: 0,
                message: 'Já coletado hoje'
              };
            }
            
            return {
              userId: user.id,
              success: false,
              error: error.message
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        // Pequena pausa entre lotes para não sobrecarregar
        if (i + batchSize < users.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      const successful = results.filter(r => r.success && r.credited > 0).length;
      const alreadyClaimed = results.filter(r => r.success && r.credited === 0).length;
      const totalCreditsDistributed = results
        .filter(r => r.success && r.credited > 0)
        .reduce((sum, r) => sum + r.credited, 0);

      console.log(`✅ Processamento concluído:`);
      console.log(`   💰 ${successful} usuários receberam ${totalCreditsDistributed} créditos`);
      console.log(`   ⏭️  ${alreadyClaimed} usuários já haviam coletado`);

      return results;
    } catch (error) {
      console.error('❌ Erro no processamento de bônus diário:', error);
      throw error;
    }
  }
}

module.exports = CreditService;