// App.js - Fully revised with Shift sprint, FOV controls (9/0), fixed third-person view, and error fixes
import { useRef, useState, useEffect } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { Box, Plane, Environment, Sky } from '@react-three/drei';
import * as THREE from 'three';
import { io } from 'socket.io-client';
import './App.css';

function CameraController({ playersRef, playerId, viewMode }) {
  const { camera } = useThree();
  const offsetRef = useRef(new THREE.Vector3(0, 2, 6)); // third-person distance
  const targetFovRef = useRef(75);
  const currentFovRef = useRef(75);

  useEffect(() => {
    camera.rotation.order = 'YXZ';
  }, [camera]);

  useFrame((state, delta) => {
    const players = playersRef.current;
    if (!playerId || !players[playerId]) return;
    const player = players[playerId];
    const pos = player.position;
    const rot = player.rotation;
    const eyeY = pos[1] + 1.6;

    // Smooth FOV transition
    currentFovRef.current = THREE.MathUtils.lerp(currentFovRef.current, targetFovRef.current, 0.1);
    camera.fov = currentFovRef.current;
    camera.updateProjectionMatrix();

    if (viewMode === 'first') {
      camera.position.set(pos[0], eyeY, pos[2]);
      camera.rotation.set(rot[0], rot[1], rot[2]);
    } else {
      // THIRD PERSON - now follows pitch + yaw like first person
      const euler = new THREE.Euler(rot[0], rot[1], 0, 'YXZ');
      offsetRef.current.set(0, 2, 6); // base distance
      offsetRef.current.applyEuler(euler);

      const idealCamPos = new THREE.Vector3(pos[0], pos[1] + 1.6, pos[2]).add(offsetRef.current);

      // Smooth camera follow
      camera.position.lerp(idealCamPos, 0.1);
      camera.lookAt(pos[0], eyeY, pos[2]);
    }

    // Sprint FOV kick
    const speed = Math.sqrt(player.moveDir?.f ** 2 + player.moveDir?.r ** 2) || 0;
    const isSprinting = speed > 0 && playersRef.current.keys?.shift;
    targetFovRef.current = 75 + (isSprinting ? 15 : 0); // +15 FOV when sprinting
  });

  // Expose for external FOV control
  camera.setFovTarget = (fov) => {
    targetFovRef.current = THREE.MathUtils.clamp(fov, 30, 120);
  };

  return null;
}

