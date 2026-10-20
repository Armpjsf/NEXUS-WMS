'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import {
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Eye,
  Info,
  Maximize2,
  Box,
  Flame,
  CheckCircle2,
  AlertTriangle,
  X,
  MapPin,
  TrendingUp,
  Settings2,
  Wand2,
  Plus,
  Trash2,
  Copy,
  Printer,
  Save,
  Sliders,
} from 'lucide-react';
import { RackConfig, binCodeFor, DEFAULT_BIN_TEMPLATE, listRackBins } from '@/lib/warehouseLayout';

type BinStockEntry = { products: any[]; totalStock: number; velocityClass: string; status?: string };

type CameraState = { rotX: number; rotY: number; dist: number; tx: number; tz: number };

function cameraMaxDist(floorSize: number): number {
  return Math.max(60, floorSize * 2.2);
}

function defaultCamera(floorSize: number): CameraState {
  return { rotX: 0.6, rotY: 0.75, dist: Math.min(cameraMaxDist(floorSize), Math.max(25, floorSize * 1.1)), tx: 0, tz: 0 };
}

const CAMERA_MIN_DIST = 4;

interface Warehouse3DProps {
  layout: {
    widthM: number;
    lengthM: number;
    heightM: number;
    racks: RackConfig[];
  };
  products?: any[];
  /** Per-bin stock (from stock_locations). Falls back to products.location when absent. */
  binStock?: Map<string, BinStockEntry>;
  heatmapMode?: 'STOCK' | 'VELOCITY' | 'REALISTIC';
  selectedBinCode?: string | null;
  onSelectBin?: (binCode: string, binData?: any) => void;
  branchName?: string;
  isEditMode?: boolean;
  onToggleEditMode?: () => void;
  onOpenWizard?: () => void;
  onOpenLabelModal?: () => void;
  onSaveLayout?: () => void;
  isSaving?: boolean;
  onUpdateLayout?: (newLayout: any) => void;
}

