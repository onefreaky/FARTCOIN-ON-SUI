import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';

const FartyBird = () => {
  const canvasRef = useRef(null);
  const gameLoopRef = useRef(null);
  const [gameState, setGameState] = useState('start'); // 'start', 'playing', 'gameOver'
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(parseInt(localStorage.getItem('fartyBirdBest') || '0'));
  const [powerUps, setPowerUps] = useState([]);
  
  // Game objects
  const gameObjects = useRef({
    bird: {
      x: 100,
      y: 250,
      width: 40,
      height: 40,
      velocity: 0,
      gravity: 0.5,
      jumpStrength: -10,
      rotation: 0
    },
    obstacles: [],
    coins: [],
    powerUps: [],
    particles: []
  });

  // Game settings
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 500;
  const OBSTACLE_WIDTH = 60;
  const OBSTACLE_GAP = 180;
  const OBSTACLE_SPEED = 2;

  // Sound effects
  const playFartSound = () => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(120, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(80, audioContext.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  };

  const playCoinSound = () => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.15);
  };

  // Generate obstacles (price chart style)
  const generateObstacle = (x) => {
    const gapY = Math.random() * (CANVAS_HEIGHT - OBSTACLE_GAP - 100) + 50;
    return {
      x,
      topHeight: gapY,
      bottomY: gapY + OBSTACLE_GAP,
      bottomHeight: CANVAS_HEIGHT - (gapY + OBSTACLE_GAP),
      passed: false,
      chartData: Array.from({ length: 20 }, () => Math.random() * 0.8 + 0.2)
    };
  };

  // Generate coins
  const generateCoin = (x, y) => {
    return {
      x,
      y,
      width: 25,
      height: 25,
      collected: false,
      type: Math.random() > 0.3 ? 'fart' : 'sui',
      rotation: 0,
      sparkles: []
    };
  };

  // Generate power-ups
  const generatePowerUp = (x, y) => {
    const types = ['bullish', 'moon', 'diamond'];
    return {
      x,
      y,
      width: 30,
      height: 30,
      type: types[Math.floor(Math.random() * types.length)],
      collected: false,
      rotation: 0,
      pulse: 0
    };
  };

  // Collision detection
  const checkCollision = (rect1, rect2) => {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
  };

  // Game loop
  const gameLoop = useCallback(() => {
    if (gameState !== 'playing') return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const bird = gameObjects.current.bird;
    const obstacles = gameObjects.current.obstacles;
    const coins = gameObjects.current.coins;
    const powerUps = gameObjects.current.powerUps;
    const particles = gameObjects.current.particles;

    // Clear canvas
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw background gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(1, '#16213e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Update bird physics
    bird.velocity += bird.gravity;
    bird.y += bird.velocity;
    bird.rotation = Math.min(bird.velocity * 3, 30);

    // Check boundaries
    if (bird.y > CANVAS_HEIGHT - bird.height || bird.y < 0) {
      setGameState('gameOver');
      return;
    }

    // Update obstacles
    obstacles.forEach((obstacle, index) => {
      obstacle.x -= OBSTACLE_SPEED;
      
      // Check if bird passed obstacle
      if (!obstacle.passed && bird.x > obstacle.x + OBSTACLE_WIDTH) {
        obstacle.passed = true;
        setScore(prev => prev + 10);
        playFartSound();
      }
      
      // Check collision with obstacles
      const topObstacle = { x: obstacle.x, y: 0, width: OBSTACLE_WIDTH, height: obstacle.topHeight };
      const bottomObstacle = { x: obstacle.x, y: obstacle.bottomY, width: OBSTACLE_WIDTH, height: obstacle.bottomHeight };
      
      if (checkCollision(bird, topObstacle) || checkCollision(bird, bottomObstacle)) {
        setGameState('gameOver');
        return;
      }
      
      // Remove off-screen obstacles
      if (obstacle.x + OBSTACLE_WIDTH < 0) {
        obstacles.splice(index, 1);
      }
    });

    // Update coins
    coins.forEach((coin, index) => {
      coin.x -= OBSTACLE_SPEED;
      coin.rotation += 0.1;
      
      if (!coin.collected && checkCollision(bird, coin)) {
        coin.collected = true;
        setScore(prev => prev + (coin.type === 'fart' ? 5 : 10));
        playCoinSound();
        coins.splice(index, 1);
      }
      
      if (coin.x + coin.width < 0) {
        coins.splice(index, 1);
      }
    });

    // Update power-ups
    powerUps.forEach((powerUp, index) => {
      powerUp.x -= OBSTACLE_SPEED;
      powerUp.rotation += 0.05;
      powerUp.pulse += 0.1;
      
      if (!powerUp.collected && checkCollision(bird, powerUp)) {
        powerUp.collected = true;
        setPowerUps(prev => [...prev, { type: powerUp.type, duration: 300 }]);
        setScore(prev => prev + 20);
        playCoinSound();
        powerUps.splice(index, 1);
      }
      
      if (powerUp.x + powerUp.width < 0) {
        powerUps.splice(index, 1);
      }
    });

    // Generate new obstacles
    if (obstacles.length === 0 || obstacles[obstacles.length - 1].x < CANVAS_WIDTH - 300) {
      obstacles.push(generateObstacle(CANVAS_WIDTH));
      
      // Sometimes add coins or power-ups
      if (Math.random() > 0.7) {
        const coinX = CANVAS_WIDTH + 150;
        const coinY = Math.random() * (CANVAS_HEIGHT - 100) + 50;
        coins.push(generateCoin(coinX, coinY));
      }
      
      if (Math.random() > 0.85) {
        const powerUpX = CANVAS_WIDTH + 200;
        const powerUpY = Math.random() * (CANVAS_HEIGHT - 100) + 50;
        powerUps.push(generatePowerUp(powerUpX, powerUpY));
      }
    }

    // Draw obstacles (price chart style)
    obstacles.forEach(obstacle => {
      ctx.fillStyle = '#0ea5e9';
      ctx.fillRect(obstacle.x, 0, OBSTACLE_WIDTH, obstacle.topHeight);
      ctx.fillRect(obstacle.x, obstacle.bottomY, OBSTACLE_WIDTH, obstacle.bottomHeight);
      
      // Draw chart pattern
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      obstacle.chartData.forEach((point, i) => {
        const x = obstacle.x + (i * 3);
        const y = obstacle.topHeight - (point * 40);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });

    // Draw coins
    coins.forEach(coin => {
      ctx.save();
      ctx.translate(coin.x + coin.width/2, coin.y + coin.height/2);
      ctx.rotate(coin.rotation);
      
      if (coin.type === 'fart') {
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(-coin.width/2, -coin.height/2, coin.width, coin.height);
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Arial';
        ctx.fillText('💨', -6, 4);
      } else {
        ctx.fillStyle = '#06b6d4';
        ctx.fillRect(-coin.width/2, -coin.height/2, coin.width, coin.height);
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Arial';
        ctx.fillText('SUI', -10, 4);
      }
      
      ctx.restore();
    });

    // Draw power-ups
    powerUps.forEach(powerUp => {
      ctx.save();
      ctx.translate(powerUp.x + powerUp.width/2, powerUp.y + powerUp.height/2);
      ctx.rotate(powerUp.rotation);
      
      const pulseSize = Math.sin(powerUp.pulse) * 3;
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(-powerUp.width/2 - pulseSize, -powerUp.height/2 - pulseSize, 
                   powerUp.width + pulseSize * 2, powerUp.height + pulseSize * 2);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px Arial';
      const emoji = powerUp.type === 'bullish' ? '🚀' : 
                   powerUp.type === 'moon' ? '🌙' : '💎';
      ctx.fillText(emoji, -7, 5);
      
      ctx.restore();
    });

    // Draw bird
    ctx.save();
    ctx.translate(bird.x + bird.width/2, bird.y + bird.height/2);
    ctx.rotate(bird.rotation * Math.PI / 180);
    
    // Bird body
    ctx.fillStyle = '#8b5cf6';
    ctx.fillRect(-bird.width/2, -bird.height/2, bird.width, bird.height);
    
    // Bird face
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-bird.width/2 + 5, -bird.height/2 + 5, 10, 10);
    ctx.fillStyle = '#000000';
    ctx.fillRect(-bird.width/2 + 7, -bird.height/2 + 7, 6, 6);
    
    // Fart trail
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(-bird.width/2 - 15, -5, 10, 10);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(-bird.width/2 - 25, -3, 8, 6);
    
    ctx.restore();

    // Draw score
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial';
    ctx.fillText(`Score: ${score}`, 20, 40);

    // Draw active power-ups
    powerUps.forEach((powerUp, index) => {
      ctx.fillStyle = '#f59e0b';
      ctx.font = '16px Arial';
      ctx.fillText(`${powerUp.type.toUpperCase()} (${Math.ceil(powerUp.duration / 60)}s)`, 
                   20, 70 + (index * 25));
    });

    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [gameState, score, powerUps]);

  // Handle input
  const handleJump = useCallback(() => {
    if (gameState === 'playing') {
      gameObjects.current.bird.velocity = gameObjects.current.bird.jumpStrength;
      playFartSound();
    }
  }, [gameState]);

  // Start game
  const startGame = () => {
    setGameState('playing');
    setScore(0);
    setPowerUps([]);
    
    // Reset game objects
    gameObjects.current = {
      bird: {
        x: 100,
        y: 250,
        width: 40,
        height: 40,
        velocity: 0,
        gravity: 0.5,
        jumpStrength: -10,
        rotation: 0
      },
      obstacles: [],
      coins: [],
      powerUps: [],
      particles: []
    };
  };

  // Game over
  useEffect(() => {
    if (gameState === 'gameOver') {
      if (score > bestScore) {
        setBestScore(score);
        localStorage.setItem('fartyBirdBest', score.toString());
      }
    }
  }, [gameState, score, bestScore]);

  // Event listeners
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.code === 'Space' && gameState === 'playing') {
        e.preventDefault();
        handleJump();
      }
    };

    const handleClick = () => {
      if (gameState === 'playing') {
        handleJump();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('click', handleClick);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      if (canvas) {
        canvas.removeEventListener('click', handleClick);
      }
    };
  }, [gameState, handleJump]);

  // Start game loop
  useEffect(() => {
    if (gameState === 'playing') {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    } else {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    }

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameState, gameLoop]);

  // Update power-ups
  useEffect(() => {
    if (powerUps.length > 0) {
      const interval = setInterval(() => {
        setPowerUps(prev => 
          prev.map(powerUp => ({ ...powerUp, duration: powerUp.duration - 1 }))
             .filter(powerUp => powerUp.duration > 0)
        );
      }, 16);

      return () => clearInterval(interval);
    }
  }, [powerUps]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="text-center mb-6">
        <h1 className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-2">
          FARTY BIRD 💨
        </h1>
        <p className="text-xl text-cyan-300 mb-2">SUI-powered Fun on the Blockchain!</p>
        <p className="text-lg text-blue-300">Promoting Fartcoin On Sui 🚀</p>
      </div>

      <Card className="relative bg-gray-900 border-2 border-cyan-500 p-4 mb-4">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="border-2 border-blue-500 rounded-lg bg-gradient-to-b from-purple-900 to-indigo-900"
        />
        
        {gameState === 'start' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-80 rounded-lg">
            <div className="text-center text-white mb-8">
              <h2 className="text-4xl font-bold mb-4">🎮 GET READY TO FART! 💨</h2>
              <p className="text-xl mb-2">Navigate the SUI price charts!</p>
              <p className="text-lg mb-4">Collect fart coins 💨 and SUI coins 🔹</p>
              <div className="text-sm space-y-1">
                <p>📱 Mobile: Tap to fart and fly</p>
                <p>💻 Desktop: Click or press SPACE</p>
              </div>
            </div>
            <Button 
              onClick={startGame}
              className="bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-black font-bold px-8 py-4 text-xl"
            >
              START FARTING! 💨
            </Button>
          </div>
        )}
        
        {gameState === 'gameOver' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-80 rounded-lg">
            <div className="text-center text-white mb-8">
              <h2 className="text-4xl font-bold mb-4">💥 GAME OVER! 💥</h2>
              <p className="text-2xl mb-2">Final Score: {score}</p>
              <p className="text-xl mb-4">Best Score: {bestScore}</p>
              <p className="text-lg text-cyan-300">Keep promoting Fartcoin On Sui! 🚀</p>
            </div>
            <Button 
              onClick={startGame}
              className="bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-500 hover:to-blue-600 text-white font-bold px-8 py-4 text-xl"
            >
              FART AGAIN! 💨
            </Button>
          </div>
        )}
      </Card>

      <div className="flex gap-4 mb-4">
        <Badge className="bg-blue-600 text-white px-4 py-2">Score: {score}</Badge>
        <Badge className="bg-purple-600 text-white px-4 py-2">Best: {bestScore}</Badge>
      </div>

      <div className="text-center text-cyan-300 max-w-md">
        <p className="text-sm">
          🎯 Collect blue fart coins (5 pts) and SUI coins (10 pts)<br/>
          🚀 Grab power-ups for bullish bonuses (20 pts)<br/>
          💨 Every fart propels you through the price charts!
        </p>
      </div>
    </div>
  );
};

export default FartyBird;