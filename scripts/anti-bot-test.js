const axios = require('axios');
const readline = require('readline');

class AntiBotTester {
  constructor() {
    this.baseUrl = 'http://localhost:3001/api/v1';
    this.token = null;
    this.testResults = [];
  }

  async login() {
    try {
      console.log('🔐 Fazendo login...');
      const response = await axios.post(`${this.baseUrl}/auth/login`, {
        username: 'testuser',
        password: 'password123'
      });

      this.token = response.data.data.token;
      console.log('✅ Login realizado com sucesso!');
      console.log(`Token: ${this.token.substring(0, 20)}...`);
      return true;
    } catch (error) {
      console.error('❌ Erro no login:', error.response?.data?.error || error.message);
      return false;
    }
  }

  async paintPixel(x, y, color = '#FF0000') {
    try {
      const response = await axios.post(`${this.baseUrl}/pixels/paint`, {
        x, y, color
      }, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      return {
        success: true,
        data: response.data,
        riskScore: response.data.riskScore,
        warnings: response.data.warnings
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
        status: error.response?.status
      };
    }
  }

  async getCredits() {
    try {
      const response = await axios.get(`${this.baseUrl}/credits`, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });
      return response.data.data.credits;
    } catch (error) {
      console.error('Erro ao buscar créditos:', error.response?.data?.error);
      return null;
    }
  }

  async testNormalUsage() {
    console.log('\n🧪 TESTE 1: Uso Normal (10 pixels com 1s de intervalo)');
    console.log('─'.repeat(60));
    
    const results = [];
    for (let i = 0; i < 10; i++) {
      const x = 1000 + i;
      const y = 500;
      
      console.log(`Pintando pixel ${i + 1}/10 em (${x}, ${y})...`);
      const result = await this.paintPixel(x, y, '#00FF00');
      
      results.push(result);
      
      if (result.success) {
        console.log(`✅ Sucesso! ${result.warnings ? `Warnings: ${result.warnings.join(', ')}` : ''}`);
        if (result.riskScore) {
          console.log(`⚠️  Risk Score: ${result.riskScore}`);
        }
      } else {
        console.log(`❌ Falhou: ${result.error}`);
      }
      
      // Aguardar 1 segundo (uso normal)
      await this.sleep(1000);
    }
    
    this.testResults.push({
      test: 'Normal Usage',
      success: results.filter(r => r.success).length,
      total: results.length,
      results
    });
  }

  async testFastPainting() {
    console.log('\n🧪 TESTE 2: Pintura Rápida (20 pixels com 0.5s de intervalo)');
    console.log('─'.repeat(60));
    
    const results = [];
    for (let i = 0; i < 20; i++) {
      const x = 2000 + i;
      const y = 500;
      
      console.log(`Pintando pixel rápido ${i + 1}/20 em (${x}, ${y})...`);
      const result = await this.paintPixel(x, y, '#0000FF');
      
      results.push(result);
      
      if (result.success) {
        console.log(`✅ Sucesso! ${result.warnings ? `Warnings: ${result.warnings.join(', ')}` : ''}`);
        if (result.riskScore) {
          console.log(`⚠️  Risk Score: ${result.riskScore}`);
        }
      } else {
        console.log(`❌ Falhou: ${result.error}`);
      }
      
      // Aguardar 0.5 segundos (rápido mas humano)
      await this.sleep(500);
    }
    
    this.testResults.push({
      test: 'Fast Painting',
      success: results.filter(r => r.success).length,
      total: results.length,
      results
    });
  }