export default function Warehouse3DViewer({
  layout,
  products = [],
  binStock,
  heatmapMode = 'STOCK',
  selectedBinCode,
  onSelectBin,
  branchName = 'คลังหลัก',
  isEditMode = false,
  onToggleEditMode,
  onOpenWizard,
  onOpenLabelModal,
  onSaveLayout,
  isSaving = false,
  onUpdateLayout,
}: Warehouse3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [hoveredBin, setHoveredBin] = useState<string | null>(null);
  const [activeBinDetails, setActiveBinDetails] = useState<any | null>(null);
  // Selected rack by POSITION, not code: the code itself is editable (and may be blank or clash while typing).
  const [selectedRackIdx, setSelectedRackIdx] = useState<number | null>(null);
  const [stats, setStats] = useState({ totalBins: 0, occupiedBins: 0, totalStock: 0 });

  // Camera orbit state lives outside the scene effect so rebuilding the scene
  // (stock refresh, edits, selection, parent re-render) never resets the view.
  const camRef = useRef<CameraState | null>(null);
  const applyCameraRef = useRef<(() => void) | null>(null);
  const floorSizeRef = useRef(Math.max(layout.widthM, layout.lengthM));
  floorSizeRef.current = Math.max(layout.widthM, layout.lengthM);
  // Latest callback without making it a scene dependency (it's often an inline arrow).
  const onSelectBinRef = useRef(onSelectBin);
  onSelectBinRef.current = onSelectBin;

  // Map products to bins for fast lookup & visualization
  const binDataMap = useMemo(() => {
    if (binStock) return binStock;
    const map = new Map<string, BinStockEntry>();

    products.forEach(p => {
      const loc = (p.location || 'UNASSIGNED').trim().toUpperCase();
      if (!map.has(loc)) {
        map.set(loc, { products: [], totalStock: 0, velocityClass: p.velocityClass || 'B' });
      }
      const entry = map.get(loc)!;
      entry.products.push(p);
      entry.totalStock += Number(p.stock || 0);
    });

    return map;
  }, [products, binStock]);

  // Selected Rack object for inspector
  const selectedRack = useMemo(() => {
    if (selectedRackIdx === null) return null;
    return layout.racks[selectedRackIdx] || null;
  }, [selectedRackIdx, layout.racks]);

  // Rack Mutation Handlers in Edit Mode
  const handleUpdateSelectedRack = (patch: Partial<RackConfig>) => {
    if (!selectedRack || !onUpdateLayout) return;
    const updatedRacks = layout.racks.map((r, i) => (i === selectedRackIdx ? { ...r, ...patch } : r));
    onUpdateLayout({ ...layout, racks: updatedRacks });
  };

  const uniqueRackCode = (base: string) => {
    const taken = new Set(layout.racks.map(r => r.rackCode));
    if (!taken.has(base)) return base;
    for (let i = 2; i < 1000; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
    return `${base}-${Date.now()}`;
  };

  const handleAddRack = () => {
    if (!onUpdateLayout) return;
    const zone = selectedRack?.zoneCode || layout.racks[layout.racks.length - 1]?.zoneCode || 'A';
    const nextIdx = layout.racks.filter(r => r.zoneCode === zone).length + 1;
    const newRackCode = uniqueRackCode(`${zone}-${String(nextIdx).padStart(2, '0')}`);
    const newRack: RackConfig = {
      rackCode: newRackCode,
      zoneCode: zone,
      binTemplate: selectedRack?.binTemplate,
      posX: 0,
      posZ: 0,
      rotationY: 0,
      bays: 5,
      levels: 4,
      bayWidth: 2.7,
      levelHeight: 1.8,
      rackDepth: 1.2,
      color: '#57ec7f',
      type: 'RACK',
    };
    onUpdateLayout({ ...layout, racks: [...layout.racks, newRack] });
    setSelectedRackIdx(layout.racks.length);
  };

  const handleAddFloorBlock = (blockType: 'CROSS_DOCK' | 'FLOOR_BLOCK') => {
    if (!onUpdateLayout) return;
    const isXdock = blockType === 'CROSS_DOCK';
    const nextIdx = layout.racks.filter(r => r.type === blockType).length + 1;
    const newCode = uniqueRackCode(isXdock ? `XDOCK-${String(nextIdx).padStart(2, '0')}` : `BULK-${String(nextIdx).padStart(2, '0')}`);
    const newBlock: RackConfig = {
      rackCode: newCode,
      zoneCode: isXdock ? 'XDOCK' : 'BULK',
      posX: isXdock ? 6 : -6,
      posZ: isXdock ? 15 : 0,
      rotationY: 0,
      bays: 4,
      levels: 1,
      bayWidth: 2.2,
      levelHeight: 1.2,
      rackDepth: 2.4,
      color: isXdock ? '#facc15' : '#4cd7f6',
      type: blockType,
    };
    onUpdateLayout({ ...layout, racks: [...layout.racks, newBlock] });
    setSelectedRackIdx(layout.racks.length);
  };

  const handleDuplicateRack = (rack: RackConfig) => {
    if (!onUpdateLayout) return;
    const newRackCode = uniqueRackCode(`${rack.rackCode}-COPY`);
    const duplicatedRack: RackConfig = {
      ...rack,
      rackCode: newRackCode,
      posX: rack.posX + (rack.rackDepth * 2 + 2.8), // Place across an aisle
    };
    onUpdateLayout({ ...layout, racks: [...layout.racks, duplicatedRack] });
    setSelectedRackIdx(layout.racks.length);
  };

  const handleDeleteRack = (index: number) => {
    if (!onUpdateLayout) return;
    onUpdateLayout({ ...layout, racks: layout.racks.filter((_, i) => i !== index) });
    setSelectedRackIdx(null);
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // --- 1. Scene & Camera Setup ---
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090f15); // Tactical Dark Ground
    scene.fog = new THREE.FogExp2(0x090f15, 0.008);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 500);
    camera.position.set(0, 45, 65);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.replaceChildren(renderer.domElement);

    // --- 2. Lighting ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x171c23, 0.6);
    hemiLight.position.set(0, 50, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(30, 60, 40);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 150;
    const shadowDist = Math.max(layout.widthM, layout.lengthM) * 0.7;
    dirLight.shadow.camera.left = -shadowDist;
    dirLight.shadow.camera.right = shadowDist;
    dirLight.shadow.camera.top = shadowDist;
    dirLight.shadow.camera.bottom = -shadowDist;
    scene.add(dirLight);

    // --- 3. Concrete Floor & Grid ---
    const floorGeo = new THREE.PlaneGeometry(layout.widthM, layout.lengthM);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x12171e,
      roughness: 0.8,
      metalness: 0.2,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Grid Floor
    const gridHelper = new THREE.GridHelper(
      Math.max(layout.widthM, layout.lengthM),
      Math.max(layout.widthM, layout.lengthM) / 2,
      0x30353d,
      0x1b2027
    );
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    // Staging and Dock Areas (Painted floor marking)
    const stagingGeo = new THREE.PlaneGeometry(layout.widthM - 4, 8);
    const stagingMat = new THREE.MeshBasicMaterial({ color: 0x252a32, wireframe: true });
    const stagingMesh = new THREE.Mesh(stagingGeo, stagingMat);
    stagingMesh.rotation.x = -Math.PI / 2;
    stagingMesh.position.set(0, 0.02, layout.lengthM / 2 - 5);
    scene.add(stagingMesh);

    // Yellow Perimeter Border Line
    const aisleMarkerMat = new THREE.LineBasicMaterial({ color: 0xfacc15, linewidth: 2 });
    const aisleGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-layout.widthM / 2 + 2, 0.05, -layout.lengthM / 2 + 2),
      new THREE.Vector3(layout.widthM / 2 - 2, 0.05, -layout.lengthM / 2 + 2),
      new THREE.Vector3(layout.widthM / 2 - 2, 0.05, layout.lengthM / 2 - 2),
      new THREE.Vector3(-layout.widthM / 2 + 2, 0.05, layout.lengthM / 2 - 2),
      new THREE.Vector3(-layout.widthM / 2 + 2, 0.05, -layout.lengthM / 2 + 2),
    ]);
    const perimeterLine = new THREE.Line(aisleGeo, aisleMarkerMat);
    scene.add(perimeterLine);

    // --- 4. Procedural Racking Construction ---
    const binMeshes: THREE.Mesh[] = [];
    const rackHitBoxes: THREE.Mesh[] = [];
    let countTotalBins = 0;
    let countOccupiedBins = 0;
    let countStock = 0;

    // Materials
    const steelPostMat = new THREE.MeshStandardMaterial({ color: 0x252a32, metalness: 0.8, roughness: 0.3 });
    const beamMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.6, roughness: 0.4 });
    const selectedBeamMat = new THREE.MeshStandardMaterial({ color: 0x4cd7f6, metalness: 0.8, roughness: 0.2, emissive: 0x0ea5e9, emissiveIntensity: 0.3 });

    layout.racks.forEach((rack, rackIndex) => {
      const isThisRackSelected = isEditMode && selectedRackIdx === rackIndex;
      const currentBeamMat = isThisRackSelected ? selectedBeamMat : beamMat;
      const isFloor = rack.type === 'CROSS_DOCK' || rack.type === 'FLOOR_BLOCK';

      const rackGroup = new THREE.Group();
      rackGroup.position.set(rack.posX, 0, rack.posZ);
      rackGroup.rotation.y = rack.rotationY;

      const totalRackLength = rack.bays * rack.bayWidth;
      const totalRackHeight = rack.levels * rack.levelHeight;

      if (isFloor) {
        // Floor Staging Boundary Pad
        const padGeo = new THREE.PlaneGeometry(totalRackLength, rack.rackDepth);
        const padMat = new THREE.MeshStandardMaterial({
          color: rack.type === 'CROSS_DOCK' ? 0x241d08 : 0x0f1c24,
          roughness: 0.9,
        });
        const padMesh = new THREE.Mesh(padGeo, padMat);
        padMesh.rotation.x = -Math.PI / 2;
        padMesh.position.set(0, 0.03, 0);
        padMesh.receiveShadow = true;
        rackGroup.add(padMesh);

        // Floor Border Lines (Yellow for Cross-dock, Cyan for Bulk)
        const borderMat = new THREE.LineBasicMaterial({
          color: isThisRackSelected ? 0x0ea5e9 : rack.type === 'CROSS_DOCK' ? 0xfacc15 : 0x4cd7f6,
          linewidth: 2,
        });
        const borderGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(-totalRackLength / 2, 0.04, -rack.rackDepth / 2),
          new THREE.Vector3(totalRackLength / 2, 0.04, -rack.rackDepth / 2),
          new THREE.Vector3(totalRackLength / 2, 0.04, rack.rackDepth / 2),
          new THREE.Vector3(-totalRackLength / 2, 0.04, rack.rackDepth / 2),
          new THREE.Vector3(-totalRackLength / 2, 0.04, -rack.rackDepth / 2),
        ]);
        const borderLine = new THREE.Line(borderGeo, borderMat);
        rackGroup.add(borderLine);
      } else {
        // Vertical Uprights (Posts)
        const postGeo = new THREE.BoxGeometry(0.12, totalRackHeight + 0.5, 0.12);
        for (let b = 0; b <= rack.bays; b++) {
          const xPos = -totalRackLength / 2 + b * rack.bayWidth;
          // Front upright
          const postFront = new THREE.Mesh(postGeo, steelPostMat);
          postFront.position.set(xPos, totalRackHeight / 2, rack.rackDepth / 2);
          postFront.castShadow = true;
          rackGroup.add(postFront);

          // Back upright
          const postBack = new THREE.Mesh(postGeo, steelPostMat);
          postBack.position.set(xPos, totalRackHeight / 2, -rack.rackDepth / 2);
          postBack.castShadow = true;
          rackGroup.add(postBack);
        }
      }

      // Horizontal Beams & Individual Bins
      const beamGeo = new THREE.BoxGeometry(totalRackLength, 0.08, 0.08);

      for (let lvl = 1; lvl <= rack.levels; lvl++) {
        const yPos = isFloor ? (lvl * 1.1) : (lvl * rack.levelHeight);

        if (!isFloor) {
          // Front & Back Beams
          const beamFront = new THREE.Mesh(beamGeo, currentBeamMat);
          beamFront.position.set(0, yPos, rack.rackDepth / 2);
          rackGroup.add(beamFront);

          const beamBack = new THREE.Mesh(beamGeo, currentBeamMat);
          beamBack.position.set(0, yPos, -rack.rackDepth / 2);
          rackGroup.add(beamBack);

          // If non-pallet shelving, add a solid shelf decking board
          if (rack.palletMode === 'NON_PALLET') {
            const deckGeo = new THREE.BoxGeometry(totalRackLength, 0.02, rack.rackDepth);
            const deckMat = new THREE.MeshStandardMaterial({ color: 0x3d4450, roughness: 0.8 });
            const deck = new THREE.Mesh(deckGeo, deckMat);
            deck.position.set(0, yPos - 0.04, 0);
            deck.receiveShadow = true;
            rackGroup.add(deck);
          }
        }

        // Individual Bins inside this level
        for (let bay = 1; bay <= rack.bays; bay++) {
          const binCode = binCodeFor(rack, bay, lvl);
          if (!binCode) continue; // slot switched off (merged bay / no bin)
          countTotalBins++;
          const xPos = -totalRackLength / 2 + (bay - 0.5) * rack.bayWidth;

          const binData = binDataMap.get(binCode);
          const hasStock = !!(binData && binData.totalStock > 0);

          if (hasStock) {
            countOccupiedBins++;
            countStock += binData.totalStock;
          }

          // Bin Box Geometry
          const boxW = rack.bayWidth * 0.88;
          const boxH = isFloor ? 1.0 : (rack.levelHeight * 0.75);
          const boxD = rack.rackDepth * 0.88;

          const binBoxGeo = new THREE.BoxGeometry(boxW, boxH, boxD);

          // Color calculation based on heatmap mode
          let boxColor = isFloor ? (rack.type === 'CROSS_DOCK' ? 0x854d0e : 0x164e63) : 0x30353d;
          let boxOpacity = isFloor ? 0.4 : 0.25;

          if (isThisRackSelected) {
            boxColor = 0x0284c7; // Highlight selected rack in editor
            boxOpacity = 0.7;
          } else if (hasStock) {
            boxOpacity = 0.9;
            // Same colours as the 2D plan legend
            if (heatmapMode === 'STOCK') {
              boxColor = binData.status === 'LOW_STOCK' ? 0xf59e0b : 0x10b981;
            } else if (heatmapMode === 'VELOCITY') {
              boxColor = binData.velocityClass === 'A' ? 0xef4444 : binData.velocityClass === 'B' ? 0xf59e0b : binData.velocityClass === 'C' ? 0x3b82f6 : 0x64748b;
            } else {
              boxColor = 0xd97706; // Wooden cardboard pallet
            }
          }

          const binBoxMat = new THREE.MeshStandardMaterial({
            color: boxColor,
            roughness: 0.6,
            metalness: 0.2,
            transparent: !hasStock && !isThisRackSelected,
            opacity: boxOpacity,
          });

          const binMesh = new THREE.Mesh(binBoxGeo, binBoxMat);
          binMesh.position.set(xPos, isFloor ? (boxH / 2 + 0.04) : (yPos - boxH / 2 + 0.05), 0);
          binMesh.castShadow = hasStock;
          binMesh.receiveShadow = true;

          // Attach metadata to mesh
          binMesh.userData = {
            binCode,
            rackCode: rack.rackCode,
            rackIndex,
            zone: rack.zoneCode,
            bay,
            level: lvl,
            hasStock,
            binData,
            rackType: rack.type || 'RACK',
            palletMode: rack.palletMode || 'PALLET',
          };

          rackGroup.add(binMesh);
          binMeshes.push(binMesh);
        }
      }

      // Transparent HitBox encompassing the entire rack for 100% reliable 1-click selection
      const hitBoxGeo = new THREE.BoxGeometry(
        totalRackLength + 0.4,
        Math.max(1.5, totalRackHeight + 0.6),
        rack.rackDepth + 0.6
      );
      const hitBoxMat = new THREE.MeshBasicMaterial({
        color: 0x0ea5e9,
        transparent: true,
        opacity: isThisRackSelected ? 0.15 : 0.0,
        wireframe: isThisRackSelected,
      });
      const hitBox = new THREE.Mesh(hitBoxGeo, hitBoxMat);
      hitBox.position.set(0, Math.max(1.5, totalRackHeight) / 2, 0);
      hitBox.userData = { rackCode: rack.rackCode, rackIndex };
      rackGroup.add(hitBox);
      rackHitBoxes.push(hitBox);

      scene.add(rackGroup);
    });

    setStats({
      totalBins: countTotalBins,
      occupiedBins: countOccupiedBins,
      totalStock: countStock,
    });

    // --- 5. Mouse Raycasting (Interaction) ---
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerMove = (e: MouseEvent) => {
      if (activePointers.size > 0) return; // dragging: skip hover raycast
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);

      if (isEditMode) {
        // In Edit Mode: Raycast against rack hitboxes for effortless rack selection
        const intersects = raycaster.intersectObjects([...rackHitBoxes, ...binMeshes]);
        if (intersects.length > 0) {
          const top = intersects[0].object as THREE.Mesh;
          const rackCode = top.userData?.rackCode;
          if (rackCode) {
            setHoveredBin(`แร็ก: ${rackCode} (คลิกเพื่อแก้ไข)`);
            container.style.cursor = 'pointer';
          }
        } else {
          setHoveredBin(null);
          container.style.cursor = 'grab';
        }
      } else {
        const intersects = raycaster.intersectObjects(binMeshes);
        if (intersects.length > 0) {
          const top = intersects[0].object as THREE.Mesh;
          const code = top.userData?.binCode;
          if (code) {
            setHoveredBin(code);
            container.style.cursor = 'pointer';
          }
        } else {
          setHoveredBin(null);
          container.style.cursor = 'grab';
        }
      }
    };

    const handlePointerClick = (e: MouseEvent) => {
      if (dragDistance > 6) return; // that was a rotate/pan/pinch, not a click
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);

      if (isEditMode) {
        // In Edit Mode: Click anywhere on rack or its hitbox to select it
        const intersects = raycaster.intersectObjects([...rackHitBoxes, ...binMeshes]);
        if (intersects.length > 0) {
          const hit = intersects[0].object as THREE.Mesh;
          const idx = hit.userData?.rackIndex;
          if (typeof idx === 'number') setSelectedRackIdx(idx);
        }
      } else {
        const intersects = raycaster.intersectObjects(binMeshes);
        if (intersects.length > 0) {
          const hit = intersects[0].object as THREE.Mesh;
          const data = hit.userData;
          if (data?.binCode) {
            setActiveBinDetails(data);
            onSelectBinRef.current?.(data.binCode, data.binData);
          }
        }
      }
    };

    renderer.domElement.addEventListener('mousemove', handlePointerMove);
    renderer.domElement.addEventListener('click', handlePointerClick);

    // --- 6. Camera controls (mouse + touch, state kept in camRef) ---
    //   drag = rotate | right-drag / Shift-drag / two-finger drag = pan | wheel / pinch = zoom
    const floorSize = Math.max(layout.widthM, layout.lengthM);
    if (!camRef.current) camRef.current = defaultCamera(floorSize);
    const cam = camRef.current;
    const maxDist = cameraMaxDist(floorSize);

    const applyCamera = () => {
      cam.dist = Math.max(CAMERA_MIN_DIST, Math.min(maxDist, cam.dist));
      cam.tx = Math.max(-layout.widthM / 2, Math.min(layout.widthM / 2, cam.tx));
      cam.tz = Math.max(-layout.lengthM / 2, Math.min(layout.lengthM / 2, cam.tz));
      camera.position.set(
        cam.tx + cam.dist * Math.sin(cam.rotY) * Math.cos(cam.rotX),
        cam.dist * Math.sin(cam.rotX),
        cam.tz + cam.dist * Math.cos(cam.rotY) * Math.cos(cam.rotX),
      );
      camera.lookAt(cam.tx, 1.5, cam.tz);
    };
    applyCamera();
    applyCameraRef.current = applyCamera;

    const pan = (dx: number, dy: number) => {
      const k = cam.dist * 0.0016;
      // screen-right and screen-up expressed on the ground plane
      const rightX = Math.cos(cam.rotY), rightZ = -Math.sin(cam.rotY);
      const fwdX = -Math.sin(cam.rotY), fwdZ = -Math.cos(cam.rotY);
      cam.tx += (-dx * rightX + dy * fwdX) * k;
      cam.tz += (-dx * rightZ + dy * fwdZ) * k;
    };

    const el = renderer.domElement;
    el.style.touchAction = 'none'; // we handle pinch/drag instead of the browser
    const activePointers = new Map<number, { x: number; y: number }>();
    let dragDistance = 0;
    let panning = false;
    let pinchDist = 0;
    let pinchMid = { x: 0, y: 0 };

    const twoFinger = () => {
      const [a, b] = Array.from(activePointers.values());
      return { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
    };

    const onPointerDown = (e: PointerEvent) => {
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { el.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
      if (activePointers.size === 1) {
        dragDistance = 0;
        panning = e.button === 2 || e.shiftKey;
      } else if (activePointers.size === 2) {
        const t = twoFinger();
        pinchDist = t.dist;
        pinchMid = t.mid;
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const prev = activePointers.get(e.pointerId);
      if (!prev) return;
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (activePointers.size === 1) {
        const dx = e.clientX - prev.x;
        const dy = e.clientY - prev.y;
        dragDistance += Math.abs(dx) + Math.abs(dy);
        if (panning) pan(dx, dy);
        else {
          cam.rotY -= dx * 0.008;
          cam.rotX = Math.max(0.12, Math.min(Math.PI / 2.05, cam.rotX + dy * 0.008));
        }
      } else if (activePointers.size === 2) {
        const t = twoFinger();
        if (pinchDist > 0 && t.dist > 0) cam.dist *= pinchDist / t.dist;
        pan(t.mid.x - pinchMid.x, t.mid.y - pinchMid.y);
        pinchDist = t.dist;
        pinchMid = t.mid;
        dragDistance += 10;
      }
      applyCamera();
    };

    const onPointerUp = (e: PointerEvent) => {
      activePointers.delete(e.pointerId);
      if (activePointers.size < 2) pinchDist = 0;
      if (activePointers.size === 1) panning = false; // remaining finger rotates
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cam.dist *= Math.exp(e.deltaY * 0.0012);
      applyCamera();
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('contextmenu', onContextMenu);

    // Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('contextmenu', onContextMenu);
      applyCameraRef.current = null;
      renderer.domElement.removeEventListener('mousemove', handlePointerMove);
      renderer.domElement.removeEventListener('click', handlePointerClick);
      renderer.dispose();
    };
  }, [layout, heatmapMode, binDataMap, isEditMode, selectedRackIdx]);

  const zoomCamera = (factor: number) => {
    if (!camRef.current) return;
    camRef.current.dist *= factor;
    applyCameraRef.current?.();
  };

  const resetCamera = () => {
    // Mutate in place: the scene's controls hold this same object.
    if (camRef.current) Object.assign(camRef.current, defaultCamera(floorSizeRef.current));
    applyCameraRef.current?.();
  };

  const occupancyRate = stats.totalBins > 0 ? Math.round((stats.occupiedBins / stats.totalBins) * 100) : 0;

  return (
    <div className="relative w-full h-[680px] bg-[#090f15] rounded-3xl overflow-hidden border border-[#30353d] shadow-2xl select-none">
      {/* 3D WebGL Canvas */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Left Floating HUD: Telemetry & Branch Info */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 pointer-events-none">
        <div className="bg-[#171c23]/90 backdrop-blur-md border border-[#30353d] px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-[#57ec7f] animate-pulse" />
          <div>
            <h4 className="text-xs font-mono font-bold text-[#dee2ec] uppercase tracking-wider">
              {branchName} • 3D DIGITAL TWIN {isEditMode && <span className="text-[#facc15] ml-1">[โหมดแก้ไข]</span>}
            </h4>
            <p className="text-[10px] text-[#8a92a6] font-mono">
              มิติ {layout.widthM}m × {layout.lengthM}m • แร็ก {layout.racks.length} แถว
            </p>
          </div>
        </div>

        {/* Live KPIs */}
        <div className="flex items-center gap-2">
          <div className="bg-[#171c23]/90 backdrop-blur-md border border-[#30353d] px-3 py-1.5 rounded-xl text-xs font-mono flex items-center gap-2">
            <span className="text-[#8a92a6]">ความจุคลัง:</span>
            <span className="font-bold text-[#facc15]">{occupancyRate}%</span>
            <span className="text-[10px] text-[#8a92a6]">({stats.occupiedBins}/{stats.totalBins})</span>
          </div>

          <div className="bg-[#171c23]/90 backdrop-blur-md border border-[#30353d] px-3 py-1.5 rounded-xl text-xs font-mono flex items-center gap-2">
            <span className="text-[#8a92a6]">สต็อกรวม:</span>
            <span className="font-bold text-[#4cd7f6]">{stats.totalStock.toLocaleString()} ชิ้น</span>
          </div>
        </div>
      </div>

      {/* Top Right Floating Toolbar: Edit Mode & Actions */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        {onToggleEditMode && (
          <button
            onClick={onToggleEditMode}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg ${
              isEditMode
                ? 'bg-[#facc15] text-[#1b1600] font-black shadow-[#facc15]/20 border border-[#facc15]'
                : 'bg-[#171c23]/90 text-[#dee2ec] border border-[#30353d] hover:border-slate-500'
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            {isEditMode ? 'เสร็จสิ้นการแก้ไข' : 'ปรับแต่งผังคลัง'}
          </button>
        )}

        {isEditMode && (
          <>
            {onOpenWizard && (
              <button
                onClick={onOpenWizard}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#171c23]/90 border border-[#facc15]/50 text-[#facc15] hover:bg-[#facc15]/10 transition-all flex items-center gap-1.5 shadow-lg"
              >
                <Wand2 className="w-3.5 h-3.5" /> Wizard คลังใหม่
              </button>
            )}

            {/* Quick Rack Selector Dropdown */}
            {layout.racks.length > 0 && (
              <div className="flex items-center gap-1.5 bg-[#171c23]/90 border border-[#30353d] px-2.5 py-1 rounded-xl shadow-lg">
                <span className="text-[10px] text-[#8a92a6] font-mono">เลือกแถว:</span>
                <select
                  value={selectedRackIdx === null ? '' : String(selectedRackIdx)}
                  onChange={e => setSelectedRackIdx(e.target.value === '' ? null : Number(e.target.value))}
                  className="bg-transparent text-xs font-mono font-bold text-[#facc15] outline-none cursor-pointer max-w-[150px]"
                >
                  <option value="" className="bg-[#171c23] text-[#8a92a6]">-- เลือกแร็ก ({layout.racks.length} แถว) --</option>
                  {layout.racks.map((r, i) => (
                    <option key={i} value={String(i)} className="bg-[#171c23] text-[#dee2ec]">
                      {r.rackCode || '(ไม่มีรหัส)'} ({r.type === 'CROSS_DOCK' ? 'X-Dock' : r.type === 'FLOOR_BLOCK' ? 'Floor' : `Zone ${r.zoneCode}`})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={handleAddRack}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#171c23]/90 border border-[#30353d] text-[#dee2ec] hover:border-slate-400 transition-all flex items-center gap-1.5 shadow-lg"
            >
              <Plus className="w-3.5 h-3.5 text-[#57ec7f]" /> เพิ่มแร็ก
            </button>

            <button
              onClick={() => handleAddFloorBlock('CROSS_DOCK')}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#171c23]/90 border border-[#facc15]/40 text-[#facc15] hover:bg-[#facc15]/10 transition-all flex items-center gap-1.5 shadow-lg"
            >
              <Plus className="w-3.5 h-3.5 text-[#facc15]" /> ลาน Cross-Dock
            </button>

            <button
              onClick={() => handleAddFloorBlock('FLOOR_BLOCK')}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#171c23]/90 border border-[#4cd7f6]/40 text-[#4cd7f6] hover:bg-[#4cd7f6]/10 transition-all flex items-center gap-1.5 shadow-lg"
            >
              <Plus className="w-3.5 h-3.5 text-[#4cd7f6]" /> ลานวางพื้น (Bulk)
            </button>

            <button
              onClick={() => {
                if (window.confirm('คุณต้องการล้างแร็กทั้งหมดในผังนี้เพื่อเริ่มสร้างใหม่ใช่หรือไม่?')) {
                  onUpdateLayout?.({ ...layout, racks: [] });
                  setSelectedRackIdx(null);
                }
              }}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-[#171c23]/90 border border-red-900/50 text-red-400 hover:bg-red-950/60 transition-all flex items-center gap-1 shadow-lg"
              title="ลบแร็กทั้งหมดในผังนี้เพื่อเริ่มวางใหม่"
            >
              <Trash2 className="w-3.5 h-3.5" /> ล้างผัง
            </button>

            {onOpenLabelModal && (
              <button
                onClick={onOpenLabelModal}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#171c23]/90 border border-[#30353d] text-[#dee2ec] hover:border-slate-400 transition-all flex items-center gap-1.5 shadow-lg"
              >
                <Printer className="w-3.5 h-3.5 text-[#4cd7f6]" /> พิมพ์บาร์โค้ด
              </button>
            )}

            {onSaveLayout && (
              <button
                onClick={onSaveLayout}
                disabled={isSaving}
                className="px-4 py-1.5 rounded-xl text-xs font-black bg-[#57ec7f] text-[#09150c] hover:bg-[#72f595] transition-all flex items-center gap-1.5 shadow-lg shadow-[#57ec7f]/20 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" /> {isSaving ? 'กำลังบันทึก...' : 'บันทึกผัง'}
              </button>
            )}
          </>
        )}
      </div>

      {/* Hover Tooltip HUD */}
      {hoveredBin && (
        <div className="absolute bottom-6 left-6 z-20 bg-[#171c23]/95 backdrop-blur-md border border-[#facc15]/50 px-4 py-2.5 rounded-2xl shadow-2xl pointer-events-none animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#facc15]" />
            <span className="font-mono font-bold text-sm text-[#facc15]">{hoveredBin}</span>
          </div>
        </div>
      )}

      {/* Edit Mode: Helper Panel when no rack is selected yet */}
      {isEditMode && !selectedRack && layout.racks.length > 0 && (
        <div className="absolute top-16 right-4 w-72 z-30 bg-[#171c23]/95 backdrop-blur-md border border-[#30353d] rounded-2xl p-4 shadow-2xl animate-in slide-in-from-right-4 text-xs space-y-3">
          <div className="flex items-center gap-2 text-[#facc15] font-bold">
            <Info className="w-4 h-4" /> เลือกแถวแร็กเพื่อแก้ไข
          </div>
          <p className="text-[11px] text-[#8a92a6] leading-relaxed">
            คลิกที่แร็กใดก็ได้ในจอ 3D หรือคลิกเลือกจากรายการด้านล่างเพื่อปรับพิกัด หรือลบแถวแร็ก
          </p>
          <div className="pt-2 border-t border-[#30353d] flex flex-col gap-1.5 max-h-60 overflow-y-auto pr-1">
            {layout.racks.map((r, i) => (
              <button
                key={i}
                onClick={() => setSelectedRackIdx(i)}
                className="w-full text-left px-2.5 py-1.5 rounded-lg bg-[#12161d] hover:bg-[#252a32] border border-[#30353d] flex items-center justify-between font-mono text-xs text-[#dee2ec] transition-all"
              >
                <span className="font-bold">{r.rackCode || '(ไม่มีรหัส)'}</span>
                <span className="text-[10px] text-[#8a92a6]">
                  {r.type === 'CROSS_DOCK' ? 'X-Dock' : r.type === 'FLOOR_BLOCK' ? 'Floor' : `${r.levels} ชั้น • ${r.bays} ช่อง`}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Edit Mode: Rack Inspector Panel */}
      {isEditMode && selectedRack && (
        <div className="absolute top-16 right-4 bottom-4 w-80 z-30 bg-[#171c23]/95 backdrop-blur-md border border-[#30353d] rounded-2xl p-4 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right-4">
          <div className="space-y-4 overflow-y-auto pr-1">
            <div className="flex items-center justify-between border-b border-[#30353d] pb-2">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#facc15]" />
                <h3 className="font-mono font-bold text-sm text-[#dee2ec]">
                  แก้ไขแร็ก: {selectedRack.rackCode || '(ยังไม่ตั้งรหัส)'}
                </h3>
              </div>
              <button
                onClick={() => setSelectedRackIdx(null)}
                className="p-1 rounded-lg text-[#8a92a6] hover:text-[#dee2ec] hover:bg-[#252a32]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Properties Inputs */}
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] font-mono text-[#8a92a6] block mb-1">รหัสแร็ก (Rack Code)</label>
                <input
                  type="text"
                  value={selectedRack.rackCode}
                  placeholder="เช่น A-D"
                  onChange={e => handleUpdateSelectedRack({ rackCode: e.target.value.toUpperCase() })}
                  className="w-full bg-[#12161d] border border-[#30353d] rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-[#dee2ec] focus:border-[#facc15] outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono text-[#8a92a6] block mb-1">ประเภทพื้นที่ (Storage Type)</label>
                <select
                  value={selectedRack.type || 'RACK'}
                  onChange={e => {
                    const newType = e.target.value as any;
                    const patch: Partial<RackConfig> = { type: newType };
                    if (newType !== 'RACK') {
                      patch.levels = 1;
                      patch.color = newType === 'CROSS_DOCK' ? '#facc15' : '#4cd7f6';
                    }
                    handleUpdateSelectedRack(patch);
                  }}
                  className="w-full bg-[#12161d] border border-[#30353d] rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-[#dee2ec] focus:border-[#facc15] outline-none"
                >
                  <option value="RACK">ชั้นวางเหล็ก (Pallet Rack)</option>
                  <option value="CROSS_DOCK">ลานเปลี่ยนถ่าย (Cross-Dock Staging)</option>
                  <option value="FLOOR_BLOCK">ลานวางพื้นเทกอง (Floor Bulk Storage)</option>
                </select>
              </div>

              {selectedRack.type !== 'CROSS_DOCK' && selectedRack.type !== 'FLOOR_BLOCK' && (
                <div>
                  <label className="text-[10px] font-mono text-[#8a92a6] block mb-1">รูปแบบการวางสินค้า (Loading Mode)</label>
                  <select
                    value={selectedRack.palletMode || 'PALLET'}
                    onChange={e => {
                      const mode = e.target.value as any;
                      handleUpdateSelectedRack({
                        palletMode: mode,
                        rackDepth: mode === 'NON_PALLET' ? 0.8 : 1.2,
                        levelHeight: mode === 'NON_PALLET' ? 0.8 : 1.8,
                      });
                    }}
                    className="w-full bg-[#12161d] border border-[#30353d] rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-[#dee2ec] focus:border-[#facc15] outline-none"
                  >
                    <option value="PALLET">วางบนพาเลท (Palletized Racks)</option>
                    <option value="NON_PALLET">ไม่ออนพาเลท (กล่อง/ชิ้นสินค้า - Shelving)</option>
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-mono text-[#8a92a6] block mb-1">โซน (Zone)</label>
                  <input
                    type="text"
                    list="wh-zone-codes"
                    value={selectedRack.zoneCode}
                    onChange={e => handleUpdateSelectedRack({ zoneCode: e.target.value.toUpperCase() })}
                    className="w-full bg-[#12161d] border border-[#30353d] rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-[#dee2ec] focus:border-[#facc15] outline-none"
                  />
                  <datalist id="wh-zone-codes">
                    {Array.from(new Set(layout.racks.map(r => r.zoneCode))).map(z => (
                      <option key={z} value={z} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="text-[10px] font-mono text-[#8a92a6] block mb-1">จำนวนชั้น (Levels)</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={selectedRack.levels}
                    onChange={e => handleUpdateSelectedRack({ levels: Number(e.target.value) })}
                    className="w-full bg-[#12161d] border border-[#30353d] rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-[#dee2ec] focus:border-[#facc15] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-mono text-[#8a92a6] block mb-1">ช่วงเสา (Bays)</label>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={selectedRack.bays}
                    onChange={e => handleUpdateSelectedRack({ bays: Number(e.target.value) })}
                    className="w-full bg-[#12161d] border border-[#30353d] rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-[#dee2ec] focus:border-[#facc15] outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono text-[#8a92a6] block mb-1">ความสูงชั้น (m)</label>
                  <input
                    type="number"
                    step={0.1}
                    min={0.2}
                    max={4}
                    value={selectedRack.levelHeight}
                    onChange={e => handleUpdateSelectedRack({ levelHeight: Number(e.target.value) })}
                    className="w-full bg-[#12161d] border border-[#30353d] rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-[#dee2ec] focus:border-[#facc15] outline-none"
                  />
                </div>
              </div>

              {/* Bin naming: match the labels on the real racks */}
              <div className="bg-[#12161d] p-3 rounded-xl border border-[#30353d] space-y-2">
                <label className="text-[10px] font-mono text-[#8a92a6] block uppercase tracking-wider">
                  รูปแบบรหัสโลเคชัน (ให้ตรงป้ายจริง)
                </label>
                <input
                  type="text"
                  value={selectedRack.binTemplate || ''}
                  placeholder={DEFAULT_BIN_TEMPLATE}
                  onChange={e => handleUpdateSelectedRack({ binTemplate: e.target.value })}
                  className="w-full bg-[#171c23] border border-[#30353d] rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-[#dee2ec] focus:border-[#facc15] outline-none"
                />
                <div className="flex flex-wrap gap-1">
                  {['{A}-{LLL}', '{A=G}-{LLL}', '{Z}-{LLL}.{B}', '{Z}-{R}-{BB}-{LL}'].map(t => (
                    <button
                      key={t}
                      onClick={() => handleUpdateSelectedRack({ binTemplate: t })}
                      className="px-1.5 py-0.5 rounded bg-[#252a32] hover:bg-[#30353d] text-[10px] font-mono text-[#c9d1e0]"
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-[#8a92a6] leading-relaxed">
                  {'{A}'} ช่วงเสาเป็นตัวอักษร (A, B, C…) • {'{L}'} ชั้นนับจากล่าง • {'{B}'} ช่วงเสาเป็นเลข • {'{Z}'} โซน • {'{RACK}'} รหัสแร็ก • ใส่ L/B หลายตัว = เติม 0 นำหน้า • เริ่มที่ตัวอื่นใส่ = เช่น {'{A=G}'} หรือ {'{BBB=12}'}
                </p>
                <div className="text-[10px] font-mono text-[#57ec7f] break-all">
                  ตัวอย่าง: {(() => {
                    const bins = listRackBins(selectedRack);
                    const sample = bins.slice(0, 3).map(b => b.binCode);
                    return bins.length > 3 ? `${sample.join(', ')} … ${bins[bins.length - 1].binCode} (${bins.length} ช่อง)` : sample.join(', ');
                  })()}
                </div>
                {selectedRack.binOverrides && Object.keys(selectedRack.binOverrides).length > 0 && (
                  <div className="flex items-center justify-between text-[10px] text-amber-300">
                    <span>ช่องพิเศษ/รวมช่อง {Object.keys(selectedRack.binOverrides).length} ช่อง</span>
                    <button
                      onClick={() => handleUpdateSelectedRack({ binOverrides: {} })}
                      className="underline hover:text-amber-200"
                    >
                      ล้าง
                    </button>
                  </div>
                )}
              </div>

              {/* Coordinates X, Z */}
              <div className="bg-[#12161d] p-3 rounded-xl border border-[#30353d] space-y-2">
                <span className="text-[10px] font-mono text-[#8a92a6] block uppercase tracking-wider">
                  พิกัดตำแหน่ง (Coordinates)
                </span>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-[#8a92a6]">แกน X (ซ้าย-ขวา):</span>
                  <input
                    type="number"
                    step={0.5}
                    value={selectedRack.posX}
                    onChange={e => handleUpdateSelectedRack({ posX: Number(e.target.value) })}
                    className="w-20 bg-[#171c23] border border-[#30353d] rounded-lg px-2 py-1 text-right font-mono font-bold text-[#dee2ec]"
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-[#8a92a6]">แกน Z (หน้า-หลัง):</span>
                  <input
                    type="number"
                    step={0.5}
                    value={selectedRack.posZ}
                    onChange={e => handleUpdateSelectedRack({ posZ: Number(e.target.value) })}
                    className="w-20 bg-[#171c23] border border-[#30353d] rounded-lg px-2 py-1 text-right font-mono font-bold text-[#dee2ec]"
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-[#8a92a6]">หมุน (องศา):</span>
                  <select
                    value={Math.round((((selectedRack.rotationY || 0) * 180) / Math.PI + 360) % 360)}
                    onChange={e => handleUpdateSelectedRack({ rotationY: (Number(e.target.value) * Math.PI) / 180 })}
                    className="w-20 bg-[#171c23] border border-[#30353d] rounded-lg px-2 py-1 text-right font-mono font-bold text-[#dee2ec]"
                  >
                    {[0, 90, 180, 270].map(d => <option key={d} value={d}>{d}°</option>)}
                  </select>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-[#8a92a6]">กว้างต่อช่อง (m):</span>
                  <input
                    type="number"
                    step={0.1}
                    min={0.3}
                    value={selectedRack.bayWidth}
                    onChange={e => handleUpdateSelectedRack({ bayWidth: Number(e.target.value) })}
                    className="w-20 bg-[#171c23] border border-[#30353d] rounded-lg px-2 py-1 text-right font-mono font-bold text-[#dee2ec]"
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-[#8a92a6]">ความลึก (m):</span>
                  <input
                    type="number"
                    step={0.1}
                    min={0.3}
                    value={selectedRack.rackDepth}
                    onChange={e => handleUpdateSelectedRack({ rackDepth: Number(e.target.value) })}
                    className="w-20 bg-[#171c23] border border-[#30353d] rounded-lg px-2 py-1 text-right font-mono font-bold text-[#dee2ec]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="pt-3 border-t border-[#30353d] space-y-2">
            <button
              onClick={() => handleDuplicateRack(selectedRack)}
              className="w-full py-2 rounded-xl bg-[#252a32] border border-[#30353d] text-xs font-bold text-[#dee2ec] hover:border-slate-400 transition-all flex items-center justify-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5 text-[#4cd7f6]" /> คัดลอกแถวแร็กคู่ขนาน (Duplicate)
            </button>
            <button
              onClick={() => handleDeleteRack(selectedRackIdx!)}
              className="w-full py-2 rounded-xl bg-red-950/40 border border-red-800/50 text-xs font-bold text-red-400 hover:bg-red-900/50 transition-all flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" /> ลบแร็กแถวนี้
            </button>
          </div>
        </div>
      )}

      {/* Normal Mode: Selected Bin Side Drawer */}
      {!isEditMode && activeBinDetails && (
        <div className="absolute top-4 right-4 bottom-4 w-80 z-30 bg-[#171c23]/95 backdrop-blur-md border border-[#30353d] rounded-2xl p-4 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right-4">
          <div>
            <div className="flex items-center justify-between border-b border-[#30353d] pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Box className="w-5 h-5 text-[#facc15]" />
                <div>
                  <h3 className="font-mono font-bold text-base text-[#dee2ec]">
                    {activeBinDetails.binCode}
                  </h3>
                  <span className="text-[10px] font-mono text-[#8a92a6] flex items-center gap-1.5 mt-0.5">
                    <span>ช่องที่ {activeBinDetails.bay} • ชั้นที่ {activeBinDetails.level}</span>
                    {activeBinDetails.rackType === 'CROSS_DOCK' && (
                      <span className="px-1.5 py-0.5 rounded bg-[#facc15]/20 text-[#facc15] font-bold text-[9px]">
                        CROSS-DOCK
                      </span>
                    )}
                    {activeBinDetails.rackType === 'FLOOR_BLOCK' && (
                      <span className="px-1.5 py-0.5 rounded bg-[#4cd7f6]/20 text-[#4cd7f6] font-bold text-[9px]">
                        FLOOR BULK
                      </span>
                    )}
                    {activeBinDetails.palletMode === 'NON_PALLET' && (
                      <span className="px-1.5 py-0.5 rounded bg-[#4cd7f6]/20 text-[#4cd7f6] font-bold text-[9px]">
                        NON-PALLET (วางกล่อง)
                      </span>
                    )}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setActiveBinDetails(null)}
                className="p-1 rounded-lg text-[#8a92a6] hover:text-[#dee2ec] hover:bg-[#252a32]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Details */}
            {activeBinDetails.hasStock ? (
              <div className="space-y-3">
                <div className="bg-[#12161d] p-3 rounded-xl border border-[#30353d]">
                  <span className="text-[10px] font-mono text-[#8a92a6] block mb-1">สต็อกคงเหลือรวม</span>
                  <div className="text-2xl font-black text-[#57ec7f] font-mono">
                    {activeBinDetails.binData?.totalStock || 0}{' '}
                    <span className="text-xs text-[#8a92a6] font-normal">ชิ้น</span>
                  </div>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  <span className="text-[11px] font-mono text-[#8a92a6] uppercase tracking-wider block">
                    รายการสินค้าในช่องนี้
                  </span>
                  {(activeBinDetails.binData?.products || []).map((p: any, idx: number) => (
                    <div
                      key={p.id || idx}
                      className="p-2.5 rounded-lg bg-[#1b2027] border border-[#30353d] text-xs flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-[#dee2ec] line-clamp-1">{p.name}</div>
                        <div className="text-[10px] font-mono text-[#8a92a6]">SKU: {p.sku || p.id}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-bold text-[#facc15] font-mono">{p.stock}</span>
                        <span className="text-[10px] text-[#8a92a6] ml-1">{p.unit || 'ชิ้น'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-[#8a92a6] space-y-2">
                <CheckCircle2 className="w-8 h-8 text-[#57ec7f] mx-auto opacity-70" />
                <p className="text-xs font-mono">ช่องนี้ว่าง พร้อมสำหรับจัดเก็บ (Available)</p>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-[#30353d] text-[10px] text-[#8a92a6] font-mono text-center">
            หมุนภาพ: คลิกซ้ายลาก • ซูม: สกอร์ลเมาส์
          </div>
        </div>
      )}

      {/* Camera controls */}
      <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5">
        <span className="hidden md:inline bg-[#171c23]/80 backdrop-blur-md border border-[#30353d] px-3 py-1.5 rounded-xl text-[11px] text-[#8a92a6] pointer-events-none">
          ลากหมุน • คลิกขวา/Shift+ลาก เลื่อน • ล้อเมาส์/2 นิ้ว ซูม
        </span>
        {[
          { icon: ZoomIn, label: 'ซูมเข้า', run: () => zoomCamera(0.75) },
          { icon: ZoomOut, label: 'ซูมออก', run: () => zoomCamera(1 / 0.75) },
          { icon: RotateCcw, label: 'รีเซ็ตมุมกล้อง', run: resetCamera },
        ].map(({ icon: Icon, label, run }) => (
          <button
            key={label}
            onClick={run}
            title={label}
            aria-label={label}
            className="p-2 rounded-xl bg-[#171c23]/90 backdrop-blur-md border border-[#30353d] text-[#facc15] hover:bg-[#252a32]"
          >
            <Icon className="w-4 h-4" />
          </button>
        ))}
      </div>
    </div>
  );
}