function Player({ position = [0, 0, 0], rotation = [0, 0, 0], moveDir = { f: 0, r: 0 }, expression = 'neutral', color }) {
  const leftLegRef = useRef();
  const rightLegRef = useRef();
  const leftArmGroupRef = useRef();
  const rightArmGroupRef = useRef();
  const leftHandRef = useRef();
  const rightHandRef = useRef();

  useFrame((state, delta) => {
    const speed = Math.sqrt(moveDir.f ** 2 + moveDir.r ** 2);
    const time = state.clock.getElapsedTime();
    let legAngle = 0;
    let armAngle = 0;
    if (speed > 0) {
      const walkSpeed = 10; // Adjust for faster/slower animation
      legAngle = Math.sin(time * walkSpeed) * (Math.PI / 6); // Max 30 degrees swing
      armAngle = -legAngle; // Arms swing opposite to legs
    }

    if (leftLegRef.current) leftLegRef.current.rotation.x = legAngle;
    if (rightLegRef.current) rightLegRef.current.rotation.x = -legAngle;
    if (leftArmGroupRef.current) leftArmGroupRef.current.rotation.x = armAngle * 0.5;

    // Expression animation (overrides right arm for wave)
    if (expression === 'wave') {
      if (rightArmGroupRef.current) {
        rightArmGroupRef.current.rotation.x = -Math.PI / 3;
        rightArmGroupRef.current.rotation.y = Math.PI / 1.6;
        rightArmGroupRef.current.rotation.z = Math.PI / 2;
      }
      // Shake hand
      const shakeSpeed = 20;
      const shakeAngle = Math.sin(time * shakeSpeed) * (Math.PI / 12); // Small shake
      if (rightHandRef.current) rightHandRef.current.rotation.y = shakeAngle;
    } else {
      if (rightArmGroupRef.current) {
        rightArmGroupRef.current.rotation.x = -armAngle * 0.5;
        rightArmGroupRef.current.rotation.y = 0;
        rightArmGroupRef.current.rotation.z = 0;
      }
      if (rightHandRef.current) rightHandRef.current.rotation.y = 0;
    }
  });

  return (
    <group position={position} rotation={[0, rotation[1], 0]}>
      {/* Body */}
      <Box
        args={[0.6, 0.8, 0.4]}
        position={[0, 1.2, 0]}
        castShadow
      >
        <meshStandardMaterial color={color} roughness={0.7} metalness={0.1} />
      </Box>
      {/* Left Leg Group */}
      <group ref={leftLegRef} position={[-0.15, 0.8, 0]}>
        <Box args={[0.3, 0.8, 0.4]} position={[0, -0.4, 0]} castShadow>
          <meshStandardMaterial color={color} roughness={0.7} metalness={0.1} />
        </Box>
        <Box args={[0.3, 0.2, 0.5]} position={[0, -0.7, 0]} castShadow>
          <meshStandardMaterial color={color} roughness={0.7} metalness={0.1} />
        </Box>
      </group>
      {/* Right Leg Group */}
      <group ref={rightLegRef} position={[0.15, 0.8, 0]}>
        <Box args={[0.3, 0.8, 0.4]} position={[0, -0.4, 0]} castShadow>
          <meshStandardMaterial color={color} roughness={0.7} metalness={0.1} />
        </Box>
        <Box args={[0.3, 0.2, 0.5]} position={[0, -0.7, 0]} castShadow>
          <meshStandardMaterial color={color} roughness={0.7} metalness={0.1} />
        </Box>
      </group>
      {/* Left Arm Group (shoulder > arm > hand) */}
      <group ref={leftArmGroupRef} position={[-0.4, 1.4, 0]}>
        <Box args={[0.3, 0.3, 0.3]} castShadow> {/* Shoulder */}
          <meshStandardMaterial color={color} roughness={0.7} metalness={0.1} />
        </Box>
        <group position={[0, -0.3, 0]}>
          <Box args={[0.2, 0.6, 0.2]} castShadow> {/* Arm */}
            <meshStandardMaterial color={color} roughness={0.7} metalness={0.1} />
          </Box>
          <Box ref={leftHandRef} position={[0, -0.35, 0]} args={[0.25, 0.15, 0.25]} castShadow>
            <meshStandardMaterial color={color} roughness={0.7} metalness={0.1} />
          </Box>
        </group>
      </group>
      {/* Right Arm Group (shoulder > arm > hand) */}
      <group ref={rightArmGroupRef} position={[0.4, 1.4, 0]}>
        <Box args={[0.3, 0.3, 0.3]} castShadow> {/* Shoulder */}
          <meshStandardMaterial color={color} roughness={0.7} metalness={0.1} />
        </Box>
        <group position={[0, -0.3, 0]}>
          <Box args={[0.2, 0.6, 0.2]} castShadow> {/* Arm */}
            <meshStandardMaterial color={color} roughness={0.7} metalness={0.1} />
          </Box>
          <Box ref={rightHandRef} position={[0, -0.35, 0]} args={[0.25, 0.15, 0.25]} castShadow>
            <meshStandardMaterial color={color} roughness={0.7} metalness={0.1} />
          </Box>
        </group>
      </group>
      {/* Head */}
      <group position={[0, 1.6, 0]} rotation={[rotation[0], 0, 0]}>
        <Box
          args={[0.5, 0.5, 0.5]}
          position={[0, 0.25, 0]}
          castShadow
        >
          <meshStandardMaterial color={color} roughness={0.7} metalness={0.1} />
        </Box>
        {/* Left Eye */}
        <mesh position={[-0.15, 0.25, -0.26]}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshStandardMaterial color="white" />
          <mesh position={[0, 0, -0.08]}>
            <sphereGeometry args={[0.03, 16, 16]} />
            <meshStandardMaterial color="black" />
          </mesh>
        </mesh>
        {/* Right Eye */}
        <mesh position={[0.15, 0.25, -0.26]}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshStandardMaterial color="white" />
          <mesh position={[0, 0, -0.08]}>
            <sphereGeometry args={[0.03, 16, 16]} />
            <meshStandardMaterial color="black" />
          </mesh>
        </mesh>
      </group>
    </group>
  );
}

