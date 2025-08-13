const { supabaseAdmin } = require('../../config/database');
const CreditTransaction = require('../../domain/entities/credit-transaction');

class CreditRepository {
  async createTransaction(transactionData) {
    const { data, error } = await supabaseAdmin
      .from('credit_transactions')
      .insert({
        user_id: transactionData.userId,
        amount: transactionData.amount,
        type: transactionData.type,
        description: transactionData.description
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao criar transação: ${error.message}`);
    }

    return new CreditTransaction(data);
  }

  async updateUserCredits(userId, newCreditAmount) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .update({ credits: newCreditAmount })
      .eq('id', userId)
      .select('credits')
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar créditos: ${error.message}`);
    }

    return data.credits;
  }

  async getUserCredits(userId) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('credits')
      .eq('id', userId)
      .single();

    if (error) {
      throw new Error(`Erro ao buscar créditos: ${error.message}`);
    }

    return data.credits;
  }

  async getLastDailyBonus(userId) {
    const { data, error } = await supabaseAdmin
      .from('credit_transactions')
      .select('created_at')
      .eq('user_id', userId)
      .eq('type', 'daily_bonus')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Erro ao buscar último bônus diário: ${error.message}`);
    }

    return data ? new Date(data.created_at) : null;
  }

  async getTransactionHistory(userId, limit = 20) {
    const { data, error } = await supabaseAdmin
      .from('credit_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Erro ao buscar histórico: ${error.message}`);
    }

    return data.map(transaction => new CreditTransaction(transaction));
  }

  async getAllUsersForDailyBonus() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, credits, username')
      .not('id', 'in', 
        supabaseAdmin
          .from('credit_transactions')
          .select('user_id')
          .eq('type', 'daily_bonus')
          .gte('created_at', today.toISOString())
      );

    if (error) {
      throw new Error(`Erro ao buscar usuários para bônus: ${error.message}`);
    }

    return data || [];
  }
}

module.exports = CreditRepository;