import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  animateDice3D,
  applyRemoteDiceMotion,
  beginDiceDrag,
  cancelDiceDrag,
  createDice3D,
  isDiceDragging,
  releaseDiceDrag,
  syncDice3D,
  updateDiceDrag
} from "./Dice3D";
import {
  animateBoard3D,
  createBoard3D,
  disposeObject3D,
  markSelectedTile,
  resolveSelectionPanelHit,
  setActiveCardDeck,
  setSelectionBillboardHover,
  setSelectionBillboardTab,
  syncBoardTiles,
  syncPlayerPieces,
  syncSelectionBillboard
} from "./Board3D";
import { animateSceneEffects3D, createSceneEffects3D, syncMoneyBursts3D } from "./SceneEffects3D";

const PRE_MOVE_STAGES = new Set(["cameraFocusDice", "diceRolling", "diceResult"]);
const HOME_CAMERA_POSITION = { x: 12.2, y: 15.2, z: 14.4 };

function dampVector3(current, target, lambda, delta) {
  const t = 1 - Math.exp(-lambda * delta);
  current.lerp(target, THREE.MathUtils.clamp(t, 0, 1));
}

export default function Monopoly3DScene({
  socket = null,
  worldId = null,
  tableId = "",
  currentUserId = null,
  board,
  players,
  selectedSpaceIndex,
  onSelectSpace,
  currentPlayerId = null,
  rollingDice = false,
  diceFaces = [1, 1],
  cinematic = null,
  moneyBursts = [],
  pendingCard = null,
  selectedSpaceInfo = null,
  cameraFocus = null,
  destinationSpaceIndex = null,
  canRollDice = false,
  onRollDice,
  onDiceGestureChange,
  onDiceMotion,
  onSelectionAction,
  cameraAutoFollow = true
}) {
  const mountRef = useRef(null);
  const modelRef = useRef(null);
  const sceneRef = useRef(null);
  const boardRef = useRef(board);
  const playersRef = useRef(players);
  const selectedRef = useRef(selectedSpaceIndex);
  const onSelectRef = useRef(onSelectSpace);
  const canRollDiceRef = useRef(canRollDice);
  const onRollDiceRef = useRef(onRollDice);
  const onDiceGestureChangeRef = useRef(onDiceGestureChange);
  const onDiceMotionRef = useRef(onDiceMotion);
  const diceRef = useRef(null);
  const onSelectionActionRef = useRef(onSelectionAction);
  const cameraAutoFollowRef = useRef(cameraAutoFollow);
  const localDiceRollRef = useRef({
    active: false,
    startedAt: 0,
    maxUntil: 0
  });
  const sequenceRef = useRef({
    stage: "idle",
    stageTime: 0,
    bufferedPlayers: null
  });
  const visualStateRef = useRef({
    currentPlayerId,
    rollingDice,
    diceFaces,
    cinematic,
    moneyBursts,
    pendingCard,
    selectedSpaceInfo,
    cameraFocus,
    destinationSpaceIndex
  });

  useEffect(() => {
    playersRef.current = players;
    if (modelRef.current) {
      if (PRE_MOVE_STAGES.has(sequenceRef.current.stage)) {
        sequenceRef.current.bufferedPlayers = players;
        return;
      }
      syncBoardTiles(modelRef.current, boardRef.current, players);
      syncPlayerPieces(modelRef.current, players);
    }
  }, [players]);

  useEffect(() => {
    boardRef.current = board;
    if (modelRef.current) {
      syncBoardTiles(modelRef.current, board, playersRef.current);
    }
  }, [board]);

  useEffect(() => {
    selectedRef.current = selectedSpaceIndex;
  }, [selectedSpaceIndex]);

  useEffect(() => {
    onSelectRef.current = onSelectSpace;
  }, [onSelectSpace]);

  useEffect(() => {
    canRollDiceRef.current = canRollDice;
  }, [canRollDice]);

  useEffect(() => {
    onRollDiceRef.current = onRollDice;
  }, [onRollDice]);

  useEffect(() => {
    onDiceGestureChangeRef.current = onDiceGestureChange;
  }, [onDiceGestureChange]);

  useEffect(() => {
    onDiceMotionRef.current = onDiceMotion;
  }, [onDiceMotion]);

  useEffect(() => {
    if (!socket || !worldId || !tableId) return undefined;

    function handleRemoteDiceMotion(payload) {
      if (
        payload?.worldId !== worldId ||
        payload?.tableId !== tableId ||
        String(payload?.actorId) === String(currentUserId) ||
        !diceRef.current
      ) {
        return;
      }
      applyRemoteDiceMotion(diceRef.current, payload.motion, performance.now());
    }

    socket.on("monopoly_dice_motion", handleRemoteDiceMotion);
    return () => socket.off("monopoly_dice_motion", handleRemoteDiceMotion);
  }, [currentUserId, socket, tableId, worldId]);

  useEffect(() => {
    if (!canRollDice) onDiceGestureChange?.(false);
  }, [canRollDice, onDiceGestureChange]);

  useEffect(() => {
    onSelectionActionRef.current = onSelectionAction;
  }, [onSelectionAction]);

  useEffect(() => {
    cameraAutoFollowRef.current = cameraAutoFollow;
  }, [cameraAutoFollow]);

  useEffect(() => {
    visualStateRef.current = {
      currentPlayerId,
      rollingDice,
      diceFaces,
      cinematic,
      moneyBursts,
      pendingCard,
      selectedSpaceInfo,
      cameraFocus,
      destinationSpaceIndex
    };
  }, [cameraFocus, cinematic, currentPlayerId, destinationSpaceIndex, diceFaces, moneyBursts, pendingCard, rollingDice, selectedSpaceInfo]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#07120c");
    scene.fog = new THREE.Fog("#07120c", 18, 38);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
    camera.position.set(HOME_CAMERA_POSITION.x, HOME_CAMERA_POSITION.y, HOME_CAMERA_POSITION.z);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = 8;
    controls.maxDistance = 32;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.target.set(0, 0, 0);

    scene.add(new THREE.HemisphereLight("#fff4dc", "#173629", 1.15));

    const keyLight = new THREE.DirectionalLight("#fff2ce", 2.1);
    keyLight.position.set(7, 13, 6);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 32;
    keyLight.shadow.camera.left = -12;
    keyLight.shadow.camera.right = 12;
    keyLight.shadow.camera.top = 12;
    keyLight.shadow.camera.bottom = -12;
    scene.add(keyLight);

    const fillLight = new THREE.PointLight("#d8f7ff", 1.1, 26);
    fillLight.position.set(-8, 8, -8);
    scene.add(fillLight);

    const model = createBoard3D({ board: boardRef.current, players: playersRef.current });
    modelRef.current = model;
    scene.add(model.group);
    const dice = createDice3D();
    diceRef.current = dice;
    scene.add(dice);
    const diceHitObjects = [dice.userData.glow, ...dice.userData.dice].filter(Boolean);
    const effects = createSceneEffects3D();
    scene.add(effects.layer);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.12);
    const dragPoint = new THREE.Vector3();
    let hoveredActionMesh = null;
    let activeDicePointerId = null;

    function updatePointer(event) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
    }

    function pointOnDiceTable() {
      return raycaster.ray.intersectPlane(dragPlane, dragPoint) ? dragPoint : null;
    }

    function startLocalDiceRoll() {
      const now = performance.now();
      localDiceRollRef.current = {
        active: true,
        startedAt: now,
        maxUntil: now + 4200
      };
      setSequenceStage("cameraFocusDice");
      dice.userData.hovered = false;
    }

    function resize() {
      const width = mount.clientWidth || 1;
      const height = mount.clientHeight || 1;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    }

    function handlePointerDown(event) {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      updatePointer(event);

      if (canRollDiceRef.current && !localDiceRollRef.current.active && !dice.userData.physicsActive) {
        const diceHit = raycaster.intersectObjects(diceHitObjects, false)[0];
        const tablePoint = diceHit ? pointOnDiceTable() : null;
        if (diceHit && tablePoint) {
          event.preventDefault();
          activeDicePointerId = event.pointerId;
          renderer.domElement.setPointerCapture?.(event.pointerId);
          const motion = beginDiceDrag(dice, tablePoint, performance.now());
          onDiceMotionRef.current?.(motion);
          onDiceGestureChangeRef.current?.(true);
          controls.enabled = false;
          dice.userData.hovered = false;
          renderer.domElement.style.cursor = "grabbing";
          return;
        }
      }

      const panelHit = raycaster.intersectObjects(model.interactiveMeshes, false)
        .find((item) => item.object.userData.selectionPanel);
      const panelZone = resolveSelectionPanelHit(model, panelHit);
      if (panelZone?.type === "close") {
        onSelectionActionRef.current?.({ type: "close" });
        return;
      }
      if (panelZone?.type === "tab") {
        setSelectionBillboardTab(model, panelZone.tab);
        syncSelectionBillboard(model, visualStateRef.current.selectedSpaceInfo);
        return;
      }
      if (panelZone?.type === "action" && panelZone.action) {
        onSelectionActionRef.current?.(panelZone.action);
        return;
      }

      const intersections = raycaster.intersectObjects(model.tileMeshes, false);
      const hit = intersections.find((item) => item.object.userData.spaceIndex !== undefined);
      if (hit) {
        onSelectRef.current?.(hit.object.userData.spaceIndex);
      }
    }

    function handlePointerMove(event) {
      updatePointer(event);

      if (activeDicePointerId === event.pointerId && isDiceDragging(dice)) {
        event.preventDefault();
        const tablePoint = pointOnDiceTable();
        if (tablePoint) {
          const motion = updateDiceDrag(dice, tablePoint, performance.now());
          if (motion) onDiceMotionRef.current?.(motion);
        }
        renderer.domElement.style.cursor = "grabbing";
        return;
      }

      const panelHit = raycaster.intersectObjects(model.interactiveMeshes, false)
        .find((item) => item.object.userData.selectionPanel);
      const panelZone = resolveSelectionPanelHit(model, panelHit);
      const nextHoveredAction = panelZone ? panelHit.object : null;

      if (hoveredActionMesh !== nextHoveredAction) {
        if (hoveredActionMesh?.material) {
          hoveredActionMesh.material.opacity = 1;
          if (!hoveredActionMesh.userData.selectionPanel) hoveredActionMesh.scale.setScalar(1);
        }
        hoveredActionMesh = nextHoveredAction;
        if (hoveredActionMesh?.material) {
          hoveredActionMesh.material.opacity = 1;
          if (!hoveredActionMesh.userData.selectionPanel) hoveredActionMesh.scale.setScalar(1.08);
        }
      }
      setSelectionBillboardHover(model, panelZone?.key || "");

      const diceHovered = canRollDiceRef.current && raycaster.intersectObjects(diceHitObjects, false).length > 0;
      dice.userData.hovered = diceHovered;
      renderer.domElement.style.cursor = panelZone || diceHovered ? "pointer" : "";
    }

    function handlePointerUp(event) {
      if (activeDicePointerId !== event.pointerId || !isDiceDragging(dice)) return;
      event.preventDefault();
      renderer.domElement.releasePointerCapture?.(event.pointerId);
      activeDicePointerId = null;
      const releaseMotion = releaseDiceDrag(dice, performance.now());
      renderer.domElement.style.cursor = "";
      if (releaseMotion) {
        onDiceMotionRef.current?.(releaseMotion);
        startLocalDiceRoll();
        window.requestAnimationFrame(() => onRollDiceRef.current?.());
      } else {
        onDiceGestureChangeRef.current?.(false);
      }
    }

    function handlePointerCancel(event) {
      if (activeDicePointerId !== event.pointerId) return;
      renderer.domElement.releasePointerCapture?.(event.pointerId);
      activeDicePointerId = null;
      const motion = cancelDiceDrag(dice);
      onDiceMotionRef.current?.(motion);
      onDiceGestureChangeRef.current?.(false);
      renderer.domElement.style.cursor = "";
    }

    function handlePointerLeave() {
      if (isDiceDragging(dice)) return;
      setSelectionBillboardHover(model, "");
      dice.userData.hovered = false;
      renderer.domElement.style.cursor = "";
    }

    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("pointerup", handlePointerUp);
    renderer.domElement.addEventListener("pointercancel", handlePointerCancel);
    renderer.domElement.addEventListener("pointerleave", handlePointerLeave);
    resize();

    let previousFrameTime = performance.now();
    let elapsedTime = 0;
    const desiredTarget = new THREE.Vector3(0, 0, 0);
    const desiredPosition = new THREE.Vector3(HOME_CAMERA_POSITION.x, HOME_CAMERA_POSITION.y, HOME_CAMERA_POSITION.z);
    const diceTarget = new THREE.Vector3(0, 0.45, 0);
    const dicePosition = new THREE.Vector3(5.8, 8.2, 6.7);
    let frameId = 0;

    function setSequenceStage(nextStage) {
      if (sequenceRef.current.stage === nextStage) return;
      sequenceRef.current.stage = nextStage;
      sequenceRef.current.stageTime = 0;
      if (!PRE_MOVE_STAGES.has(nextStage) && sequenceRef.current.bufferedPlayers) {
        syncPlayerPieces(model, sequenceRef.current.bufferedPlayers);
        sequenceRef.current.bufferedPlayers = null;
      }
    }

    function render() {
      const now = performance.now();
      const delta = Math.min((now - previousFrameTime) / 1000, 0.033);
      previousFrameTime = now;
      elapsedTime += delta;
      const elapsed = elapsedTime;
      const visualState = visualStateRef.current;
      const sequence = sequenceRef.current;
      sequence.stageTime += delta;
      const moverPiece = visualState.cinematic?.playerId ? model.playerPieces.get(visualState.cinematic.playerId) : null;
      const currentPlayer = playersRef.current.find((player) => player.id === visualState.currentPlayerId);
      const movingPlayer = visualState.cinematic?.playerId
        ? playersRef.current.find((player) => player.id === visualState.cinematic.playerId)
        : null;
      const currentIndex = Number.isInteger(currentPlayer?.position) ? currentPlayer.position : null;
      const moverIndex = Number.isInteger(movingPlayer?.position) ? movingPlayer.position : null;
      const rawDestinationIndex = Number.isInteger(visualState.destinationSpaceIndex)
        ? visualState.destinationSpaceIndex
        : visualState.cameraFocus?.spaceIndex ?? null;
      const globalPhase = visualState.cinematic?.phase || null;
      const localRoll = localDiceRollRef.current;
      if (
        localRoll.active &&
        (
          ["dice", "highlightTarget", "move", "settle"].includes(globalPhase) ||
          (!visualState.rollingDice && !globalPhase && !canRollDiceRef.current && performance.now() - localRoll.startedAt > 900) ||
          performance.now() > localRoll.maxUntil
        )
      ) {
        localDiceRollRef.current = { active: false, startedAt: 0, maxUntil: 0 };
      }
      const rollingDiceVisual = visualState.rollingDice || localDiceRollRef.current.active || globalPhase === "diceRolling";
      const focusingDice = globalPhase === "cameraFocusDice";
      const showingDiceResult = globalPhase === "dice" && !rollingDiceVisual;
      const cameraReadyForDice =
        camera.position.distanceTo(dicePosition) < 0.62 &&
        controls.target.distanceTo(diceTarget) < 0.3;

      if (focusingDice) {
        if (!["cameraFocusDice", "diceRolling"].includes(sequence.stage)) {
          setSequenceStage("cameraFocusDice");
        } else if (
          sequence.stage === "cameraFocusDice" &&
          ((sequence.stageTime > 0.34 && cameraReadyForDice) || sequence.stageTime > 0.58)
        ) {
          setSequenceStage("diceRolling");
        }
      } else if (rollingDiceVisual) {
        if (sequence.stage === "idle" || !["cameraFocusDice", "diceRolling"].includes(sequence.stage)) {
          setSequenceStage("cameraFocusDice");
        } else if (
          sequence.stage === "cameraFocusDice" &&
          ((sequence.stageTime > 0.16 && cameraReadyForDice) || sequence.stageTime > 0.42)
        ) {
          setSequenceStage("diceRolling");
        }
      } else if (showingDiceResult && ["cameraFocusDice", "diceRolling"].includes(sequence.stage)) {
        setSequenceStage("diceResult");
      } else if (sequence.stage === "diceResult" && sequence.stageTime > 0.28) {
        if (globalPhase === "move" || globalPhase === "highlightTarget") {
          setSequenceStage("tokenMoving");
        } else if (globalPhase === "settle") {
          setSequenceStage("settle");
        } else if (!globalPhase) {
          setSequenceStage("idle");
        }
      } else if (["move", "highlightTarget"].includes(globalPhase) && !PRE_MOVE_STAGES.has(sequence.stage)) {
        setSequenceStage("tokenMoving");
      } else if (globalPhase === "settle" && sequence.stage !== "settle") {
        setSequenceStage("settle");
      } else if (!rollingDiceVisual && !globalPhase && sequence.stage !== "idle") {
        setSequenceStage("idle");
      }

      const revealDestination = ["tokenMoving", "settle"].includes(sequenceRef.current.stage);
      const destinationIndex = revealDestination ? rawDestinationIndex : null;

      markSelectedTile(model, selectedRef.current, {
        currentIndex,
        moverIndex,
        destinationIndex
      });
      syncSelectionBillboard(model, visualState.selectedSpaceInfo);

      const diceVisualStage =
        rollingDiceVisual && sequenceRef.current.stage === "cameraFocusDice"
          ? "diceRolling"
          : canRollDiceRef.current && sequenceRef.current.stage === "idle"
          ? "rollReady"
          : sequenceRef.current.stage;

      syncDice3D(dice, {
        diceFaces: visualState.diceFaces,
        rollingDice: rollingDiceVisual,
        cinematicPhase: visualState.cinematic?.phase || null,
        visualStage: diceVisualStage
      });
      syncMoneyBursts3D(effects, visualState.moneyBursts, model.playerPieces);

      const diceDragging = isDiceDragging(dice);
      const autoCamera = cameraAutoFollowRef.current && (rollingDiceVisual || visualState.cinematic);
      controls.enabled = !autoCamera && !diceDragging;

      if (!cameraAutoFollowRef.current) {
        desiredTarget.copy(controls.target);
        desiredPosition.copy(camera.position);
      } else if (["cameraFocusDice", "diceRolling", "diceResult"].includes(sequenceRef.current.stage)) {
        desiredTarget.lerp(diceTarget, 0.45);
        desiredPosition.set(6.9, 8.8, 7.4);
      } else if (visualState.cinematic && moverPiece) {
        const cinematicOffset = visualState.cinematic.phase === "settle" ? 7.2 : 8.4;
        desiredTarget.set(moverPiece.position.x, 0.42, moverPiece.position.z);
        desiredPosition.set(moverPiece.position.x + cinematicOffset, 8.8, moverPiece.position.z + cinematicOffset);
      } else if (visualState.cameraFocus?.spaceIndex !== undefined) {
        const tileGroup = model.tileGroups.get(visualState.cameraFocus.spaceIndex);
        const focusPosition = tileGroup?.position || new THREE.Vector3();
        desiredTarget.set(focusPosition.x, 0.35, focusPosition.z);
        desiredPosition.set(focusPosition.x + 8.4, 9.8, focusPosition.z + 8.4);
      } else {
        desiredTarget.set(0, 0, 0);
        desiredPosition.set(HOME_CAMERA_POSITION.x, HOME_CAMERA_POSITION.y, HOME_CAMERA_POSITION.z);
      }

      setActiveCardDeck(model, visualState.pendingCard?.deck || null);

      const cameraLerpSpeed = sequenceRef.current.stage === "cameraFocusDice"
        ? 3.15
        : autoCamera
          ? 3.05
          : 1.55;
      const targetLerpSpeed = sequenceRef.current.stage === "cameraFocusDice"
        ? 3.45
        : autoCamera
          ? 3.35
          : 1.75;
      dampVector3(camera.position, desiredPosition, cameraLerpSpeed, delta);
      dampVector3(controls.target, desiredTarget, targetLerpSpeed, delta);
      controls.update();
      animateBoard3D(model, delta, elapsed, camera);
      animateDice3D(dice, delta, elapsed);
      animateSceneEffects3D(effects, delta, elapsed, model.playerPieces, camera);
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(render);
    }

    render();

    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      renderer.domElement.removeEventListener("pointercancel", handlePointerCancel);
      renderer.domElement.removeEventListener("pointerleave", handlePointerLeave);
      renderer.domElement.style.cursor = "";
      controls.dispose();
      scene.remove(model.group);
      scene.remove(dice);
      scene.remove(effects.layer);
      disposeObject3D(model.group);
      disposeObject3D(dice);
      disposeObject3D(effects.layer);
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      modelRef.current = null;
      diceRef.current = null;
      sceneRef.current = null;
    };
  }, []);

  return <div ref={mountRef} className="monopoly-3d-canvas" />;
}