function App() {
  const [socket, setSocket] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [players, setPlayers] = useState({});
  const [keys, setKeys] = useState({});
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const [viewMode, setViewMode] = useState('third'); // 'first' or 'third'
  const canvasRef = useRef();
  const playersRef = useRef({});
  const keysRef = useRef({});
  const cameraRef = useRef(); // NEW: For accessing camera directly

  useEffect(() => {
    playersRef.current = players;
    playersRef.current.keys = keys; // Attach keys to playersRef for CameraController access
  }, [players, keys]);

  useEffect(() => {
    keysRef.current = keys;
  }, [keys]);

  useEffect(() => {
    const s = io('http://localhost:3001');
    setSocket(s);

    s.on('init', ({ playerId: pid, players: initPlayers }) => {
      const initializedPlayers = Object.fromEntries(
        Object.entries(initPlayers).map(([id, player]) => [
          id,
          {
            ...player,
            position: player.position || [0, 0, 0],
            rotation: player.rotation || [0, 0, 0],
            moveDir: player.moveDir || { f: 0, r: 0 },
            expression: player.expression || 'neutral',
          },
        ])
      );
      setPlayerId(pid);
      setPlayers(initializedPlayers);
    });

    s.on('newPlayer', (player) => {
      setPlayers((prev) => ({
        ...prev,
        [player.id]: {
          ...player,
          position: player.position || [0, 0, 0],
          rotation: player.rotation || [0, 0, 0],
          moveDir: player.moveDir || { f: 0, r: 0 },
          expression: player.expression || 'neutral',
        },
      }));
    });

    s.on('playerUpdated', ({ playerId: pid, position, rotation, moveDir, expression }) => {
      setPlayers((prev) => ({
        ...prev,
        [pid]: { ...prev[pid], position, rotation, moveDir, expression }
      }));
    });

    s.on('playerDisconnected', (id) => {
      setPlayers((prev) => {
        const p = { ...prev };
        delete p[id];
        return p;
      });
    });

    return () => s.disconnect();
  }, []);

  // Pointer lock
  useEffect(() => {
    const handleClick = () => {
      if (canvasRef.current && !isPointerLocked) {
        canvasRef.current.requestPointerLock();
      }
    };

    const handlePointerLockChange = () => {
      setIsPointerLocked(!!document.pointerLockElement);
    };

    document.addEventListener('click', handleClick);
    document.addEventListener('pointerlockchange', handlePointerLockChange);
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
    };
  }, [isPointerLocked]);

  // Mouse look
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isPointerLocked || !playerId || !socket) return;

      const currentPlayers = playersRef.current;
      const p = currentPlayers[playerId];
      if (!p) return;

      const yaw = p.rotation[1] - e.movementX * 0.002;
      let pitch = p.rotation[0] - e.movementY * 0.002;
      pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch));

      const newRot = [pitch, yaw, 0];

      setPlayers((prev) => ({
        ...prev,
        [playerId]: { ...prev[playerId], rotation: newRot }
      }));

      socket.emit('updatePlayer', { rotation: newRot });
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, [isPointerLocked, playerId, socket]);

  // Keyboard input - FIXED with cameraRef
  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd'].includes(key)) {
        setKeys((prev) => ({ ...prev, [key]: true }));
        e.preventDefault();
      }
      if (key === 'shift') {
        setKeys((prev) => ({ ...prev, shift: true }));
      }
      if (key === 'e') {
        toggleExpression();
        e.preventDefault();
      }
      if (e.key === 'Escape') {
        document.exitPointerLock();
      }
      // FOV Controls
      if (key === '9' && cameraRef.current) {
        cameraRef.current.setFovTarget(cameraRef.current.fov - 10);
        e.preventDefault();
      }
      if (key === '0' && cameraRef.current) {
        cameraRef.current.setFovTarget(cameraRef.current.fov + 10);
        e.preventDefault();
      }
    };

    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd'].includes(key)) {
        setKeys((prev) => ({ ...prev, [key]: false }));
        e.preventDefault();
      }
      if (key === 'shift') {
        setKeys((prev) => ({ ...prev, shift: false }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [playerId, socket]);

  const toggleExpression = () => {
    if (!playerId || !socket) return;
    const currentPlayers = playersRef.current;
    const p = currentPlayers[playerId];
    if (!p) return;
    const newExpr = p.expression === 'neutral' ? 'wave' : 'neutral';
    setPlayers((prev) => ({
      ...prev,
      [playerId]: { ...prev[playerId], expression: newExpr }
    }));
    socket.emit('updatePlayer', { expression: newExpr });
  };

  // Movement update loop
  useEffect(() => {
    const interval = setInterval(() => {
      if (!playerId || !socket) return;
      const currentPlayers = playersRef.current;
      const p = currentPlayers[playerId];
      if (!p) return;
      const k = keysRef.current;

      let moveF = 0;
      let moveR = 0;
      if (k.w) moveF += 1;
      if (k.s) moveF -= 1;
      if (k.d) moveR += 1;
      if (k.a) moveR -= 1;

      const hasMovement = Math.abs(moveF) + Math.abs(moveR) > 0;
      let newPos = [...p.position];
      if (hasMovement) {
        const yaw = p.rotation[1];
        const forwardX = -Math.sin(yaw);
        const forwardZ = -Math.cos(yaw);
        const rightX = Math.cos(yaw);
        const rightZ = -Math.sin(yaw);

        const baseSpeed = 5; // Adjusted base speed
        const speed = k.shift ? baseSpeed * 2 : baseSpeed;

        const deltaTime = 0.05; // 50ms interval
        const dx = (moveF * forwardX + moveR * rightX) * speed * deltaTime;
        const dz = (moveF * forwardZ + moveR * rightZ) * speed * deltaTime;

        newPos = [
          p.position[0] + dx,
          p.position[1],
          p.position[2] + dz
        ];
      }

      const newMoveDir = { f: moveF, r: moveR };
      const moveDirChanged = !p.moveDir || p.moveDir.f !== newMoveDir.f || p.moveDir.r !== newMoveDir.r;
      const positionChanged = hasMovement;

      if (positionChanged || moveDirChanged) {
        setPlayers((prev) => ({
          ...prev,
          [playerId]: { ...prev[playerId], position: newPos, moveDir: newMoveDir }
        }));

        socket.emit('updatePlayer', { position: newPos, moveDir: newMoveDir });
      }
    }, 50);

    return () => clearInterval(interval);
  }, [playerId, socket]);

  const toggleView = () => {
    setViewMode((v) => (v === 'first' ? 'third' : 'first'));
  };

  const visiblePlayers = Object.values(players).filter(
    (player) => player.id !== playerId || viewMode === 'third'
  );

  return (
    <div>
      <div className="html-canvas" style={{ background: '' }}>
        <div className="pin-me">
          <div className="layer-canv">
            <Canvas
              ref={canvasRef}
              style={{ width: '100%', height: '100%' }}
              shadows
              onCreated={(state) => {
                cameraRef.current = state.camera;
              }}
            >
              <CameraController
                playersRef={playersRef}
                playerId={playerId}
                viewMode={viewMode}
              />
              <ambientLight intensity={0.4} />
              <directionalLight
                position={[5, 10, 5]}
                intensity={1.2}
                castShadow
                shadow-mapSize={[2048, 2048]}
                shadow-camera-near={0.1}
                shadow-camera-far={50}
                shadow-camera-left={-15}
                shadow-camera-right={15}
                shadow-camera-top={15}
                shadow-camera-bottom={-15}
              />
              <pointLight position={[-5, 5, -5]} intensity={0.5} />
              <Plane args={[50, 50]} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
                <meshStandardMaterial color="#444" roughness={0.8} metalness={0.2} />
              </Plane>
              {visiblePlayers.map((player) => (
                <Player
                  key={player.id}
                  position={player.position}
                  rotation={player.rotation}
                  moveDir={player.moveDir || { f: 0, r: 0 }}
                  expression={player.expression || 'neutral'}
                  color={`hsl(${((player.id - 1) * 137.5) % 360}, 70%, 50%)`}
                />
              ))}
              <Environment preset="sunset" />
              <Sky sunPosition={[100, 20, 100]} />
            </Canvas>
          </div>
        </div>
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: 20,
            color: 'white',
            zIndex: 100,
            pointerEvents: 'none',
            fontFamily: 'monospace',
            fontSize: '14px',
          }}
        >
          <div style={{ pointerEvents: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              onClick={toggleView}
              style={{
                background: 'rgba(0,0,0,0.5)',
                color: 'white',
                border: '1px solid white',
                padding: '8px 12px',
                cursor: 'pointer',
              }}
            >
              View: {viewMode.toUpperCase()}
            </button>
            <div>
              {!isPointerLocked && (
                <p>Click canvas to lock mouse &nbsp; ESC to unlock &nbsp; WASD to move &nbsp; E to toggle wave</p>
              )}
              <p>Player {playerId} ({Object.keys(players).length}/16)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;