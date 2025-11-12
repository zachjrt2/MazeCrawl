import React, { useState, useEffect, useRef } from 'react';
import { Gamepad2, Users, Zap, Trophy } from 'lucide-react';

// Maze Generator using Recursive Backtracking
function generateMaze(width, height) {
  const maze = Array(height).fill(null).map(() => Array(width).fill(1));
  
  function carve(x, y) {
    maze[y][x] = 0;
    
    const directions = [
      [0, -1], [1, 0], [0, 1], [-1, 0]
    ].sort(() => Math.random() - 0.5);
    
    for (const [dx, dy] of directions) {
      const nx = x + dx * 2;
      const ny = y + dy * 2;
      
      if (nx >= 0 && nx < width && ny >= 0 && ny < height && maze[ny][nx] === 1) {
        maze[y + dy][x + dx] = 0;
        carve(nx, ny);
      }
    }
  }
  
  carve(0, 0);
  maze[0][0] = 0;
  maze[height - 1][width - 1] = 0;
  
  return maze;
}

export default function MazeCrawl() {
  const [level, setLevel] = useState(1);
  const [mazeSize, setMazeSize] = useState(10);
  const [maze, setMaze] = useState([]);
  const [playerPos, setPlayerPos] = useState({ x: 0, y: 0 });
  const [moveQueue, setMoveQueue] = useState([]);
  const [recentCommands, setRecentCommands] = useState([]);
  const [connected, setConnected] = useState(false);
  const [channel, setChannel] = useState('the_aia');
  const [status, setStatus] = useState('');
  const [highestLevel, setHighestLevel] = useState(1);
  
  const twitchClientRef = useRef(null);
  const gameLoopRef = useRef(null);

  // Initialize maze
  useEffect(() => {
    const newMaze = generateMaze(mazeSize, mazeSize);
    setMaze(newMaze);
    setPlayerPos({ x: 0, y: 0 });
  }, [mazeSize]);

  // Connect to Twitch
  const connectToTwitch = async () => {
    if (!channel.trim()) {
      setStatus('Please enter a channel name');
      return;
    }

    try {
      // Disconnect existing
      if (twitchClientRef.current) {
        await twitchClientRef.current.disconnect();
      }

      // Load tmi.js if not loaded
      if (!window.tmi) {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/tmi.js/1.8.5/tmi.min.js';
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      const client = new window.tmi.Client({
        channels: [channel.toLowerCase()]
      });

      client.on('message', (ch, tags, message, self) => {
        handleTwitchMessage(tags.username, message);
      });

      await client.connect();
      twitchClientRef.current = client;
      setConnected(true);
      setStatus(`Connected to #${channel}`);
    } catch (error) {
      setStatus(`Connection failed: ${error.message}`);
    }
  };

  const handleTwitchMessage = (username, message) => {
    const cmd = message.trim().toLowerCase()[0];
    const validMoves = { u: 'up', d: 'down', l: 'left', r: 'right' };
    
    if (validMoves[cmd]) {
      setMoveQueue(prev => [...prev, cmd]);
      setRecentCommands(prev => [
        { username, cmd: validMoves[cmd], time: Date.now() },
        ...prev.slice(0, 4)
      ]);
    }
  };

  // Game loop - process one move per tick
  useEffect(() => {
    if (!connected || maze.length === 0) return;

    gameLoopRef.current = setInterval(() => {
      setMoveQueue(prev => {
        if (prev.length === 0) return prev;
        
        const [nextMove, ...rest] = prev;
        
        setPlayerPos(currentPos => {
          let newX = currentPos.x;
          let newY = currentPos.y;
          
          switch (nextMove) {
            case 'u': newY = Math.max(0, currentPos.y - 1); break;
            case 'd': newY = Math.min(mazeSize - 1, currentPos.y + 1); break;
            case 'l': newX = Math.max(0, currentPos.x - 1); break;
            case 'r': newX = Math.min(mazeSize - 1, currentPos.x + 1); break;
          }
          
          // Check if valid move (not wall)
          if (maze[newY] && maze[newY][newX] === 0) {
            // Check if reached exit
            if (newX === mazeSize - 1 && newY === mazeSize - 1) {
              setTimeout(() => {
                const newLevel = level + 1;
                setLevel(newLevel);
                setHighestLevel(prev => Math.max(prev, newLevel));
                setMazeSize(10 + (newLevel - 1) * 2);
                setMoveQueue([]);
              }, 100);
            }
            return { x: newX, y: newY };
          }
          
          return currentPos;
        });
        
        return rest;
      });
    }, 250);

    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [connected, maze, level, mazeSize]);

  // Dynamic neon color based on level
  const getNeonColor = () => {
    const colors = ['#00ffff', '#00ff88', '#ff00ff', '#ffff00', '#ff0088'];
    return colors[(level - 1) % colors.length];
  };

  const cellSize = Math.min(600 / mazeSize, 60);

  return (
    <div style={{
      background: 'radial-gradient(circle at center, #020212 0%, #000 100%)',
      minHeight: '100vh',
      color: '#fff',
      fontFamily: "'Orbitron', monospace",
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <h1 style={{
          fontSize: '2.5rem',
          margin: '0',
          textShadow: `0 0 20px ${getNeonColor()}`,
          color: getNeonColor()
        }}>
        MazeCrawl: Twitch Trials
        </h1>
      </div>

      {/* Connection Panel */}
      {!connected && (
        <div style={{
          background: 'rgba(10, 10, 30, 0.8)',
          border: `2px solid ${getNeonColor()}`,
          borderRadius: '10px',
          padding: '20px',
          marginBottom: '20px',
          boxShadow: `0 0 20px ${getNeonColor()}33`
        }}>
          <input
            type="text"
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            placeholder="Twitch channel name"
            style={{
              background: '#0a0a1a',
              border: '1px solid #333',
              color: '#fff',
              padding: '10px',
              borderRadius: '5px',
              marginRight: '10px',
              fontSize: '1rem'
            }}
          />
          <button
            onClick={connectToTwitch}
            style={{
              background: getNeonColor(),
              color: '#000',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '5px',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            Connect to Twitch
          </button>
          {status && <div style={{ marginTop: '10px', fontSize: '0.9rem' }}>{status}</div>}
        </div>
      )}

      {/* Stats Bar */}
      {connected && (
        <div style={{
          display: 'flex',
          gap: '20px',
          marginBottom: '20px',
          flexWrap: 'wrap',
          justifyContent: 'center'
        }}>
          <div style={{
            background: 'rgba(10, 10, 30, 0.8)',
            border: '1px solid #333',
            padding: '10px 20px',
            borderRadius: '5px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <Trophy size={20} color={getNeonColor()} />
            <span>Level: <strong>{level}</strong></span>
          </div>
          <div style={{
            background: 'rgba(10, 10, 30, 0.8)',
            border: '1px solid #333',
            padding: '10px 20px',
            borderRadius: '5px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <Gamepad2 size={20} color={getNeonColor()} />
            <span>Size: <strong>{mazeSize}×{mazeSize}</strong></span>
          </div>
          <div style={{
            background: 'rgba(10, 10, 30, 0.8)',
            border: '1px solid #333',
            padding: '10px 20px',
            borderRadius: '5px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <Zap size={20} color={getNeonColor()} />
            <span>Queue: <strong>{moveQueue.length}</strong></span>
          </div>
          <div style={{
            background: 'rgba(10, 10, 30, 0.8)',
            border: '1px solid #333',
            padding: '10px 20px',
            borderRadius: '5px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <Users size={20} color={getNeonColor()} />
            <span>High Score: <strong>{highestLevel}</strong></span>
          </div>
        </div>
      )}

      {/* Main Game Area */}
      {connected && (
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {/* Maze */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${mazeSize}, ${cellSize}px)`,
            gridTemplateRows: `repeat(${mazeSize}, ${cellSize}px)`,
            gap: '1px',
            background: '#000',
            padding: '2px',
            borderRadius: '5px',
            filter: `drop-shadow(0 0 10px ${getNeonColor()})`,
          }}>
            {maze.map((row, y) =>
              row.map((cell, x) => {
                const isPlayer = x === playerPos.x && y === playerPos.y;
                const isExit = x === mazeSize - 1 && y === mazeSize - 1;
                const isStart = x === 0 && y === 0;
                
                return (
                  <div
                    key={`${x}-${y}`}
                    style={{
                      width: cellSize,
                      height: cellSize,
                      background: isPlayer ? getNeonColor() :
                                 isExit ? '#ff0088' :
                                 isStart ? '#00ff88' :
                                 cell === 1 ? '#111133' : '#0a0a1a',
                      boxShadow: isPlayer ? `0 0 20px ${getNeonColor()}` :
                                 isExit ? '0 0 15px #ff0088' :
                                 isStart ? '0 0 10px #00ff88' :
                                 cell === 1 ? `0 0 5px ${getNeonColor()}33` : 'none',
                      transition: 'all 0.15s ease',
                      borderRadius: '2px'
                    }}
                  />
                );
              })
            )}
          </div>

          {/* Recent Commands */}
          <div style={{
            background: 'rgba(10, 10, 30, 0.8)',
            border: '1px solid #333',
            borderRadius: '10px',
            padding: '15px',
            minWidth: '200px',
            maxWidth: '300px'
          }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: getNeonColor() }}>
              Recent Commands
            </h3>
            <div style={{ fontSize: '0.85rem' }}>
              {recentCommands.length === 0 ? (
                <div style={{ color: '#666' }}>Waiting for chat input...</div>
              ) : (
                recentCommands.map((cmd, i) => (
                  <div
                    key={cmd.time}
                    style={{
                      padding: '5px',
                      background: 'rgba(0,255,255,0.1)',
                      marginBottom: '5px',
                      borderRadius: '3px',
                      border: '1px solid #333',
                      opacity: 1 - (i * 0.15)
                    }}
                  >
                    <strong style={{ color: getNeonColor() }}>{cmd.username}:</strong> {cmd.cmd}
                  </div>
                ))
              )}
            </div>
            <div style={{
              marginTop: '15px',
              padding: '10px',
              background: 'rgba(0,0,0,0.5)',
              borderRadius: '5px',
              fontSize: '0.8rem'
            }}>
              <div style={{ marginBottom: '5px', color: getNeonColor() }}>Chat Commands:</div>
              <div>• <strong>u</strong> = Up</div>
              <div>• <strong>d</strong> = Down</div>
              <div>• <strong>l</strong> = Left</div>
              <div>• <strong>r</strong> = Right</div>
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      {!connected && (
        <div style={{
          marginTop: '20px',
          padding: '20px',
          background: 'rgba(10, 10, 30, 0.5)',
          borderRadius: '10px',
          maxWidth: '600px',
          fontSize: '0.9rem',
          lineHeight: '1.6'
        }}>
          <h3 style={{ color: getNeonColor(), marginTop: 0 }}>How to Play:</h3>
          <ul style={{ paddingLeft: '20px' }}>
            <li>Connect to your Twitch channel</li>
            <li>Chat sends commands: <strong>u</strong>, <strong>d</strong>, <strong>l</strong>, <strong>r</strong></li>
            <li>Navigate from the <span style={{ color: '#00ff88' }}>green start</span> to the <span style={{ color: '#ff0088' }}>pink exit</span></li>
            <li>Each level increases maze size by 2×2</li>
            <li>All commands are queued and executed in order</li>
          </ul>
        </div>
      )}
    </div>
  );
}