import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';

const FartyBird = () => {
  const canvasRef = useRef(null);
  const gameLoopRef = useRef(null);
  const [gameState, setGameState] = useState('start'); // 'start', 'countdown', 'playing', 'gameOver'
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(parseInt(localStorage.getItem('fartyBirdBest') || '0'));
  const [powerUps, setPowerUps] = useState([]);
  const [countdown, setCountdown] = useState(3);
  const [isInvincible, setIsInvincible] = useState(false);
  const [speedBoost, setSpeedBoost] = useState(false);
  
  // Game objects
  const gameObjects = useRef({
    bird: {
      x: 100,
      y: 250,
      width: 40,
      height: 40,
      velocity: 0,
      gravity: 0.3,
      jumpStrength: -6,
      rotation: 0
    },
    obstacles: [],
    coins: [],
    powerUps: [],
    particles: [],
    candles: []
  });

  // Game settings
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 500;
  const OBSTACLE_WIDTH = 60;
  const OBSTACLE_GAP = 200;
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

  const playBigFartSound = () => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(150, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(60, audioContext.currentTime + 0.3);
    
    gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.4);
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
    const isCandle = Math.random() > 0.4; // 60% chance for candle obstacles
    const isGreen = Math.random() > 0.5;
    
    return {
      x,
      topHeight: gapY,
      bottomY: gapY + OBSTACLE_GAP,
      bottomHeight: CANVAS_HEIGHT - (gapY + OBSTACLE_GAP),
      passed: false,
      isCandle,
      isGreen,
      chartData: Array.from({ length: 20 }, () => Math.random() * 0.8 + 0.2)
    };
  };

  // Generate coins
  const generateCoin = (x, y) => {
    const types = ['fart', 'sui', 'diamond', 'rocket'];
    const weights = [0.4, 0.3, 0.2, 0.1]; // Weighted probability
    let random = Math.random();
    let selectedType = types[0];
    
    for (let i = 0; i < weights.length; i++) {
      if (random < weights[i]) {
        selectedType = types[i];
        break;
      }
      random -= weights[i];
    }
    
    return {
      x,
      y,
      width: 25,
      height: 25,
      collected: false,
      type: selectedType,
      rotation: 0,
      sparkles: []
    };
  };

  // Generate power-ups
  const generatePowerUp = (x, y) => {
    const types = ['bullish', 'moon', 'diamond', 'speed', 'invincibility'];
    const weights = [0.2, 0.2, 0.2, 0.2, 0.2]; // Equal probability
    let random = Math.random();
    let selectedType = types[0];
    
    for (let i = 0; i < weights.length; i++) {
      if (random < weights[i]) {
        selectedType = types[i];
        break;
      }
      random -= weights[i];
    }
    
    return {
      x,
      y,
      width: 30,
      height: 30,
      type: selectedType,
      collected: false,
      rotation: 0,
      pulse: 0
    };
  };

  // Generate candles
  const generateCandle = (x, baseY) => {
    const isGreen = Math.random() > 0.5;
    const height = Math.random() * 40 + 20;
    return {
      x,
      y: baseY - height,
      width: 8,
      height,
      isGreen,
      wickTop: Math.random() * 10,
      wickBottom: Math.random() * 10
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
    const candles = gameObjects.current.candles;

    // Clear canvas
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw background gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(1, '#16213e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Current speed (normal or boosted)
    const currentSpeed = speedBoost ? OBSTACLE_SPEED * 1.5 : OBSTACLE_SPEED;

    // Update bird physics
    bird.velocity += bird.gravity;
    bird.y += bird.velocity;
    bird.rotation = Math.min(bird.velocity * 2, 20);

    // Cap velocity to prevent too fast falling
    bird.velocity = Math.min(bird.velocity, 6);

    // Check boundaries (only if not invincible)
    if (!isInvincible && (bird.y > CANVAS_HEIGHT - bird.height || bird.y < 0)) {
      setGameState('gameOver');
      return;
    }

    // Update obstacles
    obstacles.forEach((obstacle, index) => {
      obstacle.x -= currentSpeed;
      
      // Check if bird passed obstacle
      if (!obstacle.passed && bird.x > obstacle.x + OBSTACLE_WIDTH) {
        obstacle.passed = true;
        setScore(prev => prev + 10);
        playFartSound();
      }
      
      // Check collision with obstacles (only if not invincible)
      if (!isInvincible) {
        const topObstacle = { x: obstacle.x, y: 0, width: OBSTACLE_WIDTH, height: obstacle.topHeight };
        const bottomObstacle = { x: obstacle.x, y: obstacle.bottomY, width: OBSTACLE_WIDTH, height: obstacle.bottomHeight };
        
        if (checkCollision(bird, topObstacle) || checkCollision(bird, bottomObstacle)) {
          setGameState('gameOver');
          return;
        }
      }
      
      // Remove off-screen obstacles
      if (obstacle.x + OBSTACLE_WIDTH < 0) {
        obstacles.splice(index, 1);
      }
    });

    // Update coins
    coins.forEach((coin, index) => {
      coin.x -= currentSpeed;
      coin.rotation += 0.1;
      
      if (!coin.collected && checkCollision(bird, coin)) {
        coin.collected = true;
        let points = 5;
        if (coin.type === 'sui') points = 10;
        else if (coin.type === 'diamond') points = 15;
        else if (coin.type === 'rocket') points = 20;
        
        setScore(prev => prev + points);
        playCoinSound();
        coins.splice(index, 1);
      }
      
      if (coin.x + coin.width < 0) {
        coins.splice(index, 1);
      }
    });

    // Update power-ups
    powerUps.forEach((powerUp, index) => {
      powerUp.x -= currentSpeed;
      powerUp.rotation += 0.05;
      powerUp.pulse += 0.1;
      
      if (!powerUp.collected && checkCollision(bird, powerUp)) {
        powerUp.collected = true;
        
        if (powerUp.type === 'speed') {
          setPowerUps(prev => [...prev, { type: 'speed', duration: 300 }]);
          setSpeedBoost(true);
        } else if (powerUp.type === 'invincibility') {
          setPowerUps(prev => [...prev, { type: 'invincibility', duration: 300 }]);
          setIsInvincible(true);
        } else {
          setPowerUps(prev => [...prev, { type: powerUp.type, duration: 300 }]);
        }
        
        setScore(prev => prev + 20);
        playCoinSound();
        powerUps.splice(index, 1);
      }
      
      if (powerUp.x + powerUp.width < 0) {
        powerUps.splice(index, 1);
      }
    });

    // Update candles
    candles.forEach((candle, index) => {
      candle.x -= currentSpeed;
      
      if (candle.x + candle.width < 0) {
        candles.splice(index, 1);
      }
    });

    // Generate new obstacles
    if (obstacles.length === 0 || obstacles[obstacles.length - 1].x < CANVAS_WIDTH - 300) {
      obstacles.push(generateObstacle(CANVAS_WIDTH));
      
      // Add more coins and power-ups
      if (Math.random() > 0.4) {
        const coinX = CANVAS_WIDTH + 120 + Math.random() * 80;
        const coinY = Math.random() * (CANVAS_HEIGHT - 150) + 75;
        coins.push(generateCoin(coinX, coinY));
      }
      
      if (Math.random() > 0.5) {
        const coin2X = CANVAS_WIDTH + 150 + Math.random() * 100;
        const coin2Y = Math.random() * (CANVAS_HEIGHT - 150) + 75;
        coins.push(generateCoin(coin2X, coin2Y));
      }
      
      if (Math.random() > 0.7) {
        const powerUpX = CANVAS_WIDTH + 180 + Math.random() * 60;
        const powerUpY = Math.random() * (CANVAS_HEIGHT - 150) + 75;
        powerUps.push(generatePowerUp(powerUpX, powerUpY));
      }
    }

    // Draw obstacles (price chart style or candle style)
    obstacles.forEach(obstacle => {
      if (obstacle.isCandle) {
        // Draw candlestick obstacles
        const color = obstacle.isGreen ? '#10b981' : '#ef4444';
        const shadowColor = obstacle.isGreen ? '#059669' : '#dc2626';
        
        // Top candle
        ctx.fillStyle = color;
        ctx.fillRect(obstacle.x, 0, OBSTACLE_WIDTH, obstacle.topHeight);
        
        // Add candle body effect
        ctx.fillStyle = shadowColor;
        ctx.fillRect(obstacle.x + 5, 5, OBSTACLE_WIDTH - 10, obstacle.topHeight - 10);
        
        // Candle wicks
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(obstacle.x + OBSTACLE_WIDTH/2 - 2, 0, 4, obstacle.topHeight);
        
        // Bottom candle
        ctx.fillStyle = color;
        ctx.fillRect(obstacle.x, obstacle.bottomY, OBSTACLE_WIDTH, obstacle.bottomHeight);
        
        // Add candle body effect
        ctx.fillStyle = shadowColor;
        ctx.fillRect(obstacle.x + 5, obstacle.bottomY + 5, OBSTACLE_WIDTH - 10, obstacle.bottomHeight - 10);
        
        // Candle wicks
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(obstacle.x + OBSTACLE_WIDTH/2 - 2, obstacle.bottomY, 4, obstacle.bottomHeight);
        
        // Add price labels
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        const priceTop = obstacle.isGreen ? '$1.25' : '$0.85';
        const priceBottom = obstacle.isGreen ? '$1.15' : '$0.95';
        ctx.fillText(priceTop, obstacle.x + OBSTACLE_WIDTH/2, obstacle.topHeight - 10);
        ctx.fillText(priceBottom, obstacle.x + OBSTACLE_WIDTH/2, obstacle.bottomY + 20);
        ctx.textAlign = 'left';
      } else {
        // Draw regular SUI obstacles
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
        
        // Add SUI logo
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('SUI', obstacle.x + OBSTACLE_WIDTH/2, obstacle.topHeight - 10);
        ctx.fillText('SUI', obstacle.x + OBSTACLE_WIDTH/2, obstacle.bottomY + 20);
        ctx.textAlign = 'left';
      }
    });

    // Remove candles drawing section since they're now part of obstacles
    // candles.forEach(candle => {
    //   ctx.fillStyle = candle.isGreen ? '#10b981' : '#ef4444';
    //   
    //   // Draw wick
    //   ctx.fillRect(candle.x + candle.width/2 - 1, candle.y - candle.wickTop, 2, candle.wickTop);
    //   ctx.fillRect(candle.x + candle.width/2 - 1, candle.y + candle.height, 2, candle.wickBottom);
    //   
    //   // Draw candle body
    //   ctx.fillRect(candle.x, candle.y, candle.width, candle.height);
    // });

    // Draw coins with better visual effects
    coins.forEach(coin => {
      ctx.save();
      ctx.translate(coin.x + coin.width/2, coin.y + coin.height/2);
      ctx.rotate(coin.rotation);
      
      let emoji, color, shadowColor;
      if (coin.type === 'fart') {
        emoji = '💨';
        color = '#3b82f6';
        shadowColor = '#1d4ed8';
      } else if (coin.type === 'sui') {
        emoji = 'SUI';
        color = '#06b6d4';
        shadowColor = '#0891b2';
      } else if (coin.type === 'diamond') {
        emoji = '💎';
        color = '#8b5cf6';
        shadowColor = '#7c3aed';
      } else if (coin.type === 'rocket') {
        emoji = '🚀';
        color = '#f59e0b';
        shadowColor = '#d97706';
      }
      
      // Add glow effect
      ctx.shadowColor = shadowColor;
      ctx.shadowBlur = 10;
      
      // Draw coin background
      ctx.fillStyle = color;
      ctx.fillRect(-coin.width/2, -coin.height/2, coin.width, coin.height);
      
      // Draw coin border
      ctx.strokeStyle = shadowColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(-coin.width/2, -coin.height/2, coin.width, coin.height);
      
      // Reset shadow
      ctx.shadowBlur = 0;
      
      // Draw emoji/text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      if (coin.type === 'sui') {
        ctx.fillText(emoji, 0, 4);
      } else {
        ctx.fillText(emoji, 0, 4);
      }
      ctx.textAlign = 'left';
      
      ctx.restore();
    });

    // Draw power-ups
    powerUps.forEach(powerUp => {
      ctx.save();
      ctx.translate(powerUp.x + powerUp.width/2, powerUp.y + powerUp.height/2);
      ctx.rotate(powerUp.rotation);
      
      const pulseSize = Math.sin(powerUp.pulse) * 3;
      
      let color, emoji;
      if (powerUp.type === 'speed') {
        color = '#10b981';
        emoji = '⚡';
      } else if (powerUp.type === 'invincibility') {
        color = '#8b5cf6';
        emoji = '🛡️';
      } else if (powerUp.type === 'bullish') {
        color = '#f59e0b';
        emoji = '🚀';
      } else if (powerUp.type === 'moon') {
        color = '#f59e0b';
        emoji = '🌙';
      } else {
        color = '#f59e0b';
        emoji = '💎';
      }
      
      ctx.fillStyle = color;
      ctx.fillRect(-powerUp.width/2 - pulseSize, -powerUp.height/2 - pulseSize, 
                   powerUp.width + pulseSize * 2, powerUp.height + pulseSize * 2);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px Arial';
      ctx.fillText(emoji, -7, 5);
      
      ctx.restore();
    });

    // Draw bird (with invincibility effect)
    ctx.save();
    ctx.translate(bird.x + bird.width/2, bird.y + bird.height/2);
    ctx.rotate(bird.rotation * Math.PI / 180);
    
    // Invincibility effect
    if (isInvincible) {
      ctx.shadowColor = '#8b5cf6';
      ctx.shadowBlur = 20;
    }
    
    // Bird body
    ctx.fillStyle = isInvincible ? '#8b5cf6' : '#8b5cf6';
    ctx.fillRect(-bird.width/2, -bird.height/2, bird.width, bird.height);
    
    // Bird face
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-bird.width/2 + 5, -bird.height/2 + 5, 10, 10);
    ctx.fillStyle = '#000000';
    ctx.fillRect(-bird.width/2 + 7, -bird.height/2 + 7, 6, 6);
    
    // Fart trail (enhanced if speed boost)
    ctx.fillStyle = speedBoost ? '#ff6b35' : '#fbbf24';
    ctx.fillRect(-bird.width/2 - 15, -5, speedBoost ? 15 : 10, speedBoost ? 15 : 10);
    ctx.fillStyle = speedBoost ? '#ff8500' : '#f59e0b';
    ctx.fillRect(-bird.width/2 - 25, -3, speedBoost ? 12 : 8, speedBoost ? 9 : 6);
    
    ctx.restore();

    // Draw score
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial';
    ctx.fillText(`Score: ${score}`, 20, 40);

    // Draw active power-ups
    let yOffset = 70;
    powerUps.forEach((powerUp) => {
      let displayName = powerUp.type.toUpperCase();
      if (powerUp.type === 'invincibility') displayName = 'INVINCIBLE';
      if (powerUp.type === 'speed') displayName = 'SPEED BOOST';
      
      ctx.fillStyle = '#f59e0b';
      ctx.font = '16px Arial';
      ctx.fillText(`${displayName} (${Math.ceil(powerUp.duration / 60)}s)`, 20, yOffset);
      yOffset += 25;
    });

    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [gameState, score, powerUps, isInvincible, speedBoost]);

  // Handle input
  const handleJump = useCallback(() => {
    if (gameState === 'playing') {
      gameObjects.current.bird.velocity = gameObjects.current.bird.jumpStrength;
      playFartSound();
    }
  }, [gameState]);

  // Start game
  const startGame = () => {
    setGameState('countdown');
    setCountdown(3);
    setScore(0);
    setPowerUps([]);
    setIsInvincible(false);
    setSpeedBoost(false);
    
    // Reset game objects
    gameObjects.current = {
      bird: {
        x: 100,
        y: 250,
        width: 40,
        height: 40,
        velocity: 0,
        gravity: 0.3,
        jumpStrength: -6,
        rotation: 0
      },
      obstacles: [],
      coins: [],
      powerUps: [],
      particles: [],
      candles: []
    };
  };

  // Countdown effect
  useEffect(() => {
    let timer;
    if (gameState === 'countdown' && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown(prev => prev - 1);
        playBigFartSound();
      }, 1000);
    } else if (gameState === 'countdown' && countdown === 0) {
      setGameState('playing');
    }
    return () => clearTimeout(timer);
  }, [gameState, countdown]);

  // Share score functionality
  const shareScore = (platform) => {
    const text = `🎮 I just scored ${score} points in Farty Bird! 💨 SUI-powered blockchain gaming promoting Fartcoin On Sui! 🚀 Can you beat my score?`;
    const url = window.location.href;
    
    switch(platform) {
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
        break;
      case 'instagram':
        // Instagram doesn't have direct sharing via URL, so we copy to clipboard
        navigator.clipboard.writeText(`${text} ${url}`);
        alert('Score copied to clipboard! Share it on Instagram! 📱');
        break;
      case 'tiktok':
        // TikTok doesn't have direct sharing via URL, so we copy to clipboard
        navigator.clipboard.writeText(`${text} ${url}`);
        alert('Score copied to clipboard! Share it on TikTok! 🎵');
        break;
      default:
        break;
    }
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
        setPowerUps(prev => {
          const updated = prev.map(powerUp => ({ ...powerUp, duration: powerUp.duration - 1 }))
                             .filter(powerUp => powerUp.duration > 0);
          
          // Check if speed boost ended
          const hasSpeedBoost = updated.some(p => p.type === 'speed');
          if (!hasSpeedBoost && speedBoost) {
            setSpeedBoost(false);
          }
          
          // Check if invincibility ended
          const hasInvincibility = updated.some(p => p.type === 'invincibility');
          if (!hasInvincibility && isInvincible) {
            setIsInvincible(false);
          }
          
          return updated;
        });
      }, 16);

      return () => clearInterval(interval);
    }
  }, [powerUps, speedBoost, isInvincible]);

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
        
        {gameState === 'countdown' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-90 rounded-lg">
            <div className="text-center text-white">
              <h2 className="text-6xl font-bold mb-8 text-yellow-400">GET READY!</h2>
              <div className="text-9xl font-bold text-orange-500 mb-4 animate-pulse">
                {countdown}
              </div>
              <p className="text-2xl text-cyan-300">💨 FART COUNTDOWN! 💨</p>
              <p className="text-lg text-blue-300 mt-4">
                Navigate the SUI charts & collect coins!
              </p>
            </div>
          </div>
        )}
        
        {gameState === 'gameOver' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-80 rounded-lg">
            <div className="text-center text-white mb-8">
              <h2 className="text-4xl font-bold mb-4">💥 GAME OVER! 💥</h2>
              <p className="text-2xl mb-2">Final Score: {score}</p>
              <p className="text-xl mb-4">Best Score: {bestScore}</p>
              <p className="text-lg text-cyan-300 mb-6">Keep promoting Fartcoin On Sui! 🚀</p>
              
              {/* Share Score Buttons */}
              <div className="flex flex-col gap-3 mb-6">
                <p className="text-md text-yellow-300">Share your score!</p>
                <div className="flex gap-3 justify-center">
                  <Button 
                    onClick={() => shareScore('twitter')}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 text-sm"
                  >
                    Share on 𝕏 (Twitter)
                  </Button>
                  <Button 
                    onClick={() => shareScore('instagram')}
                    className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-4 py-2 text-sm"
                  >
                    Share on Instagram
                  </Button>
                  <Button 
                    onClick={() => shareScore('tiktok')}
                    className="bg-black hover:bg-gray-800 text-white px-4 py-2 text-sm"
                  >
                    Share on TikTok
                  </Button>
                </div>
              </div>
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
          💨 <strong>Fart Coins:</strong> 5 pts | 🔹 <strong>SUI Coins:</strong> 10 pts | 💎 <strong>Diamond:</strong> 15 pts | 🚀 <strong>Rocket:</strong> 20 pts<br/>
          ⚡ <strong>Speed Boost:</strong> Go faster! | 🛡️ <strong>Invincibility:</strong> 5 seconds safe!<br/>
          🚀 <strong>Bullish Power-ups:</strong> 20 pts each | 📈 <strong>Navigate green & red candles!</strong>
        </p>
      </div>
    </div>
  );
};

export default FartyBird;