  async testBurstAttack() {
    console.log('\n🧪 TESTE 3: Ataque de Burst (50 pixels simultâneos)');
    console.log('─'.repeat(60));
    
    const promises = [];
    for (let i = 0; i < 50; i++) {
      const x = 3000 + i;
      const y = 500;
      promises.push(this.paintPixel(x, y, '#FF00FF'));
    }
    
    console.log('Enviando 50 requisições simultâneas...');
    const results = await Promise.allSettled(promises);
    
    let successCount = 0;
    let blockedCount = 0;
    let errorCount = 0;
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.success) {
        successCount++;
        console.log(`✅ Pixel ${index + 1}: Sucesso`);
      } else if (result.status === 'fulfilled' && !result.value.success) {
        blockedCount++;
        console.log(`🚫 Pixel ${index + 1}: Bloqueado - ${result.value.error}`);
      } else {
        errorCount++;
        console.log(`❌ Pixel ${index + 1}: Erro - ${result.reason}`);
      }
    });
    
    console.log(`\nResultado do Burst Test:`);
    console.log(`✅ Sucessos: ${successCount}`);
    console.log(`🚫 Bloqueados: ${blockedCount}`);
    console.log(`❌ Erros: ${errorCount}`);
    
    this.testResults.push({
      test: 'Burst Attack',
      success: successCount,
      blocked: blockedCount,
      errors: errorCount,
      total: results.length
    });
  }

  async testLinearPattern() {
    console.log('\n🧪 TESTE 4: Padrão Linear (linha reta de 25 pixels)');
    console.log('─'.repeat(60));
    
    const results = [];
    for (let i = 0; i < 25; i++) {
      const x = 4000 + i; // Linha horizontal
      const y = 500;
      
      console.log(`Pintando pixel linear ${i + 1}/25 em (${x}, ${y})...`);
      const result = await this.paintPixel(x, y, '#FFFF00');
      
      results.push(result);
      
      if (result.success) {
        console.log(`✅ Sucesso! ${result.warnings ? `Warnings: ${result.warnings.join(', ')}` : ''}`);
        if (result.riskScore) {
          console.log(`⚠️  Risk Score: ${result.riskScore}`);
        }
      } else {
        console.log(`❌ Falhou: ${result.error}`);
      }
      
      // Intervalo de 0.3s (rápido para formar padrão)
      await this.sleep(300);
    }
    
    this.testResults.push({
      test: 'Linear Pattern',
      success: results.filter(r => r.success).length,
      total: results.length,
      results
    });
  }

  async testVeryFastSequence() {
    console.log('\n🧪 TESTE 5: Sequência Muito Rápida (10 pixels em 2 segundos)');
    console.log('─'.repeat(60));
    
    const results = [];
    const startTime = Date.now();
    
    for (let i = 0; i < 10; i++) {
      const x = 5000 + i;
      const y = 500;
      
      console.log(`Pintando pixel ultra-rápido ${i + 1}/10 em (${x}, ${y})...`);
      const result = await this.paintPixel(x, y, '#FF8800');
      
      results.push(result);
      
      if (result.success) {
        console.log(`✅ Sucesso! ${result.warnings ? `Warnings: ${result.warnings.join(', ')}` : ''}`);
        if (result.riskScore) {
          console.log(`⚠️  Risk Score: ${result.riskScore}`);
        }
      } else {
        console.log(`❌ Falhou: ${result.error}`);
      }
      
      // Sem delay - máxima velocidade
      await this.sleep(100);
    }
    
    const totalTime = Date.now() - startTime;
    console.log(`Tempo total: ${totalTime}ms`);
    
    this.testResults.push({
      test: 'Very Fast Sequence',
      success: results.filter(r => r.success).length,
      total: results.length,
      totalTime,
      results
    });
  }

  async testRateLimitRecovery() {
    console.log('\n🧪 TESTE 6: Recuperação após Rate Limit');
    console.log('─'.repeat(60));
    
    // Tentar um pixel após os testes anteriores
    console.log('Aguardando 10 segundos para recuperação...');
    await this.sleep(10000);
    
    const result = await this.paintPixel(6000, 500, '#00FFFF');
    
    if (result.success) {
      console.log('✅ Recuperação bem-sucedida! Sistema funcionando normalmente.');
    } else {
      console.log(`❌ Ainda bloqueado: ${result.error}`);
    }
    
    this.testResults.push({
      test: 'Rate Limit Recovery',
      success: result.success ? 1 : 0,
      total: 1,
      result
    });
  }

  async runAllTests() {
    console.log('🚀 INICIANDO TESTES DO SISTEMA ANTI-BOT');
    console.log('═'.repeat(60));
    
    if (!await this.login()) {
      return;
    }
    
    // Mostrar créditos iniciais
    const initialCredits = await this.getCredits();
    console.log(`💰 Créditos iniciais: ${initialCredits}`);
    
    // Executar todos os testes
    await this.testNormalUsage();
    await this.testFastPainting();
    await this.testBurstAttack();
    await this.testLinearPattern();
    await this.testVeryFastSequence();
    await this.testRateLimitRecovery();
    
    // Mostrar créditos finais
    const finalCredits = await this.getCredits();
    console.log(`💰 Créditos finais: ${finalCredits}`);
    console.log(`💸 Créditos gastos: ${initialCredits - finalCredits}`);
    
    // Relatório final
    this.generateReport();
  }

  generateReport() {
    console.log('\n📊 RELATÓRIO FINAL DOS TESTES');
    console.log('═'.repeat(60));
    
    this.testResults.forEach(test => {
      console.log(`\n${test.test}:`);
      console.log(`  ✅ Sucessos: ${test.success}/${test.total}`);
      if (test.blocked !== undefined) {
        console.log(`  🚫 Bloqueados: ${test.blocked}`);
      }
      if (test.errors !== undefined) {
        console.log(`  ❌ Erros: ${test.errors}`);
      }
      if (test.totalTime) {
        console.log(`  ⏱️  Tempo: ${test.totalTime}ms`);
      }
      
      const successRate = ((test.success / test.total) * 100).toFixed(1);
      console.log(`  📈 Taxa de sucesso: ${successRate}%`);
    });
    
    console.log('\n🎯 ANÁLISE:');
    console.log('- Teste 1 (Normal): Deve ter ~100% sucesso');
    console.log('- Teste 2 (Rápido): Deve ter 80-100% sucesso');
    console.log('- Teste 3 (Burst): Deve ter <20% sucesso (bloqueado pelo anti-bot)');
    console.log('- Teste 4 (Linear): Deve começar a mostrar warnings/bloqueios');
    console.log('- Teste 5 (Muito Rápido): Deve ter baixo sucesso');
    console.log('- Teste 6 (Recuperação): Deve funcionar após o cooldown');
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Menu interativo
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function runInteractiveMenu() {
  const tester = new AntiBotTester();
  
  while (true) {
    console.log('\n🎮 MENU DE TESTES ANTI-BOT');
    console.log('═'.repeat(40));
    console.log('1. Executar todos os testes');
    console.log('2. Teste de uso normal');
    console.log('3. Teste de pintura rápida');
    console.log('4. Teste de ataque burst');
    console.log('5. Teste de padrão linear');
    console.log('6. Teste muito rápido');
    console.log('7. Fazer login');
    console.log('8. Ver créditos');
    console.log('9. Pintar pixel manual');
    console.log('0. Sair');
    
    const choice = await new Promise(resolve => {
      rl.question('\nEscolha uma opção: ', resolve);
    });
    
    switch (choice) {
      case '1':
        await tester.runAllTests();
        break;
      case '2':
        if (!tester.token) await tester.login();
        await tester.testNormalUsage();
        break;
      case '3':
        if (!tester.token) await tester.login();
        await tester.testFastPainting();
        break;
      case '4':
        if (!tester.token) await tester.login();
        await tester.testBurstAttack();
        break;
      case '5':
        if (!tester.token) await tester.login();
        await tester.testLinearPattern();
        break;
      case '6':
        if (!tester.token) await tester.login();
        await tester.testVeryFastSequence();
        break;
      case '7':
        await tester.login();
        break;
      case '8':
        if (!tester.token) await tester.login();
        const credits = await tester.getCredits();
        console.log(`💰 Créditos atuais: ${credits}`);
        break;
      case '9':
        if (!tester.token) await tester.login();
        const x = await new Promise(resolve => {
          rl.question('Coordenada X: ', resolve);
        });
        const y = await new Promise(resolve => {
          rl.question('Coordenada Y: ', resolve);
        });
        const color = await new Promise(resolve => {
          rl.question('Cor (ex: #FF0000): ', resolve);
        });
        const result = await tester.paintPixel(parseInt(x), parseInt(y), color);
        console.log('Resultado:', result);
        break;
      case '0':
        console.log('👋 Saindo...');
        rl.close();
        return;
      default:
        console.log('❌ Opção inválida!');
    }
  }
}

// Verificar se foi chamado diretamente
if (require.main === module) {
  console.log('🤖 TESTADOR DO SISTEMA ANTI-BOT');
  console.log('Certifique-se de que o servidor está rodando em http://localhost:3001');
  
  runInteractiveMenu().catch(console.error);
}

module.exports = AntiBotTester;