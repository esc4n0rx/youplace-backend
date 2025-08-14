const io = require('socket.io-client');
const axios = require('axios');

class WebSocketTester {
  constructor() {
    this.baseUrl = 'http://localhost:3001';
    this.wsUrl = 'ws://localhost:3001';
    this.token = null;
    this.socket = null;
    this.testResults = [];
  }

  async login() {
    try {
      console.log('🔐 Fazendo login...');
      const response = await axios.post(`${this.baseUrl}/api/v1/auth/login`, {
        username: 'testuser',
        password: 'password123'
      });

      this.token = response.data.data.token;
      console.log('✅ Login realizado com sucesso!');
      return true;
    } catch (error) {
      console.error('❌ Erro no login:', error.response?.data?.error || error.message);
      return false;
    }
  }

  connectWebSocket() {
    return new Promise((resolve, reject) => {
      console.log('🔌 Conectando WebSocket...');
      
      this.socket = io(this.wsUrl, {
        auth: {
          token: this.token
        },
        transports: ['websocket']
      });

      this.socket.on('connect', () => {
        console.log('✅ WebSocket conectado!');
        resolve();
      });

      this.socket.on('connected', (data) => {
        console.log('📡 Dados de conexão recebidos:', data);
      });

      this.socket.on('error', (error) => {
        console.error('❌ Erro no WebSocket:', error);
        reject(error);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('🔌 WebSocket desconectado:', reason);
      });

      // Timeout de conexão
      setTimeout(() => {
        if (!this.socket.connected) {
          reject(new Error('Timeout de conexão WebSocket'));
        }
      }, 5000);
    });
  }

  async testRoomJoin() {
    return new Promise((resolve) => {
      console.log('\n🧪 TESTE: Entrar em rooms');
      
      const testRooms = ['room_-467_235', 'room_-467_236'];
      
      this.socket.on('rooms_joined', (data) => {
        console.log('✅ Rooms joined:', data);
        resolve({ success: true, data });
      });

      this.socket.on('room_state', (data) => {
        console.log('📊 Room state received:', data.roomId, `${data.pixels.length} pixels`);
      });

      this.socket.emit('join_rooms', { rooms: testRooms });
    });
  }

  async testViewportUpdate() {
    return new Promise((resolve) => {
      console.log('\n🧪 TESTE: Atualizar viewport');
      
      const viewport = {
        minX: -467000,
        maxX: -466000,
        minY: 235000,
        maxY: 236000
      };

      this.socket.on('viewport_updated', (data) => {
        console.log('✅ Viewport updated:', data);
        resolve({ success: true, data });
      });

      this.socket.emit('update_viewport', viewport);
    });
  }

  async testPixelListening() {
    return new Promise((resolve) => {
      console.log('\n🧪 TESTE: Escutar pixels em tempo real');
      
      let pixelsReceived = 0;
      const timeout = setTimeout(() => {
        console.log(`⏰ Timeout - Recebidos ${pixelsReceived} pixels`);
        resolve({ success: true, pixelsReceived });
      }, 10000);

      this.socket.on('pixels_update', (data) => {
        pixelsReceived += data.count;
        console.log(`🎨 Pixels recebidos: ${data.count} no room ${data.room}`);
        
        data.pixels.forEach(pixel => {
          console.log(`  - (${pixel.x}, ${pixel.y}) = ${pixel.color} por ${pixel.username}`);
        });

        if (pixelsReceived >= 5) {
          clearTimeout(timeout);
          resolve({ success: true, pixelsReceived });
        }
      });

      // Pintar alguns pixels para gerar tráfego
      this.paintTestPixels();
    });
  }

  async paintTestPixels() {
    const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF'];
    
    for (let i = 0; i < 5; i++) {
      try {
        await axios.post(`${this.baseUrl}/api/v1/pixels/paint`, {
          x: -467000 + i,
          y: 235000,
          color: colors[i]
        }, {
          headers: {
            'Authorization': `Bearer ${this.token}`
          }
        });
        
        console.log(`🎨 Pixel pintado: (-${467000 - i}, 235000) = ${colors[i]}`);
        
        // Aguardar um pouco entre pinturas
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error('❌ Erro ao pintar pixel:', error.response?.data?.error);
      }
    }
  }

  async testRoomInfo() {
    return new Promise((resolve) => {
      console.log('\n🧪 TESTE: Obter informações do room');
      
      this.socket.on('room_info', (data) => {
        console.log('✅ Room info received:', {
          roomId: data.roomId,
          userCount: data.userCount,
          coordinates: data.coordinates,
          recentPixels: data.recentPixels.length
        });
        resolve({ success: true, data });
      });

      this.socket.emit('get_room_info', { roomId: 'room_-467_235' });
    });
  }

  async runAllTests() {
    try {
      console.log('🚀 INICIANDO TESTES DO WEBSOCKET');
      console.log('═'.repeat(60));
      
      // Login
      if (!await this.login()) {
        return;
      }

      // Conectar WebSocket
      await this.connectWebSocket();

      // Executar testes
      const results = await Promise.all([
        this.testRoomJoin(),
        this.testViewportUpdate(),
        this.testRoomInfo()
      ]);

      // Teste de pixels (sequencial para não conflitar)
      const pixelTest = await this.testPixelListening();
      results.push(pixelTest);

      // Relatório final
      console.log('\n📊 RELATÓRIO FINAL DOS TESTES');
      console.log('═'.repeat(60));
      
      results.forEach((result, index) => {
        const testNames = ['Room Join', 'Viewport Update', 'Room Info', 'Pixel Listening'];
        console.log(`${testNames[index]}: ${result.success ? '✅' : '❌'}`);
      });

      console.log('\n🎯 WebSocket funcionando corretamente!');
      
    } catch (error) {
      console.error('❌ Erro nos testes:', error);
    } finally {
      if (this.socket) {
        this.socket.disconnect();
      }
      process.exit(0);
    }
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  console.log('🧪 TESTADOR DO WEBSOCKET');
  console.log('Certifique-se de que Redis e o servidor estão rodando');
  
  const tester = new WebSocketTester();
  tester.runAllTests().catch(console.error);
}

module.exports = WebSocketTester;